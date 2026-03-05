import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  Image,
  LayoutAnimation,
  Platform,
  UIManager,
  Keyboard,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import * as Location from "expo-location";
import {
  Map,
  BottomSheet,
  FeaturedFountainCard,
  FountainCard,
  FountainDetail,
  ProfileMenu,
  AddWaterSource,
} from "../components";
import { useAuth } from "../contexts/AuthContext";
import { mockFountains } from "../constants/mockFountains";
import { distanceMeters, formatDistance } from "../utils/distance";
import { fetchWaterFountains } from "../utils/overpass";
import { fetchUserWaterSources } from "../lib/waterSources";
import {
  fetchSavedLocations,
  isLocationSaved,
  toggleSavedLocation,
} from "../lib/savedLocations";
import type { Fountain } from "../types/fountain";

type SheetContent = "list" | "detail" | "profile" | "addSource" | "saved";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type NavProp = NativeStackNavigationProp<RootStackParamList>;

export default function Home() {
  const navigation = useNavigation<NavProp>();
  const { isSignedIn } = useAuth();
  const [fountains, setFountains] = useState<Fountain[]>(mockFountains);
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
  const markerPressTimeRef = useRef(0);
  const pendingContentRef = useRef<
    | { type: "detail"; fountain: Fountain }
    | { type: "profile" }
    | { type: "addSource" }
    | null
  >(null);

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

  useEffect(() => {
    if (!userLocation) return;
    let cancelled = false;
    (async () => {
      try {
        const apiFountains = await fetchWaterFountains(
          userLocation.latitude,
          userLocation.longitude,
          5000,
        );
        if (!cancelled) {
          setFountains((prev) => {
            const byId: Record<string | number, Fountain> = {};
            prev.forEach((f) => (byId[f.id] = f));
            apiFountains.forEach((f) => (byId[f.id] = f));
            return Object.values(byId);
          });
        }
      } catch {
        // keep existing fountains on Overpass error
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userLocation?.latitude, userLocation?.longitude]);

  useEffect(() => {
    (async () => {
      const list = await fetchUserWaterSources();
      setUserFountains(list);
    })();
  }, []);

  const refetchUserFountains = useCallback(async () => {
    const list = await fetchUserWaterSources();
    setUserFountains(list);
  }, []);

  const refetchSavedFountains = useCallback(async () => {
    try {
      const list = await fetchSavedLocations();
      setSavedFountains(list);
    } catch (e) {
      Alert.alert(
        "Saved locations unavailable",
        e instanceof Error ? e.message : "Could not fetch saved locations."
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
        ]
      );
      return;
    }
    if (!selectedFountain || typeof selectedFountain.id !== "string") {
      Alert.alert(
        "Not supported",
        "Only database-backed fountains can be saved right now."
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
        e instanceof Error ? e.message : "Could not update saved location."
      );
    }
  }, [isSignedIn, selectedFountain, selectedFountainSaved, refetchSavedFountains, navigation]);

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
      // Add the new fountain to the list immediately so the pin appears right away
      setUserFountains((prev) => [withDistance, ...prev]);
      setPendingAddCoordinate(null);
      setSelectedFountain(withDistance);
      setSheetContent("detail");
      setCurrentSnap(1);
      // Refetch after a short delay so the server has the new row; merge result so we never drop the new pin
      setTimeout(() => {
        fetchUserWaterSources().then((list) => {
          setUserFountains((prev) => {
            const serverIds = new Set(list.map((f) => f.id));
            const onlyInPrev = prev.filter((f) => !serverIds.has(f.id));
            return [...list, ...onlyInPrev];
          });
        });
      }, 800);
    },
    [userLocation],
  );

  const allFountains = useMemo(
    () => [...fountains, ...userFountains],
    [fountains, userFountains],
  );

  const closestFountains = useMemo(() => {
    const list = allFountains.map((f) => ({ ...f }));
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
      const ma = distanceMeters(userLocation!.latitude, userLocation!.longitude, a.latitude, a.longitude);
      const mb = distanceMeters(userLocation!.latitude, userLocation!.longitude, b.latitude, b.longitude);
      return ma - mb;
    });
    return list;
  }, [allFountains, userLocation]);

  const searchDropdownFountains = useMemo(() => {
    const q = debouncedSearchQuery.trim().toLowerCase();
    const list = q
      ? closestFountains.filter((f) =>
          f.name.toLowerCase().includes(q),
        )
      : closestFountains;
    return list.slice(0, 5);
  }, [closestFountains, debouncedSearchQuery]);

  const handleFountainClick = useCallback((fountain: Fountain) => {
    markerPressTimeRef.current = Date.now();
    setSelectedFountain(fountain);
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
        "Sign in required",
        "You need to log in to add a water source.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Sign in", onPress: () => navigation.navigate("SignIn") },
        ]
      );
      return;
    }
    if (!pendingAddCoordinate) return;
    setSheetContent("addSource");
    setCurrentSnap(1);
  }, [isSignedIn, pendingAddCoordinate, navigation]);

  const handleAddSourceClose = useCallback(() => {
    setSheetContent("list");
    setCurrentSnap(0);
    setPendingAddCoordinate(null);
  }, []);

  const handleUserPress = useCallback(() => {
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

  return (
    <View style={styles.container}>
      {locationReady && (
      <Map
        key={`map-${allFountains.length}-${allFountains[0]?.id ?? ""}`}
        fountains={allFountains}
        region={
          userLocation
            ? {
                latitude: userLocation.latitude,
                longitude: userLocation.longitude,
                latitudeDelta: 0.02,
                longitudeDelta: 0.02,
              }
            : undefined
        }
        selectedFountain={selectedFountain}
        pendingAddCoordinate={pendingAddCoordinate}
        onMapPress={handleMapPress}
        onLongPress={handleMapLongPress}
        onFountainPress={handleFountainClick}
      />
      )}

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
              placeholder="Find a Refill Station"
              placeholderTextColor="#333333"
              value={searchQuery}
              onChangeText={setSearchQuery}
              onFocus={() => setSearchFocused(true)}
              onBlur={() =>
                setTimeout(() => setSearchFocused(false), 200)
              }
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
          <Pressable style={styles.userButton} onPress={handleUserPress}>
            <Image
              source={require("../../assets/icons/User.png")}
              style={styles.iconImage}
              resizeMode="contain"
            />
          </Pressable>
          <Pressable
            style={[
              styles.addLocationButton,
              isSignedIn && !pendingAddCoordinate && styles.addLocationButtonDisabled,
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
                isSignedIn && !pendingAddCoordinate && styles.addLocationButtonIconDisabled,
              ]}
              resizeMode="contain"
            />
          </Pressable>
        </View>
      </SafeAreaView>

      <BottomSheet
        snapPoints={[122, "90%"]}
        index={currentSnap}
        onSnapChange={handleSheetSnapChange}
        onBackdropPress={handleBackdropPress}
        title={
          sheetContent === "list"
            ? "Closest Fountains"
            : sheetContent === "saved"
              ? "Saved Locations"
              : undefined
        }
        subtitle={
          sheetContent === "list"
            ? "Find the closest water fountains"
            : sheetContent === "saved"
              ? "Your saved refill stations"
              : undefined
        }
      >
        {sheetContent === "list" && (
          <View style={styles.list}>
            <ScrollView
              style={styles.listItems}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
            >
              {closestFountains.length > 0 && (
                <FeaturedFountainCard
                  fountain={closestFountains[0]}
                  onClick={() => handleFountainClick(closestFountains[0])}
                />
              )}
              {closestFountains.slice(1).map((fountain) => (
                <FountainCard
                  key={fountain.id}
                  fountain={fountain}
                  onClick={() => handleFountainClick(fountain)}
                />
              ))}
            </ScrollView>
          </View>
        )}
        {sheetContent === "detail" && selectedFountain && (
          <FountainDetail
            fountain={selectedFountain}
            saved={selectedFountainSaved}
            onToggleSaved={handleToggleSaved}
            onPhotosAdded={(updated) => {
              setSelectedFountain(updated);
              setUserFountains((prev) =>
                prev.map((f) => (f.id === updated.id ? updated : f))
              );
            }}
            onRatingChanged={(updated) => {
              setSelectedFountain(updated);
              setUserFountains((prev) =>
                prev.map((f) => (f.id === updated.id ? updated : f))
              );
            }}
            onFountainUpdated={(updated) => {
              setSelectedFountain(updated);
              setUserFountains((prev) =>
                prev.map((f) => (f.id === updated.id ? updated : f))
              );
            }}
            onFountainDeleted={() => {
              if (selectedFountain && typeof selectedFountain.id === "string") {
                setUserFountains((prev) =>
                  prev.filter((f) => f.id !== selectedFountain.id)
                );
                setSelectedFountain(null);
                setSheetContent(null);
              }
            }}
            onSavedChanged={refetchSavedFountains}
          />
        )}
        {sheetContent === "saved" && (
          <View style={styles.list}>
            <ScrollView
              style={styles.listItems}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {savedFountains.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyTitle}>No saved locations yet</Text>
                  <Text style={styles.emptySubtitle}>
                    Open a fountain and tap the bookmark icon to save it.
                  </Text>
                </View>
              ) : (
                savedFountains.map((fountain) => (
                  <FountainCard
                    key={fountain.id}
                    fountain={fountain}
                    onClick={() => handleFountainClick(fountain)}
                  />
                ))
              )}
            </ScrollView>
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
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 8,
  },
  searchColumn: { flex: 1 },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 50,
    paddingHorizontal: 16,
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  searchDropdownRowPressed: { backgroundColor: "#f5f5f5" },
  searchDropdownName: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    color: "#000000",
    marginRight: 8,
  },
  searchDropdownDistance: {
    fontSize: 14,
    color: "#666666",
  },
  rightButtons: {
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
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
  emptyState: {
    paddingTop: 24,
    paddingHorizontal: 16,
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
