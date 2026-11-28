// Estabelecimentos do BOSS no restaurante: cada casa da empresa pode ter o seu restaurante (mesas, pedidos, contas).
// É quem gere a empresa que põe cada pessoa no seu estabelecimento, no BOSS (Configurações › Estabelecimentos); o
// restaurante só assume: o funcionário entra directamente no restaurante da casa em que foi posto e nunca escolhe.
// Só escolhe quem gere a empresa (trabalha em todas) e quem foi posto em mais de uma (só entre as suas); a escolha
// fica guardada no BOSS (a mesma do selector «A trabalhar em»). Nas empresas sem estabelecimentos nada disto aparece.
import type { Casa, Eu } from "./tipos";

export interface OpcaoCasa { id: string | null; nome: string; nota: string | null }

/** Onde a pessoa pode trabalhar: as suas casas e, para quem não está preso a casas, o restaurante da empresa (se existir). */
export function opcoesDeCasa(eu: Eu): OpcaoCasa[] {
  const casas: OpcaoCasa[] = (eu.casas ?? []).map((c) => ({ id: c.id, nome: c.nome, nota: c.configurado ? null : "Restaurante por ligar" }));
  if (casas.length === 0) return [];
  if (eu.restaurante_da_empresa && !eu.preso_a_casas) {
    return [{ id: null, nome: eu.empresa ?? "Empresa", nota: "Restaurante da empresa, sem estabelecimento" }, ...casas];
  }
  return casas;
}

/** A empresa tem estabelecimentos, a pessoa ainda não está em nenhum e não há restaurante da empresa para lhe mostrar. */
export function precisaEscolherCasa(eu: Eu): boolean {
  return (eu.casas?.length ?? 0) > 0 && !eu.casa && !eu.restaurante_da_empresa;
}

/** Há mais de um sítio onde esta pessoa pode trabalhar (é quando o botão de mudar aparece). */
export function podeMudarDeCasa(eu: Eu): boolean {
  return opcoesDeCasa(eu).length > 1;
}

/** A empresa tem restaurantes por estabelecimento e a pessoa ainda não foi posta em nenhum: não entra em nenhum. */
export function semEstabelecimento(eu: Eu): boolean {
  return eu.sem_casa === true && !eu.restaurante_da_empresa;
}

export function casaActual(eu: Eu): Casa | null {
  return eu.casa ?? null;
}

/** Onde se põe cada pessoa num estabelecimento. */
export const EQUIPA_NO_BOSS = "https://app.boss.ao/settings?tab=establishments";

/** Ordem da lista da equipa num estabelecimento: primeiro as pessoas dele, depois as que ainda não têm nenhum. */
export function ordemNaEquipa(pessoa: { gere_empresa: boolean; casas?: Casa[] }, casa: Casa | null): number {
  if (!casa || pessoa.gere_empresa) return 0;
  const casas = pessoa.casas ?? [];
  if (casas.some((c) => c.id === casa.id)) return 0;
  return casas.length === 0 ? 1 : 2;
}
