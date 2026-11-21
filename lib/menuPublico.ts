import { cacheLife } from "next/cache";
import { SUPABASE_KEY, SUPABASE_URL } from "./config";
import type { MenuPublico } from "./tipos";

/**
 * Menu de uma mesa, guardado um minuto no servidor: muitos clientes a ler o menu ao mesmo tempo
 * não chegam à base. O que muda entretanto (um artigo esgotado, um preço) é sempre conferido
 * pela base quando o cliente pede.
 */
export async function menuDaMesa(codigo: string): Promise<MenuPublico | null> {
  "use cache";
  cacheLife({ stale: 30, revalidate: 60, expire: 300 });
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/publico_menu`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json", "Content-Profile": "restaurante" },
    body: JSON.stringify({ p_codigo: codigo }),
  });
  if (!res.ok) throw new Error(`publico_menu ${res.status}`);
  return (await res.json()) as MenuPublico | null;
}
