import React from "react";
import { View, Pressable, StyleSheet } from "react-native";
import StarFull from "../../assets/icons/star_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg";

const GOLD = "#FFD700";
const GRAY = "#D1D5DB";
const STAR_SIZE = 24;

export interface StarRatingProps {
  /** Rating 1–5 (display rounded if decimal), or null/undefined for no stars */
  rating: number | null | undefined;
  size?: number;
  /** When set, stars are tappable. Calls onRate(1 | 2 | 3 | 4 | 5). */
  onRate?: (rating: number) => void;
}

/**
 * Renders star_24dp (full stars only). When rating is null/undefined and not interactive, renders nothing.
 * When onRate is provided, shows 5 tappable stars (gold when filled, gray when not).
 */
export default function StarRating({
  rating,
  size = STAR_SIZE,
  onRate,
}: StarRatingProps) {
  const interactive = typeof onRate === "function";
  if (rating == null && !interactive) {
    return null;
  }

  const value = rating != null ? Number(rating) : 0;
  const filledCount = Math.round(value);

  const stars = Array.from({ length: 5 }, (_, i) => {
    const filled = filledCount >= i + 1;
    const color = filled ? GOLD : GRAY;
    const node = <StarFull width={size} height={size} fill={color} color={color} />;
    if (interactive) {
      return (
        <Pressable
          key={i}
          onPress={() => onRate(i + 1)}
          style={[styles.starButton, { width: size, height: size }]}
          accessibilityLabel={`Rate ${i + 1} star${i !== 0 ? "s" : ""}`}
        >
          {node}
        </Pressable>
      );
    }
    return (
      <View key={i} style={[styles.starButton, { width: size, height: size }]}>
        {node}
      </View>
    );
  });

  return <View style={styles.row}>{stars}</View>;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  starButton: {
    justifyContent: "center",
    alignItems: "center",
  },
});
