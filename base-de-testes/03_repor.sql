-- Limpa o restaurante e as facturas da base de testes, para repetir as provas do princípio.
truncate restaurante.pedido_pagamentos, restaurante.pedido_facturas, restaurante.pedido_linhas, restaurante.pedidos, restaurante.menu_itens, restaurante.menu_categorias,
  restaurante.mesas, restaurante.areas, restaurante.estacoes, restaurante.equipa, restaurante.definicoes, restaurante.limites;
delete from restaurante.demo;
delete from public.invoices;
delete from public.company_modules;
delete from public.company_subscriptions;
insert into public.company_subscriptions (company_id, plan_type, expires_at)
select id, case when name like 'Outra%' then 'basic' else 'start' end, now() + interval '1 year' from public.companies;
