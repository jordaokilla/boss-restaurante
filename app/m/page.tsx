import { Suspense } from "react";
import { MenuCliente } from "@/components/ecras/MenuCliente";

export const metadata = { title: "Menu" };

export default function Page() {
  return (
    <Suspense>
      <MenuCliente />
    </Suspense>
  );
}
