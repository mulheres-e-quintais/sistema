-- =====================================================================
-- Mulheres & Quintais — ETAPA 2: ficha de indicação e seleção + termo de consentimento
-- Supabase > SQL Editor > New query > cole este arquivo inteiro > Run.
-- Pode ser rodado de novo sem problema. Requer o 01_criar_banco.sql.
-- =====================================================================
-- O que o banco garante:
--   * Um CPF tem uma única ficha no projeto inteiro (substitui o "CPF repetido" da planilha única).
--   * Bolsista só vê e lança fichas do próprio estado; coordenações veem tudo.
--   * Sem o termo de consentimento (uso dos dados) marcado, a ficha não é salva.
--   * "Selecionada" ou "lista de espera" só com os 8 critérios obrigatórios e a autodeclaração.
--   * "Sem água" exige dizer para onde a mulher foi encaminhada.
--   * Só a coordenação técnica aprova ou devolve fichas; no máximo 40 selecionadas aprovadas por estado.
--   * Depois de aprovada, a ficha não muda mais pela bolsista.
--   * Toda alteração vai para a auditoria.
-- =====================================================================

-- A previsão de atividades de cada bolsista não é mais limitada pela meta do estado:
-- quem faz diagnóstico, implantação e visita pode ser qualquer bolsista ou outra pessoa.
drop trigger if exists equipe_meta_estado on public.equipe;

create or replace function public.minha_uf() returns text
language sql stable security definer set search_path = public as $$
  select uf from public.equipe where user_id = auth.uid() and status = 'ativa' limit 1
$$;

create table if not exists public.fichas (
  id                    uuid primary key,              -- gerado no celular (funciona sem internet)
  uf                    char(2) not null check (uf in ('AL','BA','PE','PI','SE')),
  municipio             text not null check (length(trim(municipio)) >= 3),
  comunidade            text not null check (length(trim(comunidade)) >= 3),
  nome                  text not null check (length(trim(nome)) >= 5),
  cpf                   text not null check (cpf ~ '^[0-9]{11}$'),
  data_nascimento       date not null,
  celular               text,
  endereco              text not null check (length(trim(endereco)) >= 3),
  ponto_referencia      text,
  nis                   text check (nis is null or nis ~ '^[0-9]{11}$'),
  caf                   text,
  pessoas_familia       int check (pessoas_familia between 1 and 30),
  indicada_por          text,

  -- 2. critérios obrigatórios
  c_agricultora         boolean not null,
  c_maior18             boolean not null,
  c_espaco              boolean not null,
  c_agua                boolean not null,
  c_disponibilidade     boolean not null,
  c_sem_kit             boolean not null,
  c_sem_parentesco      boolean not null,
  c_casa_unica          boolean not null,
  autodeclaracao        boolean not null default false,

  -- 4. prioridade (desempate)
  p_sustento            boolean not null default false,  -- 2 pontos
  p_cadunico            boolean not null default false,  -- 2
  p_sem_ater            boolean not null default false,  -- 2
  p_raca_povo           boolean not null default false,  -- 1
  p_jovem               boolean not null default false,  -- 1
  p_grupo               boolean not null default false,  -- 1
  p_caf                 boolean not null default false,  -- 1
  pontos                int generated always as (
    (case when p_sustento then 2 else 0 end) + (case when p_cadunico then 2 else 0 end) +
    (case when p_sem_ater then 2 else 0 end) + (case when p_raca_povo then 1 else 0 end) +
    (case when p_jovem then 1 else 0 end) + (case when p_grupo then 1 else 0 end) +
    (case when p_caf then 1 else 0 end)) stored,

  -- termo de consentimento
  consent_dados         boolean not null check (consent_dados),
  consent_imagem        boolean not null default false,
  consent_criancas      boolean not null default false,
  assinatura            text not null default 'assinatura' check (assinatura in ('assinatura','digital')),
  testemunha_nome       text,
  testemunha_cpf        text check (testemunha_cpf is null or testemunha_cpf ~ '^[0-9]{11}$'),

  -- 5. resultado proposto pela bolsista
  resultado             text not null check (resultado in ('selecionada','lista_espera','nao_atende','sem_agua')),
  posicao_espera        int check (posicao_espera is null or posicao_espera >= 1),
  encaminhada_para      text,
  justificativa         text,

  -- fotos dos papéis assinados (bucket "fichas")
  foto_ficha_path       text,
  foto_termo_path       text,
  latitude              numeric(9,6),
  longitude             numeric(9,6),

  -- aprovação pela coordenação técnica
  situacao              text not null default 'aguardando' check (situacao in ('aguardando','aprovada','devolvida')),
  aprovada_por          uuid references public.equipe(id),
  aprovada_em           timestamptz,
  obs_coordenacao       text,

  bolsista_id           uuid references public.equipe(id),
  data_ficha            date not null,
  criado_em             timestamptz not null default now(),
  atualizado_em         timestamptz not null default now(),

  constraint criterios_para_selecao check (
    resultado not in ('selecionada','lista_espera') or (
      c_agricultora and c_maior18 and c_espaco and c_agua and c_disponibilidade
      and c_sem_kit and c_sem_parentesco and c_casa_unica and autodeclaracao)
  ),
  constraint sem_agua_encaminhada check (
    resultado <> 'sem_agua' or (not c_agua and length(trim(coalesce(encaminhada_para,''))) >= 3)
  ),
  constraint digital_com_testemunha check (
    assinatura <> 'digital' or (length(trim(coalesce(testemunha_nome,''))) >= 5 and testemunha_cpf is not null)
  ),
  constraint idade_minima check (resultado not in ('selecionada','lista_espera') or data_nascimento <= data_ficha - interval '18 years')
);

