import React from "react";
import { StyleSheet, View, Text, Pressable } from "react-native";
import type { Fountain } from "../types/fountain";

interface MapProps {
  fountains: Fountain[];
  region?: {
    latitude: number;
    longitude: number;
    latitudeDelta?: number;
    longitudeDelta?: number;
  };
  selectedFountain?: Fountain | null;
  pendingAddCoordinate?: { latitude: number; longitude: number } | null;
  onMapPress?: () => void;
  onLongPress?: (coordinate: { latitude: number; longitude: number }) => void;
  onFountainPress?: (fountain: Fountain) => void;
}

export default function Map({ fountains, onMapPress }: MapProps) {
  return (
    <Pressable style={styles.container} onPress={onMapPress}>
      <View style={styles.webPlaceholder}>
        <Text style={styles.webPlaceholderTitle}>Map</Text>
        <Text style={styles.webPlaceholderSubtitle}>
          {fountains.length} fountain{fountains.length !== 1 ? "s" : ""} in this
          area
        </Text>
        <Text style={styles.webHint}>
          Use the app on a device for the full map.
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  webPlaceholder: {
    flex: 1,
    backgroundColor: "#E3F2FD",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  webPlaceholderTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1976D2",
    marginBottom: 8,
  },
  webPlaceholderSubtitle: { fontSize: 16, color: "#666", marginBottom: 12 },
  webHint: { fontSize: 14, color: "#999" },
});
