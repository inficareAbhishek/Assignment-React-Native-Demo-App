import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
} from "react-native";
import axios from "axios";

const { width } = Dimensions.get("window");
const ITEM_WIDTH = width / 2 - 16; // 2 columns, margin 16

type Product = {
  id: number;
  title: string;
  price: number;
  thumbnail: string;
  category: string;
};

type Category = {
  slug: string;
  name: string;
  url: string;
};

export default function ProductListScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchText, setSearchText] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const LIMIT = 20;

  // Fetch categories
  const fetchCategories = async () => {
    try {
      const res = await axios.get("https://dummyjson.com/products/categories");
      setCategories(res.data);
    } catch (error) {
      console.error(error);
    }
  };

  // Fetch products
  const fetchProducts = async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    try {
      let url = `https://dummyjson.com/products?limit=${LIMIT}&skip=${page * LIMIT}`;
      if (selectedCategory) {
        url = `https://dummyjson.com/products/category/${selectedCategory}?limit=${LIMIT}&skip=${page * LIMIT}`;
      }
      if (searchText) {
        url = `https://dummyjson.com/products/search?q=${searchText}&limit=${LIMIT}&skip=${page * LIMIT}`;
      }

      const res = await axios.get(url);
      const newProducts = res.data.products || [];

      setProducts((prev) => [...prev, ...newProducts]);
      setHasMore(newProducts.length === LIMIT);
      setPage((prev) => prev + 1);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
    resetAndFetch();
  }, [selectedCategory, searchText]);

  // Reset products and page when search/filter changes
  const resetAndFetch = () => {
    setProducts([]);
    setPage(0);
    setHasMore(true);
    setTimeout(fetchProducts, 0);
  };

  const renderItem = ({ item }: { item: Product }) => (
    <View style={styles.itemContainer}>
      <View style={styles.thumbnailContainer}>
        <Text>{item.title}</Text>
        <Text style={{ fontWeight: "bold" }}>${item.price}</Text>
      </View>
    </View>
  );

  const keyExtractor = (item: Product) => item.id.toString();

  const getItemLayout = (_: any, index: number) => ({
    length: ITEM_WIDTH + 16,
    offset: (ITEM_WIDTH + 16) * index,
    index,
  });

  return (
    <View style={styles.container}>
      {/* Search input */}
      <TextInput
        style={styles.searchInput}
        placeholder="Search products..."
        value={searchText}
        onChangeText={setSearchText}
      />

      {/* Category filter */}
      <FlatList
        horizontal
        data={categories}
        keyExtractor={(item) => item.slug}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.categoryButton,
              selectedCategory === item.slug && styles.categoryButtonSelected,
            ]}
            onPress={() => setSelectedCategory(item.slug === selectedCategory ? "" : item.slug)}
          >
            <Text
              style={{
                color: selectedCategory === item.slug ? "#fff" : "#000",
              }}
            >
              {item.name}
            </Text>
          </TouchableOpacity>
        )}
        showsHorizontalScrollIndicator={false}
        style={{ maxHeight: 50, marginBottom: 8 }}
      />

      {/* Product list */}
      <FlatList
        data={products}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        numColumns={2}
        columnWrapperStyle={{ justifyContent: "space-between", marginBottom: 16 }}
        onEndReached={fetchProducts}
        onEndReachedThreshold={0.5}
        ListFooterComponent={loading ? <ActivityIndicator size="large" /> : null}
        initialNumToRender={10}
        removeClippedSubviews
        getItemLayout={getItemLayout}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 8,
    backgroundColor: "#fff",
  },
  searchInput: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
  },
  categoryButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: "#eee",
  },
  categoryButtonSelected: {
    backgroundColor: "#007AFF",
  },
  itemContainer: {
    width: ITEM_WIDTH,
    height: ITEM_WIDTH,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    padding: 8,
  },
  thumbnailContainer: {
    alignItems: "center",
  },
});
