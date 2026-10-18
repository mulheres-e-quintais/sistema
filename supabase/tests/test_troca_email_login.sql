-- 68: trocar o e-mail de quem já entrou no sistema (o login dela) só a coordenação geral; antes a técnica apagava a senha sem perceber
begin;
alter table auth.users disable trigger user; alter table public.equipe disable trigger user;
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000068c1', 'cg.t68@exemplo.invalid'), ('00000000-0000-0000-0000-0000000068c2', 'tec.t68@exemplo.invalid'),
  ('00000000-0000-0000-0000-0000000068c3', 'bol.t68@exemplo.invalid');
update public.equipe set user_id = '00000000-0000-0000-0000-0000000068c1' where id = (select id from public.equipe where papel = 'coord_geral' and status = 'ativa' order by criado_em limit 1);
update public.equipe set status = 'desligada', data_fim = current_date, motivo_desligamento = 'teste 68', user_id = null where papel = 'coord_tecnico' and status = 'ativa';
insert into public.equipe (id, user_id, papel, uf, nome, cpf, email, data_inicio, consentimento_lgpd, status) values
  ('00000000-0000-0000-0000-0000000068a2', '00000000-0000-0000-0000-0000000068c2', 'coord_tecnico', null, 'Técnica T68', '68016801102', 'tec.t68@exemplo.invalid', '2026-10-01', true, 'ativa'),
  ('00000000-0000-0000-0000-0000000068a3', '00000000-0000-0000-0000-0000000068c3', 'agente', 'PI', 'Agente Que Entrou T68', '68016802265', 'bol.t68@exemplo.invalid', '2026-10-01', true, 'ativa'),
  ('00000000-0000-0000-0000-0000000068a4', null, 'agente', 'PI', 'Agente Sem Login T68', '68016803318', 'sem.t68@exemplo.invalid', '2026-10-01', true, 'ativa');
alter table auth.users enable trigger user; alter table public.equipe enable trigger user;
create temp table _r (caso text, erro text) on commit drop; grant all on _r to authenticated;
create function pg_temp.tenta(caso text, quem uuid, cmd text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', quem::text, true); perform set_config('role', 'authenticated', true);
  begin execute cmd; insert into _r values (caso, null); exception when others then insert into _r values (caso, sqlerrm); end;
  perform set_config('role', 'postgres', true);
end $$;
select pg_temp.tenta('tec_email', '00000000-0000-0000-0000-0000000068c2', $$update public.equipe set email = 'novo.t68@exemplo.invalid' where id = '00000000-0000-0000-0000-0000000068a3'$$);
select pg_temp.tenta('tec_fone', '00000000-0000-0000-0000-0000000068c2', $$update public.equipe set telefone = '(89) 99999-0068' where id = '00000000-0000-0000-0000-0000000068a3'$$);
select pg_temp.tenta('tec_email_sem_login', '00000000-0000-0000-0000-0000000068c2', $$update public.equipe set email = 'sem2.t68@exemplo.invalid' where id = '00000000-0000-0000-0000-0000000068a4'$$);
reset role;
select case when (select erro from _r where caso = 'tec_email') ~ 'Só a coordenação geral faz essa troca' then 'PASSOU' else 'FALHOU' end
  || ' 68: a técnica não troca o e-mail de quem já entrou (a senha seria apagada) | ' || coalesce((select erro from _r where caso = 'tec_email'), 'gravou');
select case when (select user_id from public.equipe where id = '00000000-0000-0000-0000-0000000068a3') is not null then 'PASSOU' else 'FALHOU' end || ' 68: o login dela continua ligado';
select case when (select erro from _r where caso = 'tec_fone') is null and (select telefone from public.equipe where id = '00000000-0000-0000-0000-0000000068a3') = '(89) 99999-0068'
  then 'PASSOU' else 'FALHOU' end || ' 68: a técnica continua alterando os outros dados de quem entrou | ' || coalesce((select erro from _r where caso = 'tec_fone'), '');
select case when (select erro from _r where caso = 'tec_email_sem_login') is null then 'PASSOU' else 'FALHOU' end
  || ' 68: a técnica corrige o e-mail de quem ainda não entrou | ' || coalesce((select erro from _r where caso = 'tec_email_sem_login'), '');
select pg_temp.tenta('cg_email', '00000000-0000-0000-0000-0000000068c1', $$update public.equipe set email = 'novo.t68@exemplo.invalid' where id = '00000000-0000-0000-0000-0000000068a3'$$);
reset role;
select case when (select erro from _r where caso = 'cg_email') is null and (select user_id from public.equipe where id = '00000000-0000-0000-0000-0000000068a3') is null
  then 'PASSOU' else 'FALHOU' end || ' 68: a coordenação geral troca o e-mail, e o login é solto para um novo primeiro acesso | ' || coalesce((select erro from _r where caso = 'cg_email'), '');
rollback;
