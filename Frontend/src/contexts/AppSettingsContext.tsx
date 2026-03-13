import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { AppLanguage, MapTimeOfDay } from "../lib/appSettings";
import {
  getStoredLanguage,
  getStoredMapTimeOfDay,
  setStoredLanguage,
  setStoredMapTimeOfDay,
} from "../lib/appSettings";

interface AppSettingsContextValue {
  mapTimeOfDay: MapTimeOfDay;
  setMapTimeOfDay: (v: MapTimeOfDay) => void;
  language: AppLanguage;
  setLanguage: (v: AppLanguage) => void;
}

const AppSettingsContext = createContext<AppSettingsContextValue | null>(null);

export function useAppSettings() {
  const ctx = useContext(AppSettingsContext);
  if (!ctx) throw new Error("useAppSettings must be used within AppSettingsProvider");
  return ctx;
}

export function AppSettingsProvider({ children }: { children: React.ReactNode }) {
  const [mapTimeOfDay, setMapTimeOfDayState] = useState<MapTimeOfDay>("day");
  const [language, setLanguageState] = useState<AppLanguage>("en");
  useEffect(() => {
    let cancelled = false;
    Promise.all([getStoredMapTimeOfDay(), getStoredLanguage()]).then(
      ([mapTime, lang]) => {
        if (!cancelled) {
          setMapTimeOfDayState(mapTime);
          setLanguageState(lang);
        }
      }
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const setMapTimeOfDay = useCallback((v: MapTimeOfDay) => {
    setMapTimeOfDayState(v);
    setStoredMapTimeOfDay(v);
  }, []);

  const setLanguage = useCallback((v: AppLanguage) => {
    setLanguageState(v);
    setStoredLanguage(v);
  }, []);

  const value = useMemo<AppSettingsContextValue>(
    () => ({
      mapTimeOfDay,
      setMapTimeOfDay,
      language,
      setLanguage,
    }),
    [mapTimeOfDay, setMapTimeOfDay, language, setLanguage]
  );

  return (
    <AppSettingsContext.Provider value={value}>
      {children}
    </AppSettingsContext.Provider>
  );
}
