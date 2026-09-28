-- =====================================================================
-- Mulheres & Quintais — Etapa 9: dados bancários para a FUNCERN (com proteção reforçada)
-- Rodar depois de 01 a 08. Pode rodar de novo sem estragar nada.
--
-- Proteções:
--   * tabela sem NENHUM acesso direto (nem leitura): só por funções que conferem quem pede;
--   * quem preenche e altera é só a própria pessoa, depois de entrar no sistema
--     (não passa pelo link de cadastro nem pelas mãos de outra pessoa);
--   * as coordenações veem apenas se a conta foi informada, nunca os números;
--   * não há planilha com todas as contas: o auxiliar administrativo vê a conta de uma pessoa por vez
--     para o cadastro no Arlo, e cada consulta fica no histórico (11_fic.sql);
--   * nada disso entra nos dados de exemplo nem na cópia que o celular guarda para trabalhar sem internet.
-- =====================================================================

create table if not exists public.equipe_bancario (
  equipe_id      uuid primary key references public.equipe(id),
  banco_codigo   text not null check (banco_codigo ~ '^[0-9]{3}$'),
  banco_nome     text not null,
  agencia        text not null check (agencia ~ '^[0-9]{1,5}$'),
  agencia_dv     text check (agencia_dv is null or agencia_dv ~ '^[0-9xX]$'),
  conta          text not null check (conta ~ '^[0-9]{1,13}$'),
  conta_dv       text not null check (conta_dv ~ '^[0-9xX]{1,2}$'),
  tipo_conta     text not null default 'corrente' check (tipo_conta in ('corrente','poupanca','pagamento')),
  pix_tipo       text check (pix_tipo is null or pix_tipo in ('cpf','email','celular','aleatoria')),
  pix_chave      text,
  atualizado_em  timestamptz not null default now(),
  constraint pix_completo check ((pix_tipo is null) = (pix_chave is null))
);
alter table public.equipe_bancario enable row level security;
revoke all on public.equipe_bancario from anon, authenticated;   -- sem acesso direto: só pelas funções abaixo

-- a própria pessoa salva / vê os seus
create or replace function public.salvar_meus_dados_bancarios(p jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare eu uuid := public.meu_id();
begin
  if eu is null then raise exception 'Entre no sistema para informar os dados bancários.'; end if;
  insert into public.equipe_bancario (equipe_id, banco_codigo, banco_nome, agencia, agencia_dv, conta, conta_dv, tipo_conta, pix_tipo, pix_chave, atualizado_em)
  values (eu, p->>'banco_codigo', p->>'banco_nome', regexp_replace(p->>'agencia', '\D', '', 'g'), nullif(p->>'agencia_dv', ''),
          regexp_replace(p->>'conta', '\D', '', 'g'), p->>'conta_dv', coalesce(nullif(p->>'tipo_conta', ''), 'corrente'),
          nullif(p->>'pix_tipo', ''), nullif(trim(p->>'pix_chave'), ''), now())
  on conflict (equipe_id) do update set banco_codigo = excluded.banco_codigo, banco_nome = excluded.banco_nome, agencia = excluded.agencia,
    agencia_dv = excluded.agencia_dv, conta = excluded.conta, conta_dv = excluded.conta_dv, tipo_conta = excluded.tipo_conta,
    pix_tipo = excluded.pix_tipo, pix_chave = excluded.pix_chave, atualizado_em = now();
  insert into public.auditoria (tabela, registro_id, acao, por, antes, depois)
    values ('equipe_bancario', eu, 'UPDATE', eu, null, jsonb_build_object('aviso', 'dados bancários informados ou alterados pela própria pessoa'));
end $$;

create or replace function public.meus_dados_bancarios() returns jsonb
language sql stable security definer set search_path = public as $$
  select to_jsonb(b) - 'equipe_id' from public.equipe_bancario b where b.equipe_id = public.meu_id();
$$;

-- coordenações: só se foi informado (sem números)
create or replace function public.situacao_bancaria() returns table (equipe_id uuid, informado boolean, atualizado_em timestamptz)
language sql stable security definer set search_path = public as $$
  select e.id, b.equipe_id is not null, b.atualizado_em
    from public.equipe e left join public.equipe_bancario b on b.equipe_id = e.id
   where coalesce(public.meu_papel(), '') in ('coord_geral','coord_tecnico') and e.status = 'ativa' and e.papel <> 'coord_geral';
$$;

-- (a planilha com todas as contas foi retirada: quem cadastra no Arlo é o auxiliar administrativo,
--  vendo a conta de uma pessoa por vez, com registro no histórico — ver 11_fic.sql)
drop function if exists public.exportar_dados_bancarios();

revoke all on function public.salvar_meus_dados_bancarios(jsonb), public.meus_dados_bancarios(), public.situacao_bancaria() from public, anon;
grant execute on function public.salvar_meus_dados_bancarios(jsonb), public.meus_dados_bancarios(), public.situacao_bancaria() to authenticated;

select 'Etapa 9 instalada' as resultado, (select count(*) from public.equipe_bancario) as contas_informadas;
