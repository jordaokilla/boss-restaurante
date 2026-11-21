"use client";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, mensagem } from "@/lib/api";
import { useAgora, useAoVivo } from "@/lib/aoVivo";
import { ha, minutos, nomeDoPedido, quantidade } from "@/lib/formato";
import type { Eu, Talao } from "@/lib/tipos";
import { Carregar, Moldura } from "@/components/Moldura";

const ATRASO_MIN = 15;

/** Um toque curto quando chega um pedido novo (só depois de a pessoa já ter tocado no ecrã). */
function apitar() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const ganho = ctx.createGain();
    osc.frequency.value = 880;
    ganho.gain.setValueAtTime(0.15, ctx.currentTime);
    ganho.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.connect(ganho).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
    osc.onended = () => ctx.close();
  } catch {
    /* sem som neste aparelho */
  }
}

function Cartao({ t, agora, podeMexer, ocupado, onAvancar }: { t: Talao; agora: number; podeMexer: boolean; ocupado: boolean; onAvancar: (estado: "a_preparar" | "pronto") => void }) {
  const atrasado = t.estado !== "pronto" && minutos(t.desde, agora) >= ATRASO_MIN;
  return (
    <article className={`rounded-2xl border p-4 ${atrasado ? "border-danger bg-danger-soft" : "border-line bg-surface"}`}>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-display text-lg font-bold">{nomeDoPedido(t)}</h3>
        <span className={`text-sm font-bold ${atrasado ? "text-danger" : "text-muted"}`}>
          {t.estado === "pronto" ? "pronto" : ha(t.desde, agora)}
        </span>
      </div>
      <ul className="mt-2 space-y-1.5">
        {t.linhas.map((l) => (
          <li key={l.id} className="text-base leading-snug">
            <span className="font-semibold">{quantidade(l.quantidade)} ×</span> {l.nome}
            {l.nota && <span className="block text-sm font-semibold text-accent-text">{l.nota}</span>}
          </li>
        ))}
      </ul>
      {t.estado === "pronto" ? (
        <p className="mt-3 rounded-lg bg-success-soft px-3 py-2 text-center text-sm font-bold text-success">À espera do empregado</p>
      ) : podeMexer ? (
        <button
          type="button"
          disabled={ocupado}
          onClick={() => onAvancar(t.estado === "enviado" ? "a_preparar" : "pronto")}
          className={`btn mt-3 w-full ${t.estado === "enviado" ? "btn-ghost" : "btn-primary"}`}
        >
          {t.estado === "enviado" ? "Começar" : "Marcar pronto"}
        </button>
      ) : null}
    </article>
  );
}

export function Estacao({ eu }: { eu: Eu }) {
  const id = useSearchParams().get("id") ?? "";
  const estacao = eu.estacoes.find((e) => e.id === id);
  const agora = useAgora();
  const [fila, setFila] = useState<Talao[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const conhecidos = useRef<Set<string> | null>(null);

  const carregar = useCallback(async () => {
    if (!id) return;
    try {
      const nova = await api.fila(id);
      const novos = nova.filter((t) => t.estado === "enviado").map((t) => t.lote);
      if (conhecidos.current && novos.some((l) => !conhecidos.current!.has(l))) apitar();
      conhecidos.current = new Set(nova.map((t) => t.lote));
      setFila(nova);
      setErro(null);
    } catch (err) {
      setErro(mensagem(err));
    }
  }, [id]);
  useEffect(() => {
    const t = setTimeout(carregar, 0);
    return () => clearTimeout(t);
  }, [carregar]);
  useAoVivo(eu.company_id, carregar);

  if (!estacao) return <p className="text-muted">Estação não encontrada.</p>;
  if (!fila && !erro) return <Carregar />;

  const podeMexer = eu.papel === "gerente" || eu.papel === estacao.tipo || eu.papel === "cozinha" || eu.papel === "bar";
  const colunas: { estado: Talao["estado"]; titulo: string }[] = [
    { estado: "enviado", titulo: "Novos" },
    { estado: "a_preparar", titulo: "A preparar" },
    { estado: "pronto", titulo: "Prontos" },
  ];
  const emEspera = (fila ?? []).filter((t) => t.estado !== "pronto").length;

  async function avancar(t: Talao, estado: "a_preparar" | "pronto") {
    setOcupado(true);
    try {
      await api.avancar(t.linhas.filter((l) => l.estado !== "pronto").map((l) => l.id), estado);
      await carregar();
    } catch (err) {
      setErro(mensagem(err));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="h-title">{estacao.nome}</h1>
          <p className="text-sm text-muted">Pedidos por ordem de chegada</p>
        </div>
        <span className="pill text-sm">{emEspera === 0 ? "Nada em espera" : emEspera === 1 ? "1 em espera" : `${emEspera} em espera`}</span>
      </div>
      {erro && <p className="rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger" role="alert">{erro}</p>}
      {fila && fila.length === 0 ? (
        <p className="card p-8 text-center text-[15px] text-muted">Sem pedidos. Os novos aparecem aqui sozinhos, com um toque de aviso.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {colunas.map((c) => {
            const lista = (fila ?? []).filter((t) => t.estado === c.estado);
            return (
              <section key={c.estado} aria-label={c.titulo} className={lista.length === 0 ? "hidden md:block" : ""}>
                <h2 className="mb-2 text-xs font-bold tracking-wider text-muted uppercase">{c.titulo} {lista.length > 0 && `· ${lista.length}`}</h2>
                <div className="space-y-3">
                  {lista.map((t) => <Cartao key={t.lote} t={t} agora={agora} podeMexer={podeMexer} ocupado={ocupado} onAvancar={(e) => avancar(t, e)} />)}
                  {lista.length === 0 && <p className="rounded-2xl border border-dashed border-line p-4 text-center text-sm text-muted">Vazio</p>}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function PaginaEstacao() {
  return <Moldura papeis={["gerente", "empregado", "cozinha", "bar"]}>{(eu) => <Estacao eu={eu} />}</Moldura>;
}
