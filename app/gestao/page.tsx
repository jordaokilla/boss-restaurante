import { Suspense } from "react";
import { PaginaGestao } from "@/components/ecras/Gestao";

export const metadata = { title: "Gestão" };

export default function Page() {
  return (
    <Suspense>
      <PaginaGestao />
    </Suspense>
  );
}
