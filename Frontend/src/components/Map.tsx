import React, { useRef, useEffect, useState, useMemo, useCallback } from "react";
import { StyleSheet, View, Text, Platform } from "react-native";
import MapView, { Marker } from "react-native-maps";
import type { Fountain } from "../types/fountain";
import { darkMapStyle } from "../constants/mapStyles";
import { clusterFountains } from "../utils/clusterFountains";

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
  /** Pin shown when user long-presses to add a new location */
  pendingAddCoordinate?: PendingAddCoordinate | null;
  onMapPress?: () => void;
  onLongPress?: (coordinate: PendingAddCoordinate) => void;
  /** Called when user stops panning/zooming; use to fetch OSM fountains for visible area */
  onRegionChangeComplete?: (region: MapRegion) => void;
  onFountainPress?: (fountain: Fountain) => void;
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
  const mapRef = useRef<MapView>(null);
  const hasAnimatedToUserRef = useRef(false);
  const safeFountains = useMemo(
    () => (Array.isArray(fountains) ? fountains : []),
    [fountains],
  );

  const defaultRegionForClustering: MapRegion = region
    ? {
        latitude: region.latitude,
        longitude: region.longitude,
        latitudeDelta: region.latitudeDelta ?? 0.02,
        longitudeDelta: region.longitudeDelta ?? 0.02,
      }
    : DEFAULT_REGION;

  const [visibleRegion, setVisibleRegion] = useState<MapRegion>(defaultRegionForClustering);
  const regionDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setVisibleRegion(defaultRegionForClustering);
  }, [region?.latitude, region?.longitude, region?.latitudeDelta, region?.longitudeDelta]);

  const setVisibleRegionDebounced = useCallback((next: MapRegion) => {
    if (regionDebounceRef.current) clearTimeout(regionDebounceRef.current);
    regionDebounceRef.current = setTimeout(() => {
      regionDebounceRef.current = null;
      setVisibleRegion(next);
    }, 250);
  }, []);

  useEffect(() => {
    return () => {
      if (regionDebounceRef.current) clearTimeout(regionDebounceRef.current);
    };
  }, []);

  const clusterItems = useMemo(
    () => clusterFountains(safeFountains, visibleRegion),
    [safeFountains, visibleRegion],
  );

  useEffect(() => {
    if (selectedFountain && mapRef.current) {
      mapRef.current.animateToRegion(
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
      mapRef.current.animateToRegion(
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
    mapRef.current.animateToRegion(
      {
        latitude: pendingAddCoordinate.latitude,
        longitude: pendingAddCoordinate.longitude,
        latitudeDelta: 0.001,
        longitudeDelta: 0.001,
      },
      250,
    );
  }, [pendingAddCoordinate]);

  const initialRegion = region
    ? {
        ...DEFAULT_REGION,
        latitude: region.latitude,
        longitude: region.longitude,
        latitudeDelta: region.latitudeDelta ?? 0.02,
        longitudeDelta: region.longitudeDelta ?? 0.02,
      }
    : DEFAULT_REGION;

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={initialRegion}
        minZoomLevel={3}
        maxZoomLevel={20}
        onPress={onMapPress}
        onLongPress={
          onLongPress
            ? (e) => {
                const { latitude, longitude } = e.nativeEvent.coordinate;
                onLongPress({ latitude, longitude });
              }
            : undefined
        }
        onRegionChangeComplete={
          (r) => {
            const next: MapRegion = {
              latitude: r.latitude,
              longitude: r.longitude,
              latitudeDelta: r.latitudeDelta,
              longitudeDelta: r.longitudeDelta,
            };
            setVisibleRegionDebounced(next);
            onRegionChangeComplete?.(next);
          }
        }
        showsUserLocation
        showsMyLocationButton
        customMapStyle={Platform.OS === "android" ? darkMapStyle : undefined}
        mapType={(Platform.OS === "ios" ? "muted" : "standard") as "standard" | "satellite" | "hybrid" | "none"}
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
          />
        )}
        {clusterItems.map((item, index) =>
          item.type === "single" ? (
            <Marker
              key={item.fountain.id}
              coordinate={{
                latitude: item.fountain.latitude,
                longitude: item.fountain.longitude,
              }}
              anchor={{ x: 0.5, y: 1 }}
              title={item.fountain.name}
              description={item.fountain.description}
              tracksViewChanges={false}
              image={
                item.fountain.useAdminPin
                  ? require("../../assets/icons/AdminPin.png")
                  : item.fountain.isOperational
                    ? require("../../assets/icons/PinIcon.png")
                    : require("../../assets/icons/AdminPin.png")
              }
              onPress={() => onFountainPress?.(item.fountain)}
            />
          ) : (
            <Marker
              key={`cluster-${index}-${item.latitude}-${item.longitude}`}
              coordinate={{ latitude: item.latitude, longitude: item.longitude }}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={false}
              onPress={() => {
                if (mapRef.current) {
                  mapRef.current.animateToRegion(
                    {
                      latitude: item.latitude,
                      longitude: item.longitude,
                      latitudeDelta: Math.max(0.005, visibleRegion.latitudeDelta / 3),
                      longitudeDelta: Math.max(0.005, visibleRegion.longitudeDelta / 3),
                    },
                    300,
                  );
                }
              }}
            >
              <View style={styles.clusterOuter}>
                <View style={item.isVerified ? styles.clusterInnerVerified : styles.clusterInner}>
                  <Text style={styles.clusterText} numberOfLines={1}>
                    {item.count >= 1000 ? `${(item.count / 1000).toFixed(1)}k` : String(item.count)}
                  </Text>
                </View>
              </View>
            </Marker>
          ),
        )}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { width: "100%", height: "100%" },
  clusterOuter: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  clusterInner: {
    width: 25,
    height: 25,
    borderRadius: 12.5,
    backgroundColor: "#FF7A50",
    alignItems: "center",
    justifyContent: "center",
  },
  clusterInnerVerified: {
    width: 25,
    height: 25,
    borderRadius: 12.5,
    backgroundColor: "#3A9BDC",
    alignItems: "center",
    justifyContent: "center",
  },
  clusterText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 11,
  },
});
