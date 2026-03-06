import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
  ActivityIndicator,
  TextInput,
} from "react-native";
import ImageWithSkeleton from "./ImageWithSkeleton";
import StarRating from "./StarRating";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { uploadFountainPhotos } from "../lib/uploadFountainPhoto";
import { insertWaterSource } from "../lib/waterSources";
import type { Fountain } from "../types/fountain";
import { useAuth } from "../contexts/AuthContext";

interface AddWaterSourceProps {
  latitude: number;
  longitude: number;
  onClose?: () => void;
  /** Called with the new fountain after save so the list/map can refresh and optionally show detail */
  onUploadSuccess?: (newFountain: Fountain) => void;
}

export default function AddWaterSource({
  latitude,
  longitude,
  onClose,
  onUploadSuccess,
}: AddWaterSourceProps) {
  const { session } = useAuth();
  const [title, setTitle] = useState("");
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [selectedUris, setSelectedUris] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  const [permission, requestPermission] = ImagePicker.useMediaLibraryPermissions();
  const [cameraPermission, requestCameraPermission] = ImagePicker.useCameraPermissions();

  const addFromLibrary = async () => {
    if (permission?.status !== "granted") {
      const { status } = await requestPermission();
      if (status !== "granted") {
        Alert.alert("Permission needed", "Allow access to your photos to upload images.");
        return;
      }
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.length) {
      setSelectedUris((prev) => [...prev, ...result.assets.map((a) => a.uri)]);
    }
  };

  const addFromCamera = async () => {
    if (cameraPermission?.status !== "granted") {
      const { status } = await requestCameraPermission();
      if (status !== "granted") {
        Alert.alert("Permission needed", "Allow camera access to take photos.");
        return;
      }
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.length) {
      setSelectedUris((prev) => [...prev, ...result.assets.map((a) => a.uri)]);
    }
  };

  const pickImages = () => {
    Alert.alert("Add photo", undefined, [
      { text: "Take photo", onPress: addFromCamera },
      { text: "Choose from library", onPress: addFromLibrary },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const removeImage = (index: number) => {
    setSelectedUris((prev) => prev.filter((_, i) => i !== index));
  };

  const canSubmit = title.trim().length > 0 && selectedUris.length > 0;

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert("Missing title", "Please enter a name for the location.");
      return;
    }
    if (selectedUris.length === 0) {
      Alert.alert("No photo", "Please add at least one photo.");
      return;
    }
    setUploading(true);
    try {
      let urls: string[];
      try {
        urls = await uploadFountainPhotos(selectedUris);
      } catch (photoErr) {
        const msg = photoErr instanceof Error ? photoErr.message : "Photo upload failed";
        throw new Error(`Photos: ${msg}`);
      }
      let newFountain;
      try {
        newFountain = await insertWaterSource(
          {
            name: title.trim(),
            latitude,
            longitude,
            images: urls,
            rating: selectedRating != null ? Math.round(selectedRating) : undefined,
          },
          session?.access_token
        );
      } catch (apiErr) {
        const msg = apiErr instanceof Error ? apiErr.message : "Request failed";
        throw new Error(`Save location: ${msg}`);
      }
      if (newFountain) onUploadSuccess?.(newFountain);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Upload failed";
      Alert.alert("Upload failed", message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.contentContainer}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      <View style={styles.header}>
        <Text style={styles.title}>Add a new water source</Text>
        <Text style={styles.subtitle}>
          Hold on the map to select a spot.
        </Text>
        <View style={styles.coordsRow}>
          <Ionicons name="location" size={16} color="#6B7280" />
          <Text style={styles.coordsText}>
            {latitude.toFixed(5)}, {longitude.toFixed(5)}
          </Text>
        </View>
      </View>

      <View style={styles.fieldSection}>
        <Text style={styles.sectionTitle}>Title for this location</Text>
        <TextInput
          style={styles.titleInput}
          placeholder="e.g. Park fountain near the playground"
          placeholderTextColor="#9CA3AF"
          value={title}
          onChangeText={setTitle}
          maxLength={80}
        />
      </View>

      <View style={styles.ratingSection}>
        <Text style={styles.sectionTitle}>How would you rate the water?</Text>
        <Text style={styles.sectionSubtitle}>We'd love to know!</Text>
        <View style={styles.starsRow}>
          <StarRating
            rating={selectedRating}
            size={28}
            onRate={setSelectedRating}
          />
        </View>
      </View>

      <View style={styles.uploadSection}>
        <Text style={styles.sectionTitle}>Upload a Photo</Text>
        {selectedUris.length > 0 && (
          <View style={styles.previewRow}>
            {selectedUris.map((uri, index) => (
              <View key={`${uri}-${index}`} style={styles.previewWrap}>
                <ImageWithSkeleton
                  uri={uri}
                  containerStyle={StyleSheet.flatten([
                    StyleSheet.absoluteFillObject,
                    styles.previewImage,
                  ])}
                  resizeMode="cover"
                  skeletonBorderRadius={8}
                />
                <Pressable
                  style={styles.removePreview}
                  onPress={() => removeImage(index)}
                  accessibilityLabel="Remove photo"
                >
                  <Ionicons name="close-circle" size={24} color="#fff" />
                </Pressable>
              </View>
            ))}
          </View>
        )}
        <Pressable
          style={styles.uploadArea}
          onPress={pickImages}
          disabled={uploading}
          accessibilityLabel="Add photos"
        >
          <Ionicons name="add-circle-outline" size={20} color="#3A9BDC" />
          <Text style={styles.uploadAreaText}>Add photos</Text>
        </Pressable>
      </View>

      <Pressable
        style={[styles.submitButton, (!canSubmit || uploading) && styles.submitButtonDisabled]}
        onPress={handleSubmit}
        disabled={!canSubmit || uploading}
        accessibilityLabel="Upload a new water source"
      >
        {uploading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.submitButtonText}>Upload a new water source</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  contentContainer: { paddingBottom: 32 },
  header: { marginBottom: 24 },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: "#6B7280",
    marginBottom: 8,
  },
  coordsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  coordsText: { fontSize: 13, color: "#6B7280" },
  fieldSection: { marginBottom: 24 },
  titleInput: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: "#111827",
    backgroundColor: "#FFFFFF",
  },
  ratingSection: { marginBottom: 28 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 6,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 14,
  },
  starsRow: {
    flexDirection: "row",
    justifyContent: "flex-start",
    alignItems: "center",
  },
  uploadSection: { marginBottom: 24 },
  previewRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 12,
  },
  previewWrap: {
    width: 80,
    height: 80,
    borderRadius: 8,
    overflow: "hidden",
    position: "relative",
  },
  previewImage: {
    width: "100%",
    height: "100%",
  },
  removePreview: {
    position: "absolute",
    top: 4,
    right: 4,
  },
  uploadArea: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#3A9BDC",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 10,
  },
  uploadAreaText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#3A9BDC",
  },
  submitButton: {
    backgroundColor: "#3A9BDC",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});
