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
    // funções e tabelas do BOSS (esquema public): os módulos e, só na base de testes, a troca de plano
    pub: async (fn, args = {}) => ler(await fetch(`${URL}/rest/v1/rpc/${fn}`, { method: "POST", headers: h, body: JSON.stringify(args) })),
    verPub: async (tabela, q = "select=*") => ler(await fetch(`${URL}/rest/v1/${tabela}?${q}`, { headers: h })),
    ver: async (tabela, q = "select=*") => ler(await fetch(`${URL}/rest/v1/${tabela}?${q}`, { headers: { ...h, "Accept-Profile": "restaurante" } })),
    criarPub: async (tabela, linhas) => ler(await fetch(`${URL}/rest/v1/${tabela}`, { method: "POST", headers: { ...h, Prefer: "return=representation" }, body: JSON.stringify(linhas) })),
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

// --- módulos: que planos podem ligar o restaurante
const modulo = (st, nome = "restaurante") => st?.modulos?.find((m) => m.modulo === nome);
let r = await dono.pub("company_modules_status");
ok(r.d?.plano === "start" && r.d.limite === 1 && r.d.pode_gerir === true && modulo(r.d)?.estado === "desligado" && modulo(r.d)?.bloqueio === null,
  "BOSS Start: o dono pode ligar um módulo e o restaurante ainda está desligado", JSON.stringify(r));
ok(modulo(r.d, "hotel")?.disponivel === false && r.d.modulos.length === 5, "os outros módulos aparecem, mas ainda não se podem ligar");
ok((await joao.pub("company_modules_status")).d?.pode_gerir === false, "um empregado vê os módulos mas não os gere");
ok(!!(await publico.pub("company_modules_status")).erro, "sem login, os módulos não se lêem");
ok(!!(await joao.pub("company_module_activate", { p_module: "restaurante" })).erro, "um empregado não liga módulos");
await dono.pub("teste_definir_plano", { p_plano: "solo" });
r = await dono.rpc("eu");
ok(r.d?.modulo === "desligado" && /BOSS Start/.test(r.d.bloqueio ?? ""), "BOSS Solo: o dono vê que os módulos são a partir do BOSS Start", JSON.stringify(r.d));
r = await dono.rpc("activar", { p_nome: "Restaurante Kianda" });
ok(/BOSS Start/.test(r.erro ?? ""), "no BOSS Solo, o restaurante não se liga", JSON.stringify(r));
await dono.pub("teste_definir_plano", { p_plano: "facturacao" });
ok(!!(await dono.rpc("activar")).erro && !!(await dono.pub("company_module_activate", { p_module: "restaurante" })).erro, "no BOSS Factura, o restaurante não se liga (por nenhum dos dois caminhos)");
await dono.pub("teste_definir_plano", { p_plano: "start", p_dias: -1 });
r = await dono.rpc("activar");
ok(/subscrição/i.test(r.erro ?? ""), "com a subscrição caducada, o restaurante não se liga", JSON.stringify(r));
await dono.pub("teste_definir_plano", { p_plano: "start" });
ok(/disponível/.test((await dono.pub("company_module_activate", { p_module: "hotel" })).erro ?? ""), "um módulo que ainda não existe não se liga");
ok(!!(await dono.pub("company_module_activate", { p_module: "xpto" })).erro, "um módulo inventado é recusado");
ok(((await dono.verPub("company_modules")).d ?? []).length === 0, "depois das recusas, nenhum módulo ficou ligado");

// --- ligar o restaurante e montar a equipa
r = await dono.rpc("eu");
ok(r.d?.activo === false && r.d?.gere_empresa === true && r.d.bloqueio === null, "antes de ligar: o dono vê o restaurante desligado e pode ligá-lo");
r = await joao.rpc("activar");
ok(!!r.erro, "um empregado não consegue ligar o restaurante");
r = await dono.rpc("activar", { p_nome: "Restaurante Kianda" });
ok(r.d?.activo === true && r.d?.papel === "gerente" && r.d?.estacoes?.length === 2, "o dono liga o restaurante: gerente, com Cozinha e Bar", JSON.stringify(r));
const [estCozinha, estBar] = ["cozinha", "bar"].map((t) => r.d.estacoes.find((e) => e.tipo === t).id);
const empresa = r.d.company_id;
ok(r.d.modulo === "activo" && modulo((await dono.pub("company_modules_status")).d)?.estado === "activo", "ligar o restaurante regista o módulo na empresa");

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
ok(r.d?.codigo_visita === true, "o menu diz que esta mesa pede o código da visita");
ok((await publico.rpc("publico_menu", { p_codigo: "codigo-inventado" })).d === null, "um código inventado não mostra nada");
ok(!!(await publico.rpc("publico_pedir", { p_codigo: mesa["1"].codigo, p_linhas: [{ item: artigo["Mufete"], quantidade: 1 }] })).erro, "o cliente não consegue pedir numa mesa que o empregado não abriu");

