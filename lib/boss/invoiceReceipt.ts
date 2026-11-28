// CÓPIA de appbossao (src/lib/invoiceReceipt.ts, só com os caminhos das importações mudados, commit 492fe97). Não alterar aqui: mudar no BOSS e copiar de novo.
import { displayDocumentNumber } from "./documentNumber";
import { isQuoteDocument, isTransportDocument } from "./deliveryNote";
import { VAT_EXEMPTION_MAP } from "./vat-exemptions";
import { BOSS_AGT_CERTIFICATE } from "./certificate";
import { agtQrDocumentNo, agtQrUrl } from "./agt-qr";
import { documentIssuerContact, type DocumentEstablishment } from "./establishment-core";

/** Largura do rolo da impressora térmica (talão de PDA). */
export type ReceiptWidth = 80 | 58;

export interface ReceiptData {
  invoice: {
    document_type: string;
    status: string;
    invoice_number?: number | string | null;
    full_number?: string | null;
    invoice_series?: { agt_series_code?: string | null } | null;
    issue_date: string;
    currency?: string | null;
    subtotal: number | string;
    total_vat: number | string;
    total: number | string;
    retention_rate?: number | string | null;
    external_reference?: string | null;
    hash?: string | null;
    notes?: string | null;
  };
  items: Array<{
    description: string;
    quantity: number | string;
    unit_price: number | string;
    vat_rate: number | string;
    discount_percent?: number | string | null;
    tax_exemption_code?: string | null;
    subtotal: number | string;
    vat_amount: number | string;
    total: number | string;
  }>;
  company?: { name?: string | null; nif?: string | null; address?: string | null } | null;
  settings?: { city?: string | null; phone?: string | null; agt_certificate_number?: string | null } | null;
  client?: { name?: string | null; nif?: string | null } | null;
  /** Estabelecimento que emitiu o documento: a morada e o telefone do talão são os dele (vazio = os da empresa). */
  establishment?: DocumentEstablishment | null;
  /** QR já convertido em data URL (vazio nas proformas, que não têm valor fiscal). */
  qrDataUrl?: string | null;
  /** Recibo: os documentos pagos e as notas de crédito abatidas (`credit`), com o valor sempre positivo. */
  payments?: ReceiptPayment[];
}

export interface ReceiptPayment {
  number: string;
  date?: string | null;
  amount: number;
  credit: boolean;
}

const DOC_LABELS: Record<string, string> = {
  FT: "Factura",
  FR: "Factura-Recibo",
  PP: "Pro-forma",
  OR: "Orçamento",
  NE: "Nota de Encomenda",
  NC: "Nota de Crédito",
  ND: "Nota de Débito",
  FA: "Factura de Adiantamento",
  FG: "Factura Global",
  AF: "Factura/Recibo de Autofacturação",
  RC: "Recibo",
  GR: "Guia de Remessa",
  GT: "Guia de Transporte",
};

export function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

const NUMBER = new Intl.NumberFormat("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function money(value: unknown, currency?: string | null): string {
  const n = Number(value);
  const text = NUMBER.format(Number.isFinite(n) ? n : 0);
  const code = !currency || currency === "AOA" ? "Kz" : currency;
  return `${text} ${code}`;
}

/**
 * Conteúdo do QR fiscal: o endereço de consulta do documento no Quiosque AGT, o mesmo que o PDF A4
 * (supabase/functions/generate-invoice-pdf e _shared/agt/qr.ts).
 */
export function receiptQrContent(data: ReceiptData): string {
  return agtQrUrl(data.company?.nif, agtQrDocumentNo(data.invoice));
}

function dateText(value: string): string {
  const [y, m, d] = String(value).slice(0, 10).split("-");
  // DD-MM-AAAA: a forma de data dos documentos impressos aceite pela AGT.
  return y && m && d ? `${d}-${m}-${y}` : String(value);
}

