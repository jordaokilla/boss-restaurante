-- Limpa o restaurante e as facturas da base de testes, para repetir as provas do princípio.
truncate restaurante.pedido_pagamentos, restaurante.pedido_facturas, restaurante.pedido_linhas, restaurante.pedidos, restaurante.menu_itens, restaurante.menu_categorias,
  restaurante.mesas, restaurante.areas, restaurante.estacoes, restaurante.equipa, restaurante.definicoes, restaurante.limites;
delete from public.invoices;
