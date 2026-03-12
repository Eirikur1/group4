import React, {
  useState,
  useRef,
  useCallback,
  useMemo,
  useEffect,
} from "react";
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
  Modal,
  TextInput,
} from "react-native";
import LottieView from "lottie-react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import MapView, { Marker } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import type { Fountain } from "../types/fountain";
import { darkMapStyle } from "../constants/mapStyles";
import { GRID_MARGIN, GRID_GUTTER, GRID_GUTTER_HALF } from "../constants/grid";
import { openDirections } from "../utils/directions";
import { uploadFountainPhotos } from "../lib/uploadFountainPhoto";
import {
  addPhotosToWaterSource,
  updateWaterSource,
  deleteWaterSource,
} from "../lib/waterSources";
import { resolveOsmToUuid } from "../lib/osmResolution";
import { isLocationSaved, toggleSavedLocation } from "../lib/savedLocations";
import { submitRating } from "../lib/ratings";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../contexts/AuthContext";
import SavedIcon from "./SavedIcon";
import ImageWithSkeleton from "./ImageWithSkeleton";
import StarRating from "./StarRating";
import StarIcon from "../../assets/icons/Star.svg";

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
  /** Called after the location is updated (name edit) so parent can refresh */
  onFountainUpdated?: (updated: Fountain) => void;
  /** Called after the location is deleted so parent can refresh list and e.g. go back */
  onFountainDeleted?: () => void;
}

const fountainRegion = (f: Fountain) => ({
  latitude: f.latitude,
  longitude: f.longitude,
  latitudeDelta: 0.005,
  longitudeDelta: 0.005,
});

function PhotoTile({
  uri,
  width,
  marginRight,
}: {
  uri: string;
  width: number;
  marginRight: number;
}) {
  return (
    <ImageWithSkeleton
      uri={uri}
      containerStyle={StyleSheet.flatten([
        styles.carouselImage,
        { width, marginRight },
      ])}
      imageStyle={StyleSheet.absoluteFillObject}
      resizeMode="cover"
      skeletonBorderRadius={10}
    />
  );
}

type NavProp = NativeStackNavigationProp<RootStackParamList>;

