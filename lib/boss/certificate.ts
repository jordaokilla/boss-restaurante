// CÓPIA de appbossao (supabase/functions/_shared/agt/certificate.ts, commit 214ac98). Não alterar aqui: mudar no BOSS e copiar de novo.
// Certificado de produção do programa BOSS na AGT: FE/317/AGT/2026, versão 1.2 (certificada a 01/11/2026), com todos
// os tipos de documento (FT, FR, FA, FG, AF, NC, ND, RG), produtor BWE VIP GROUP (SU), LDA. O número é o mesmo da
// versão 1.1; o FE/420/AGT/2026 era de homologação e a AGT de produção recusa-o (E39).
// É o número que sai em «Processado por programa validado n.º …» e no QR (campo R). Os pedidos à AGT levam-no em
// softwareInfo, a partir dos segredos AGT_SOFTWARE_VALIDATION_NUMBER e AGT_SOFTWARE_PRODUCT_VERSION.
export const BOSS_AGT_CERTIFICATE = "FE/317/AGT/2026";
export const BOSS_AGT_VERSION = "1.2";
