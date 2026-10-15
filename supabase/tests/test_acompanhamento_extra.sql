-- 65: tela completa de quem acompanha. O resumo financeiro do MDA obedece ao parâmetro; o MPA nunca vê; dado de exemplo não entra para quem acompanha.
begin;
alter table auth.users disable trigger user; alter table public.equipe disable trigger user; alter table public.execucao_planilhas disable trigger user; alter table public.canais_venda disable trigger user;
insert into public.observadores (nome, email, orgao, status, user_id) values ('MDA t65', 'mda.t65@exemplo.invalid', 'mda', 'ativo', '00000000-0000-0000-0000-0000000065a1'), ('MPA t65', 'mpa.t65@exemplo.invalid', 'mpa', 'ativo', '00000000-0000-0000-0000-0000000065b1');
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000065a1', 'mda.t65@exemplo.invalid'), ('00000000-0000-0000-0000-0000000065b1', 'mpa.t65@exemplo.invalid'), ('00000000-0000-0000-0000-0000000065c1', 'cg.t65@exemplo.invalid') on conflict do nothing;
update public.equipe set user_id = '00000000-0000-0000-0000-0000000065c1' where id = (select id from public.equipe where papel = 'coord_geral' and status = 'ativa' order by criado_em limit 1);
insert into public.execucao_planilhas (posicao_em, arquivo_path, arquivo_nome, linhas, total_gasto, total_recebido)
  values ('2030-01-31', 'x/t65.xlsx', 't65.xlsx', '[{"item":"repasse_mda","valor":1000,"descricao":"repasse"},{"item":"bolsa_apoio","rubrica":"r2","valor":400,"descricao":"Pix para Fulana Oculta"}]', 400, 1000);
with c as (insert into public.canais_venda (uf, municipio, tipo, nome, contato) values ('PI', 'Picos', 'feira', 'Feira exemplo t65', 'Fulana 8999990000') returning id)
insert into public.exemplo (tabela, id) select 'canais_venda', id from c;
create temp table _r (quem text, j jsonb) on commit drop; grant all on _r to authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000065a1', true); set local role authenticated; insert into _r select 'mda', public.acompanhamento_extra(null); insert into _r select 'mda_dados', public.acompanhamento_dados(null); reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000065b1', true); set local role authenticated; insert into _r select 'mpa', public.acompanhamento_extra(null); insert into _r select 'mpa_dados', public.acompanhamento_dados(null); reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000065c1', true); set local role authenticated; insert into _r select 'previa', public.acompanhamento_extra('mda'); reset role;
update public.parametros set valor = '"sim"' where chave = 'acomp_mda_financeiro';
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000065a1', true); set local role authenticated; insert into _r select 'mda_sim', public.acompanhamento_extra(null); reset role;
select case when (select j ? 'financeiro' from _r where quem = 'mda') then 'FALHOU' else 'PASSOU' end || ' 65: com o padrão (prévia), o MDA de verdade não recebe o financeiro';
select case when (select (j -> 'financeiro' ->> 'posicao_em') = '2030-01-31' from _r where quem = 'previa') then 'PASSOU' else 'FALHOU' end || ' 65: a coordenação, na prévia do MDA, vê o financeiro da última planilha';
select case when (select j ? 'financeiro' from _r where quem = 'mda_sim') then 'PASSOU' else 'FALHOU' end || ' 65: com o parâmetro em "sim", o MDA passa a ver';
select case when (select j ? 'financeiro' from _r where quem = 'mpa') then 'FALHOU' else 'PASSOU' end || ' 65: o MPA nunca recebe o financeiro';
select case when exists (select 1 from _r where j::text ~ '(Oculta|8999990000|t65\.xlsx|descricao)') then 'FALHOU' else 'PASSOU' end || ' 65: nada de descrição, favorecido, contato ou arquivo sai para quem acompanha';
select case when (select coalesce((j -> 'canais' -> 'por_tipo' ->> 'feira')::int, 0) from _r where quem = 'mpa') = (select coalesce((j -> 'canais' -> 'por_tipo' ->> 'feira')::int, 0) from _r where quem = 'previa') - 1 then 'PASSOU' else 'FALHOU' end || ' 65: canal de exemplo não conta para quem acompanha; na prévia conta';
select case when (select (j ? 'perfil') and (j ? 'formacao') from _r where quem = 'mpa_dados') and (select (j ? 'perfil') and (j ? 'formacao') from _r where quem = 'mda_dados') then 'PASSOU' else 'FALHOU' end || ' 65: MDA e MPA recebem perfil e formação';
rollback;
