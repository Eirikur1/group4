import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { Ionicons } from "@expo/vector-icons";

interface BackHeaderProps {
  title: string;
  backTo?: keyof RootStackParamList;
  showSearch?: boolean;
}

type NavProp = NativeStackNavigationProp<RootStackParamList>;

export default function BackHeader({
  title,
  backTo,
  showSearch = false,
}: BackHeaderProps) {
  const navigation = useNavigation<NavProp>();

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else if (backTo) {
      navigation.navigate(backTo);
    }
  };

  return (
    <View style={styles.header}>
      <Pressable style={styles.backButton} onPress={handleBack} hitSlop={12}>
        <Ionicons name="chevron-back" size={24} color="#333" />
      </Pressable>
      <Text style={styles.title}>{title}</Text>
      {showSearch ? (
        <Pressable style={styles.searchButton}>
          <Ionicons name="search" size={24} color="#333" />
        </Pressable>
      ) : (
        <View style={styles.placeholder} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    backgroundColor: "#fff",
  },
  backButton: { padding: 4 },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: "600",
    color: "#000",
    textAlign: "center",
  },
  searchButton: { padding: 4 },
  placeholder: { width: 32 },
});
