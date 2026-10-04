"use client";

import { useEffect, useState, ReactNode } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import LoginForm from "./LoginForm";

export default function RequireAuth({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setChecked(true);
    });
    return unsubscribe;
  }, []);

  if (!checked)
    return <p className="p-6 text-sm text-zinc-500">Checking sign-in...</p>;
  if (!user) return <LoginForm />;
  return <>{children}</>;
}
