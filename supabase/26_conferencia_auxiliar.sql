-- =====================================================================
-- Mulheres & Quintais — 26: QUEM CONFERE OS PEDIDOS DE PASSAGEM E EVENTO NA FALTA DA COORDENAÇÃO TÉCNICA
-- Supabase > SQL Editor > New query > cole este arquivo inteiro > Run. Pode rodar de novo. Precisa do 22.
--
-- Regra (decisão da coordenação geral, 29/09/2026), só para VIAGENS E EVENTOS:
-- cada pedido passa por DUAS pessoas diferentes.
--   com coordenação técnica ativa ........ a técnica confere; a geral autoriza
--   sem técnica, com auxiliar adm. ativo .. o AUXILIAR ADMINISTRATIVO confere; a geral autoriza
--   sem técnica e sem auxiliar ............ a geral confere e autoriza (último caso, fica marcado)
-- Quando a técnica é cadastrada, o auxiliar deixa de conferir e de ver os pedidos na hora.
-- A geral não confere enquanto houver técnica ou auxiliar ativos, e quem conferiu não autoriza o mesmo pedido.
-- Pagamentos NÃO mudam (o auxiliar lança no Arlo; não pode também dar o aval).
-- =====================================================================
begin;

create or replace function public.quem_confere_pedidos() returns text
language sql stable security definer set search_path = public as $$
  select case
    when exists (select 1 from public.equipe where papel = 'coord_tecnico' and status = 'ativa') then 'coord_tecnico'
    when exists (select 1 from public.equipe where papel = 'auxiliar_adm' and status = 'ativa') then 'auxiliar_adm'
    else 'coord_geral' end
$$;
revoke all on function public.quem_confere_pedidos() from public, anon;
grant execute on function public.quem_confere_pedidos() to authenticated;   -- devolve só o papel, nenhum dado pessoal

-- ler: quem pediu, as coordenações e, só enquanto confere, o auxiliar administrativo
drop policy if exists pedidos_ler on public.pedidos_apoio;
create policy pedidos_ler on public.pedidos_apoio for select to authenticated
  using (solicitante_id = public.meu_id()
         or coalesce(public.meu_papel(), '') in ('coord_geral', 'coord_tecnico')
         or (public.meu_papel() = 'auxiliar_adm' and public.quem_confere_pedidos() = 'auxiliar_adm'));

create or replace function public.mover_pedido_apoio(p_id uuid, p_acao text, p_obs text, p_protocolo text)
returns void language plpgsql security definer set search_path = public as $$
declare p public.pedidos_apoio; papel text := coalesce(public.meu_papel(), ''); eu uuid := public.meu_id(); v_obs text := nullif(trim(p_obs), '');
        conferente text := public.quem_confere_pedidos(); nome_conf text;
begin
  nome_conf := case conferente when 'coord_tecnico' then 'a coordenação técnica' when 'auxiliar_adm' then 'o auxiliar administrativo' else 'a coordenação geral' end;
  select * into p from public.pedidos_apoio where id = p_id for update;
  if p.id is null then raise exception 'Pedido não encontrado.'; end if;
  if p_acao = 'conferir' then
    if papel <> conferente then raise exception 'Quem confere agora é %.', nome_conf; end if;
    if p.solicitante_id = eu then raise exception 'Ninguém confere o próprio pedido.'; end if;
    if p.situacao <> 'enviado' then raise exception 'Este pedido não está esperando conferência.'; end if;
    update public.pedidos_apoio set situacao = 'conferido', conferido_por = eu, conferido_em = now(), obs = null where id = p_id;
  elsif p_acao = 'devolver' then
    if not ((papel = conferente and p.situacao = 'enviado') or (papel = 'coord_geral' and p.situacao = 'conferido')) then
      raise exception 'Este pedido não pode ser devolvido agora.';
    end if;
    if length(coalesce(v_obs, '')) < 5 then raise exception 'Para devolver, escreva o que precisa ser corrigido.'; end if;
    update public.pedidos_apoio set situacao = 'devolvido', obs = v_obs, decidido_por = eu, decidido_em = now() where id = p_id;
  elsif p_acao = 'autorizar' then
    if papel <> 'coord_geral' then raise exception 'Quem autoriza e manda para a FUNCERN é a coordenação geral.'; end if;
    if p.situacao <> 'conferido' then raise exception 'Só pedido conferido pode ser autorizado.'; end if;
    if p.conferido_por = eu and conferente <> 'coord_geral' then
      raise exception 'Quem conferiu não autoriza o mesmo pedido. Devolva para %.', nome_conf;
    end if;
    update public.pedidos_apoio set situacao = 'autorizado', decidido_por = eu, decidido_em = now(), obs = v_obs,
      funcern_protocolo = nullif(trim(p_protocolo), '') where id = p_id;
  elsif p_acao = 'recusar' then
    if papel <> 'coord_geral' then raise exception 'Quem recusa é a coordenação geral.'; end if;
    if p.situacao not in ('enviado', 'conferido') then raise exception 'Este pedido não pode ser recusado agora.'; end if;
    if length(coalesce(v_obs, '')) < 5 then raise exception 'Escreva o motivo da recusa.'; end if;
    update public.pedidos_apoio set situacao = 'recusado', obs = v_obs, decidido_por = eu, decidido_em = now() where id = p_id;
  elsif p_acao = 'cancelar' then
    if p.solicitante_id <> eu then raise exception 'Só quem pediu pode cancelar.'; end if;
    if p.situacao not in ('enviado', 'devolvido') then raise exception 'Depois de conferido, peça à coordenação para cancelar.'; end if;
    update public.pedidos_apoio set situacao = 'cancelado', obs = coalesce(v_obs, 'Cancelado por quem pediu.'), decidido_por = eu, decidido_em = now() where id = p_id;
  elsif p_acao = 'protocolo' then
    if papel <> 'coord_geral' then raise exception 'Só a coordenação geral registra o protocolo da FUNCERN.'; end if;
    if p.situacao <> 'autorizado' then raise exception 'Só pedido autorizado tem protocolo.'; end if;
    update public.pedidos_apoio set funcern_protocolo = nullif(trim(p_protocolo), '') where id = p_id;
  else
    raise exception 'Ação inválida.';
  end if;
end $$;
revoke all on function public.mover_pedido_apoio(uuid, text, text, text) from public, anon;
grant execute on function public.mover_pedido_apoio(uuid, text, text, text) to authenticated;

commit;

select 'Conferência na falta da coordenação técnica instalada' as resultado, public.quem_confere_pedidos() as quem_confere_agora;
