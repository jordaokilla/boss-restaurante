import { Suspense } from "react";
import { PaginaSala } from "@/components/ecras/Sala";

export const metadata = { title: "Sala" };

export default function Page() {
  return (
    <Suspense>
      <PaginaSala />
    </Suspense>
  );
}
