import { Suspense } from "react";
import { PaginaMesa } from "@/components/ecras/Mesa";

export const metadata = { title: "Pedido" };

export default function Page() {
  return (
    <Suspense>
      <PaginaMesa />
    </Suspense>
  );
}
