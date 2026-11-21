"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";
import { ENDERECO_PUBLICO } from "@/lib/config";
import { api, mensagem, tabela, desligarRestaurante } from "@/lib/api";
import { FORMA, kz, PAPEL } from "@/lib/formato";
import { useSessao } from "@/lib/sessao";
import type { Estacao, Eu, Forma, Papel } from "@/lib/tipos";
import { Carregar, Moldura } from "@/components/Moldura";
import { Folha } from "@/components/Folha";

const SEPARADORES = [
  { id: "mesas", nome: "Mesas" },
  { id: "menu", nome: "Menu" },
  { id: "equipa", nome: "Equipa" },
  { id: "definicoes", nome: "Definições" },
  { id: "fecho", nome: "Fecho do dia" },
] as const;

function Erro({ texto }: { texto: string | null }) {
  return texto ? <p className="rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger" role="alert">{texto}</p> : null;
}

function Interruptor({ ligado, onMudar, rotulo, desligado }: { ligado: boolean; onMudar: (v: boolean) => void; rotulo: string; desligado?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ligado}
      aria-label={rotulo}
      disabled={desligado}
      onClick={() => onMudar(!ligado)}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition disabled:opacity-50 ${ligado ? "border-accent bg-accent" : "border-line bg-divider"}`}
    >
      <span className={`inline-block h-5 w-5 rounded-full bg-surface shadow transition ${ligado ? "translate-x-6" : "translate-x-1"}`} />
    </button>
  );
}

/** Endereço que o QR de uma mesa abre. */
export const enderecoDaMesa = (codigo: string) => `${ENDERECO_PUBLICO ?? (typeof window === "undefined" ? "" : window.location.origin)}/m?c=${codigo}`;

export function ImagemQR({ codigo, tamanho = 220 }: { codigo: string; tamanho?: number }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    QRCode.toDataURL(enderecoDaMesa(codigo), { margin: 1, width: tamanho * 2, errorCorrectionLevel: "M" }).then((u) => vivo && setSrc(u)).catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [codigo, tamanho]);
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img src={src} alt="Código QR da mesa" width={tamanho} height={tamanho} className="rounded-lg bg-white p-1" /> : <div style={{ width: tamanho, height: tamanho }} className="animate-pulse rounded-lg bg-divider" />;
}

// ------------------------------------------------------------------ Mesas

interface Area { id: string; nome: string; ordem: number }
interface MesaRow { id: string; area_id: string; nome: string; lugares: number; codigo: string; activa: boolean; ordem: number }

function Mesas({ eu }: { eu: Eu }) {
  const [areas, setAreas] = useState<Area[] | null>(null);
  const [mesas, setMesas] = useState<MesaRow[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [novaArea, setNovaArea] = useState("");
  const [nova, setNova] = useState<Record<string, { nome: string; lugares: string }>>({});
  const [qr, setQr] = useState<MesaRow | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const carregar = useCallback(async () => {
    const [a, m] = await Promise.all([tabela("areas").select("*").order("ordem").order("nome"), tabela("mesas").select("*").order("ordem").order("nome")]);
    if (a.error || m.error) return setErro(mensagem(a.error ?? m.error));
    setAreas(a.data as Area[]);
    setMesas(m.data as MesaRow[]);
  }, []);
  useEffect(() => {
    const t = setTimeout(carregar, 0);
    return () => clearTimeout(t);
  }, [carregar]);

  async function correr(fn: () => PromiseLike<{ error: unknown }>) {
    setOcupado(true);
    setErro(null);
    const { error } = await fn();
    setOcupado(false);
    if (error) setErro(/duplicate|unique/i.test(mensagem(error)) ? "Já existe uma com esse nome." : mensagem(error));
    else await carregar();
  }

  if (!areas) return erro ? <Erro texto={erro} /> : <Carregar />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-muted">Cada mesa tem um código QR próprio. O cliente lê-o com a câmara do telemóvel para ver o menu e pedir.</p>
        {mesas.length > 0 && <Link href="/gestao/qr" className="btn btn-ghost btn-sm">Imprimir os códigos QR</Link>}
      </div>
      <Erro texto={erro} />
      {areas.map((a) => {
        const lista = mesas.filter((m) => m.area_id === a.id);
        const n = nova[a.id] ?? { nome: "", lugares: "4" };
        return (
          <section key={a.id} className="card p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-base font-bold">{a.nome}</h2>
              {lista.length === 0 && areas.length > 1 && (
                <button type="button" className="btn btn-ghost btn-sm" disabled={ocupado} onClick={() => correr(() => tabela("areas").delete().eq("id", a.id))}>Apagar sala</button>
              )}
            </div>
            {lista.length === 0 ? <p className="mt-2 text-sm text-muted">Sem mesas.</p> : (
              <ul className="mt-3 divide-y divide-divider">
                {lista.map((m) => (
                  <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <span className="text-[15px]"><strong>Mesa {m.nome}</strong> <span className="text-muted">· {m.lugares} lugares{!m.activa && " · desligada"}</span></span>
                    <span className="flex gap-1.5">
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setQr(m)}>QR</button>
                      <button type="button" className="btn btn-ghost btn-sm" disabled={ocupado} onClick={() => correr(() => tabela("mesas").update({ activa: !m.activa }).eq("id", m.id))}>{m.activa ? "Desligar" : "Ligar"}</button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <form
              className="mt-3 flex flex-wrap items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!n.nome.trim()) return;
                correr(() => tabela("mesas").insert({ company_id: eu.company_id, area_id: a.id, nome: n.nome.trim(), lugares: Math.min(Math.max(Number.parseInt(n.lugares, 10) || 4, 1), 99), ordem: lista.length + 1 }))
                  .then(() => setNova((v) => ({ ...v, [a.id]: { nome: "", lugares: n.lugares } })));
              }}
            >
              <div className="w-28">
                <label className="field-label" htmlFor={`m-nome-${a.id}`}>Mesa</label>
                <input id={`m-nome-${a.id}`} className="field" placeholder="N.º" value={n.nome} onChange={(e) => setNova((v) => ({ ...v, [a.id]: { ...n, nome: e.target.value } }))} maxLength={12} />
              </div>
              <div className="w-24">
                <label className="field-label" htmlFor={`m-lug-${a.id}`}>Lugares</label>
                <input id={`m-lug-${a.id}`} className="field" type="number" min={1} max={99} value={n.lugares} onChange={(e) => setNova((v) => ({ ...v, [a.id]: { ...n, lugares: e.target.value } }))} />
              </div>
              <button type="submit" className="btn btn-primary" disabled={ocupado || !n.nome.trim()}>Acrescentar</button>
            </form>
          </section>
        );
      })}
      <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); if (novaArea.trim()) correr(() => tabela("areas").insert({ company_id: eu.company_id, nome: novaArea.trim(), ordem: areas.length + 1 })).then(() => setNovaArea("")); }}>
        <div className="w-56">
          <label className="field-label" htmlFor="nova-area">Nova sala</label>
          <input id="nova-area" className="field" placeholder="Esplanada, Balcão…" value={novaArea} onChange={(e) => setNovaArea(e.target.value)} maxLength={40} />
        </div>
        <button type="submit" className="btn btn-ghost" disabled={ocupado || !novaArea.trim()}>Criar sala</button>
      </form>

      <Folha aberta={!!qr} titulo={qr ? `Mesa ${qr.nome}` : ""} onFechar={() => setQr(null)}>
        {qr && (
          <div className="space-y-4 text-center">
            <div className="flex justify-center"><ImagemQR codigo={qr.codigo} /></div>
            <p className="text-xs break-all text-muted">{enderecoDaMesa(qr.codigo)}</p>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={ocupado}
              onClick={() => {
                if (!window.confirm("Trocar o código desta mesa? O QR impresso deixa de funcionar e é preciso imprimir o novo.")) return;
                const bytes = crypto.getRandomValues(new Uint8Array(12));
                const codigo = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
                correr(() => tabela("mesas").update({ codigo }).eq("id", qr.id)).then(() => setQr(null));
              }}
            >
              Trocar o código
            </button>
          </div>
        )}
      </Folha>
    </div>
  );
}

// ------------------------------------------------------------------- Menu

interface CatRow { id: string; nome: string; estacao_id: string | null; ordem: number }
interface ItemRow { id: string; product_id: string; categoria_id: string; descricao: string | null; visivel: boolean; esgotado: boolean; ordem: number }
type ProdutoBoss = { product_id: string; nome: string; categoria: string | null; foto: string | null; preco: number };

function Menu({ eu }: { eu: Eu }) {
  const [cats, setCats] = useState<CatRow[] | null>(null);
  const [itens, setItens] = useState<ItemRow[]>([]);
  const [nomes, setNomes] = useState<Record<string, { nome: string; preco: number }>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [novaCat, setNovaCat] = useState({ nome: "", estacao: eu.estacoes[0]?.id ?? "" });
  const [aJuntar, setAJuntar] = useState<CatRow | null>(null);
  const [produtos, setProdutos] = useState<ProdutoBoss[] | null>(null);
  const [procura, setProcura] = useState("");

  const carregar = useCallback(async () => {
    const [c, i, m] = await Promise.all([
      tabela("menu_categorias").select("*").order("ordem").order("nome"),
      tabela("menu_itens").select("*").order("ordem"),
      api.menu().catch(() => []),
    ]);
    if (c.error || i.error) return setErro(mensagem(c.error ?? i.error));
    setCats(c.data as CatRow[]);
    setItens(i.data as ItemRow[]);
    setNomes(Object.fromEntries(m.flatMap((x) => x.itens).map((a) => [a.id, { nome: a.nome, preco: a.preco }])));
  }, []);
  useEffect(() => {
    const t = setTimeout(carregar, 0);
    return () => clearTimeout(t);
  }, [carregar]);

  async function correr(fn: () => PromiseLike<{ error: unknown }>) {
    setOcupado(true);
    setErro(null);
    const { error } = await fn();
    setOcupado(false);
    if (error) setErro(/duplicate|unique/i.test(mensagem(error)) ? "Já existe com esse nome." : mensagem(error));
    else await carregar();
  }

  async function abrirJuntar(c: CatRow) {
    setAJuntar(c);
    setProcura("");
    setProdutos(null);
    try {
      setProdutos(await api.produtosBoss());
    } catch (err) {
      setErro(mensagem(err));
    }
  }

  if (!cats) return erro ? <Erro texto={erro} /> : <Carregar />;
  const estacaoDe = (id: string | null) => eu.estacoes.find((e) => e.id === id)?.nome ?? "Sem estação";
  const filtrados = (produtos ?? []).filter((p) => !procura.trim() || p.nome.toLowerCase().includes(procura.trim().toLowerCase()));

  return (
    <div className="space-y-5">
      <p className="max-w-xl text-sm text-muted">
        O menu é feito com os produtos que a empresa já tem no BOSS: o nome, o preço e a fotografia vêm de lá. Aqui escolhe o que aparece,
        em que categoria e para onde vai cada pedido (cozinha ou bar).
      </p>
      <Erro texto={erro} />
      {cats.length === 0 && <p className="card p-5 text-[15px] text-muted">Comece por criar uma categoria (Pratos, Bebidas…) e depois junte-lhe produtos do BOSS.</p>}
      {cats.map((c) => {
        const lista = itens.filter((i) => i.categoria_id === c.id);
        return (
          <section key={c.id} className="card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-base font-bold">{c.nome} <span className="text-sm font-normal text-muted">· vai para {estacaoDe(c.estacao_id)}</span></h2>
              <span className="flex gap-1.5">
                <button type="button" className="btn btn-primary btn-sm" onClick={() => abrirJuntar(c)}>Juntar produtos</button>
                {lista.length === 0 && <button type="button" className="btn btn-ghost btn-sm" disabled={ocupado} onClick={() => correr(() => tabela("menu_categorias").delete().eq("id", c.id))}>Apagar</button>}
              </span>
            </div>
            {lista.length === 0 ? <p className="mt-2 text-sm text-muted">Sem artigos.</p> : (
              <ul className="mt-3 divide-y divide-divider">
                {lista.map((i) => (
                  <li key={i.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2.5">
                    <span className="min-w-0 text-[15px]"><strong className="font-semibold">{nomes[i.id]?.nome ?? "…"}</strong> <span className="text-muted">· {kz(nomes[i.id]?.preco)}</span></span>
                    <span className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted">
                      <span className="inline-flex items-center gap-2">No menu do cliente<Interruptor ligado={i.visivel} rotulo={`Mostrar ${nomes[i.id]?.nome ?? "artigo"} no menu do cliente`} desligado={ocupado} onMudar={(v) => correr(() => tabela("menu_itens").update({ visivel: v }).eq("id", i.id))} /></span>
                      <span className="inline-flex items-center gap-2">Esgotado<Interruptor ligado={i.esgotado} rotulo={`Marcar ${nomes[i.id]?.nome ?? "artigo"} como esgotado`} desligado={ocupado} onMudar={(v) => correr(() => tabela("menu_itens").update({ esgotado: v }).eq("id", i.id))} /></span>
                      <button type="button" className="btn btn-ghost btn-sm" disabled={ocupado} onClick={() => correr(() => tabela("menu_itens").delete().eq("id", i.id))}>Tirar</button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!novaCat.nome.trim()) return;
          correr(() => tabela("menu_categorias").insert({ company_id: eu.company_id, nome: novaCat.nome.trim(), estacao_id: novaCat.estacao || null, ordem: cats.length + 1 }))
            .then(() => setNovaCat((v) => ({ ...v, nome: "" })));
        }}
      >
        <div className="w-48">
          <label className="field-label" htmlFor="nc-nome">Nova categoria</label>
          <input id="nc-nome" className="field" placeholder="Pratos, Bebidas…" value={novaCat.nome} onChange={(e) => setNovaCat((v) => ({ ...v, nome: e.target.value }))} maxLength={40} />
        </div>
        <div className="w-40">
          <label className="field-label" htmlFor="nc-est">Os pedidos vão para</label>
          <select id="nc-est" className="field" value={novaCat.estacao} onChange={(e) => setNovaCat((v) => ({ ...v, estacao: e.target.value }))}>
            {eu.estacoes.map((e: Estacao) => <option key={e.id} value={e.id}>{e.nome}</option>)}
          </select>
        </div>
        <button type="submit" className="btn btn-ghost" disabled={ocupado || !novaCat.nome.trim()}>Criar categoria</button>
      </form>

      <Folha aberta={!!aJuntar} titulo={aJuntar ? `Juntar a ${aJuntar.nome}` : ""} onFechar={() => setAJuntar(null)}>
        {aJuntar && (
          <div className="space-y-3">
            <label className="sr-only" htmlFor="pb-procura">Procurar produto</label>
            <input id="pb-procura" className="field" placeholder="Procurar produto do BOSS" value={procura} onChange={(e) => setProcura(e.target.value)} />
            {!produtos ? <Carregar texto="A ler o catálogo do BOSS…" /> : filtrados.length === 0 ? (
              <p className="text-sm text-muted">{produtos.length === 0 ? "Todos os produtos do BOSS já estão no menu. Crie produtos novos em app.boss.ao, em Produtos e serviços." : "Nenhum produto com esse nome."}</p>
            ) : (
              <ul className="divide-y divide-divider rounded-xl border border-line">
                {filtrados.map((p) => (
                  <li key={p.product_id}>
                    <button
                      type="button"
                      disabled={ocupado}
                      className="flex w-full items-center justify-between gap-3 px-3.5 py-3 text-left hover:bg-divider disabled:opacity-50"
                      onClick={async () => {
                        await correr(() => tabela("menu_itens").insert({ company_id: eu.company_id, product_id: p.product_id, categoria_id: aJuntar.id, ordem: itens.length + 1 }));
                        setProdutos((v) => v?.filter((x) => x.product_id !== p.product_id) ?? null);
                      }}
                    >
                      <span className="text-[15px] font-medium">{p.nome}{p.categoria && <span className="block text-xs font-normal text-muted">{p.categoria}</span>}</span>
                      <span className="shrink-0 text-sm text-muted">{kz(p.preco)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Folha>
    </div>
  );
}

// ----------------------------------------------------------------- Equipa

function Equipa({ eu }: { eu: Eu }) {
  const [lista, setLista] = useState<Awaited<ReturnType<typeof api.equipa>> | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const carregar = useCallback(async () => {
    try {
      setLista(await api.equipa());
    } catch (err) {
      setErro(mensagem(err));
    }
  }, []);
  useEffect(() => {
    const t = setTimeout(carregar, 0);
    return () => clearTimeout(t);
  }, [carregar]);

  async function mudar(userId: string, papel: string) {
    setOcupado(true);
    setErro(null);
    const { error } = papel === ""
      ? await tabela("equipa").delete().eq("company_id", eu.company_id).eq("user_id", userId)
      : await tabela("equipa").upsert({ company_id: eu.company_id, user_id: userId, papel, activo: true }, { onConflict: "company_id,user_id" });
    setOcupado(false);
    if (error) setErro(mensagem(error));
    else await carregar();
  }

  if (!lista) return erro ? <Erro texto={erro} /> : <Carregar />;
  return (
    <div className="space-y-4">
      <p className="max-w-xl text-sm text-muted">
        As pessoas são as contas da empresa no BOSS. Aqui escolhe o que cada uma faz no restaurante. Para criar uma conta nova,
        convide a pessoa em app.boss.ao.
      </p>
      <Erro texto={erro} />
      <ul className="card divide-y divide-divider px-4">
        {lista.map((p) => (
          <li key={p.user_id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-semibold">{p.nome}</span>
              <span className="block truncate text-xs text-muted">{p.email}</span>
            </span>
            {p.gere_empresa ? (
              <span className="pill">Gerente · gere a empresa no BOSS</span>
            ) : (
              <>
                <label className="sr-only" htmlFor={`papel-${p.user_id}`}>Papel de {p.nome}</label>
                <select id={`papel-${p.user_id}`} className="field w-auto min-w-44" disabled={ocupado} value={p.papel ?? ""} onChange={(e) => mudar(p.user_id, e.target.value)}>
                  <option value="">Sem acesso</option>
                  {(Object.keys(PAPEL) as Papel[]).map((k) => <option key={k} value={k}>{PAPEL[k]}</option>)}
                </select>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ------------------------------------------------------------- Definições

function Definicoes({ eu }: { eu: Eu }) {
  const { recarregar } = useSessao();
  const r = eu.restaurante!;
  const [nome, setNome] = useState(r.nome);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function gravar(patch: Record<string, unknown>) {
    setOcupado(true);
    setErro(null);
    const { error } = await tabela("definicoes").update(patch).eq("company_id", eu.company_id);
    setOcupado(false);
    if (error) setErro(mensagem(error));
    else await recarregar();
  }

  const linha = (titulo: string, texto: string, ligado: boolean, campo: string) => (
    <div className="flex items-center justify-between gap-4 py-4">
      <span>
        <span className="block text-[15px] font-semibold">{titulo}</span>
        <span className="mt-0.5 block text-sm text-muted">{texto}</span>
      </span>
      <Interruptor ligado={ligado} rotulo={titulo} desligado={ocupado} onMudar={(v) => gravar({ [campo]: v })} />
    </div>
  );

  return (
    <div className="max-w-xl space-y-4">
      <Erro texto={erro} />
      <form className="card flex flex-wrap items-end gap-2 p-4" onSubmit={(e) => { e.preventDefault(); if (nome.trim()) gravar({ nome: nome.trim() }); }}>
        <div className="min-w-0 flex-1">
          <label className="field-label" htmlFor="d-nome">Nome do restaurante</label>
          <input id="d-nome" className="field" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={80} />
        </div>
        <button type="submit" className="btn btn-primary" disabled={ocupado || !nome.trim() || nome.trim() === r.nome}>Guardar</button>
      </form>
      <div className="card divide-y divide-divider px-4">
        {linha("O cliente pode pedir pelo telemóvel", "Desligado, o QR mostra só o menu.", r.cliente_pode_pedir, "cliente_pode_pedir")}
        {linha("Pedidos do cliente vão directos para a cozinha", "Desligado, o empregado confirma cada pedido antes. Ligue só se confiar no uso que os clientes fazem do QR.", r.pedidos_directos, "pedidos_directos")}
      </div>
      <fieldset className="card p-4">
        <legend className="field-label float-left">Largura do talão</legend>
        <div className="clear-both grid grid-cols-2 gap-2 pt-2">
          {[80, 58].map((w) => (
            <label key={w} className={`flex min-h-12 cursor-pointer items-center justify-center rounded-xl border text-sm font-semibold ${r.largura_talao === w ? "border-strong bg-strong text-on-strong" : "border-line"}`}>
              <input type="radio" name="largura" className="sr-only" checked={r.largura_talao === w} disabled={ocupado} onChange={() => gravar({ largura_talao: w })} />
              {w} mm
            </label>
          ))}
        </div>
      </fieldset>
      {eu.gere_empresa && <Desligar />}
    </div>
  );
}

/** Desliga o módulo Restaurante na empresa (dono ou gestor). Os dados ficam guardados. */
function Desligar() {
  const { recarregar } = useSessao();
  const [aConfirmar, setAConfirmar] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  return (
    <div className="card p-4">
      <p className="text-[15px] font-semibold">Desligar o BOSS Restaurante</p>
      <p className="mt-0.5 text-sm text-muted">
        A equipa deixa de entrar e os QR das mesas deixam de responder. Mesas, menu, equipa e vendas ficam guardados e voltam se o ligar outra vez.
        As facturas já emitidas continuam no BOSS.
      </p>
      <Erro texto={erro} />
      {aConfirmar ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-danger btn-sm"
            disabled={ocupado}
            onClick={async () => {
              setOcupado(true);
              setErro(null);
              try {
                await desligarRestaurante();
                await recarregar();
              } catch (err) {
                setErro(mensagem(err));
                setOcupado(false);
              }
            }}
          >
            {ocupado ? "A desligar…" : "Sim, desligar"}
          </button>
          <button type="button" className="btn btn-ghost btn-sm" disabled={ocupado} onClick={() => setAConfirmar(false)}>Cancelar</button>
        </div>
      ) : (
        <button type="button" className="btn btn-ghost btn-sm mt-3" onClick={() => setAConfirmar(true)}>Desligar o restaurante</button>
      )}
    </div>
  );
}

// ---------------------------------------------------------- Fecho do dia

function Fecho() {
  const [dia, setDia] = useState("");
  const [dados, setDados] = useState<Awaited<ReturnType<typeof api.fechoDoDia>> | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    const t = setTimeout(() => {
      api.fechoDoDia(dia || undefined).then((d) => vivo && setDados(d)).catch((err) => vivo && setErro(mensagem(err)));
    }, 0);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [dia]);

  if (!dados) return erro ? <Erro texto={erro} /> : <Carregar />;
  return (
    <div className="max-w-xl space-y-4">
      <div className="w-48">
        <label className="field-label" htmlFor="f-dia">Dia</label>
        <input id="f-dia" className="field" type="date" value={dia || dados.dia} onChange={(e) => setDia(e.target.value)} />
      </div>
      <Erro texto={erro} />
      <div className="grid grid-cols-2 gap-3">
        <div className="card p-4"><p className="text-xs font-bold tracking-wider text-muted uppercase">Total facturado</p><p className="mt-1 font-display text-2xl font-extrabold">{kz(dados.total)}</p></div>
        <div className="card p-4"><p className="text-xs font-bold tracking-wider text-muted uppercase">Contas fechadas</p><p className="mt-1 font-display text-2xl font-extrabold">{dados.contas}</p>{dados.facturas !== dados.contas && <p className="text-xs text-muted">{dados.facturas === 1 ? "1 factura" : `${dados.facturas} facturas`}</p>}</div>
      </div>
      <ul className="card divide-y divide-divider px-4">
        {(Object.keys(FORMA) as Forma[]).map((f) => (
          <li key={f} className="flex justify-between py-3 text-[15px]"><span>{FORMA[f]}</span><span className="font-semibold">{kz(dados.por_forma[f] ?? 0)}</span></li>
        ))}
      </ul>
      <p className="text-sm text-muted">{dados.anulacoes === 0 ? "Sem artigos anulados neste dia." : dados.anulacoes === 1 ? "1 artigo anulado neste dia." : `${dados.anulacoes} artigos anulados neste dia.`}{dados.divididas === 1 ? " 1 conta foi dividida." : dados.divididas > 1 ? ` ${dados.divididas} contas foram divididas.` : ""}{dados.separadas === 1 ? " 1 conta teve facturas separadas." : dados.separadas > 1 ? ` ${dados.separadas} contas tiveram facturas separadas.` : ""} As facturas estão no BOSS, em Facturas.</p>
    </div>
  );
}

export function Gestao({ eu }: { eu: Eu }) {
  const t = useSearchParams().get("t") ?? "mesas";
  const router = useRouter();
  return (
    <div className="space-y-5">
      <h1 className="h-title">Gestão</h1>
      <div className="flex gap-1.5 overflow-x-auto" role="tablist" aria-label="Áreas da gestão">
        {SEPARADORES.map((s) => (
          <button key={s.id} type="button" role="tab" aria-selected={t === s.id} onClick={() => router.replace(`/gestao?t=${s.id}`)} className={`tab ${t === s.id ? "tab-on" : ""}`}>{s.nome}</button>
        ))}
      </div>
      {t === "menu" ? <Menu eu={eu} /> : t === "equipa" ? <Equipa eu={eu} /> : t === "definicoes" ? <Definicoes eu={eu} /> : t === "fecho" ? <Fecho /> : <Mesas eu={eu} />}
    </div>
  );
}

export function PaginaGestao() {
  return <Moldura papeis={["gerente"]}>{(eu) => <Gestao eu={eu} />}</Moldura>;
}

/** Folha para imprimir: um cartão com o QR por mesa. */
export function FolhaQR({ eu }: { eu: Eu }) {
  const [mesas, setMesas] = useState<MesaRow[] | null>(null);
  useEffect(() => {
    let vivo = true;
    tabela("mesas").select("*").eq("activa", true).order("ordem").order("nome").then(({ data }) => vivo && setMesas((data as MesaRow[]) ?? []));
    return () => {
      vivo = false;
    };
  }, []);
  if (!mesas) return <Carregar />;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="h-title">Códigos QR das mesas</h1>
          <p className="text-sm text-muted">Imprima, recorte e ponha um em cada mesa.</p>
        </div>
        <span className="flex gap-2">
          <Link href="/gestao" className="btn btn-ghost">Voltar</Link>
          <button type="button" className="btn btn-primary" onClick={() => window.print()}>Imprimir</button>
        </span>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 print:grid-cols-3">
        {mesas.map((m) => (
          <div key={m.id} className="flex break-inside-avoid flex-col items-center gap-2 rounded-2xl border border-line bg-white p-4 text-center text-black">
            <p className="font-display text-sm font-bold">{eu.restaurante?.nome}</p>
            <p className="font-display text-2xl font-extrabold">Mesa {m.nome}</p>
            <ImagemQR codigo={m.codigo} tamanho={170} />
            <p className="text-xs">Leia o código para ver o menu e fazer o seu pedido</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PaginaQR() {
  return <Moldura papeis={["gerente"]}>{(eu) => <FolhaQR eu={eu} />}</Moldura>;
}
