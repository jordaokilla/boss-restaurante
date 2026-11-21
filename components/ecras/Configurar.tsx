"use client";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, mensagem } from "@/lib/api";
import { useSessao } from "@/lib/sessao";
import { Aviso, Carregar } from "@/components/Moldura";

/** Primeira vez: o dono ou um gestor liga o restaurante na sua empresa. */
export function Configurar() {
  const { estado, recarregar, sair } = useSessao();
  const router = useRouter();
  const [nome, setNome] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const semSessao = estado.fase === "sem_sessao";
  const jaLigado = estado.fase === "pronto" && estado.eu.activo;
  useEffect(() => {
    if (semSessao) router.replace("/entrar");
    else if (jaLigado) router.replace("/gestao");
  }, [semSessao, jaLigado, router]);

  if (estado.fase !== "pronto" || jaLigado) return <Carregar />;
  const eu = estado.eu;
  if (!eu.gere_empresa) {
    return (
      <Aviso titulo="Restaurante por ligar" texto={`Só o dono ou um gestor de ${eu.empresa ?? "a empresa"} pode ligar o restaurante.`}>
        <button type="button" className="btn btn-ghost" onClick={sair}>Sair</button>
      </Aviso>
    );
  }
  const valor = nome ?? eu.empresa ?? "";

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <form
        className="card w-full max-w-md space-y-5 p-6"
        onSubmit={async (e) => {
          e.preventDefault();
          setErro(null);
          setOcupado(true);
          try {
            await api.activar(valor);
            await recarregar();
            router.replace("/gestao");
          } catch (err) {
            setErro(mensagem(err));
            setOcupado(false);
          }
        }}
      >
        <div className="flex items-center gap-3">
          <Image src="/boss.png" alt="BOSS" width={96} height={96} className="h-11 w-11 rounded-xl" priority />
          <h1 className="h-title">Ligar o BOSS Restaurante</h1>
        </div>
        <p className="text-[15px] text-muted">
          O restaurante fica ligado a <strong className="text-ink">{eu.empresa}</strong>: usa os produtos, os clientes e a facturação
          que a empresa já tem no BOSS. A seguir cria as mesas, monta o menu e dá um papel a cada pessoa da equipa.
        </p>
        <div>
          <label className="field-label" htmlFor="c-nome">Nome do restaurante</label>
          <input id="c-nome" className="field" value={valor} onChange={(e) => setNome(e.target.value)} required maxLength={80} />
          <p className="hint">É o nome que os clientes vêem no menu do telemóvel.</p>
        </div>
        {erro && <p className="text-sm font-medium text-danger" role="alert">{erro}</p>}
        <button type="submit" className="btn btn-primary w-full" disabled={ocupado || !valor.trim()}>{ocupado ? "A ligar…" : "Ligar o restaurante"}</button>
      </form>
    </div>
  );
}
