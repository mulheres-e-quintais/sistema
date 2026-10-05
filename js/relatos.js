/* Relatar problema (05/10/2026): qualquer pessoa da equipe conta, de qualquer tela, o que não funcionou.
   O sistema anexa sozinho a tela, a versão e o aparelho. Sem foto da tela (poderia levar nome e CPF de beneficiária).
   Sem internet o relato fica guardado no aparelho e sobe quando o sinal voltar. A coordenação geral vê a lista no Histórico. */
(function () {
  'use strict';
  const U = () => MQ.ui, S = () => MQ.ui.S, E = s => MQ.ui.esc(s), R = () => MQ.regras;
  const CH = 'mq-relatos-pendentes';
  const pend = () => { try { const l = JSON.parse(localStorage.getItem(CH) || '[]'); return Array.isArray(l) ? l : []; } catch (e) { return []; } };
  const guardar = l => { try { if (l.length) localStorage.setItem(CH, JSON.stringify(l.slice(-20))); else localStorage.removeItem(CH); } catch (e) { /* aparelho sem espaço: o relato não fica */ } };
  const NOME_TELA = { visao: 'Visão geral', equipe: 'Equipe', selecao: 'Seleção', campo: 'Campo', fic: 'Curso FIC', execucao: 'Execução', pagamentos: 'Pagamentos', custos: 'Custos', viagens: 'Viagens e eventos', documentos: 'Documentos', historico: 'Histórico' };
  async function contexto(tela) {
    let versao = ''; try { if (typeof caches !== 'undefined') versao = ((await caches.keys()).filter(k => /^mq-v\d+/.test(k)).sort().pop()) || ''; } catch (e) { versao = ''; }
    const ua = typeof navigator !== 'undefined' ? String(navigator.userAgent || '') : '';
    const so = /Android [\d.]+/.exec(ua) || /iPhone OS [\d_]+/.exec(ua) || /Mac OS X [\d_]+/.exec(ua) || /Windows NT [\d.]+/.exec(ua) || [''];
    const nav = /(Edg|OPR|SamsungBrowser|Firefox|Chrome|Safari)\/[\d.]+/.exec(ua) || [''];
    const tam = typeof window !== 'undefined' ? window.innerWidth + 'x' + window.innerHeight : '';
    return { tela: tela || '', versao, aparelho: [so[0].replace(/_/g, '.'), nav[0], tam].filter(Boolean).join(' · ').slice(0, 200) };
  }
  const telaDeAgora = p => { const s = S(); const a = (p && p.de) || s.aba || ''; return NOME_TELA[a] || a || (s.eu && s.eu.papel ? 'Tela inicial · ' + ((MQ.PAPEIS[s.eu.papel] || {}).curto || s.eu.papel) : ''); };

  function painel(p) {
    const n = pend().length;
    return `<div class="painel-cab"><div class="t"><span class="eyebrow">Ajuda</span><h2 id="painel-t">Relatar problema</h2></div><button class="fechar" data-acao="fechar" aria-label="Fechar">×</button></div>
      <div class="painel-corpo"><form class="f" data-form="relato-novo" novalidate>
        <div class="fixo"><span class="small muted">Vai junto, sem você digitar</span><b>${E(telaDeAgora(p) || 'Tela atual')}</b><span class="small">A tela em que você estava, a versão do sistema e o tipo de aparelho. Não vai foto da tela nem dado de nenhuma mulher.</span></div>
        <div class="campos"><div class="campo inteiro"><label for="rl-texto">O que aconteceu?</label>
          <textarea id="rl-texto" name="texto" rows="6" maxlength="1000" required autofocus placeholder="Ex.: toquei em Salvar na ficha e nada aconteceu. Tentei duas vezes."></textarea>
          <span class="dica">Conte o que você fez e o que apareceu. Não escreva nome, CPF nem telefone de beneficiária.</span></div></div>
        <input type="hidden" name="tela" value="${E(telaDeAgora(p))}">
        ${n ? `<p class="nota">${n === 1 ? 'Há 1 relato guardado' : 'Há ' + n + ' relatos guardados'} neste aparelho, esperando internet.</p>` : ''}
        <div class="aviso erro" data-erro hidden></div>
        <div class="acoes"><button class="btn pri" type="submit">Enviar relato</button><button class="btn" type="button" data-acao="fechar">Cancelar</button></div></form></div>`;
  }

  async function enviarPendentes() {
    const s = S(); if (!s.eu || s.eu.observador || !s.api || !s.api.relatarProblema) return 0;
    let l = pend(), foi = 0; if (!l.length) return 0;
    for (const x of l.slice()) {
      try { await s.api.relatarProblema(x); foi++; l = l.filter(k => k !== x); guardar(l); }
      catch (e) { if (R().erroDeRede(e) || e.semRede) break; l = l.filter(k => k !== x); guardar(l); }   // recusado pelo sistema: não adianta tentar de novo
    }
    return foi;
  }

  async function enviar(tipo, form, fd) {
    if (tipo !== 'relato-novo') return;
    const texto = String(fd.get('texto') || '').replace(/\s+/g, ' ').trim();
    if (texto.length < 10) return U().mostrarErros(form, { texto: 'Conte o que aconteceu com um pouco mais de detalhe.' });
    const x = Object.assign({ texto }, await contexto(String(fd.get('tela') || '')));
    await U().ocupado(form, async () => {
      const semRede = typeof navigator !== 'undefined' && navigator.onLine === false;
      try { if (semRede) throw Object.assign(new Error('sem rede'), { semRede: true }); await S().api.relatarProblema(x); S().relatos = undefined; U().fecharPainel(); U().toast('Relato enviado. Obrigada por avisar.'); }
      catch (e) {
        if (!(e.semRede || R().erroDeRede(e) || e.message === R().MSG_SEM_REDE)) throw e;
        guardar(pend().concat([x])); U().fecharPainel(); U().toast('Sem internet: o relato ficou guardado neste aparelho e vai subir quando o sinal voltar.');
      }
    }, { texto: 'Enviando…' });
  }

  const quando = d => { try { return R().fmtData(String(d).slice(0, 10)); } catch (e) { return ''; } };
  /* lista para a coordenação geral, no Histórico */
  function blocoCoord() {
    const s = S(); if (!s.eu || s.eu.papel !== 'coord_geral') return '';
    const cab = `<div class="secao-cab"><div><h2 id="t-relatos">Problemas relatados pela equipe</h2><p>O que cada pessoa escreveu em <b>Ajuda › Relatar problema</b>, com a tela, a versão e o aparelho. Marque como resolvido quando tratar.</p></div><button type="button" class="btn peq" data-acao="relato-atualizar">Atualizar</button></div>`;
    if (s.relatosSemBanco) return `<section class="secao" id="relatos" aria-labelledby="t-relatos">${cab}<div class="bloco"><p class="nota">Para receber os relatos da equipe, rode o arquivo <b>55_relatos_problema.sql</b> no Supabase.</p></div></section>`;
    if (s.relatos === undefined) { carregar(); return `<section class="secao" id="relatos" aria-labelledby="t-relatos">${cab}<div class="bloco"><p class="muted" role="status">Carregando os relatos…</p></div></section>`; }
    const l = s.relatos || [], ab = l.filter(x => x.status === 'aberto').length;
    const linha = x => `<li class="rl-item${x.status === 'resolvido' ? ' feito' : ''}"><div class="rl-cab"><span class="chip ${x.status === 'aberto' ? 'pend' : 'ok'}">${x.status === 'aberto' ? 'Aberto' : 'Resolvido'}</span><b>${E(x.autor || 'Pessoa da equipe')}</b><span class="small muted">${E((MQ.PAPEIS[x.papel] || {}).curto || x.papel || '')} · ${quando(x.criado_em)}</span></div>
        <p class="rl-texto">${E(x.texto)}</p>
        <p class="small muted">${[x.tela && 'Tela: ' + x.tela, x.versao && 'versão ' + String(x.versao).replace('mq-v', ''), x.aparelho].filter(Boolean).map(E).join(' · ')}</p>
        ${x.nota ? `<p class="small"><b>Anotação:</b> ${E(x.nota)}</p>` : ''}
        ${x.status === 'aberto' ? `<form class="rl-res" data-form="relato-resolver" novalidate><input type="hidden" name="id" value="${E(x.id)}"><label class="so-leitor" for="rl-n-${E(x.id)}">Anotação (opcional)</label><input id="rl-n-${E(x.id)}" name="nota" maxlength="400" placeholder="Anotação (opcional): o que foi feito"><button class="btn peq pri" type="submit">Marcar como resolvido</button></form>`
          : `<span class="acoes"><button type="button" class="btn peq" data-acao="relato-reabrir" data-id="${E(x.id)}">Reabrir</button></span>`}</li>`;
    return `<section class="secao" id="relatos" aria-labelledby="t-relatos">${cab}
      ${l.length ? `<p class="small muted">${ab === 0 ? 'Nenhum relato aberto.' : ab === 1 ? '1 relato aberto.' : ab + ' relatos abertos.'} ${l.length - ab ? (l.length - ab) + ' resolvido' + (l.length - ab > 1 ? 's' : '') + '.' : ''}</p><ul class="rl-lista">${l.map(linha).join('')}</ul>`
        : '<div class="bloco"><p class="muted">Ninguém relatou problema ainda.</p></div>'}</section>`;
  }
  let carregando = false;
  async function carregar() {
    const s = S(); if (carregando || !s.api || !s.api.listarRelatos) return; carregando = true;
    try { s.relatos = await s.api.listarRelatos(); s.relatosSemBanco = false; }
    catch (e) { const t = String((e && e.original && (e.original.code + ' ' + e.original.message)) || (e && e.message) || ''); s.relatosSemBanco = /PGRST202|PGRST205|42883|42P01|does not exist|Could not find/i.test(t); s.relatos = []; }
    carregando = false; if (s.aba === 'historico') U().render();
  }
  async function clique(acao, el) {
    const s = S();
    if (acao === 'relato-abrir') { const de = s.aba; U().abrirPainel({ tipo: 'relato-form', de }); }
    else if (acao === 'relato-atualizar') { el.disabled = true; s.relatos = undefined; await carregar(); U().render(); }
    else if (acao === 'relato-reabrir') { el.disabled = true; try { await s.api.resolverRelato(el.dataset.id, null, true); s.relatos = undefined; } catch (e) { U().toast(R().mensagemParaTela(e)); } U().render(); }
  }
  async function enviarForm(tipo, form, fd) {
    if (tipo === 'relato-novo') return enviar(tipo, form, fd);
    if (tipo !== 'relato-resolver') return;
    await U().ocupado(form, async () => { await S().api.resolverRelato(String(fd.get('id') || ''), String(fd.get('nota') || '').trim() || null, false); S().relatos = undefined; U().render(); U().toast('Relato marcado como resolvido.'); }, { texto: 'Gravando…', semConferir: true });
  }
  MQ.relatosUI = { painel, clique, enviar: enviarForm, blocoCoord, enviarPendentes, contexto, pendentes: pend };
})();
