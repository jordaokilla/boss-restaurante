"use client";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BASE_DE_TESTES } from "@/lib/config";
import { useSessao } from "@/lib/sessao";
import { supabase } from "@/lib/supabase";
import { lembrarDispositivo } from "@/lib/segundoFactor";
import { Aviso, inicioDe } from "@/components/Moldura";
import { SegundoFactor } from "./SegundoFactor";

export function Entrar() {
  const { estado, recarregar, sair } = useSessao();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Sair a meio (do código ou de um erro) volta ao formulário limpo.
  const voltar = () => {
    setOcupado(false);
    setSenha("");
    void sair();
  };

  const destino = estado.fase === "pronto" ? (estado.eu.activo ? inicioDe(estado.eu) : "/sala") : null;
  useEffect(() => {
    if (destino) router.replace(destino);
  }, [destino, router]);

  if (estado.fase === "codigo") {
    const userId = estado.userId;
    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-10">
        <SegundoFactor
          factorId={estado.factorId}
          smsPhone={estado.smsPhone}
          onSair={voltar}
          onFeito={async () => {
            await lembrarDispositivo(userId);
            await recarregar();
          }}
        />
      </div>
    );
  }
  if (estado.fase === "activar_factor") {
    return (
      <Aviso titulo="Active o segundo factor" texto="A sua conta tem acesso a dados da empresa inteira e tem de ter a confirmação por SMS ou por aplicação autenticadora. Active-a em app.boss.ao e volte a entrar aqui.">
        <a className="btn btn-primary" href="https://app.boss.ao">Abrir app.boss.ao</a>
        <button type="button" className="btn btn-ghost" onClick={voltar}>Sair</button>
      </Aviso>
    );
  }
  if (estado.fase === "erro") {
    return (
      <Aviso titulo="Não foi possível confirmar a sua sessão" texto="Verifique a ligação à Internet e tente novamente, ou saia e volte a entrar.">
        <button type="button" className="btn btn-primary" onClick={recarregar}>Tentar de novo</button>
        <button type="button" className="btn btn-ghost" onClick={voltar}>Sair</button>
      </Aviso>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <form
        className="card w-full max-w-sm space-y-5 p-6"
        onSubmit={async (e) => {
          e.preventDefault();
          setErro(null);
          setOcupado(true);
          // Como no BOSS: quem entra por nome de utilizador (sem email) tem um endereço interno.
          const quem = email.trim();
          const endereco = quem.includes("@") ? quem : `${quem.toLowerCase()}@interno.local`;
          const { error } = await supabase().auth.signInWithPassword({ email: endereco, password: senha });
          if (error) {
            setErro(/invalid/i.test(error.message) ? "Email, nome de utilizador ou palavra-passe incorrectos." : "Não foi possível entrar. Tente de novo.");
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
          <label className="field-label" htmlFor="e-email">Email ou nome de utilizador</label>
          <input id="e-email" className="field" type="text" inputMode="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
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
