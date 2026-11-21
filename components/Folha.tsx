"use client";
import { useEffect, useRef } from "react";
import { X } from "lucide-react";

/** Diálogo que sobe do fundo no telemóvel e fica centrado no computador. */
export function Folha({ aberta, titulo, onFechar, children }: { aberta: boolean; titulo: string; onFechar: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (aberta && !d.open) d.showModal();
    if (!aberta && d.open) d.close();
  }, [aberta]);
  return (
    <dialog
      ref={ref}
      onClose={onFechar}
      onClick={(e) => e.target === ref.current && onFechar()}
      className="m-0 mt-auto w-full max-w-none rounded-t-3xl border border-line bg-surface p-0 text-ink backdrop:bg-black/50 sm:m-auto sm:max-w-md sm:rounded-3xl"
    >
      {aberta && (
        <div className="max-h-[86vh] overflow-y-auto">
          <div className="flex items-center justify-between gap-3 px-5 pt-5">
            <h2 className="h-title">{titulo}</h2>
            <button type="button" onClick={onFechar} aria-label="Fechar" className="rounded-lg p-2 text-muted hover:text-ink"><X size={20} /></button>
          </div>
          <div className="p-5">{children}</div>
        </div>
      )}
    </dialog>
  );
}
