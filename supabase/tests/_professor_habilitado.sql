-- Desde o 33, só se cadastra técnica/bolsista/agente se houver professor do FIC habilitado.
-- Os testes por etapa incluem este arquivo para montar a equipe mínima.
insert into public.equipe (papel, nome, cpf, email, data_inicio, consentimento_lgpd, docs_funcern_em, termo_assinado_em)
select 'professor_fic', 'Professor Base Teste', '91234567873', 'prof.base@ifrn.edu.br', current_date, true, current_date, current_date
where not public.tem_professor_fic_habilitado();
