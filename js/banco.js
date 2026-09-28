/* Mulheres & Quintais — dados bancários para a FUNCERN.
   Só a própria pessoa preenche e vê os números; as coordenações veem apenas "informado"; a coordenação geral
   gera a planilha para a FUNCERN (cada geração fica no histórico). Nada disso vai para o cache do aparelho. */
(function () {
  const U = () => MQ.ui; const S = () => MQ.ui.S; const E = s => MQ.ui.esc(s);
  const R = MQ.regras;
  const $ = s => document.querySelector(s);
  const B = { meus: undefined, editando: false, situacao: null };
  const mascara = t => t ? '•••' + String(t).slice(-3) : '';
  const TIPOS_PIX = [['cpf', 'CPF'], ['celular', 'Celular'], ['email', 'E-mail'], ['aleatoria', 'Chave aleatória']];
  const TIPOS_CONTA = [['corrente', 'Conta corrente'], ['poupanca', 'Poupança'], ['pagamento', 'Conta de pagamento (digital)']];

  /* ---------- a própria pessoa ---------- */
  function secaoMinha() {
    if (B.meus === undefined) { B.meus = null; S().api.meusDadosBancarios && S().api.meusDadosBancarios().then(d => { B.meus = d || false; desenhar(); }).catch(e => { B.meus = { erro: e.message }; desenhar(); }); }
    return `<section class="bloco banco" id="banco-meu" aria-labelledby="t-banco">${corpoMinha()}</section>`;
  }
  function desenhar() { const el = $('#banco-meu'); if (el) el.innerHTML = corpoMinha(); }
  function corpoMinha() {
    const arlo = !!(S().eu && S().eu.cadastro_arlo); const tem = B.meus && !B.meus.erro;
    const cab = `<div class="banco-cab"><h2 id="t-banco">Dados bancários para a FUNCERN</h2><span class="chip ${tem || arlo ? 'ok' : 'pend'}">${tem ? 'Informados' : arlo ? 'No Arlo' : 'Faltam'}</span></div>
      ${arlo && !tem ? '<p class="small">Você informou que já tem cadastro no Arlo: a conta que está lá vale. Só preencha aqui se ela mudou.</p>' : ''}
      <p class="small muted">Só você vê estes números. A coordenação vê apenas se foram informados, e a coordenação geral repassa à FUNCERN, que paga a bolsa ou a ajuda de custo.</p>`;
    if (B.meus === null) return cab + '<p class="muted">Carregando…</p>';
    if (B.meus && B.meus.erro) return cab + `<div class="aviso">${/09_dados|PGRST202|meus_dados/.test(B.meus.erro) ? 'Ainda não instalado no servidor (arquivo 09_dados_bancarios.sql).' : E(B.meus.erro)}</div>`;
    const d = B.meus || {};
    if (B.meus && !B.editando) return cab + `<dl class="dl"><dt>Banco</dt><dd>${E(d.banco_codigo)} · ${E(d.banco_nome)}</dd><dt>Agência</dt><dd class="num">${E(d.agencia)}${d.agencia_dv ? '-' + E(d.agencia_dv) : ''}</dd>
        <dt>Conta</dt><dd class="num">${mascara(d.conta)}-${E(d.conta_dv)} · ${E((TIPOS_CONTA.find(t => t[0] === d.tipo_conta) || [, ''])[1])}</dd>
        ${d.pix_tipo ? `<dt>Pix</dt><dd>${E((TIPOS_PIX.find(t => t[0] === d.pix_tipo) || [, ''])[1])} ${mascara(d.pix_chave)}</dd>` : ''}
        <dt>Atualizado</dt><dd>${d.atualizado_em ? new Date(d.atualizado_em).toLocaleDateString('pt-BR') : ''}</dd></dl>
        <div class="acoes"><button class="btn peq" data-acao="banco-editar">Alterar</button></div>`;
    const op = (lista, sel) => lista.map(([k, t]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${E(t)}</option>`).join('');
    const bancoSel = d.banco_codigo && !MQ.BANCOS.some(b => b[0] === d.banco_codigo) ? 'outro' : d.banco_codigo;
    return cab + `<form class="f" data-form="banco" novalidate autocomplete="off">
      <div class="campos">
        <div class="campo inteiro"><label for="bk-banco">Banco</label><select id="bk-banco" name="banco"><option value="">Selecione o banco…</option>${op(MQ.BANCOS.map(([c, n]) => [c, c + ' · ' + n]), bancoSel)}<option value="outro" ${bancoSel === 'outro' ? 'selected' : ''}>Outro banco</option></select></div>
        <div class="campo" data-outro ${bancoSel === 'outro' ? '' : 'hidden'}><label for="bk-cod">Código do banco (3 números)</label><input id="bk-cod" name="banco_codigo" inputmode="numeric" maxlength="3" value="${bancoSel === 'outro' ? E(d.banco_codigo) : ''}"></div>
        <div class="campo" data-outro ${bancoSel === 'outro' ? '' : 'hidden'}><label for="bk-nome">Nome do banco</label><input id="bk-nome" name="banco_nome" value="${bancoSel === 'outro' ? E(d.banco_nome) : ''}"></div>
        <div class="campo"><label for="bk-ag">Agência (sem dígito)</label><input id="bk-ag" name="agencia" inputmode="numeric" value="${E(d.agencia || '')}"></div>
        <div class="campo"><label for="bk-agdv">Dígito da agência <span class="muted">(se tiver)</span></label><input id="bk-agdv" name="agencia_dv" maxlength="1" value="${E(d.agencia_dv || '')}"></div>
        <div class="campo"><label for="bk-ct">Conta (sem dígito)</label><input id="bk-ct" name="conta" inputmode="numeric" value="${E(d.conta || '')}"></div>
        <div class="campo"><label for="bk-ctdv">Dígito da conta</label><input id="bk-ctdv" name="conta_dv" maxlength="2" value="${E(d.conta_dv || '')}"></div>
        <div class="campo inteiro"><label for="bk-tipo">Tipo de conta</label><select id="bk-tipo" name="tipo_conta">${op(TIPOS_CONTA, d.tipo_conta || 'corrente')}</select></div>
        <div class="campo"><label for="bk-pixt">Chave Pix <span class="muted">(opcional)</span></label><select id="bk-pixt" name="pix_tipo"><option value="">Sem Pix</option>${op(TIPOS_PIX, d.pix_tipo)}</select></div>
        <div class="campo"><label for="bk-pix">Chave</label><input id="bk-pix" name="pix_chave" value="${E(d.pix_chave || '')}"></div>
      </div>
      <p class="nota">A conta precisa estar no seu nome (mesmo CPF do cadastro). Confira com o cartão ou o aplicativo do banco.</p>
      <div class="aviso erro" data-erro hidden></div>
      <div class="acoes"><button class="btn pri" type="submit">Salvar dados bancários</button>${B.meus ? '<button class="btn" type="button" data-acao="banco-cancelar">Cancelar</button>' : ''}</div></form>`;
  }

  /* ---------- coordenações ---------- */
  function carregarSituacao() {
    if (!S().api.situacaoBancaria || B.situacao) return;
    B.situacao = {};
    S().api.situacaoBancaria().then(l => { B.situacao = Object.fromEntries((l || []).map(x => [x.equipe_id, x])); U().render(); }).catch(() => { B.situacao = {}; });
  }
  const informou = id => { carregarSituacao(); const x = (B.situacao || {})[id]; return x ? (x.informado ? { ok: true, em: x.atualizado_em } : { ok: false }) : null; };
  function blocoExportar() {
    if (!S().eu || S().eu.papel !== 'coord_geral') return '';
    carregarSituacao(); const l = Object.values(B.situacao || {}); const n = l.filter(x => x.informado).length;
    return `<div class="bloco banco-exp"><div><b>Planilha bancária para a FUNCERN</b><p class="small muted">${l.length ? `${n} de ${l.length} pessoas já informaram a conta.` : ''} Os números só aparecem na planilha, e cada geração fica registrada no histórico. Mande direto à FUNCERN e apague o arquivo do computador depois.</p></div>
      <div class="acoes"><button class="btn" data-acao="banco-exportar">Gerar planilha (CSV)</button></div></div>`;
  }

  async function clique(a, el) {
    if (a === 'banco-editar') { B.editando = true; desenhar(); }
    else if (a === 'banco-cancelar') { B.editando = false; desenhar(); }
    else if (a === 'banco-exportar') {
      if (!el.dataset.conf) { el.dataset.conf = '1'; el.textContent = 'Confirmar: gerar e baixar'; return; }
      const l = await S().api.exportarDadosBancarios();
      const q = x => '"' + String(x == null ? '' : x).replace(/"/g, '""') + '"';
      const cab = ['Nome', 'CPF', 'Função', 'UF', 'E-mail', 'Celular', 'Código do banco', 'Banco', 'Agência', 'DV agência', 'Conta', 'DV conta', 'Tipo de conta', 'Tipo Pix', 'Chave Pix', 'Atualizado em'];
      const linhas = (l || []).map(x => [x.nome, R.fmtCPF(x.cpf || ''), (MQ.PAPEIS[x.papel] || {}).nome, x.uf, x.email, x.telefone, x.banco_codigo, x.banco_nome, x.agencia, x.agencia_dv,
        x.conta, x.conta_dv, x.tipo_conta, x.pix_tipo, x.pix_chave, x.atualizado_em ? new Date(x.atualizado_em).toLocaleDateString('pt-BR') : ''].map(q).join(';'));
      const blob = new Blob(['﻿' + [cab.map(q).join(';')].concat(linhas).join('\r\n')], { type: 'text/csv;charset=utf-8' });
      const a2 = document.createElement('a'); a2.href = URL.createObjectURL(blob); a2.download = 'dados-bancarios-FUNCERN-' + R.hoje() + '.csv'; a2.click();
      setTimeout(() => URL.revokeObjectURL(a2.href), 2000);
      el.dataset.conf = ''; el.textContent = 'Gerar planilha (CSV)'; U().toast((l || []).length + ' pessoa(s) na planilha. A geração ficou registrada no histórico.');
    }
  }
  async function enviar(tipo, form, fd) {
    if (tipo !== 'banco') return;
    const t = k => String(fd.get(k) || '').trim();
    const sel = t('banco'); const outro = sel === 'outro';
    const banco = MQ.BANCOS.find(b => b[0] === sel);
    const d = { banco_codigo: outro ? R.soDigitos(t('banco_codigo')) : sel, banco_nome: outro ? t('banco_nome') : banco ? banco[1] : '',
      agencia: R.soDigitos(t('agencia')), agencia_dv: t('agencia_dv').toUpperCase() || null, conta: R.soDigitos(t('conta')), conta_dv: t('conta_dv').toUpperCase(),
      tipo_conta: t('tipo_conta') || 'corrente', pix_tipo: t('pix_tipo') || null, pix_chave: t('pix_chave') || null };
    const e = {};
    if (!sel) e.banco = 'Escolha o banco.';
    if (outro && !/^\d{3}$/.test(d.banco_codigo)) e.banco_codigo = 'O código tem 3 números.';
    if (outro && d.banco_nome.length < 2) e.banco_nome = 'Escreva o nome do banco.';
    if (!/^\d{1,5}$/.test(d.agencia)) e.agencia = 'Só os números da agência, sem o dígito.';
    if (d.agencia_dv && !/^[0-9X]$/.test(d.agencia_dv)) e.agencia_dv = 'Um número (ou X).';
    if (!/^\d{1,13}$/.test(d.conta)) e.conta = 'Só os números da conta, sem o dígito.';
    if (!/^[0-9X]{1,2}$/.test(d.conta_dv)) e.conta_dv = 'Informe o dígito da conta.';
    if (d.pix_tipo && !d.pix_chave) e.pix_chave = 'Informe a chave.';
    if (!d.pix_tipo) d.pix_chave = null;
    if (d.pix_tipo === 'cpf' && d.pix_chave && !R.cpfValido(d.pix_chave)) e.pix_chave = 'CPF inválido.';
    if (d.pix_tipo === 'email' && d.pix_chave && !R.emailValido(d.pix_chave)) e.pix_chave = 'E-mail inválido.';
    if (Object.keys(e).length) return U().mostrarErros(form, e);
    if (d.pix_tipo === 'cpf' || d.pix_tipo === 'celular') d.pix_chave = R.soDigitos(d.pix_chave);
    await U().ocupado(form, async () => {
      await S().api.salvarMeusDadosBancarios(d);
      B.meus = Object.assign({}, d, { atualizado_em: new Date().toISOString() }); B.editando = false; B.situacao = null; desenhar(); U().toast('Dados bancários salvos.');
    });
  }
  document.addEventListener('change', ev => {
    const s = ev.target.closest && ev.target.closest('select[name=banco]'); if (!s) return;
    s.form.querySelectorAll('[data-outro]').forEach(x => { x.hidden = s.value !== 'outro'; });
  });
  // ao sair ou trocar de perfil, esquece o que carregou
  const limpar = () => { B.meus = undefined; B.editando = false; B.situacao = null; };

  MQ.bancoUI = { secaoMinha, blocoExportar, informou, clique, enviar, limpar };
})();