function FountainDetail({
  fountain,
  saved: savedProp,
  onToggleSaved,
  onPhotosAdded,
  onSavedChanged,
  onRatingChanged,
  onFountainUpdated,
  onFountainDeleted,
}: FountainDetailProps) {
  const navigation = useNavigation<NavProp>();
  const { isSignedIn, user, session } = useAuth();
  const [resolvedFountain, setResolvedFountain] = useState<Fountain | null>(
    typeof fountain.id === "string" ? fountain : null,
  );
  const isOsm = typeof fountain.id === "number";
  const effectiveFountain = resolvedFountain ?? fountain;

  useEffect(() => {
    if (!isOsm || typeof fountain.id !== "number") return;
    let cancelled = false;
    resolveOsmToUuid(
      fountain.id,
      fountain.name,
      fountain.latitude,
      fountain.longitude,
    )
      .then((id) => {
        if (cancelled || !id) return;
        setResolvedFountain({ ...fountain, id });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [
    isOsm,
    fountain.id,
    fountain.name,
    fountain.latitude,
    fountain.longitude,
  ]);

  const urls: string[] =
    (effectiveFountain.images?.length ?? 0) > 0
      ? effectiveFountain.images!
      : effectiveFountain.imageUrl
        ? [effectiveFountain.imageUrl]
        : [];

  const [carouselIndex, setCarouselIndex] = useState(0);
  const [addingPhoto, setAddingPhoto] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editName, setEditName] = useState(fountain.name);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showSavedLottie, setShowSavedLottie] = useState(false);
  const savedLottieHideTimeoutRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const insets = useSafeAreaInsets();

  const isOwner =
    typeof effectiveFountain.id === "string" &&
    !!user &&
    !!effectiveFountain.createdBy &&
    effectiveFountain.createdBy.id === user.id;
  const hasNoCreator =
    typeof effectiveFountain.id === "string" && !effectiveFountain.createdBy;
  // OSM fountains: any signed-in user can add photos (resolved on demand)
  const canAddPhotos =
    !!onPhotosAdded && isSignedIn && (isOwner || hasNoCreator || isOsm);

  const totalSlides = urls.length + (canAddPhotos ? 1 : 0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (typeof effectiveFountain.id !== "string") {
        setSaved(false);
        return;
      }
      try {
        const value = await isLocationSaved(effectiveFountain.id);
        if (!cancelled) setSaved(value);
      } catch {
        if (!cancelled) setSaved(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [effectiveFountain.id]);

  // The add-photo slide has marginRight = ITEM_W/2, so content ends
  // ITEM_W/2 past its right edge. The final snap positions the last real
  // photo ~IMG_GAP from the viewport left, with add-photo fully visible and
  // a half-slot trailing gap — noticeably further than right-edge-only,
  // but well short of snapping add-photo to the far left.
  // finalSnap = (totalSlides-1)*(ITEM_W+IMG_GAP) + 1.5*ITEM_W - CAROUSEL_W
  const snapOffsets = useMemo(() => {
    if (totalSlides <= 1) return [0];
    const finalSnap = Math.round(
      (totalSlides - 1) * (ITEM_W + IMG_GAP) + 1.5 * ITEM_W - CAROUSEL_W,
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

  /** Resolve an OSM fountain to a Supabase UUID on-demand (called when user adds photo, saves, or rates). */
  const resolveOsmFountainNow = useCallback(async (): Promise<
    string | null
  > => {
    if (typeof effectiveFountain.id === "string") return effectiveFountain.id;
    if (typeof fountain.id !== "number") return null;
    setResolving(true);
    try {
      const id = await resolveOsmToUuid(
        fountain.id,
        fountain.name,
        fountain.latitude,
        fountain.longitude,
      );
      if (!id) return null;
      setResolvedFountain({ ...fountain, id });
      return id;
    } catch {
      return null;
    } finally {
      setResolving(false);
    }
  }, [effectiveFountain.id, fountain]);

  const uploadUris = useCallback(
    async (uris: string[]) => {
      if (!uris.length || !onPhotosAdded) return;
      setAddingPhoto(true);
      let resolvedId =
        typeof effectiveFountain.id === "string" ? effectiveFountain.id : null;
      if (!resolvedId) {
        resolvedId = await resolveOsmFountainNow();
      }
      if (!resolvedId) {
        setAddingPhoto(false);
        Alert.alert(
          "Upload failed",
          "Could not connect to backend. Check your connection and try again.",
        );
        return;
      }
      const previousImages =
        effectiveFountain.images ??
        (effectiveFountain.imageUrl ? [effectiveFountain.imageUrl] : []);
      const optimisticImages = [...previousImages, ...uris];
      onPhotosAdded({ ...fountain, images: optimisticImages });
      try {
        const newUrls = await uploadFountainPhotos(uris);
        const updated = await addPhotosToWaterSource(
          resolvedId,
          newUrls,
          session?.access_token,
        );
        if (updated)
          onPhotosAdded({
            ...fountain,
            images: updated.images ?? optimisticImages,
          });
      } catch (e) {
        onPhotosAdded({ ...fountain, images: previousImages });
        Alert.alert(
          "Upload failed",
          e instanceof Error ? e.message : "Could not add photos.",
        );
      } finally {
        setAddingPhoto(false);
      }
    },
    [
      fountain,
      effectiveFountain,
      onPhotosAdded,
      session?.access_token,
      resolveOsmFountainNow,
    ],
  );

  const addFromLibrary = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission needed",
        "Allow access to your photos to add images.",
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
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
      mediaTypes: ["images"],
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
        ],
      );
      return;
    }
    let fountainId =
      typeof effectiveFountain.id === "string" ? effectiveFountain.id : null;
    if (!fountainId && isOsm) {
      fountainId = await resolveOsmFountainNow();
    }
    if (!fountainId) {
      Alert.alert("Not supported", "Could not connect to backend. Try again.");
      return;
    }
    const previous = saved;
    setSaved((prev) => !prev);
    onSavedChanged?.();
    try {
      await toggleSavedLocation(fountainId);
      if (!previous) {
        setShowSavedLottie(true);
        if (savedLottieHideTimeoutRef.current) {
          clearTimeout(savedLottieHideTimeoutRef.current);
        }
        savedLottieHideTimeoutRef.current = setTimeout(() => {
          savedLottieHideTimeoutRef.current = null;
          setShowSavedLottie(false);
        }, 5000);
      }
    } catch (e) {
      setSaved(previous);
      Alert.alert(
        "Save failed",
        e instanceof Error ? e.message : "Could not update saved location.",
      );
    }
  }, [
    isSignedIn,
    isOsm,
    effectiveFountain.id,
    saved,
    onSavedChanged,
    navigation,
    resolveOsmFountainNow,
  ]);

  const canRate = isSignedIn && onRatingChanged != null;
  const handleRate = useCallback(
    async (rating: number) => {
      if (!canRate) return;
      // Ensure we have a real UUID before hitting the ratings table
      let resolvedRatingId =
        typeof effectiveFountain.id === "string" ? effectiveFountain.id : null;
      if (!resolvedRatingId) {
        resolvedRatingId = await resolveOsmFountainNow();
      }
      if (!resolvedRatingId) {
        Alert.alert("Rating failed", "Could not connect to server. Try again.");
        return;
      }
      const previousRating = effectiveFountain.rating;
      const submittedRating = Math.round(rating);
      onRatingChanged?.({ ...fountain, rating: submittedRating });
      try {
        await submitRating(resolvedRatingId, submittedRating);
        onRatingChanged?.({ ...fountain, rating: submittedRating });
      } catch (e) {
        onRatingChanged?.({ ...fountain, rating: previousRating });
        Alert.alert(
          "Rating failed",
          e instanceof Error ? e.message : "Could not save rating.",
        );
      }
    },
    [
      canRate,
      effectiveFountain,
      fountain,
      onRatingChanged,
      resolveOsmFountainNow,
    ],
  );

  const handleDelete = useCallback(() => {
    const id = effectiveFountain.id;
    if (typeof id !== "string") return;
    Alert.alert(
      "Delete location?",
      `Remove "${fountain.name}"? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteWaterSource(id, session?.access_token);
              onFountainDeleted?.();
              navigation.goBack();
            } catch (e) {
              Alert.alert(
                "Delete failed",
                e instanceof Error ? e.message : "Could not delete location.",
              );
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    );
  }, [
    effectiveFountain.id,
    fountain.name,
    session?.access_token,
    onFountainDeleted,
    navigation,
  ]);

  const handleSavedLottieFinish = useCallback(() => {
    if (savedLottieHideTimeoutRef.current) {
      clearTimeout(savedLottieHideTimeoutRef.current);
      savedLottieHideTimeoutRef.current = null;
    }
    setShowSavedLottie(false);
  }, []);

  useEffect(() => {
    return () => {
      if (savedLottieHideTimeoutRef.current) {
        clearTimeout(savedLottieHideTimeoutRef.current);
      }
    };
  }, []);

  const handleSaveEdit = useCallback(async () => {
    const name = editName.trim();
    if (!name || typeof effectiveFountain.id !== "string") return;
    setSavingEdit(true);
    try {
      const updated = await updateWaterSource(
        effectiveFountain.id,
        { name },
        session?.access_token,
      );
      if (updated) {
        onFountainUpdated?.(updated);
        setEditModalVisible(false);
      }
    } catch (e) {
      Alert.alert(
        "Update failed",
        e instanceof Error ? e.message : "Could not update location.",
      );
    } finally {
      setSavingEdit(false);
    }
  }, [
    effectiveFountain.id,
    editName,
    session?.access_token,
    onFountainUpdated,
  ]);

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
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
              showsPointsOfInterest={false}
              customMapStyle={
                Platform.OS === "android" ? darkMapStyle : undefined
              }
              mapType={
                (Platform.OS === "ios" ? "mutedStandard" : undefined) as
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
                anchor={{ x: 0.5, y: 1 }}
                tracksViewChanges={false}
              >
                <Image
                  source={
                    fountain.useAdminPin
                      ? require("../../assets/icons/AdminPin.png")
                      : require("../../assets/icons/PinIcon.png")
                  }
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
                <SavedIcon size={18} filled={savedProp ?? saved} />
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
                {effectiveFountain.rating != null && (
                  <View style={styles.rating}>
                    <Text style={styles.ratingValue}>
                      {effectiveFountain.rating}
                    </Text>
                    <StarIcon
                      width={18}
                      height={18}
                      fill="#F9E000"
                      color="#F9E000"
                    />
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
                      e.nativeEvent.contentOffset.x / (ITEM_W + IMG_GAP),
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
                      marginRight={
                        i < urls.length - 1 || canAddPhotos ? IMG_GAP : 0
                      }
                    />
                  ))}
                  {canAddPhotos && (
                    <Pressable
                      // marginRight = ITEM_W/2 extends content so max scroll == finalSnap.
                      style={[
                        styles.carouselImage,
                        styles.addPhotoSlide,
                        { width: ITEM_W, marginRight: Math.round(ITEM_W / 2) },
                      ]}
                      onPress={handleAddPhoto}
                      disabled={addingPhoto || resolving}
                      accessibilityLabel="Add photo"
                    >
                      {addingPhoto || resolving ? (
                        <ActivityIndicator color="#3A9BDC" />
                      ) : (
                        <>
                          <Ionicons name="add" size={28} color="#3A9BDC" />
                          <Text style={styles.addPhotoSlideText}>
                            Add photo
                          </Text>
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
              <Text style={styles.distanceAboveButton}>
                {fountain.distance}
              </Text>
            ) : null}
            <View style={styles.extraSection}>
              <Pressable
                style={({ pressed }) => [
                  styles.directionsButton,
                  pressed && styles.directionsButtonPressed,
                ]}
                onPress={() =>
                  openDirections(
                    fountain.latitude,
                    fountain.longitude,
                    fountain.name,
                  )
                }
              >
                <Ionicons name="navigate" size={20} color="#FFFFFF" />
                <Text style={styles.directionsButtonText}>Get directions</Text>
              </Pressable>
              {isOwner && (
                <View style={styles.ownerActionsRow}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.ownerActionButton,
                      pressed && styles.ownerActionButtonPressed,
                    ]}
                    onPress={() => {
                      setEditName(fountain.name);
                      setEditModalVisible(true);
                    }}
                    disabled={deleting}
                    accessibilityLabel="Edit location"
                  >
                    <Ionicons name="pencil" size={18} color="#3A9BDC" />
                    <Text style={styles.ownerActionText}>Edit</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [
                      styles.ownerActionButton,
                      styles.ownerActionButtonDanger,
                      pressed && styles.ownerActionButtonPressed,
                    ]}
                    onPress={handleDelete}
                    disabled={deleting}
                    accessibilityLabel="Delete location"
                  >
                    {deleting ? (
                      <ActivityIndicator size="small" color="#DC2626" />
                    ) : (
                      <>
                        <Ionicons
                          name="trash-outline"
                          size={18}
                          color="#DC2626"
                        />
                        <Text
                          style={[
                            styles.ownerActionText,
                            styles.ownerActionTextDanger,
                          ]}
                        >
                          Delete
                        </Text>
                      </>
                    )}
                  </Pressable>
                </View>
              )}
            </View>

            <View style={styles.contentRest}>
              <View style={styles.ratingSection}>
                <Text style={styles.ratingQuestion}>
                  How would you rate the water?
                </Text>
                <Text style={styles.ratingSubtitle}>
                  {isSignedIn ? "We'd love to know!" : "Sign in to rate"}
                </Text>
                <View style={styles.starsRow}>
                  <StarRating
                    rating={effectiveFountain.rating}
                    size={28}
                    onRate={canRate ? handleRate : undefined}
                  />
                </View>
              </View>
            </View>

            {typeof effectiveFountain.id === "string" &&
              effectiveFountain.createdBy && (
                <Text style={styles.addedByFooter} numberOfLines={1}>
                  Added by{" "}
                  {effectiveFountain.createdBy.displayName ?? "Someone"}
                </Text>
              )}
          </View>
        </View>

        <Modal
          visible={editModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setEditModalVisible(false)}
        >
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setEditModalVisible(false)}
          >
            <Pressable
              style={styles.modalContent}
              onPress={(e) => e.stopPropagation()}
            >
              <Text style={styles.modalTitle}>Edit location name</Text>
              <TextInput
                style={styles.modalInput}
                value={editName}
                onChangeText={setEditName}
                placeholder="Location name"
                placeholderTextColor="#9CA3AF"
                editable={!savingEdit}
              />
              <View style={styles.modalButtons}>
                <Pressable
                  style={[styles.modalButton, styles.modalButtonCancel]}
                  onPress={() => setEditModalVisible(false)}
                  disabled={savingEdit}
                >
                  <Text style={styles.modalButtonCancelText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[styles.modalButton, styles.modalButtonSave]}
                  onPress={handleSaveEdit}
                  disabled={savingEdit || !editName.trim()}
                >
                  {savingEdit ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Text style={styles.modalButtonSaveText}>Save</Text>
                  )}
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      </ScrollView>

      {showSavedLottie && (
        <View
          style={[styles.savedLottieWrap, { paddingTop: insets.top }]}
          pointerEvents="none"
        >
          <View style={styles.savedLottie}>
            <LottieView
              source={require("../../assets/icons/JitterFiles/RefillSavedFinal.json")}
              autoPlay
              loop={false}
              onAnimationFinish={handleSavedLottieFinish}
              style={styles.savedLottieLottie}
            />
          </View>
        </View>
      )}
    </View>
  );
}

export default React.memo(FountainDetail);

const MAP_RADIUS = GRID_MARGIN;

// Grid: margin 16, gutter 16
const SPACE_MAP_TO_TITLE = 20;
const SPACE_TITLE_TO_IMAGES = 20;
const SPACE_IMAGES_TO_RATING = 24;
const SPACE_RATING_TO_ACTIONS = 24;
const GAP_IMAGES = 12;

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 32,
  },
  mapBlock: {
    marginTop: 0,
    marginHorizontal: GRID_GUTTER_HALF,
    marginBottom: GRID_GUTTER,
    padding: GRID_GUTTER_HALF + 5,
    borderRadius: MAP_RADIUS,
    borderWidth: 2,
    borderColor: "#e0e0e0",
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
  },
  mapWrap: {
    height: 280,
    marginHorizontal: GRID_GUTTER_HALF - 2,
    marginBottom: GRID_GUTTER_HALF + 5,
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
  addedByFooter: {
    fontSize: 12,
    color: "#777",
    marginTop: 20,
    marginBottom: 8,
    paddingHorizontal: 6,
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
    left: 22,
    right: 22,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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
    paddingHorizontal: GRID_MARGIN,
  },
  extraSection: {
    paddingHorizontal: GRID_MARGIN,
    paddingVertical: GRID_GUTTER,
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
  ownerActionsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
  },
  ownerActionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#3A9BDC",
  },
  ownerActionButtonPressed: { opacity: 0.8 },
  ownerActionButtonDanger: { borderColor: "#DC2626" },
  ownerActionText: { fontSize: 15, fontWeight: "600", color: "#3A9BDC" },
  ownerActionTextDanger: { color: "#DC2626" },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-start",
    alignItems: "center",
    padding: 24,
    paddingTop: 100,
  },
  modalContent: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 24,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111",
    marginBottom: 16,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: "#111",
    marginBottom: 20,
  },
  modalButtons: { flexDirection: "row", gap: 12, justifyContent: "flex-end" },
  modalButton: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10 },
  modalButtonCancel: { backgroundColor: "#f0f0f0" },
  modalButtonSave: { backgroundColor: "#3A9BDC" },
  modalButtonCancelText: { fontSize: 15, fontWeight: "600", color: "#333" },
  modalButtonSaveText: { fontSize: 15, fontWeight: "600", color: "#FFF" },
  savedLottieWrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  savedLottie: {
    alignItems: "center",
    justifyContent: "center",
  },
  savedLottieLottie: {
    width: 300,
    height: 300,
  },
});
