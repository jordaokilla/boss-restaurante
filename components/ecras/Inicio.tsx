"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSessao } from "@/lib/sessao";
import { Carregar, inicioDe } from "@/components/Moldura";

/** A raiz leva cada pessoa ao seu ecrã: sala, cozinha, bar, configuração ou login. */
export function Inicio() {
  const { estado } = useSessao();
  const router = useRouter();
  const destino =
    estado.fase === "sem_sessao" ? "/entrar"
    : estado.fase === "pronto" ? (estado.eu.activo && estado.eu.papel ? inicioDe(estado.eu) : estado.eu.gere_empresa ? "/configurar" : "/sala")
    : estado.fase === "erro" ? "/sala"
    : null;
  useEffect(() => {
    if (destino) router.replace(destino);
  }, [destino, router]);
  return <Carregar />;
}
