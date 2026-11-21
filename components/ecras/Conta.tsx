"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { api, mensagem } from "@/lib/api";
import { FORMA, kz, nomeDoPedido, quantidade } from "@/lib/formato";
import type { Conta as ContaT, Eu, Factura, Forma } from "@/lib/tipos";
import { Carregar, Moldura } from "@/components/Moldura";
import { Folha } from "@/components/Folha";

type Cliente = { id: string; nome: string; nif: string };

function EscolherCliente({ onEscolher }: { onEscolher: (c: Cliente) => void }) {
  const [texto, setTexto] = useState("");
  const [lista, setLista] = useState<Cliente[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      if (texto.trim().length < 2) return setLista(null);
      api.clientes(texto).then(setLista).catch((err) => setErro(mensagem(err)));
    }, 300);
    return () => clearTimeout(t);
  }, [texto]);

  return (
    <div className="space-y-3">
      <div>
        <label className="field-label" htmlFor="cl-texto">Nome ou NIF do cliente</label>
        <input id="cl-texto" className="field" value={texto} onChange={(e) => setTexto(e.target.value)} autoFocus />
        <p className="hint">Os clientes são os do BOSS. Um cliente novo cria-se em app.boss.ao, em Clientes.</p>
      </div>
      {erro && <p className="text-sm font-medium text-danger" role="alert">{erro}</p>}
      {lista && lista.length === 0 && <p className="text-sm text-muted">Nenhum cliente com esse nome ou NIF.</p>}
      {lista && lista.length > 0 && (
        <ul className="divide-y divide-divider rounded-xl border border-line">
          {lista.map((c) => (
            <li key={c.id}>
              <button type="button" className="flex w-full items-center justify-between gap-3 px-3.5 py-3 text-left hover:bg-divider" onClick={() => onEscolher(c)}>
                <span className="text-[15px] font-medium">{c.nome}</span>
                <span className="shrink-0 text-xs text-muted">NIF {c.nif}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Conta({ eu }: { eu: Eu }) {
  void eu;
  const id = useSearchParams().get("p") ?? "";
  const [conta, setConta] = useState<ContaT | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [forma, setForma] = useState<Forma | null>(null);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [aEscolher, setAEscolher] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [factura, setFactura] = useState<Factura | null>(null);

  const carregar = useCallback(async () => {
    if (!id) return;
    try {
      const c = await api.conta(id);
      setConta(c);
      setCliente((actual) => actual ?? c.cliente);
    } catch (err) {
      setErro(mensagem(err));
    }
  }, [id]);
  useEffect(() => {
    const t = setTimeout(carregar, 0);
    return () => clearTimeout(t);
  }, [carregar]);

  if (!id) return <p className="text-muted">Pedido em falta.</p>;
  if (!conta && erro) {
    return (
      <div className="card p-5" role="alert">
        <p>{erro}</p>
        <Link href="/sala" className="btn btn-ghost btn-sm mt-3">Voltar à sala</Link>
      </div>
    );
  }
  if (!conta) return <Carregar />;
  const nome = nomeDoPedido(conta.pedido);

  if (factura) {
    return (
      <div className="mx-auto max-w-md">
        <div className="card p-6 text-center">
          <CheckCircle2 size={40} className="mx-auto text-success" aria-hidden />
          <h1 className="h-title mt-3">Conta fechada</h1>
          <p className="mt-1 text-[15px] text-muted">{nome} · {kz(factura.total)} · {forma ? FORMA[forma] : ""}</p>
          <p className="mt-4 rounded-xl bg-divider px-4 py-3 font-mono text-sm">{factura.factura_numero}</p>
          <p className="mt-3 text-sm text-muted">A Factura-Recibo já está no BOSS, em Facturas. O envio à AGT segue em segundo plano.</p>
          <Link href="/sala" className="btn btn-primary mt-5 w-full">Voltar à sala</Link>
        </div>
      </div>
    );
  }

  const fechado = conta.pedido.estado === "fechado" || conta.pedido.estado === "anulado";

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="flex items-start gap-2">
        <Link href={`/mesa?p=${id}`} className="btn btn-ghost btn-sm mt-0.5 px-2" aria-label="Voltar ao pedido"><ArrowLeft size={18} /></Link>
        <div>
          <h1 className="h-title">Conta · {nome}</h1>
          <p className="text-sm text-muted">{cliente ? `${cliente.nome}${cliente.nif && cliente.nif !== "999999999" ? ` · NIF ${cliente.nif}` : ""}` : "Sem cliente"}</p>
        </div>
      </div>

      {fechado ? (
        <p className="card p-5 text-[15px] text-muted">Esta conta já está fechada.</p>
      ) : (
        <>
          <ul className="card divide-y divide-divider px-4">
            {conta.linhas.map((l, i) => (
              <li key={i} className="flex justify-between gap-3 py-3 text-[15px]">
                <span>{quantidade(l.quantidade)} × {l.nome}</span>
                <span className="shrink-0">{kz(l.total)}</span>
              </li>
            ))}
          </ul>
          <dl className="space-y-1 px-1">
            <div className="flex justify-between text-sm text-muted"><dt>Sem IVA</dt><dd>{kz(conta.subtotal)}</dd></div>
            <div className="flex justify-between text-sm text-muted"><dt>IVA</dt><dd>{kz(conta.iva)}</dd></div>
            <div className="flex items-baseline justify-between pt-1"><dt className="text-sm font-semibold">Total</dt><dd className="font-display text-3xl font-extrabold">{kz(conta.total)}</dd></div>
          </dl>

          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAEscolher(true)}>
            {cliente && cliente.id !== conta.cliente?.id ? "Mudar cliente" : "Factura com NIF"}
          </button>

          <fieldset>
            <legend className="field-label">Como foi pago</legend>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(FORMA) as Forma[]).map((f) => (
                <label key={f} className={`flex min-h-12 cursor-pointer items-center justify-center rounded-xl border px-2 text-center text-sm font-semibold ${forma === f ? "border-strong bg-strong text-on-strong" : "border-line bg-surface"}`}>
                  <input type="radio" name="forma" className="sr-only" checked={forma === f} onChange={() => setForma(f)} />
                  {FORMA[f]}
                </label>
              ))}
            </div>
          </fieldset>

          <p className="text-sm text-muted">Ao confirmar, o BOSS emite a Factura-Recibo certificada, baixa o stock e regista o recebimento. {conta.pedido.tipo === "mesa" ? "A mesa fica livre." : ""}</p>
          {erro && <p className="rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger" role="alert">{erro}</p>}
          {!cliente && <p className="rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger" role="alert">A empresa não tem o cliente «Consumidor final» no BOSS. Escolha um cliente para facturar.</p>}

          <button
            type="button"
            className="btn btn-strong w-full"
            disabled={ocupado || !forma || !cliente || conta.total <= 0}
            onClick={async () => {
              setOcupado(true);
              setErro(null);
              try {
                setFactura(await api.fecharConta(id, forma!, cliente && cliente.id !== conta.cliente?.id ? cliente.id : null));
              } catch (err) {
                setErro(mensagem(err));
              } finally {
                setOcupado(false);
              }
            }}
          >
            {ocupado ? "A emitir a factura…" : `Emitir factura · ${kz(conta.total)}`}
          </button>
        </>
      )}

      <Folha aberta={aEscolher} titulo="Cliente da factura" onFechar={() => setAEscolher(false)}>
        {aEscolher && <EscolherCliente onEscolher={(c) => { setCliente(c); setAEscolher(false); }} />}
        {aEscolher && conta.cliente && cliente?.id !== conta.cliente.id && (
          <button type="button" className="btn btn-ghost btn-sm mt-4" onClick={() => { setCliente(conta.cliente); setAEscolher(false); }}>Voltar a Consumidor final</button>
        )}
      </Folha>
    </div>
  );
}

export function PaginaConta() {
  return <Moldura papeis={["gerente", "empregado"]}>{(eu) => <Conta eu={eu} />}</Moldura>;
}
