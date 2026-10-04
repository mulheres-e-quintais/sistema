-- =====================================================================
-- Mulheres & Quintais — 53: preços de referência do kit com fonte pesquisada (04/10/2026)
-- Supabase > SQL Editor > New query > cole este arquivo inteiro > Run. Precisa do 51_kit_itens.sql.
--
-- Troca as 7 estimativas "sem fonte verificada" do 51 por preços pesquisados, cada um com a fonte e a data.
-- Só mexe no item que ainda está com o valor original do 51: o que a coordenação já alterou na tela fica como está.
-- Não apaga nada. Pode rodar mais de uma vez.
-- Os preços continuam marcados como "estimativa preliminar": são de varejo e do SINAPI, não de cotação nem de ata
-- de preços do projeto. Troque na tela (aba Campo > Itens do kit) quando houver a cotação.
-- =====================================================================
begin;

do $$ begin
  if to_regclass('public.kit_itens') is null then raise exception 'Rode antes o 51_kit_itens.sql.'; end if;
end $$;

update public.kit_itens k
   set valor_ref = v.novo, fonte = v.fonte, atualizado_em = now()
  from (values
  ('Kit de gotejamento', 350.00, 114.00, 'Varejo on-line (Império Mangueiras), out/2026: kit de 100 m de fita gotejadora com registros e conexões, por gravidade. Kit familiar completo de 500 m² (Netafim): R$ 1.630,42'),
  ('Regador e mangueira', 120.00, 153.53, 'Varejo on-line, out/2026: regador de 10 L a R$ 31,84 (Ferpam) + mangueira de jardim de 30 m a R$ 121,69 (Casa do Soldador)'),
  ('Tela de sombreamento 50%', 7.00, 2.47, 'Varejo on-line (Paperplast), out/2026: rolo de 3 m × 50 m a R$ 369,90'),
  ('Tela para galinheiro', 7.40, 13.32, 'SINAPI, insumo 10931 (tela hexagonal galvanizada, altura de 1 m), média nacional, jul/2026'),
  ('Ferramentas manuais', 250.00, 209.60, 'Varejo no Nordeste (A Potiguar), out/2026: enxada R$ 84,90 + pá R$ 59,90 + ancinho R$ 41,90 + facão R$ 22,90'),
  ('Sementes de hortaliças', 5.00, 3.49, 'Varejo on-line (Tupan), out/2026: envelope da linha econômica Feltrin'),
  ('Esterco curtido', 15.00, 26.00, 'Varejo on-line (Sementes Nascimento), out/2026: saco de 20 kg de esterco bovino curtido')
  ) as v(item, antigo, novo, fonte)
 where lower(trim(k.item)) = lower(v.item) and k.valor_ref = v.antigo and k.preliminar;

commit;

select item, unidade, valor_ref, fonte, case when preliminar then 'estimativa preliminar' else 'confirmado' end as situacao
  from public.kit_itens order by item;
