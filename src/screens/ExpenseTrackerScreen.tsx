// src/screens/ExpenseTrackerScreen.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Button,
  FlatList,
  Alert,
  StyleSheet,
  SafeAreaView,
  Dimensions,
} from "react-native";
import SQLite from "react-native-sqlite-storage";
import RNFS from "react-native-fs";
import { PieChart } from "react-native-chart-kit";

// --- OPEN DATABASE ---
const db = SQLite.openDatabase(
  { name: "expenses.db", location: "default" },
  () => console.log("Database opened"),
  (err: any) => console.log("DB error: ", err)
);

type Expense = {
  id: number;
  category: string;
  amount: number;
};

const chartColors = ["#FF6384", "#36A2EB", "#FFCE56", "#4BC0C0", "#9966FF"];

export default function ExpenseTrackerScreen() {
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [expenses, setExpenses] = useState<Expense[]>([]);

  // --- INIT ---
  useEffect(() => {
    createTable();
    loadExpenses();
  }, []);

  // --- CREATE TABLE ---
  const createTable = () => {
    db.transaction((tx: any) => {
      tx.executeSql(
        `CREATE TABLE IF NOT EXISTS expenses (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          category TEXT NOT NULL,
          amount REAL NOT NULL
        );`
      );
    });
  };

  // --- ADD EXPENSE ---
  const addExpense = () => {
    if (!category || !amount) return Alert.alert("Error", "Please enter category and amount");

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return Alert.alert("Error", "Please enter a valid positive amount");
    }

    db.transaction((tx: any) => {
      tx.executeSql(
        "INSERT INTO expenses (category, amount) VALUES (?, ?);",
        [category.trim(), numericAmount],
        (_: any, result: any) => {
          console.log("Expense added successfully, rows affected:", result.rowsAffected);
          setCategory("");
          setAmount("");
          loadExpenses(); // Reload expenses after adding
          Alert.alert("Success", "Expense added successfully!");
        },
        (_: any, error: any) => {
          console.log("Insert error: ", error);
          Alert.alert("Error", "Failed to add expense");
          return false;
        }
      );
    });
  };

  // --- LOAD EXPENSES ---
  const loadExpenses = () => {
    db.transaction((tx: any) => {
      tx.executeSql(
        "SELECT * FROM expenses ORDER BY id DESC;",
        [],
        (_: any, result: any) => {
          console.log("Loaded expenses, rows count:", result.rows.length);
          const expensesArray = [];
          for (let i = 0; i < result.rows.length; i++) {
            expensesArray.push(result.rows.item(i));
          }
          setExpenses(expensesArray);
        },
        (_: any, error: any) => {
          console.log("Load error: ", error);
          return false;
        }
      );
    });
  };

  // --- BACKUP ---
  const backupExpenses = async () => {
    try {
      if (expenses.length === 0) {
        Alert.alert("Backup", "No expenses to backup");
        return;
      }
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupData = {
        timestamp: new Date().toISOString(),
        version: "1.0",
        expenses: expenses
      };
      
      const fileName = `expenses_backup_${timestamp}.json`;
      const path = RNFS.DocumentDirectoryPath + "/" + fileName;
      
      await RNFS.writeFile(path, JSON.stringify(backupData, null, 2), "utf8");
      
      Alert.alert(
        "Backup Successful", 
        `Backup saved successfully!\n\nFile: ${fileName}\nExpenses: ${expenses.length}\nLocation: Documents folder`,
        [{ text: "OK" }]
      );
      
      console.log("Backup saved to:", path);
    } catch (err) {
      console.error("Backup error:", err);
      Alert.alert("Backup Error", "Failed to backup expenses. Please try again.");
    }
  };

  // --- RESTORE ---
  const restoreExpenses = async () => {
    try {
      // First, let's check what backup files are available
      const files = await RNFS.readDir(RNFS.DocumentDirectoryPath);
      const backupFiles = files.filter(file => 
        file.name.startsWith('expenses_backup') && file.name.endsWith('.json')
      );

      if (backupFiles.length === 0) {
        Alert.alert("Restore Error", "No backup files found");
        return;
      }

      // Use the most recent backup file
      const latestBackup = backupFiles.sort((a, b) => b.mtime!.getTime() - a.mtime!.getTime())[0];
      const path = latestBackup.path;

      Alert.alert(
        "Restore Expenses",
        `Found backup file: ${latestBackup.name}\n\nThis will replace all current expenses. Continue?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Restore",
            style: "destructive",
            onPress: async () => {
              try {
                const content = await RNFS.readFile(path, "utf8");
                let data;
                
                // Try to parse as new format first, then fallback to old format
                try {
                  const parsedData = JSON.parse(content);
                  data = parsedData.expenses || parsedData; // Handle both new and old formats
                } catch {
                  Alert.alert("Restore Error", "Invalid backup file format");
                  return;
                }

                if (!Array.isArray(data)) {
                  Alert.alert("Restore Error", "Invalid backup data");
                  return;
                }

                // Clear existing data and restore from backup
                db.transaction((tx: any) => {
                  tx.executeSql("DELETE FROM expenses;");
                  
                  data.forEach((exp: Expense) => {
                    tx.executeSql(
                      "INSERT INTO expenses (category, amount) VALUES (?, ?);",
                      [exp.category, exp.amount]
                    );
                  });
                }, 
                (error: any) => {
                  console.error("Restore transaction error:", error);
                  Alert.alert("Restore Error", "Failed to restore expenses");
                }, 
                () => {
                  loadExpenses();
                  Alert.alert(
                    "Restore Successful", 
                    `Successfully restored ${data.length} expenses from backup!`
                  );
                });

              } catch (err) {
                console.error("Restore error:", err);
                Alert.alert("Restore Error", "Failed to read backup file");
              }
            }
          }
        ]
      );

    } catch (err) {
      console.error("Restore error:", err);
      Alert.alert("Restore Error", "Failed to access backup files");
    }
  };

  // --- LIST BACKUP FILES ---
  const listBackupFiles = async () => {
    try {
      console.log("Checking backup files in:", RNFS.DocumentDirectoryPath);
      
      // First check if directory exists and is accessible
      const dirExists = await RNFS.exists(RNFS.DocumentDirectoryPath);
      console.log("Directory exists:", dirExists);
      
      if (!dirExists) {
        Alert.alert("Error", "App directory not found. Please try restarting the app.");
        return;
      }

      const files = await RNFS.readDir(RNFS.DocumentDirectoryPath);
      console.log("All files in directory:", files.map(f => ({ name: f.name, size: f.size })));
      
      const backupFiles = files.filter(file => 
        file.name.includes('expenses_backup') && file.name.includes('.json')
      );
      
      console.log("Filtered backup files:", backupFiles.map(f => f.name));

      if (backupFiles.length === 0) {
        Alert.alert(
          "No Backup Files", 
          `No backup files found in the app directory.\n\nDirectory: ${RNFS.DocumentDirectoryPath}\n\nTip: Create a backup first by adding some expenses and clicking the 'Backup' button.`,
          [{ text: "OK" }]
        );
        return;
      }

      const sortedBackups = backupFiles.sort((a, b) => {
        const timeA = a.mtime ? a.mtime.getTime() : 0;
        const timeB = b.mtime ? b.mtime.getTime() : 0;
        return timeB - timeA;
      });
      
      const backupList = sortedBackups.map((file, index) => {
        let dateStr = "Unknown date";
        let timeStr = "Unknown time";
        let sizeStr = "Unknown size";
        
        try {
          if (file.mtime) {
            dateStr = new Date(file.mtime).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric'
            });
            timeStr = new Date(file.mtime).toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit'
            });
          }
          
          if (file.size) {
            sizeStr = `${(file.size / 1024).toFixed(1)} KB`;
          }
        } catch (dateError) {
          console.log("Error formatting date for file:", file.name, dateError);
        }
        
        return `${index + 1}. ${file.name}\n   📅 ${dateStr} at ${timeStr}\n   💾 Size: ${sizeStr}`;
      }).join('\n\n');

      Alert.alert(
        "📂 Available Backup Files",
        `Found ${backupFiles.length} backup file(s):\n\n${backupList}\n\n💡 Use 'Restore' to load the most recent backup.`,
        [
          { text: "OK", style: "default" },
          { 
            text: "Restore Latest", 
            style: "default",
            onPress: () => restoreExpenses()
          }
        ]
      );
      
    } catch (err: any) {
      console.error("List backups error details:", err);
      console.error("Error message:", err.message);
      console.error("Error stack:", err.stack);
      
      Alert.alert(
        "Error Accessing Backup Files", 
        `Failed to access backup files.\n\nError: ${err.message || 'Unknown error'}\n\nDirectory: ${RNFS.DocumentDirectoryPath}\n\nThis might happen if:\n• Storage permissions are denied\n• App directory is not accessible\n• File system is busy\n\nTry:\n1. Restarting the app\n2. Creating a new backup first`,
        [{ text: "OK" }]
      );
    }
  };

  // --- PIE CHART DATA ---
  const chartData = (expenses || [])
    .reduce((acc: { name: string; amount: number }[], cur) => {
      const index = acc.findIndex(a => a.name === cur.category);
      if (index >= 0) acc[index].amount += cur.amount;
      else acc.push({ name: cur.category, amount: cur.amount });
      return acc;
    }, [])
    .map((item, index) => ({
      name: item.name,
      amount: item.amount,
      color: chartColors[index % chartColors.length],
      legendFontColor: "#333",
      legendFontSize: 12,
    }));

  // --- TEST RNFS FUNCTIONALITY ---
  const testRNFS = async () => {
    try {
      console.log("Testing RNFS functionality...");
      console.log("RNFS object:", RNFS);
      console.log("Document directory path:", RNFS.DocumentDirectoryPath);
      
      // Test basic RNFS functionality
      const testContent = JSON.stringify({ test: "data", timestamp: new Date().toISOString() });
      const testPath = RNFS.DocumentDirectoryPath + "/test_file.json";
      
      // Try to write a test file
      await RNFS.writeFile(testPath, testContent, "utf8");
      console.log("Test file written successfully");
      
      // Try to read the test file
      const readContent = await RNFS.readFile(testPath, "utf8");
      console.log("Test file read successfully:", readContent);
      
      // Try to list directory
      const files = await RNFS.readDir(RNFS.DocumentDirectoryPath);
      console.log("Directory listing successful, files:", files.length);
      
      // Clean up test file
      await RNFS.unlink(testPath);
      console.log("Test file cleaned up");
      
      Alert.alert("RNFS Test", "File system is working correctly!");
      
    } catch (error: any) {
      console.error("RNFS test failed:", error);
      Alert.alert("RNFS Test Failed", `Error: ${error.message}`);
    }
  };

  // --- JSX ---
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Expense Tracker</Text>

      {/* Add Expense Form */}
      <View style={styles.form}>
        <TextInput
          placeholder="Category"
          value={category}
          onChangeText={setCategory}
          style={styles.input}
        />
        <TextInput
          placeholder="Amount"
          value={amount}
          onChangeText={setAmount}
          style={styles.input}
          keyboardType="numeric"
        />
        <Button title="Add Expense" onPress={addExpense} />
      </View>

      {/* Pie Chart */}
      {chartData.length > 0 && (
        <PieChart
          data={chartData}
          width={Dimensions.get("window").width - 32}
          height={220}
          chartConfig={{
            color: (opacity = 1) => `rgba(0,0,0,${opacity})`,
          }}
          accessor="amount"
          backgroundColor="transparent"
          paddingLeft="15"
          absolute
        />
      )}

      {/* Expense List */}
      <View style={styles.expenseListContainer}>
        <Text style={styles.sectionTitle}>Expenses ({expenses.length})</Text>
        {expenses.length === 0 ? (
          <Text style={styles.emptyText}>No expenses added yet</Text>
        ) : (
          <FlatList
            data={expenses || []}
            keyExtractor={item => item.id.toString()}
            renderItem={({ item }) => (
              <View style={styles.expenseItem}>
                <Text style={styles.expenseText}>
                  {item.category}: ${item.amount.toFixed(2)}
                </Text>
              </View>
            )}
            style={styles.expenseList}
            contentContainerStyle={styles.expenseListContent}
            showsVerticalScrollIndicator={true}
            nestedScrollEnabled={true}
          />
        )}
      </View>

      {/* Backup / Restore Buttons */}
      <View style={{ marginTop: 16, flexDirection: "row", justifyContent: "space-between" }}>
        <Button title="Backup" onPress={backupExpenses} />
        <Button title="Restore" onPress={restoreExpenses} />
      </View>

      {/* List Backup Files Button */}
      <View style={{ marginTop: 8 }}>
        <Button title="List Backup Files" onPress={listBackupFiles} />
      </View>

      {/* Test File System Button (for debugging) */}
      <View style={{ marginTop: 8 }}>
        <Button title="Test File System" onPress={testRNFS} />
      </View>

      {/* Test RNFS Button */}
      <View style={{ marginTop: 8 }}>
        <Button title="Test RNFS" onPress={testRNFS} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#f7f9fc" },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 16, textAlign: "center" },
  sectionTitle: { fontSize: 18, fontWeight: "bold", marginTop: 16, marginBottom: 8 },
  emptyText: { fontSize: 16, color: "#666", textAlign: "center", marginTop: 20 },
  form: { marginBottom: 16 },
  input: {
    backgroundColor: "#fff",
    padding: 12,
    marginBottom: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  expenseListContainer: {
    flex: 1,
    marginTop: 8,
    marginBottom: 16,
  },
  expenseList: {
    flex: 1,
  },
  expenseListContent: {
    paddingBottom: 16,
  },
  expenseItem: {
    backgroundColor: "#fff",
    padding: 12,
    marginBottom: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  expenseText: { fontSize: 16 },
});