// --- código da visita: uma fotografia do QR não chega para pedir
r = await publico.rpc("publico_estado", { p_codigo: mesa["5"].codigo });
ok(r.d?.aberta === true && r.d.precisa_codigo === true && r.d.linhas === undefined && r.d.total === undefined, "só com o QR, vê-se que a mesa está aberta mas não o que ela pediu", JSON.stringify(r).slice(0, 160));
r = await publico.rpc("publico_pedir", { p_codigo: mesa["5"].codigo, p_linhas: [{ item: artigo["Calulu de peixe"], quantidade: 1 }] });
ok(/código da mesa/.test(r.erro ?? ""), "só com o QR, o cliente não consegue pedir", JSON.stringify(r));
ok(!!(await publico.rpc("publico_chamar", { p_codigo: mesa["5"].codigo, p_tipo: "conta" })).erro, "nem pedir a conta ou chamar o empregado");
const visita5 = (await joao.rpc("pedido", { p_pedido: pedido })).d?.codigo_visita;
ok(/^\d{4}$/.test(visita5 ?? ""), "o empregado vê no ecrã da mesa o código de 4 algarismos", String(visita5));
const errado = (v) => String((Number(v) + 1) % 10000).padStart(4, "0");
r = await publico.rpc("publico_entrar", { p_codigo: mesa["5"].codigo, p_visita: errado(visita5) });
ok(r.d?.ok === false && r.d.motivo === "errado" && r.d.chave === undefined, "um código errado não entra", JSON.stringify(r));
r = await publico.rpc("publico_entrar", { p_codigo: mesa["1"].codigo, p_visita: visita5 });
ok(r.d?.ok === false && r.d.motivo === "fechada", "numa mesa que não está aberta, não há código que sirva", JSON.stringify(r));
r = await publico.rpc("publico_entrar", { p_codigo: mesa["5"].codigo, p_visita: visita5 });
ok(r.d?.ok === true && (r.d.chave ?? "").length >= 20, "com o código certo, o telemóvel recebe a chave da visita", JSON.stringify(r).slice(0, 80));
const chave5 = r.d?.chave;
ok(/código da mesa/.test((await publico.rpc("publico_pedir", { p_codigo: mesa["5"].codigo, p_linhas: [{ item: artigo["Calulu de peixe"], quantidade: 1 }], p_chave: "chave-inventada" })).erro ?? ""), "uma chave inventada não serve");
ok(!!(await publico.rpc("publico_pedir", { p_codigo: mesa["5"].codigo, p_linhas: [{ item: artigo["Calulu de peixe"], quantidade: 1 }], p_chave: visita5 })).erro, "o código de 4 algarismos não se usa no lugar da chave");

await dono.mudar("menu_itens", `id=eq.${artigo["Doce de ginguba"]}`, { esgotado: true });
ok(!!(await publico.rpc("publico_pedir", { p_codigo: mesa["5"].codigo, p_linhas: [{ item: artigo["Doce de ginguba"], quantidade: 1 }], p_chave: chave5 })).erro, "um artigo esgotado não se consegue pedir");
r = await publico.rpc("publico_pedir", { p_codigo: mesa["5"].codigo, p_linhas: [{ item: artigo["Calulu de peixe"], quantidade: 1, nota: "Pouco sal", preco: 1 }], p_chave: chave5 });
ok(r.d?.linhas === 1 && r.d.confirmacao === true, "o cliente pede um calulu; fica à espera do empregado", JSON.stringify(r));
r = await joao.rpc("pedido", { p_pedido: pedido });
ok(r.d.por_confirmar === 1 && r.d.total === 23800, "o pedido do cliente aparece por confirmar e ainda não entra no total", `${r.d.por_confirmar} ${r.d.total}`);
ok(r.d.linhas.find((l) => l.nome === "Calulu de peixe").preco === 8000, "o preço é o do BOSS, não o que o telemóvel mandou");
ok((await cozinha.rpc("fila", { p_estacao: estCozinha })).d.every((t) => !t.linhas.some((l) => l.nome === "Calulu de peixe")), "a cozinha ainda não vê o pedido por confirmar");
ok(!!(await joao.rpc("fechar_conta", { p_pedido: pedido, p_forma: "numerario" })).erro, "não se fecha a conta com um pedido por confirmar");
ok((await joao.rpc("responder_cliente", { p_pedido: pedido, p_aceitar: true })).d === 1, "o João confirma o pedido do cliente");
ok((await cozinha.rpc("fila", { p_estacao: estCozinha })).d.some((t) => t.linhas.some((l) => l.nome === "Calulu de peixe")), "agora a cozinha vê o calulu");
r = await publico.rpc("publico_estado", { p_codigo: mesa["5"].codigo, p_chave: chave5 });
ok(r.d?.aberta && r.d.linhas.length === 3 && r.d.total === 31800, "o cliente acompanha: três artigos, 31 800 Kz", JSON.stringify(r.d).slice(0, 160));
ok(!(await publico.rpc("publico_chamar", { p_codigo: mesa["5"].codigo, p_tipo: "conta", p_chave: chave5 })).erro, "o cliente pede a conta pelo telemóvel");
r = await joao.rpc("sala");
ok(m5().pedido.estado === "conta_pedida" && !!m5().pedido.chamada_em, "a sala mostra a mesa 5 com a conta pedida");
ok(/conta desta mesa/.test((await publico.rpc("publico_pedir", { p_codigo: mesa["5"].codigo, p_linhas: [{ item: artigo["Cuca"], quantidade: 1 }], p_chave: chave5 })).erro ?? ""), "com a conta pedida, o cliente já não pede mais");

// --- a conta e a factura
r = await joao.rpc("conta", { p_pedido: pedido });
ok(r.d?.total === 31800 && r.d.linhas.length === 3 && r.d.cliente?.nome === "Consumidor Final", "a conta: três linhas, 31 800 Kz, Consumidor Final", JSON.stringify(r.d).slice(0, 200));
ok(Math.abs(r.d.subtotal + r.d.iva - r.d.total) < 0.001, "subtotal + IVA = total");
ok(!!(await joao.rpc("fechar_conta", { p_pedido: pedido, p_forma: "cheque" })).erro, "não fecha sem uma forma de pagamento válida");
r = await joao.rpc("fechar_conta", { p_pedido: pedido, p_forma: "numerario" });
ok(r.d?.total === 31800 && /^FR /.test(r.d.factura_numero ?? ""), "o empregado fecha a conta e sai a Factura-Recibo", JSON.stringify(r));
const factura1 = r.d?.invoice_id, talao1 = r.d?.factura_id;
ok(r.d?.fechado === true && r.d.falta === 0, "paga a conta toda, o pedido fica fechado");
ok(!!(await joao.rpc("fechar_conta", { p_pedido: pedido, p_forma: "numerario" })).erro, "a mesma conta não se fecha duas vezes");

// --- o talão da factura
r = await joao.rpc("talao", { p_factura: talao1 });
ok(r.d?.invoice?.document_type === "FR" && r.d.invoice.total === 31800 && r.d.items?.length === 3 && !!r.d.invoice.hash,
  "o empregado recebe os dados do talão: Factura-Recibo, 31 800 Kz, três linhas", JSON.stringify(r).slice(0, 300));