create unique index if not exists fichas_cpf_unico on public.fichas (cpf);
create index if not exists fichas_uf on public.fichas (uf, situacao, resultado);

-- ---------------------------------------------------------------------
-- Gatilho: quem pode mudar o quê
-- ---------------------------------------------------------------------
create or replace function public.fichas_antes() returns trigger
language plpgsql security definer set search_path = public as $$
declare papel text := public.meu_papel();
declare aprovadas int;
begin
  new.atualizado_em := now();

  if tg_op = 'INSERT' then
    new.situacao := 'aguardando'; new.aprovada_por := null; new.aprovada_em := null; new.obs_coordenacao := null;
    if papel in ('articulacao','apoio') then new.bolsista_id := public.meu_id(); end if;
    new.criado_em := now();
    return new;
  end if;

  -- UPDATE
  if new.id <> old.id or new.criado_em <> old.criado_em or new.bolsista_id is distinct from old.bolsista_id then
    raise exception 'Campos de controle não podem ser alterados.';
  end if;

  if papel in ('articulacao','apoio') then
    if old.situacao = 'aprovada' then
      raise exception 'Ficha já aprovada pela coordenação técnica. Para corrigir, peça que ela devolva a ficha.';
    end if;
    if new.uf <> old.uf then raise exception 'O estado da ficha não muda.'; end if;
    -- bolsista reenviando: volta para análise
    new.situacao := 'aguardando'; new.aprovada_por := old.aprovada_por; new.aprovada_em := old.aprovada_em;
    new.obs_coordenacao := old.obs_coordenacao;
  elsif papel = 'coord_tecnico' then
    -- coordenação técnica só decide: aprova ou devolve (não reescreve a ficha)
    -- (pontos é coluna calculada: no gatilho BEFORE ela ainda vem vazia em NEW)
    if (to_jsonb(new) - array['situacao','aprovada_por','aprovada_em','obs_coordenacao','atualizado_em','pontos'])
       is distinct from (to_jsonb(old) - array['situacao','aprovada_por','aprovada_em','obs_coordenacao','atualizado_em','pontos']) then
      raise exception 'A coordenação técnica aprova ou devolve a ficha; quem corrige os dados é a bolsista.';
    end if;
    if new.situacao = 'aprovada' and old.situacao <> 'aprovada' then
      new.aprovada_por := public.meu_id(); new.aprovada_em := now();
      if new.resultado = 'selecionada' then
        select count(*) into aprovadas from public.fichas
         where uf = new.uf and resultado = 'selecionada' and situacao = 'aprovada' and id <> new.id;
        if aprovadas >= 40 then
          raise exception 'O estado % já tem 40 selecionadas aprovadas. Esta mulher deve ir para a lista de espera.', new.uf;
        end if;
      end if;
    elsif new.situacao = 'devolvida' then
      if length(trim(coalesce(new.obs_coordenacao,''))) < 5 then
        raise exception 'Para devolver, escreva o que a bolsista precisa corrigir.';
      end if;
      new.aprovada_por := null; new.aprovada_em := null;
    end if;
  elsif papel is not null then
    raise exception 'Seu perfil não pode alterar fichas.';
  end if;
  return new;
