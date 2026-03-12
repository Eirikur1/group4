import { useAppSettings } from "../contexts/AppSettingsContext";
import type { TranslationKey } from "./translations";
import { getTranslation } from "./translations";

export function useTranslation() {
  const { language } = useAppSettings();
  const t = (key: TranslationKey, params?: { count?: number }) =>
    getTranslation(language, key, params);
  return { t, language };
}
