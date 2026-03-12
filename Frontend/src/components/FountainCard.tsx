import React from "react";
import { View, Text, Pressable, StyleSheet, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Fountain } from "../types/fountain";
import { GRID_GUTTER_HALF } from "../constants/grid";
import StarIcon from "../../assets/icons/Star.svg";
import ImageWithSkeleton from "./ImageWithSkeleton";

interface FountainCardProps {
  fountain: Fountain;
  onClick?: () => void;
  onPressFountain?: (f: Fountain) => void;
}

function FountainCard({ fountain, onClick, onPressFountain }: FountainCardProps) {
  const handlePress = onClick ?? (onPressFountain ? () => onPressFountain(fountain) : undefined);
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={handlePress}
    >
      <View style={styles.thumbWrap}>
        <View style={styles.thumbBackground}>
          {fountain.imageUrl ? (
            <ImageWithSkeleton
              uri={fountain.imageUrl}
              containerStyle={StyleSheet.absoluteFillObject}
              imageStyle={StyleSheet.absoluteFillObject}
              resizeMode="cover"
              skeletonBorderRadius={10}
            />
          ) : (
            <Image
              source={require("../../assets/icons/PinIcon.png")}
              style={styles.thumbPin}
              resizeMode="contain"
            />
          )}
        </View>
      </View>
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={1}>
          {fountain.name}
        </Text>
        {fountain.distance ? (
          <Text style={styles.distance}>{fountain.distance}</Text>
        ) : null}
      </View>
      {fountain.rating != null && (
        <View style={styles.rating}>
          <Text style={styles.ratingValue}>{fountain.rating}</Text>
          <StarIcon width={16} height={16} fill="#F9E000" color="#F9E000" />
        </View>
      )}
      <Ionicons name="chevron-forward" size={20} color="#999" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: GRID_GUTTER_HALF + 4,
    marginBottom: GRID_GUTTER_HALF + 2,
    borderWidth: 1,
    borderColor: "#eee",
  },
  cardPressed: { backgroundColor: "#f9f9f9" },
  thumbWrap: {
    width: 56,
    height: 56,
    borderRadius: 10,
    overflow: "hidden",
    marginRight: GRID_GUTTER_HALF + 4,
  },
  thumbBackground: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E0F2FE",
  },
  thumbPin: { width: 22, height: 22 },
  content: { flex: 1 },
  title: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
    marginBottom: 2,
  },
  distance: { fontSize: 13, color: "#666", marginBottom: 2 },
  rating: { flexDirection: "row", alignItems: "center", gap: 4 },
  ratingValue: { fontSize: 14, fontWeight: "600", color: "#000" },
});

export default React.memo(FountainCard);
