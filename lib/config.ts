// Base a que a aplicação se liga. Por omissão é a BASE DE TESTES (réplica mínima do BOSS).
// Em produção, estas duas variáveis apontam para o projecto Supabase do BOSS, onde o login é o do BOSS.
export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://zryznrmlesjlgufqykye.supabase.co";

export const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_kxatOvwVp-Noxn-D5WRjWA_-b5OXNrX";

const BOSS_URL = "https://dobrnawzvftlquhyonkn.supabase.co";

/** Onde a empresa muda de plano ou renova a subscrição. */
export const PLANOS_DO_BOSS = "https://app.boss.ao/plans";

/** A aplicação está ligada à base de testes, e não à do BOSS. */
export const BASE_DE_TESTES = SUPABASE_URL !== BOSS_URL;

/**
 * Endereço público da aplicação em produção. Os QR das mesas ficam impressos durante anos: levam sempre
 * este endereço, seja qual for o domínio de onde o gerente os imprimiu. Na base de testes usa-se o do navegador.
 */
export const ENDERECO_PUBLICO = BASE_DE_TESTES ? null : "https://rest.boss.ao";
