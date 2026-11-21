import { Suspense } from "react";
import { PaginaEstacao } from "@/components/ecras/Estacao";

export const metadata = { title: "Cozinha e bar" };

export default function Page() {
  return (
    <Suspense>
      <PaginaEstacao />
    </Suspense>
  );
}
