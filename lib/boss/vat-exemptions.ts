// CÓPIA de appbossao (supabase/functions/_shared/vat-exemptions.ts, commit 214ac98). Não alterar aqui: mudar no BOSS e copiar de novo.
// Motivos de isenção de IVA da AGT: código e a menção que tem de constar no documento, tal como na Tabela 4 do
// Decreto Executivo n.º 683/25 (Anexo I). Partilhado pelo ecrã e pelo PDF dos documentos. A menção usa o hífen
// simples: o PDF escreve só o Latin-1. A lista de códigos é a mesma da base (_fin3c_vat_codes) e do MCP.
export const VAT_EXEMPTION_CODES = [
  { code: "M00", label: "M00 — IVA - Regime Simplificado" },
  { code: "M02", label: "M02 — Transmissão de bens e serviço não sujeita" },
  { code: "M04", label: "M04 — IVA - Regime de Exclusão" },
  { code: "M11", label: "M11 — Isento nos termos da alínea b) do n.º 1 do artigo 12.º do CIVA" },
  { code: "M12", label: "M12 — Isento nos termos da alínea c) do n.º 1 do artigo 12.º do CIVA" },
  { code: "M13", label: "M13 — Isento nos termos da alínea d) do n.º 1 do artigo 12.º do CIVA" },
  { code: "M14", label: "M14 — Isento nos termos da alínea e) do n.º 1 do artigo 12.º do CIVA" },
  { code: "M15", label: "M15 — Isento nos termos da alínea f) do n.º 1 do artigo 12.º do CIVA" },
  { code: "M16", label: "M16 — Isento nos termos da alínea g) do n.º 1 do artigo 12.º do CIVA" },
  { code: "M17", label: "M17 — Isento nos termos da alínea h) do n.º 1 do artigo 12.º do CIVA" },
  { code: "M18", label: "M18 — Isento nos termos da alínea i) do n.º 1 do artigo 12.º do CIVA" },
  { code: "M19", label: "M19 — Isento nos termos da alínea j) do n.º 1 do artigo 12.º do CIVA" },
  { code: "M20", label: "M20 — Isento nos termos da alínea k) do n.º 1 do artigo 12.º do CIVA" },
  { code: "M30", label: "M30 — Isento nos termos da alínea a) do artigo 15.º do CIVA" },
  { code: "M31", label: "M31 — Isento nos termos da alínea b) do artigo 15.º do CIVA" },
  { code: "M32", label: "M32 — Isento nos termos da alínea c) do artigo 15.º do CIVA" },
  { code: "M33", label: "M33 — Isento nos termos da alínea d) do artigo 15.º do CIVA" },
  { code: "M34", label: "M34 — Isento nos termos da alínea e) do artigo 15.º do CIVA" },
  { code: "M35", label: "M35 — Isento nos termos da alínea f) do artigo 15.º do CIVA" },
  { code: "M36", label: "M36 — Isento nos termos da alínea g) do artigo 15.º do CIVA" },
  { code: "M37", label: "M37 — Isento nos termos da alínea h) do artigo 15.º do CIVA" },
  { code: "M38", label: "M38 — Isento nos termos da alínea i) do artigo 15.º do CIVA" },
] as const;

export const VAT_EXEMPTION_MAP: Record<string, string> = Object.fromEntries(
  VAT_EXEMPTION_CODES.map((c) => [c.code, c.label.split(" — ")[1]]),
);

export type VatExemptionCode = typeof VAT_EXEMPTION_CODES[number]["code"];
