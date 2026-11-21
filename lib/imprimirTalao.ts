"use client";
// Impressão do talão de uma Factura-Recibo do restaurante.
// Segue `src/lib/printInvoice.ts` do BOSS (moldura escondida no computador e no Android; PDF pela folha
// de partilha no iPhone e na aplicação instalada). Os dados vêm do guiché `restaurante.talao`,
// porque o empregado de mesa não lê as facturas directamente. `factura` é a factura do restaurante
// (`pedido_facturas.id`): um pedido com contas separadas tem várias.
import { supabase } from "./supabase";
import { mensagem } from "./api";
import { AGT_QR_OPTIONS, agtQrSegments } from "./boss/agt-qr";
import { buildReceiptHtml, receiptQrContent, type ReceiptData, type ReceiptWidth } from "./boss/invoiceReceipt";

async function dadosDoTalao(factura: string): Promise<ReceiptData> {
  const { data, error } = await supabase().schema("restaurante").rpc("talao", { p_factura: factura });
  if (error) throw new Error(mensagem(error));
  const dados = data as ReceiptData;
  try {
    const QRCode = await import("qrcode");
    dados.qrDataUrl = await QRCode.toDataURL(agtQrSegments(receiptQrContent(dados)), AGT_QR_OPTIONS);
  } catch (e) {
    console.error("QR do talão", e);
  }
  return dados;
}

function imprimirNaMoldura(html: string) {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  let limpo = false;
  const limpar = () => {
    if (limpo) return;
    limpo = true;
    frame.remove();
  };
  frame.onload = () => {
    try {
      const win = frame.contentWindow;
      if (!win) throw new Error("sem janela");
      win.addEventListener("afterprint", () => setTimeout(limpar, 500));
      win.focus();
      win.print();
    } catch {
      limpar();
    }
  };
  frame.srcdoc = html;
  document.body.appendChild(frame);
  setTimeout(limpar, 5 * 60 * 1000);
}

/** No iPhone, no iPad e nas aplicações instaladas, `print()` dentro de uma moldura não faz nada. */
function imprimeNaMoldura(): boolean {
  try {
    const ua = navigator.userAgent;
    const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const instalada = window.matchMedia?.("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
    return !ios && !instalada;
  } catch {
    return true;
  }
}

async function ficheiroDoTalao(dados: ReceiptData, largura: ReceiptWidth): Promise<File> {
  const html = buildReceiptHtml(dados, largura);
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = `position:fixed;left:-10000px;top:0;width:${Math.round(largura * 3.78)}px;height:200px;border:0`;
  try {
    await new Promise<void>((resolve, reject) => {
      frame.onload = () => resolve();
      frame.onerror = () => reject(new Error("Não foi possível preparar o talão."));
      frame.srcdoc = html;
      document.body.appendChild(frame);
    });
    const doc = frame.contentDocument;
    if (!doc?.body) throw new Error("Não foi possível preparar o talão.");
    await Promise.all([...doc.images].map((img) => (img.complete ? null : img.decode().catch(() => null))));
    const node = doc.documentElement;
    const w = node.scrollWidth;
    const h = node.scrollHeight;
    frame.style.height = `${h}px`;
    const { toJpeg } = await import("html-to-image");
    const img = await toJpeg(node, { pixelRatio: 2.5, quality: 0.9, backgroundColor: "#ffffff", width: w, height: h });
    const { jsPDF } = await import("jspdf");
    const altura = Math.max(40, (largura * h) / w);
    const pdf = new jsPDF({ unit: "mm", format: [largura, altura], orientation: "portrait" });
    pdf.addImage(img, "JPEG", 0, 0, largura, altura);
    const nome = `Talao ${String(dados.invoice?.full_number ?? "documento")}.pdf`.replace(/[\\/:*?"<>|]/g, "-");
    return new File([pdf.output("blob")], nome, { type: "application/pdf" });
  } finally {
    frame.remove();
  }
}

async function partilhar(file: File): Promise<void> {
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: file.name });
      return;
    } catch (e) {
      if ((e as { name?: string })?.name === "AbortError") return;
    }
  }
  const url = URL.createObjectURL(file);
  if (!window.open(url, "_blank")) {
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  setTimeout(() => URL.revokeObjectURL(url), 10 * 60 * 1000);
}

/** HTML do talão de uma factura (para imprimir ou para mostrar). */
export async function htmlDoTalao(factura: string, largura: ReceiptWidth): Promise<string> {
  return buildReceiptHtml(await dadosDoTalao(factura), largura);
}

/** Imprime o talão (80 ou 58 mm) de uma factura do restaurante. */
export async function imprimirTalao(factura: string, largura: ReceiptWidth = 80): Promise<void> {
  const dados = await dadosDoTalao(factura);
  if (imprimeNaMoldura()) imprimirNaMoldura(buildReceiptHtml(dados, largura));
  else await partilhar(await ficheiroDoTalao(dados, largura));
}
