import React, { useRef, useEffect, useMemo, useCallback } from "react";
import { StyleSheet, View, Platform, Pressable } from "react-native";
import MapView from "react-native-map-clustering";
import { Marker } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import type { Fountain } from "../types/fountain";
import { darkMapStyle } from "../constants/mapStyles";
import { GRID_MARGIN } from "../constants/grid";

const DEFAULT_REGION = {
  latitude: 28.1235,
  longitude: -15.4363,
  latitudeDelta: 0.02,
  longitudeDelta: 0.02,
};

export interface PendingAddCoordinate {
  latitude: number;
  longitude: number;
}

export interface MapRegion {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

interface MapProps {
  fountains: Fountain[];
  region?: {
    latitude: number;
    longitude: number;
    latitudeDelta?: number;
    longitudeDelta?: number;
  };
  selectedFountain?: Fountain | null;
  pendingAddCoordinate?: PendingAddCoordinate | null;
  onMapPress?: () => void;
  onLongPress?: (coordinate: PendingAddCoordinate) => void;
  onRegionChangeComplete?: (region: MapRegion) => void;
  onFountainPress?: (fountain: Fountain) => void;
}

function deriveRegion(
  region: MapProps["region"],
  fountains: Fountain[],
): MapRegion {
  if (region) {
    return {
      latitude: region.latitude,
      longitude: region.longitude,
      latitudeDelta: region.latitudeDelta ?? 0.02,
      longitudeDelta: region.longitudeDelta ?? 0.02,
    };
  }
  if (fountains.length === 0) return DEFAULT_REGION;
  let minLat = fountains[0].latitude;
  let maxLat = fountains[0].latitude;
  let minLon = fountains[0].longitude;
  let maxLon = fountains[0].longitude;
  for (let i = 1; i < fountains.length; i++) {
    const f = fountains[i];
    minLat = Math.min(minLat, f.latitude);
    maxLat = Math.max(maxLat, f.latitude);
    minLon = Math.min(minLon, f.longitude);
    maxLon = Math.max(maxLon, f.longitude);
  }
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLon + maxLon) / 2,
    latitudeDelta: Math.max((maxLat - minLat) * 1.15, 0.02),
    longitudeDelta: Math.max((maxLon - minLon) * 1.15, 0.02),
  };
}

