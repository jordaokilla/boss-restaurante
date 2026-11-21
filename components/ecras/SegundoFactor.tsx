"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { confirmarAplicacao, confirmarSms, enviarSms, mensagemDoCodigo } from "@/lib/segundoFactor";

const REENVIO = 60;

/** Código do segundo factor na entrada (aplicação autenticadora ou SMS), como no BOSS. */
export function SegundoFactor({ factorId, smsPhone, onFeito, onSair }: { factorId?: string; smsPhone?: string; onFeito: () => Promise<void>; onSair: () => void }) {
  const temSms = smsPhone !== undefined;
  const [metodo, setMetodo] = useState<"aplicacao" | "sms">(factorId ? "aplicacao" : "sms");
  const [codigo, setCodigo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [aEnviar, setAEnviar] = useState(false);
  const [enviadoPara, setEnviadoPara] = useState<string | null>(null);
  const [espera, setEspera] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const enviouSozinho = useRef(false);

  useEffect(() => {
    if (espera <= 0) return;
    const t = setTimeout(() => setEspera((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [espera]);

  const enviar = useCallback(async () => {
    setAEnviar(true);
    setErro(null);
    try {
      const para = await enviarSms();
      setEnviadoPara(para || smsPhone || "");
      setEspera(REENVIO);
    } catch (e) {
      setErro(mensagemDoCodigo(e));
    } finally {
      setAEnviar(false);
    }
  }, [smsPhone]);

  // Só com SMS: o código segue logo, para a pessoa não ter de procurar o botão.
  useEffect(() => {
    if (metodo !== "sms" || enviouSozinho.current) return;
    enviouSozinho.current = true;
    const t = setTimeout(enviar, 0);
    return () => clearTimeout(t);
  }, [metodo, enviar]);

  const trocar = (m: "aplicacao" | "sms") => {
    setCodigo("");
    setErro(null);
    setMetodo(m);
  };

  return (
    <form
      className="card w-full max-w-sm space-y-5 p-6"
      onSubmit={async (e) => {
        e.preventDefault();
        if (codigo.replace(/\s/g, "").length !== 6) {
          return setErro(metodo === "sms" ? "Introduza os 6 dígitos que recebeu por SMS." : "Introduza os 6 dígitos da aplicação autenticadora.");
        }
        setOcupado(true);
        setErro(null);
        try {
          if (metodo === "sms") await confirmarSms(codigo);
          else if (factorId) await confirmarAplicacao(factorId, codigo);
          setCodigo("");
          await onFeito();
        } catch (err) {
          setErro(mensagemDoCodigo(err));
        } finally {
          setOcupado(false);
        }
      }}
    >
      <div>
        <h1 className="h-title flex items-center gap-2"><ShieldCheck size={20} className="text-accent" aria-hidden />Confirme a sua entrada</h1>
        <p className="mt-1.5 text-sm text-muted">
          {metodo === "aplicacao"
            ? "Abra a sua aplicação autenticadora e escreva o código de 6 dígitos."
            : enviadoPara
              ? `Enviámos um código de 6 dígitos por SMS para o número ${enviadoPara}.`
              : `Vamos enviar um código de 6 dígitos por SMS para o número ${smsPhone || "registado"}.`}
        </p>
      </div>
      <div>
        <label className="field-label" htmlFor="sf-codigo">Código de 6 dígitos</label>
        <input id="sf-codigo" className="field text-center text-2xl tracking-[0.4em]" inputMode="numeric" autoComplete="one-time-code" maxLength={7} placeholder="000000" value={codigo} onChange={(e) => setCodigo(e.target.value)} autoFocus />
        <p className="hint">Neste dispositivo, o código só volta a ser pedido daqui a 7 dias.</p>
      </div>
      {erro && <p className="text-sm font-medium text-danger" role="alert">{erro}</p>}
      <div className="flex flex-col items-start gap-1.5">
        {metodo === "sms" && (
          <button type="button" className="text-sm font-semibold text-accent-text underline disabled:opacity-50" onClick={enviar} disabled={aEnviar || espera > 0}>
            {aEnviar ? "A enviar…" : espera > 0 ? `Reenviar o SMS (${espera} s)` : enviadoPara ? "Reenviar o SMS" : "Enviar o código por SMS"}
          </button>
        )}
        {metodo === "aplicacao" && temSms && <button type="button" className="text-sm font-semibold text-accent-text underline" onClick={() => trocar("sms")}>Receber o código por SMS</button>}
        {metodo === "sms" && factorId && <button type="button" className="text-sm font-semibold text-accent-text underline" onClick={() => trocar("aplicacao")}>Usar a aplicação autenticadora</button>}
      </div>
      <div className="flex gap-2">
        <button type="button" className="btn btn-ghost flex-1" onClick={onSair} disabled={ocupado}>Sair</button>
        <button type="submit" className="btn btn-primary flex-1" disabled={ocupado}>{ocupado ? "A confirmar…" : "Entrar"}</button>
      </div>
    </form>
  );
}