end $$;

drop trigger if exists fichas_antes on public.fichas;
create trigger fichas_antes before insert or update on public.fichas
  for each row execute function public.fichas_antes();

drop trigger if exists fichas_auditoria on public.fichas;
create trigger fichas_auditoria after insert or update or delete on public.fichas
  for each row execute function public.auditar();

-- ---------------------------------------------------------------------
-- Acesso (RLS)
-- ---------------------------------------------------------------------
alter table public.fichas enable row level security;

drop policy if exists fichas_ler on public.fichas;
drop policy if exists fichas_incluir on public.fichas;
drop policy if exists fichas_alterar on public.fichas;

create policy fichas_ler on public.fichas for select to authenticated
  using (public.meu_papel() in ('coord_geral','coord_tecnico')
         or (public.meu_papel() in ('articulacao','apoio') and uf = public.minha_uf()));

create policy fichas_incluir on public.fichas for insert to authenticated
  with check (public.meu_papel() in ('articulacao','apoio') and uf = public.minha_uf());

create policy fichas_alterar on public.fichas for update to authenticated
  using ((public.meu_papel() in ('articulacao','apoio') and uf = public.minha_uf())
         or public.meu_papel() = 'coord_tecnico')
  with check ((public.meu_papel() in ('articulacao','apoio') and uf = public.minha_uf())
         or public.meu_papel() = 'coord_tecnico');

revoke all on public.fichas from anon;
grant select, insert, update on public.fichas to authenticated;
revoke execute on function public.minha_uf() from anon, public;
grant execute on function public.minha_uf() to authenticated;

-- ---------------------------------------------------------------------
-- Fotos das fichas e termos assinados (bucket privado "fichas")
-- caminho: <UF>/<id da ficha>/<arquivo>
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('fichas', 'fichas', false)
on conflict (id) do nothing;

drop policy if exists fichas_arq_ler on storage.objects;
drop policy if exists fichas_arq_enviar on storage.objects;
drop policy if exists fichas_arq_trocar on storage.objects;

create policy fichas_arq_ler on storage.objects for select to authenticated
  using (bucket_id = 'fichas' and (public.meu_papel() in ('coord_geral','coord_tecnico')
         or (public.meu_papel() in ('articulacao','apoio') and (storage.foldername(name))[1] = public.minha_uf())));

create policy fichas_arq_enviar on storage.objects for insert to authenticated
  with check (bucket_id = 'fichas' and public.meu_papel() in ('articulacao','apoio')
              and (storage.foldername(name))[1] = public.minha_uf());

create policy fichas_arq_trocar on storage.objects for update to authenticated
  using (bucket_id = 'fichas' and public.meu_papel() in ('articulacao','apoio')
         and (storage.foldername(name))[1] = public.minha_uf());

select 'Etapa 2 instalada' as resultado, count(*) as fichas from public.fichas;