/** HTML completo do talão, pronto a imprimir (rolo de 80 mm ou 58 mm). */
export function buildReceiptHtml(data: ReceiptData, width: ReceiptWidth = 80): string {
  const { invoice, items, company, settings, client } = data;
  const cur = invoice.currency;
  // Documentos de conferência (proforma, orçamento, encomenda): sem valor fiscal.
  const isProforma = isQuoteDocument(invoice.document_type);
  const number = displayDocumentNumber(invoice);
  const label = DOC_LABELS[invoice.document_type] || invoice.document_type;
  const paper = width === 58 ? { page: 58, body: 50, font: 10.5 } : { page: 80, body: 72, font: 12 };
  const cert = BOSS_AGT_CERTIFICATE;
  const hash4 = invoice.hash ? String(invoice.hash).substring(0, 4) : "0000";
  const isDeliveryNote = isTransportDocument(invoice.document_type);
  const isReceipt = invoice.document_type === "RC";
  const clientNif = client?.nif && client.nif !== "999999999" ? client.nif : "Consumidor final";

  // Resumo de IVA por taxa
  const byRate = new Map<number, { base: number; vat: number }>();
  for (const it of items) {
    const rate = Number(it.vat_rate) || 0;
    const row = byRate.get(rate) ?? { base: 0, vat: 0 };
    row.base += Number(it.subtotal) || 0;
    row.vat += Number(it.vat_amount) || 0;
    byRate.set(rate, row);
  }

  const exemptions = [...new Set(items
    .filter((it) => !(Number(it.vat_rate) || 0) && it.tax_exemption_code)
    .map((it) => String(it.tax_exemption_code)))].sort();

  // A guia de remessa não é documento de venda: só a quantidade e a descrição, sem preços nem totais.
  const lines = isDeliveryNote
    ? items.map((it) => `<div class="item row"><span class="desc">${escapeHtml(it.description)}</span><span>${escapeHtml(Number(it.quantity))}</span></div>`).join("")
    : items.map((it) => {
      const disc = Number(it.discount_percent) || 0;
      const rate = Number(it.vat_rate) || 0;
      const exemption = !rate && it.tax_exemption_code ? ` (${escapeHtml(it.tax_exemption_code)})` : "";
      return `<div class="item"><div class="desc">${escapeHtml(it.description)}</div>
      <div class="row"><span>${escapeHtml(Number(it.quantity))} x ${escapeHtml(money(it.unit_price, cur))}${disc ? ` (-${disc}%)` : ""}</span><span>${escapeHtml(money(it.total, cur))}</span></div>
      <div class="muted">IVA ${escapeHtml(rate)}%${exemption}</div></div>`;
    }).join("");

  const vatRows = [...byRate.entries()].sort((a, b) => a[0] - b[0]).map(([rate, v]) =>
    `<div class="row"><span>IVA ${rate}%</span><span>${escapeHtml(money(v.vat, cur))}</span></div><div class="muted">Base ${escapeHtml(money(v.base, cur))}</div>`).join("")
    + exemptions.map((code) => `<div class="muted">${escapeHtml(code)} - ${escapeHtml(VAT_EXEMPTION_MAP[code] || "Motivo de isenção")}</div>`).join("");

  // Recibo: os documentos pagos, não os artigos da factura.
  const payments = data.payments ?? [];
  const paymentLines = payments.map((p) => `<div class="item"><div class="row"><span>${escapeHtml(p.number)}${p.credit ? " (crédito abatido)" : ""}</span><span>${escapeHtml(money(p.amount, cur))}</span></div>${p.date ? `<div class="muted">${escapeHtml(dateText(p.date))}</div>` : ""}</div>`).join("");
  const totalQty = items.reduce((t, it) => t + (Number(it.quantity) || 0), 0);

  const retention = Number(invoice.retention_rate) || 0;
  // Num documento de um estabelecimento, a morada e o telefone são os do estabelecimento (documentIssuerContact).
  const contact = documentIssuerContact(company, settings, data.establishment);
  const address = contact.address;
  const city = contact.city && !address.toLowerCase().includes(contact.city.toLowerCase()) ? contact.city : "";
  const head = [address, city, contact.phone ? `Tel. ${contact.phone}` : ""].filter(Boolean).map((t) => `<div>${escapeHtml(t)}</div>`).join("");

  return `<!doctype html><html lang="pt"><head><meta charset="utf-8"><title>${escapeHtml(label)} ${escapeHtml(number)}</title>
<style>
  @page { size: ${paper.page}mm auto; margin: 3mm 2mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; color: #000; }
  body { width: ${paper.body}mm; margin: 0 auto; font-family: "Courier New", ui-monospace, monospace; font-size: ${paper.font}px; line-height: 1.35; overflow-wrap: anywhere; }
  .center { text-align: center; }
  .name { font-weight: 700; font-size: ${paper.font + 2}px; }
  .sep { border-top: 1px dashed #000; margin: 6px 0; }
  .row { display: flex; flex-wrap: wrap; justify-content: space-between; column-gap: 6px; }
  .row span:last-child { white-space: nowrap; text-align: right; margin-left: auto; }
  .item { margin-bottom: 4px; }
  .desc { word-break: break-word; }
  .muted { font-size: ${paper.font - 1.5}px; }
  .total { font-weight: 700; font-size: ${paper.font + 2}px; }
  .doc { font-weight: 700; text-transform: uppercase; }
  .qr { text-align: center; margin-top: 6px; }
  .qr img { width: ${width === 58 ? 34 : 40}mm; height: auto; }
  .small { font-size: ${paper.font - 2}px; text-align: center; }
</style></head><body>
  <div class="center">
    <div class="name">${escapeHtml(company?.name || "")}</div>
    ${contact.establishmentName ? `<div>${escapeHtml(contact.establishmentName)}</div>` : ""}
    ${company?.nif ? `<div>NIF ${escapeHtml(company.nif)}</div>` : ""}
    ${head}
  </div>
  <div class="sep"></div>
  <div class="doc center">${escapeHtml(label)}${invoice.status === "cancelled" ? " (ANULADO)" : ""}</div>
  <div class="center">${escapeHtml(number)}</div>
  <div class="row"><span>Data</span><span>${escapeHtml(dateText(invoice.issue_date))}</span></div>
  ${client?.name ? `<div class="row"><span>${invoice.document_type === "AF" ? "Fornecedor" : "Cliente"}</span><span>${escapeHtml(client.name)}</span></div>` : ""}
  <div class="row"><span>NIF</span><span>${escapeHtml(clientNif)}</span></div>
  ${invoice.external_reference ? `<div class="row"><span>Ref.</span><span>${escapeHtml(invoice.external_reference)}</span></div>` : ""}
  <div class="sep"></div>
  ${isReceipt && payments.length
    ? `${paymentLines}
  <div class="sep"></div>
  <div class="row total"><span>TOTAL RECEBIDO</span><span>${escapeHtml(money(invoice.total, cur))}</span></div>`
    : isDeliveryNote
    ? `${lines}
  <div class="sep"></div>
  <div class="row total"><span>QUANTIDADE TOTAL</span><span>${escapeHtml(Math.round(totalQty * 100) / 100)}</span></div>`
    : `${lines}
  <div class="sep"></div>
  <div class="row"><span>Subtotal</span><span>${escapeHtml(money(invoice.subtotal, cur))}</span></div>
  ${vatRows}
  ${retention ? `<div class="row"><span>Retenção ${escapeHtml(retention)}%</span><span></span></div>` : ""}
  <div class="row total"><span>${isReceipt ? "TOTAL RECEBIDO" : "TOTAL"}</span><span>${escapeHtml(money(invoice.total, cur))}</span></div>`}
  <div class="sep"></div>
  ${invoice.notes ? `<div class="muted">${escapeHtml(invoice.notes)}</div><div class="sep"></div>` : ""}
  ${isDeliveryNote
    ? `<div class="small">Este documento não serve de factura</div>
       <div class="small">${escapeHtml(hash4)} - Processado por programa validado n.º ${escapeHtml(cert)} - BOSS</div>`
    : isProforma
    ? `<div class="small">Documento sem valor fiscal. Este documento não serve de factura</div>`
    : `${data.qrDataUrl ? `<div class="qr"><img src="${data.qrDataUrl}" alt="QR do documento"></div>` : ""}
       <div class="small">${isReceipt
        ? `Emitido por programa validado n.º ${escapeHtml(cert)} - BOSS`
        : `${escapeHtml(hash4)} - Processado por programa validado n.º ${escapeHtml(cert)} - BOSS`}</div>`}
  <div class="small" style="margin-top:6px">Obrigado pela preferência</div>
  <div class="small">Emitido com o BOSS · boss.ao</div>
</body></html>`;
}
