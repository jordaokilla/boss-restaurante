"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, mensagem } from "./api";
import { supabase } from "./supabase";
import { BASE_DE_TESTES } from "./config";
import { porta } from "./segundoFactor";
import type { Eu } from "./tipos";

type Estado =
  | { fase: "a_carregar" }
  | { fase: "sem_sessao" }
  | { fase: "erro"; erro: string }
  /** A conta tem segundo factor: falta o código (aplicação autenticadora ou SMS). */
  | { fase: "codigo"; userId: string; factorId?: string; smsPhone?: string }
  /** A conta é obrigada a ter segundo factor e ainda não o activou (faz-se em app.boss.ao). */
  | { fase: "activar_factor" }
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
      // A base de testes não tem o segundo factor do BOSS; em produção falha fechada.
      if (!BASE_DE_TESTES) {
        const p = await porta(data.session.user.id);
        if (p.tipo === "codigo") return setEstado({ fase: "codigo", userId: data.session.user.id, factorId: p.factorId, smsPhone: p.smsPhone });
        if (p.tipo === "activar") return setEstado({ fase: "activar_factor" });
      }
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
