import React, { type ReactNode } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { GRID_GUTTER_HALF } from "../constants/grid";

interface MenuItemProps {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  onClick: () => void;
}

export default function MenuItem({
  icon,
  title,
  subtitle,
  onClick,
}: MenuItemProps) {
  return (
    <Pressable
      style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
      onPress={onClick}
    >
      <View style={styles.left}>
        <View style={styles.iconWrap}>{icon}</View>
        <View style={styles.textWrap}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#999" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  item: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: GRID_GUTTER_HALF + 6,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  itemPressed: { backgroundColor: "#f9f9f9" },
  left: { flexDirection: "row", alignItems: "center", flex: 1 },
  iconWrap: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    marginRight: GRID_GUTTER_HALF + 4,
  },
  textWrap: { flex: 1 },
  title: { fontSize: 16, fontWeight: "500", color: "#000" },
  subtitle: { fontSize: 13, color: "#666", marginTop: 2 },
});
