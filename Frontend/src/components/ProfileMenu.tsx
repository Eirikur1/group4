import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  Alert,
  ActivityIndicator,
  FlatList,
  type ListRenderItem,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import * as ImagePicker from "expo-image-picker";
import MenuItem from "./MenuItem";
import { Ionicons } from "@expo/vector-icons";
import { GRID_MARGIN, GRID_GUTTER_HALF } from "../constants/grid";
import { useAuth } from "../contexts/AuthContext";
import { useTranslation } from "../i18n/useTranslation";
import { supabase } from "../lib/supabase";
import { getMyProfile, uploadAvatar } from "../lib/profile";
import { getRefillCount, getRefillLeaderboard, type LeaderboardEntry } from "../lib/refills";
import HeartLogo from "../../assets/icons/HeartLogo.svg";

interface ProfileMenuProps {
  onClose?: () => void;
  onOpenSaved?: () => void;
}

type NavProp = NativeStackNavigationProp<RootStackParamList>;

export default function ProfileMenu({ onClose, onOpenSaved }: ProfileMenuProps) {
  const navigation = useNavigation<NavProp>();
  const { isSignedIn, user } = useAuth();
  const { t } = useTranslation();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [refillCount, setRefillCount] = useState<number>(0);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [leaderboardError, setLeaderboardError] = useState<string | null>(null);
  const [leaderboardExpanded, setLeaderboardExpanded] = useState(false);

  useEffect(() => {
    if (!user?.id) {
      setAvatarUrl(null);
      setRefillCount(0);
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

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    getRefillCount(user.id).then((count) => {
      if (!cancelled) setRefillCount(count);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!isSignedIn) {
      setLeaderboard([]);
      setLeaderboardError(null);
      return;
    }
    let cancelled = false;
    setLeaderboardLoading(true);
    setLeaderboardError(null);
    getRefillLeaderboard(15)
      .then((result) => {
        if (cancelled) return;
        if (result.error) {
          setLeaderboardError(result.error);
          setLeaderboard([]);
        } else {
          setLeaderboard(result.data);
          setLeaderboardError(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLeaderboardLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isSignedIn]);

  const handleAvatarPress = async () => {
    if (!user?.id || uploadingAvatar) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(t("permissionNeeded"), t("allowPhotosForAvatar"));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
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
        t("uploadFailed"),
        e instanceof Error ? e.message : t("couldNotUpdateProfilePicture")
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

  const renderLeaderboardRow: ListRenderItem<LeaderboardEntry> = ({ item, index }) => (
    <View style={styles.leaderboardRow}>
      <Text style={styles.leaderboardRank}>#{index + 1}</Text>
      <View style={styles.leaderboardAvatarWrap}>
        {item.avatarUrl ? (
          <Image source={{ uri: item.avatarUrl }} style={styles.leaderboardAvatar} resizeMode="cover" />
        ) : (
          <View style={[styles.leaderboardAvatar, styles.leaderboardAvatarPlaceholder]}>
            <Ionicons name="person" size={16} color="#999" />
          </View>
        )}
      </View>
      <Text style={styles.leaderboardName} numberOfLines={1}>
        {item.displayName || "Refiller"}
      </Text>
      <Text style={styles.leaderboardCount}>{item.refillCount}</Text>
    </View>
  );

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
              {isSignedIn
                ? refillCount === 0
                  ? "No refills yet"
                  : `${refillCount} refill${refillCount === 1 ? "" : "s"}`
                : "No refills"}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.leaderboardSection}>
        <Text style={styles.leaderboardTitle}>Top refills</Text>
        {!isSignedIn ? (
          <Text style={styles.leaderboardHint}>Sign in to see the leaderboard</Text>
        ) : leaderboardLoading ? (
          <ActivityIndicator size="small" color="#666" style={styles.leaderboardLoader} />
        ) : leaderboardError ? (
          <Text style={styles.leaderboardError}>
            Couldn't load leaderboard. Run the SQL in{" "}
            <Text style={styles.leaderboardErrorBold}>supabase/migrations/004_refill_leaderboard.sql</Text>{" "}
            in your Supabase project (Dashboard → SQL Editor).
          </Text>
        ) : leaderboard.length === 0 ? (
          <Text style={styles.leaderboardHint}>No refills yet. Tap the refill button on the map at a station to log refills.</Text>
        ) : (
          <>
            <FlatList
              data={
                leaderboardExpanded ? leaderboard : leaderboard.slice(0, 5)
              }
              keyExtractor={(item) => item.userId}
              scrollEnabled={false}
              renderItem={renderLeaderboardRow}
            />
            {leaderboard.length > 5 ? (
              <Pressable
                style={({ pressed }) => [
                  styles.leaderboardShowMore,
                  pressed && styles.leaderboardShowMorePressed,
                ]}
                onPress={() => setLeaderboardExpanded((prev) => !prev)}
                accessibilityLabel={leaderboardExpanded ? "Show less" : "Show more"}
                accessibilityRole="button"
              >
                <Text style={styles.leaderboardShowMoreText}>
                  {leaderboardExpanded ? "Show less" : "Show more"}
                </Text>
                <Ionicons
                  name={leaderboardExpanded ? "chevron-up" : "chevron-down"}
                  size={18}
                  color="#3A9BDC"
                />
              </Pressable>
            ) : null}
          </>
        )}
      </View>

      <View style={styles.menu}>
        {isSignedIn && (
          <MenuItem
            icon={<HeartLogo width={20} height={20 * (23 / 25)} color="#333" />}
            title={t("saved")}
            subtitle={t("savedSubtitle")}
            onClick={() => onOpenSaved?.()}
          />
        )}
        <MenuItem
          icon={<Ionicons name="settings" size={20} color="#333" />}
          title={t("settings")}
          onClick={() => navigation.navigate("Settings")}
        />
        <MenuItem
          icon={
            <Ionicons
              name={isSignedIn ? "log-out-outline" : "log-in-outline"}
              size={20}
              color="#333"
            />
          }
          title={isSignedIn ? t("signOut") : t("signIn")}
          onClick={isSignedIn ? handleSignOutClick : handleSignInClick}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingVertical: GRID_MARGIN,
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
    marginRight: GRID_GUTTER_HALF + 4,
    overflow: "hidden",
  },
  userInfo: { flex: 1 },
  userName: { fontSize: 18, fontWeight: "600", color: "#000" },
  stats: { fontSize: 14, color: "#666", marginTop: 2 },
  leaderboardSection: {
    paddingVertical: GRID_MARGIN,
    paddingHorizontal: GRID_MARGIN,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  leaderboardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#000",
    marginBottom: GRID_GUTTER_HALF,
  },
  leaderboardHint: {
    fontSize: 14,
    color: "#666",
  },
  leaderboardError: {
    fontSize: 13,
    color: "#666",
    lineHeight: 20,
  },
  leaderboardErrorBold: {
    fontWeight: "600",
    color: "#333",
  },
  leaderboardLoader: { marginVertical: 8 },
  leaderboardRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 0,
  },
  leaderboardRank: {
    width: 28,
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
  },
  leaderboardAvatarWrap: {
    marginRight: 10,
  },
  leaderboardAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  leaderboardAvatarPlaceholder: {
    backgroundColor: "#e8e8e8",
    alignItems: "center",
    justifyContent: "center",
  },
  leaderboardName: {
    flex: 1,
    fontSize: 15,
    color: "#000",
  },
  leaderboardCount: {
    fontSize: 15,
    fontWeight: "700",
    color: "#333",
  },
   leaderboardShowMore: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  leaderboardShowMorePressed: {
    opacity: 0.7,
  },
  leaderboardShowMoreText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#3A9BDC",
  },
  menu: { paddingTop: GRID_GUTTER_HALF },
});