ok(r.d?.company?.nif === "5000000000" && r.d.client?.name === "Consumidor Final" && r.d.settings?.city === "Luanda", "o talão traz a empresa, a cidade e o cliente");
ok(Math.abs(r.d.items.reduce((t, i) => t + i.total, 0) - r.d.invoice.total) < 0.001, "as linhas do talão somam o total da factura");
ok(!!(await cozinha.rpc("talao", { p_factura: talao1 })).erro, "a cozinha não imprime talões");
ok(!!(await publico.rpc("talao", { p_factura: talao1 })).erro, "quem não entrou não lê talões");
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
ok(!!(await joao.rpc("talao", { p_factura: engano })).erro, "um pedido sem factura não tem talão");

// --- pedidos directos e travão
await dono.mudar("definicoes", `company_id=eq.${empresa}`, { pedidos_directos: true });
const directa = (await joao.rpc("abrir_mesa", { p_mesa: mesa["3"].id })).d;
const visita3 = (await joao.rpc("pedido", { p_pedido: directa })).d?.codigo_visita;
ok((await publico.rpc("publico_estado", { p_codigo: mesa["3"].codigo, p_chave: chave5 })).d?.precisa_codigo === true, "a chave de uma visita não serve noutra mesa");
const chave3 = (await publico.rpc("publico_entrar", { p_codigo: mesa["3"].codigo, p_visita: ` ${visita3} ` })).d?.chave;
ok(!!chave3 && chave3 !== chave5, "cada visita tem a sua chave");
r = await publico.rpc("publico_pedir", { p_codigo: mesa["3"].codigo, p_linhas: [{ item: artigo["Sumo de múcua"], quantidade: 2 }], p_chave: chave3 });
ok(r.d?.confirmacao === false, "com «pedidos directos» ligado, o pedido do cliente não espera confirmação");
ok((await bar.rpc("fila", { p_estacao: estBar })).d.some((t) => t.mesa_nome === "3"), "e chega logo ao bar");
let travou = false;
for (let i = 0; i < 9 && !travou; i++) travou = /Demasiados pedidos/.test((await publico.rpc("publico_pedir", { p_codigo: mesa["3"].codigo, p_linhas: [{ item: artigo["Sumo de múcua"], quantidade: 1 }], p_chave: chave3 })).erro ?? "");
ok(travou, "muitos pedidos seguidos da mesma mesa são travados");
await dono.mudar("definicoes", `company_id=eq.${empresa}`, { pedidos_directos: false });

// --- código da visita: tentativas a mais, visita seguinte e restaurante que o dispensa
let motivos = [];
for (let i = 0; i < 8; i++) motivos.push((await publico.rpc("publico_entrar", { p_codigo: mesa["3"].codigo, p_visita: errado(visita3) })).d?.motivo);
ok(motivos.every((m) => m === "errado"), "oito códigos errados seguidos são recusados um a um", motivos.join(","));
r = await publico.rpc("publico_entrar", { p_codigo: mesa["3"].codigo, p_visita: visita3 });
ok(r.d?.ok === false && r.d.motivo === "bloqueado", "depois disso, nem o código certo entra durante uns minutos (não se adivinha por tentativas)", JSON.stringify(r));
ok(Array.isArray((await publico.rpc("publico_estado", { p_codigo: mesa["3"].codigo, p_chave: chave3 })).d?.linhas), "quem já tinha entrado continua a acompanhar a mesa");
const visitaA = (await joao.rpc("abrir_mesa", { p_mesa: mesa["2"].id })).d;
const chaveA = (await publico.rpc("publico_entrar", { p_codigo: mesa["2"].codigo, p_visita: (await joao.rpc("pedido", { p_pedido: visitaA })).d?.codigo_visita })).d?.chave;
ok(Array.isArray((await publico.rpc("publico_estado", { p_codigo: mesa["2"].codigo, p_chave: chaveA })).d?.linhas), "na mesa 2, o cliente entra com o código desta visita");
await joao.rpc("cancelar_pedido", { p_pedido: visitaA });
const visitaB = (await joao.rpc("abrir_mesa", { p_mesa: mesa["2"].id })).d;
ok((await publico.rpc("publico_estado", { p_codigo: mesa["2"].codigo, p_chave: chaveA })).d?.precisa_codigo === true, "na visita seguinte da mesma mesa, a chave antiga já não serve");
await dono.mudar("definicoes", `company_id=eq.${empresa}`, { codigo_visita: false });
r = await publico.rpc("publico_estado", { p_codigo: mesa["2"].codigo });
ok(r.d?.aberta === true && Array.isArray(r.d.linhas) && r.d.precisa_codigo === undefined, "restaurante que dispensa o código: basta o QR, como antes", JSON.stringify(r));
ok((await joao.rpc("pedido", { p_pedido: visitaB })).d?.codigo_visita === null && (await publico.rpc("publico_menu", { p_codigo: mesa["2"].codigo })).d?.codigo_visita === false, "e o empregado deixa de ver código na mesa");
ok(!(await publico.rpc("publico_chamar", { p_codigo: mesa["2"].codigo, p_tipo: "empregado" })).erro, "sem código, o cliente chama o empregado só com o QR");
await joao.mudar("definicoes", `company_id=eq.${empresa}`, { codigo_visita: true });
ok((await dono.rpc("eu")).d?.restaurante?.codigo_visita === false, "um empregado não muda esta definição");
await dono.mudar("definicoes", `company_id=eq.${empresa}`, { codigo_visita: true });
ok((await dono.rpc("eu")).d?.restaurante?.codigo_visita === true, "o gerente volta a ligar o código");
ok(!(await joao.rpc("cancelar_pedido", { p_pedido: visitaB })).erro, "a mesa 2 aberta para a prova fecha-se sem factura");

