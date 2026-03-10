import React from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  Image,
} from "react-native";
import MapView, { Marker } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import type { Fountain } from "../types/fountain";
import { GRID_GUTTER_HALF } from "../constants/grid";
import StarIcon from "../../assets/icons/Star.svg";
import { darkMapStyle } from "../constants/mapStyles";

const thumbRegion = (f: Fountain) => ({
  latitude: f.latitude,
  longitude: f.longitude,
  latitudeDelta: 0.01,
  longitudeDelta: 0.01,
});

interface FountainCardProps {
  fountain: Fountain;
  onClick?: () => void;
}

function FountainCard({ fountain, onClick }: FountainCardProps) {
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={onClick}
    >
      <View style={styles.thumbWrap}>
        <MapView
          style={styles.thumbMap}
          initialRegion={thumbRegion(fountain)}
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
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
          >
            <Image
              source={
                fountain.useAdminPin
                  ? require("../../assets/icons/AdminPin.png")
                  : require("../../assets/icons/PinIcon.png")
              }
              style={styles.thumbPin}
              resizeMode="contain"
            />
          </Marker>
        </MapView>
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
  thumbMap: { width: "100%", height: "100%" },
  thumbPin: { width: 18, height: 18 },
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
