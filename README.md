# BOSS Restaurante

Aplicação do restaurante para clientes do BOSS: sala e mesas, pedidos, ecrãs da cozinha e do bar, venda ao balcão, menu digital por QR e conta fechada com Factura-Recibo certificada emitida pelo BOSS.

## Como está montada

| Parte | Onde | O que faz |
| --- | --- | --- |
| Aplicação | este repositório (Next.js, projecto Vercel `boss-restaurante`, em `rest.boss.ao`) | Ecrãs da equipa e menu do cliente |
| Base de dados | esquema `restaurante` no projecto Supabase do BOSS; a migração vive no repositório `appbossao` (`supabase/migrations/20261230090000_restaurante.sql`) | Tabelas, regras de acesso e funções |
| Login | o do BOSS (mesma conta, mesma palavra-passe, mesmo segundo factor) | A equipa entra com a conta BOSS; o cliente do restaurante nunca entra |

Regras que o código segue:

- A aplicação só fala com a base pelas funções do esquema `restaurante` (`lib/api.ts`). Não escreve em tabelas do BOSS.
- O restaurante toca no BOSS por cinco guichés, todos dentro dessas funções: ler produtos, ler clientes, ler quem é a empresa e a equipa, emitir a Factura-Recibo (o mesmo caminho da Venda rápida) e ler os dados do talão dessa factura.
- O público (menu por QR) só usa as funções `publico_*`, com o código da mesa. Não lê tabelas.
- O QR da mesa é fixo, por isso não chega para pedir: cada abertura de mesa tem um código de 4 algarismos (`pedidos.codigo_visita`), que o empregado vê no ecrã da mesa e diz ao cliente. O cliente escreve-o uma vez (`publico_entrar`) e o telemóvel guarda a chave dessa visita (`chave_visita`), que segue em `publico_estado`, `publico_pedir` e `publico_chamar`. Sem a chave, o QR só mostra o menu e diz que a mesa está aberta. Oito códigos errados em dez minutos fecham a entrada nessa mesa até a janela acabar; quem já entrou continua. O restaurante pode dispensar o código em Gestão › Definições (`definicoes.codigo_visita`).
- Preços, IVA e totais calculam-se na base, nunca no navegador.
- Um pedido pode ter várias Facturas-Recibo (`restaurante.pedido_facturas`): nas facturas separadas, `facturar_parte` emite a de cada pessoa e `pedido_linhas.facturada` guarda o que já foi pago; o pedido fecha quando não sobra nada. O total da parte de cada pessoa calcula-se na base (`conta` com `p_linhas`).
- A conta dividida é uma só Factura-Recibo com várias partes de pagamento (`restaurante.pedido_pagamentos`). As contas da divisão fazem-se em cêntimos (`lib/partes.ts`) e a base confere que as partes somam o total.
- A entrada segue as regras do BOSS (`lib/segundoFactor.ts`, espelho de `src/lib/mfa.ts` e do `MfaGate` do appbossao): email ou nome de utilizador, código da aplicação autenticadora ou por SMS para quem tem segundo factor, dispositivo de confiança durante 7 dias. Falha fechada. As funções do BOSS (SMS, envio à AGT) só aceitam pedidos de domínios `*.boss.ao`, por isso a produção vive em `rest.boss.ao`.
- Depois de fechar a conta, a aplicação pede o envio do documento à AGT em segundo plano (`agt-submit-document`), como a Venda rápida; se falhar, a tarefa de reenvio do BOSS repete.
- Os QR das mesas levam sempre o endereço de produção (`ENDERECO_PUBLICO`), porque ficam impressos.
- O talão usa o gerador do BOSS, copiado para `lib/boss/` sem alterações (ver `lib/boss/LEIAME.md`).
- Estabelecimentos (várias casas na mesma empresa, o mesmo NIF; migrações `20270116090000_restaurante_por_estabelecimento.sql` e `20270117090000_restaurante_equipa_por_estabelecimento.sql` do `appbossao`): uma empresa com estabelecimentos no BOSS pode ter um restaurante em cada um. As definições, as salas, as mesas, os pedidos e as contas ficam presos à casa (`establishment_id`; vazio = o restaurante da empresa, o de sempre); o menu, as estações e os papéis da equipa são da empresa, e cada casa só esconde um artigo ou dá-o por esgotado para si (`restaurante.menu_itens_casa`). Todas as funções e políticas trabalham «na casa em que a pessoa está» (`restaurante._casa`). É quem gere a empresa que põe cada pessoa no seu estabelecimento, **no BOSS** (Configurações › Estabelecimentos), e o restaurante só assume: o funcionário entra directamente no restaurante da casa em que foi posto e nunca escolhe; só escolhe quem gere a empresa (trabalha em todas) e quem foi posto em mais de uma (só entre as suas, `lib/casas.ts`, `components/EscolherCasa.tsx`); quem ainda não foi posto em nenhuma não entra («Ainda não está em nenhum estabelecimento»). A aplicação nunca escreve na equipa dos estabelecimentos: em Gestão › Equipa só mostra a casa de cada pessoa. A Factura-Recibo leva a casa do pedido e o talão imprime o nome, a morada e o telefone do estabelecimento, com o NIF da empresa. Numa empresa sem estabelecimentos nada disto aparece.
- A demonstração dos comerciais é uma empresa normal do BOSS registada em `restaurante.demo` (nunca `companies.is_demo`, que é só da demonstração do BOSS), com uma conta por papel em `restaurante.demo_contas`. A base repõe-a sozinha de 30 em 30 minutos quando ninguém está a mexer (`_demo_manter`): senha, mesas, menu, equipa, vendas do dia e mesas em curso. A aplicação só mostra a faixa «Demonstração» e o botão «Repor agora» (`eu.demonstracao`, `demo_repor`).

