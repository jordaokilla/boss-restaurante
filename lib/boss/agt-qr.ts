// CÓPIA de appbossao (supabase/functions/_shared/agt/qr.ts, commit 214ac98). Não alterar aqui: mudar no BOSS e copiar de novo.
// QR Code dos documentos impressos, pela especificação da AGT («Especificações do QR Code a utilizar nos documentos
// impressos»): QR Code Model 2, correcção de erros M (15 %), modo Byte, UTF-8, PNG de 350 x 350 px, com o endereço de
// consulta do documento no Quiosque AGT:
//   https://quiosqueagt.minfin.gov.ao/facturacao-eletronica/consultar-fe?emissor=<NIF do emissor>&document=<documentNo>
// Cada espaço do número do documento vai como %20. O logótipo da AGT fica ao centro, com menos de 20 % da imagem.
//
// A especificação indica a versão 4 (33 x 33 módulos), mas o endereço completo não cabe nela com a correcção M
// (62 bytes): a versão é a mais pequena em que o endereço cabe (o exemplo da própria AGT também é maior).
//
// Partilhado pelo PDF A4 (generate-invoice-pdf) e pelo talão térmico (src/lib/invoiceReceipt.ts), para os dois
// levarem o mesmo endereço. Só cálculo, sem dependências.

export const AGT_QR_BASE_URL = "https://quiosqueagt.minfin.gov.ao/facturacao-eletronica/consultar-fe";

/** Opções da biblioteca `qrcode` exigidas pela AGT (a versão é automática: ver o topo do ficheiro). */
export const AGT_QR_OPTIONS = { errorCorrectionLevel: "M", width: 350, margin: 1 } as const;

interface QrDocument {
  document_type?: string | null;
  invoice_number?: number | string | null;
  full_number?: string | null;
  invoice_series?: { agt_series_code?: string | null } | { agt_series_code?: string | null }[] | null;
  agt_series_code?: string | null;
}

/**
 * Número do documento tal como foi registado na AGT: «{TIPO} {série AGT}/{número}», com o recibo como RG (no BOSS é
 * RC). Sem série registada na AGT fica o número interno do documento.
 */
export function agtQrDocumentNo(doc: QrDocument): string {
  const series = Array.isArray(doc.invoice_series) ? doc.invoice_series[0] : doc.invoice_series;
  const agtSeries = String(series?.agt_series_code ?? doc.agt_series_code ?? "").trim();
  const type = String(doc.document_type ?? "").trim();
  const number = doc.invoice_number;
  if (agtSeries && type && number !== null && number !== undefined && String(number) !== "") {
    return `${type === "RC" ? "RG" : type} ${agtSeries}/${number}`;
  }
  return String(doc.full_number ?? "").trim();
}

/** Endereço de consulta do documento no Quiosque AGT (o conteúdo do QR). */
export function agtQrUrl(issuerNif: string | null | undefined, documentNo: string): string {
  const nif = String(issuerNif ?? "").replace(/[^0-9A-Za-z]/g, "");
  // Espaços como %20 (regra da AGT); a barra do número fica como está.
  const document = encodeURIComponent(documentNo.trim()).replace(/%2F/gi, "/");
  return `${AGT_QR_BASE_URL}?emissor=${nif}&document=${document}`;
}

/** Conteúdo para a biblioteca `qrcode`: um só segmento em modo Byte, com o endereço em UTF-8, como pede a AGT. */
export function agtQrSegments(url: string): { data: Uint8Array; mode: "byte" }[] {
  return [{ data: new TextEncoder().encode(url), mode: "byte" }];
}
