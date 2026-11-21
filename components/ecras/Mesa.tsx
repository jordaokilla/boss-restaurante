"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Minus, Plus, Smartphone } from "lucide-react";
import { api, mensagem } from "@/lib/api";
import { useAoVivo } from "@/lib/aoVivo";
import { ESTADO_LINHA, hora, kz, nomeDoPedido, quantidade } from "@/lib/formato";
import type { Categoria, Eu, Linha, Pedido } from "@/lib/tipos";
import { Carregar, Moldura } from "@/components/Moldura";
import { Folha } from "@/components/Folha";
import { BotaoTalao } from "@/components/BotaoTalao";

const COR_ESTADO: Record<Linha["estado"], string> = {
  por_confirmar: "text-accent-text",
  por_enviar: "text-accent-text",
  enviado: "text-muted",
  a_preparar: "text-muted",
  pronto: "text-success",
  servido: "text-muted",
  anulado: "text-danger",
};

function EditarLinha({ linha, gerente, onFeito, onFechar }: { linha: Linha; gerente: boolean; onFeito: () => void; onFechar: () => void }) {
  const [qtd, setQtd] = useState(linha.quantidade);
  const [nota, setNota] = useState(linha.nota ?? "");
  const [motivo, setMotivo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function correr(fn: () => Promise<unknown>) {
    setOcupado(true);
    setErro(null);
    try {
      await fn();
      onFeito();
      onFechar();
    } catch (err) {
      setErro(mensagem(err));
      setOcupado(false);
    }
  }

  if (linha.estado === "por_enviar") {
    return (
      <div className="space-y-4">
        <div>
          <span className="field-label" id="q-rotulo">Quantidade</span>
          <div className="inline-flex items-center rounded-xl border border-line" role="group" aria-labelledby="q-rotulo">
            <button type="button" className="flex h-12 w-12 items-center justify-center disabled:opacity-30" onClick={() => setQtd((q) => Math.max(1, q - 1))} disabled={qtd <= 1} aria-label="Menos um"><Minus size={18} /></button>
            <output className="w-12 text-center font-display text-lg font-bold">{quantidade(qtd)}</output>
            <button type="button" className="flex h-12 w-12 items-center justify-center" onClick={() => setQtd((q) => Math.min(99, q + 1))} aria-label="Mais um"><Plus size={18} /></button>
          </div>
        </div>
        <div>
          <label className="field-label" htmlFor="l-nota">Nota para a cozinha</label>
          <input id="l-nota" className="field" placeholder="Sem cebola, bem passado…" value={nota} onChange={(e) => setNota(e.target.value)} maxLength={200} />
        </div>
        {erro && <p className="text-sm font-medium text-danger" role="alert">{erro}</p>}
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className="btn btn-danger" disabled={ocupado} onClick={() => correr(() => api.alterarLinha(linha.id, 0))}>Tirar do pedido</button>
          <button type="button" className="btn btn-primary" disabled={ocupado} onClick={() => correr(() => api.alterarLinha(linha.id, qtd, nota))}>Guardar</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-[15px] text-muted">
        {quantidade(linha.quantidade)} × {linha.nome} já foi {linha.estado === "por_confirmar" ? "pedido pelo cliente" : "enviado"}.
        {!gerente && " Só o gerente o pode anular."}
      </p>
      {gerente && (
        <>
          <div>
            <label className="field-label" htmlFor="l-motivo">Motivo da anulação</label>
            <input id="l-motivo" className="field" placeholder="Cliente desistiu, erro no pedido…" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={200} />
            <p className="hint">Fica registado com o seu nome.</p>
          </div>
          {erro && <p className="text-sm font-medium text-danger" role="alert">{erro}</p>}
          <button type="button" className="btn btn-danger w-full" disabled={ocupado || motivo.trim().length < 3} onClick={() => correr(() => api.anularLinha(linha.id, motivo))}>Anular este artigo</button>
        </>
      )}
    </div>
  );
}

export function Mesa({ eu }: { eu: Eu }) {
  const id = useSearchParams().get("p") ?? "";
  const router = useRouter();
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [menu, setMenu] = useState<Categoria[] | null>(null);
  const [categoria, setCategoria] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [aEditar, setAEditar] = useState<Linha | null>(null);

  const carregar = useCallback(async () => {
    if (!id) return;
    try {
      setPedido(await api.pedido(id));
    } catch (err) {
      setErro(mensagem(err));
    }
  }, [id]);
  useEffect(() => {
    const t = setTimeout(() => {
      carregar();
      api.menu().then(setMenu).catch((err) => setErro(mensagem(err)));
    }, 0);
    return () => clearTimeout(t);
  }, [carregar]);
  useAoVivo(eu.company_id, carregar);

  const correr = useCallback(async (fn: () => Promise<unknown>) => {
    setOcupado(true);
    setErro(null);
    try {
      await fn();
      await carregar();
    } catch (err) {
      setErro(mensagem(err));
    } finally {
      setOcupado(false);
    }
  }, [carregar]);

  const linhas = useMemo(() => pedido?.linhas ?? [], [pedido]);
  const doCliente = linhas.filter((l) => l.estado === "por_confirmar");
  const activas = linhas.filter((l) => l.estado !== "por_confirmar" && l.estado !== "anulado");
  const prontas = linhas.filter((l) => l.estado === "pronto");
  const anuladas = linhas.filter((l) => l.estado === "anulado" && l.origem === "equipa");

  if (!id) return <p className="text-muted">Pedido em falta.</p>;
  if (!pedido && erro) {
    return (
      <div className="card p-5" role="alert">
        <p>{erro}</p>
        <Link href="/sala" className="btn btn-ghost btn-sm mt-3">Voltar à sala</Link>
      </div>
    );
  }
  if (!pedido) return <Carregar />;

  const emCurso = pedido.estado === "aberto" || pedido.estado === "conta_pedida";
  const vazio = linhas.every((l) => l.estado === "anulado" || l.estado === "por_enviar" || l.estado === "por_confirmar");
  const cat = menu?.find((c) => c.id === categoria) ?? menu?.[0];
  const podeFechar = pedido.total > 0 && pedido.por_enviar === 0 && pedido.por_confirmar === 0;

  return (
    <div className="space-y-4 pb-28">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <Link href="/sala" className="btn btn-ghost btn-sm mt-0.5 px-2" aria-label="Voltar à sala"><ArrowLeft size={18} /></Link>
          <div>
            <h1 className="h-title">{nomeDoPedido(pedido)}</h1>
            <p className="text-sm text-muted">
              {pedido.pessoas ? `${pedido.pessoas} pessoas · ` : ""}aberta às {hora(pedido.aberto_em)}
              {pedido.estado === "conta_pedida" && " · conta pedida"}
            </p>
          </div>
        </div>
        <span className="pill text-sm">{kz(pedido.total)}</span>
      </div>

      {!emCurso && (
        <div className="card p-5">
          <p className="font-display font-bold">{pedido.estado === "fechado" ? `Conta fechada · ${pedido.factura_numero}` : "Pedido anulado"}</p>
          <div className="mt-3 flex flex-wrap items-start gap-2">
            {pedido.estado === "fechado" && <div><BotaoTalao pedido={pedido.id} largura={eu.restaurante?.largura_talao ?? 80} className="btn btn-primary btn-sm" /></div>}
            <Link href="/sala" className="btn btn-ghost btn-sm">Voltar à sala</Link>
          </div>
        </div>
      )}

      {erro && <p className="rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger" role="alert">{erro}</p>}

      {emCurso && pedido.chamada_em && pedido.estado !== "conta_pedida" && (
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-strong px-4 py-3 text-on-strong">
          <p className="font-display text-[15px] font-bold">O cliente chamou o empregado</p>
          <button type="button" className="btn btn-primary btn-sm" disabled={ocupado} onClick={() => correr(() => api.atenderChamada(pedido.id))}>Já fui</button>
        </div>
      )}

      {emCurso && doCliente.length > 0 && (
        <section className="rounded-2xl bg-strong p-4 text-on-strong" aria-label="Pedido do cliente por confirmar">
          <p className="flex items-center gap-2 font-display text-[15px] font-bold"><Smartphone size={17} aria-hidden />Pedido do cliente por confirmar</p>
          <ul className="mt-3 space-y-1.5 text-sm">
            {doCliente.map((l) => (
              <li key={l.id} className="flex justify-between gap-3">
                <span>{quantidade(l.quantidade)} × {l.nome}{l.nota && <span className="block text-xs text-accent">{l.nota}</span>}</span>
                <span className="shrink-0 opacity-80">{kz(l.preco * l.quantidade)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button type="button" className="btn btn-sm border border-white/25 bg-transparent" disabled={ocupado} onClick={() => correr(() => api.responderCliente(pedido.id, false))}>Recusar</button>
            <button type="button" className="btn btn-primary btn-sm" disabled={ocupado} onClick={() => correr(() => api.responderCliente(pedido.id, true))}>Confirmar e enviar</button>
          </div>
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr] lg:items-start">
        {emCurso && pedido.estado === "aberto" && (
          <section aria-label="Menu" className="space-y-3">
            {!menu ? <Carregar texto="A carregar o menu…" /> : menu.length === 0 ? (
              <div className="card p-5 text-[15px] text-muted">O menu está vazio. {eu.papel === "gerente" ? "Monte-o em Gestão › Menu." : "Peça ao gerente para o montar."}</div>
            ) : (
              <>
                <div className="flex gap-1.5 overflow-x-auto" role="tablist" aria-label="Categorias">
                  {menu.map((c) => (
                    <button key={c.id} type="button" role="tab" aria-selected={c.id === cat?.id} onClick={() => setCategoria(c.id)} className={`tab ${c.id === cat?.id ? "tab-on" : ""}`}>{c.nome}</button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {cat?.itens.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      disabled={ocupado || a.esgotado}
                      onClick={() => correr(() => api.adicionar(pedido.id, a.id, 1))}
                      className="card min-h-[72px] p-3 text-left transition hover:border-muted active:scale-[0.98] disabled:opacity-50"
                    >
                      <span className="block text-sm leading-tight font-semibold">{a.nome}</span>
                      <span className="mt-1 block text-xs text-muted">{a.esgotado ? "Esgotado" : kz(a.preco)}</span>
                    </button>
                  ))}
                </div>
                {cat && cat.itens.length === 0 && <p className="text-sm text-muted">Esta categoria ainda não tem artigos.</p>}
              </>
            )}
          </section>
        )}

        <section aria-label="Pedido" className="space-y-3">
          {activas.length === 0 ? (
            emCurso && <p className="card p-5 text-[15px] text-muted">Ainda não há artigos neste pedido. Toque num artigo do menu para o acrescentar.</p>
          ) : (
            <ul className="card divide-y divide-divider px-4">
              {activas.map((l) => (
                <li key={l.id}>
                  <button type="button" disabled={!emCurso} onClick={() => setAEditar(l)} className="flex w-full items-start justify-between gap-3 py-3 text-left">
                    <span className="min-w-0">
                      <span className="block text-[15px] font-medium">{quantidade(l.quantidade)} × {l.nome}</span>
                      {l.nota && <span className="block text-xs text-muted">{l.nota}</span>}
                      {l.origem === "cliente" && <span className="block text-xs text-muted">Pedido pelo cliente</span>}
                    </span>
                    <span className="shrink-0 text-right">
                      <span className={`block text-xs font-bold ${COR_ESTADO[l.estado]}`}>{ESTADO_LINHA[l.estado]}</span>
                      <span className="block text-xs text-muted">{kz(l.preco * l.quantidade)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {emCurso && prontas.length > 0 && (
            <button type="button" className="btn btn-ghost w-full" disabled={ocupado} onClick={() => correr(() => api.avancar(prontas.map((l) => l.id), "servido"))}>
              Marcar {prontas.length === 1 ? "1 artigo pronto como servido" : `${prontas.length} artigos prontos como servidos`}
            </button>
          )}
          {anuladas.length > 0 && (
            <details className="text-sm text-muted">
              <summary className="cursor-pointer">{anuladas.length === 1 ? "1 artigo anulado" : `${anuladas.length} artigos anulados`}</summary>
              <ul className="mt-2 space-y-1">
                {anuladas.map((l) => <li key={l.id}>{quantidade(l.quantidade)} × {l.nome} · {l.anulado_motivo}</li>)}
              </ul>
            </details>
          )}
          {emCurso && vazio && pedido.por_confirmar === 0 && (
            <button type="button" className="btn btn-ghost btn-sm" disabled={ocupado} onClick={() => correr(async () => { await api.cancelarPedido(pedido.id); router.push("/sala"); })}>
              {pedido.tipo === "mesa" ? "Fechar a mesa sem consumo" : "Cancelar esta venda"}
            </button>
          )}
        </section>
      </div>

      {emCurso && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 backdrop-blur">
          <div className="container-x grid grid-cols-2 gap-2 py-3">
            {pedido.por_enviar > 0 ? (
              <>
                <span className="self-center text-sm text-muted">{pedido.por_enviar === 1 ? "1 artigo por enviar" : `${pedido.por_enviar} artigos por enviar`}</span>
                <button type="button" className="btn btn-primary" disabled={ocupado} onClick={() => correr(() => api.enviar(pedido.id))}>Enviar para a cozinha</button>
              </>
            ) : (
              <>
                {pedido.estado === "aberto" && pedido.tipo === "mesa" ? (
                  <button type="button" className="btn btn-ghost" disabled={ocupado || !podeFechar} onClick={() => correr(() => api.pedirConta(pedido.id))}>Pedir conta</button>
                ) : <span />}
                <button type="button" className="btn btn-strong" disabled={ocupado || !podeFechar} onClick={() => router.push(`/conta?p=${pedido.id}`)}>Fechar conta · {kz(pedido.total)}</button>
              </>
            )}
          </div>
        </div>
      )}

      <Folha aberta={!!aEditar} titulo={aEditar ? aEditar.nome : ""} onFechar={() => setAEditar(null)}>
        {aEditar && <EditarLinha key={aEditar.id} linha={aEditar} gerente={eu.papel === "gerente"} onFeito={carregar} onFechar={() => setAEditar(null)} />}
      </Folha>
    </div>
  );
}

export function PaginaMesa() {
  return <Moldura papeis={["gerente", "empregado"]}>{(eu) => <Mesa eu={eu} />}</Moldura>;
}
