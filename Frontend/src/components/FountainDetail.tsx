import React, { useState, useRef, useCallback, useMemo, useEffect } from "react";
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
  Animated,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import MapView, { Marker } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import type { Fountain } from "../types/fountain";
import { darkMapStyle } from "../constants/mapStyles";
import { openDirections } from "../utils/directions";
import { uploadFountainPhotos } from "../lib/uploadFountainPhoto";
import { addPhotosToWaterSource } from "../lib/waterSources";
import { isLocationSaved, toggleSavedLocation } from "../lib/savedLocations";
import { submitRating, getAverageRating } from "../lib/ratings";
import { useAuth } from "../contexts/AuthContext";
import SavedIcon from "./SavedIcon";
import ImageWithSkeleton from "./ImageWithSkeleton";
import StarRating from "./StarRating";
import StarFullIcon from "../../assets/icons/star_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg";

const SCREEN_W = Dimensions.get("window").width;
// Account for mapBlock margins (8), padding (13), and belowMap margins (6)
const CAROUSEL_W = SCREEN_W - 8 * 2 - 13 * 2 - 6 * 2;
const IMG_GAP = 8;
// Show 2.5 images at once so the third peeks, hinting there are more
const ITEM_W = (CAROUSEL_W - IMG_GAP * 2) / 2.5;

interface FountainDetailProps {
  fountain: Fountain;
  /** When provided with onToggleSaved, save button is shown on the map instead of here */
  saved?: boolean;
  onToggleSaved?: () => void;
  onPhotosAdded?: (updated: Fountain) => void;
  onSavedChanged?: () => void;
  /** Called after user submits a rating so parent can update fountain with new average */
  onRatingChanged?: (updated: Fountain) => void;
}

const fountainRegion = (f: Fountain) => ({
  latitude: f.latitude,
  longitude: f.longitude,
  latitudeDelta: 0.005,
  longitudeDelta: 0.005,
});

function PhotoTile({ uri, width, marginRight }: { uri: string; width: number; marginRight: number }) {
  return (
    <ImageWithSkeleton
      uri={uri}
      containerStyle={StyleSheet.flatten([styles.carouselImage, { width, marginRight }])}
      imageStyle={StyleSheet.absoluteFillObject}
      resizeMode="cover"
      skeletonBorderRadius={10}
    />
  );
}

type NavProp = NativeStackNavigationProp<RootStackParamList>;