// --- isolamento entre empresas e público
await outro.rpc("activar");
ok(!!(await outro.rpc("pedido", { p_pedido: directa })).erro, "outra empresa não lê um pedido do Kianda");
ok(!!(await outro.rpc("talao", { p_factura: talao1 })).erro, "outra empresa não lê o talão de uma factura do Kianda");
ok(!!(await outro.rpc("abrir_mesa", { p_mesa: mesa["4"].id })).erro, "outra empresa não abre uma mesa do Kianda");
ok(((await outro.ver("mesas")).d ?? []).length === 0, "outra empresa não vê as mesas do Kianda");
ok(((await outro.ver("pedido_linhas")).d ?? []).length === 0, "outra empresa não vê as linhas dos pedidos");
ok(((await sem.ver("mesas")).d ?? []).length === 0, "uma pessoa da empresa sem papel no restaurante não vê as mesas");
r = await publico.ver("mesas");
ok(!!r.erro || (r.d ?? []).length === 0, "sem login, as mesas (e os códigos) não se lêem");
ok(!!(await publico.rpc("sala")).erro, "sem login, a sala não se lê");
ok(((await joao.ver("pedidos", "select=id,estado")).d ?? []).length >= 3, "o empregado lê os pedidos da sua empresa (para as actualizações ao vivo)");

// --- conta dividida por várias pessoas (uma só factura, várias partes)
const div = (await joao.rpc("abrir_mesa", { p_mesa: mesa["6"].id, p_pessoas: 4 })).d;
await joao.rpc("adicionar", { p_pedido: div, p_item: artigo["Mufete"], p_quantidade: 1 });
await joao.rpc("adicionar", { p_pedido: div, p_item: artigo["Cuca"], p_quantidade: 1 });
await joao.rpc("enviar", { p_pedido: div });
const T = (await joao.rpc("conta", { p_pedido: div })).d.total;
ok(T === 10700, "a conta a dividir é de 10 700 Kz", String(T));
const fechar = (partes) => joao.rpc("fechar_conta", { p_pedido: div, p_forma: null, p_partes: partes });
ok(!!(await fechar([{ forma: "numerario", valor: 5000 }, { forma: "multicaixa", valor: 5000 }])).erro, "partes que não somam o total são recusadas");
ok(!!(await fechar([{ forma: "numerario", valor: 6000 }, { forma: "multicaixa", valor: 5000 }])).erro, "partes que passam o total são recusadas");
ok(!!(await fechar([{ forma: "numerario", valor: T }])).erro, "dividir pede pelo menos duas partes");
ok(!!(await fechar([{ forma: "cheque", valor: 5700 }, { forma: "multicaixa", valor: 5000 }])).erro, "cada parte tem de ter uma forma de pagamento válida");
ok(!!(await fechar([{ forma: "numerario", valor: T + 100 }, { forma: "multicaixa", valor: -100 }])).erro, "uma parte não pode ser negativa");
ok(!!(await fechar([{ forma: "numerario", valor: "abc" }, { forma: "multicaixa", valor: 5000 }])).erro, "uma parte tem de ser um número");
ok(!!(await fechar([{ forma: "numerario", valor: 5350.005 }, { forma: "multicaixa", valor: 5349.995 }])).erro, "uma parte não tem mais de dois decimais");
ok((await joao.rpc("pedido", { p_pedido: div })).d?.estado === "aberto", "depois das recusas, a conta continua aberta e sem factura");
r = await fechar([{ forma: "numerario", valor: 3566.66 }, { forma: "multicaixa", valor: 3566.67 }, { forma: "multicaixa", valor: 3566.67 }]);
ok(r.d?.total === T && /^FR /.test(r.d.factura_numero ?? "") && r.d.pagamentos?.length === 3, "três pessoas pagam a conta: uma só Factura-Recibo, três partes", JSON.stringify(r));
const talaoDiv = r.d?.factura_id;
ok(!!(await fechar([{ forma: "numerario", valor: 5700 }, { forma: "multicaixa", valor: 5000 }])).erro, "uma conta dividida não se fecha duas vezes");
r = await joao.rpc("pedido", { p_pedido: div });
ok(r.d?.pagamentos?.length === 3 && r.d.pagamentos[0].forma === "numerario" && r.d.pagamentos[0].valor === 3566.66, "o pedido guarda as partes pela ordem em que foram pagas", JSON.stringify(r.d?.pagamentos));
r = await joao.rpc("pedido", { p_pedido: pedido });
ok(r.d?.pagamentos?.length === 1 && r.d.pagamentos[0].valor === 31800, "uma conta paga por uma pessoa tem uma só parte");
ok((await joao.rpc("talao", { p_factura: talaoDiv })).d?.invoice?.total === T, "o talão da conta dividida é o da factura inteira");
ok(((await outro.ver("pedido_pagamentos")).d ?? []).length === 0, "outra empresa não vê os pagamentos do Kianda");
r = await publico.ver("pedido_pagamentos");
ok(!!r.erro || (r.d ?? []).length === 0, "sem login, os pagamentos não se lêem");
ok(!!(await joao.criar("pedido_pagamentos", [{ company_id: empresa, pedido_id: div, ordem: 9, forma: "numerario", valor: 1 }])).erro, "ninguém escreve pagamentos à mão");

