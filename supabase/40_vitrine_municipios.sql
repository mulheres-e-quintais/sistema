-- =====================================================================
-- Mulheres & Quintais — 40: VITRINE PÚBLICA POR MUNICÍPIO (01/10/2026)
-- Supabase > SQL Editor > New query > cole este arquivo inteiro > Run. Pode rodar de novo.
-- Precisa do 02 (fichas). Não altera nenhuma tabela.
--
-- O mapa da página pública mostra um círculo por município, do tamanho do número de mulheres
-- com ficha válida (todas, menos as que não atendem aos critérios). Só totais, nunca nomes.
-- Proteção (LGPD): município com menos de 3 mulheres aparece como "menos de 3", sem o número;
-- e nenhuma situação individual (selecionada, lista de espera, sem água) vai para a página pública.
-- Dados de exemplo (tabela "exemplo", se existir) ficam fora.
-- =====================================================================
create or replace function public.vitrine_municipios() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v jsonb; v_ex text := '';
begin
  if to_regclass('public.exemplo') is not null then v_ex := ' and f.id not in (select id from public.exemplo)'; end if;
  execute 'select coalesce(jsonb_agg(jsonb_build_object(''uf'', uf, ''municipio'', municipio, ''n'', case when n >= 3 then n end, ''menos_de_3'', n < 3) order by uf, municipio), ''[]''::jsonb)
             from (select f.uf, min(trim(f.municipio)) municipio, count(*) n
                     from public.fichas f
                    where f.resultado <> ''nao_atende'' and coalesce(trim(f.municipio), '''') <> ''''' || v_ex || '
                    group by f.uf, lower(trim(f.municipio))) x'
    into v;
  return v;
end $$;
revoke all on function public.vitrine_municipios() from public;
grant execute on function public.vitrine_municipios() to anon, authenticated;

select 'Vitrine por município instalada' as resultado, jsonb_array_length(public.vitrine_municipios()) as municipios;
