import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { BackHeader } from "../components";
import { useAppSettings } from "../contexts/AppSettingsContext";
import type { AppLanguage, MapTimeOfDay } from "../lib/appSettings";
import { MAP_TIME_OPTIONS, LANGUAGE_OPTIONS } from "../lib/appSettings";
import { useTranslation } from "../i18n/useTranslation";
import { GRID_MARGIN, GRID_GUTTER_HALF } from "../constants/grid";

const isIOS = Platform.OS === "ios";
const GROUP_HORIZONTAL = isIOS ? 20 : GRID_MARGIN;
const GROUP_RADIUS = isIOS ? 10 : 12;
const ROW_HEIGHT = isIOS ? 44 : 48;
const SECTION_HEADER_TOP = isIOS ? 34 : 24;

export default function Settings() {
  const navigation = useNavigation();
  const { mapTimeOfDay, setMapTimeOfDay, language, setLanguage } =
    useAppSettings();
  const { t } = useTranslation();

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <BackHeader title={t("settings")} backTo="Home" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingHorizontal: GROUP_HORIZONTAL }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.sectionTitle, { marginTop: SECTION_HEADER_TOP }]}>
          {t("mapAppearance")}
        </Text>
        <Text style={styles.sectionFooter}>{t("mapAppearanceFooter")}</Text>
        <View style={[styles.group, { borderRadius: GROUP_RADIUS }]}>
          {MAP_TIME_OPTIONS.map((opt, index) => (
            <Pressable
              key={opt.value}
              style={({ pressed }) => [
                styles.optionRow,
                { minHeight: ROW_HEIGHT },
                index > 0 && styles.optionRowBorder,
                pressed && styles.optionRowPressed,
                mapTimeOfDay === opt.value && styles.optionRowSelected,
              ]}
              onPress={() => setMapTimeOfDay(opt.value)}
            >
              <Text style={styles.optionLabel}>
                {language === "es" ? opt.labelEs : opt.labelEn}
              </Text>
              {mapTimeOfDay === opt.value && (
                <Ionicons
                  name="checkmark"
                  size={20}
                  color={isIOS ? "#007AFF" : "#2196F3"}
                />
              )}
            </Pressable>
          ))}
        </View>

        <Text style={[styles.sectionTitle, styles.sectionTitleSecond]}>
          {t("language")}
        </Text>
        <View style={[styles.group, { borderRadius: GROUP_RADIUS }]}>
          {LANGUAGE_OPTIONS.map((opt, index) => (
            <Pressable
              key={opt.value}
              style={({ pressed }) => [
                styles.optionRow,
                { minHeight: ROW_HEIGHT },
                index > 0 && styles.optionRowBorder,
                pressed && styles.optionRowPressed,
                language === opt.value && styles.optionRowSelected,
              ]}
              onPress={() => setLanguage(opt.value)}
            >
              <Text style={styles.optionLabel}>
                {language === "es" ? opt.labelEs : opt.labelEn}
              </Text>
              {language === opt.value && (
                <Ionicons
                  name="checkmark"
                  size={20}
                  color={isIOS ? "#007AFF" : "#2196F3"}
                />
              )}
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: isIOS ? "#f2f2f7" : "#f5f5f5" },
  scroll: { flex: 1 },
  content: { paddingBottom: 40 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6d6d72",
    textTransform: "uppercase",
    letterSpacing: 0.2,
    marginBottom: 6,
  },
  sectionFooter: {
    fontSize: 13,
    color: "#8e8e93",
    marginBottom: 8,
  },
  sectionTitleSecond: { marginTop: SECTION_HEADER_TOP },
  group: {
    backgroundColor: "#fff",
    overflow: "hidden",
    ...(isIOS && {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 3,
      elevation: 0,
    }),
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  optionRowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#c6c6c8",
  },
  optionRowPressed: { backgroundColor: isIOS ? "#f2f2f7" : "#f0f0f0" },
  optionRowSelected: { backgroundColor: "transparent" },
  optionLabel: { fontSize: 17, color: "#000", fontWeight: "400" },
});