## Ecrãs

- `/entrar`, `/configurar` (primeira ligação do restaurante, só o dono ou gestor).
- `/sala`: mesas por sala, venda ao balcão. `/mesa?p=…`: o pedido. `/conta?p=…`: fechar a conta e imprimir o talão. Três maneiras de pagar: uma pessoa paga tudo; dividir a conta (uma só factura, várias partes de pagamento); facturas separadas (cada pessoa paga os artigos que escolher e leva a sua factura, com o seu NIF se quiser; a mesa fica aberta até não sobrar nada).
- `/estacao?id=…`: fila da cozinha ou do bar, ao vivo.
- `/gestao`: mesas e QR, menu, equipa, definições e fecho do dia. `/gestao/qr`: folha de QR para imprimir.
- `/m?c=…`: menu do cliente (sem login): ver o menu e, depois de escrever o código da mesa, pedir, chamar o empregado, pedir a conta.

## Desenvolvimento

```bash
npm install
npm run dev
```

Por omissão a aplicação liga-se à **base de testes** (`lib/config.ts`) e mostra uma faixa a avisar. Em produção (Vercel, ambiente Production) `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` apontam para o projecto do BOSS, que tem o esquema `restaurante` exposto na API. A lista de esquemas expostos vive na base, no papel `authenticator` (`pgrst.db_schemas`), e manda sobre a de Settings › API do Supabase.

Verificações antes de enviar:

```bash
npx tsc --noEmit
npx eslint .
npx next build
```

## Base de testes

`base-de-testes/` prepara uma base separada, nunca a do BOSS:

1. `01_nucleo_boss_minimo.sql`: réplica mínima das tabelas e funções do BOSS de que o restaurante depende.
2. As migrações do restaurante e dos módulos (do repositório `appbossao`), pela ordem das datas; `01b_estabelecimentos_minimo.sql` (réplica mínima dos estabelecimentos do BOSS) corre antes das duas do restaurante por estabelecimento.
3. `02_dados_de_teste.sql`: duas empresas, utilizadores e produtos de exemplo.
4. `provas.mjs`: as provas pela API, com logins reais (papéis, isolamento entre empresas, pedidos do cliente, código da visita, factura, talão, conta dividida, facturas separadas, balcão, fecho do dia e um restaurante por estabelecimento).

```bash
URL=https://<projecto>.supabase.co CHAVE=<chave publicável> SENHA=<senha de teste> node base-de-testes/provas.mjs
```

`03_repor.sql` limpa o restaurante e as facturas para repetir as provas do princípio.

A réplica não tem os gatilhos reais do BOSS (numeração, hash, stock, AGT). Esses só se confirmam com a migração aplicada num ambiente com o BOSS completo.
