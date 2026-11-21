import { Suspense } from "react";
import { PaginaConta } from "@/components/ecras/Conta";

export const metadata = { title: "Conta" };

export default function Page() {
  return (
    <Suspense>
      <PaginaConta />
    </Suspense>
  );
}
