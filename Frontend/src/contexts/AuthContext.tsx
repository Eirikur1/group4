import React, { createContext, useContext, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

interface AuthContextValue {
  session: Session | null;
  user: { id: string; email?: string } | null;
  isSignedIn: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  user: null,
  isSignedIn: false,
});

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data: { session: s } }) => setSession(s));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  const user = session?.user
    ? { id: session.user.id, email: session.user.email ?? undefined }
    : null;

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        isSignedIn: !!session,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
