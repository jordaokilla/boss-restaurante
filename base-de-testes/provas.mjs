// Provas da base do restaurante, feitas pela API como a aplicação as faz (login real, sem atalhos).
// Uso: URL=https://<projecto>.supabase.co CHAVE=<chave publicável> SENHA=<senha dos utilizadores de teste> node provas.mjs
// Corre contra a base de testes, acabada de preparar (02_dados_de_teste.sql). Nunca contra a base do BOSS.
const URL = process.env.URL, CHAVE = process.env.CHAVE, SENHA = process.env.SENHA;
if (!URL || !CHAVE || !SENHA) { console.error("Faltam URL, CHAVE ou SENHA."); process.exit(2); }

let passou = 0, falhou = 0;
const ok = (cond, nome, extra = "") => { cond ? passou++ : falhou++; console.log(`${cond ? "✓" : "✗"} ${nome}${cond ? "" : "  → " + extra}`); };

async function entrar(email) {
  const r = await fetch(`${URL}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: CHAVE, "Content-Type": "application/json" }, body: JSON.stringify({ email, password: SENHA }) });
  const j = await r.json();
  if (!j.access_token) throw new Error(`login ${email}: ${JSON.stringify(j)}`);
  return j.access_token;
}
function cliente(token) {
  const h = { apikey: CHAVE, "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  const ler = async (r) => { const t = await r.text(); let d = null; try { d = t ? JSON.parse(t) : null; } catch { d = t; } return r.ok ? { d } : { erro: d?.message ?? String(t), estado: r.status }; };
  return {
    rpc: async (fn, args = {}) => ler(await fetch(`${URL}/rest/v1/rpc/${fn}`, { method: "POST", headers: { ...h, "Content-Profile": "restaurante" }, body: JSON.stringify(args) })),
    ver: async (tabela, q = "select=*") => ler(await fetch(`${URL}/rest/v1/${tabela}?${q}`, { headers: { ...h, "Accept-Profile": "restaurante" } })),
    criar: async (tabela, linhas) => ler(await fetch(`${URL}/rest/v1/${tabela}`, { method: "POST", headers: { ...h, "Content-Profile": "restaurante", Prefer: "return=representation" }, body: JSON.stringify(linhas) })),
    mudar: async (tabela, q, patch) => ler(await fetch(`${URL}/rest/v1/${tabela}?${q}`, { method: "PATCH", headers: { ...h, "Content-Profile": "restaurante", Prefer: "return=representation" }, body: JSON.stringify(patch) })),
  };
}

const dono = cliente(await entrar("dono@kianda.teste"));
const joao = cliente(await entrar("joao@kianda.teste"));
const cozinha = cliente(await entrar("cozinha@kianda.teste"));
const bar = cliente(await entrar("bar@kianda.teste"));
const sem = cliente(await entrar("semacesso@kianda.teste"));
const outro = cliente(await entrar("dono@outra.teste"));
const publico = cliente(null);

// --- ligar o restaurante e montar a equipa
let r = await dono.rpc("eu");
ok(r.d?.activo === false && r.d?.gere_empresa === true, "antes de ligar: o dono vê o restaurante desligado");
r = await joao.rpc("activar");
ok(!!r.erro, "um empregado não consegue ligar o restaurante");
r = await dono.rpc("activar", { p_nome: "Restaurante Kianda" });
ok(r.d?.activo === true && r.d?.papel === "gerente" && r.d?.estacoes?.length === 2, "o dono liga o restaurante: gerente, com Cozinha e Bar", JSON.stringify(r));
const [estCozinha, estBar] = ["cozinha", "bar"].map((t) => r.d.estacoes.find((e) => e.tipo === t).id);
const empresa = r.d.company_id;

r = await joao.rpc("sala");
ok(!!r.erro, "sem papel no restaurante, o João não vê a sala");
r = await dono.rpc("equipa_lista");
const pessoa = (email) => r.d.find((p) => p.email === email).user_id;
ok(r.d?.length === 5, "o gerente vê as 5 pessoas da empresa (e nenhuma de outra)", JSON.stringify(r.d?.map((p) => p.email)));
const eq = await dono.criar("equipa", [
  { company_id: empresa, user_id: pessoa("joao@kianda.teste"), papel: "empregado" },
  { company_id: empresa, user_id: pessoa("cozinha@kianda.teste"), papel: "cozinha" },
  { company_id: empresa, user_id: pessoa("bar@kianda.teste"), papel: "bar" },
]);
ok(eq.d?.length === 3, "o gerente atribui papéis à equipa", JSON.stringify(eq));
r = await joao.criar("equipa", [{ company_id: empresa, user_id: pessoa("semacesso@kianda.teste"), papel: "gerente" }]);
ok(!!r.erro, "um empregado não consegue dar papéis");
r = await joao.rpc("eu");
ok(r.d?.papel === "empregado", "o João passa a empregado");

// --- sala, mesas e menu
const area = (await dono.ver("areas")).d[0];
r = await dono.criar("mesas", [1, 2, 3, 4, 5, 6].map((n) => ({ company_id: empresa, area_id: area.id, nome: String(n), ordem: n })));
ok(r.d?.length === 6 && r.d.every((m) => m.codigo.length >= 12), "seis mesas criadas, cada uma com o seu código");
const mesa = Object.fromEntries(r.d.map((m) => [m.nome, m]));
r = await dono.criar("menu_categorias", [
  { company_id: empresa, nome: "Pratos", estacao_id: estCozinha, ordem: 1 },
  { company_id: empresa, nome: "Entradas", estacao_id: estCozinha, ordem: 2 },
  { company_id: empresa, nome: "Bebidas", estacao_id: estBar, ordem: 3 },
  { company_id: empresa, nome: "Sobremesas", estacao_id: estCozinha, ordem: 4 },
]);
const cat = Object.fromEntries(r.d.map((c) => [c.nome, c.id]));
r = await dono.rpc("produtos_boss");
ok(r.d?.length === 10 && !r.d.some((p) => p.nome.includes("outra empresa")), "o catálogo vem do BOSS e só da própria empresa", `${r.d?.length}`);
ok(r.d.find((p) => p.nome === "Mufete").preco === 9500, "o preço do menu já traz o IVA (Mufete: 9 500 Kz)", String(r.d.find((p) => p.nome === "Mufete")?.preco));
const itens = r.d.filter((p) => cat[p.categoria]).map((p, i) => ({ company_id: empresa, product_id: p.product_id, categoria_id: cat[p.categoria], ordem: i }));
r = await dono.criar("menu_itens", itens);
ok(r.d?.length === 9, "nove artigos no menu (o serviço de consultoria fica de fora)");
r = await joao.rpc("menu");
const artigo = Object.fromEntries(r.d.flatMap((c) => c.itens).map((i) => [i.nome, i.id]));
ok(Object.keys(artigo).length === 9, "o empregado lê o menu");
r = await outro.criar("menu_itens", [{ company_id: empresa, product_id: itens[0].product_id, categoria_id: cat.Pratos }]);
ok(!!r.erro, "outra empresa não consegue escrever no menu do Kianda");

// --- mesa 5: pedido, cozinha e bar
r = await joao.rpc("abrir_mesa", { p_mesa: mesa["5"].id, p_pessoas: 4 });
const pedido = r.d;
ok(typeof pedido === "string", "o João abre a mesa 5", JSON.stringify(r));
ok((await joao.rpc("abrir_mesa", { p_mesa: mesa["5"].id })).d === pedido, "abrir a mesma mesa outra vez devolve o mesmo pedido");
await joao.rpc("adicionar", { p_pedido: pedido, p_item: artigo["Mufete"], p_quantidade: 2, p_nota: "Sem cebola" });
const bife = (await joao.rpc("adicionar", { p_pedido: pedido, p_item: artigo["Bife à casa"], p_quantidade: 1 })).d;
const cuca = (await joao.rpc("adicionar", { p_pedido: pedido, p_item: artigo["Cuca"], p_quantidade: 4 })).d;
r = await joao.rpc("adicionar", { p_pedido: pedido, p_item: artigo["Cuca"], p_quantidade: 1 });
ok(r.d === cuca, "pedir mais uma Cuca soma à linha que ainda não foi enviada");
await joao.rpc("alterar_linha", { p_linha: cuca, p_quantidade: 4 });
r = await joao.rpc("pedido", { p_pedido: pedido });
ok(r.d?.linhas?.length === 3 && r.d.por_enviar === 3 && r.d.total === 34800, "três linhas por enviar, total 34 800 Kz", `${r.d?.total}`);
ok((await joao.rpc("enviar", { p_pedido: pedido })).d === 3, "enviar manda as três linhas");

r = await cozinha.rpc("fila", { p_estacao: estCozinha });
ok(r.d?.length === 1 && r.d[0].linhas.length === 2 && r.d[0].mesa_nome === "5", "a cozinha recebe um pedido da mesa 5 com os dois pratos", JSON.stringify(r));
const linhasCozinha = r.d[0].linhas.map((l) => l.id);
r = await bar.rpc("fila", { p_estacao: estBar });
ok(r.d?.length === 1 && r.d[0].linhas[0].nome === "Cuca", "o bar recebe só as bebidas");
ok(!!(await cozinha.rpc("sala")).erro, "a cozinha não vê a sala");
ok(!!(await cozinha.rpc("fechar_conta", { p_pedido: pedido, p_forma: "numerario" })).erro, "a cozinha não fecha contas");
ok((await cozinha.rpc("avancar", { p_linhas: linhasCozinha, p_estado: "a_preparar" })).d === 2, "a cozinha começa os dois pratos");
ok((await cozinha.rpc("avancar", { p_linhas: linhasCozinha, p_estado: "pronto" })).d === 2, "a cozinha marca pronto");
ok((await bar.rpc("avancar", { p_linhas: r.d[0].linhas.map((l) => l.id), p_estado: "pronto" })).d === 1, "o bar marca a bebida pronta");
r = await joao.rpc("sala");
const m5 = () => r.d.areas[0].mesas.find((m) => m.nome === "5");
ok(m5().pedido?.prontos === 3, "o João vê na sala que há três linhas prontas");
ok(!!(await joao.rpc("alterar_linha", { p_linha: bife, p_quantidade: 0 })).erro, "o João não consegue tirar um prato já enviado");
ok(!!(await joao.rpc("anular_linha", { p_linha: bife, p_motivo: "Cliente desistiu" })).erro, "o João não consegue anular (só o gerente)");
ok(!!(await dono.rpc("anular_linha", { p_linha: bife, p_motivo: "" })).erro, "o gerente não anula sem escrever o motivo");
ok(!(await dono.rpc("anular_linha", { p_linha: bife, p_motivo: "Cliente desistiu do bife" })).erro, "o gerente anula com motivo");
ok((await joao.rpc("avancar", { p_linhas: [cuca, ...linhasCozinha], p_estado: "servido" })).d === 2, "o João marca servido (a linha anulada não conta)");

// --- menu por QR
r = await publico.rpc("publico_menu", { p_codigo: mesa["5"].codigo });
ok(r.d?.mesa === "5" && r.d.categorias.length === 4 && r.d.restaurante === "Restaurante Kianda", "o cliente lê o QR e vê o menu da mesa 5", JSON.stringify(r).slice(0, 200));
ok((await publico.rpc("publico_menu", { p_codigo: "codigo-inventado" })).d === null, "um código inventado não mostra nada");
ok(!!(await publico.rpc("publico_pedir", { p_codigo: mesa["1"].codigo, p_linhas: [{ item: artigo["Mufete"], quantidade: 1 }] })).erro, "o cliente não consegue pedir numa mesa que o empregado não abriu");
await dono.mudar("menu_itens", `id=eq.${artigo["Doce de ginguba"]}`, { esgotado: true });
ok(!!(await publico.rpc("publico_pedir", { p_codigo: mesa["5"].codigo, p_linhas: [{ item: artigo["Doce de ginguba"], quantidade: 1 }] })).erro, "um artigo esgotado não se consegue pedir");
r = await publico.rpc("publico_pedir", { p_codigo: mesa["5"].codigo, p_linhas: [{ item: artigo["Calulu de peixe"], quantidade: 1, nota: "Pouco sal", preco: 1 }] });
ok(r.d?.linhas === 1 && r.d.confirmacao === true, "o cliente pede um calulu; fica à espera do empregado", JSON.stringify(r));
r = await joao.rpc("pedido", { p_pedido: pedido });
ok(r.d.por_confirmar === 1 && r.d.total === 23800, "o pedido do cliente aparece por confirmar e ainda não entra no total", `${r.d.por_confirmar} ${r.d.total}`);
ok(r.d.linhas.find((l) => l.nome === "Calulu de peixe").preco === 8000, "o preço é o do BOSS, não o que o telemóvel mandou");
ok((await cozinha.rpc("fila", { p_estacao: estCozinha })).d.every((t) => !t.linhas.some((l) => l.nome === "Calulu de peixe")), "a cozinha ainda não vê o pedido por confirmar");
ok(!!(await joao.rpc("fechar_conta", { p_pedido: pedido, p_forma: "numerario" })).erro, "não se fecha a conta com um pedido por confirmar");
ok((await joao.rpc("responder_cliente", { p_pedido: pedido, p_aceitar: true })).d === 1, "o João confirma o pedido do cliente");
ok((await cozinha.rpc("fila", { p_estacao: estCozinha })).d.some((t) => t.linhas.some((l) => l.nome === "Calulu de peixe")), "agora a cozinha vê o calulu");
r = await publico.rpc("publico_estado", { p_codigo: mesa["5"].codigo });
ok(r.d?.aberta && r.d.linhas.length === 3 && r.d.total === 31800, "o cliente acompanha: três artigos, 31 800 Kz", JSON.stringify(r.d).slice(0, 160));
ok(!(await publico.rpc("publico_chamar", { p_codigo: mesa["5"].codigo, p_tipo: "conta" })).erro, "o cliente pede a conta pelo telemóvel");
r = await joao.rpc("sala");
ok(m5().pedido.estado === "conta_pedida" && !!m5().pedido.chamada_em, "a sala mostra a mesa 5 com a conta pedida");
ok(!!(await publico.rpc("publico_pedir", { p_codigo: mesa["5"].codigo, p_linhas: [{ item: artigo["Cuca"], quantidade: 1 }] })).erro, "com a conta pedida, o cliente já não pede mais");

// --- a conta e a factura
r = await joao.rpc("conta", { p_pedido: pedido });
ok(r.d?.total === 31800 && r.d.linhas.length === 3 && r.d.cliente?.nome === "Consumidor Final", "a conta: três linhas, 31 800 Kz, Consumidor Final", JSON.stringify(r.d).slice(0, 200));
ok(Math.abs(r.d.subtotal + r.d.iva - r.d.total) < 0.001, "subtotal + IVA = total");
ok(!!(await joao.rpc("fechar_conta", { p_pedido: pedido, p_forma: "cheque" })).erro, "não fecha sem uma forma de pagamento válida");
r = await joao.rpc("fechar_conta", { p_pedido: pedido, p_forma: "numerario" });
ok(r.d?.total === 31800 && /^FR /.test(r.d.factura_numero ?? ""), "o empregado fecha a conta e sai a Factura-Recibo", JSON.stringify(r));
const factura1 = r.d?.invoice_id;
ok(!!(await joao.rpc("fechar_conta", { p_pedido: pedido, p_forma: "numerario" })).erro, "a mesma conta não se fecha duas vezes");

// --- o talão da factura
r = await joao.rpc("talao", { p_pedido: pedido });
ok(r.d?.invoice?.document_type === "FR" && r.d.invoice.total === 31800 && r.d.items?.length === 3 && !!r.d.invoice.hash,
  "o empregado recebe os dados do talão: Factura-Recibo, 31 800 Kz, três linhas", JSON.stringify(r).slice(0, 300));
ok(r.d?.company?.nif === "5000000000" && r.d.client?.name === "Consumidor Final" && r.d.settings?.city === "Luanda", "o talão traz a empresa, a cidade e o cliente");
ok(Math.abs(r.d.items.reduce((t, i) => t + i.total, 0) - r.d.invoice.total) < 0.001, "as linhas do talão somam o total da factura");
ok(!!(await cozinha.rpc("talao", { p_pedido: pedido })).erro, "a cozinha não imprime talões");
ok(!!(await publico.rpc("talao", { p_pedido: pedido })).erro, "quem não entrou não lê talões");
r = await joao.rpc("sala");
ok(m5().pedido === null, "a mesa 5 volta a ficar livre");
ok((await publico.rpc("publico_estado", { p_codigo: mesa["5"].codigo })).d?.aberta === false, "para o cliente, a mesa está fechada");

// --- venda ao balcão, com cliente com NIF
const balcao = (await joao.rpc("abrir_balcao")).d;
await joao.rpc("adicionar", { p_pedido: balcao, p_item: artigo["Água 1,5 L"], p_quantidade: 1 });
await joao.rpc("enviar", { p_pedido: balcao });
r = await bar.rpc("fila", { p_estacao: estBar });
ok(r.d.some((t) => t.tipo === "balcao" && t.mesa_nome === null), "o pedido de balcão aparece no bar sem mesa");
r = await joao.rpc("clientes", { p_texto: "Sonan" });
ok(r.d?.length === 1, "procura o cliente pelo nome");
r = await joao.rpc("fechar_conta", { p_pedido: balcao, p_forma: "multicaixa", p_cliente: r.d[0].id });
ok(r.d?.total === 1200 && r.d.invoice_id !== factura1, "venda ao balcão facturada ao cliente com NIF: 1 200 Kz", JSON.stringify(r));

// --- mesa aberta por engano
const engano = (await joao.rpc("abrir_mesa", { p_mesa: mesa["2"].id })).d;
await joao.rpc("adicionar", { p_pedido: engano, p_item: artigo["Kitaba"], p_quantidade: 1 });
ok(!(await joao.rpc("cancelar_pedido", { p_pedido: engano })).erro, "uma mesa aberta por engano, sem nada enviado, fecha-se sem factura");
ok(!!(await joao.rpc("talao", { p_pedido: engano })).erro, "um pedido sem factura não tem talão");

// --- pedidos directos e travão
await dono.mudar("definicoes", `company_id=eq.${empresa}`, { pedidos_directos: true });
const directa = (await joao.rpc("abrir_mesa", { p_mesa: mesa["3"].id })).d;
r = await publico.rpc("publico_pedir", { p_codigo: mesa["3"].codigo, p_linhas: [{ item: artigo["Sumo de múcua"], quantidade: 2 }] });
ok(r.d?.confirmacao === false, "com «pedidos directos» ligado, o pedido do cliente não espera confirmação");
ok((await bar.rpc("fila", { p_estacao: estBar })).d.some((t) => t.mesa_nome === "3"), "e chega logo ao bar");
let travou = false;
for (let i = 0; i < 9 && !travou; i++) travou = !!(await publico.rpc("publico_pedir", { p_codigo: mesa["3"].codigo, p_linhas: [{ item: artigo["Sumo de múcua"], quantidade: 1 }] })).erro;
ok(travou, "muitos pedidos seguidos da mesma mesa são travados");
await dono.mudar("definicoes", `company_id=eq.${empresa}`, { pedidos_directos: false });

// --- isolamento entre empresas e público
await outro.rpc("activar");
ok(!!(await outro.rpc("pedido", { p_pedido: directa })).erro, "outra empresa não lê um pedido do Kianda");
ok(!!(await outro.rpc("talao", { p_pedido: pedido })).erro, "outra empresa não lê o talão de uma factura do Kianda");
ok(!!(await outro.rpc("abrir_mesa", { p_mesa: mesa["4"].id })).erro, "outra empresa não abre uma mesa do Kianda");
ok(((await outro.ver("mesas")).d ?? []).length === 0, "outra empresa não vê as mesas do Kianda");
ok(((await outro.ver("pedido_linhas")).d ?? []).length === 0, "outra empresa não vê as linhas dos pedidos");
ok(((await sem.ver("mesas")).d ?? []).length === 0, "uma pessoa da empresa sem papel no restaurante não vê as mesas");
r = await publico.ver("mesas");
ok(!!r.erro || (r.d ?? []).length === 0, "sem login, as mesas (e os códigos) não se lêem");
ok(!!(await publico.rpc("sala")).erro, "sem login, a sala não se lê");
ok(((await joao.ver("pedidos", "select=id,estado")).d ?? []).length >= 3, "o empregado lê os pedidos da sua empresa (para as actualizações ao vivo)");

// --- fecho do dia
r = await dono.rpc("fecho_do_dia");
ok(r.d?.total === 33000 && r.d.contas === 2 && r.d.por_forma.numerario === 31800 && r.d.por_forma.multicaixa === 1200, "fecho do dia: 33 000 Kz em duas contas, por forma de pagamento", JSON.stringify(r.d));
ok(!!(await joao.rpc("fecho_do_dia")).erro, "o fecho do dia é só para o gerente");

console.log(`\n${passou} passaram, ${falhou} falharam`);
process.exit(falhou ? 1 : 0);
