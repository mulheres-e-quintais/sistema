-- Mulheres & Quintais — etapa 47: o termo de compromisso é anexado pela PRÓPRIA pessoa
-- (decisão da coordenação geral em 02/10/2026)
--
-- Como fica:
--   1. cada pessoa baixa o modelo, preenche com os dados dela, assina e anexa o termo no próprio cadastro
--      (Pendências ou Meus dados). Ela grava SÓ o arquivo: a data continua sendo de quem confere.
--   2. quem confere (auxiliar administrativo ou coordenação) abre o arquivo, vê se está preenchido e assinado
--      e só então registra a data do termo.
--   3. a data do termo NÃO é aceita sem o termo anexado.
--   4. depois de conferido, a pessoa não troca mais o arquivo (só quem confere).
--
-- Rode depois do 46_regras_decididas.sql. Pode ser rodado de novo sem estragar dados.
-- Registros antigos (data do termo sem arquivo) continuam valendo: a regra 3 só vale para datas novas.

-- 1. No próprio cadastro, o auxiliar administrativo também anexa o seu termo (o resto continua com a coordenação geral)
create or replace function public.equipe_antes() returns trigger
language plpgsql security definer set search_path = public as $$
declare so_hab text[] := array['docs_funcern_em','termo_path','termo_assinado_em','obs_habilitacao','atualizado_em'];
        proprio text[] := array['user_id','foto_path','atualizado_em'];
begin
  if tg_op = 'INSERT' then
    new.criado_por := public.meu_id();
    new.status := 'ativa'; new.data_fim := null; new.motivo_desligamento := null; new.user_id := null;
  else
    if new.papel is distinct from old.papel or new.uf is distinct from old.uf
       or new.cpf is distinct from old.cpf or new.criado_por is distinct from old.criado_por
       or new.criado_em is distinct from old.criado_em then
      raise exception 'Papel, estado e CPF não podem ser alterados. Desligue e cadastre novamente.';
    end if;
    if old.status = 'desligada' and new.status = 'ativa' then
      raise exception 'Registro desligado não pode ser reativado. Faça um novo cadastro.';
    end if;
    if new.email is distinct from old.email then new.user_id := null; end if;
    -- (a coordenação geral altera qualquer dado de qualquer pessoa: etapa 15)
    if public.meu_papel() = 'auxiliar_adm' and auth.uid() is not null then
      if old.id = public.meu_id() then
        -- no próprio cadastro só mudam o vínculo do login, a foto e o termo anexado (pelas funções do sistema)
        if coalesce(current_setting('mq.meu_termo', true), '') = '1' then proprio := array_append(proprio, 'termo_path'); end if;
        if (to_jsonb(new) - proprio) is distinct from (to_jsonb(old) - proprio) then
          raise exception 'A sua própria habilitação e os seus dados são registrados pela coordenação geral.';
        end if;
      elsif (to_jsonb(new) - so_hab) is distinct from (to_jsonb(old) - so_hab) then
        raise exception 'O auxiliar administrativo só registra o cadastro no Arlo e o termo. Dados pessoais são de quem cadastrou a pessoa.';
      end if;
    end if;
    if new.status = 'desligada' then new.user_id := null; end if;
    new.atualizado_em := now();
  end if;
  return new;
end $$;

-- 2. A data do termo só entra com o termo anexado (vale para quem está logado; datas antigas não são mexidas)
create or replace function public.equipe_termo() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;   -- scripts do dono do banco (dados de exemplo, correções)
  if new.termo_assinado_em is not null
     and (tg_op = 'INSERT' or new.termo_assinado_em is distinct from old.termo_assinado_em)
     and nullif(trim(coalesce(new.termo_path, '')), '') is null then
    raise exception 'Sem o termo anexado não há o que conferir: a data só é registrada depois que o termo preenchido e assinado estiver anexado.';
  end if;
  return new;
end $$;
revoke all on function public.equipe_termo() from public, anon, authenticated;
drop trigger if exists equipe_d_termo on public.equipe;
create trigger equipe_d_termo before insert or update on public.equipe for each row execute function public.equipe_termo();

-- 3. A própria pessoa anexa o termo: grava só o arquivo, na pasta dela, enquanto o termo não foi conferido
create or replace function public.enviar_meu_termo(p_path text) returns void
language plpgsql security definer set search_path = public as $$
declare eu public.equipe;
begin
  select * into eu from public.equipe where id = public.meu_id();
  if eu.id is null then raise exception 'Entre no sistema para enviar o termo.'; end if;
  if eu.status <> 'ativa' then raise exception 'Este cadastro está desligado e não é mais alterado. Se houver erro, peça à coordenação geral para corrigir.'; end if;
  if eu.papel = 'coord_geral' then raise exception 'A coordenação geral não tem termo de compromisso neste sistema.'; end if;
  if p_path is null or p_path !~ ('^equipe/' || eu.id::text || '/termo_[0-9]{1,20}\.(pdf|jpg|jpeg|png|webp|heic|heif)$') then
    raise exception 'Arquivo do termo inválido. Anexe um PDF ou uma foto pelo próprio sistema.';
  end if;
  if eu.termo_assinado_em is not null then
    raise exception 'O seu termo já foi conferido em %. Para trocar o arquivo, fale com quem conferiu.', to_char(eu.termo_assinado_em, 'DD/MM/YYYY');
  end if;
  perform set_config('mq.meu_termo', '1', true);
  update public.equipe set termo_path = p_path where id = eu.id;
  perform set_config('mq.meu_termo', '', true);
end $$;
revoke all on function public.enviar_meu_termo(text) from public, anon;
grant execute on function public.enviar_meu_termo(text) to authenticated;

-- 4. Arquivos: a própria pessoa envia para a pasta dela no bucket "termos" e lê só o que é dela
--    (quem confere continua lendo e enviando em todas as pastas: etapas 11 e 15)
drop policy if exists termos_enviar_proprio on storage.objects;
drop policy if exists termos_ler_proprio on storage.objects;
create policy termos_enviar_proprio on storage.objects for insert to authenticated
  with check (bucket_id = 'termos' and public.meu_id() is not null
              and (storage.foldername(name))[1] = 'equipe' and (storage.foldername(name))[2] = public.meu_id()::text);
create policy termos_ler_proprio on storage.objects for select to authenticated
  using (bucket_id = 'termos' and public.meu_id() is not null
         and (storage.foldername(name))[1] = 'equipe' and (storage.foldername(name))[2] = public.meu_id()::text);

select 'Etapa 47 instalada: termo anexado pela própria pessoa' as resultado,
       count(*) filter (where termo_path is not null and termo_assinado_em is null) as termos_aguardando_conferencia,
       count(*) filter (where termo_assinado_em is not null and termo_path is null) as datas_antigas_sem_arquivo
  from public.equipe where status = 'ativa';
