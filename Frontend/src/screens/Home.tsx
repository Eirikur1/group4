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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
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
import { mockFountains } from "../constants/mockFountains";
import { distanceMeters, formatDistance } from "../utils/distance";
import { fetchWaterFountains } from "../utils/overpass";
import { fetchUserWaterSources } from "../lib/waterSources";
import type { Fountain } from "../types/fountain";

type SheetContent = "list" | "detail" | "profile" | "addSource";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function Home() {
  const [fountains, setFountains] = useState<Fountain[]>(mockFountains);
  const [userFountains, setUserFountains] = useState<Fountain[]>([]);
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [locationReady, setLocationReady] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [selectedFountain, setSelectedFountain] = useState<Fountain | null>(
    null,
  );
  const [sheetContent, setSheetContent] = useState<SheetContent>("list");
  const [currentSnap, setCurrentSnap] = useState(0);
  const [pendingAddCoordinate, setPendingAddCoordinate] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
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

  const handleUploadSuccess = useCallback(
    (newFountain: Fountain) => {
      refetchUserFountains();
      setPendingAddCoordinate(null);
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
      setSelectedFountain(withDistance);
      setSheetContent("detail");
      setCurrentSnap(1);
    },
    [refetchUserFountains, userLocation],
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
    const q = searchQuery.trim().toLowerCase();
    const list = q
      ? closestFountains.filter((f) =>
          f.name.toLowerCase().includes(q),
        )
      : closestFountains;
    return list.slice(0, 5);
  }, [closestFountains, searchQuery]);

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
    if (!pendingAddCoordinate) return;
    // Tapping the add-pin button now cancels/removes the pin.
    setPendingAddCoordinate(null);
  }, [pendingAddCoordinate]);

  const handleAddSourceClose = useCallback(() => {
    setSheetContent("list");
    setCurrentSnap(0);
    setPendingAddCoordinate(null);
  }, []);

  const handleUserPress = useCallback(() => {
    setSheetContent("profile");
    setCurrentSnap(1);
  }, []);

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
              !pendingAddCoordinate && styles.addLocationButtonDisabled,
            ]}
            onPress={handleAddLocationPress}
            disabled={!pendingAddCoordinate}
            accessibilityLabel={
              pendingAddCoordinate
                ? "Add new location"
                : "Long-press map to select a location first"
            }
          >
            <Image
              source={require("../../assets/icons/ADd.png")}
              style={[
                styles.iconImage,
                !pendingAddCoordinate && styles.addLocationButtonIconDisabled,
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
        title={sheetContent === "list" ? "Closest Fountains" : undefined}
        subtitle={
          sheetContent === "list" ? "Find the closest water fountains" : undefined
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
            onPhotosAdded={(updated) => {
              setSelectedFountain(updated);
              setUserFountains((prev) =>
                prev.map((f) => (f.id === updated.id ? updated : f))
              );
            }}
          />
        )}
        {sheetContent === "profile" && (
          <ProfileMenu
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
});
