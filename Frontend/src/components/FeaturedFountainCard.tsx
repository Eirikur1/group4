import React from "react";
import { View, Text, Pressable, StyleSheet, Platform } from "react-native";
import MapView, { Marker } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import type { Fountain } from "../types/fountain";
import { darkMapStyle } from "../constants/mapStyles";

const region = (f: Fountain) => ({
  latitude: f.latitude,
  longitude: f.longitude,
  latitudeDelta: 0.006,
  longitudeDelta: 0.006,
});

interface FeaturedFountainCardProps {
  fountain: Fountain;
  onClick?: () => void;
}

export default function FeaturedFountainCard({
  fountain,
  onClick,
}: FeaturedFountainCardProps) {
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={onClick}
    >
      <View style={styles.mapWrap}>
        <MapView
          style={styles.map}
          initialRegion={region(fountain)}
          scrollEnabled={false}
          zoomEnabled={false}
          pitchEnabled={false}
          rotateEnabled={false}
          customMapStyle={Platform.OS === "android" ? darkMapStyle : undefined}
          mapType={
            (Platform.OS === "ios" ? "muted" : undefined) as
              | "standard"
              | "satellite"
              | "hybrid"
              | undefined
          }
        >
          <Marker
            coordinate={{
              latitude: fountain.latitude,
              longitude: fountain.longitude,
            }}
            image={require("../../assets/icons/PinIcon.png")}
            anchor={{ x: 0.5, y: 1 }}
          />
        </MapView>
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>
          {fountain.name}
        </Text>
        {fountain.category ? (
          <Text style={styles.category}>{fountain.category}</Text>
        ) : null}
        {fountain.rating !== undefined && (
          <View style={styles.rating}>
            <Text style={styles.ratingValue}>{fountain.rating}</Text>
            <Ionicons name="star" size={16} color="#FFD700" />
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardPressed: { opacity: 0.95 },
  mapWrap: {
    height: 140,
    width: "100%",
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    overflow: "hidden",
  },
  map: { width: "100%", height: "100%" },
  body: { padding: 16 },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#000",
    marginBottom: 4,
  },
  category: {
    fontSize: 13,
    color: "#666",
    marginBottom: 6,
  },
  rating: { flexDirection: "row", alignItems: "center", gap: 4 },
  ratingValue: { fontSize: 14, fontWeight: "600", color: "#000" },
});
