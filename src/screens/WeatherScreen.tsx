import { fetchWeatherApi } from "openmeteo";


// src/screens/WeatherScreen.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  Alert,
  SafeAreaView,
} from "react-native";

type WeatherRow = {
  time: string;
  temperature_2m: number | null;
  wind_speed_10m: number | null;
  rain: number | null;
  showers: number | null;
  snowfall: number | null;
  wind_direction_80m: number | null;
  temperature_80m: number | null;
  relative_humidity_2m: number | null;
  dew_point_2m: number | null;
  cloud_cover: number | null;
};

export default function WeatherScreen() {
  const [weatherData, setWeatherData] = useState<WeatherRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWeather();
  }, []);

  async function loadWeather() {
    setLoading(true);
    try {
      // Build URL with parameters (change lat/lon if needed)
      const latitude = 52.52;
      const longitude = 13.41;
      const hourlyParams = [
        "temperature_2m",
        "wind_speed_10m",
        "rain",
        "showers",
        "snowfall",
        "wind_direction_80m",
        "temperature_80m",
        "relative_humidity_2m",
        "dew_point_2m",
        "cloud_cover",
      ];
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&hourly=${hourlyParams.join(
        ","
      )}`;

      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      // console.log("open-meteo response:", data);

      // Validate structure
      const hourly = data?.hourly;
      const times: string[] = Array.isArray(hourly?.time) ? hourly.time : [];

      // Helper to safely get array for a given key
      const safeArray = (key: string): any[] =>
        Array.isArray(hourly?.[key]) ? hourly[key] : [];

      // Map times -> rows
      const rows: WeatherRow[] = times.map((t, i) => ({
        time: t,
        temperature_2m: safeArray("temperature_2m")[i] ?? null,
        wind_speed_10m: safeArray("wind_speed_10m")[i] ?? null,
        rain: safeArray("rain")[i] ?? null,
        showers: safeArray("showers")[i] ?? null,
        snowfall: safeArray("snowfall")[i] ?? null,
        wind_direction_80m: safeArray("wind_direction_80m")[i] ?? null,
        temperature_80m: safeArray("temperature_80m")[i] ?? null,
        relative_humidity_2m: safeArray("relative_humidity_2m")[i] ?? null,
        dew_point_2m: safeArray("dew_point_2m")[i] ?? null,
        cloud_cover: safeArray("cloud_cover")[i] ?? null,
      }));

      setWeatherData(rows);
    } catch (err: any) {
      console.error("Weather fetch error:", err);
      Alert.alert("Weather fetch error", err.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 8 }}>Loading weather data…</Text>
      </SafeAreaView>
    );
  }

  if (!weatherData.length) {
    return (
      <SafeAreaView style={styles.center}>
        <Text>No hourly data available.</Text>
      </SafeAreaView>
    );
  }

  return (
<SafeAreaView style={styles.container}>
  <FlatList
    data={weatherData}
    keyExtractor={(item, i) => `${i}-${item.time}`}
    contentContainerStyle={{ paddingVertical: 12 }}
    renderItem={({ item }) => (
      <View style={styles.card}>
        <Text style={styles.time}>{new Date(item.time).toLocaleString(undefined, { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}</Text>

        {/* Main metrics row */}
        <View style={styles.mainRow}>
          <Text style={styles.temp}>🌡 {item.temperature_2m ?? "—"}°C</Text>
          <Text style={styles.wind}>💨 {item.wind_speed_10m ?? "—"} m/s</Text>
          <Text style={styles.rain}>☔ {item.rain ?? "—"} mm</Text>
        </View>

        {/* Secondary metrics row */}
        <View style={styles.secondaryRow}>
          <Text style={styles.secondary}>🧭 {item.wind_direction_80m ?? "—"}°</Text>
          <Text style={styles.secondary}>🌦 {item.showers ?? "—"}</Text>
          <Text style={styles.secondary}>❄️ {item.snowfall ?? "—"}</Text>
        </View>

        <View style={styles.secondaryRow}>
          <Text style={styles.secondary}>💧 {item.relative_humidity_2m ?? "—"}%</Text>
          <Text style={styles.secondary}>🌫 {item.dew_point_2m ?? "—"}°C</Text>
          <Text style={styles.secondary}>☁️ {item.cloud_cover ?? "—"}%</Text>
        </View>
      </View>
    )}
  />
</SafeAreaView>

  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f2f6fb" },
  card: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 16,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 3,
  },
  time: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 12,
  },
  mainRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  secondaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  temp: { fontSize: 18, fontWeight: "700", color: "#ff6b6b" },
  wind: { fontSize: 16, color: "#4d79ff" },
  rain: { fontSize: 16, color: "#00bfa5" },
  secondary: { fontSize: 14, color: "#555" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" }
});
