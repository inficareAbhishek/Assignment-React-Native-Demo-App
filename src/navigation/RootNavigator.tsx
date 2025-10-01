// src/navigation/RootNavigator.tsx
import React, { useContext } from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { AuthContext } from "../context/AuthContext";
import LoginScreen from "../screens/LoginScreen";
import HomeScreen from "../screens/HomeScreen";
import WeatherScreen from "../screens/WeatherScreen";
import ExpenseTrackerScreen from "../screens/ExpenseTrackerScreen";
import ProductListScreen from "../screens/ProductListScreen";

const Stack = createNativeStackNavigator();

const RootNavigator = () => {
    const { token, loading } = useContext(AuthContext);

    if (loading) return null; // optional splash screen

    return (
        <Stack.Navigator>
            {token ? (
                <Stack.Screen name="Home" component={HomeScreen} />
            ) : (
                <Stack.Screen name="Login" component={LoginScreen} />
            )}
            <Stack.Screen name="Weather" component={WeatherScreen} />
            <Stack.Screen name="ExpenseTracker" component={ExpenseTrackerScreen} options={{ title: "Expense Tracker" }} />
            <Stack.Screen name="ProductList" component={ProductListScreen} options={{ title: "Products" }} />
        </Stack.Navigator>

    );
};

export default RootNavigator;
