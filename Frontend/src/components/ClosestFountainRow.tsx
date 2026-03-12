import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Fountain } from "../types/fountain";
import { GRID_GUTTER_HALF } from "../constants/grid";

interface ClosestFountainRowProps {
  fountain: Fountain;
  onPressFountain?: (f: Fountain) => void;
}

/**
 * Minimal list row for Closest Fountains: title + optional distance only.
 * No images, no SVGs — keeps RAM usage low for long lists.
 */
function ClosestFountainRow({
  fountain,
  onPressFountain,
}: ClosestFountainRowProps) {
  const onPress = onPressFountain ? () => onPressFountain(fountain) : undefined;
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={onPress}
    >
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={1}>
          {fountain.name}
        </Text>
        {fountain.distance ? (
          <Text style={styles.distance} numberOfLines={1}>
            {fountain.distance}
          </Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color="#999" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: GRID_GUTTER_HALF + 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#eee",
  },
  rowPressed: { backgroundColor: "#f5f5f5" },
  content: { flex: 1, minWidth: 0 },
  title: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
  },
  distance: {
    fontSize: 13,
    color: "#666",
    marginTop: 2,
  },
});

export default React.memo(ClosestFountainRow);
