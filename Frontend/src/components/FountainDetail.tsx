import React from "react";
import {
  View,
  Text,
  ScrollView,
  Image,
  Pressable,
  StyleSheet,
  Platform,
} from "react-native";
import MapView, { Marker } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import type { Fountain } from "../types/fountain";
import { darkMapStyle } from "../constants/mapStyles";
import { openDirections } from "../utils/directions";

interface FountainDetailProps {
  fountain: Fountain;
}

const RATING_EMOJIS = ["😖", "😕", "😐", "🙂", "😍"];
const PLACEHOLDER_IMAGES = [
  require("../../assets/images/b741f146d496c7d4f5d41f27685cd7b5.jpg"),
  require("../../assets/images/b949af6e1c695e801c5a0013a98256df.jpg"),
];

const fountainRegion = (f: Fountain) => ({
  latitude: f.latitude,
  longitude: f.longitude,
  latitudeDelta: 0.005,
  longitudeDelta: 0.005,
});

export default function FountainDetail({ fountain }: FountainDetailProps) {
  // Prefer API/OSM images when present; otherwise use local placeholders
  const urls: string[] =
    (fountain.images?.length ?? 0) > 0
      ? fountain.images!
      : fountain.imageUrl
        ? [fountain.imageUrl]
        : [];
  const localImages = PLACEHOLDER_IMAGES;
  const img1 = urls[0];
  const img2 = urls[1];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      bounces={true}
      alwaysBounceVertical={true}
    >
      <View style={styles.mapBlock}>
        <View style={styles.mapWrap}>
          <MapView
            style={styles.mapImage}
            initialRegion={fountainRegion(fountain)}
            scrollEnabled={false}
            zoomEnabled={false}
            pitchEnabled={false}
            rotateEnabled={false}
            customMapStyle={Platform.OS === "android" ? darkMapStyle : undefined}
            mapType={(Platform.OS === "ios" ? "muted" : undefined) as "standard" | "satellite" | "hybrid" | undefined}
          >
            <Marker
              coordinate={{
                latitude: fountain.latitude,
                longitude: fountain.longitude,
              }}
              anchor={{ x: 0.5, y: 1 }}
              tracksViewChanges={false}
            >
              <Image
                source={require("../../assets/icons/PinIcon.png")}
                style={styles.mapPin}
                resizeMode="contain"
              />
            </Marker>
          </MapView>
        </View>
        <View style={styles.belowMap}>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={2}>
              {fountain.name}
            </Text>
            <View style={styles.titleRight}>
              {fountain.category ? (
                <Text style={styles.category}>{fountain.category}</Text>
              ) : null}
              {fountain.rating !== undefined && (
                <View style={styles.rating}>
                  <Text style={styles.ratingValue}>{fountain.rating}</Text>
                  <Ionicons name="star" size={18} color="#FFD700" />
                </View>
              )}
            </View>
          </View>
          <View style={styles.imageRow}>
            <Image
              source={img1 ? { uri: img1 } : localImages[0]}
              style={styles.galleryImage}
              resizeMode="cover"
            />
            <Image
              source={img2 ? { uri: img2 } : localImages[1]}
              style={styles.galleryImage}
              resizeMode="cover"
            />
          </View>
          {(fountain.description ?? "").trim() ? (
            <Text style={styles.shortDescription} numberOfLines={3}>
              {fountain.description!.trim()}
            </Text>
          ) : null}
        </View>
        <View style={styles.strokeFrame}>
          <View style={styles.contentRest}>
            <View style={styles.ratingSection}>
              <Text style={styles.ratingQuestion}>
                How would you rate the water?
              </Text>
              <Text style={styles.ratingSubtitle}>We'd love to know!</Text>
              <View style={styles.emojis}>
                {RATING_EMOJIS.map((emoji, i) => (
                  <Pressable key={i} style={styles.emojiButton}>
                    <Text style={styles.emoji}>{emoji}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>

          {fountain.distance ? (
            <Text style={styles.distanceAboveButton}>{fountain.distance}</Text>
          ) : null}
          <View style={styles.extraSection}>
            <Pressable
              style={({ pressed }) => [
                styles.directionsButton,
                pressed && styles.directionsButtonPressed,
              ]}
              onPress={() =>
                openDirections(fountain.latitude, fountain.longitude, fountain.name)
              }
            >
              <Ionicons name="navigate" size={20} color="#FFFFFF" />
              <Text style={styles.directionsButtonText}>Get directions</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const MAP_RADIUS = 16;

// Spacing from Figma (132-2403): consistent horizontal padding, generous vertical gaps
const SPACE_H = 16;
const SPACE_MAP_TO_TITLE = 20;
const SPACE_TITLE_TO_IMAGES = 20;
const SPACE_IMAGES_TO_RATING = 24;
const SPACE_RATING_TO_ACTIONS = 24;
const SPACE_BETWEEN_SECTIONS = 16;
const GAP_IMAGES = 12;

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 32,
  },
  mapBlock: {
    marginTop: 0,
    marginHorizontal: 8,
    marginBottom: SPACE_BETWEEN_SECTIONS,
    padding: 13,
    borderRadius: MAP_RADIUS,
    borderWidth: 2,
    borderColor: "#e0e0e0",
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
  },
  mapWrap: {
    height: 280,
    marginHorizontal: 6,
    marginBottom: 13,
    backgroundColor: "#e8e8e8",
    borderTopLeftRadius: MAP_RADIUS,
    borderTopRightRadius: MAP_RADIUS,
    borderBottomLeftRadius: MAP_RADIUS,
    borderBottomRightRadius: MAP_RADIUS,
    overflow: "hidden",
  },
  belowMap: {
    marginHorizontal: 6,
    paddingTop: 12,
    paddingBottom: 4,
  },
  shortDescription: {
    fontSize: 14,
    color: "#555",
    lineHeight: 20,
    marginTop: 10,
    paddingHorizontal: 0,
  },
  strokeFrame: {
    paddingBottom: 16,
  },
  mapImage: { width: "100%", height: "100%" },
  mapPin: { width: 44, height: 44 },
  content: {
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: SPACE_TITLE_TO_IMAGES,
  },
  contentRest: {
    paddingHorizontal: 0,
    paddingTop: SPACE_IMAGES_TO_RATING,
    paddingBottom: SPACE_RATING_TO_ACTIONS,
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    marginBottom: SPACE_TITLE_TO_IMAGES,
  },
  title: {
    flex: 1,
    fontSize: 22,
    fontWeight: "700",
    color: "#000000",
    lineHeight: 28,
  },
  titleRight: { alignItems: "flex-end", minWidth: 80 },
  category: {
    fontSize: 14,
    color: "#666666",
    marginBottom: 6,
  },
  rating: { flexDirection: "row", alignItems: "center", gap: 4 },
  ratingValue: { fontSize: 16, fontWeight: "700", color: "#000000" },
  imageRow: {
    flexDirection: "row",
    gap: GAP_IMAGES,
  },
  galleryImage: {
    flex: 1,
    height: 120,
    borderRadius: 12,
    overflow: "hidden",
  },
  ratingSection: { marginBottom: 0 },
  ratingQuestion: {
    fontSize: 18,
    fontWeight: "700",
    color: "#000000",
    marginBottom: 6,
    textAlign: "center",
  },
  ratingSubtitle: {
    fontSize: 14,
    color: "#666666",
    marginBottom: 16,
    textAlign: "center",
  },
  emojis: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  emojiButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#F5F5F5",
    justifyContent: "center",
    alignItems: "center",
  },
  emoji: { fontSize: 28 },
  distanceAboveButton: {
    fontSize: 14,
    color: "#666666",
    marginBottom: 8,
    paddingHorizontal: SPACE_H,
  },
  extraSection: {
    paddingHorizontal: SPACE_H,
    paddingVertical: SPACE_BETWEEN_SECTIONS,
  },
  extraTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000000",
    marginBottom: 4,
  },
  extraText: { fontSize: 14, color: "#444444", lineHeight: 22 },
  directionsButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#1a73e8",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  directionsButtonPressed: { opacity: 0.9 },
  directionsButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});
