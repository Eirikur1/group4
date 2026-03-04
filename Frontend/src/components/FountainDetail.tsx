import React, { useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Image,
  Pressable,
  StyleSheet,
  Platform,
  Dimensions,
  ActivityIndicator,
  Alert,
} from "react-native";
import MapView, { Marker } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import type { Fountain } from "../types/fountain";
import { darkMapStyle } from "../constants/mapStyles";
import { openDirections } from "../utils/directions";
import { uploadFountainPhotos } from "../lib/uploadFountainPhoto";
import { addPhotosToWaterSource } from "../lib/waterSources";

const SCREEN_W = Dimensions.get("window").width;
// Account for mapBlock margins (8), padding (13), and belowMap margins (6)
const CAROUSEL_W = SCREEN_W - 8 * 2 - 13 * 2 - 6 * 2;
const IMG_GAP = 8;
// Show 2.5 images at once so the third peeks, hinting there are more
const ITEM_W = (CAROUSEL_W - IMG_GAP * 2) / 2.5;

interface FountainDetailProps {
  fountain: Fountain;
  onPhotosAdded?: (updated: Fountain) => void;
}

const RATING_EMOJIS = ["😖", "😕", "😐", "🙂", "😍"];

const fountainRegion = (f: Fountain) => ({
  latitude: f.latitude,
  longitude: f.longitude,
  latitudeDelta: 0.005,
  longitudeDelta: 0.005,
});

export default function FountainDetail({ fountain, onPhotosAdded }: FountainDetailProps) {
  const urls: string[] =
    (fountain.images?.length ?? 0) > 0
      ? fountain.images!
      : fountain.imageUrl
        ? [fountain.imageUrl]
        : [];

  const [carouselIndex, setCarouselIndex] = useState(0);
  const [addingPhoto, setAddingPhoto] = useState(false);
  const prevFountainId = useRef(fountain.id);
  if (prevFountainId.current !== fountain.id) {
    prevFountainId.current = fountain.id;
    setCarouselIndex(0);
  }

  // Only user-uploaded fountains (UUID string IDs) support adding photos.
  const canAddPhotos = typeof fountain.id === "string" && !!onPhotosAdded;

  const uploadUris = useCallback(async (uris: string[]) => {
    if (!uris.length) return;
    setAddingPhoto(true);
    try {
      const newUrls = await uploadFountainPhotos(uris);
      const updated = await addPhotosToWaterSource(String(fountain.id), newUrls);
      if (updated) onPhotosAdded?.(updated);
    } catch (e) {
      Alert.alert("Upload failed", e instanceof Error ? e.message : "Could not add photos.");
    } finally {
      setAddingPhoto(false);
    }
  }, [fountain.id, onPhotosAdded]);

  const addFromLibrary = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Allow access to your photos to add images.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.length) {
      await uploadUris(result.assets.map((a) => a.uri));
    }
  }, [uploadUris]);

  const addFromCamera = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Allow camera access to take photos.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.length) {
      await uploadUris(result.assets.map((a) => a.uri));
    }
  }, [uploadUris]);

  const handleAddPhoto = useCallback(() => {
    Alert.alert("Add photo", undefined, [
      { text: "Take photo", onPress: addFromCamera },
      { text: "Choose from library", onPress: addFromLibrary },
      { text: "Cancel", style: "cancel" },
    ]);
  }, [addFromCamera, addFromLibrary]);

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
          {/* Image carousel — last tile is the add-photo button when allowed */}
          {(urls.length > 0 || canAddPhotos) && (
            <View style={styles.imageBlock}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                  snapToInterval={ITEM_W + IMG_GAP}
                  decelerationRate="fast"
                  contentContainerStyle={{ gap: IMG_GAP, paddingRight: CAROUSEL_W - ITEM_W }}
                  style={{ width: CAROUSEL_W }}
                onMomentumScrollEnd={(e) => {
                  const idx = Math.round(
                    e.nativeEvent.contentOffset.x / (ITEM_W + IMG_GAP)
                  );
                  setCarouselIndex(idx);
                }}
              >
                {urls.map((uri, i) => (
                  <Image
                    key={`${uri}-${i}`}
                    source={{ uri }}
                    style={[styles.carouselImage, { width: ITEM_W }]}
                    resizeMode="cover"
                  />
                ))}
                {canAddPhotos && (
                  <Pressable
                    style={[styles.carouselImage, styles.addPhotoSlide, { width: ITEM_W }]}
                    onPress={handleAddPhoto}
                    disabled={addingPhoto}
                    accessibilityLabel="Add photo"
                  >
                    {addingPhoto ? (
                      <ActivityIndicator color="#3A9BDC" />
                    ) : (
                      <>
                        <Ionicons name="add" size={28} color="#3A9BDC" />
                        <Text style={styles.addPhotoSlideText}>Add photo</Text>
                      </>
                    )}
                  </Pressable>
                )}
              </ScrollView>
            </View>
          )}
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
  imageBlock: {
    marginBottom: 8,
    gap: 6,
  },
  carouselImage: {
    height: 140,
    borderRadius: 10,
    overflow: "hidden",
  },
  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 5,
    marginTop: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#D1D5DB",
  },
  dotActive: {
    backgroundColor: "#3A9BDC",
  },
  addPhotoSlide: {
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "#3A9BDC",
    backgroundColor: "#F0F8FE",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  addPhotoSlideText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#3A9BDC",
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
    backgroundColor: "#3A9BDC",
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
