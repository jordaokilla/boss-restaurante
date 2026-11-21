"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, Minus, Plus } from "lucide-react";
import { api, mensagem } from "@/lib/api";
import { BASE_DE_TESTES } from "@/lib/config";
import { supabase } from "@/lib/supabase";
import { FORMA, kz, nomeDoPedido, quantidade } from "@/lib/formato";
import type { Conta as ContaT, Escolha, Eu, Factura, FacturaDoPedido, Forma } from "@/lib/tipos";
import { MAX_PARTES, MIN_PARTES, escreverValor, repartir, type Parte, type Reparticao } from "@/lib/partes";
import { Carregar, Moldura } from "@/components/Moldura";
import { Folha } from "@/components/Folha";
import { BotaoTalao } from "@/components/BotaoTalao";

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

/**
 * Envio à AGT em segundo plano, como na Venda rápida do BOSS: a conta não espera por ele.
 * Se não chegar, a tarefa de reenvio do BOSS volta a tentar e o estado vê-se em Facturas.
 */
function enviarParaAgt(invoiceId: string) {
  if (BASE_DE_TESTES) return;
  supabase().functions.invoke("agt-submit-document", { body: { invoiceId } }).catch((e) => console.error("Envio à AGT", e));
}

const FORMAS = Object.keys(FORMA) as Forma[];
const parteNova = (): Parte => ({ valor: null, forma: null });

/** Divisão do pagamento: quantas pessoas pagam, quanto paga cada uma e como. */
function Dividir({ partes, contas, onMudar }: { partes: Parte[]; contas: Reparticao; onMudar: (p: Parte[]) => void }) {
  const mudar = (i: number, parte: Partial<Parte>) => onMudar(partes.map((p, j) => (j === i ? { ...p, ...parte } : p)));
  const aMao = partes.some((p) => p.valor !== null && p.valor.trim() !== "");
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold" id="quantas">Quantas pessoas pagam</span>
        <div className="flex items-center gap-2" role="group" aria-labelledby="quantas">
          <button type="button" className="btn btn-ghost btn-sm px-2.5" aria-label="Menos uma pessoa" disabled={partes.length <= MIN_PARTES} onClick={() => onMudar(partes.slice(0, -1))}><Minus size={16} aria-hidden /></button>
          <span className="w-8 text-center font-display text-lg font-bold" aria-live="polite">{partes.length}</span>
          <button type="button" className="btn btn-ghost btn-sm px-2.5" aria-label="Mais uma pessoa" disabled={partes.length >= MAX_PARTES} onClick={() => onMudar([...partes, parteNova()])}><Plus size={16} aria-hidden /></button>
        </div>
      </div>
      <ul className="space-y-2">
        {partes.map((parte, i) => {
          const valor = contas.valores[i];
          return (
            <li key={i} className="card p-3.5">
              <div className="flex items-center justify-between gap-3">
                <label className="text-sm font-semibold" htmlFor={`parte-${i}`}>Pessoa {i + 1}</label>
                <div className="flex items-center gap-2">
                  <input
                    id={`parte-${i}`}
                    className="field min-h-10 w-32 py-1.5 text-right"
                    inputMode="decimal"
                    autoComplete="off"
                    value={parte.valor !== null ? parte.valor : valor != null ? escreverValor(valor) : ""}
                    onChange={(e) => mudar(i, { valor: e.target.value })}
                    onBlur={() => parte.valor !== null && parte.valor.trim() === "" && mudar(i, { valor: null })}
                  />
                  <span className="text-sm text-muted">Kz</span>
                </div>
              </div>
              <fieldset className="mt-2.5">
                <legend className="sr-only">Como paga a pessoa {i + 1}</legend>
                <div className="grid grid-cols-3 gap-2">
                  {FORMAS.map((f) => (
                    <label key={f} className={`flex min-h-10 cursor-pointer items-center justify-center rounded-lg border px-1 text-center text-[13px] font-semibold ${parte.forma === f ? "border-strong bg-strong text-on-strong" : "border-line bg-surface"}`}>
                      <input type="radio" name={`forma-${i}`} className="sr-only" checked={parte.forma === f} onChange={() => mudar(i, { forma: f })} />
                      {FORMA[f]}
                    </label>
                  ))}
                </div>
              </fieldset>
            </li>
          );
        })}
      </ul>
      {contas.problema === "invalido" && <p className="rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger" role="alert">Há um valor que não é válido. Escreva só números, acima de zero.</p>}
      {contas.problema === "passa" && <p className="rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger" role="alert">As partes passam o total da conta{contas.diferenca < 0 ? ` em ${kz(-contas.diferenca / 100)}` : ""}.</p>}
      {contas.problema === "falta" && <p className="rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger" role="alert">Faltam {kz(contas.diferenca / 100)} por distribuir.</p>}
      {aMao && <button type="button" className="btn btn-ghost btn-sm" onClick={() => onMudar(partes.map((p) => ({ ...p, valor: null })))}>Repartir por igual</button>}
    </div>
  );
}

