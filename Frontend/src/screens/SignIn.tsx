import React, { useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { GRID_MARGIN, GRID_GUTTER, GRID_GUTTER_HALF } from "../constants/grid";
import { BackHeader, FormInput, SocialButtons } from "../components";
import { signInWithOAuthProvider } from "../lib/authOAuth";
import { supabase } from "../lib/supabase";

type NavProp = NativeStackNavigationProp<RootStackParamList>;

export default function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigation = useNavigation<NavProp>();

  const handleContinue = async () => {
    setError(null);
    if (!email.trim() || !password) {
      setError("Please enter email and password.");
      return;
    }
    if (!supabase) {
      setError("Supabase is not configured. Check your .env file.");
      return;
    }
    setLoading(true);
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (authError) {
      setError(authError.message);
      return;
    }
    if (data.session) {
      navigation.navigate("Home");
    }
  };

  const handleSocialLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      await signInWithOAuthProvider();
      navigation.navigate("Home");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <BackHeader title="Sign In" backTo="Home" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
        <FormInput
          label="Email Address"
          type="email"
          placeholder="Enter email address"
          value={email}
          onChange={setEmail}
          required
        />
        <FormInput
          label="Password"
          type="password"
          placeholder="Enter password"
          value={password}
          onChange={setPassword}
          required
        />
        <Pressable
          style={({ pressed }) => [
            styles.button,
            pressed && styles.buttonPressed,
            loading && styles.buttonDisabled,
          ]}
          onPress={handleContinue}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Sign In</Text>
          )}
        </Pressable>
        <View style={styles.footer}>
          <Text style={styles.footerText}>Don't have an account? </Text>
          <Pressable onPress={() => navigation.navigate("SignUp")}>
            <Text style={styles.link}>Create Account</Text>
          </Pressable>
        </View>
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>Or</Text>
          <View style={styles.dividerLine} />
        </View>
        <SocialButtons onGoogleLogin={handleSocialLogin} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  scroll: { flex: 1 },
  content: { padding: GRID_MARGIN + 4, paddingBottom: 40 },
  button: {
    backgroundColor: "#2196F3",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: GRID_GUTTER_HALF,
    marginBottom: GRID_MARGIN + 4,
  },
  buttonPressed: { opacity: 0.9 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  footer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    marginBottom: GRID_MARGIN + 8,
  },
  footerText: { fontSize: 14, color: "#666" },
  link: { fontSize: 14, color: "#2196F3", fontWeight: "600" },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: GRID_GUTTER,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: "#ddd" },
  dividerText: {
    marginHorizontal: GRID_GUTTER_HALF + 4,
    fontSize: 14,
    color: "#999",
  },
  errorBox: {
    backgroundColor: "#ffebee",
    padding: GRID_GUTTER_HALF + 4,
    borderRadius: 8,
    marginBottom: GRID_GUTTER,
  },
  errorText: { color: "#c62828", fontSize: 14 },
  buttonDisabled: { opacity: 0.7 },
});
