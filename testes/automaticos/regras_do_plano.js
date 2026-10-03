/* Regras do plano de trabalho, pela camada que a tela usa (aplicativo real no navegador, modo demonstração).
   Cada caso tenta fazer o que o plano proíbe e confere que o sistema recusa com a mensagem certa.
   Os dois primeiros casos clicam na tela de ponta a ponta; os demais chamam a mesma ação que o botão da tela chama.
   Uso: node regras_do_plano.js <caminho do playwright>   (servidor de teste em http://localhost:8766) */
const { chromium } = require(process.argv[2]);
const CFG = "window.MQ=window.MQ||{};MQ.CONFIG={supabaseUrl:'',supabaseAnonKey:'',semServiceWorker:true};";
const R = []; const ok = (n, c, d = '') => { R.push([c ? 'PASSOU' : 'FALHOU', n, d]); console.log((c ? 'PASSOU' : 'FALHOU') + ' | ' + n + (d ? ' | ' + String(d).slice(0, 150) : '')); };
(async () => { const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, bypassCSP: true });   // o roteiro monta funções dentro da página (a política de conteúdo tem roteiro próprio)
   const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await ctx.route('**/js/config.js', r => r.fulfill({ contentType: 'text/javascript', body: CFG })); await ctx.route('**/fonts.g*/**', r => r.abort());
  await p.goto('http://localhost:8766/'); await p.waitForSelector('.resumo'); await p.evaluate(async () => { await MQ.apiDemo.recomecar(); }); await p.reload(); await p.waitForSelector('.resumo');
  const como = async pf => { await p.evaluate(pf => { MQ.ui.fecharPainel(); document.querySelector(`button[data-p=${pf}]`).click(); }, pf); await p.waitForTimeout(500); await p.evaluate(() => MQ.ui.fecharPainel()); };
  // mexe direto nos dados de demonstração e recarrega (como o volume.js)
  const dados = async fn => { await p.evaluate(fn => { const d = JSON.parse(localStorage.getItem('mq-demo-v4')); (new Function('d', 'MQ', fn))(d, MQ); localStorage.setItem('mq-demo-v4', JSON.stringify(d)); }, '(' + fn.toString() + ')(d, MQ)'); await p.reload(); await p.waitForSelector('.resumo'); };
  const tenta = (fn, arg) => p.evaluate(async ({ fn, arg }) => { try { await (new Function('MQ', 'arg', 'return (' + fn + ')(MQ, arg)'))(MQ, arg); return ''; } catch (e) { return MQ.regras.mensagemErro(e) || String(e.message || e); } }, { fn: fn.toString(), arg });
  const recusa = async (nome, re, fn, arg) => { const m = await tenta(fn, arg); ok(nome, re.test(m), m || 'ACEITOU'); };

  // ---------- 1. 40 selecionadas por estado: clicando na tela ----------
  await dados((d) => { const base = d.fichas.find(f => f.uf === 'PI'); d.fichas = d.fichas.filter(f => f.uf !== 'PI');
    for (let i = 0; i < 41; i++) d.fichas.push(Object.assign({}, base, { id: 'aaaaaaaa-0000-4000-8000-' + String(i).padStart(12, '0'), nome: 'Mulher Regra ' + i, cpf: (n => { const b = String(n).padStart(9, '0').split('').map(Number); for (let k = 0; k < 2; k++) { const t = b.reduce((x, y, j) => x + y * (b.length + 1 - j), 0) % 11; b.push(t < 2 ? 0 : 11 - t); } return b.join(''); })(200000000 + i * 37), endereco: 'Sítio Regra ' + i, uf: 'PI', resultado: 'selecionada', situacao: i < 40 ? 'aprovada' : 'aguardando', obs_coord: null })); });
  await como('coord_tecnico'); await p.evaluate(() => { MQ.ui.S.aba = 'selecao'; MQ.ui.render(); }); await p.waitForTimeout(400);
  await p.evaluate(() => { const b = [...document.querySelectorAll('[data-acao=ficha-ver]')].find(x => /Mulher Regra 40/.test(x.textContent)) || document.querySelector('.painel-sit [data-acao=ficha-ver]'); b.click(); }); await p.waitForTimeout(500);
  const btAprovar = await p.evaluate(() => { const b = [...document.querySelectorAll('#painel button')].find(x => /^Aprovar/.test(x.textContent.trim())); if (b) { b.click(); return true; } return false; }); await p.waitForTimeout(700);
  const txt1 = await p.evaluate(() => (document.querySelector('#painel') || document.body).textContent + ' ' + [...document.querySelectorAll('.toast')].map(x => x.textContent).join(' '));
  ok('40 por estado: a tela recusa a 41ª aprovação com a mensagem da lista de espera', btAprovar && /40 selecionadas/.test(txt1), btAprovar ? txt1.match(/.{0,40}40 selecionadas.{0,60}/) || 'sem a mensagem' : 'sem botão Aprovar');
  ok('40 por estado: continuam 40 aprovadas no Piauí', await p.evaluate(() => MQ.ui.S.fichas.filter(f => f.uf === 'PI' && f.situacao === 'aprovada' && f.resultado === 'selecionada').length) === 40);

  // ---------- 2. fichas: CPF repetido e menor de 18 (validação da tela) ----------
  await como('bolsista');
  const v = await p.evaluate(() => { const S = MQ.ui.S; const f0 = S.fichas.find(f => f.uf === S.eu.uf) || S.fichas[0]; const hoje = MQ.regras.hoje();
    const rep = MQ.regras.validarFicha(Object.assign({}, f0, { id: 'nova-1' }), S.fichas);
    const nasc = (new Date().getFullYear() - 17) + '-01-01';
    const menor = MQ.regras.validarFicha(Object.assign({}, f0, { id: 'nova-2', cpf: '52998224725', data_nascimento: nasc, data_ficha: hoje, c_maior18: true }), S.fichas);
    return { rep: rep.cpf || '', menor: menor.c_maior18 || '' }; });
  ok('CPF repetido: o formulário da ficha acusa', /já tem ficha/.test(v.rep), v.rep);
  ok('menor de 18: o formulário da ficha acusa', /menos de 18/.test(v.menor), v.menor);
  await recusa('CPF repetido: salvar a ficha é recusado', /já tem ficha|CPF/i, async (MQ) => { const S = MQ.ui.S; const f0 = S.fichas.find(f => f.uf === S.eu.uf); return S.api.salvarFicha(Object.assign({}, f0, { id: crypto.randomUUID(), nome: 'Outra Pessoa Teste' }), {}); });

  // ---------- 3. campo: ordem das visitas, habilitação e 200 dias ----------
  const ctx3 = await p.evaluate(() => { const S = MQ.ui.S; const uf = S.eu.uf; const comDiag = new Set(S.visitas.filter(x => x.etapa === 'diagnostico' && x.situacao === 'realizada').map(x => x.ficha_id));
    const f = S.fichas.find(x => x.uf === uf && x.situacao === 'aprovada' && x.resultado === 'selecionada' && !comDiag.has(x.id)); const naoHab = S.equipe.find(m => m.status === 'ativa' && m.uf === uf && ['agente', 'apoio', 'articulacao'].includes(m.papel) && !MQ.regras.habilitado(m));
    return { ficha: f && f.id, uf, eu: S.eu.id, naoHab: naoHab && naoHab.id }; });
  await recusa('ordem das visitas: implantação antes do diagnóstico é recusada', /Primeiro o diagn/, (MQ, a) => MQ.ui.S.api.salvarVisita({ id: crypto.randomUUID(), ficha_id: a.ficha, uf: a.uf, etapa: 'implantacao', executor_id: a.eu, data_prevista: MQ.regras.somaDias(MQ.regras.hoje(), 5), situacao: 'prevista' }), ctx3);
  if (ctx3.naoHab) await recusa('habilitação: visita para quem não está habilitada é recusada', /habilitad/, (MQ, a) => MQ.ui.S.api.salvarVisita({ id: crypto.randomUUID(), ficha_id: a.ficha, uf: a.uf, etapa: 'diagnostico', executor_id: a.naoHab, data_prevista: MQ.regras.somaDias(MQ.regras.hoje(), 5), situacao: 'prevista' }), ctx3);
  else ok('habilitação: visita para quem não está habilitada é recusada', false, 'não há pessoa não habilitada nos dados de exemplo');
  await dados((d) => { const v0 = d.visitas[0]; const f = d.fichas.find(x => x.uf === 'PI'); for (let i = 0; i < 200; i++) d.visitas.push(Object.assign({}, v0, { id: 'bbbbbbbb-0000-4000-8000-' + String(i).padStart(12, '0'), ficha_id: f.id, uf: 'PI', etapa: 'acompanhamento', situacao: 'prevista', data_realizada: null })); });
  await como('bolsista');
  await recusa('200 dias de campo por estado: a visita 201 é recusada', /200 dias/, (MQ) => { const S = MQ.ui.S; const f = S.fichas.find(x => x.uf === S.eu.uf && x.situacao === 'aprovada' && x.resultado === 'selecionada'); return S.api.salvarVisita({ id: crypto.randomUUID(), ficha_id: f.id, uf: S.eu.uf, etapa: 'diagnostico', executor_id: S.eu.id, data_prevista: MQ.regras.somaDias(MQ.regras.hoje(), 5), situacao: 'prevista' }); });

  // ---------- 4. pagamentos: uma bolsa por mês e ajuda de custo só de visita feita ----------
  await p.evaluate(async () => { await MQ.apiDemo.recomecar(); }); await p.reload(); await p.waitForSelector('.resumo'); await como('bolsista');
  const mes = await p.evaluate(() => MQ.regras.hoje().slice(0, 7) + '-01');
  const prim = await tenta((MQ, mes) => MQ.ui.S.api.solicitarPagamento('bolsa', mes, MQ.PAPEIS[MQ.ui.S.eu.papel].bolsa, 'Relatório do mês: comunidades mobilizadas, fichas lançadas e visitas acompanhadas.', null, null), mes);
  await recusa('uma bolsa por mês: o segundo pedido do mesmo mês é recusado', /já solicitou este mês/i, (MQ, mes) => MQ.ui.S.api.solicitarPagamento('bolsa', mes, MQ.PAPEIS[MQ.ui.S.eu.papel].bolsa, 'Relatório do mês: comunidades mobilizadas, fichas lançadas e visitas acompanhadas.', null, null), mes);
  ok('uma bolsa por mês: o primeiro pedido tinha sido aceito (ou barrado por entregas, não por repetição)', prim === '' || /entrega/i.test(prim), prim || 'aceito');
  await recusa('ajuda de custo: pedido sem visita feita é recusado', /Marque as visitas|visita/i, (MQ, mes) => MQ.ui.S.api.solicitarPagamento('ajuda_custo', mes, 500, null, [], null), mes);
  await recusa('ajuda de custo: visita que ainda não foi feita não entra no pedido', /feita|realizada|não (pode|entra)|visita/i, (MQ, mes) => { const S = MQ.ui.S; const v = S.visitas.find(x => x.situacao === 'prevista'); return S.api.solicitarPagamento('ajuda_custo', mes, 200, null, [v.id], null); }, mes);

  // ---------- 5. kit de até R$ 5.000 ----------
  await recusa('kit: plano com R$ 5.001 é recusado', /kit passa|5\.000/, (MQ) => { const S = MQ.ui.S; const dg = S.diagnosticos[0]; const dados = Object.assign({}, dg.dados, { kit: [{ item: 'Tela', qtd: '1', valor: 5001 }] }); return S.api.salvarDiagnostico(Object.assign({}, dg, { dados }), {}); });

  // ---------- 6. tetos de passagens e eventos ----------
  await dados((d) => { d.pedidos = d.pedidos || []; const eu = d.equipe.find(m => m.papel === 'articulacao' && m.uf === 'PI'); const tec = d.equipe.find(m => m.papel === 'coord_tecnico');
    d.pedidos.push({ id: 'cccccccc-0000-4000-8000-000000000001', tipo: 'evento', uf: 'PI', titulo: 'Evento de teste do teto', data_evento: '2027-05-10', situacao: 'conferido', solicitante_id: eu.id, conferido_por: tec.id, conferido_em: new Date().toISOString(), enviado_em: new Date().toISOString(), dados: { valor_estimado: 6500, itens: [] }, valor_autorizado: 6500 }); });
  await como('coord_geral');
  await recusa('teto de eventos: autorizar R$ 6.500 num estado é recusado', /Passa do teto/, (MQ) => MQ.ui.S.api.moverPedido('cccccccc-0000-4000-8000-000000000001', 'autorizar', null, null));

  ok('nenhum erro de página', errs.length === 0, errs[0] || '');
  const f = R.filter(x => x[0] === 'FALHOU').length; console.log('TOTAL ' + R.length + ' FALHAS ' + f); await b.close(); process.exit(f ? 1 : 0); })();
