-- Dados da base de testes: um restaurante, uma segunda empresa (para provar o isolamento),
-- seis pessoas com login e um catálogo de produtos. Só para a base de testes.
-- A senha dos utilizadores de teste não fica no repositório: defina-a antes de correr,
--   set teste.senha = '<senha>';
do $$
declare
  v_emp uuid := gen_random_uuid(); v_outra uuid := gen_random_uuid();
  v_senha text := current_setting('teste.senha');
  r record; v_id uuid;
begin
  insert into public.companies (id, name, nif, address) values
    (v_emp, 'Restaurante Kianda (teste)', '5000000000', 'Rua da Missão, 12, Ingombota'),
    (v_outra, 'Outra Empresa (teste)', '5000000001', null);
  insert into public.billing_settings (company_id, city, phone) values (v_emp, 'Luanda', '923 000 000');
  -- O Kianda está no BOSS Start (um módulo); a outra empresa no BOSS Professional (vários).
  insert into public.company_subscriptions (company_id, plan_type, expires_at) values
    (v_emp, 'start', now() + interval '1 year'), (v_outra, 'basic', now() + interval '1 year');
  for r in select * from (values
      ('dono@kianda.teste', 'Ana Dona', v_emp, 'owner'),
      ('joao@kianda.teste', 'João Empregado', v_emp, null),
      ('cozinha@kianda.teste', 'Carlos Cozinha', v_emp, null),
      ('bar@kianda.teste', 'Bela Bar', v_emp, null),
      ('semacesso@kianda.teste', 'Sara Sem Acesso', v_emp, null),
      ('dono@outra.teste', 'Otávio Outro', v_outra, 'owner')) as t(email, nome, emp, papel) loop
    v_id := gen_random_uuid();
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
    values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', r.email,
      extensions.crypt(v_senha, extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}', jsonb_build_object('name', r.nome), now(), now(), '', '', '', '');
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), v_id, v_id::text, jsonb_build_object('sub', v_id::text, 'email', r.email, 'email_verified', true), 'email', now(), now(), now());
    insert into public.profiles (id, company_id, full_name, email) values (v_id, r.emp, r.nome, r.email);
    if r.papel is not null then insert into public.user_roles (user_id, company_id, role) values (v_id, r.emp, r.papel::public.app_role); end if;
  end loop;

  insert into public.billing_clients (company_id, name, nif) values
    (v_emp, 'Consumidor Final', '999999999'), (v_emp, 'Sonangol Distribuidora', '5410003284'), (v_outra, 'Consumidor Final', '999999999');
  insert into public.warehouses (company_id, name, is_default) values (v_emp, 'Restaurante', true);
  -- Preços sem IVA, escolhidos para o preço final (com 14%) dar um número redondo.
  insert into public.billing_products (company_id, name, description, price, vat_rate, category, track_stock) values
    (v_emp, 'Mufete', 'Peixe grelhado, feijão de óleo de palma, banana e mandioca', 8333.33, 14, 'Pratos', false),
    (v_emp, 'Calulu de peixe', 'Peixe seco e fresco, quiabos e funge', 7017.54, 14, 'Pratos', false),
    (v_emp, 'Bife à casa', 'Com batata frita e ovo', 9649.12, 14, 'Pratos', false),
    (v_emp, 'Funge com moamba', 'Galinha rija em moamba de ginguba', 6578.94, 14, 'Pratos', false),
    (v_emp, 'Kitaba', 'Pasta de ginguba torrada', 2192.98, 14, 'Entradas', false),
    (v_emp, 'Cuca', 'Cerveja 33 cl', 1052.63, 14, 'Bebidas', true),
    (v_emp, 'Água 1,5 L', null, 1052.63, 14, 'Bebidas', true),
    (v_emp, 'Sumo de múcua', 'Natural', 1754.38, 14, 'Bebidas', false),
    (v_emp, 'Doce de ginguba', null, 2631.58, 14, 'Sobremesas', false),
    (v_emp, 'Serviço de consultoria', 'Não é do restaurante', 50000, 14, 'Serviços', false),
    (v_outra, 'Produto da outra empresa', null, 1000, 14, null, false);
end $$;
