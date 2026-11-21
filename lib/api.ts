"use client";
import { supabase, supabasePublico } from "./supabase";
import type { Categoria, Conta, Escolha, EstadoPublico, Eu, Factura, Forma, MenuPublico, Pagamento, Pedido, Sala, Talao } from "./tipos";

/** Mensagem para a pessoa: a da base (já em português) ou uma genérica quando a falha é de rede. */
export function mensagem(err: unknown): string {
  const m = err && typeof err === "object" && "message" in err ? String((err as { message: unknown }).message) : "";
  if (!m || /fetch|network|Failed to|Load failed/i.test(m)) return "Sem ligação ao servidor. Verifique a internet e tente de novo.";
  if (/JWT|token/i.test(m)) return "A sessão terminou. Entre de novo.";
  return m;
}

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase().schema("restaurante").rpc(fn, args);
  if (error) throw new Error(mensagem(error));
  return data as T;
}

async function rpcPublico<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabasePublico().schema("restaurante").rpc(fn, args);
  if (error) throw new Error(mensagem(error));
  return data as T;
}

/** Tabelas de configuração (salas, mesas, menu, equipa): leitura da equipa, escrita só do gerente (RLS). */
export const tabela = (nome: string) => supabase().schema("restaurante").from(nome);

/** Módulos da empresa no BOSS (esquema public): desligar o restaurante. Ligar faz-se por `api.activar`. */
export async function desligarRestaurante(): Promise<void> {
  const { error } = await supabase().rpc("company_module_deactivate", { p_module: "restaurante" });
  if (error) throw error;
}

export const api = {
  eu: () => rpc<Eu | null>("eu"),
  activar: (nome: string) => rpc<Eu>("activar", { p_nome: nome }),
  sala: () => rpc<Sala>("sala"),
  menu: () => rpc<Categoria[]>("menu"),
  abrirMesa: (mesa: string, pessoas?: number) => rpc<string>("abrir_mesa", { p_mesa: mesa, p_pessoas: pessoas ?? null }),
  abrirBalcao: () => rpc<string>("abrir_balcao"),
  pedido: (id: string) => rpc<Pedido>("pedido", { p_pedido: id }),
  adicionar: (pedido: string, item: string, quantidade = 1, nota?: string) =>
    rpc<string>("adicionar", { p_pedido: pedido, p_item: item, p_quantidade: quantidade, p_nota: nota ?? null }),
  alterarLinha: (linha: string, quantidade: number, nota?: string | null) =>
    rpc<void>("alterar_linha", { p_linha: linha, p_quantidade: quantidade, p_nota: nota ?? null }),
  enviar: (pedido: string) => rpc<number>("enviar", { p_pedido: pedido }),
  responderCliente: (pedido: string, aceitar: boolean) => rpc<number>("responder_cliente", { p_pedido: pedido, p_aceitar: aceitar }),
  anularLinha: (linha: string, motivo: string) => rpc<void>("anular_linha", { p_linha: linha, p_motivo: motivo }),
  fila: (estacao: string) => rpc<Talao[]>("fila", { p_estacao: estacao }),
  avancar: (linhas: string[], estado: "a_preparar" | "pronto" | "servido") => rpc<number>("avancar", { p_linhas: linhas, p_estado: estado }),
  pedirConta: (pedido: string) => rpc<void>("pedir_conta", { p_pedido: pedido }),
  atenderChamada: (pedido: string) => rpc<void>("atender_chamada", { p_pedido: pedido }),
  /** A conta do que falta pagar; com `linhas`, também o total da parte que uma pessoa escolheu. */
  conta: (pedido: string, linhas?: Escolha[] | null) => rpc<Conta>("conta", { p_pedido: pedido, p_linhas: linhas?.length ? linhas : null }),
  clientes: (texto: string) => rpc<{ id: string; nome: string; nif: string }[]>("clientes", { p_texto: texto }),
  /** Paga por uma pessoa: `forma`. Dividida: `partes` (somam o total; o servidor confere). */
  fecharConta: (pedido: string, forma: Forma | null, cliente?: string | null, partes?: Pagamento[] | null) =>
    rpc<Factura>("fechar_conta", { p_pedido: pedido, p_forma: forma, p_cliente: cliente ?? null, p_partes: partes ?? null }),
  /** Facturas separadas: uma pessoa paga só o que escolheu e leva a sua factura. */
  facturarParte: (pedido: string, linhas: Escolha[], forma: Forma, cliente?: string | null) =>
    rpc<Factura>("facturar_parte", { p_pedido: pedido, p_linhas: linhas, p_forma: forma, p_cliente: cliente ?? null }),
  cancelarPedido: (pedido: string) => rpc<void>("cancelar_pedido", { p_pedido: pedido }),
  equipa: () => rpc<{ user_id: string; nome: string; email: string; gere_empresa: boolean; papel: string | null; activo: boolean }[]>("equipa_lista"),
  produtosBoss: (texto?: string) =>
    rpc<{ product_id: string; nome: string; categoria: string | null; foto: string | null; preco: number }[]>("produtos_boss", { p_texto: texto ?? null }),
  fechoDoDia: (dia?: string) =>
    rpc<{ dia: string; contas: number; facturas: number; total: number; divididas: number; separadas: number; por_forma: Partial<Record<Forma, number>>; anulacoes: number }>("fecho_do_dia", { p_dia: dia ?? null }),
};

export const publico = {
  menu: (codigo: string) => rpcPublico<MenuPublico | null>("publico_menu", { p_codigo: codigo }),
  estado: (codigo: string) => rpcPublico<EstadoPublico | null>("publico_estado", { p_codigo: codigo }),
  pedir: (codigo: string, linhas: { item: string; quantidade: number; nota?: string }[]) =>
    rpcPublico<{ linhas: number; confirmacao: boolean }>("publico_pedir", { p_codigo: codigo, p_linhas: linhas }),
  chamar: (codigo: string, tipo: "empregado" | "conta") => rpcPublico<void>("publico_chamar", { p_codigo: codigo, p_tipo: tipo }),
};
