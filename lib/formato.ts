export function kz(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) return "—";
  return `${new Intl.NumberFormat("pt-AO", { maximumFractionDigits: 2 }).format(valor)} Kz`;
}

/** «há 12 min», «há 1 h 05», a partir de uma data. */
export function ha(iso: string | null | undefined, agora: number): string {
  if (!iso) return "";
  const min = Math.max(0, Math.floor((agora - new Date(iso).getTime()) / 60000));
  if (min < 1) return "agora";
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")}`;
}

export function minutos(iso: string | null | undefined, agora: number): number {
  if (!iso) return 0;
  return Math.max(0, Math.floor((agora - new Date(iso).getTime()) / 60000));
}

export function hora(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("pt-AO", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Luanda" }).format(new Date(iso)).replace(":", "h");
}

export const quantidade = (n: number) => new Intl.NumberFormat("pt-AO", { maximumFractionDigits: 3 }).format(n);

export const PAPEL = { gerente: "Gerente", empregado: "Empregado de mesa", cozinha: "Cozinha", bar: "Bar" } as const;

export const ESTADO_LINHA = {
  por_confirmar: "Por confirmar",
  por_enviar: "Por enviar",
  enviado: "Enviado",
  a_preparar: "A preparar",
  pronto: "Pronto",
  servido: "Servido",
  anulado: "Anulado",
} as const;

export const FORMA = { numerario: "Numerário", multicaixa: "Multicaixa", transferencia: "Transferência" } as const;

export function nomeDoPedido(p: { tipo: "mesa" | "balcao"; mesa_nome: string | null; numero: number }): string {
  return p.tipo === "mesa" ? `Mesa ${p.mesa_nome}` : `Balcão ${p.numero}`;
}