type Modo = "uma" | "dividir" | "separadas";
type PorPagar = ContaT["por_pagar"][number];

/** Facturas já emitidas para este pedido, cada uma com o seu talão. */
function Facturas({ facturas, largura }: { facturas: FacturaDoPedido[]; largura: 58 | 80 }) {
  return (
    <ul className="card divide-y divide-divider px-4">
      {facturas.map((f) => (
        <li key={f.id} className="flex items-center justify-between gap-3 py-3">
          <div className="min-w-0">
            <p className="font-mono text-sm">{f.numero}</p>
            <p className="text-sm text-muted">
              {kz(f.total)} · {f.pagamentos.length === 1 ? FORMA[f.pagamentos[0].forma] : `dividida por ${f.pagamentos.length}`}
              {f.cliente && f.cliente.trim().toLowerCase() !== "consumidor final" ? ` · ${f.cliente}` : ""}
            </p>
          </div>
          <div className="shrink-0"><BotaoTalao factura={f.id} largura={largura} className="btn btn-ghost btn-sm" texto="Talão" /></div>
        </li>
      ))}
    </ul>
  );
}

/** Facturas separadas: o que esta pessoa paga, artigo a artigo. */
function Separadas({ linhas, escolha, onMudar }: { linhas: PorPagar[]; escolha: Record<string, number>; onMudar: (e: Record<string, number>) => void }) {
  const por = (l: PorPagar, q: number) => onMudar({ ...escolha, [l.id]: Math.max(0, Math.min(l.quantidade, q)) });
  const tudo = linhas.every((l) => (escolha[l.id] ?? 0) >= l.quantidade);
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold">O que esta pessoa paga</span>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => onMudar(tudo ? {} : Object.fromEntries(linhas.map((l) => [l.id, l.quantidade])))}>
          {tudo ? "Limpar" : "Tudo o que falta"}
        </button>
      </div>
      <ul className="card divide-y divide-divider px-4">
        {linhas.map((l) => {
          const q = escolha[l.id] ?? 0;
          // Uma linha com menos de uma unidade por pagar (meia dose) escolhe-se por inteiro.
          const passo = Math.min(1, l.quantidade);
          return (
            <li key={l.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="text-[15px] font-medium">{l.nome}</p>
                <p className="text-sm text-muted">{kz(l.preco)} cada · {l.quantidade === 1 ? "falta 1" : `faltam ${quantidade(l.quantidade)}`}{l.nota ? ` · ${l.nota}` : ""}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5" role="group" aria-label={`Quantidade de ${l.nome}`}>
                <button type="button" className="btn btn-ghost btn-sm px-2.5" aria-label={`Menos ${l.nome}`} disabled={q <= 0} onClick={() => por(l, q - passo)}><Minus size={16} aria-hidden /></button>
                <span className={`w-8 text-center font-display text-lg font-bold ${q > 0 ? "" : "text-muted"}`} aria-live="polite">{quantidade(q)}</span>
                <button type="button" className="btn btn-ghost btn-sm px-2.5" aria-label={`Mais ${l.nome}`} disabled={q >= l.quantidade} onClick={() => por(l, q + passo)}><Plus size={16} aria-hidden /></button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function Conta({ eu }: { eu: Eu }) {
  const largura = eu.restaurante?.largura_talao ?? 80;
  const id = useSearchParams().get("p") ?? "";
  const [conta, setConta] = useState<ContaT | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [modo, setModo] = useState<Modo>("uma");
  const [forma, setForma] = useState<Forma | null>(null);
  const [partes, setPartes] = useState<Parte[]>([parteNova(), parteNova()]);
  const [escolha, setEscolha] = useState<Record<string, number>>({});
  const [parte, setParte] = useState<{ chave: string; total: number } | null>(null);
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
      // Se a conta mudou entretanto, a escolha não pode passar do que falta pagar.
      setEscolha((actual) => Object.fromEntries(c.por_pagar.filter((l) => (actual[l.id] ?? 0) > 0).map((l) => [l.id, Math.min(actual[l.id], l.quantidade)])));
    } catch (err) {
      setErro(mensagem(err));
    }
  }, [id]);
  useEffect(() => {
    const t = setTimeout(carregar, 0);
    return () => clearTimeout(t);
  }, [carregar]);

  // A parte escolhida: o total calcula-se na base (preços e IVA nunca no aparelho).
  const seleccao: Escolha[] = Object.entries(escolha).filter(([, q]) => q > 0).map(([linha, q]) => ({ linha, quantidade: q }));
  const chave = JSON.stringify(seleccao);
  useEffect(() => {
    if (modo !== "separadas" || seleccao.length === 0) return;
    let vivo = true;
    const t = setTimeout(() => {
      api.conta(id, seleccao)
        .then((c) => vivo && c.parte && setParte({ chave, total: c.parte.total }))
        .catch((err) => vivo && setErro(mensagem(err)));
    }, 250);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modo, chave, id]);

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
          <h1 className="h-title mt-3">{factura.fechado ? "Conta fechada" : "Factura emitida"}</h1>
          <p className="mt-1 text-[15px] text-muted">{nome} · {kz(factura.total)}{factura.pagamentos.length === 1 ? ` · ${FORMA[factura.pagamentos[0].forma]}` : ` · dividida por ${factura.pagamentos.length}`}</p>
          {factura.pagamentos.length > 1 && (
            <ul className="mt-4 divide-y divide-divider rounded-xl border border-line px-4 text-left">
              {factura.pagamentos.map((g, i) => (
                <li key={i} className="flex justify-between gap-3 py-2.5 text-[15px]">
                  <span>Pessoa {i + 1} · {FORMA[g.forma]}</span>
                  <span className="shrink-0 font-semibold">{kz(g.valor)}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 rounded-xl bg-divider px-4 py-3 font-mono text-sm">{factura.factura_numero}</p>
          <p className="mt-3 text-sm text-muted">A Factura-Recibo já está no BOSS, em Facturas. O envio à AGT segue em segundo plano.</p>
          {!factura.fechado && <p className="mt-3 rounded-xl bg-accent-soft px-4 py-3 text-[15px] font-semibold text-accent-text">Falta pagar {kz(factura.falta)}. A mesa continua aberta.</p>}
          <div className="mt-5"><BotaoTalao factura={factura.factura_id} largura={largura} /></div>
          {factura.fechado ? (
            <Link href="/sala" className="btn btn-ghost mt-2 w-full">Voltar à sala</Link>
          ) : (
            <>
              <button
                type="button"
                className="btn btn-strong mt-2 w-full"
                onClick={() => {
                  setFactura(null);
                  setForma(null);
                  setEscolha({});
                  setParte(null);
                  setCliente(conta.cliente);
                  setErro(null);
                  void carregar();
                }}
              >
                Próxima pessoa
              </button>
              <Link href={`/mesa?p=${id}`} className="btn btn-ghost mt-2 w-full">Voltar ao pedido</Link>
            </>
          )}
        </div>
      </div>
    );
  }

  const fechado = conta.pedido.estado === "fechado" || conta.pedido.estado === "anulado";
  const contas = repartir(Math.round(conta.total * 100), partes);
  const totalDaParte = seleccao.length > 0 && parte?.chave === chave ? parte.total : null;
  const pagamentoPronto =
    modo === "dividir" ? contas.problema === null && partes.every((p) => p.forma)
    : modo === "separadas" ? totalDaParte !== null && totalDaParte > 0 && !!forma
    : !!forma;
  const jaPago = conta.facturas.length > 0;

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="flex items-start gap-2">
        <Link href={`/mesa?p=${id}`} className="btn btn-ghost btn-sm mt-0.5 px-2" aria-label="Voltar ao pedido"><ArrowLeft size={18} /></Link>
        <div>
          <h1 className="h-title">Conta · {nome}</h1>
          <p className="text-sm text-muted">{cliente ? `${cliente.nome}${cliente.nif && cliente.nif !== "999999999" ? ` · NIF ${cliente.nif}` : ""}` : "Sem cliente"}</p>
        </div>
      </div>

      {jaPago && (
        <section className="space-y-2" aria-label="Facturas já emitidas">
          <h2 className="text-sm font-semibold">{fechado ? "Facturas desta conta" : `Já pago · ${kz(conta.pedido.pago)}`}</h2>
          <Facturas facturas={conta.facturas} largura={largura} />
        </section>
      )}

      {fechado ? (
        !jaPago && <p className="card p-5 text-[15px] text-muted">{conta.pedido.estado === "fechado" ? "Esta conta já está fechada." : "Este pedido foi anulado."}</p>
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
            <div className="flex items-baseline justify-between pt-1"><dt className="text-sm font-semibold">{jaPago ? "Falta pagar" : "Total"}</dt><dd className="font-display text-3xl font-extrabold">{kz(conta.total)}</dd></div>
          </dl>

          <div className="flex flex-wrap gap-2" role="group" aria-label="Quem paga">
            <button type="button" className={`tab ${modo === "uma" ? "tab-on" : ""}`} aria-pressed={modo === "uma"} onClick={() => setModo("uma")}>Uma pessoa paga</button>
            <button type="button" className={`tab ${modo === "dividir" ? "tab-on" : ""}`} aria-pressed={modo === "dividir"} onClick={() => setModo("dividir")}>Dividir a conta</button>
            <button type="button" className={`tab ${modo === "separadas" ? "tab-on" : ""}`} aria-pressed={modo === "separadas"} onClick={() => setModo("separadas")}>Facturas separadas</button>
          </div>

          {modo === "separadas" && (
            conta.por_pagar.length === 0
              ? <p className="card p-4 text-[15px] text-muted">Ainda não há artigos enviados para facturar.</p>
              : <Separadas linhas={conta.por_pagar} escolha={escolha} onMudar={setEscolha} />
          )}

          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAEscolher(true)}>
            {cliente && cliente.id !== conta.cliente?.id ? "Mudar cliente" : modo === "separadas" ? "Factura com NIF para esta pessoa" : "Factura com NIF"}
          </button>

          {modo === "dividir" ? (
            <Dividir partes={partes} contas={contas} onMudar={setPartes} />
          ) : (
            <fieldset>
              <legend className="field-label">{modo === "separadas" ? "Como paga esta pessoa" : "Como foi pago"}</legend>
              <div className="grid grid-cols-3 gap-2">
                {FORMAS.map((f) => (
                  <label key={f} className={`flex min-h-12 cursor-pointer items-center justify-center rounded-xl border px-2 text-center text-sm font-semibold ${forma === f ? "border-strong bg-strong text-on-strong" : "border-line bg-surface"}`}>
                    <input type="radio" name="forma" className="sr-only" checked={forma === f} onChange={() => setForma(f)} />
                    {FORMA[f]}
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <p className="text-sm text-muted">
            {modo === "separadas"
              ? "Ao confirmar, o BOSS emite uma Factura-Recibo só com o que esta pessoa paga. O resto fica na mesa, para a pessoa seguinte."
              : `Ao confirmar, o BOSS emite a Factura-Recibo certificada, baixa o stock e regista o recebimento. ${modo === "dividir" ? "Sai uma só factura para a conta toda; o que cada pessoa pagou fica no fecho do dia. " : ""}${conta.pedido.tipo === "mesa" ? "A mesa fica livre." : ""}`}
          </p>
          {modo === "dividir" && contas.problema === null && !pagamentoPronto && <p className="text-sm font-medium text-muted">Indique como paga cada pessoa.</p>}
          {erro && <p className="rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger" role="alert">{erro}</p>}
          {!cliente && <p className="rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger" role="alert">A empresa não tem o cliente «Consumidor final» no BOSS. Escolha um cliente para facturar.</p>}

          <button
            type="button"
            className="btn btn-strong w-full"
            disabled={ocupado || !pagamentoPronto || !cliente || conta.total <= 0}
            onClick={async () => {
              setOcupado(true);
              setErro(null);
              try {
                const outro = cliente && cliente.id !== conta.cliente?.id ? cliente.id : null;
                const emitida =
                  modo === "separadas" ? await api.facturarParte(id, seleccao, forma!, outro)
                  : modo === "dividir" ? await api.fecharConta(id, null, outro, partes.map((p, i) => ({ forma: p.forma!, valor: contas.valores[i]! / 100 })))
                  : await api.fecharConta(id, forma, outro);
                setFactura(emitida);
                enviarParaAgt(emitida.invoice_id);
              } catch (err) {
                setErro(mensagem(err));
                // A conta pode ter mudado noutro aparelho: volta a lê-la.
                void carregar();
              } finally {
                setOcupado(false);
              }
            }}
          >
            {ocupado ? "A emitir a factura…"
              : modo === "separadas" ? (seleccao.length === 0 ? "Escolha o que esta pessoa paga" : totalDaParte === null ? "A calcular…" : `Emitir factura desta pessoa · ${kz(totalDaParte)}`)
              : `Emitir factura · ${kz(conta.total)}`}
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
