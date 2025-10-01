import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  StyleSheet,
  SafeAreaView,
  Image,
  Linking,
  Dimensions,
} from 'react-native';

const { width } = Dimensions.get('window');
const NEWS_API_KEY = '423c416733b14bab9c8aac3798b82404';
const BASE_URL = 'https://newsapi.org/v2';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

// Simple in-memory cache implementation
class SimpleCache {
  private cache: Map<string, { data: any; timestamp: number }> = new Map();

  set(key: string, data: any): void {
    this.cache.set(key, {
      data: data,
      timestamp: Date.now()
    });
    console.log(`Cache: Stored ${key} with ${Array.isArray(data) ? data.length : 1} items`);
  }

  get(key: string): any | null {
    const cached = this.cache.get(key);
    if (!cached) {
      console.log(`Cache: No data found for ${key}`);
      return null;
    }

    // Check if cache is still valid
    const age = Date.now() - cached.timestamp;
    if (age > CACHE_DURATION) {
      console.log(`Cache: Data for ${key} expired (${Math.round(age / 1000)}s old)`);
      this.cache.delete(key);
      return null;
    }

    console.log(`Cache: Retrieved ${key} (${Math.round(age / 1000)}s old)`);
    return cached.data;
  }

  clear(): void {
    this.cache.clear();
    console.log('Cache: Cleared all data');
  }

  has(key: string): boolean {
    const cached = this.cache.get(key);
    if (!cached) return false;
    
    const age = Date.now() - cached.timestamp;
    return age <= CACHE_DURATION;
  }
}

// Global cache instance
const newsCache = new SimpleCache();

type Article = {
  title: string;
  description: string;
  url: string;
  urlToImage: string;
  publishedAt: string;
  source: {
    name: string;
  };
  author: string;
};

type NewsResponse = {
  status: string;
  totalResults: number;
  articles: Article[];
  message?: string; // For error responses
};

