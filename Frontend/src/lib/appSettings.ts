import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY_MAP_TIME = "@app/mapTimeOfDay";
const KEY_LANGUAGE = "@app/language";

export type MapTimeOfDay = "morning" | "day" | "evening" | "night";
export type AppLanguage = "en" | "es";

export const MAP_TIME_OPTIONS: {
  value: MapTimeOfDay;
  labelEn: string;
  labelEs: string;
}[] = [
  { value: "morning", labelEn: "Morning", labelEs: "Mañana" },
  { value: "day", labelEn: "Day", labelEs: "Día" },
  { value: "evening", labelEn: "Evening", labelEs: "Tarde" },
  { value: "night", labelEn: "Night", labelEs: "Noche" },
];

export const LANGUAGE_OPTIONS: {
  value: AppLanguage;
  labelEn: string;
  labelEs: string;
}[] = [
  { value: "en", labelEn: "English", labelEs: "Inglés" },
  { value: "es", labelEn: "Spanish", labelEs: "Español" },
];

export async function getStoredMapTimeOfDay(): Promise<MapTimeOfDay> {
  try {
    const v = await AsyncStorage.getItem(KEY_MAP_TIME);
    if (v === "morning" || v === "day" || v === "evening" || v === "night")
      return v;
  } catch {}
  return "day";
}

export async function setStoredMapTimeOfDay(
  value: MapTimeOfDay,
): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY_MAP_TIME, value);
  } catch {}
}

export async function getStoredLanguage(): Promise<AppLanguage> {
  try {
    const v = await AsyncStorage.getItem(KEY_LANGUAGE);
    if (v === "en" || v === "es") return v;
  } catch {}
  return "en";
}

export async function setStoredLanguage(value: AppLanguage): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY_LANGUAGE, value);
  } catch {}
}
