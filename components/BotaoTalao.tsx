"use client";
import { useState } from "react";
import { Printer } from "lucide-react";
import { imprimirTalao } from "@/lib/imprimirTalao";
import { mensagem } from "@/lib/api";

/** Imprime o talão da Factura-Recibo de um pedido fechado, na largura definida em Gestão. */
export function BotaoTalao({ pedido, largura, className = "btn btn-primary w-full" }: { pedido: string; largura: 58 | 80; className?: string }) {
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        className={className}
        disabled={ocupado}
        onClick={async () => {
          setOcupado(true);
          setErro(null);
          try {
            await imprimirTalao(pedido, largura);
          } catch (err) {
            setErro(mensagem(err));
          } finally {
            setOcupado(false);
          }
        }}
      >
        <Printer size={18} aria-hidden />
        {ocupado ? "A preparar o talão…" : "Imprimir talão"}
      </button>
      {erro && <p className="mt-2 text-sm font-medium text-danger" role="alert">{erro}</p>}
    </>
  );
}
