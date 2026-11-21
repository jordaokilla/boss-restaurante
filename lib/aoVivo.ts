"use client";
import { useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";

/**
 * Chama `actualizar` sempre que algo muda nos pedidos da empresa (actualizações ao vivo da base),
 * quando o ecrã volta a ficar visível e, por segurança, de 20 em 20 segundos.
 */
export function useAoVivo(companyId: string | null | undefined, actualizar: () => void) {
  const ref = useRef(actualizar);
  useEffect(() => {
    ref.current = actualizar;
  }, [actualizar]);

  useEffect(() => {
    if (!companyId) return;
    let espera: ReturnType<typeof setTimeout> | null = null;
    const pedir = () => {
      if (espera) return;
      espera = setTimeout(() => {
        espera = null;
        ref.current();
      }, 250);
    };
    const canal = supabase()
      .channel(`restaurante-${companyId}`)
      .on("postgres_changes", { event: "*", schema: "restaurante", table: "pedido_linhas", filter: `company_id=eq.${companyId}` }, pedir)
      .on("postgres_changes", { event: "*", schema: "restaurante", table: "pedidos", filter: `company_id=eq.${companyId}` }, pedir)
      .subscribe();
    const relogio = setInterval(() => document.visibilityState === "visible" && ref.current(), 20000);
    const visivel = () => document.visibilityState === "visible" && ref.current();
    document.addEventListener("visibilitychange", visivel);
    return () => {
      if (espera) clearTimeout(espera);
      clearInterval(relogio);
      document.removeEventListener("visibilitychange", visivel);
      supabase().removeChannel(canal);
    };
  }, [companyId]);
}

/** A hora actual, actualizada de 30 em 30 segundos, para os tempos de espera. */
export function useAgora(): number {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setAgora(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);
  return agora;
}
