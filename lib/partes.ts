// Contas da divisão do pagamento, em cêntimos para não haver erros de arredondamento.
// O servidor volta a conferir que as partes somam o total (restaurante.fechar_conta).
import type { Forma } from "./tipos";

/** Uma parte da conta. `valor` nulo ou vazio = parte automática (reparte o que sobra por igual). */
export interface Parte {
  valor: string | null;
  forma: Forma | null;
}

export const MIN_PARTES = 2;
export const MAX_PARTES = 20;

/** «7 950,50» → 795050 cêntimos. Nulo se não for um valor em kwanzas com até dois decimais. */
export function lerValor(texto: string): number | null {
  const limpo = texto.replace(/[\s  ]/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(limpo)) return null;
  return Math.round(Number(limpo) * 100);
}

/** 795050 → «7950,5»; 795000 → «7950» (para a caixa de texto). */
export function escreverValor(centimos: number): string {
  return String(centimos / 100).replace(".", ",");
}

export interface Reparticao {
  /** Valor de cada parte em cêntimos (nulo quando não se consegue calcular). */
  valores: (number | null)[];
  /** O que falta distribuir (positivo) ou o que passa do total (negativo), em cêntimos. */
  diferenca: number;
  problema: "invalido" | "passa" | "falta" | null;
}

export function repartir(totalCentimos: number, partes: Parte[]): Reparticao {
  const manuais = partes.map((p) => (p.valor === null || p.valor.trim() === "" ? undefined : lerValor(p.valor)));
  if (manuais.some((m) => m === null || m === 0)) {
    return { valores: manuais.map((m) => m ?? null), diferenca: 0, problema: "invalido" };
  }
  const automaticas = manuais.filter((m) => m === undefined).length;
  const resto = totalCentimos - manuais.reduce<number>((t, m) => t + (m ?? 0), 0);
  if (automaticas === 0) {
    return { valores: manuais as number[], diferenca: resto, problema: resto === 0 ? null : resto > 0 ? "falta" : "passa" };
  }
  if (resto < automaticas) {
    return { valores: manuais.map((m) => m ?? null), diferenca: resto, problema: "passa" };
  }
  const base = Math.floor(resto / automaticas);
  let sobra = resto - base * automaticas;
  // Os cêntimos que não se dividem por igual vão para as últimas partes automáticas.
  const valores = [...manuais];
  for (let i = valores.length - 1; i >= 0; i--) {
    if (valores[i] !== undefined) continue;
    valores[i] = base + (sobra > 0 ? 1 : 0);
    if (sobra > 0) sobra--;
  }
  return { valores: valores as number[], diferenca: 0, problema: null };
}
