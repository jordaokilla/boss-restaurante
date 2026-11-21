# Cópias do BOSS

Estes ficheiros são cópias do repositório `appbossao` (commit `214ac98`), para o talão do restaurante sair
exactamente como o da Venda rápida do BOSS (texto legal, hash, número do certificado e QR da AGT).

Não se alteram aqui. Quando o talão do BOSS mudar, copiam-se de novo:

| Ficheiro aqui | Origem no appbossao |
| --- | --- |
| `invoiceReceipt.ts` | `src/lib/invoiceReceipt.ts` (só mudam os caminhos das importações) |
| `documentNumber.ts` | `src/lib/documentNumber.ts` |
| `deliveryNote.ts` | `src/lib/deliveryNote.ts` (linhas 1 a 29) |
| `certificate.ts` | `supabase/functions/_shared/agt/certificate.ts` |
| `agt-qr.ts` | `supabase/functions/_shared/agt/qr.ts` |
| `vat-exemptions.ts` | `supabase/functions/_shared/vat-exemptions.ts` |
