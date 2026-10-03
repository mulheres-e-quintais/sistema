-- =====================================================================
-- Mulheres & Quintais — 49: POPULAR O CURSO FIC COM DADOS DE TESTE (fictícios) (03/10/2026)
-- Supabase > SQL Editor > New query > cole este arquivo inteiro > Run. Rode UMA vez, DEPOIS do 34.
--
-- O 34 coloca a equipe, as fichas (seleção), as visitas e os diagnósticos (campo). Este completa o curso FIC:
--   5 turmas (uma por estado, com os professores de exemplo), a matrícula de cada bolsista e agente de exemplo
--   que já tem número de matrícula (a coordenação técnica entra na turma do Piauí), 6 encontros por turma
--   e a lista de presença de cada encontro.
-- NÃO mexe em nada que já existe e NÃO apaga nada.
-- Todo registro fica anotado na tabela public.exemplo, como os do 34.
-- As datas vão de outubro a dezembro de 2026, como as do 34.
-- Por segurança, para (sem mudar nada) se o 34 não foi rodado, se a equipe de exemplo não está ativa
-- ou se já existe alguma turma do FIC.
-- =====================================================================
begin;

do $$
declare n int;
begin
  if to_regclass('public.exemplo') is null or not exists (select 1 from public.exemplo where tabela = 'equipe') then
    raise exception 'Rode primeiro o 34_popular_teste.sql: este script usa a equipe de exemplo que ele cria. Nada mudou.';
  end if;
  if exists (select 1 from public.turmas_fic) then
    raise exception 'Já existe turma do FIC no banco. Nada mudou.';
  end if;
  select count(*) into n from public.equipe e join public.exemplo x on x.tabela = 'equipe' and x.id = e.id
   where e.status = 'ativa' and e.papel in ('articulacao', 'apoio', 'agente');
  if n = 0 then
    raise exception 'A equipe de exemplo não está ativa (bolsistas e agentes desligados). Nada mudou.';
  end if;
  if not exists (select 1 from public.equipe where papel = 'professor_fic' and status = 'ativa') then
    raise exception 'Não há professor do FIC ativo. Nada mudou.';
  end if;
end $$;

-- as regras do sistema (gatilhos) ficam desligadas só durante a carga, como no 34
alter table public.turmas_fic disable trigger user;
alter table public.matriculas_fic disable trigger user;
alter table public.fic_encontros disable trigger user;
alter table public.fic_presencas disable trigger user;

do $$
declare
  profs uuid[]; cg uuid; u text; k int := 0; t uuid; p uuid; e uuid; i int; d date; mun text;
  nomes constant text[] := array['Alagoas', 'Bahia', 'Pernambuco', 'Piauí', 'Sergipe'];
  ufs constant text[] := array['AL', 'BA', 'PE', 'PI', 'SE'];
  temas constant text[] := array[
    'Apresentação do curso e do projeto: o que é um quintal produtivo e o papel de cada pessoa da equipe.',
    'Princípios da agroecologia: solo vivo, diversidade de plantas e uso da água no semiárido.',
    'Como fazer o diagnóstico do quintal com a mulher: escuta, observação e registro no sistema.',
    'Plano do quintal: escolha do kit, canteiros, pequenos animais e frutíferas conforme a água disponível.',
    'Implantação e manejo: preparo da área, adubação orgânica, cobertura do solo e controle natural de pragas.',
    'Acompanhamento e comercialização: visitas técnicas, feira, merenda escolar e venda do excedente.'];
  modos constant text[] := array['presencial', 'online', 'presencial', 'ava', 'presencial', 'online'];
  m record;
begin
  select array_agg(id order by criado_em, id) into profs from public.equipe where papel = 'professor_fic' and status = 'ativa';
  select id into cg from public.equipe where papel = 'coord_geral' and status = 'ativa' limit 1;

  foreach u in array ufs loop
    k := k + 1; t := gen_random_uuid(); p := profs[1 + ((k - 1) % array_length(profs, 1))];
    select e2.municipio into mun from public.equipe e2 where e2.uf = u and e2.papel = 'articulacao' and e2.status = 'ativa' limit 1;
    insert into public.turmas_fic (id, nome, uf, municipio, inicio, fim, professor_id, obs, criado_por)
    values (t, 'FIC Agroecologia e Quintais Produtivos – ' || nomes[k] || ' (exemplo)', u, mun, '2026-10-05', '2027-03-31', p, 'Turma de exemplo.', cg);
    insert into public.exemplo (tabela, id) values ('turmas_fic', t);

    -- matrículas: bolsistas e agentes de exemplo do estado que já têm número; a coordenação técnica entra na turma do Piauí
    for m in select e3.id, e3.matricula_fic_numero as numero, e3.matricula_fic_em as em
               from public.equipe e3 join public.exemplo x on x.tabela = 'equipe' and x.id = e3.id
              where e3.status = 'ativa' and e3.matricula_fic_em is not null and e3.matricula_fic_numero is not null
                and ((e3.papel in ('articulacao', 'apoio', 'agente') and e3.uf = u) or (e3.papel = 'coord_tecnico' and u = 'PI'))
                and not exists (select 1 from public.matriculas_fic mf where mf.equipe_id = e3.id and mf.cancelada_em is null)
    loop
      e := gen_random_uuid();
      insert into public.matriculas_fic (id, turma_id, equipe_id, numero, matriculado_em, criado_por) values (e, t, m.id, m.numero, m.em, p);
      insert into public.exemplo (tabela, id) values ('matriculas_fic', e);
    end loop;

    -- 6 encontros, um a cada duas semanas, a partir de 17/10/2026 (cada estado num dia da semana)
    for i in 1..6 loop
      e := gen_random_uuid(); d := date '2026-10-17' + (i - 1) * 14 + (k - 1);
      insert into public.fic_encontros (id, turma_id, professor_id, data, carga_horaria, modalidade, conteudo)
      values (e, t, p, d, case modos[i] when 'ava' then 2 else 4 end, modos[i], temas[i]);
      insert into public.exemplo (tabela, id) values ('fic_encontros', e);
      -- presença: quase todo mundo presente; a falta muda de pessoa a cada encontro
      for m in select mf.equipe_id, row_number() over (order by mf.equipe_id) as ordem from public.matriculas_fic mf where mf.turma_id = t and mf.cancelada_em is null
      loop
        declare pr uuid := gen_random_uuid(); veio boolean := ((m.ordem + i + k) % 7) <> 0;
        begin
          insert into public.fic_presencas (id, encontro_id, equipe_id, presente, marcado_por, marcado_em, confirmado_em)
          values (pr, e, m.equipe_id, veio, p, d + time '18:00', case when veio and (m.ordem + i) % 3 <> 0 then d + time '19:30' end);
          insert into public.exemplo (tabela, id) values ('fic_presencas', pr);
        end;
      end loop;
    end loop;
  end loop;
end $$;

alter table public.turmas_fic enable trigger user;
alter table public.matriculas_fic enable trigger user;
alter table public.fic_encontros enable trigger user;
alter table public.fic_presencas enable trigger user;
commit;

select 'Curso FIC de teste colocado' as resultado,
  (select count(*) from public.exemplo where tabela = 'turmas_fic') as turmas,
  (select count(*) from public.exemplo where tabela = 'matriculas_fic') as matriculas,
  (select count(*) from public.exemplo where tabela = 'fic_encontros') as encontros,
  (select count(*) from public.exemplo where tabela = 'fic_presencas') as presencas;
