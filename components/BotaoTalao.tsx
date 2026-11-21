"use client";
import { useState } from "react";
import { Printer } from "lucide-react";
import { imprimirTalao } from "@/lib/imprimirTalao";
import { mensagem } from "@/lib/api";

/** Imprime o talão de uma Factura-Recibo do restaurante, na largura definida em Gestão. */
export function BotaoTalao({ factura, largura, className = "btn btn-primary w-full", texto = "Imprimir talão" }: { factura: string; largura: 58 | 80; className?: string; texto?: string }) {
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
            await imprimirTalao(factura, largura);
          } catch (err) {
            setErro(mensagem(err));
          } finally {
            setOcupado(false);
          }
        }}
      >
        <Printer size={18} aria-hidden />
        {ocupado ? "A preparar o talão…" : texto}
      </button>
      {erro && <p className="mt-2 text-sm font-medium text-danger" role="alert">{erro}</p>}
    </>
  );
}
