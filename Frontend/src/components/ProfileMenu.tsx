import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, Image, Alert, ActivityIndicator } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import * as ImagePicker from "expo-image-picker";
import MenuItem from "./MenuItem";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import { getMyProfile, uploadAvatar } from "../lib/profile";
import HeartLogo from "../../assets/icons/HeartLogo.svg";

interface ProfileMenuProps {
  onClose?: () => void;
  onOpenSaved?: () => void;
}

type NavProp = NativeStackNavigationProp<RootStackParamList>;

export default function ProfileMenu({ onClose, onOpenSaved }: ProfileMenuProps) {
  const navigation = useNavigation<NavProp>();
  const { isSignedIn, user } = useAuth();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  useEffect(() => {
    if (!user?.id) {
      setAvatarUrl(null);
      return;
    }
    let cancelled = false;
    getMyProfile(user.id).then((profile) => {
      if (!cancelled && profile?.avatarUrl) setAvatarUrl(profile.avatarUrl);
      else if (!cancelled) setAvatarUrl(null);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const handleAvatarPress = async () => {
    if (!user?.id || uploadingAvatar) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Allow access to your photos to set a profile picture.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]) return;
    setUploadingAvatar(true);
    try {
      const url = await uploadAvatar(user.id, result.assets[0].uri);
      setAvatarUrl(url);
    } catch (e) {
      Alert.alert(
        "Upload failed",
        e instanceof Error ? e.message : "Could not update profile picture."
      );
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSignInClick = () => {
    navigation.navigate("SignIn");
    onClose?.();
  };

  const handleSignOutClick = async () => {
    await supabase?.auth.signOut();
    onClose?.();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.userSection}>
          <Pressable
            style={styles.avatar}
            onPress={isSignedIn ? handleAvatarPress : undefined}
            disabled={uploadingAvatar}
            accessibilityLabel={isSignedIn ? "Change profile picture" : undefined}
          >
            {uploadingAvatar ? (
              <ActivityIndicator size="small" color="#666" />
            ) : avatarUrl ? (
              <Image
                source={{ uri: avatarUrl }}
                style={StyleSheet.absoluteFillObject}
                resizeMode="cover"
              />
            ) : (
              <Ionicons name="person" size={24} color="#666" />
            )}
          </Pressable>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>
              {isSignedIn ? user?.email ?? "User" : "Guest"}
            </Text>
            <Text style={styles.stats}>
              {isSignedIn ? "★ Refills" : "No refills"}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.menu}>
        {isSignedIn && (
          <>
            <MenuItem
              icon={<Ionicons name="bookmark" size={20} color="#333" />}
              title="Favorites"
              subtitle="Favorite Refill stations"
              onClick={() => {}}
            />
            <MenuItem
              icon={<HeartLogo width={20} height={20 * (23 / 25)} color="#333" />}
              title="Saved"
              subtitle="Find Saved Locations"
              onClick={() => onOpenSaved?.()}
            />
          </>
        )}
        <MenuItem
          icon={<Ionicons name="settings" size={20} color="#333" />}
          title="Settings"
          onClick={() => {}}
        />
        <MenuItem
          icon={
            <Ionicons
              name={isSignedIn ? "log-out-outline" : "log-in-outline"}
              size={20}
              color="#333"
            />
          }
          title={isSignedIn ? "Sign Out" : "Sign In"}
          onClick={isSignedIn ? handleSignOutClick : handleSignInClick}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  userSection: { flexDirection: "row", alignItems: "center" },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#f0f0f0",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    overflow: "hidden",
  },
  userInfo: { flex: 1 },
  userName: { fontSize: 18, fontWeight: "600", color: "#000" },
  stats: { fontSize: 14, color: "#666", marginTop: 2 },
  menu: { paddingTop: 8 },
});
