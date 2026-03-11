import React, { useRef, useEffect, useMemo, useCallback } from "react";
import { StyleSheet, View, Platform } from "react-native";
import MapView from "react-native-map-clustering";
import { Marker } from "react-native-maps";
import type { Fountain } from "../types/fountain";
import { darkMapStyle } from "../constants/mapStyles";

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

export default function Map({
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
    [region?.latitude, region?.longitude, region?.latitudeDelta, region?.longitudeDelta, safeFountains],
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
    (r: { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number }) => {
      onRegionChangeComplete?.({
        latitude: r.latitude,
        longitude: r.longitude,
        latitudeDelta: r.latitudeDelta,
        longitudeDelta: r.longitudeDelta,
      });
    },
    [onRegionChangeComplete],
  );

  return (
    <View style={styles.container}>
      <MapView
        mapRef={setMapRef}
        style={styles.map}
        initialRegion={startRegion}
        minZoomLevel={3}
        maxZoomLevel={20}
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
        showsMyLocationButton
        customMapStyle={Platform.OS === "android" ? darkMapStyle : undefined}
        mapType={(Platform.OS === "ios" ? "muted" : "standard") as any}
        clusteringEnabled
        clusterColor="#FF7A50"
        clusterTextColor="#FFFFFF"
        radius={50}
        maxZoom={16}
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
              fountain.useAdminPin
                ? require("../../assets/icons/AdminPin.png")
                : fountain.isOperational
                  ? require("../../assets/icons/PinIcon.png")
                  : require("../../assets/icons/AdminPin.png")
            }
            onPress={() => onFountainPress?.(fountain)}
          />
        ))}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { width: "100%", height: "100%" },
});
