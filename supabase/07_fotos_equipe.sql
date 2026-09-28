-- =====================================================================
-- Mulheres & Quintais — Etapa 7: foto da equipe (aparece ao lado do nome; sem foto, mostra as iniciais)
-- Rodar depois de 01 a 04. Pode rodar de novo sem estragar nada.
-- =====================================================================

alter table public.equipe add column if not exists foto_path text;   -- arquivo no bucket privado "equipe"

-- a coordenação geral também pode trocar a foto das bolsistas (além da habilitação)
create or replace function public.equipe_antes() returns trigger
language plpgsql security definer set search_path = public as $$
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
    if public.meu_papel() = 'coord_geral' and old.papel in ('articulacao','apoio','agente') then
      if (to_jsonb(new) - array['matricula_fic_em','matricula_fic_numero','docs_funcern_em',
            'termo_path','termo_assinado_em','obs_habilitacao','atualizado_em','foto_path'])
         is distinct from
         (to_jsonb(old) - array['matricula_fic_em','matricula_fic_numero','docs_funcern_em',
            'termo_path','termo_assinado_em','obs_habilitacao','atualizado_em','foto_path']) then
        raise exception 'A coordenação geral só altera a habilitação. Dados pessoais e desligamento são da coordenação técnica.';
      end if;
    end if;
    if new.status = 'desligada' then new.user_id := null; end if;
    new.atualizado_em := now();
  end if;
  return new;
end $$;

-- a própria pessoa troca a sua foto (sem poder mexer em mais nada do cadastro)
create or replace function public.definir_minha_foto(p_path text) returns void
language plpgsql security definer set search_path = public as $$
declare eu uuid := public.meu_id();
begin
  if eu is null then raise exception 'Entre no sistema para trocar a foto.'; end if;
  if p_path is not null and p_path not like eu::text || '/%' then raise exception 'Arquivo de foto inválido.'; end if;
  update public.equipe set foto_path = p_path where id = eu;
end $$;
revoke all on function public.definir_minha_foto(text) from public;
grant execute on function public.definir_minha_foto(text) to authenticated;

-- fotos num bucket privado: só quem entrou no sistema vê (por link temporário)
insert into storage.buckets (id, name, public) values ('equipe', 'equipe', false) on conflict (id) do nothing;
drop policy if exists equipe_foto_ler on storage.objects;
drop policy if exists equipe_foto_enviar on storage.objects;
drop policy if exists equipe_foto_trocar on storage.objects;
create policy equipe_foto_ler on storage.objects for select to authenticated using (bucket_id = 'equipe');
-- envia: a coordenação (para qualquer pessoa) ou a própria pessoa (na pasta com o seu id)
create policy equipe_foto_enviar on storage.objects for insert to authenticated
  with check (bucket_id = 'equipe' and (public.meu_papel() in ('coord_geral','coord_tecnico')
              or (storage.foldername(name))[1] = public.meu_id()::text));
create policy equipe_foto_trocar on storage.objects for update to authenticated
  using (bucket_id = 'equipe' and (public.meu_papel() in ('coord_geral','coord_tecnico')
         or (storage.foldername(name))[1] = public.meu_id()::text));

-- dados de exemplo (se existirem): ilustrações de pessoas, não fotos de gente de verdade
do $$ begin
  if to_regclass('public.exemplo') is not null then
    update public.equipe e set foto_path = 'exemplo:' || (array[1,2,3,4,5,7,8,9,10,11,13,14,15,16,17])[1 + (abs(hashtext(e.id::text)) % 15)]
     where e.id in (select id from public.exemplo where tabela = 'equipe') and e.foto_path is null
       and split_part(e.nome, ' ', 1) not in ('José','Antônio','Francisco','João','Raimundo','Pedro','Luiz','Manoel','Cícero','Sebastião','Geraldo');
    update public.equipe e set foto_path = 'exemplo:' || (array[6,12,18])[1 + (abs(hashtext(e.id::text)) % 3)]
     where e.id in (select id from public.exemplo where tabela = 'equipe') and e.foto_path is null;
  end if;
end $$;

select 'Etapa 7 instalada' as resultado, count(*) filter (where foto_path is not null) as com_foto from public.equipe;