export default function NewsReaderScreen() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const PAGE_SIZE = 20;

  // Check if cache is still valid
  const isCacheValid = (): boolean => {
    return newsCache.has('articles');
  };

  // Load articles from cache
  const loadFromCache = (): Article[] => {
    return newsCache.get('articles') || [];
  };

  // Save articles to cache
  const saveToCache = (articlesToCache: Article[]): void => {
    newsCache.set('articles', articlesToCache);
  };

  // Fetch news from API
  const fetchNews = async (pageNum: number = 1, isRefresh: boolean = false): Promise<Article[]> => {
    try {
      const url = `${BASE_URL}/top-headlines?country=us&page=${pageNum}&pageSize=${PAGE_SIZE}&apiKey=${NEWS_API_KEY}`;
      
      console.log('Fetching news from:', url);
      
      const response = await fetch(url);
      const data: NewsResponse = await response.json();
      
      if (data.status !== 'ok') {
        throw new Error(data.message || 'Failed to fetch news');
      }

      console.log(`Fetched ${data.articles.length} articles for page ${pageNum}`);
      
      // Filter out articles with missing essential data
      const validArticles = data.articles.filter(article => 
        article.title && 
        article.description && 
        article.title !== '[Removed]' &&
        article.description !== '[Removed]'
      );

      // Cache the first page data
      if (pageNum === 1 && isRefresh) {
        saveToCache(validArticles);
      }

      return validArticles;
    } catch (error: any) {
      console.error('API fetch error:', error);
      throw new Error(error.message || 'Network error occurred');
    }
  };

  // Load initial data
  const loadInitialData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Check cache first
      const cacheValid = isCacheValid();
      
      if (cacheValid) {
        console.log('Loading from cache...');
        const cachedArticles = loadFromCache();
        if (cachedArticles.length > 0) {
          setArticles(cachedArticles);
          setPage(2); // Next page to load
          setLoading(false);
          return;
        }
      }

      // Fetch from API if cache is invalid or empty
      console.log('Fetching fresh data from API...');
      const freshArticles = await fetchNews(1, true);
      setArticles(freshArticles);
      setPage(2);
      setHasMore(freshArticles.length === PAGE_SIZE);
      
    } catch (error: any) {
      console.error('Error loading initial data:', error);
      setError(error.message);
      
      // Try to load cached data as fallback
      const cachedArticles = loadFromCache();
      if (cachedArticles.length > 0) {
        setArticles(cachedArticles);
        setError('Showing cached articles (offline mode)');
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle pull to refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    
    try {
      const freshArticles = await fetchNews(1, true);
      setArticles(freshArticles);
      setPage(2);
      setHasMore(freshArticles.length === PAGE_SIZE);
    } catch (error: any) {
      setError(error.message);
      Alert.alert('Refresh Failed', error.message);
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Load more articles (pagination)
  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    
    setLoadingMore(true);
    
    try {
      const moreArticles = await fetchNews(page);
      
      if (moreArticles.length === 0) {
        setHasMore(false);
      } else {
        setArticles(prev => [...prev, ...moreArticles]);
        setPage(prev => prev + 1);
        setHasMore(moreArticles.length === PAGE_SIZE);
      }
    } catch (error: any) {
      console.error('Error loading more articles:', error);
      Alert.alert('Error', 'Failed to load more articles');
    } finally {
      setLoadingMore(false);
    }
  };

  // Open article URL
  const openArticle = useCallback((url: string) => {
    Linking.openURL(url).catch(err => {
      console.error('Error opening URL:', err);
      Alert.alert('Error', 'Could not open article');
    });
  }, []);

  // Format date
  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'Unknown date';
    }
  };

  // Render article item
  const renderArticle = ({ item }: { item: Article }) => (
    <TouchableOpacity 
      style={styles.articleCard} 
      onPress={() => openArticle(item.url)}
      activeOpacity={0.7}
    >
      <View style={styles.articleContent}>
        {item.urlToImage && (
          <Image 
            source={{ uri: item.urlToImage }} 
            style={styles.articleImage}
            resizeMode="cover"
          />
        )}
        
        <View style={styles.articleText}>
          <Text style={styles.articleTitle} numberOfLines={3}>
            {item.title}
          </Text>
          
          <Text style={styles.articleDescription} numberOfLines={2}>
            {item.description}
          </Text>
          
          <View style={styles.articleMeta}>
            <Text style={styles.sourceText}>
              {item.source.name}
            </Text>
            <Text style={styles.dateText}>
              {formatDate(item.publishedAt)}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  // Render footer
  const renderFooter = () => {
    if (!loadingMore) return null;
    
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color="#6C63FF" />
        <Text style={styles.footerText}>Loading more articles...</Text>
      </View>
    );
  };

  // Render empty state
  const renderEmpty = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyText}>📰</Text>
      <Text style={styles.emptyTitle}>No Articles Found</Text>
      <Text style={styles.emptyDescription}>
        Pull down to refresh and get the latest news
      </Text>
    </View>
  );

  // Initialize data on mount
  useEffect(() => {
    loadInitialData();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>📰 News Reader</Text>
        <Text style={styles.headerSubtitle}>Latest Headlines</Text>
      </View>

      {/* Error Banner */}
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>⚠️ {error}</Text>
        </View>
      )}

      {/* Loading State */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6C63FF" />
          <Text style={styles.loadingText}>Loading latest news...</Text>
        </View>
      ) : (
        /* News List */
        <FlatList
          data={articles}
          renderItem={renderArticle}
          keyExtractor={(item, index) => `${item.url}-${index}`}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#6C63FF']}
              tintColor="#6C63FF"
            />
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={renderEmpty}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    backgroundColor: '#6C63FF',
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#E8E6FF',
    textAlign: 'center',
    marginTop: 4,
  },
  errorBanner: {
    backgroundColor: '#FFE5E5',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#FF5252',
  },
  errorText: {
    color: '#D32F2F',
    fontSize: 14,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  listContent: {
    padding: 16,
  },
  articleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  articleContent: {
    padding: 16,
  },
  articleImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 12,
    backgroundColor: '#E0E0E0',
  },
  articleText: {
    flex: 1,
  },
  articleTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2D3748',
    lineHeight: 24,
    marginBottom: 8,
  },
  articleDescription: {
    fontSize: 14,
    color: '#4A5568',
    lineHeight: 20,
    marginBottom: 12,
  },
  articleMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sourceText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6C63FF',
  },
  dateText: {
    fontSize: 12,
    color: '#718096',
  },
  footerLoader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  footerText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 60,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2D3748',
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 14,
    color: '#718096',
    textAlign: 'center',
    paddingHorizontal: 40,
    lineHeight: 20,
  },
});
