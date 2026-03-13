import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
} from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  FlatList,
  Image,
  LayoutAnimation,
  Platform,
  UIManager,
  Keyboard,
  Alert,
} from "react-native";
import RefillOvalIcon from "../../assets/icons/RefillOval.svg";
import LottieView from "lottie-react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import * as Location from "expo-location";
import {
  Map,
  BottomSheet,
  ClosestFountainRow,
  FountainCard,
  FountainDetail,
  ProfileMenu,
  AddWaterSource,
} from "../components";
import { GRID_MARGIN, GRID_GUTTER, GRID_GUTTER_HALF } from "../constants/grid";
import { useAuth } from "../contexts/AuthContext";
import { distanceMeters, formatDistance } from "../utils/distance";
import {
  fetchFountainsInBoundsCached,
  invalidateFountainCache,
  type MapBounds,
  fetchFountainById,
} from "../lib/waterSources";
import {
  fetchSavedLocations,
  isLocationSaved,
  toggleSavedLocation,
} from "../lib/savedLocations";
import { logRefill } from "../lib/refills";
import type { Fountain } from "../types/fountain";
import { loadCachedFountains, saveCachedFountains } from "../lib/fountainCache";
import { useTranslation } from "../i18n/useTranslation";

type SheetContent = "list" | "detail" | "profile" | "addSource" | "saved";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type NavProp = NativeStackNavigationProp<RootStackParamList>;

