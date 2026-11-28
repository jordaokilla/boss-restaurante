"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, Store } from "lucide-react";
import { escolherCasa, mensagem } from "@/lib/api";
import { opcoesDeCasa } from "@/lib/casas";
import { useSessao } from "@/lib/sessao";
import type { Eu } from "@/lib/tipos";
import { Folha } from "./Folha";

/** Lista dos estabelecimentos em que a pessoa pode trabalhar. Escolher um leva-a ao ecrã dela nesse restaurante. */
export function ListaDeCasas({ eu, onFeito }: { eu: Eu; onFeito?: () => void }) {
  const { recarregar } = useSessao();
  const router = useRouter();
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const actual = eu.casa?.id ?? null;
  const temActual = !!eu.casa || !!eu.restaurante_da_empresa;

  async function escolher(id: string | null) {
    setErro(null);
    setOcupado(id ?? "empresa");
    try {
      await escolherCasa(id);
      await recarregar();
      onFeito?.();
      router.replace("/");
    } catch (err) {
      setErro(mensagem(err));
    } finally {
      setOcupado(null);
    }
  }

  return (
    <div className="space-y-2">
      <ul className="space-y-2">
        {opcoesDeCasa(eu).map((o) => {
          const escolhido = temActual && o.id === actual;
          return (
            <li key={o.id ?? "empresa"}>
              <button
                type="button"
                className="card flex w-full items-center gap-3 p-3.5 text-left disabled:opacity-60"
                disabled={ocupado !== null}
                aria-current={escolhido ? "true" : undefined}
                onClick={() => (escolhido ? onFeito?.() : escolher(o.id))}
              >
                <Store size={18} aria-hidden className="shrink-0 text-muted" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold">{o.nome}</span>
                  {o.nota && <span className="block truncate text-xs text-muted">{o.nota}</span>}
                </span>
                {ocupado === (o.id ?? "empresa") ? <span className="text-xs text-muted">A abrir…</span> : escolhido ? <Check size={18} aria-label="Escolhido" className="shrink-0" /> : null}
              </button>
            </li>
          );
        })}
      </ul>
      {erro && <p className="text-sm font-medium text-danger" role="alert">{erro}</p>}
    </div>
  );
}

/** Botão do cabeçalho: mostra o estabelecimento e abre a lista para mudar. */
export function BotaoCasa({ eu }: { eu: Eu }) {
  const [aberta, setAberta] = useState(false);
  return (
    <>
      <button type="button" className="btn btn-ghost btn-sm min-w-0 shrink" onClick={() => setAberta(true)} aria-label={`Estabelecimento: ${eu.casa?.nome ?? eu.empresa ?? "empresa"}. Mudar`}>
        <Store size={15} aria-hidden className="shrink-0" />
        <span className="hidden max-w-[9rem] truncate sm:inline">Mudar</span>
      </button>
      <Folha aberta={aberta} titulo="Em que estabelecimento está?" onFechar={() => setAberta(false)}>
        <ListaDeCasas eu={eu} onFeito={() => setAberta(false)} />
      </Folha>
    </>
  );
}
