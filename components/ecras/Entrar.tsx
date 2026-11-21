"use client";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BASE_DE_TESTES } from "@/lib/config";
import { useSessao } from "@/lib/sessao";
import { supabase } from "@/lib/supabase";
import { inicioDe } from "@/components/Moldura";

export function Entrar() {
  const { estado } = useSessao();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const destino = estado.fase === "pronto" ? (estado.eu.activo ? inicioDe(estado.eu) : "/sala") : null;
  useEffect(() => {
    if (destino) router.replace(destino);
  }, [destino, router]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <form
        className="card w-full max-w-sm space-y-5 p-6"
        onSubmit={async (e) => {
          e.preventDefault();
          setErro(null);
          setOcupado(true);
          const { error } = await supabase().auth.signInWithPassword({ email: email.trim(), password: senha });
          if (error) {
            setErro(/invalid/i.test(error.message) ? "Email ou palavra-passe incorrectos." : "Não foi possível entrar. Tente de novo.");
            setOcupado(false);
          }
        }}
      >
        <div className="flex items-center gap-3">
          <Image src="/boss.png" alt="BOSS" width={96} height={96} className="h-11 w-11 rounded-xl" priority />
          <div>
            <h1 className="h-title leading-tight">BOSS Restaurante</h1>
            <p className="text-sm text-muted">Entre com a sua conta do BOSS.</p>
          </div>
        </div>
        {BASE_DE_TESTES && <p className="rounded-lg bg-divider px-3 py-2 text-xs text-muted">Base de testes: use as contas de teste, não a sua conta real do BOSS.</p>}
        <div>
          <label className="field-label" htmlFor="e-email">Email</label>
          <input id="e-email" className="field" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div>
          <label className="field-label" htmlFor="e-senha">Palavra-passe</label>
          <input id="e-senha" className="field" type="password" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} required />
        </div>
        {erro && <p className="text-sm font-medium text-danger" role="alert">{erro}</p>}
        <button type="submit" className="btn btn-primary w-full" disabled={ocupado || estado.fase === "a_carregar"}>
          {ocupado ? "A entrar…" : "Entrar"}
        </button>
        <p className="text-xs text-muted">É a mesma conta que usa em app.boss.ao. Se se esqueceu da palavra-passe, recupere-a lá.</p>
      </form>
    </div>
  );
}
