import React from "react";
import { View, Text, Pressable, StyleSheet, Image } from "react-native";
import type { Fountain } from "../types/fountain";
import StarIcon from "../../assets/icons/Star.svg";
import { GRID_MARGIN } from "../constants/grid";

interface FeaturedFountainCardProps {
  fountain: Fountain;
  onClick?: () => void;
  onPressFountain?: (f: Fountain) => void;
}

function FeaturedFountainCard({
  fountain,
  onClick,
  onPressFountain,
}: FeaturedFountainCardProps) {
  const handlePress = onClick ?? (onPressFountain ? () => onPressFountain(fountain) : undefined);
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={handlePress}
    >
      <View style={styles.heroThumb}>
        <View style={styles.heroThumbInner}>
          <Image
            source={require("../../assets/icons/PinIcon.png")}
            style={styles.heroPin}
            resizeMode="contain"
          />
        </View>
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>
          {fountain.name}
        </Text>
        {fountain.category ? (
          <Text style={styles.category}>{fountain.category}</Text>
        ) : null}
        {fountain.rating != null && (
          <View style={styles.rating}>
            <Text style={styles.ratingValue}>{fountain.rating}</Text>
            <StarIcon width={16} height={16} fill="#F9E000" color="#F9E000" />
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
  heroThumb: {
    height: 140,
    width: "100%",
    backgroundColor: "#E0F2FE",
    alignItems: "center",
    justifyContent: "center",
  },
  heroThumbInner: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#0EA5E9",
    alignItems: "center",
    justifyContent: "center",
  },
  heroPin: { width: 40, height: 40 },
  body: { padding: GRID_MARGIN },
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

export default React.memo(FeaturedFountainCard);
