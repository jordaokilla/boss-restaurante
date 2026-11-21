import { Suspense } from "react";
import { PaginaQR } from "@/components/ecras/Gestao";

export const metadata = { title: "Códigos QR" };

export default function Page() {
  return (
    <Suspense>
      <PaginaQR />
    </Suspense>
  );
}
