"use client";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, mensagem } from "@/lib/api";
import { PLANOS_DO_BOSS } from "@/lib/config";
import { useSessao } from "@/lib/sessao";
import { podeMudarDeCasa, precisaEscolherCasa } from "@/lib/casas";
import { ListaDeCasas } from "@/components/EscolherCasa";
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
  // Com estabelecimentos, liga-se o restaurante de uma casa: sem casa escolhida, a sala pergunta qual é.
  const semCasa = estado.fase === "pronto" && precisaEscolherCasa(estado.eu);
  useEffect(() => {
    if (semSessao) router.replace("/entrar");
    else if (jaLigado) router.replace("/gestao");
    else if (semCasa) router.replace("/sala");
  }, [semSessao, jaLigado, semCasa, router]);

  if (estado.fase !== "pronto" || jaLigado || semCasa) return <Carregar />;
  const eu = estado.eu;
  if (!eu.gere_empresa) {
    return (
      <Aviso titulo={eu.ja_configurado ? "Restaurante desligado" : "Restaurante por ligar"} texto={`Só o dono ou um gestor de ${eu.empresa ?? "a empresa"} pode ligar o restaurante.`}>
        <button type="button" className="btn btn-ghost" onClick={sair}>Sair</button>
      </Aviso>
    );
  }
  // O plano da empresa não deixa ligar o módulo (BOSS Factura ou Solo, subscrição terminada, limite de módulos).
  if (eu.bloqueio) {
    return (
      <Aviso titulo="O plano não inclui o BOSS Restaurante" texto={eu.bloqueio}>
        <a className="btn btn-primary" href={PLANOS_DO_BOSS}>Ver os planos</a>
        <button type="button" className="btn btn-ghost" onClick={sair}>Sair</button>
      </Aviso>
    );
  }
  // Num estabelecimento, o restaurante leva o nome dele por omissão.
  const onde = eu.casa?.nome ?? eu.empresa;
  const valor = nome ?? onde ?? "";
  const voltar = eu.ja_configurado;

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
          <h1 className="h-title">{voltar ? "Voltar a ligar o BOSS Restaurante" : "Ligar o BOSS Restaurante"}</h1>
        </div>
        {voltar ? (
          <p className="text-[15px] text-muted">
            O restaurante de <strong className="text-ink">{onde}</strong> está desligado. Ao ligar, volta tudo como estava:
            mesas, menu, equipa e vendas.
          </p>
        ) : (
          <>
            <p className="text-[15px] text-muted">
              O restaurante fica ligado a <strong className="text-ink">{onde}</strong>: usa os produtos, os clientes e a facturação
              que a empresa já tem no BOSS. A seguir cria as mesas, monta o menu e dá um papel a cada pessoa da equipa.
              {eu.casa && " As mesas, os pedidos e as contas ficam só deste estabelecimento; o menu é o da empresa."}
            </p>
            <div>
              <label className="field-label" htmlFor="c-nome">Nome do restaurante</label>
              <input id="c-nome" className="field" value={valor} onChange={(e) => setNome(e.target.value)} required maxLength={80} />
              <p className="hint">É o nome que os clientes vêem no menu do telemóvel.</p>
            </div>
          </>
        )}
        {erro && <p className="text-sm font-medium text-danger" role="alert">{erro}</p>}
        <button type="submit" className="btn btn-primary w-full" disabled={ocupado || !valor.trim()}>{ocupado ? "A ligar…" : voltar ? "Voltar a ligar" : "Ligar o restaurante"}</button>
        {podeMudarDeCasa(eu) && (
          <details className="text-sm">
            <summary className="cursor-pointer text-muted">Mudar de estabelecimento</summary>
            <div className="mt-2"><ListaDeCasas eu={eu} /></div>
          </details>
        )}
        <button type="button" className="btn btn-ghost w-full" onClick={sair}>Sair</button>
      </form>
    </div>
  );
}
