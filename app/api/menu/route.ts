import { menuDaMesa } from "@/lib/menuPublico";

/** Menu público de uma mesa, pelo código do QR. */
export async function GET(req: Request) {
  const codigo = new URL(req.url).searchParams.get("c") ?? "";
  if (!/^[A-Za-z0-9_-]{8,40}$/.test(codigo)) return Response.json({ menu: null }, { status: 404 });
  try {
    const menu = await menuDaMesa(codigo);
    return Response.json({ menu }, { status: menu ? 200 : 404 });
  } catch {
    return Response.json({ erro: "Não foi possível carregar o menu." }, { status: 502 });
  }
}
