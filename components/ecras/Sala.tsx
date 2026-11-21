"use client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { BellRing, Plus } from "lucide-react";
import { api, mensagem } from "@/lib/api";
import { useAgora, useAoVivo } from "@/lib/aoVivo";
import { ha, kz, nomeDoPedido } from "@/lib/formato";
import type { Eu, MesaSala, PedidoResumo, Sala as SalaT } from "@/lib/tipos";
import { Carregar, Moldura } from "@/components/Moldura";

function avisos(p: PedidoResumo): string[] {
  const a: string[] = [];
  if (p.por_confirmar > 0) a.push("Pedido do cliente");
  if (p.chamada_em && p.estado !== "conta_pedida") a.push("Chamou");
  if (p.prontos > 0) a.push(p.prontos === 1 ? "1 pronto" : `${p.prontos} prontos`);
  return a;
}

function CartaoMesa({ mesa, agora, onAbrir, ocupado }: { mesa: MesaSala; agora: number; onAbrir: () => void; ocupado: boolean }) {
  const p = mesa.pedido;
  const conta = p?.estado === "conta_pedida";
  const alerta = p ? avisos(p) : [];
  const cls = !p ? "border-line bg-surface"
    : conta ? "border-strong bg-strong text-on-strong"
    : "border-accent/50 bg-accent-soft";
  return (
    <button
      type="button"
      onClick={onAbrir}
      disabled={ocupado}
      className={`relative flex min-h-[104px] flex-col justify-between rounded-2xl border p-3 text-left transition active:scale-[0.98] disabled:opacity-60 ${cls}`}
    >
      {alerta.length > 0 && (
        <span className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-danger text-white" aria-hidden>
          <BellRing size={13} />
        </span>
      )}
      <span className="font-display text-xl leading-none font-bold">{mesa.nome}</span>
      {!p ? (
        <span className="text-xs text-muted">Livre · {mesa.lugares} lugares</span>
      ) : (
        <span className="space-y-0.5">
          {alerta.length > 0 && <span className={`block text-xs font-bold ${conta ? "text-accent" : "text-danger"}`}>{alerta.join(" · ")}</span>}
          <span className={`block text-xs font-semibold ${conta ? "text-accent" : "text-accent-text"}`}>
            {conta ? "Conta pedida" : kz(p.total)}
          </span>
          <span className={`block text-xs ${conta ? "opacity-80" : "text-muted"}`}>{conta ? kz(p.total) : ha(p.aberto_em, agora)}</span>
        </span>
      )}
    </button>
  );
}

export function Sala({ eu }: { eu: Eu }) {
  const router = useRouter();
  const agora = useAgora();
  const [sala, setSala] = useState<SalaT | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [area, setArea] = useState<string | null>(null);
  const [aAbrir, setAAbrir] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      setSala(await api.sala());
      setErro(null);
    } catch (err) {
      setErro(mensagem(err));
    }
  }, []);
  useEffect(() => {
    const t = setTimeout(carregar, 0);
    return () => clearTimeout(t);
  }, [carregar]);
  useAoVivo(eu.company_id, carregar);

  async function abrir(fn: () => Promise<string>, chave: string) {
    setAAbrir(chave);
    try {
      router.push(`/mesa?p=${await fn()}`);
    } catch (err) {
      setErro(mensagem(err));
      setAAbrir(null);
    }
  }

  if (!sala && !erro) return <Carregar />;
  if (!sala) {
    return (
      <div className="card p-5" role="alert">
        <p className="text-[15px]">{erro}</p>
        <button type="button" className="btn btn-ghost btn-sm mt-3" onClick={carregar}>Tentar de novo</button>
      </div>
    );
  }

  const areas = sala.areas;
  const actual = areas.find((a) => a.id === area) ?? areas[0];
  const ocupadas = areas.flatMap((a) => a.mesas).filter((m) => m.pedido).length;
  const semMesas = areas.every((a) => a.mesas.length === 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="h-title">Sala</h1>
          <p className="text-sm text-muted">{ocupadas === 1 ? "1 mesa ocupada" : `${ocupadas} mesas ocupadas`}</p>
        </div>
        <button type="button" className="btn btn-strong" disabled={aAbrir !== null} onClick={() => abrir(api.abrirBalcao, "balcao")}>
          <Plus size={18} aria-hidden />
          Venda ao balcão
        </button>
      </div>

      {erro && <p className="rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger" role="alert">{erro}</p>}

      {sala.balcao.length > 0 && (
        <section aria-label="Pedidos de balcão em curso">
          <h2 className="mb-2 text-xs font-bold tracking-wider text-muted uppercase">Balcão em curso</h2>
          <div className="flex flex-wrap gap-2">
            {sala.balcao.map((p) => (
              <button key={p.id} type="button" onClick={() => router.push(`/mesa?p=${p.id}`)} className="card flex items-center gap-3 px-4 py-3 text-left hover:border-muted">
                <span className="font-display font-bold">{nomeDoPedido(p)}</span>
                <span className="text-sm text-muted">{kz(p.total)} · {ha(p.aberto_em, agora)}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {semMesas ? (
        <div className="card p-6 text-center">
          <h2 className="h-title">Ainda não há mesas</h2>
          <p className="mt-2 text-[15px] text-muted">
            {eu.papel === "gerente" ? "Crie as salas e as mesas em Gestão › Mesas." : "Peça ao gerente para criar as mesas em Gestão."}
          </p>
          {eu.papel === "gerente" && <button type="button" className="btn btn-primary mt-4" onClick={() => router.push("/gestao")}>Ir para a Gestão</button>}
        </div>
      ) : (
        <>
          {areas.length > 1 && (
            <div className="flex gap-1.5 overflow-x-auto" role="tablist" aria-label="Salas">
              {areas.map((a) => (
                <button key={a.id} type="button" role="tab" aria-selected={a.id === actual?.id} onClick={() => setArea(a.id)} className={`tab ${a.id === actual?.id ? "tab-on" : ""}`}>
                  {a.nome}
                </button>
              ))}
            </div>
          )}
          <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-6">
            {actual?.mesas.map((m) => (
              <CartaoMesa
                key={m.id}
                mesa={m}
                agora={agora}
                ocupado={aAbrir !== null}
                onAbrir={() => (m.pedido ? router.push(`/mesa?p=${m.pedido.id}`) : abrir(() => api.abrirMesa(m.id), m.id))}
              />
            ))}
          </div>
          {actual && actual.mesas.length === 0 && <p className="text-sm text-muted">Esta sala ainda não tem mesas.</p>}
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted" aria-label="Legenda">
            <li className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded border border-line bg-surface" aria-hidden />Livre</li>
            <li className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded border border-accent/50 bg-accent-soft" aria-hidden />Ocupada</li>
            <li className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-strong" aria-hidden />Conta pedida</li>
          </ul>
        </>
      )}
    </div>
  );
}

export function PaginaSala() {
  return <Moldura papeis={["gerente", "empregado"]}>{(eu) => <Sala eu={eu} />}</Moldura>;
}
