"use client";
// Segundo factor na entrada, com as mesmas regras do BOSS (`src/lib/mfa.ts` e `MfaGate` do appbossao):
// quem tem aplicação autenticadora ou SMS confirma o código; o dispositivo fica de confiança 7 dias;
// quem é obrigado a ter segundo factor e ainda não o activou, activa-o primeiro em app.boss.ao.
// Falha fechada: se não for possível confirmar o estado da sessão, a pessoa não entra.
import { supabase } from "./supabase";

export type Porta =
  | { tipo: "livre" }
  | { tipo: "codigo"; factorId?: string; smsPhone?: string }
  | { tipo: "activar" };

async function smsEstado(): Promise<{ enrolled: boolean; phoneMasked: string | null; sessionVerified: boolean }> {
  const { data, error } = await supabase().rpc("mfa_sms_status");
  if (error) throw error;
  const raw = (data ?? {}) as { enrolled?: boolean; phone_masked?: string | null; session_verified?: boolean };
  return { enrolled: !!raw.enrolled, phoneMasked: raw.phone_masked ?? null, sessionVerified: !!raw.session_verified };
}

async function factoresConfirmados(): Promise<{ id: string }[]> {
  const { data, error } = await supabase().auth.mfa.listFactors();
  if (error) throw error;
  const todos = [...(data?.totp ?? []), ...(data?.all ?? [])] as { id: string; status: string }[];
  return [...new Map(todos.map((f) => [f.id, f])).values()].filter((f) => f.status === "verified");
}

async function precisaDeCodigo(): Promise<{ precisa: boolean; factorId?: string; smsPhone?: string }> {
  const { data, error } = await supabase().auth.mfa.getAuthenticatorAssuranceLevel();
  if (error) throw error;
  if (!data) throw new Error("Nível de garantia da sessão indisponível.");
  if (data.currentLevel === "aal2") return { precisa: false };
  const sms = await smsEstado();
  if (sms.sessionVerified) return { precisa: false };
  const totp = data.nextLevel === "aal2" ? await factoresConfirmados() : [];
  return { precisa: totp.length > 0 || sms.enrolled, factorId: totp[0]?.id, smsPhone: sms.enrolled ? sms.phoneMasked ?? "" : undefined };
}

const chave = (userId: string) => `boss.mfa.trusted.${userId}`;

async function dispositivoDeConfianca(userId: string): Promise<boolean> {
  let token: string | null = null;
  try {
    token = localStorage.getItem(chave(userId));
  } catch {
    return false;
  }
  if (!token) return false;
  const { data, error } = await supabase().rpc("mfa_trust_device_claim", { _token: token });
  if (error) return false;
  if (data !== true) {
    try {
      localStorage.removeItem(chave(userId));
    } catch {
      // sem armazenamento local
    }
  }
  return data === true;
}

/** Depois do código: este dispositivo não volta a pedi-lo durante 7 dias. */
export async function lembrarDispositivo(userId: string): Promise<void> {
  const { data, error } = await supabase().rpc("mfa_trust_device_remember", { _label: navigator.userAgent.slice(0, 120) });
  if (error || typeof data !== "string") return;
  try {
    localStorage.setItem(chave(userId), data);
  } catch {
    // navegação privada: o código volta a ser pedido
  }
}

/** O que a entrada tem de fazer antes de abrir a aplicação. */
export async function porta(userId: string): Promise<Porta> {
  let passo = await precisaDeCodigo();
  if (passo.precisa && (await dispositivoDeConfianca(userId))) passo = await precisaDeCodigo();
  if (passo.precisa) return { tipo: "codigo", factorId: passo.factorId, smsPhone: passo.smsPhone };

  const { data, error } = await supabase().rpc("mfa_requirement");
  if (error) throw error;
  const regra = (data ?? {}) as { required?: boolean; blocking?: boolean };
  if (!regra.required || !regra.blocking) return { tipo: "livre" };
  const [totp, sms] = await Promise.all([factoresConfirmados(), smsEstado()]);
  return totp.length > 0 || sms.enrolled ? { tipo: "livre" } : { tipo: "activar" };
}

async function erroDaFuncao(error: unknown, porOmissao: string): Promise<string> {
  try {
    const corpo = await (error as { context?: Response }).context?.json();
    if (corpo?.error && typeof corpo.error === "string") return corpo.error;
  } catch {
    // corpo ilegível
  }
  return porOmissao;
}

export async function enviarSms(): Promise<string> {
  const { data, error } = await supabase().functions.invoke("mfa-sms-send", { body: { purpose: "login" } });
  if (error) throw new Error(await erroDaFuncao(error, "Não foi possível enviar o código."));
  const corpo = (data ?? {}) as { error?: string; phone_masked?: string };
  if (corpo.error) throw new Error(corpo.error);
  return corpo.phone_masked ?? "";
}

export async function confirmarSms(codigo: string): Promise<void> {
  const { data, error } = await supabase().functions.invoke("mfa-sms-verify", { body: { purpose: "login", code: codigo.replace(/\s/g, "") } });
  if (error) throw new Error(await erroDaFuncao(error, "Não foi possível confirmar o código."));
  const corpo = (data ?? {}) as { error?: string };
  if (corpo.error) throw new Error(corpo.error);
}

export async function confirmarAplicacao(factorId: string, codigo: string): Promise<void> {
  const { data: desafio, error: e1 } = await supabase().auth.mfa.challenge({ factorId });
  if (e1) throw e1;
  const { error } = await supabase().auth.mfa.verify({ factorId, challengeId: desafio.id, code: codigo.replace(/\s/g, "") });
  if (error) throw error;
}

export function mensagemDoCodigo(error: unknown): string {
  const m = (error as { message?: string })?.message ?? "";
  if (/[áàâãéêíóôõúç]/i.test(m)) return m;
  if (/invalid|incorrect|expired/i.test(m)) return "Código inválido ou expirado. Tente o código actual.";
  if (/too many|rate/i.test(m)) return "Demasiadas tentativas. Aguarde um momento.";
  return "Não foi possível concluir. Tente novamente.";
}
