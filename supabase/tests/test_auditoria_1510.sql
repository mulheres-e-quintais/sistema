-- 66: correções da auditoria de 15/10/2026 (tela de quem acompanha)
begin;
alter table auth.users disable trigger user; alter table public.equipe disable trigger user; alter table public.execucao_planilhas disable trigger user; alter table public.documentos_projeto disable trigger user;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000066c1', 'cg.t66@exemplo.invalid'), ('00000000-0000-0000-0000-0000000066d1', 'ct.t66@exemplo.invalid'), ('00000000-0000-0000-0000-0000000066e1', 'ag.t66@exemplo.invalid') on conflict do nothing;
update public.equipe set user_id = '00000000-0000-0000-0000-0000000066c1' where id = (select id from public.equipe where papel = 'coord_geral' and status = 'ativa' order by criado_em limit 1);
-- a coordenação técnica é uma só: usa a que já existe (ou cria) e liga a conta de teste a ela
update public.equipe set user_id = null where user_id in ('00000000-0000-0000-0000-0000000066d1', '00000000-0000-0000-0000-0000000066e1');
do $$ begin
  if exists (select 1 from public.equipe where papel = 'coord_tecnico' and status = 'ativa') then
    update public.equipe set user_id = '00000000-0000-0000-0000-0000000066d1' where id = (select id from public.equipe where papel = 'coord_tecnico' and status = 'ativa' limit 1);
  else
    insert into public.equipe (id, papel, uf, nome, cpf, email, data_inicio, consentimento_lgpd, status, user_id) values
      ('00000000-0000-0000-0000-0000000066d2', 'coord_tecnico', null, 'Tecnica T66', '66016601160', 'ct.t66@exemplo.invalid', '2026-10-01', true, 'ativa', '00000000-0000-0000-0000-0000000066d1');
  end if;
  insert into public.equipe (id, papel, uf, nome, cpf, email, data_inicio, consentimento_lgpd, status, user_id) values
    ('00000000-0000-0000-0000-0000000066e2', 'agente', 'PI', 'Agente T66', '66016602213', 'ag.t66@exemplo.invalid', '2026-10-01', true, 'ativa', '00000000-0000-0000-0000-0000000066e1');
end $$;
select case when (select papel from public.equipe where user_id = '00000000-0000-0000-0000-0000000066d1') = 'coord_tecnico' then 'PASSOU' else 'FALHOU' end || ' 66 (preparo): a conta de teste é a coordenação técnica';
insert into public.documentos_projeto (tipo, titulo, data_documento, arquivo_path, arquivo_nome) values ('contrato', 'Termo de bolsa de Maria Joaquina da Silva', '2026-10-10', 'docs/t66.pdf', 't66.pdf');
insert into public.execucao_planilhas (posicao_em, arquivo_path, arquivo_nome, linhas, total_gasto, total_recebido)
  values ('2031-01-31', 'x/t66.xlsx', 't66.xlsx', '[{"item":"repasse_mda","valor":1000,"data":"12/10/2026"},{"item":"bolsa_apoio","rubrica":"r2","valor":"1.000,50"},{"item":"bolsa_apoio","rubrica":"r2","valor":300,"data":"2030-12-05"}]', 300, 1000);
create temp table _r (quem text, ok boolean, j jsonb, erro text) on commit drop; grant all on _r to authenticated;
do $$ declare j jsonb; begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000066d1', true); perform set_config('role', 'authenticated', true);
  begin j := public.acompanhamento_extra('mda'); insert into _r values ('tecnica_extra', true, j, null); exception when others then insert into _r values ('tecnica_extra', false, null, sqlerrm); end;
  begin j := public.acompanhamento_dados('mda'); insert into _r values ('tecnica_dados', true, j, null); exception when others then insert into _r values ('tecnica_dados', false, null, sqlerrm); end;
  begin update public.parametros set valor = '"sim"' where chave = 'acomp_mda_financeiro'; insert into _r values ('tecnica_libera', true, null, null); exception when others then insert into _r values ('tecnica_libera', false, null, sqlerrm); end;
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000066e1', true);
  begin j := public.acompanhamento_extra('mpa'); insert into _r values ('agente_extra', true, j, null); exception when others then insert into _r values ('agente_extra', false, null, sqlerrm); end;
  begin perform public.exemplo_fora(); insert into _r values ('agente_exemplo', true, null, null); exception when others then insert into _r values ('agente_exemplo', false, null, sqlerrm); end;
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000066c1', true);
  begin j := public.acompanhamento_extra('mda'); insert into _r values ('geral_extra', true, j, null); exception when others then insert into _r values ('geral_extra', false, null, sqlerrm); end;
  begin update public.parametros set valor = '"talvez"' where chave = 'acomp_mda_financeiro'; insert into _r values ('geral_valor_ruim', true, null, null); exception when others then insert into _r values ('geral_valor_ruim', false, null, sqlerrm); end;
  begin update public.parametros set valor = '"sim"' where chave = 'acomp_mda_financeiro'; insert into _r values ('geral_libera', true, null, null); exception when others then insert into _r values ('geral_libera', false, null, sqlerrm); end;
  perform set_config('role', 'none', true);
end $$;
select case when not ok then 'PASSOU' else 'FALHOU' end || ' 66: a coordenação técnica não abre a prévia (nem os recursos) do MDA' from _r where quem = 'tecnica_extra';
select case when not ok then 'PASSOU' else 'FALHOU' end || ' 66: nem os números principais da prévia' from _r where quem = 'tecnica_dados';
select case when not ok then 'PASSOU' else 'FALHOU' end || ' 66: a coordenação técnica não libera os recursos para o MDA' from _r where quem = 'tecnica_libera';
select case when not ok then 'PASSOU' else 'FALHOU' end || ' 66: agente não chama a tela de quem acompanha' from _r where quem = 'agente_extra';
select case when not ok then 'PASSOU' else 'FALHOU' end || ' 66: a lista de ids de exemplo não é aberta a qualquer conta' from _r where quem = 'agente_exemplo';
select case when ok and not (j::text ~ 'Joaquina|t66\.pdf|Termo de bolsa') and (j -> 'documentos' -> 'por_tipo' ->> 'contrato') is not null then 'PASSOU' else 'FALHOU' end || ' 66: documentos sem título (só tipo, quantidade e data)' from _r where quem = 'geral_extra';
select case when ok and (j -> 'financeiro' ->> 'posicao_em') = '2031-01-31' and (select sum((x->>'valor')::numeric) from jsonb_array_elements(j -> 'financeiro' -> 'por_item') x where x->>'item' = 'bolsa_apoio') = 300
            and not exists (select 1 from jsonb_array_elements(j -> 'financeiro' -> 'por_mes') x where x->>'mes' !~ '^\d{4}-\d{2}$') then 'PASSOU' else 'FALHOU' end
       || ' 66: linha mal formada da planilha não derruba a tela (valor em texto ignorado, data fora do padrão vai para o mês da posição)' from _r where quem = 'geral_extra';
select case when not ok then 'PASSOU' else 'FALHOU' end || ' 66: valor diferente de previa/sim/nao é recusado' from _r where quem = 'geral_valor_ruim';
select case when ok then 'PASSOU' else 'FALHOU' end || ' 66: a coordenação geral libera os recursos' from _r where quem = 'geral_libera';
rollback;
