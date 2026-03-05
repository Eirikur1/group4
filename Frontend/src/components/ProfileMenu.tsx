import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import MenuItem from "./MenuItem";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import HeartLogo from "../../assets/icons/HeartLogo.svg";

interface ProfileMenuProps {
  onClose?: () => void;
  onOpenSaved?: () => void;
}

type NavProp = NativeStackNavigationProp<RootStackParamList>;

export default function ProfileMenu({ onClose, onOpenSaved }: ProfileMenuProps) {
  const navigation = useNavigation<NavProp>();
  const { isSignedIn, user } = useAuth();

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
          <View style={styles.avatar}>
            <Ionicons name="person" size={24} color="#666" />
          </View>
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
  },
  userInfo: { flex: 1 },
  userName: { fontSize: 18, fontWeight: "600", color: "#000" },
  stats: { fontSize: 14, color: "#666", marginTop: 2 },
  menu: { paddingTop: 8 },
});