// --- facturas separadas: cada pessoa paga o que escolheu e leva a sua factura
r = await joao.rpc("pedido", { p_pedido: pedido });
ok(r.d?.facturas?.length === 1 && r.d.facturas[0].id === talao1 && r.d.total === 31800 && r.d.pago === 31800, "um pedido fechado mostra a sua factura e o que foi facturado", JSON.stringify(r.d?.facturas));
const sep = (await joao.rpc("abrir_mesa", { p_mesa: mesa["1"].id, p_pessoas: 3 })).d;
await joao.rpc("adicionar", { p_pedido: sep, p_item: artigo["Mufete"], p_quantidade: 2 });
await joao.rpc("adicionar", { p_pedido: sep, p_item: artigo["Cuca"], p_quantidade: 3 });
await joao.rpc("enviar", { p_pedido: sep });
r = await joao.rpc("conta", { p_pedido: sep });
ok(r.d?.total === 22600 && r.d.por_pagar?.length === 2 && r.d.facturas?.length === 0 && r.d.parte === null, "a conta lista o que falta pagar, linha a linha", JSON.stringify(r).slice(0, 300));
const lMufete = r.d.por_pagar.find((l) => l.nome === "Mufete").id, lCuca = r.d.por_pagar.find((l) => l.nome === "Cuca").id;
r = await joao.rpc("conta", { p_pedido: sep, p_linhas: [{ linha: lMufete, quantidade: 1 }, { linha: lCuca, quantidade: 1 }] });
ok(r.d?.parte?.total === 10700 && r.d.total === 22600, "a base calcula a parte de uma pessoa: 10 700 Kz", JSON.stringify(r.d?.parte));
const parte = (linhas, forma = "numerario", cliente = null) => joao.rpc("facturar_parte", { p_pedido: sep, p_linhas: linhas, p_forma: forma, p_cliente: cliente });
ok(!!(await parte([{ linha: lMufete, quantidade: 3 }])).erro, "não se factura mais do que falta pagar");
ok(!!(await parte([])).erro, "é preciso escolher alguma coisa");
ok(!!(await parte([{ linha: lMufete, quantidade: 0 }])).erro, "uma quantidade a zero é recusada");
ok(!!(await parte([{ linha: lMufete, quantidade: -1 }, { linha: lMufete, quantidade: 2 }])).erro, "uma quantidade negativa é recusada");
ok(!!(await parte([{ linha: "abc", quantidade: 1 }])).erro, "uma linha inválida é recusada");
const linhaDeOutro = (await joao.rpc("pedido", { p_pedido: div })).d.linhas[0].id;
ok(!!(await parte([{ linha: linhaDeOutro, quantidade: 1 }])).erro, "não se factura aqui uma linha de outro pedido");
ok(!!(await parte([{ linha: lMufete, quantidade: 1 }], "cheque")).erro, "a parte pede uma forma de pagamento válida");
ok(!!(await cozinha.rpc("facturar_parte", { p_pedido: sep, p_linhas: [{ linha: lMufete, quantidade: 1 }], p_forma: "numerario" })).erro, "a cozinha não factura");
ok(!!(await outro.rpc("facturar_parte", { p_pedido: sep, p_linhas: [{ linha: lMufete, quantidade: 1 }], p_forma: "numerario" })).erro, "outra empresa não factura um pedido do Kianda");
await joao.rpc("adicionar", { p_pedido: sep, p_item: artigo["Água 1,5 L"], p_quantidade: 1 });
const lAgua = (await joao.rpc("pedido", { p_pedido: sep })).d.linhas.find((l) => l.nome === "Água 1,5 L").id;
ok(!!(await parte([{ linha: lAgua, quantidade: 1 }])).erro, "um artigo ainda por enviar não se factura");
ok((await joao.rpc("pedido", { p_pedido: sep })).d?.facturas?.length === 0, "depois das recusas, não saiu nenhuma factura");

const sonangol = (await joao.rpc("clientes", { p_texto: "Sonan" })).d[0].id;
r = await parte([{ linha: lMufete, quantidade: 1 }, { linha: lCuca, quantidade: 1 }], "multicaixa", sonangol);
ok(r.d?.total === 10700 && r.d.fechado === false && r.d.falta === 13100 && /^FR /.test(r.d.factura_numero ?? ""), "a primeira pessoa paga 10 700 Kz e leva a sua factura; faltam 13 100 Kz", JSON.stringify(r));
const sep1 = r.d?.factura_id;
r = await joao.rpc("talao", { p_factura: sep1 });
ok(r.d?.invoice?.total === 10700 && r.d.items?.length === 2 && /Sonan/.test(r.d.client?.name ?? ""), "o talão dela tem só o que pagou, em nome do cliente com NIF", JSON.stringify(r).slice(0, 300));
r = await joao.rpc("pedido", { p_pedido: sep });
ok(r.d?.estado === "aberto" && r.d.facturas.length === 1 && r.d.pago === 10700 && r.d.total === 13100 && r.d.linhas.find((l) => l.id === lMufete).facturada === 1, "a mesa continua aberta, com o que falta pagar", JSON.stringify(r.d).slice(0, 300));
r = await joao.rpc("sala");
ok(r.d.areas.flatMap((a) => a.mesas).find((m) => m.nome === "1").pedido?.total === 13100, "a sala mostra o que falta pagar na mesa");
ok(!!(await parte([{ linha: lMufete, quantidade: 2 }])).erro, "o que já foi pago não se paga outra vez");
ok(!!(await dono.rpc("anular_linha", { p_linha: lMufete, p_motivo: "engano" })).erro, "um artigo já facturado não se anula no restaurante");
ok(!!(await joao.rpc("cancelar_pedido", { p_pedido: sep })).erro, "um pedido com facturas não se cancela");
r = await parte([{ linha: lCuca, quantidade: 1 }]);
ok(r.d?.total === 1200 && r.d.fechado === false && r.d.falta === 11900, "a segunda pessoa paga uma Cuca; faltam 11 900 Kz", JSON.stringify(r));
ok(!!(await joao.rpc("fechar_conta", { p_pedido: sep, p_forma: "numerario" })).erro, "com um artigo por enviar, o resto ainda não se fecha");
await joao.rpc("enviar", { p_pedido: sep });
r = await joao.rpc("fechar_conta", { p_pedido: sep, p_forma: null, p_partes: [{ forma: "numerario", valor: 5000 }, { forma: "transferencia", valor: 6900 }] });
ok(r.d?.total === 11900 && r.d.fechado === true && r.d.pagamentos?.length === 2, "o resto fecha a conta, e também se pode dividir", JSON.stringify(r));
r = await joao.rpc("pedido", { p_pedido: sep });
ok(r.d?.estado === "fechado" && r.d.facturas.length === 3 && r.d.total === 23800 && r.d.pagamentos.length === 4 && new Set(r.d.facturas.map((f) => f.numero)).size === 3, "a mesa fecha com três facturas diferentes, 23 800 Kz ao todo", JSON.stringify(r.d?.facturas));
ok(Math.abs(r.d.facturas.reduce((t, f) => t + f.total, 0) - 23800) < 0.005 && r.d.linhas.every((l) => l.estado === "anulado" || l.facturada === l.quantidade), "as facturas somam o total e não fica nada por facturar");
ok((await joao.rpc("sala")).d.areas.flatMap((a) => a.mesas).find((m) => m.nome === "1").pedido === null, "a mesa 1 volta a ficar livre");

