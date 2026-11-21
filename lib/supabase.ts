"use client";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_KEY, SUPABASE_URL } from "./config";

let client: SupabaseClient | null = null;

/** Cliente com a sessão da equipa (login do BOSS). */
export function supabase(): SupabaseClient {
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: "boss-restaurante" },
    });
  }
  return client;
}

let anon: SupabaseClient | null = null;

/** Cliente sem sessão, para o menu público (o cliente do restaurante não tem login). */
export function supabasePublico(): SupabaseClient {
  if (!anon) {
    anon = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, storageKey: "boss-restaurante-publico" },
    });
  }
  return anon;
}
