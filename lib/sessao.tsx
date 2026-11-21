"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, mensagem } from "./api";
import { supabase } from "./supabase";
import type { Eu } from "./tipos";

type Estado =
  | { fase: "a_carregar" }
  | { fase: "sem_sessao" }
  | { fase: "erro"; erro: string }
  | { fase: "pronto"; eu: Eu };

interface Sessao {
  estado: Estado;
  recarregar: () => Promise<void>;
  sair: () => Promise<void>;
}

const Ctx = createContext<Sessao | null>(null);

export function SessaoProvider({ children }: { children: React.ReactNode }) {
  const [estado, setEstado] = useState<Estado>({ fase: "a_carregar" });

  const recarregar = useCallback(async () => {
    const { data } = await supabase().auth.getSession();
    if (!data.session) return setEstado({ fase: "sem_sessao" });
    try {
      const eu = await api.eu();
      setEstado(eu ? { fase: "pronto", eu } : { fase: "sem_sessao" });
    } catch (err) {
      setEstado({ fase: "erro", erro: mensagem(err) });
    }
  }, []);

  useEffect(() => {
    const primeiro = setTimeout(recarregar, 0);
    const { data } = supabase().auth.onAuthStateChange((evento) => {
      if (evento === "SIGNED_IN" || evento === "SIGNED_OUT") setTimeout(recarregar, 0);
    });
    return () => {
      clearTimeout(primeiro);
      data.subscription.unsubscribe();
    };
  }, [recarregar]);

  const sair = useCallback(async () => {
    await supabase().auth.signOut();
    setEstado({ fase: "sem_sessao" });
  }, []);

  return <Ctx.Provider value={{ estado, recarregar, sair }}>{children}</Ctx.Provider>;
}

export function useSessao(): Sessao {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSessao fora do SessaoProvider");
  return v;
}