// uma só pessoa a pagar tudo por escolha também fecha o pedido
const b2 = (await joao.rpc("abrir_balcao")).d;
await joao.rpc("adicionar", { p_pedido: b2, p_item: artigo["Cuca"], p_quantidade: 1 });
await joao.rpc("enviar", { p_pedido: b2 });
const lB2 = (await joao.rpc("conta", { p_pedido: b2 })).d.por_pagar[0].id;
r = await joao.rpc("facturar_parte", { p_pedido: b2, p_linhas: [{ linha: lB2, quantidade: 1 }], p_forma: "numerario" });
ok(r.d?.total === 1200 && r.d.fechado === true && r.d.falta === 0, "quando a escolha cobre tudo, o pedido fecha", JSON.stringify(r));
ok(((await outro.ver("pedido_facturas")).d ?? []).length === 0, "outra empresa não vê as facturas do restaurante Kianda");
r = await publico.ver("pedido_facturas");
ok(!!r.erro || (r.d ?? []).length === 0, "sem login, as facturas não se lêem");
ok(!!(await outro.rpc("talao", { p_factura: sep1 })).erro, "outra empresa não lê o talão de uma factura separada");
ok(!!(await joao.criar("pedido_facturas", [{ company_id: empresa, pedido_id: sep, ordem: 9, factura_numero: "FR X/1", total: 1 }])).erro, "ninguém escreve facturas à mão");

// --- fecho do dia
r = await dono.rpc("fecho_do_dia");
ok(r.d?.total === 68700 && r.d.contas === 5 && r.d.facturas === 7 && r.d.divididas === 2 && r.d.separadas === 1, "fecho do dia: 68 700 Kz, cinco contas, sete facturas, duas divididas, uma com facturas separadas", JSON.stringify(r.d));
ok(r.d.por_forma.numerario === 42766.66 && r.d.por_forma.multicaixa === 19033.34 && r.d.por_forma.transferencia === 6900, "fecho do dia por forma de pagamento", JSON.stringify(r.d?.por_forma));
ok(Math.abs(Object.values(r.d.por_forma).reduce((t, v) => t + v, 0) - r.d.total) < 0.005, "as formas de pagamento somam o total do dia");
ok(!!(await joao.rpc("fecho_do_dia")).erro, "o fecho do dia é só para o gerente");

// --- módulos: a subscrição caduca a meio do serviço
const mesaLivre = async (nome) => (await joao.rpc("sala")).d.areas.flatMap((a) => a.mesas).find((m) => m.nome === nome);
const aberta = (await joao.rpc("abrir_mesa", { p_mesa: mesa["2"].id })).d;
await joao.rpc("adicionar", { p_pedido: aberta, p_item: artigo["Cuca"], p_quantidade: 1 });
await joao.rpc("enviar", { p_pedido: aberta });
await dono.pub("teste_definir_plano", { p_plano: "start", p_dias: -1 });
r = await dono.rpc("eu");
ok(r.d?.modulo === "suspenso" && r.d.activo === true && /subscrição/i.test(r.d.bloqueio ?? ""), "subscrição caducada: o módulo fica suspenso e a equipa continua a entrar", JSON.stringify(r.d));
r = await joao.rpc("abrir_mesa", { p_mesa: mesa["4"].id });
ok(/plano/i.test(r.erro ?? ""), "suspenso: não se abrem mesas novas", JSON.stringify(r));
ok(!!(await joao.rpc("abrir_balcao")).erro, "suspenso: não se abrem vendas ao balcão");
ok((await joao.rpc("abrir_mesa", { p_mesa: mesa["2"].id })).d === aberta, "suspenso: a mesa que já estava aberta continua a abrir-se");
ok(!(await joao.rpc("adicionar", { p_pedido: aberta, p_item: artigo["Cuca"], p_quantidade: 1 })).erro && (await joao.rpc("enviar", { p_pedido: aberta })).d === 1, "suspenso: a mesa aberta ainda recebe o que falta servir");
r = await joao.rpc("fechar_conta", { p_pedido: aberta, p_forma: "numerario" });
ok(r.d?.total === 2400 && r.d.fechado === true, "suspenso: as contas abertas fecham-se e facturam-se", JSON.stringify(r));
ok((await publico.rpc("publico_menu", { p_codigo: mesa["5"].codigo })).d?.mesa === "5", "suspenso: o menu do QR continua a ver-se");
await dono.pub("teste_definir_plano", { p_plano: "solo" });
ok((await dono.rpc("eu")).d?.modulo === "suspenso" && !!(await joao.rpc("abrir_balcao")).erro, "descer para o BOSS Solo também suspende o módulo");
await dono.pub("teste_definir_plano", { p_plano: "start" });
const volta = await joao.rpc("abrir_balcao");
ok(!volta.erro && (await dono.rpc("eu")).d?.modulo === "activo", "renovar o BOSS Start volta a abrir vendas");

