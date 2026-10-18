-- 67: matriculadas no FIC no painel do MDA/MPA = a regra da coordenação (pessoas ativas com matrícula registrada)
begin;
alter table auth.users disable trigger user; alter table public.equipe disable trigger user;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000067c1', 'cg.t67@exemplo.invalid');
update public.equipe set user_id = '00000000-0000-0000-0000-0000000067c1' where id = (select id from public.equipe where papel = 'coord_geral' and status = 'ativa' order by criado_em limit 1);
-- uma agente com matrícula registrada à mão (sem turma no sistema), e uma sem matrícula (desligada não entra: só status 'ativa' conta)
insert into public.equipe (id, papel, uf, nome, cpf, email, data_inicio, consentimento_lgpd, status, matricula_fic_em) values
  ('00000000-0000-0000-0000-0000000067a1', 'agente', 'PI', 'Avulsa T67', '67016701170', 'a1.t67@exemplo.invalid', '2026-10-01', true, 'ativa', '2026-10-05'),
  ('00000000-0000-0000-0000-0000000067a2', 'agente', 'PI', 'Sem T67', '67016702213', 'a2.t67@exemplo.invalid', '2026-10-01', true, 'ativa', null);
create temp table _r (j jsonb, erro text) on commit drop; grant all on _r to authenticated;
do $$ declare j jsonb; begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000067c1', true); perform set_config('role', 'authenticated', true);
  begin j := public.acompanhamento_formacao('mda'); insert into _r values (j, null); exception when others then insert into _r values (null, sqlerrm); end;
  perform set_config('role', 'postgres', true);
end $$;
reset role;
select case when (select erro from _r) is null then 'PASSOU' else 'FALHOU' end || ' 67: a coordenação geral vê a prévia da formação | ' || coalesce((select erro from _r), '');
select case when ((select j->>'matriculas' from _r)::int = (select count(*) from public.equipe x where x.status = 'ativa' and x.papel in ('coord_tecnico','articulacao','apoio','agente') and x.matricula_fic_em is not null and x.id not in (select public.exemplo_fora())))
  then 'PASSOU' else 'FALHOU' end || ' 67: matriculadas = pessoas ativas com matrícula registrada (a mesma conta da coordenação) | ' || coalesce((select j::text from _r), '');
select case when ((select j->>'pessoas' from _r)::int = (select count(*) from public.equipe x where x.status = 'ativa' and x.papel in ('coord_tecnico','articulacao','apoio','agente') and x.id not in (select public.exemplo_fora())))
  then 'PASSOU' else 'FALHOU' end || ' 67: o total de quem faz o curso vem junto (para "N de M")';
select case when ((select j->>'matriculas' from _r)::int >= 1 and not exists (select 1 from public.matriculas_fic where equipe_id = '00000000-0000-0000-0000-0000000067a1'))
  then 'PASSOU' else 'FALHOU' end || ' 67: matrícula registrada sem turma no sistema conta (antes ficava de fora)';
select case when not (select j ? 'nome' or j::text ~ 'T67' from _r) then 'PASSOU' else 'FALHOU' end || ' 67: só contagens, nenhum nome';
rollback;
