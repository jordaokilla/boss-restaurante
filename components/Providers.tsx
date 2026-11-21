"use client";
import { SessaoProvider } from "@/lib/sessao";

export function Providers({ children }: { children: React.ReactNode }) {
  return <SessaoProvider>{children}</SessaoProvider>;
}