// --- módulos: desligar e voltar a ligar
r = await dono.pub("company_module_deactivate", { p_module: "restaurante" });
ok(/contas abertas/.test(r.erro ?? ""), "com contas abertas, o módulo não se desliga", JSON.stringify(r));
await joao.rpc("cancelar_pedido", { p_pedido: volta.d });
ok(!!(await joao.pub("company_module_deactivate", { p_module: "restaurante" })).erro, "um empregado não desliga módulos");
const directaAberta = await mesaLivre("3");
if (directaAberta?.pedido) await joao.rpc("fechar_conta", { p_pedido: directaAberta.pedido.id, p_forma: "numerario" });
r = await dono.pub("company_module_deactivate", { p_module: "restaurante" });
ok(modulo(r.d)?.estado === "desligado", "o dono desliga o restaurante", JSON.stringify(r));
ok(!!(await joao.rpc("sala")).erro && !!(await cozinha.rpc("fila", { p_estacao: estCozinha })).erro, "desligado: a equipa deixa de entrar");
r = await joao.rpc("eu");
ok(r.d?.activo === false && r.d.papel === null && r.d.modulo === "desligado", "desligado: o empregado vê o restaurante desligado");
ok((await publico.rpc("publico_menu", { p_codigo: mesa["5"].codigo })).d === null, "desligado: o QR da mesa deixa de responder");
ok(!!(await publico.rpc("publico_chamar", { p_codigo: mesa["5"].codigo, p_tipo: "empregado" })).erro, "desligado: o cliente não chama o empregado");
r = await dono.rpc("eu");
ok(r.d?.activo === false && r.d.ja_configurado === true && r.d.bloqueio === null, "desligado: o dono vê que pode voltar a ligar");
r = await dono.rpc("activar");
ok(r.d?.activo === true && r.d.restaurante?.nome === "Restaurante Kianda", "voltar a ligar: o restaurante volta com o mesmo nome", JSON.stringify(r.d));
r = await joao.rpc("sala");
ok(r.d?.areas?.flatMap((a) => a.mesas).length === 6 && (await joao.rpc("menu")).d?.flatMap((c) => c.itens).length > 0, "voltar a ligar: mesas, menu e equipa estão como estavam");
ok((await dono.rpc("fecho_do_dia")).d?.total > 68700, "voltar a ligar: as vendas do dia continuam lá");

// --- módulos: isolamento e planos sem limite
r = await outro.pub("company_modules_status");
ok(r.d?.plano === "basic" && r.d.limite === null && modulo(r.d)?.estado === "activo", "BOSS Professional: sem limite de módulos, e o restaurante da outra empresa está ligado", JSON.stringify(r));
r = await dono.verPub("company_modules", "select=company_id,module,active");
ok(r.d?.length === 1 && r.d[0].company_id === empresa, "cada empresa só lê os seus módulos", JSON.stringify(r));
ok(!!(await dono.verPub("company_subscriptions")).erro || ((await dono.verPub("company_subscriptions")).d ?? []).length === 0, "as subscrições não se lêem directamente");
ok(!!(await joao.pub("modules_plan", { p_company: empresa })).erro && !!(await joao.pub("company_module_state", { p_company: empresa, p_module: "restaurante" })).erro, "as funções internas dos módulos não se chamam de fora");

// --- estabelecimentos: um restaurante por casa; quem gere a empresa põe cada pessoa na sua, no BOSS, e o restaurante só assume
const fechoEmpresa = (await dono.rpc("fecho_do_dia")).d?.total;
const idJoao = (await joao.rpc("eu")).d.user_id, idBar = (await bar.rpc("eu")).d.user_id;
r = await dono.criarPub("establishments", [
  { company_id: empresa, name: "Kianda Ilha", code: "ILHA", address: "Avenida Murtala Mohammed, Ilha de Luanda", phone: "923 111 111" },
  { company_id: empresa, name: "Kianda Talatona", code: "TALAT" },
]);
const casa = Object.fromEntries((r.d ?? []).map((c) => [c.code, c.id]));
ok(r.d?.length === 2, "o dono cria dois estabelecimentos no BOSS", JSON.stringify(r));
ok(!!(await joao.criarPub("establishments", [{ company_id: empresa, name: "Do João", code: "JOAO" }])).erro, "um empregado não cria estabelecimentos");
r = await joao.rpc("eu");
ok(r.d?.activo === true && r.d.casa === null && r.d.casas.length === 0 && r.d.restaurante_da_empresa === true && r.d.sem_casa === false,
  "com estabelecimentos mas sem restaurante neles, a equipa continua no restaurante da empresa", JSON.stringify(r.d));
await dono.pub("establishment_select", { _establishment: casa.ILHA });
r = await dono.rpc("eu");
ok(r.d?.casa?.id === casa.ILHA && r.d.activo === false && r.d.ja_configurado === false && r.d.casas.length === 2 && r.d.preso_a_casas === false,
  "o dono escolhe a Ilha: o restaurante dela ainda está por ligar", JSON.stringify(r.d));
r = await dono.rpc("activar", { p_nome: "Kianda Ilha" });
ok(r.d?.activo === true && r.d.restaurante?.nome === "Kianda Ilha" && r.d.casa?.id === casa.ILHA, "o dono liga o restaurante da Ilha", JSON.stringify(r));
ok(((await dono.rpc("sala")).d?.areas ?? []).flatMap((a) => a.mesas).length === 0, "o restaurante da Ilha nasce sem as mesas do restaurante da empresa");
let areaIlha = (await dono.ver("areas")).d?.[0];
if (!areaIlha) areaIlha = (await dono.criar("areas", [{ company_id: empresa, nome: "Sala" }])).d?.[0];
ok(areaIlha?.establishment_id === casa.ILHA, "a sala da Ilha fica presa à Ilha", JSON.stringify(areaIlha));
r = await dono.criar("mesas", [{ company_id: empresa, area_id: areaIlha.id, nome: "1" }]);
const mesaIlha = r.d?.[0];
ok(mesaIlha?.establishment_id === casa.ILHA, "a mesa «1» da Ilha convive com a mesa «1» do restaurante da empresa", JSON.stringify(r));

