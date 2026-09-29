-- roda depois do test_cadastro_equipe.sql (usa :G, :T, :BB, :X) e ANTES do test_conferencia_auxiliar.sql
-- 28_pedido_novo_acesso.sql
\set QUIET on
truncate res;
select t('sem login: pedir com e-mail da equipe funciona', null, $q$select public.pedir_novo_acesso('ART.BA@t.com ')$q$, 'ok');
select f(null, $q$select public.pedir_novo_acesso('art.ba@t.com')$q$);
select f(null, $q$select public.pedir_novo_acesso('art.ba@t.com')$q$);
select t('dois pedidos da mesma pessoa = um pedido com vezes = 2', :G, $q$do $x$ begin if (select count(*) from public.pedidos_novo_acesso where situacao='aguardando') <> 1 or (select vezes from public.pedidos_novo_acesso limit 1) <> 2 then raise exception 'x'; end if; end $x$ $q$, 'ok');
select t('e-mail desconhecido: responde igual (sem erro)', null, $q$select public.pedir_novo_acesso('nao.existe@t.com')$q$, 'ok');
select f(null, $q$select public.pedir_novo_acesso('nao.existe@t.com')$q$);
select f(null, $q$select public.pedir_novo_acesso('isso nao e email')$q$);
select t('e-mail desconhecido não é guardado', :G, $q$do $x$ begin if (select count(*) from public.pedidos_novo_acesso) <> 1 then raise exception 'x'; end if; end $x$ $q$, 'ok');
select t('anônimo NÃO lê os pedidos', null, $q$select count(*) from public.pedidos_novo_acesso$q$, 'permission denied');
select t('anônimo NÃO grava direto', null, $q$insert into public.pedidos_novo_acesso (equipe_id) select id from public.equipe limit 1$q$, 'permission denied');
select t('coord. técnica NÃO vê os pedidos', :T, $q$do $x$ begin if exists(select 1 from public.pedidos_novo_acesso) then raise exception 'VIU'; end if; end $x$ $q$, 'ok');
select t('bolsista NÃO vê os pedidos', :BB, $q$do $x$ begin if exists(select 1 from public.pedidos_novo_acesso) then raise exception 'VIU'; end if; end $x$ $q$, 'ok');
select t('geral vê o pedido', :G, $q$do $x$ begin if not exists(select 1 from public.pedidos_novo_acesso) then raise exception 'não viu'; end if; end $x$ $q$, 'ok');
select t('geral não troca de quem é o pedido', :G, $q$update public.pedidos_novo_acesso set equipe_id = (select id from public.equipe where email='aux@t.com')$q$, 'não muda');
select t('gerar o código atende o pedido sozinho', :G, $q$do $x$ begin perform public.gerar_codigo_acesso((select id from public.equipe where email='art.ba@t.com'));
  if exists(select 1 from public.pedidos_novo_acesso where situacao='aguardando') then raise exception 'continua aberto'; end if;
  if (select resolvido_por from public.pedidos_novo_acesso limit 1) is null then raise exception 'sem quem'; end if; end $x$ $q$, 'ok');
select t('geral descarta pedido em aberto', :G, $q$update public.pedidos_novo_acesso set situacao='descartado'$q$, 'ok');
select f(:G, $q$update public.pedidos_novo_acesso set situacao='descartado'$q$);
select t('resolvido não volta a aberto', :G, $q$update public.pedidos_novo_acesso set situacao='aguardando'$q$, 'já foi resolvido');
select f(null, $q$select public.pedir_novo_acesso('art.ba@t.com')$q$);
select t('depois de resolvido, pedir de novo abre outro', :G, $q$do $x$ begin if (select count(*) from public.pedidos_novo_acesso where situacao='aguardando') <> 1 then raise exception 'x'; end if; end $x$ $q$, 'ok');
select t('pessoa desligada: pedido não é aceito', :G, $q$do $x$ begin
  if exists(select 1 from public.equipe where email='art.pi@t.com' and status='ativa') then raise exception 'teste espera art.pi desligada'; end if; end $x$ $q$, 'ok');
select f(null, $q$select public.pedir_novo_acesso('art.pi@t.com')$q$);
select t('e-mail de desligada não vira pedido', :G, $q$do $x$ begin if exists(select 1 from public.pedidos_novo_acesso p join public.equipe e on e.id=p.equipe_id where e.email='art.pi@t.com') then raise exception 'x'; end if; end $x$ $q$, 'ok');
\pset tuples_only off
select n, case when ok then 'PASSOU' else 'FALHOU' end as r, caso, left(det, 100) det from res order by n;
select count(*) filter (where ok) passou, count(*) filter (where not ok) falhou from res;
