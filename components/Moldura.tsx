"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { LogOut } from "lucide-react";
import { BASE_DE_TESTES, PLANOS_DO_BOSS } from "@/lib/config";
import { PAPEL } from "@/lib/formato";
import { useSessao } from "@/lib/sessao";
import type { Eu, Papel } from "@/lib/tipos";

export function Carregar({ texto = "A carregar…" }: { texto?: string }) {
  return <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted" role="status">{texto}</div>;
}

export function Aviso({ titulo, texto, children }: { titulo: string; texto: string; children?: React.ReactNode }) {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="card w-full max-w-sm p-6 text-center">
        <h1 className="h-title">{titulo}</h1>
        <p className="mt-2 text-[15px] text-muted">{texto}</p>
        {children && <div className="mt-5 flex flex-col gap-2">{children}</div>}
      </div>
    </div>
  );
}

/** Primeiro ecrã de cada pessoa, conforme o papel. */
export function inicioDe(eu: Eu): string {
  if (eu.papel === "cozinha" || eu.papel === "bar") {
    const e = eu.estacoes.find((x) => x.tipo === eu.papel) ?? eu.estacoes[0];
    return e ? `/estacao?id=${e.id}` : "/";
  }
  return "/sala";
}

function Navegacao({ eu }: { eu: Eu }) {
  const caminho = usePathname();
  const estacaoActual = useSearchParams().get("id");
  const sala = eu.papel === "gerente" || eu.papel === "empregado";
  const itens: { href: string; nome: string; activo: boolean }[] = [];
  if (sala) itens.push({ href: "/sala", nome: "Sala", activo: caminho === "/sala" || caminho === "/mesa" || caminho === "/conta" });
  for (const e of eu.estacoes) {
    if (sala || eu.papel === e.tipo) itens.push({ href: `/estacao?id=${e.id}`, nome: e.nome, activo: caminho === "/estacao" && estacaoActual === e.id });
  }
  if (eu.papel === "gerente") itens.push({ href: "/gestao", nome: "Gestão", activo: caminho.startsWith("/gestao") });
  if (itens.length < 2) return null;
  return (
    <nav aria-label="Principal" className="container-x flex gap-1.5 overflow-x-auto pb-2.5">
      {itens.map((i) => (
        <Link key={i.href} href={i.href} aria-current={i.activo ? "page" : undefined} className={`tab ${i.activo ? "tab-on" : ""}`}>
          {i.nome}
        </Link>
      ))}
    </nav>
  );
}

/**
 * Moldura dos ecrãs da equipa: confere a sessão e o papel, mostra o cabeçalho e a navegação.
 * `papeis` são os papéis que podem abrir o ecrã.
 */
export function Moldura({ papeis, children }: { papeis: Papel[]; children: (eu: Eu) => React.ReactNode }) {
  const { estado, sair, recarregar } = useSessao();
  const router = useRouter();

  // Sem sessão, ou com o segundo factor por confirmar: o ecrã de entrada trata disso.
  const semSessao = estado.fase === "sem_sessao" || estado.fase === "codigo" || estado.fase === "activar_factor";
  const porConfigurar = estado.fase === "pronto" && !estado.eu.activo && estado.eu.gere_empresa;
  useEffect(() => {
    if (semSessao) router.replace("/entrar");
    else if (porConfigurar) router.replace("/configurar");
  }, [semSessao, porConfigurar, router]);

  if (estado.fase === "erro") {
    return (
      <Aviso titulo="Não foi possível carregar" texto={estado.erro}>
        <button type="button" className="btn btn-primary" onClick={recarregar}>Tentar de novo</button>
        <button type="button" className="btn btn-ghost" onClick={sair}>Sair</button>
      </Aviso>
    );
  }
  if (estado.fase !== "pronto" || porConfigurar) return <Carregar />;
  const eu = estado.eu;
  if (!eu.company_id) {
    return (
      <Aviso titulo="Conta sem empresa" texto="Esta conta do BOSS ainda não está ligada a uma empresa.">
        <button type="button" className="btn btn-ghost" onClick={sair}>Sair</button>
      </Aviso>
    );
  }
  if (!eu.activo) {
    return (
      <Aviso
        titulo={eu.ja_configurado ? "Restaurante desligado" : "Restaurante por ligar"}
        texto={eu.ja_configurado
          ? `O BOSS Restaurante está desligado em ${eu.empresa}. O dono ou um gestor da empresa pode voltar a ligá-lo.`
          : `O restaurante ainda não está ligado em ${eu.empresa}. Peça ao dono ou a um gestor da empresa para o ligar.`}
      >
        <button type="button" className="btn btn-ghost" onClick={sair}>Sair</button>
      </Aviso>
    );
  }
  if (!eu.papel) {
    return (
      <Aviso titulo="Sem acesso ao restaurante" texto="A sua conta ainda não tem um papel no restaurante. Peça ao gerente para lho atribuir em Gestão › Equipa.">
        <button type="button" className="btn btn-ghost" onClick={sair}>Sair</button>
      </Aviso>
    );
  }
  if (!papeis.includes(eu.papel)) {
    return (
      <Aviso titulo="Este ecrã não é para o seu papel" texto={`A sua conta entra como ${PAPEL[eu.papel].toLowerCase()}.`}>
        <Link href={inicioDe(eu)} className="btn btn-primary">Ir para o meu ecrã</Link>
      </Aviso>
    );
  }

  return (
    <>
      {BASE_DE_TESTES && (
        <p className="bg-strong px-4 py-1 text-center text-xs font-semibold text-on-strong">Base de testes · as facturas aqui não são reais</p>
      )}
      {eu.demonstracao && (
        <p className="bg-strong px-4 py-1 text-center text-xs font-semibold text-on-strong print:hidden">Demonstração · restaurante e dados de exemplo</p>
      )}
      <header className="sticky top-0 z-30 border-b border-line bg-surface print:hidden">
        <div className="container-x flex h-14 items-center justify-between gap-3">
          <Link href={inicioDe(eu)} className="flex min-w-0 items-center gap-2.5">
            <Image src="/boss.png" alt="BOSS" width={96} height={96} className="h-8 w-8 rounded-lg" />
            <span className="min-w-0">
              <span className="block truncate font-display text-[15px] leading-tight font-bold">{eu.restaurante?.nome ?? "Restaurante"}</span>
              <span className="block truncate text-xs leading-tight text-muted">{eu.nome} · {PAPEL[eu.papel]}</span>
            </span>
          </Link>
          <button type="button" onClick={sair} className="btn btn-ghost btn-sm shrink-0" aria-label="Sair da conta">
            <LogOut size={15} aria-hidden />
            <span className="hidden sm:inline">Sair</span>
          </button>
        </div>
        <Navegacao eu={eu} />
      </header>
      {eu.modulo === "suspenso" && (
        <div className="border-b border-line bg-danger-soft print:hidden" role="status">
          <p className="container-x py-2.5 text-sm font-medium text-danger">
            O plano da empresa já não inclui o BOSS Restaurante. Pode fechar as contas abertas, mas não abrir novas.{" "}
            {eu.gere_empresa ? <a className="font-bold underline" href={PLANOS_DO_BOSS}>Renovar ou subir de plano</a> : "Fale com o dono ou um gestor da empresa."}
          </p>
        </div>
      )}
      <main className="container-x flex-1 py-5">{children(eu)}</main>
    </>
  );
}
