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
- Preços, IVA e totais calculam-se na base, nunca no navegador.
- A conta dividida é uma só Factura-Recibo com várias partes de pagamento (`restaurante.pedido_pagamentos`). As contas da divisão fazem-se em cêntimos (`lib/partes.ts`) e a base confere que as partes somam o total.
- A entrada segue as regras do BOSS (`lib/segundoFactor.ts`, espelho de `src/lib/mfa.ts` e do `MfaGate` do appbossao): email ou nome de utilizador, código da aplicação autenticadora ou por SMS para quem tem segundo factor, dispositivo de confiança durante 7 dias. Falha fechada. As funções do BOSS (SMS, envio à AGT) só aceitam pedidos de domínios `*.boss.ao`, por isso a produção vive em `rest.boss.ao`.
- Depois de fechar a conta, a aplicação pede o envio do documento à AGT em segundo plano (`agt-submit-document`), como a Venda rápida; se falhar, a tarefa de reenvio do BOSS repete.
- Os QR das mesas levam sempre o endereço de produção (`ENDERECO_PUBLICO`), porque ficam impressos.
- O talão usa o gerador do BOSS, copiado para `lib/boss/` sem alterações (ver `lib/boss/LEIAME.md`).

## Ecrãs

- `/entrar`, `/configurar` (primeira ligação do restaurante, só o dono ou gestor).
- `/sala`: mesas por sala, venda ao balcão. `/mesa?p=…`: o pedido. `/conta?p=…`: fechar a conta (paga por uma pessoa ou dividida por várias, sempre com uma só factura) e imprimir o talão.
- `/estacao?id=…`: fila da cozinha ou do bar, ao vivo.
- `/gestao`: mesas e QR, menu, equipa, definições e fecho do dia. `/gestao/qr`: folha de QR para imprimir.
- `/m?c=…`: menu do cliente (sem login): ver o menu, pedir, chamar o empregado, pedir a conta.

## Desenvolvimento

```bash
npm install
npm run dev
```

Por omissão a aplicação liga-se à **base de testes** (`lib/config.ts`) e mostra uma faixa a avisar. Em produção (Vercel, ambiente Production) `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` apontam para o projecto do BOSS, que tem o esquema `restaurante` exposto na API (Supabase › Settings › API › Exposed schemas).

Verificações antes de enviar:

```bash
npx tsc --noEmit
npx eslint .
npx next build
```

## Base de testes

`base-de-testes/` prepara uma base separada, nunca a do BOSS:

1. `01_nucleo_boss_minimo.sql`: réplica mínima das tabelas e funções do BOSS de que o restaurante depende.
2. A migração do restaurante (do repositório `appbossao`).
3. `02_dados_de_teste.sql`: duas empresas, utilizadores e produtos de exemplo.
4. `provas.mjs`: as provas pela API, com logins reais (papéis, isolamento entre empresas, pedidos do cliente, factura, talão, conta dividida, balcão e fecho do dia).

```bash
URL=https://<projecto>.supabase.co CHAVE=<chave publicável> SENHA=<senha de teste> node base-de-testes/provas.mjs
```

`03_repor.sql` limpa o restaurante e as facturas para repetir as provas do princípio.

A réplica não tem os gatilhos reais do BOSS (numeração, hash, stock, AGT). Esses só se confirmam com a migração aplicada num ambiente com o BOSS completo.