function Map({
  fountains = [],
  region,
  selectedFountain,
  pendingAddCoordinate,
  onMapPress,
  onLongPress,
  onRegionChangeComplete,
  onFountainPress,
}: MapProps) {
  const mapRef = useRef<any>(null);
  const setMapRef = useCallback((ref: any) => {
    mapRef.current = ref;
  }, []);
  const hasAnimatedToUserRef = useRef(false);

  const safeFountains = useMemo(() => {
    const list = Array.isArray(fountains) ? fountains : [];
    return list.filter(
      (f) => Number.isFinite(f.latitude) && Number.isFinite(f.longitude),
    );
  }, [fountains]);

  const startRegion = useMemo(
    () => deriveRegion(region, safeFountains),
    [
      region?.latitude,
      region?.longitude,
      region?.latitudeDelta,
      region?.longitudeDelta,
      safeFountains,
    ],
  );

  useEffect(() => {
    if (selectedFountain && mapRef.current) {
      mapRef.current.animateToRegion?.(
        {
          latitude: selectedFountain.latitude,
          longitude: selectedFountain.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        500,
      );
    }
  }, [selectedFountain]);

  useEffect(() => {
    if (region && mapRef.current && !hasAnimatedToUserRef.current) {
      hasAnimatedToUserRef.current = true;
      mapRef.current.animateToRegion?.(
        {
          latitude: region.latitude,
          longitude: region.longitude,
          latitudeDelta: region.latitudeDelta ?? 0.02,
          longitudeDelta: region.longitudeDelta ?? 0.02,
        },
        600,
      );
    }
  }, [region]);

  useEffect(() => {
    if (!pendingAddCoordinate || !mapRef.current) return;
    mapRef.current.animateToRegion?.(
      {
        latitude: pendingAddCoordinate.latitude,
        longitude: pendingAddCoordinate.longitude,
        latitudeDelta: 0.001,
        longitudeDelta: 0.001,
      },
      250,
    );
  }, [pendingAddCoordinate]);

  const handleRegionChangeComplete = useCallback(
    (r: {
      latitude: number;
      longitude: number;
      latitudeDelta: number;
      longitudeDelta: number;
    }) => {
      onRegionChangeComplete?.({
        latitude: r.latitude,
        longitude: r.longitude,
        latitudeDelta: r.latitudeDelta,
        longitudeDelta: r.longitudeDelta,
      });
    },
    [onRegionChangeComplete],
  );

  const handleMyLocationPress = useCallback(() => {
    if (!region || !mapRef.current) return;
    mapRef.current.animateToRegion?.(
      {
        latitude: region.latitude,
        longitude: region.longitude,
        latitudeDelta: region.latitudeDelta ?? 0.02,
        longitudeDelta: region.longitudeDelta ?? 0.02,
      },
      500,
    );
  }, [region]);

  return (
    <View style={styles.container}>
      <MapView
        mapRef={setMapRef}
        style={styles.map}
        initialRegion={startRegion}
        onPress={onMapPress}
        onLongPress={
          onLongPress
            ? (e: any) => {
                const { latitude, longitude } = e.nativeEvent.coordinate;
                onLongPress({ latitude, longitude });
              }
            : undefined
        }
        onRegionChangeComplete={handleRegionChangeComplete}
        showsUserLocation
        showsMyLocationButton={false}
        compassOffset={Platform.OS === "ios" ? { x: 12, y: 155 } : undefined}
        showsPointsOfInterest={false}
        customMapStyle={Platform.OS === "android" ? darkMapStyle : undefined}
        mapType={(Platform.OS === "ios" ? "mutedStandard" : "standard") as any}
        userInterfaceStyle={Platform.OS === "ios" ? "dark" : undefined}
        clusteringEnabled
        clusterColor="#FF7A50"
        clusterTextColor="#FFFFFF"
        radius={50}
        // Lower maxZoom so the clustering index tree is shallower
        maxZoom={20}
        minPoints={2}
        animationEnabled={false}
      >
        {pendingAddCoordinate && (
          <Marker
            coordinate={{
              latitude: pendingAddCoordinate.latitude,
              longitude: pendingAddCoordinate.longitude,
            }}
            anchor={{ x: 0.5, y: 1 }}
            image={require("../../assets/icons/AddPin.png")}
            title="New location"
            tracksViewChanges={false}
          />
        )}
        {safeFountains.map((fountain) => (
          <Marker
            key={String(fountain.id)}
            coordinate={{
              latitude: fountain.latitude,
              longitude: fountain.longitude,
            }}
            anchor={{ x: 0.5, y: 1 }}
            tracksViewChanges={false}
            image={
              fountain.isOperational ? require("../../assets/icons/PinIcon.png") : require("../../assets/icons/AdminPin.png")
            }
            onPress={() => onFountainPress?.(fountain)}
          />
        ))}
      </MapView>
      {region && (
        <View style={styles.myLocationWrap} pointerEvents="box-none">
          <Pressable
            style={({ pressed }) => [
              styles.myLocationButton,
              pressed && styles.myLocationButtonPressed,
            ]}
            onPress={handleMyLocationPress}
            accessibilityLabel="Center on my location"
            accessibilityRole="button"
          >
            <Ionicons name="locate" size={22} color="#333333" />
          </Pressable>
        </View>
      )}
    </View>
  );
}

export default React.memo(Map);

const BOTTOM_REFILL_ROW = 150;

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { width: "100%", height: "100%" },
  myLocationWrap: {
    position: "absolute",
    bottom: BOTTOM_REFILL_ROW,
    right: GRID_MARGIN,
    zIndex: 1,
  },
  myLocationButton: {
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
  myLocationButtonPressed: {
    opacity: 0.9,
  },
});