export default function Home() {
  const navigation = useNavigation<NavProp>();
  const insets = useSafeAreaInsets();
  const { isSignedIn, user } = useAuth();
  const { t } = useTranslation();
  const [userFountains, setUserFountains] = useState<Fountain[]>([]);
  const [savedFountains, setSavedFountains] = useState<Fountain[]>([]);
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [locationReady, setLocationReady] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [isFetchingBounds, setIsFetchingBounds] = useState(false);
  const [currentBounds, setCurrentBounds] = useState<MapBounds | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearchQuery(searchQuery), 200);
    return () => clearTimeout(t);
  }, [searchQuery]);
  const [selectedFountain, setSelectedFountain] = useState<Fountain | null>(
    null,
  );
  const [sheetContent, setSheetContent] = useState<SheetContent>("list");
  const [currentSnap, setCurrentSnap] = useState(0);
  const [pendingAddCoordinate, setPendingAddCoordinate] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [selectedFountainSaved, setSelectedFountainSaved] = useState(false);
  const [showOnePlusLottie, setShowOnePlusLottie] = useState(false);
  const [showRefillProfileBadge, setShowRefillProfileBadge] = useState(false);
  const [loggingRefill, setLoggingRefill] = useState(false);
  const [refillPressesUsed, setRefillPressesUsed] = useState(0);
  const [refillCooldownEndsAt, setRefillCooldownEndsAt] = useState<number | null>(
    null,
  );

  const REFILL_LIMIT = 2;
  const REFILL_COOLDOWN_MS = 60 * 1000;

  useEffect(() => {
    if (refillCooldownEndsAt == null) return;
    const remaining = refillCooldownEndsAt - Date.now();
    if (remaining <= 0) {
      setRefillCooldownEndsAt(null);
      setRefillPressesUsed(0);
      return;
    }
    const t = setTimeout(() => {
      setRefillCooldownEndsAt(null);
      setRefillPressesUsed(0);
    }, remaining);
    return () => clearTimeout(t);
  }, [refillCooldownEndsAt]);
  const onePlusLottieTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const markerPressTimeRef = useRef(0);
  const pendingContentRef = useRef<
    | { type: "detail"; fountain: Fountain }
    | { type: "profile" }
    | { type: "addSource" }
    | null
  >(null);
  const fountainDetailsCacheRef = useRef<Record<string, Fountain>>({});
  const fountainDetailsOrderRef = useRef<string[]>([]);
  const MAX_DETAIL_CACHE = 100;

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocationReady(true);
        return;
      }
      try {
        const loc = await Location.getCurrentPositionAsync({});
        setUserLocation({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
      } catch {
        // ignore
      } finally {
        setLocationReady(true);
      }
    })();
  }, []);

  const regionDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hydrate from persistent cache so fountains appear instantly on reopen
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cached = await loadCachedFountains();
      if (cancelled || !cached || !cached.fountains.length) return;
      setUserFountains(cached.fountains);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (onePlusLottieTimeoutRef.current) {
        clearTimeout(onePlusLottieTimeoutRef.current);
      }
      if (regionDebounceRef.current) {
        clearTimeout(regionDebounceRef.current);
      }
    };
  }, []);

  const fetchForBounds = useCallback(async (bounds: MapBounds) => {
    setIsFetchingBounds(true);
    setCurrentBounds(bounds);
    try {
      const list = await fetchFountainsInBoundsCached(bounds);
      setUserFountains(list);
      // Persist cache in the background so next launch can show pins immediately
      saveCachedFountains(list, bounds).catch(() => {
        // ignore cache write errors
      });
    } catch {
      // keep existing markers on error
    } finally {
      setIsFetchingBounds(false);
    }
  }, []);

  const handleMapRegionChange = useCallback(
    (region: {
      latitude: number;
      longitude: number;
      latitudeDelta: number;
      longitudeDelta: number;
    }) => {
      const bounds: MapBounds = {
        north: region.latitude + region.latitudeDelta / 2,
        south: region.latitude - region.latitudeDelta / 2,
        east: region.longitude + region.longitudeDelta / 2,
        west: region.longitude - region.longitudeDelta / 2,
      };
      if (regionDebounceRef.current) clearTimeout(regionDebounceRef.current);
      regionDebounceRef.current = setTimeout(() => {
        regionDebounceRef.current = null;
        fetchForBounds(bounds);
      }, 400);
    },
    [fetchForBounds],
  );

  const refetchUserFountains = useCallback(async () => {
    invalidateFountainCache();
    if (userLocation) {
      const bounds: MapBounds = {
        north: userLocation.latitude + 0.02,
        south: userLocation.latitude - 0.02,
        east: userLocation.longitude + 0.02,
        west: userLocation.longitude - 0.02,
      };
      await fetchForBounds(bounds);
    }
  }, [userLocation, fetchForBounds]);

  // Prefetch fountains once we know the user's location, so data is ready as soon as the map is visible
  useEffect(() => {
    if (!userLocation) return;
    const bounds: MapBounds = {
      north: userLocation.latitude + 0.02,
      south: userLocation.latitude - 0.02,
      east: userLocation.longitude + 0.02,
      west: userLocation.longitude - 0.02,
    };
    fetchForBounds(bounds);
  }, [userLocation?.latitude, userLocation?.longitude, fetchForBounds]);

  const refetchSavedFountains = useCallback(async () => {
    try {
      const list = await fetchSavedLocations();
      setSavedFountains(list);
    } catch (e) {
      Alert.alert(
        "Saved locations unavailable",
        e instanceof Error ? e.message : "Could not fetch saved locations.",
      );
      setSavedFountains([]);
    }
  }, []);

  useEffect(() => {
    if (!selectedFountain) {
      setSelectedFountainSaved(false);
      return;
    }
    const fountainId = selectedFountain.id;
    if (typeof fountainId !== "string") {
      setSelectedFountainSaved(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const value = await isLocationSaved(fountainId);
        if (!cancelled) setSelectedFountainSaved(value);
      } catch {
        if (!cancelled) setSelectedFountainSaved(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedFountain?.id]);

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
    if (!selectedFountain || typeof selectedFountain.id !== "string") {
      Alert.alert(
        "Not supported",
        "Only database-backed fountains can be saved right now.",
      );
      return;
    }
    const previous = selectedFountainSaved;
    setSelectedFountainSaved((prev) => !prev);
    refetchSavedFountains();
    try {
      await toggleSavedLocation(selectedFountain.id);
    } catch (e) {
      setSelectedFountainSaved(previous);
      Alert.alert(
        "Save failed",
        e instanceof Error ? e.message : "Could not update saved location.",
      );
    }
  }, [
    isSignedIn,
    selectedFountain,
    selectedFountainSaved,
    refetchSavedFountains,
    navigation,
  ]);

  const [showLeafSavedPopup, setShowLeafSavedPopup] = useState(false);

  const handleUploadSuccess = useCallback(
    (newFountain: Fountain) => {
      const withDistance =
        userLocation && !newFountain.distance
          ? {
              ...newFountain,
              distance: formatDistance(
                distanceMeters(
                  userLocation.latitude,
                  userLocation.longitude,
                  newFountain.latitude,
                  newFountain.longitude,
                ),
              ),
            }
          : newFountain;
      setUserFountains((prev) => [withDistance, ...prev]);
      setPendingAddCoordinate(null);
      setSelectedFountain(withDistance);
      setSheetContent("detail");
      setCurrentSnap(1);
      setShowLeafSavedPopup(true);
      invalidateFountainCache();
      setTimeout(() => refetchUserFountains(), 800);
    },
    [userLocation],
  );

  const handleLeafSavedFinish = useCallback(() => {
    setShowLeafSavedPopup(false);
  }, []);

  const handleOnePlusLottieFinish = useCallback(() => {
    if (onePlusLottieTimeoutRef.current) {
      clearTimeout(onePlusLottieTimeoutRef.current);
      onePlusLottieTimeoutRef.current = null;
    }
    setShowOnePlusLottie(false);
    setShowRefillProfileBadge(true);
  }, []);

  const closestFountains = useMemo(() => {
    const list = userFountains.map((f) => ({ ...f }));
    if (!userLocation) return list;
    list.forEach((f) => {
      const m = distanceMeters(
        userLocation.latitude,
        userLocation.longitude,
        f.latitude,
        f.longitude,
      );
      f.distance = formatDistance(m);
    });
    list.sort((a, b) => {
      const ma = distanceMeters(
        userLocation!.latitude,
        userLocation!.longitude,
        a.latitude,
        a.longitude,
      );
      const mb = distanceMeters(
        userLocation!.latitude,
        userLocation!.longitude,
        b.latitude,
        b.longitude,
      );
      return ma - mb;
    });
    return list;
  }, [userFountains, userLocation]);

  const searchDropdownFountains = useMemo(() => {
    const q = debouncedSearchQuery.trim().toLowerCase();
    const list = q
      ? closestFountains.filter((f) => f.name.toLowerCase().includes(q))
      : closestFountains;
    return list.slice(0, 5);
  }, [closestFountains, debouncedSearchQuery]);

  const handleFountainClick = useCallback(async (fountain: Fountain) => {
    if (
      fountain == null ||
      (fountain.id !== 0 && !fountain.id) ||
      typeof fountain.name !== "string" ||
      !Number.isFinite(fountain.latitude) ||
      !Number.isFinite(fountain.longitude)
    ) {
      return;
    }
    markerPressTimeRef.current = Date.now();
    let full = fountain;
    const id = fountain.id;
    if (typeof id === "string") {
      const cached = fountainDetailsCacheRef.current[id];
      if (cached) {
        full = { ...cached, distance: fountain.distance ?? cached.distance };
      } else {
        try {
          const loaded = await fetchFountainById(id);
          if (loaded) {
            fountainDetailsCacheRef.current[id] = loaded;
            fountainDetailsOrderRef.current.push(id);
            if (fountainDetailsOrderRef.current.length > MAX_DETAIL_CACHE) {
              const evictId = fountainDetailsOrderRef.current.shift();
              if (evictId) {
                delete fountainDetailsCacheRef.current[evictId];
              }
            }
            full = {
              ...loaded,
              distance: fountain.distance ?? loaded.distance,
            };
          }
        } catch {
          // ignore and fall back to shallow fountain
        }
      }
    }
    setSelectedFountain(full);
    setSheetContent("detail");
    setCurrentSnap(1);
  }, []);

  const handleSheetSnapChange = useCallback((snapIndex: number) => {
    setCurrentSnap(snapIndex);
    if (snapIndex === 0) {
      Keyboard.dismiss();
      setSheetContent("list");
      setSelectedFountain(null);
      pendingContentRef.current = null;
    } else {
      const pending = pendingContentRef.current;
      requestAnimationFrame(() => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        if (pending) {
          if (pending.type === "detail") {
            setSheetContent("detail");
            setSelectedFountain(pending.fountain);
          } else if (pending.type === "profile") {
            setSheetContent("profile");
          } else if (pending.type === "addSource") {
            setSheetContent("addSource");
          }
          pendingContentRef.current = null;
        }
      });
    }
  }, []);

  const handleMapPress = useCallback(() => {
    if (Date.now() - markerPressTimeRef.current < 400) return;
    Keyboard.dismiss();
    pendingContentRef.current = null;
    setSheetContent("list");
    setSelectedFountain(null);
    setCurrentSnap(0);
  }, []);

  const handleBackdropPress = useCallback(() => {
    Keyboard.dismiss();
    pendingContentRef.current = null;
    setSheetContent("list");
    setSelectedFountain(null);
    setCurrentSnap(0);
  }, []);

  const handleMapLongPress = useCallback(
    (coordinate: { latitude: number; longitude: number }) => {
      setPendingAddCoordinate(coordinate);
    },
    [],
  );

  const handleAddLocationPress = useCallback(() => {
    if (!isSignedIn) {
      Alert.alert(
        t("signInRequired"),
        t("signInToAddLocation"),
        [
          { text: t("cancel"), style: "cancel" },
          { text: t("signIn"), onPress: () => navigation.navigate("SignIn") },
        ],
      );
      return;
    }
    if (!pendingAddCoordinate) return;
    setSheetContent("addSource");
    setCurrentSnap(1);
  }, [isSignedIn, pendingAddCoordinate, navigation, t]);

  const handleAddRefillPress = useCallback(async () => {
    const now = Date.now();
    if (
      refillCooldownEndsAt != null &&
      now < refillCooldownEndsAt
    ) {
      const secs = Math.ceil((refillCooldownEndsAt - now) / 1000);
      Alert.alert(
        t("refillCooldown"),
        t("waitSeconds", { count: secs }),
      );
      return;
    }
    if (refillPressesUsed >= REFILL_LIMIT) {
      setRefillCooldownEndsAt(now + REFILL_COOLDOWN_MS);
      Alert.alert(
        t("refillLimit"),
        t("waitBeforeMoreRefills"),
      );
      return;
    }
    if (!isSignedIn) {
      Alert.alert(t("signInRequired"), t("signInToLogRefill"), [
        { text: t("cancel"), style: "cancel" },
        { text: t("signIn"), onPress: () => navigation.navigate("SignIn") },
      ]);
      return;
    }
    if (!user?.id) return;
    const closestWithId = closestFountains.find(
      (f) => typeof f.id === "string",
    );
    if (!closestWithId) {
      Alert.alert(
        t("noRefillStationNearby"),
        t("addOrOpenFountainToLog"),
      );
      return;
    }
    setLoggingRefill(true);
    try {
      const ok = await logRefill(user.id, closestWithId.id as string);
      if (ok) {
        setRefillPressesUsed((prev) => prev + 1);
        setShowOnePlusLottie(true);
        if (onePlusLottieTimeoutRef.current) {
          clearTimeout(onePlusLottieTimeoutRef.current);
        }
        onePlusLottieTimeoutRef.current = setTimeout(() => {
          onePlusLottieTimeoutRef.current = null;
          setShowOnePlusLottie(false);
          setShowRefillProfileBadge(true);
        }, 5000);
      } else {
        Alert.alert("Couldn't log refill", "Please try again.");
      }
    } catch {
      Alert.alert("Couldn't log refill", "Please try again.");
    } finally {
      setLoggingRefill(false);
    }
  }, [
    isSignedIn,
    user?.id,
    closestFountains,
    navigation,
    refillPressesUsed,
    refillCooldownEndsAt,
    t,
  ]);

  const handleAddSourceClose = useCallback(() => {
    setSheetContent("list");
    setCurrentSnap(0);
    setPendingAddCoordinate(null);
  }, []);

  const handleUserPress = useCallback(() => {
    setShowRefillProfileBadge(false);
    setSheetContent("profile");
    setCurrentSnap(1);
  }, []);

  const handleOpenSaved = useCallback(() => {
    setSheetContent("saved");
    setCurrentSnap(1);
    refetchSavedFountains();
  }, [refetchSavedFountains]);

  const handleSearchSelectFountain = useCallback(
    (fountain: Fountain) => {
      setSearchFocused(false);
      Keyboard.dismiss();
      setSearchQuery("");
      handleFountainClick(fountain);
    },
    [handleFountainClick],
  );

  const handleDetailFountainUpdate = useCallback((updated: Fountain) => {
    setSelectedFountain(updated);
    setUserFountains((prev) =>
      prev.map((f) => (f.id === updated.id ? updated : f)),
    );
  }, []);

  const selectedFountainIdRef = useRef<Fountain["id"] | null>(null);
  selectedFountainIdRef.current = selectedFountain?.id ?? null;
  const handleDetailFountainDeleted = useCallback(() => {
    const id = selectedFountainIdRef.current;
    if (id == null) return;
    setUserFountains((prev) => prev.filter((f) => f.id !== id));
    setSelectedFountain(null);
    setSheetContent("list");
  }, []);

  const mapRegion = useMemo(
    () =>
      userLocation
        ? {
            latitude: userLocation.latitude,
            longitude: userLocation.longitude,
            latitudeDelta: 0.02,
            longitudeDelta: 0.02,
          }
        : undefined,
    [userLocation?.latitude, userLocation?.longitude],
  );

  const sheetTopInset = useMemo(
    () => Math.max(56, insets.top + GRID_GUTTER_HALF + 40 + 8),
    [insets.top],
  );

  return (
    <View style={styles.container}>
      {locationReady && (
        <Map
          fountains={userFountains}
          region={mapRegion}
          selectedFountain={selectedFountain}
          pendingAddCoordinate={pendingAddCoordinate}
          onMapPress={handleMapPress}
          onLongPress={handleMapLongPress}
          onRegionChangeComplete={handleMapRegionChange}
          onFountainPress={handleFountainClick}
        />
      )}

      <View style={styles.addRefillWrap} pointerEvents="box-none">
        <Pressable
          style={({ pressed }) => [
            styles.addRefillButton,
            pressed && styles.addRefillButtonPressed,
            (loggingRefill || refillCooldownEndsAt != null) &&
              styles.addRefillButtonDisabled,
          ]}
          onPress={handleAddRefillPress}
          disabled={loggingRefill || refillCooldownEndsAt != null}
          accessibilityLabel={t("logRefill")}
          accessibilityRole="button"
        >
          <RefillOvalIcon width={96} height={51} />
        </Pressable>
      </View>

      <SafeAreaView style={styles.overlay} edges={["top"]}>
        <View style={styles.searchColumn}>
          <View style={styles.searchWrap}>
            <Image
              source={require("../../assets/icons/SearchIcon.png")}
              style={styles.searchIcon}
              resizeMode="contain"
            />
            <TextInput
              style={styles.searchInput}
              placeholder={t("findRefillStation")}
              placeholderTextColor="#333333"
              value={searchQuery}
              onChangeText={setSearchQuery}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
            />
          </View>
          {searchFocused && searchDropdownFountains.length > 0 && (
            <View style={styles.searchDropdown}>
              <ScrollView
                style={styles.searchDropdownScroll}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {searchDropdownFountains.map((fountain) => (
                  <Pressable
                    key={fountain.id}
                    style={({ pressed }) => [
                      styles.searchDropdownRow,
                      pressed && styles.searchDropdownRowPressed,
                    ]}
                    onPress={() => handleSearchSelectFountain(fountain)}
                  >
                    <Text style={styles.searchDropdownName} numberOfLines={1}>
                      {fountain.name}
                    </Text>
                    {fountain.distance ? (
                      <Text style={styles.searchDropdownDistance}>
                        {fountain.distance}
                      </Text>
                    ) : null}
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}
        </View>
        <View style={styles.rightButtons}>
          <View style={styles.userButtonWrap}>
            <Pressable style={styles.userButton} onPress={handleUserPress}>
              <Image
                source={require("../../assets/icons/User.png")}
                style={styles.iconImage}
                resizeMode="contain"
              />
            </Pressable>
            {showOnePlusLottie && (
              <View style={styles.refillLottieOverlay} pointerEvents="none">
                <LottieView
                  source={require("../../assets/icons/JitterFiles/WaterRefillAnimation.json")}
                  autoPlay
                  loop={false}
                  onAnimationFinish={handleOnePlusLottieFinish}
                  style={styles.refillLottie}
                />
              </View>
            )}
            {showRefillProfileBadge && (
              <View style={styles.refillProfileBadge} pointerEvents="none" />
            )}
          </View>
          <Pressable
            style={[
              styles.addLocationButton,
              isSignedIn &&
                !pendingAddCoordinate &&
                styles.addLocationButtonDisabled,
            ]}
            onPress={handleAddLocationPress}
            disabled={isSignedIn ? !pendingAddCoordinate : false}
            accessibilityLabel={
              !isSignedIn
                ? "Sign in to add a location"
                : pendingAddCoordinate
                  ? "Add new location"
                  : "Long-press map to select a location first"
            }
          >
            <Image
              source={require("../../assets/icons/ADd.png")}
              style={[
                styles.iconImage,
                isSignedIn &&
                  !pendingAddCoordinate &&
                  styles.addLocationButtonIconDisabled,
              ]}
              resizeMode="contain"
            />
          </Pressable>
        </View>
      </SafeAreaView>

      <View style={styles.sheetLayer}>
        <BottomSheet
          snapPoints={[122, "90%"]}
          index={currentSnap}
          onSnapChange={handleSheetSnapChange}
          onBackdropPress={handleBackdropPress}
          topInset={sheetTopInset}
          title={
            sheetContent === "list"
              ? t("closestFountains")
              : sheetContent === "saved"
                ? t("savedLocations")
                : undefined
          }
          subtitle={
            sheetContent === "list"
              ? t("findClosestWaterFountains")
              : sheetContent === "saved"
                ? t("yourSavedRefillStations")
                : undefined
          }
        >
          {sheetContent === "list" && (
            <View style={styles.list}>
              {isFetchingBounds && closestFountains.length === 0 ? (
                <View style={styles.skeletonList}>
                  {Array.from({ length: 6 }).map((_, index) => (
                    <View key={index} style={styles.skeletonRow} />
                  ))}
                </View>
              ) : (
                <FlatList
                  data={closestFountains}
                  keyExtractor={(f) => String(f.id)}
                  renderItem={({ item: fountain }) => (
                    <ClosestFountainRow
                      fountain={fountain}
                      onPressFountain={handleFountainClick}
                    />
                  )}
                  style={styles.listItems}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode="on-drag"
                  initialNumToRender={6}
                  maxToRenderPerBatch={4}
                  windowSize={5}
                  removeClippedSubviews={true}
                />
              )}
            </View>
          )}
          {sheetContent === "detail" && selectedFountain && (
            <FountainDetail
              fountain={selectedFountain}
              saved={selectedFountainSaved}
              onToggleSaved={handleToggleSaved}
              onPhotosAdded={handleDetailFountainUpdate}
              onRatingChanged={handleDetailFountainUpdate}
              onFountainUpdated={handleDetailFountainUpdate}
              onFountainDeleted={handleDetailFountainDeleted}
              onSavedChanged={refetchSavedFountains}
            />
          )}
          {sheetContent === "saved" && (
            <View style={styles.list}>
              <FlatList
                data={savedFountains}
                keyExtractor={(f) => String(f.id)}
                renderItem={({ item: fountain }) => (
                  <FountainCard
                    fountain={fountain}
                    onPressFountain={handleFountainClick}
                  />
                )}
                style={styles.listItems}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyTitle}>
                      {t("noSavedLocationsYet")}
                    </Text>
                    <Text style={styles.emptySubtitle}>
                      {t("openFountainAndSave")}
                    </Text>
                  </View>
                }
                initialNumToRender={8}
                maxToRenderPerBatch={6}
                windowSize={6}
                removeClippedSubviews={Platform.OS === "android"}
              />
            </View>
          )}
          {sheetContent === "profile" && (
            <ProfileMenu
              onOpenSaved={handleOpenSaved}
              onClose={() => {
                Keyboard.dismiss();
                pendingContentRef.current = null;
                setSheetContent("list");
                setCurrentSnap(0);
              }}
            />
          )}
          {sheetContent === "addSource" && pendingAddCoordinate && (
            <AddWaterSource
              latitude={pendingAddCoordinate.latitude}
              longitude={pendingAddCoordinate.longitude}
              onClose={handleAddSourceClose}
              onUploadSuccess={handleUploadSuccess}
            />
          )}
        </BottomSheet>
      </View>

      {showLeafSavedPopup && (
        <View style={styles.leafSavedWrap} pointerEvents="none">
          <LottieView
            source={require("../../assets/icons/JitterFiles/NewLoAdded.json")}
            autoPlay
            loop={false}
            onAnimationFinish={handleLeafSavedFinish}
            style={styles.leafSavedLottie}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  addRefillWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 150,
    alignItems: "center",
    zIndex: 1,
  },
  userButtonWrap: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  refillProfileBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#007AFF",
  },
  refillLottieOverlay: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  refillLottie: {
    width: 55,
    height: 55,
  },
  addRefillButton: {
    alignItems: "center",
    justifyContent: "center",
  },
  addRefillButtonPressed: {
    opacity: 0.95,
  },
  addRefillButtonDisabled: {
    opacity: 0.5,
  },
  leafSavedWrap: {
    position: "absolute",
    top: 24,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  leafSavedLottie: {
    width: 300,
    height: 300,
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: GRID_MARGIN,
    paddingTop: GRID_GUTTER_HALF,
    gap: GRID_GUTTER_HALF,
    zIndex: 10,
  },
  sheetLayer: {
    zIndex: 10,
  },
  searchColumn: { flex: 1 },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: GRID_GUTTER,
    backgroundColor: "#FFFFFF",
    borderRadius: 50,
    paddingHorizontal: GRID_MARGIN,
    height: 40,
    minHeight: 40,
    alignSelf: "stretch",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  searchIcon: { width: 20, height: 20 },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: "#333333",
    paddingVertical: 0,
  },
  searchDropdown: {
    position: "absolute",
    top: 48,
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    marginTop: 4,
    maxHeight: 220,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
    overflow: "hidden",
  },
  searchDropdownScroll: { maxHeight: 220 },
  searchDropdownRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: GRID_MARGIN,
    paddingVertical: GRID_GUTTER_HALF + 4,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  searchDropdownRowPressed: { backgroundColor: "#f5f5f5" },
  searchDropdownName: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    color: "#000000",
    marginRight: GRID_GUTTER_HALF,
  },
  searchDropdownDistance: {
    fontSize: 14,
    color: "#666666",
  },
  rightButtons: {
    flexDirection: "column",
    alignItems: "center",
    gap: GRID_GUTTER_HALF,
  },
  userButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  addLocationButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  addLocationButtonDisabled: {
    opacity: 0.5,
  },
  addLocationButtonIconDisabled: {
    opacity: 0.7,
  },
  iconImage: { width: 22, height: 22 },
  list: { flex: 1, minHeight: 200 },
  listItems: { flex: 1 },
  skeletonList: {
    flex: 1,
    paddingHorizontal: GRID_MARGIN,
    paddingTop: GRID_GUTTER,
    paddingBottom: GRID_GUTTER,
    gap: GRID_GUTTER_HALF,
  },
  skeletonRow: {
    height: 72,
    borderRadius: 18,
    backgroundColor: "#F2F2F2",
  },
  emptyState: {
    paddingTop: 24,
    paddingHorizontal: GRID_MARGIN,
    alignItems: "center",
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1B1B1B",
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#666666",
    textAlign: "center",
    lineHeight: 20,
  },
});