export default function FountainDetail({
  fountain,
  saved: savedProp,
  onToggleSaved,
  onPhotosAdded,
  onSavedChanged,
  onRatingChanged,
}: FountainDetailProps) {
  const navigation = useNavigation<NavProp>();
  const { isSignedIn } = useAuth();
  const urls: string[] =
    (fountain.images?.length ?? 0) > 0
      ? fountain.images!
      : fountain.imageUrl
        ? [fountain.imageUrl]
        : [];

  const [carouselIndex, setCarouselIndex] = useState(0);
  const [addingPhoto, setAddingPhoto] = useState(false);
  const [saved, setSaved] = useState(false);

  // Only user-uploaded fountains (UUID string IDs) support adding photos.
  const canAddPhotos = typeof fountain.id === "string" && !!onPhotosAdded;

  const totalSlides = urls.length + (canAddPhotos ? 1 : 0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (typeof fountain.id !== "string") {
        setSaved(false);
        return;
      }
      try {
        const value = await isLocationSaved(fountain.id);
        if (!cancelled) setSaved(value);
      } catch {
        if (!cancelled) setSaved(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fountain.id]);

  // The add-photo slide has marginRight = ITEM_W/2, so content ends
  // ITEM_W/2 past its right edge. The final snap positions the last real
  // photo ~IMG_GAP from the viewport left, with add-photo fully visible and
  // a half-slot trailing gap — noticeably further than right-edge-only,
  // but well short of snapping add-photo to the far left.
  // finalSnap = (totalSlides-1)*(ITEM_W+IMG_GAP) + 1.5*ITEM_W - CAROUSEL_W
  const snapOffsets = useMemo(() => {
    if (totalSlides <= 1) return [0];
    const finalSnap = Math.round(
      (totalSlides - 1) * (ITEM_W + IMG_GAP) + 1.5 * ITEM_W - CAROUSEL_W
    );
    if (finalSnap <= 0) return [0]; // everything fits, no scroll needed
    const offsets: number[] = [0];
    for (let i = 1; i * (ITEM_W + IMG_GAP) < finalSnap; i++) {
      offsets.push(Math.round(i * (ITEM_W + IMG_GAP)));
    }
    offsets.push(finalSnap);
    return offsets;
  }, [totalSlides]);

  const prevFountainId = useRef(fountain.id);
  if (prevFountainId.current !== fountain.id) {
    prevFountainId.current = fountain.id;
    setCarouselIndex(0);
  }

  const uploadUris = useCallback(async (uris: string[]) => {
    if (!uris.length || !onPhotosAdded) return;
    const previousImages = fountain.images ?? (fountain.imageUrl ? [fountain.imageUrl] : []);
    const optimisticImages = [...previousImages, ...uris];
    onPhotosAdded({ ...fountain, images: optimisticImages });
    setAddingPhoto(true);
    try {
      const newUrls = await uploadFountainPhotos(uris);
      const updated = await addPhotosToWaterSource(String(fountain.id), newUrls);
      if (updated) onPhotosAdded(updated);
    } catch (e) {
      onPhotosAdded({ ...fountain, images: previousImages });
      Alert.alert("Upload failed", e instanceof Error ? e.message : "Could not add photos.");
    } finally {
      setAddingPhoto(false);
    }
  }, [fountain, onPhotosAdded]);

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

  const handleToggleSaved = useCallback(async () => {
    if (!isSignedIn) {
      Alert.alert(
        "Sign in to save",
        "Sign in to save locations to your list.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Sign in", onPress: () => navigation.navigate("SignIn") },
        ]
      );
      return;
    }
    if (typeof fountain.id !== "string") {
      Alert.alert(
        "Not supported",
        "Only database-backed fountains can be saved right now."
      );
      return;
    }
    const previous = saved;
    setSaved((prev) => !prev);
    onSavedChanged?.();
    try {
      await toggleSavedLocation(fountain.id);
    } catch (e) {
      setSaved(previous);
      Alert.alert(
        "Save failed",
        e instanceof Error ? e.message : "Could not update saved location."
      );
    }
  }, [isSignedIn, fountain.id, saved, onSavedChanged, navigation]);

  const canRate =
    isSignedIn &&
    typeof fountain.id === "string" &&
    onRatingChanged != null;
  const handleRate = useCallback(
    async (rating: number) => {
      if (!canRate || typeof fountain.id !== "string") return;
      const previousRating = fountain.rating;
      onRatingChanged?.({ ...fountain, rating });
      try {
        await submitRating(fountain.id, Math.round(rating));
        const avg = await getAverageRating(fountain.id);
        onRatingChanged?.({ ...fountain, rating: avg ?? rating });
      } catch (e) {
        onRatingChanged?.({ ...fountain, rating: previousRating });
        Alert.alert(
          "Rating failed",
          e instanceof Error ? e.message : "Could not save rating."
        );
      }
    },
    [canRate, fountain, onRatingChanged]
  );

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
        <View style={styles.mapSaveOverlay} pointerEvents="box-none">
          <Pressable
            style={({ pressed }) => [
              styles.mapSaveButton,
              pressed && styles.mapSaveButtonPressed,
            ]}
            onPress={onToggleSaved ?? handleToggleSaved}
              accessibilityLabel={
              !isSignedIn
                ? "Sign in to save location"
                : (savedProp ?? saved)
                  ? "Remove from saved"
                  : "Save location"
            }
            >
              <View style={styles.mapSaveIconCircle}>
                <SavedIcon
                  size={18}
                  filled={savedProp ?? saved}
                />
              </View>
            </Pressable>
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
              {fountain.rating != null && (
                <View style={styles.rating}>
                  <Text style={styles.ratingValue}>{fountain.rating}</Text>
                  <StarFullIcon width={18} height={18} fill="#FFD700" color="#FFD700" />
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
                snapToOffsets={snapOffsets}
                decelerationRate="fast"
                bounces={false}
                style={{ width: CAROUSEL_W }}
                onMomentumScrollEnd={(e) => {
                  const idx = Math.round(
                    e.nativeEvent.contentOffset.x / (ITEM_W + IMG_GAP)
                  );
                  setCarouselIndex(idx);
                }}
              >
                {urls.map((uri, i) => (
                  <PhotoTile
                    key={`${uri}-${i}`}
                    uri={uri}
                    width={ITEM_W}
                    // Last image before add-photo still needs a gap; last image
                    // overall (no add-photo) has no trailing margin so content ends flush.
                    marginRight={(i < urls.length - 1 || canAddPhotos) ? IMG_GAP : 0}
                  />
                ))}
                {canAddPhotos && (
                  <Pressable
                    // marginRight = ITEM_W/2 extends content so max scroll == finalSnap.
                    style={[styles.carouselImage, styles.addPhotoSlide, { width: ITEM_W, marginRight: Math.round(ITEM_W / 2) }]}
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

          <View style={styles.contentRest}>
            <View style={styles.ratingSection}>
              <Text style={styles.ratingQuestion}>
                How would you rate the water?
              </Text>
              <Text style={styles.ratingSubtitle}>We'd love to know!</Text>
              <View style={styles.starsRow}>
                <StarRating
                  rating={fountain.rating}
                  size={28}
                  onRate={canRate ? handleRate : undefined}
                />
              </View>
            </View>
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
  mapSaveOverlay: {
    position: "absolute",
    top: 16,
    right: 22,
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
    elevation: 10,
  },
  mapSaveButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  mapSaveIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.15)",
    alignItems: "center",
    justifyContent: "center",
    elevation: 11,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
  },
  mapSaveButtonPressed: { opacity: 0.7 },
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
  starsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
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
