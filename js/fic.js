/* Mulheres & Quintais — curso FIC: turmas e matrícula da coordenação técnica, das bolsistas e das agentes de campo.
   O professor do FIC (ou a coordenação geral) cria a turma e matricula; a matrícula preenche
   o passo "matrícula no FIC" da habilitação. Mesmas regras do supabase/11_fic.sql. */
(function () {
  const R = MQ.regras, P = MQ.PAPEIS;
  const U = () => MQ.ui; const S = () => MQ.ui.S; const E = s => MQ.ui.esc(s);

  const pessoa = id => (S().equipe || []).find(m => m.id === id);
  const nomeDe = m => (m && (m.nome_social || m.nome)) || '—';
  const turmas = () => S().turmas || [];
  const matriculas = () => S().matriculas || [];
  const souProf = () => S().eu.papel === 'professor_fic';
  const podeCriarTurma = () => R.podeMatricular(S().eu.papel);
  const podeEditarTurma = t => S().eu.papel === 'coord_geral' || (souProf() && t.professor_id === S().eu.id);   // a turma é de quem dá a aula: o colega matricula nela, mas não altera
  const podeNaTurma = t => souProf() || S().eu.papel === 'coord_geral';   // qualquer professor do FIC, em qualquer turma (ninguém trava na ausência do outro)
  const deCampo = () => (S().equipe || []).filter(m => m.status === 'ativa' && R.matriculaFIC(m.papel));   // coordenação técnica, bolsistas e agentes
  const professores = () => (S().equipe || []).filter(m => m.status === 'ativa' && m.papel === 'professor_fic');
  const matDe = id => matriculas().find(x => x.equipe_id === id);
  const periodo = t => t.inicio || t.fim ? [t.inicio && R.fmtData(t.inicio), t.fim && R.fmtData(t.fim)].filter(Boolean).join(' a ') : 'Período a definir';
  const ondeT = t => (t.uf ? U().nomeUF(t.uf) : 'Vários estados') + (t.municipio ? ' · ' + t.municipio : '');

  function semBanco() {
    return `<div class="aviso"><b>O curso FIC ainda não está instalado no servidor.</b> A coordenação geral roda o arquivo <b>11_fic.sql</b> no Supabase (SQL Editor) e recarrega a página.</div>`;
  }

  /* ---------- aba (coordenação e professor) ---------- */
  function aba() {
    if (S().ficSemBanco) return semBanco();
    const pessoas = deCampo(); const comMat = pessoas.filter(m => m.matricula_fic_em);
    const sem = pessoas.filter(m => !m.matricula_fic_em);
    const minhas = souProf() ? turmas().filter(t => t.professor_id === S().eu.id) : turmas();
    const outras = souProf() ? turmas().filter(t => t.professor_id !== S().eu.id) : [];   // o professor também matricula nas turmas do colega
    const avulsas = comMat.filter(m => !matDe(m.id));   // matrícula registrada à mão na habilitação, sem turma no sistema
    const h = souProf() ? 'h2' : 'h1';
    return `<div class="cab${souProf() ? ' cab-sub' : ''}"><div><span class="eyebrow">Curso FIC · IFRN</span><${h}>Turmas e matrículas</${h}>
        <p>${souProf() ? 'Crie a sua turma e matricule a coordenação técnica, as bolsistas e as agentes de campo. Você também pode matricular nas turmas do outro professor.' : (S().eu.papel === 'coord_geral' ? 'Os professores do FIC criam as turmas e matriculam; a coordenação geral também pode fazer isso aqui.' : 'Só os professores do FIC criam turmas e matriculam a coordenação técnica, as bolsistas e as agentes de campo; aqui a coordenação acompanha.')} A matrícula registrada aqui conta como o passo <b>matrícula no FIC</b> da habilitação: sem ela, a pessoa não recebe bolsa nem faz visita paga.</p></div>
        ${podeCriarTurma() ? '<button class="btn pri" data-acao="fic-turma-nova">+ Nova turma</button>' : ''}</div>
      <div class="resumo">
        <div><span class="v num">${turmas().length}</span><span class="l">turma${turmas().length === 1 ? '' : 's'}</span></div>
        <div><span class="v num">${comMat.length}<small> de ${pessoas.length}</small></span><span class="l">matriculadas (coordenação técnica, bolsistas e agentes)</span></div>
        <div><span class="v num" ${sem.length ? 'style="color:var(--crit)"' : ''}>${sem.length}</span><span class="l">ainda sem matrícula</span></div>
        <div><span class="v num">${professores().length}</span><span class="l">professor${professores().length === 1 ? '' : 'es'} do FIC</span></div>
      </div>
      ${sem.length ? blocoSem(sem) : pessoas.length ? '<div class="aviso ok-aviso">Todas as pessoas que fazem o curso (coordenação técnica, bolsistas e agentes) estão matriculadas no FIC.</div>' : ''}
      <section class="secao"><div class="secao-cab"><h2 id="t-turmas">${souProf() ? 'Suas turmas' : 'Turmas'}</h2></div>
        ${minhas.length ? minhas.map(cartaoTurma).join('') : `<div class="vazio"><span>${souProf() ? 'Você ainda não criou turma. Toque em <b>+ Nova turma</b>.' : 'Nenhuma turma cadastrada ainda.'}</span></div>`}</section>
      ${outras.length ? `<section class="secao"><div class="secao-cab"><h2>Turmas de outros professores</h2><p>Você também pode matricular nelas.</p></div>${outras.map(cartaoTurma).join('')}</section>` : ''}
      ${avulsas.length ? `<section class="secao"><div class="secao-cab"><div><h2>Matrícula registrada sem turma</h2><p>Lançadas à mão na habilitação, antes das turmas existirem no sistema. Para organizar, matricule a pessoa numa turma (o número e a data vêm preenchidos).</p></div></div>
        <div class="fic-lista">${avulsas.map(m => linhaPessoa(m, `<span class="small muted num">${E(m.matricula_fic_numero || '')} · ${R.fmtData(m.matricula_fic_em)}</span>`)).join('')}</div></section>` : ''}
      ${S().eu.papel === 'coord_geral' && MQ.encUI ? MQ.encUI.secaoProfessor() : ''}
      ${MQ.entregasUI ? MQ.entregasUI.secaoAva() : ''}`;
  }

  function blocoSem(sem) {
    const ufs = MQ.UFS.filter(u => sem.some(m => m.uf === u.uf));
    const nome = m => `${E(nomeDe(m))} <span class="muted small">(${E(P[m.papel].curto)})</span>`;
    const semUF = sem.filter(m => !m.uf);   // coordenação técnica
    return `<div class="bloco fic-sem"><h3>Ainda sem matrícula no FIC (${sem.length})</h3>
      <div class="fic-ufs">${semUF.length ? `<div><span class="sigla">5 UF</span><span>${semUF.map(nome).join(' · ')}</span></div>` : ''}${ufs.map(u => `<div><span class="sigla">${u.uf}</span><span>${sem.filter(m => m.uf === u.uf).map(nome).join(' · ')}</span></div>`).join('')}</div></div>`;
  }

  function linhaPessoa(m, direita) {
    return `<div class="fic-pessoa">${U().avatar(m, 36)}<span class="fp-t"><b>${E(nomeDe(m))}</b><span class="small muted">${E(P[m.papel] ? P[m.papel].nome : m.papel)}${m.uf ? ' · ' + E(m.uf) : ''}${m.municipio ? ' · ' + E(m.municipio) : ''}</span></span><span class="fp-d">${direita || ''}</span></div>`;
  }

  function cartaoTurma(t) {
    const ms = matriculas().filter(x => x.turma_id === t.id).map(x => ({ x, m: pessoa(x.equipe_id) })).filter(o => o.m)
      .sort((a, b) => String(a.m.uf).localeCompare(String(b.m.uf)) || nomeDe(a.m).localeCompare(nomeDe(b.m)));
    const pode = podeNaTurma(t); const prof = pessoa(t.professor_id);
    const nMat = `${ms.length} matriculada${ms.length === 1 ? '' : 's'}`;
    return `<section class="fic-turma" aria-label="${E(t.nome)}">
      <header class="ft-cab">
        <div class="ft-tit"><h3>${E(t.nome)}</h3>
          <p class="ft-meta">${E(ondeT(t))} · ${E(periodo(t))} · Professor(a): ${E(nomeDe(prof))}</p></div>
        <div class="ft-dir"><span class="ft-total"><b class="num">${ms.length}</b> ${nMat.replace(/^\d+ /, '')}</span>
          ${pode ? `<span class="acoes"><button class="btn pri peq" data-acao="fic-matricular" data-id="${E(t.id)}">+ Matricular</button>${podeEditarTurma(t) ? `<button class="btn peq" data-acao="fic-turma-editar" data-id="${E(t.id)}">Editar</button>` : ''}</span>` : ''}</div>
      </header>
      ${t.obs ? `<p class="ft-obs small">${E(t.obs)}</p>` : ''}
      ${ms.length ? `<ul class="ft-lista">${ms.map(({ x, m }) => `<li class="ft-linha">${U().avatar(m, 30)}
          <span class="ft-pes"><span class="ft-nome">${E(nomeDe(m))}</span>
            <span class="ft-sub"><span class="etq">${E(P[m.papel] ? P[m.papel].nome : m.papel)}</span>${m.uf ? `<span class="etq etq-uf">${E(m.uf)}</span>` : ''}${m.municipio ? `<span class="ft-mun">${E(m.municipio)}</span>` : ''}</span></span>
          <span class="ft-mat"><span class="num">Nº ${E(x.numero)}</span><span class="ft-data num">${R.fmtData(x.matriculado_em)}</span></span>
          ${pode ? `<button class="ft-cancelar" data-acao="fic-cancelar" data-id="${E(x.id)}" aria-label="Cancelar a matrícula de ${E(nomeDe(m))}">Cancelar</button>` : '<span></span>'}</li>`).join('')}</ul>`
        : '<p class="ft-vazio small muted">Ninguém matriculado nesta turma ainda.</p>'}
    </section>`;
  }

  /* ---------- tela do professor ---------- */
  function telaProfessor() {
    const eu = Object.assign({}, S().eu, pessoa(S().eu.id) || {}); const s = R.situacao(eu);
    return `<main class="wrap" id="principal">
      <div class="cab"><div><span class="eyebrow">${E(P.professor_fic.nome)}</span><h1>Olá, ${E(nomeDe(eu).split(' ')[0])}</h1><p>${E(P.professor_fic.faz)}</p></div>
        <span class="chip chip-lg ${s.cod}">${E(s.rot)}</span></div>
      ${MQ.atalhos ? MQ.atalhos([['Matricular alunas', '#t-turmas', true, S().ficSemBanco ? 0 : deCampo().filter(m => !m.matricula_fic_em).length], ['Registrar encontro e presença', '#t-encontros'], ['Confirmar acesso ao AVA', '#t-ava'],
        ['Pedir a minha bolsa', '#t-pag', false, MQ.pagUI ? MQ.pagUI.contaDevolvidas() : 0]]) : ''}
      ${aba()}
      ${MQ.encUI ? MQ.encUI.secaoProfessor() : ''}
      ${MQ.regras.situacao(eu).cod === 'ok' ? '' : `<div class="bloco"><h2>Habilitação para receber a bolsa</h2><p class="small muted">A FUNCERN paga a bolsa depois destes passos. Documentos, conta ou Pix: auxiliar administrativo.</p>${U().passos(eu)}</div>`}
      ${MQ.pagUI ? MQ.pagUI.secaoMinha() : ''}
    </main>`;
  }

  /* ---------- seção na aba Equipe ---------- */
  function secaoEquipe() {
    const souGeral = S().eu.papel === 'coord_geral';
    const l = professores();
    // mesmo desenho da coordenação técnica: cartão da pessoa e, embaixo, a vaga para cadastrar
    return `<section class="secao" aria-labelledby="t-prof">
      <div class="secao-cab"><div><h2 id="t-prof">Professores do curso FIC</h2><p>IFRN · cadastrados pela coordenação geral · criam as turmas e matriculam a coordenação técnica, as bolsistas e as agentes</p></div></div>
      ${l.map(m => U().cartaoPessoa(m)).join('')}
      ${l.length >= MQ.regras.MAX_PROFESSORES ? `<p class="small muted vagas-cheias">As ${MQ.regras.MAX_PROFESSORES} vagas de professor do FIC estão ocupadas. Para trocar, desligue um e cadastre o outro.</p>`
        : U().vagaAberta ? U().vagaAberta(l.length ? `<b>1 professor cadastrado.</b> Falta 1: o projeto tem ${MQ.regras.MAX_PROFESSORES} professores do FIC.` : `Nenhum professor do FIC cadastrado. O projeto tem ${MQ.regras.MAX_PROFESSORES}. Digite os dados ou gere um link para ele preencher.`, souGeral,
        MQ.botaoAcao({ acao: 'novo', icone: 'capelo', texto: 'Cadastrar professor(a) do FIC', curto: 'Cadastrar', attrs: 'data-papel="professor_fic"' }), 'Vaga aberta') : ''}
    </section>`;
  }

  /* ---------- painéis ---------- */
  function painel(p) {
    if (p.tipo === 'fic-turma') return painelTurma(p);
    if (p.tipo === 'fic-matricular') return painelMatricular(p);
    if (p.tipo === 'fic-cancelar') return painelCancelar(p);
    return '';
  }
  const cab = (eyebrow, titulo) => `<div class="painel-cab"><div class="t"><span class="eyebrow">${eyebrow}</span><h2 id="painel-t">${titulo}</h2></div><button class="fechar" data-acao="fechar" aria-label="Fechar">×</button></div>`;

  function painelTurma(p) {
    const t = p.id ? turmas().find(x => x.id === p.id) || {} : { professor_id: souProf() ? S().eu.id : '' };
    const v = k => E(t[k] == null ? '' : t[k]);
    const op = (val, txt, atual) => `<option value="${E(val)}" ${String(val) === String(atual || '') ? 'selected' : ''}>${E(txt)}</option>`;
    return cab('Curso FIC', p.id ? 'Editar' : 'Nova turma') + `<div class="painel-corpo"><form class="f" data-form="fic-turma" data-id="${E(p.id || '')}" novalidate>
      <div class="campos">
        <div class="campo inteiro"><label for="ft-nome">Nome da turma</label><input id="ft-nome" name="nome" value="${v('nome')}" placeholder="Ex.: FIC Agroecologia e Quintais – Piauí" autofocus required></div>
        <div class="campo"><label for="ft-uf">Estado</label><select id="ft-uf" name="uf">${op('', 'Vários estados', t.uf)}${MQ.UFS.map(u => op(u.uf, u.nome, t.uf)).join('')}</select>
          <span class="dica">Turma de um estado só aceita gente daquele estado.</span></div>
        <div class="campo"><label for="ft-mun">Município (polo)</label><input id="ft-mun" name="municipio" value="${v('municipio')}" placeholder="Opcional"></div>
        <div class="campo"><label for="ft-ini">Início</label><input id="ft-ini" name="inicio" type="date" value="${p.id ? v('inicio') : E(t.inicio || R.hoje())}" min="${E(MQ.PROJETO.vigencia.inicio)}" max="${E(MQ.PROJETO.vigencia.fim)}">${p.id ? '' : '<span class="dica">Sugerido: hoje. Mude no calendário se for outro dia.</span>'}</div>
        <div class="campo"><label for="ft-fim">Fim</label><input id="ft-fim" name="fim" type="date" value="${v('fim')}"></div>
        ${!souProf() ? `<div class="campo inteiro"><label for="ft-prof">Professor(a)</label><select id="ft-prof" name="professor_id" required>${op('', 'Escolha', t.professor_id)}${professores().map(m => op(m.id, nomeDe(m), t.professor_id)).join('')}</select>
          ${professores().length ? '' : '<span class="dica">Cadastre antes o professor na aba Equipe.</span>'}</div>` : ''}
        <div class="campo inteiro"><label for="ft-obs">Observações</label><textarea id="ft-obs" name="obs" placeholder="Ex.: aulas quinzenais no sindicato; AVA no Moodle do IFRN.">${v('obs')}</textarea></div>
      </div>
      <div class="aviso erro" data-erro hidden></div>
      <div class="acoes"><button class="btn pri" type="submit">${p.id ? 'Salvar turma' : 'Criar turma'}</button><button class="btn" type="button" data-acao="fechar">Cancelar</button></div></form></div>`;
  }

  function painelMatricular(p) {
    const t = turmas().find(x => x.id === p.id); if (!t) return '';
    const emOutra = id => { const x = matDe(id); return x && x.turma_id !== t.id; };
    const cands = deCampo().filter(m => R.cabeNaTurma(t, m) && !emOutra(m.id))
      .sort((a, b) => (!!matDe(a.id) - !!matDe(b.id)) || (!!a.matricula_fic_em - !!b.matricula_fic_em) || String(a.uf).localeCompare(String(b.uf)) || nomeDe(a).localeCompare(nomeDe(b)));
    const fora = deCampo().filter(m => !R.cabeNaTurma(t, m) || emOutra(m.id)).length;
    return cab(E(t.nome), 'Matricular') + `<div class="painel-corpo"><form class="f" data-form="fic-matricular" data-id="${E(t.id)}" novalidate>
      <p class="small muted">Marque quem entra na turma e escreva o número da matrícula do SUAP de cada uma. Quem já está nesta turma aparece marcado: mudar o número ou a data corrige a matrícula.</p>
      <div class="campo" style="max-width:240px"><label for="fm-data">Data da matrícula</label><input id="fm-data" name="data" type="date" value="${R.hoje()}" max="${R.hoje()}" required></div>
      ${cands.length ? `<div class="fic-marcar">${cands.map(m => { const x = matDe(m.id); const num = x ? x.numero : (m.matricula_fic_numero || '');
          return `<label class="fm-l"><input type="checkbox" name="p" value="${E(m.id)}" ${x ? 'checked' : ''}>${U().avatar(m, 32)}<span class="fp-t"><b>${E(nomeDe(m))}</b><span class="small muted">${E(P[m.papel].curto)} · ${E(m.uf)}${x ? ' · já nesta turma' : m.matricula_fic_em ? ' · matrícula sem turma' : ''}</span></span>
            <input class="fm-num" name="n_${E(m.id)}" value="${E(num)}" placeholder="Nº SUAP" aria-label="Número da matrícula de ${E(nomeDe(m))}" autocomplete="off"></label>`; }).join('')}</div>`
        : '<p class="muted">Ninguém disponível para esta turma.</p>'}
      ${fora ? `<p class="small muted">${fora} pessoa${fora > 1 ? 's' : ''} de outro estado ou já em outra turma não aparece${fora > 1 ? 'm' : ''} aqui.</p>` : ''}
      <div class="aviso erro" data-erro hidden></div>
      <div class="acoes"><button class="btn pri" type="submit">Salvar</button><button class="btn" type="button" data-acao="fechar">Cancelar</button></div></form></div>`;
  }

  function painelCancelar(p) {
    const x = matriculas().find(y => y.id === p.id); if (!x) return '';
    const m = pessoa(x.equipe_id) || {};
    const temVisita = (S().visitas || []).some(v => v.executor_id === m.id && v.situacao !== 'cancelada');
    return cab('Curso FIC', 'Cancelar matrícula') + `<div class="painel-corpo"><form class="f" data-form="fic-cancelar" data-id="${E(x.id)}" novalidate>
      <p><b>${E(nomeDe(m))}</b> · Nº ${E(x.numero)} · ${R.fmtData(x.matriculado_em)}</p>
      ${temVisita ? '<div class="aviso erro">Ela já tem visita no roteiro de campo, que depende da matrícula: o cancelamento será recusado. Para corrigir número ou data, use <b>+ Matricular</b> na mesma turma.</div>' : ''}
      <p class="small muted">Ao cancelar, a habilitação dela volta a ficar sem matrícula no FIC.</p>
      <div class="campo"><label for="fc-mot">Motivo</label><textarea id="fc-mot" name="motivo" placeholder="Ex.: matrícula lançada na pessoa errada; desistiu do curso." required></textarea></div>
      <div class="aviso erro" data-erro hidden></div>
      <div class="acoes"><button class="btn perigo" type="submit">Cancelar matrícula</button><button class="btn" type="button" data-acao="fechar">Voltar</button></div></form></div>`;
  }

  /* ---------- ações ---------- */
  async function recarregar() { await U().carregar(); U().render(); }
  async function clique(a, el) {
    if (a === 'fic-turma-nova') U().abrirPainel({ tipo: 'fic-turma' });
    else if (a === 'fic-turma-editar') U().abrirPainel({ tipo: 'fic-turma', id: el.dataset.id });
    else if (a === 'fic-matricular') U().abrirPainel({ tipo: 'fic-matricular', id: el.dataset.id });
    else if (a === 'fic-cancelar') U().abrirPainel({ tipo: 'fic-cancelar', id: el.dataset.id });
  }
  const DATA_MIN = '2026-01-01', DATA_MAX = '2027-12-31', MAX_NOME_TURMA = 120;
  const dataExiste = v => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v || '')); if (!m) return false; const t = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])); return t.getUTCFullYear() === +m[1] && t.getUTCMonth() === +m[2] - 1 && t.getUTCDate() === +m[3]; };
  async function enviar(tipo, form, fd) {
    const txt = k => String(fd.get(k) || '').trim();
    if (tipo === 'fic-turma') {
      const id = form.dataset.id || null; const antes = id ? turmas().find(x => x.id === id) : null;
      if (antes && !podeEditarTurma(antes)) return U().mostrarErros(form, {}, 'Esta turma é de outro(a) professor(a): só ele(a) ou a coordenação geral altera.');
      const t = { id, nome: txt('nome'), uf: txt('uf') || null, municipio: txt('municipio') || null, inicio: txt('inicio') || null, fim: txt('fim') || null, obs: txt('obs') || null,
        professor_id: souProf() ? (antes ? antes.professor_id : S().eu.id) : txt('professor_id') || (antes && antes.professor_id) };
      const e = {};
      if (t.nome.length < 3) e.nome = 'Dê um nome à turma.';
      else if (t.nome.length > MAX_NOME_TURMA) e.nome = `Texto muito longo (máximo ${MAX_NOME_TURMA} caracteres).`;
      [['inicio', 'O início'], ['fim', 'O fim']].forEach(([k, rot]) => { if (t[k] && (!dataExiste(t[k]) || t[k] < DATA_MIN || t[k] > DATA_MAX)) e[k] = rot + ' da turma fica entre 01/01/2026 e 31/12/2027.'; });
      if (!t.professor_id) e.professor_id = 'Escolha o professor.';
      if (!e.inicio && !e.fim && t.inicio && t.fim && t.fim < t.inicio) e.fim = 'O fim é antes do início.';
      if (antes && antes.uf !== t.uf && t.uf && matriculas().some(x => x.turma_id === id && (pessoa(x.equipe_id) || {}).uf !== t.uf)) e.uf = 'Há gente de outro estado matriculada nesta turma.';
      if (Object.keys(e).length) return U().mostrarErros(form, e);
      await U().ocupado(form, async () => { await S().api.salvarTurma(t); await recarregar(); U().fecharPainel(); U().toast(id ? 'Turma salva.' : 'Turma criada. Agora matricule as pessoas.'); });
    }
    if (tipo === 'fic-matricular') {
      const turma = form.dataset.id; const data = txt('data');
      const marcados = fd.getAll('p'); const e = {};
      if (!data) e.data = 'Informe a data.'; else if (!dataExiste(data)) e.data = 'Data inválida.'; else if (data > R.hoje()) e.data = 'Data no futuro. Registre só a matrícula já feita.';
      else if (data < DATA_MIN) e.data = 'Data antes de 2026: confira o ano da matrícula.';
      else { const tu = turmas().find(x => x.id === turma); if (tu && tu.inicio && data < tu.inicio) e.data = 'A turma começa em ' + R.fmtData(tu.inicio) + ': a data da matrícula não pode ser antes disso.'; }
      if (!marcados.length) return U().mostrarErros(form, e, 'Marque pelo menos uma pessoa.');
      const faltaNum = marcados.filter(id => txt('n_' + id).length < 3);
      if (faltaNum.length) return U().mostrarErros(form, e, 'Falta o número da matrícula (SUAP) de: ' + faltaNum.map(id => nomeDe(pessoa(id))).join(', ') + '.');
      if (Object.keys(e).length) return U().mostrarErros(form, e);
      await U().ocupado(form, async () => {
        const falhas = []; let ok = 0;
        for (const id of marcados) {
          const x = matDe(id); if (x && x.turma_id === turma && x.numero === txt('n_' + id) && x.matriculado_em === data) continue;
          try { await S().api.matricular(turma, id, txt('n_' + id), data); ok++; } catch (err) { falhas.push(nomeDe(pessoa(id)) + ': ' + err.message); }
        }
        await recarregar();
        if (falhas.length) { U().abrirPainel({ tipo: 'fic-matricular', id: turma }); const f = document.querySelector('form[data-form=fic-matricular]'); if (f) U().mostrarErros(f, {}, falhas.join(' · ')); }
        else U().fecharPainel();
        U().toast(ok ? ok + (ok > 1 ? ' matrículas salvas.' : ' matrícula salva.') + ' A habilitação foi atualizada.' : 'Nada mudou.');
      });
    }
    if (tipo === 'fic-cancelar') {
      const motivo = txt('motivo');
      if (motivo.length < 5) return U().mostrarErros(form, { motivo: 'Escreva o motivo.' });
      await U().ocupado(form, async () => { await S().api.cancelarMatricula(form.dataset.id, motivo); await recarregar(); U().fecharPainel(); U().toast('Matrícula cancelada.'); });
    }
  }

  MQ.ficUI = { aba, telaProfessor, secaoEquipe, painel, clique, enviar };
})();
