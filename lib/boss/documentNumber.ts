// CÓPIA de appbossao (src/lib/documentNumber.ts, commit 214ac98). Não alterar aqui: mudar no BOSS e copiar de novo.
/**
 * Número do documento mostrado ao utilizador.
 *
 * Quando a série já está registada na AGT, o número oficial é
 * `{TIPO} {agt_series_code}/{invoice_number}` (mesma regra usada no envio à AGT
 * em supabase/functions/_shared/agt/envelope.ts). Caso contrário mantém-se o
 * número interno (`full_number`), exactamente como antes.
 */
export function displayDocumentNumber(input: {
  document_type?: string | null;
  invoice_number?: number | string | null;
  full_number?: string | null;
  invoice_series?: { agt_series_code?: string | null } | null;
  agt_series_code?: string | null;
}): string {
  const agtSeries = (input.invoice_series?.agt_series_code ?? input.agt_series_code ?? "").trim();
  const type = (input.document_type ?? "").trim();
  const number = input.invoice_number;
  if (agtSeries && type && number !== null && number !== undefined && String(number) !== "") {
    return `${type} ${agtSeries}/${number}`;
  }
  return input.full_number ?? "";
}
