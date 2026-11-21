"use client";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { mensagem, publico } from "@/lib/api";
import { ESTADO_LINHA, kz, quantidade } from "@/lib/formato";
import type { Artigo, EstadoPublico, MenuPublico } from "@/lib/tipos";
import { Folha } from "@/components/Folha";

type Carrinho = Record<string, { artigo: Artigo; quantidade: number; nota: string }>;

const ESTADO_CLIENTE: Record<string, string> = {
  por_confirmar: "À espera do empregado",
  enviado: "Em preparação",
  a_preparar: "Em preparação",
  pronto: "Pronto",
  servido: "Servido",
};

function Centro({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-5">
      <div className="max-w-sm text-center">
        <h1 className="h-title">{titulo}</h1>
        <p className="mt-2 text-[15px] text-muted">{texto}</p>
      </div>
    </div>
  );
}

/** Menu que o cliente abre ao ler o QR da mesa: sem aplicação e sem login. */
export function MenuCliente() {
  const codigo = useSearchParams().get("c") ?? "";
  const [menu, setMenu] = useState<MenuPublico | null | undefined>(undefined);
  const [estado, setEstado] = useState<EstadoPublico | null>(null);
  const [categoria, setCategoria] = useState<string | null>(null);
  const [carrinho, setCarrinho] = useState<Carrinho>({});
  const [aVer, setAVer] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const lerEstado = useCallback(async () => {
    if (!codigo) return;
    try {
      setEstado(await publico.estado(codigo));
    } catch {
      /* fica o último estado conhecido */
    }
  }, [codigo]);

  useEffect(() => {
    if (!codigo) return;
    let vivo = true;
    fetch(`/api/menu?c=${encodeURIComponent(codigo)}`)
      .then((r) => r.json())
      .then((j) => vivo && setMenu(j.menu ?? null))
      .catch(() => vivo && setMenu(null));
    const primeiro = setTimeout(lerEstado, 0);
    const id = setInterval(() => document.visibilityState === "visible" && lerEstado(), 10000);
    const visivel = () => document.visibilityState === "visible" && lerEstado();
    document.addEventListener("visibilitychange", visivel);
    return () => {
      vivo = false;
      clearTimeout(primeiro);
      clearInterval(id);
      document.removeEventListener("visibilitychange", visivel);
    };
  }, [codigo, lerEstado]);

  const itens = useMemo(() => Object.values(carrinho), [carrinho]);
  const totalCarrinho = itens.reduce((s, i) => s + i.artigo.preco * i.quantidade, 0);
  const nCarrinho = itens.reduce((s, i) => s + i.quantidade, 0);

  if (!codigo || menu === null) return <Centro titulo="Código inválido" texto="Este código QR já não é válido. Peça ajuda ao empregado." />;
  if (menu === undefined) return <div className="flex min-h-screen items-center justify-center text-sm text-muted" role="status">A abrir o menu…</div>;

  const aberta = estado?.aberta === true;
  const contaPedida = estado?.estado === "conta_pedida";
  const podePedir = menu.pode_pedir && aberta && !contaPedida;
  const cat = menu.categorias.find((c) => c.id === categoria) ?? menu.categorias[0];
  const linhas = estado?.linhas ?? [];

  const mudar = (a: Artigo, delta: number) =>
    setCarrinho((c) => {
      const q = (c[a.id]?.quantidade ?? 0) + delta;
      const novo = { ...c };
      if (q <= 0) delete novo[a.id];
      else novo[a.id] = { artigo: a, quantidade: Math.min(q, 20), nota: c[a.id]?.nota ?? "" };
      return novo;
    });

  async function enviar() {
    setOcupado(true);
    setErro(null);
    try {
      const r = await publico.pedir(codigo, itens.map((i) => ({ item: i.artigo.id, quantidade: i.quantidade, nota: i.nota || undefined })));
      setCarrinho({});
      setAVer(false);
      setAviso(r.confirmacao ? "Pedido enviado. O empregado vai confirmar daqui a pouco." : "Pedido enviado para a cozinha.");
      await lerEstado();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setErro(mensagem(err));
    } finally {
      setOcupado(false);
    }
  }

  async function chamar(tipo: "empregado" | "conta") {
    setOcupado(true);
    setErro(null);
    try {
      await publico.chamar(codigo, tipo);
      setAviso(tipo === "conta" ? "A conta foi pedida. O empregado já vem." : "O empregado foi avisado.");
      await lerEstado();
    } catch (err) {
      setAviso(null);
      setErro(mensagem(err));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="mx-auto min-h-screen w-full max-w-xl px-4 pt-4 pb-32">
      <header className="rounded-2xl bg-strong px-5 py-5 text-on-strong">
        <p className="font-display text-xl leading-tight font-extrabold">{menu.restaurante}</p>
        <p className="mt-0.5 text-sm opacity-80">Mesa {menu.mesa}</p>
      </header>

      {aviso && <p className="mt-3 rounded-xl bg-success-soft px-4 py-3 text-sm font-semibold text-success" role="status">{aviso}</p>}
      {erro && !aVer && <p className="mt-3 rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger" role="alert">{erro}</p>}

      {menu.pode_pedir && estado && !aberta && (
        <p className="mt-3 rounded-xl border border-line bg-surface px-4 py-3 text-sm text-muted">Para pedir pelo telemóvel, peça ao empregado para abrir a mesa. Pode ir vendo o menu.</p>
      )}

      {aberta && linhas.length > 0 && (
        <section className="card mt-3 p-4" aria-label="O que já foi pedido nesta mesa">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-display text-base font-bold">Pedido desta mesa</h2>
            <span className="text-sm font-semibold">{kz(estado?.total)}</span>
          </div>
          <ul className="mt-2 divide-y divide-divider">
            {linhas.map((l, i) => (
              <li key={i} className="flex items-start justify-between gap-3 py-2 text-sm">
                <span>{quantidade(l.quantidade)} × {l.nome}{l.nota && <span className="block text-xs text-muted">{l.nota}</span>}</span>
                <span className={`shrink-0 text-xs font-bold ${l.estado === "pronto" ? "text-success" : l.estado === "por_confirmar" ? "text-accent-text" : "text-muted"}`}>
                  {ESTADO_CLIENTE[l.estado] ?? ESTADO_LINHA[l.estado]}
                </span>
              </li>
            ))}
          </ul>
          {contaPedida ? (
            <p className="mt-3 rounded-lg bg-divider px-3 py-2 text-center text-sm font-semibold">A conta foi pedida. O empregado já vem.</p>
          ) : (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" className="btn btn-ghost btn-sm" disabled={ocupado} onClick={() => chamar("empregado")}>Chamar empregado</button>
              <button type="button" className="btn btn-ghost btn-sm" disabled={ocupado} onClick={() => chamar("conta")}>Pedir a conta</button>
            </div>
          )}
        </section>
      )}
      {aberta && linhas.length === 0 && (
        <button type="button" className="btn btn-ghost btn-sm mt-3" disabled={ocupado} onClick={() => chamar("empregado")}>Chamar empregado</button>
      )}

      {menu.categorias.length === 0 ? (
        <p className="mt-6 text-center text-[15px] text-muted">O menu ainda não está disponível. Peça-o ao empregado.</p>
      ) : (
        <>
          <div className="sticky top-0 z-10 -mx-4 mt-4 flex gap-1.5 overflow-x-auto bg-bg px-4 py-2" role="tablist" aria-label="Categorias">
            {menu.categorias.map((c) => (
              <button key={c.id} type="button" role="tab" aria-selected={c.id === cat?.id} onClick={() => setCategoria(c.id)} className={`tab ${c.id === cat?.id ? "tab-on" : ""}`}>{c.nome}</button>
            ))}
          </div>
          <ul className="mt-2 space-y-2.5">
            {cat?.itens.map((a) => {
              const q = carrinho[a.id]?.quantidade ?? 0;
              return (
                <li key={a.id} className={`card flex items-center gap-3 p-3 ${a.esgotado ? "opacity-55" : ""}`}>
                  {a.foto ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.foto} alt="" loading="lazy" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] leading-tight font-semibold">{a.nome}</p>
                    {a.descricao && <p className="mt-0.5 text-xs leading-snug text-muted">{a.descricao}</p>}
                    <p className="mt-1 text-sm font-bold">{kz(a.preco)}</p>
                  </div>
                  {a.esgotado ? (
                    <span className="pill">Esgotado</span>
                  ) : podePedir ? (
                    q === 0 ? (
                      <button type="button" onClick={() => mudar(a, 1)} aria-label={`Acrescentar ${a.nome}`} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-strong text-on-strong"><Plus size={20} /></button>
                    ) : (
                      <div className="flex shrink-0 items-center rounded-xl border border-line" role="group" aria-label={`Quantidade de ${a.nome}`}>
                        <button type="button" onClick={() => mudar(a, -1)} aria-label="Menos um" className="flex h-11 w-10 items-center justify-center"><Minus size={17} /></button>
                        <output className="w-6 text-center font-display font-bold">{q}</output>
                        <button type="button" onClick={() => mudar(a, 1)} aria-label="Mais um" className="flex h-11 w-10 items-center justify-center"><Plus size={17} /></button>
                      </div>
                    )
                  ) : null}
                </li>
              );
            })}
          </ul>
        </>
      )}

      {nCarrinho > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 p-3 backdrop-blur">
          <button type="button" className="btn btn-primary mx-auto flex w-full max-w-xl justify-between" onClick={() => { setErro(null); setAVer(true); }}>
            <span>Ver pedido · {nCarrinho === 1 ? "1 artigo" : `${nCarrinho} artigos`}</span>
            <span>{kz(totalCarrinho)}</span>
          </button>
        </div>
      )}

      <Folha aberta={aVer} titulo="O seu pedido" onFechar={() => setAVer(false)}>
        <ul className="space-y-4">
          {itens.map((i) => (
            <li key={i.artigo.id}>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[15px] font-semibold">{i.artigo.nome}</span>
                <div className="flex shrink-0 items-center rounded-xl border border-line" role="group" aria-label={`Quantidade de ${i.artigo.nome}`}>
                  <button type="button" onClick={() => mudar(i.artigo, -1)} aria-label="Menos um" className="flex h-10 w-10 items-center justify-center"><Minus size={16} /></button>
                  <output className="w-6 text-center font-display font-bold">{i.quantidade}</output>
                  <button type="button" onClick={() => mudar(i.artigo, 1)} aria-label="Mais um" className="flex h-10 w-10 items-center justify-center"><Plus size={16} /></button>
                </div>
              </div>
              <label className="sr-only" htmlFor={`nota-${i.artigo.id}`}>Nota para {i.artigo.nome}</label>
              <input
                id={`nota-${i.artigo.id}`}
                className="field mt-2 min-h-10 py-2 text-sm"
                placeholder="Alguma indicação? (sem cebola, bem passado…)"
                value={i.nota}
                maxLength={200}
                onChange={(e) => setCarrinho((c) => ({ ...c, [i.artigo.id]: { ...c[i.artigo.id], nota: e.target.value } }))}
              />
            </li>
          ))}
        </ul>
        <div className="mt-5 flex items-baseline justify-between border-t border-divider pt-4">
          <span className="text-sm font-semibold">Total deste pedido</span>
          <span className="font-display text-2xl font-extrabold">{kz(totalCarrinho)}</span>
        </div>
        <p className="mt-1 text-xs text-muted">Paga no fim, ao empregado.</p>
        {erro && <p className="mt-3 rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger" role="alert">{erro}</p>}
        <button type="button" className="btn btn-primary mt-4 w-full" disabled={ocupado || nCarrinho === 0} onClick={enviar}>{ocupado ? "A enviar…" : "Enviar pedido"}</button>
      </Folha>
    </div>
  );
}