// quem não foi posto em nenhum estabelecimento não escolhe
ok(/gere a empresa/.test((await joao.pub("establishment_select", { _establishment: casa.ILHA })).erro ?? ""), "quem não foi posto em nenhum estabelecimento não escolhe: o BOSS recusa a escolha");
r = await joao.rpc("eu");
ok(r.d?.casa === null && r.d.casas.length === 0 && r.d.sem_casa === true, "e o restaurante não o deixa entrar em nenhum estabelecimento", JSON.stringify(r.d));
ok(!!(await joao.rpc("abrir_mesa", { p_mesa: mesaIlha.id })).erro, "e não abre mesas da Ilha");
ok((await joao.rpc("sala")).d?.areas?.flatMap((a) => a.mesas).length === 6, "continua só no restaurante da empresa");
ok(!!(await joao.criarPub("establishment_members", [{ establishment_id: casa.ILHA, user_id: idJoao, company_id: empresa }])).erro, "ninguém se põe a si próprio num estabelecimento");

// o dono põe o João na Ilha: entra directamente lá
r = await dono.criarPub("establishment_members", [{ establishment_id: casa.ILHA, user_id: idJoao, company_id: empresa }]);
ok(r.d?.length === 1, "o dono põe o João na equipa da Ilha", JSON.stringify(r));
r = await joao.rpc("eu");
ok(r.d?.casa?.id === casa.ILHA && r.d.casas.length === 1 && r.d.preso_a_casas === true && r.d.sem_casa === false && r.d.papel === "empregado" && r.d.restaurante?.nome === "Kianda Ilha",
  "o João entra directamente no restaurante da Ilha, sem escolher", JSON.stringify(r.d));
ok(/equipa/.test((await joao.pub("establishment_select", { _establishment: casa.TALAT })).erro ?? ""), "e não consegue mudar para outro estabelecimento");
ok((await joao.rpc("sala")).d?.areas?.flatMap((a) => a.mesas).length === 1, "vê só as mesas da Ilha");
ok(!!(await joao.rpc("abrir_mesa", { p_mesa: mesa["4"].id })).erro, "e já não abre mesas do restaurante da empresa");

// o menu é da empresa; esgotado e escondido valem por estabelecimento
r = await dono.criar("menu_itens_casa", [{ establishment_id: casa.ILHA, item_id: artigo["Kitaba"], company_id: empresa, esgotado: true }]);
ok(r.d?.length === 1, "o gerente dá a Kitaba por esgotada só na Ilha", JSON.stringify(r));
ok((await joao.rpc("menu")).d?.flatMap((c) => c.itens).find((i) => i.id === artigo["Kitaba"])?.esgotado === true, "na Ilha, a Kitaba está esgotada");

// pedido, conta e talão da Ilha
const pIlha = (await joao.rpc("abrir_mesa", { p_mesa: mesaIlha.id, p_pessoas: 2 })).d;
await joao.rpc("adicionar", { p_pedido: pIlha, p_item: artigo["Mufete"], p_quantidade: 1 });
await joao.rpc("enviar", { p_pedido: pIlha });
r = await joao.rpc("fechar_conta", { p_pedido: pIlha, p_forma: "numerario" });
ok(r.d?.total === 9500 && /^FR /.test(r.d.factura_numero ?? "") && r.d.fechado === true, "a conta da Ilha fecha com Factura-Recibo", JSON.stringify(r));
r = await joao.rpc("talao", { p_factura: r.d?.factura_id });
ok(r.d?.establishment?.name === "Kianda Ilha" && /Ilha de Luanda/.test(r.d.establishment.address ?? "") && r.d.company?.nif === "5000000000",
  "o talão leva o nome e a morada do estabelecimento e o NIF da empresa", JSON.stringify(r.d?.establishment));
ok((await dono.rpc("fecho_do_dia")).d?.total === 9500, "o fecho do dia da Ilha só conta a venda da Ilha");

// de volta ao restaurante da empresa: nada da Ilha lá aparece
await dono.pub("establishment_select", { _establishment: null });
r = await dono.rpc("eu");
ok(r.d?.casa === null && r.d.restaurante?.nome === "Restaurante Kianda", "o dono volta ao restaurante da empresa");
ok((await dono.rpc("fecho_do_dia")).d?.total === fechoEmpresa, "o fecho do dia do restaurante da empresa não conta a venda da Ilha");
ok((await dono.rpc("menu")).d?.flatMap((c) => c.itens).find((i) => i.id === artigo["Kitaba"])?.esgotado === false, "no restaurante da empresa, a Kitaba continua disponível");
r = await dono.rpc("equipa_lista");
ok(r.d?.find((p) => p.email === "joao@kianda.teste")?.casas?.[0]?.nome === "Kianda Ilha" && r.d.find((p) => p.email === "cozinha@kianda.teste")?.casas?.length === 0,
  "a equipa mostra o estabelecimento de cada pessoa", JSON.stringify(r.d?.map((p) => [p.email, p.casas])));

// posto num estabelecimento sem restaurante ligado; posto em dois, escolhe só entre os seus
await dono.criarPub("establishment_members", [{ establishment_id: casa.TALAT, user_id: idBar, company_id: empresa }]);
r = await bar.rpc("eu");
ok(r.d?.casa?.id === casa.TALAT && r.d.activo === false && r.d.ja_configurado === false && r.d.papel === null, "quem foi posto num estabelecimento sem restaurante ligado vê-o por ligar", JSON.stringify(r.d));
await dono.criarPub("establishment_members", [{ establishment_id: casa.TALAT, user_id: idJoao, company_id: empresa }]);
r = await joao.rpc("eu");
ok(r.d?.casas.length === 2 && r.d.preso_a_casas === true, "posto em dois estabelecimentos, o João pode trabalhar nos dois");
ok(!(await joao.pub("establishment_select", { _establishment: casa.TALAT })).erro && (await joao.rpc("eu")).d?.casa?.id === casa.TALAT, "e escolhe só entre os seus");
ok((await outro.rpc("eu")).d?.casas.length === 0 && ((await outro.verPub("establishments")).d ?? []).length === 0, "a outra empresa não vê estes estabelecimentos");

console.log(`\n${passou} passaram, ${falhou} falharam`);
process.exit(falhou ? 1 : 0);
