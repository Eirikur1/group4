import React from "react";
import { View, Pressable, StyleSheet, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface SocialButtonsProps {
  onGoogleLogin: () => void;
}

export default function SocialButtons({ onGoogleLogin }: SocialButtonsProps) {
  return (
    <View style={styles.container}>
      <Pressable
        style={({ pressed }) => [
          styles.button,
          pressed && styles.buttonPressed,
        ]}
        onPress={onGoogleLogin}
      >
        <Ionicons name="logo-google" size={22} color="#4285F4" />
        <Text style={styles.buttonText}>Sign in with Google</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ddd",
    backgroundColor: "#fff",
  },
  buttonPressed: { backgroundColor: "#f5f5f5" },
  buttonText: { fontSize: 16, color: "#333", fontWeight: "500" },
});
