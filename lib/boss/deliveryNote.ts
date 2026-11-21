// CÓPIA de appbossao (src/lib/deliveryNote.ts, só as linhas 1 a 29, commit 214ac98). Não alterar aqui: mudar no BOSS e copiar de novo.
// Guia de Remessa (GR): regras partilhadas pelo formulário, pela lista de facturas e pela emissão.
// A guia acompanha a mercadoria; não é factura e não é comunicada à AGT. O stock sai do armazém ao emitir.

export const DELIVERY_NOTE = "GR";

/**
 * Documentos de transporte: guia de remessa (GR) e guia de transporte (GT), com os mesmos campos (locais de carga e
 * descarga, início do transporte, matrícula). Só a guia de remessa tira stock e se factura; a guia de transporte serve
 * para mercadoria que circula sem ser entregue a um cliente (entre armazéns, para uma feira, para reparação).
 */
export const TRANSPORT_DOCUMENT_TYPES = ["GR", "GT"] as const;

export function isTransportDocument(documentType?: string | null): boolean {
  return !!documentType && (TRANSPORT_DOCUMENT_TYPES as readonly string[]).includes(documentType);
}

/** Documentos de conferência (não fiscais): pro-forma, orçamento e nota de encomenda. Passam a factura com um clique. */
export const QUOTE_DOCUMENT_TYPES = ["PP", "OR", "NE"] as const;

export function isQuoteDocument(documentType?: string | null): boolean {
  return !!documentType && (QUOTE_DOCUMENT_TYPES as readonly string[]).includes(documentType);
}

/** Documentos emitidos no BOSS que não vão à AGT: os de conferência e os de transporte. */
export const NON_AGT_DOCUMENT_TYPES = [...QUOTE_DOCUMENT_TYPES, ...TRANSPORT_DOCUMENT_TYPES] as const;

export function isSubmittedToAgt(documentType?: string | null): boolean {
  return !!documentType && !(NON_AGT_DOCUMENT_TYPES as readonly string[]).includes(documentType);
}
