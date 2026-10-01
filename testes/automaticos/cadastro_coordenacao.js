const { chromium } = require(process.argv[2]);
const R = []; const ok = (n, c, d = '') => R.push([c ? 'PASSOU' : 'FALHOU', n, d]);
let seq = 100000000; const cpf = () => { const b = String(seq++).padStart(9, '0').split('').map(Number);
  const dv = a => { const s = a.reduce((t, x, i) => t + x * (a.length + 1 - i), 0) % 11; return s < 2 ? 0 : 11 - s; }; b.push(dv(b)); b.push(dv(b)); return b.join(''); };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'pt-BR' });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await ctx.route('**/js/config.js', r => r.fulfill({ contentType: 'text/javascript', body: "window.MQ=window.MQ||{};MQ.CONFIG={supabaseUrl:'',supabaseAnonKey:'',semServiceWorker:true};" }));
  await ctx.route('**/cdn.jsdelivr.net/**', r => r.abort()); await ctx.route('**/fonts.g*/**', r => r.abort()); await ctx.route('**/viacep.com.br/**', r => r.abort());
  await p.goto('http://localhost:8766/'); await p.evaluate(() => { localStorage.clear(); sessionStorage.clear(); }); await p.reload(); await p.waitForSelector('.dx-topo, .eq-kpis, .resumo');
  const como = async papel => { await p.click(`button[data-p=${papel}]`); await p.waitForTimeout(400); await p.evaluate(() => MQ.ui.fecharPainel && MQ.ui.fecharPainel()); await p.waitForTimeout(150); };
  const aba = async a => { await p.evaluate(a => { const b = document.querySelector(`[data-acao=aba][data-aba=${a}]`); b && b.click(); }, a); await p.waitForTimeout(300); };
  const equipe = () => p.evaluate(() => MQ.ui.S.equipe);
  const toastTxt = () => p.$eval('#toast', t => t.textContent).catch(() => '');
  const erroTxt = () => p.$eval('form[data-form=cadastro] [data-erro]', e => e.hidden ? '' : e.textContent).catch(() => '');
  const semRolagem = async n => { const w = await p.evaluate(() => document.documentElement.scrollWidth); ok(n + ': sem rolagem para os lados', w <= 390, 'largura ' + w); };
  async function preencher(d) {
    await p.fill('#c-nome', d.nome); await p.fill('#c-cpf', d.cpf); await p.fill('#c-fone', d.tel || '(84) 99888-7766'); await p.fill('#c-email', d.email);
    if (d.mun != null) await p.fill('#dp-cid', d.mun);
    if (d.arlo !== undefined) await p.click(`#w-cadastro_arlo label:has-text("${d.arlo ? 'Sim' : 'Não'}")`);
    if (d.perfil) for (const k of ['agricultora', 'atua_mulheres', 'mora_rural', 'internet', 'outra_bolsa']) await p.click(`#w-pf_${k} label:has-text("${d.perfil[k] ? 'Sim' : 'Não'}")`).catch(() => {});
    if (d.exp) await p.selectOption('#pf-exp', d.exp).catch(() => {});
    if (d.nasc) await p.fill('#dp-nasc', d.nasc).catch(() => {});
    if (d.lgpd !== false) await p.check('#c-lgpd');
  }
  const salvar = async () => { await p.click('form[data-form=cadastro] button[type=submit]'); await p.waitForTimeout(500); };
  const abrirManual = async sel => { await clickV(sel); await p.waitForTimeout(300); if (await p.$('[data-acao=cad-modo][data-m=manual]')) { await p.click('[data-acao=cad-modo][data-m=manual]'); await p.waitForTimeout(250); } return !!(await p.$('form[data-form=cadastro]')); };
  const vis = async sel => (await p.locator(sel + ' >> visible=true').count()) > 0;
  const clickV = sel => p.locator(sel + ' >> visible=true').first().click();
  const pf = { agricultora: true, atua_mulheres: true, mora_rural: true, internet: true, outra_bolsa: false };

  // ================= COORDENAÇÃO TÉCNICA =================
  await como('coord_tecnico'); await aba('equipe');
  await semRolagem('Equipe (coord. técnica)');
  ok('Coord. técnica NÃO vê botão para cadastrar professor', !(await vis('[data-acao=novo][data-papel=professor_fic]')));
  ok('Coord. técnica NÃO vê botão para cadastrar auxiliar', !(await vis('[data-acao=novo][data-papel=auxiliar_adm]')));
  ok('Coord. técnica NÃO vê botão para cadastrar coord. técnica', !(await vis('[data-acao=novo][data-papel=coord_tecnico]')));
  ok('Vaga de articulação PI ocupada: sem botão de cadastro', !(await vis('[data-acao=novo][data-papel=articulacao][data-uf=PI]')));
  ok('Vagas livres aparecem com botão (articulação AL)', await vis('[data-acao=novo][data-papel=articulacao][data-uf=AL]'));
  // escolha do modo
  await clickV('[data-acao=novo][data-papel=articulacao][data-uf=AL]'); await p.waitForTimeout(300);
  ok('Abre a escolha: link ou digitar', !!(await p.$('[data-m=link]')) && !!(await p.$('[data-m=manual]')));
  await p.click('[data-m=manual]'); await p.waitForTimeout(250);
  ok('"Digitar os dados agora" abre o formulário', !!(await p.$('form[data-form=cadastro]')));
  await semRolagem('Formulário de cadastro');
  ok('Mostra o Perfil da bolsista antes do botão Cadastrar', !!(await p.$('.perfil-bols')));
  ok('Data de início vem com a data de hoje (dentro da vigência)', !!(await p.inputValue('#c-ini')));
  // vazio
  await salvar();
  const nErr = await p.$$eval('form[data-form=cadastro] .tem-erro', l => l.length);
  ok('Salvar vazio: marca os campos obrigatórios', nErr >= 5, nErr + ' marcados; ' + await erroTxt());
  // CPF inválido, celular curto, email ruim
  await preencher({ nome: 'Ana Alagoas Teste', cpf: '111.111.111-11', tel: '(82) 9999', email: 'ana@gmail', arlo: false, perfil: pf, exp: 'ate2' });
  await salvar();
  const campos = await p.$$eval('form[data-form=cadastro] .campo.tem-erro input', l => l.map(i => i.name));
  ok('CPF inválido (111...) recusado', campos.includes('cpf'), campos.join(','));
  ok('Celular incompleto recusado', campos.includes('telefone'));
  ok('E-mail sem .com recusado', campos.includes('email'));
  // CPF de pessoa ativa
  const eq = await equipe(); const ana = eq.find(m => m.papel === 'articulacao' && m.uf === 'PI');
  await p.fill('#c-cpf', ana.cpf); await p.fill('#c-fone', '(82) 99999-1111'); await p.fill('#c-email', 'ana.al@gmail.com'); await salvar();
  ok('CPF de quem já está na equipe recusado', /já ocupa/.test(await p.$eval('#c-cpf', e => e.closest('.campo').textContent)));
  await p.fill('#c-cpf', cpf()); await p.fill('#c-email', ana.email.toUpperCase()); await salvar();
  ok('E-mail de quem já está na equipe (maiúsculas) recusado', /já está em uso/.test(await p.$eval('#c-email', e => e.closest('.campo').textContent)));
  // SIAPE ruim
  await p.fill('#c-email', 'ana.al@gmail.com'); await p.fill('#c-siape', '12'); await salvar();
  ok('SIAPE com 2 números recusado', /SIAPE/.test(await p.$eval('#c-siape', e => e.closest('.campo').textContent)));
  await p.fill('#c-siape', '');
  // metas negativas
  await p.fill('#c-md', '-1'); await salvar();
  ok('Meta negativa recusada', /negativo/.test(await p.$eval('#c-md', e => e.closest('.campo').textContent)));
  await p.fill('#c-md', '8');
  // nascimento absurdo
  await p.fill('#dp-nasc', '2020-01-01'); await salvar();
  ok('Nascimento de criança recusado', /inválida/.test(await p.$eval('#dp-nasc', e => e.closest('.campo').textContent)));
  await p.fill('#dp-nasc', '1990-02-02');
  // sem LGPD
  await p.uncheck('#c-lgpd'); await salvar();
  ok('Sem ciência LGPD não salva', !!(await p.$('#w-lgpd.tem-erro')) && !!(await p.$('form[data-form=cadastro]')));
  await p.check('#c-lgpd'); await salvar();
  let t = await toastTxt(); let e2 = await equipe(); let nova = e2.find(m => m.email === 'ana.al@gmail.com');
  ok('Articulação AL cadastrada', !!nova, t);
  ok('Mensagem diz o próximo passo (FIC)', /FIC/.test(t), t);
  ok('Depois de salvar abre a ficha da pessoa', /Ana Alagoas/.test(await p.textContent('#painel-t').catch(() => '')));
  const priv = await p.evaluate(id => MQ.ui.S.api.lerPrivado(id), nova.id);
  ok('Perfil no campo salvo', priv && priv.perfil && priv.perfil.agricultora === true, JSON.stringify(priv && priv.perfil));
  ok('Nascimento salvo', priv && priv.data_nascimento === '1990-02-02');
  ok('Ficha mostra o botão de gerar código de acesso', !!(await p.$('text=Gerar código de acesso')));
  // mesma vaga de novo
  await p.evaluate(() => MQ.ui.fecharPainel()); await p.waitForTimeout(200);
  ok('Vaga AL agora ocupada (sem botão)', !(await vis('[data-acao=novo][data-papel=articulacao][data-uf=AL]')));
  // apoio BA com Arlo = Sim e perfil (bug corrigido: perfil tem de salvar mesmo sem endereço)
  ok('Abre cadastro de apoio BA', await abrirManual('[data-acao=novo][data-papel=apoio][data-uf=BA]'));
  await preencher({ nome: 'Bia Bahia Arlo', cpf: cpf(), email: 'bia.ba@gmail.com', arlo: true, perfil: pf, exp: 'mais5' }); await salvar();
  e2 = await equipe(); nova = e2.find(m => m.email === 'bia.ba@gmail.com');
  ok('Apoio BA com Arlo cadastrada', !!nova, await erroTxt());
  const pv2 = nova && await p.evaluate(id => MQ.ui.S.api.lerPrivado(id), nova.id);
  ok('Com Arlo = Sim, o perfil no campo também fica salvo', pv2 && pv2.perfil && pv2.perfil.experiencia === 'mais5', JSON.stringify(pv2));
  ok('Registro diz "tem cadastro no Arlo"', nova && nova.cadastro_arlo === true);
  await p.evaluate(() => MQ.ui.fecharPainel()); await p.waitForTimeout(200);
  // agente PE (sem limite) — duas
  ok('Abre cadastro de agente PE', await abrirManual('[data-acao=novo][data-papel=agente][data-uf=PE]'));
  ok('Agente: formulário sem "Previsão de atividades"', !(await p.$('#c-md')));
  await preencher({ nome: 'Cida Agente Pernambuco', cpf: cpf(), email: 'cida@gmail.com', arlo: false, perfil: pf, exp: 'nenhuma', nasc: '1978-07-07', mun: 'Afogados da Ingazeira/PE' }); await salvar();
  ok('Agente PE cadastrada', !!(await equipe()).find(m => m.email === 'cida@gmail.com'), await erroTxt());
  await p.evaluate(() => MQ.ui.fecharPainel()); await p.waitForTimeout(200);
  await abrirManual('[data-acao=novo][data-papel=agente][data-uf=PE]');
  await preencher({ nome: 'Dete Agente Pernambuco', cpf: cpf(), email: 'dete@gmail.com', arlo: true, perfil: pf, exp: 'ate2' }); await salvar();
  ok('Segunda agente no mesmo estado cadastrada', !!(await equipe()).find(m => m.email === 'dete@gmail.com'), await erroTxt());
  // nome com espaços extras
  await p.evaluate(() => MQ.ui.fecharPainel()); await abrirManual('[data-acao=novo][data-papel=agente][data-uf=SE]');
  await preencher({ nome: '  maria   do socorro   silva ', cpf: cpf(), email: ' Socorro@Gmail.com ', arlo: true }); await salvar();
  const so = (await equipe()).find(m => /socorro/i.test(m.email));
  ok('Nome e e-mail com espaços extras são limpos', so && so.nome === 'maria do socorro silva' && so.email === 'socorro@gmail.com', so && JSON.stringify([so.nome, so.email]));
  // editar
  await p.evaluate(() => MQ.ui.fecharPainel()); await p.waitForTimeout(150);
  const cida = (await equipe()).find(m => m.email === 'cida@gmail.com');
  await p.evaluate(id => MQ.ui.abrirPainel({ tipo: 'detalhe', id }), cida.id); await p.waitForTimeout(250);
  await p.click('[data-acao=editar]'); await p.waitForTimeout(400);
  ok('Editar: CPF não pode ser mudado', await p.$eval('#c-cpf', e => e.readOnly));
  ok('Editar: dados pessoais já vêm preenchidos (nascimento)', (await p.inputValue('#dp-nasc').catch(() => '')) === '1978-07-07');
  ok('Editar: perfil já vem marcado', (await p.$$eval('.perfil-campo input[type=radio]:checked', l => l.length)) === 5);
  await p.fill('#c-fone', '(87) 98888-0000'); await salvar();
  ok('Editar celular salva', (await equipe()).find(m => m.id === cida.id).telefone.replace(/\D/g, '') === '87988880000', await toastTxt());
  // desligar e substituir (coord técnica: apoio PI)
  const rita = (await equipe()).find(m => m.papel === 'apoio' && m.uf === 'PI');
  await p.evaluate(id => MQ.ui.abrirPainel({ tipo: 'detalhe', id }), rita.id); await p.waitForTimeout(250);
  await p.click('[data-acao=desligar-abrir]'); await p.waitForTimeout(200);
  await p.click('form[data-form=desligar] button[type=submit]'); await p.waitForTimeout(300);
  const aindaAtiva = (await equipe()).find(m => m.id === rita.id).status === 'ativa';
  ok('Desligar sem escolher o motivo não desliga', aindaAtiva, await p.$eval('form[data-form=desligar] [data-erro]', e => e.textContent).catch(() => ''));
  await p.selectOption('#d-motivo', { index: 1 }); await p.fill('#d-det', 'Pediu para sair, avisou por WhatsApp.'); await p.click('form[data-form=desligar] button[type=submit]'); await p.waitForTimeout(500);
  ok('Desligar com motivo desliga', (await equipe()).find(m => m.id === rita.id).status === 'desligada', await toastTxt());
  await aba('equipe');
  ok('Vaga de apoio PI abre para substituta', await vis('[data-acao=novo][data-papel=apoio][data-uf=PI][data-subst]'));
  await abrirManual('[data-acao=novo][data-papel=apoio][data-uf=PI][data-subst]');
  ok('Formulário diz quem ela substitui', /Substitui/.test(await p.textContent('form[data-form=cadastro]')));
  await preencher({ nome: 'Rosa Substituta Piaui', cpf: cpf(), email: 'rosa.pi@gmail.com', arlo: true, perfil: pf, exp: 'ate2' }); await salvar();
  const rosa = (await equipe()).find(m => m.email === 'rosa.pi@gmail.com');
  ok('Substituta cadastrada e ligada à anterior', rosa && rosa.substitui_id === rita.id, await erroTxt());
  // ex-bolsista volta com o mesmo CPF (agora como agente)
  await p.evaluate(() => MQ.ui.fecharPainel()); await abrirManual('[data-acao=novo][data-papel=agente][data-uf=PI]');
  await preencher({ nome: rita.nome.replace(' (exemplo)', ''), cpf: rita.cpf, email: rita.email, arlo: true }); await salvar();
  ok('Pessoa desligada pode voltar com o mesmo CPF e e-mail', !!(await equipe()).find(m => m.cpf === rita.cpf && m.status === 'ativa'), await erroTxt());

  // link + aprovação
  await p.evaluate(() => MQ.ui.fecharPainel());
  const tk = await p.evaluate(() => MQ.convitesUI.gerarLink({ papel: 'agente', uf: 'AL' }));
  const tk2 = await p.evaluate(() => MQ.convitesUI.gerarLink({ papel: 'articulacao', uf: 'SE' }));
  const pub = await ctx.newPage();
  const preenchePub = async (token, d) => {
    await pub.goto('http://localhost:8766/#convite=' + token); await pub.waitForSelector('form[data-form=conv-enviar]');
    await pub.fill('#cv-nome', d.nome); await pub.fill('#cv-cpf', d.cpf); await pub.fill('#cv-tel', '(82) 99777-1234'); await pub.fill('#cv-email', d.email);
    await pub.click('#w-cadastro_arlo label:has-text("Não")');
    for (const k of Object.keys(pf)) await pub.click(`#w-pf_${k} label:has-text("${pf[k] ? 'Sim' : 'Não'}")`);
    await pub.selectOption('#pf-exp', '3a5'); await pub.fill('#dp-nasc', '1982-12-01'); await pub.fill('#dp-cid', 'Arapiraca'); await pub.selectOption('#dp-uf', 'AL'); await pub.fill('#dp-bai', 'Sítio Pau Ferro');
    await pub.check('[name=consentimento_lgpd]'); await pub.click('form[data-form=conv-enviar] button[type=submit]'); await pub.waitForTimeout(500);
    return !!(await pub.$('.conv-fim'));
  };
  const cpfL = cpf();
  ok('Agente preenche o link', await preenchePub(tk, { nome: 'Luana Link Alagoas', cpf: cpfL, email: 'luana@gmail.com' }));
  ok('Articulação SE preenche o link', await preenchePub(tk2, { nome: 'Sara Link Sergipe', cpf: cpf(), email: 'sara@gmail.com' }));
  await pub.close();
  await p.reload(); await p.waitForSelector('.dx-topo, .eq-kpis, .resumo'); await p.evaluate(() => MQ.ui.fecharPainel && MQ.ui.fecharPainel()); await aba('equipe'); await p.waitForTimeout(300);
  ok('Coord. técnica vê "Cadastros enviados pelo link" (2)', /Cadastros enviados pelo link\s*2/.test(await p.textContent('#t-pre').catch(() => '')), await p.textContent('#t-pre').catch(() => 'sem seção'));
  await p.click('.pre-linha:has-text("Luana")'); await p.waitForTimeout(250);
  const dl = await p.textContent('.painel-corpo .dl');
  ok('Conferência mostra perfil no campo, endereço e nascimento', /Agricultora/.test(dl) && /Arapiraca/.test(dl) && /01\/12\/1982/.test(dl), dl.slice(0, 200));
  await p.click('[data-acao=conv-aprovar]'); await p.waitForTimeout(400);
  ok('"Conferir e cadastrar" traz os dados preenchidos', (await p.inputValue('#c-nome')) === 'Luana Link Alagoas' && (await p.inputValue('#dp-nasc')) === '1982-12-01');
  ok('Traz o perfil no campo marcado', (await p.$$eval('.perfil-campo input[type=radio]:checked', l => l.length)) === 5);
  ok('Traz a ciência LGPD marcada (ela aceitou no link)', await p.isChecked('#c-lgpd'));
  await salvar();
  const lu = (await equipe()).find(m => m.cpf === cpfL);
  ok('Aprovada entra na equipe', !!lu, await erroTxt());
  const pvl = lu && await p.evaluate(id => MQ.ui.S.api.lerPrivado(id), lu.id);
  ok('Aprovada: endereço, nascimento e perfil guardados', pvl && pvl.endereco && pvl.endereco.cidade === 'Arapiraca' && pvl.perfil && pvl.perfil.experiencia === '3a5', JSON.stringify(pvl));
  ok('Some da lista de cadastros enviados', !(await p.evaluate(() => (MQ.ui.S.pre || []).some(x => x.nome === 'Luana Link Alagoas'))));
  // recusar
  await p.evaluate(() => MQ.ui.fecharPainel()); await aba('equipe');
  await p.click('.pre-linha:has-text("Sara")'); await p.waitForTimeout(250);
  await p.click('form[data-form=conv-recusar] button[type=submit]'); await p.waitForTimeout(250);
  ok('Recusar sem motivo não recusa', /motivo/i.test(await p.textContent('form[data-form=conv-recusar]')));
  await p.fill('#cr-obs', 'Não é a pessoa indicada pelo MPA.'); await p.click('form[data-form=conv-recusar] button[type=submit]'); await p.waitForTimeout(400);
  ok('Recusar com motivo tira da lista', !(await p.evaluate(() => (MQ.ui.S.pre || []).some(x => x.nome === 'Sara Link Sergipe'))), await toastTxt());

  // ================= COORDENAÇÃO GERAL =================
  await como('coord_geral'); await aba('equipe');
  ok('Coord. geral: coord. técnica ocupada, sem botão de cadastrar outra', !(await vis('[data-acao=novo][data-papel=coord_tecnico]')));
  ok('Coord. geral: auxiliar ocupado, sem botão', !(await vis('[data-acao=novo][data-papel=auxiliar_adm]')));
  // professor pelo FIC
  await aba('equipe');
  ok('Coord. geral vê "Cadastrar professor"', await vis('[data-acao=novo][data-papel=professor_fic]'));
  ok('Abre cadastro de professor', await abrirManual('[data-acao=novo][data-papel=professor_fic]'));
  ok('Professor: sem perfil no campo', !(await p.$('.perfil-campo')));
  ok('Professor: sem previsão de atividades', !(await p.$('#c-md')));
  await preencher({ nome: 'Otávio Professor Novo', cpf: cpf(), email: 'otavio@ifrn.edu.br', arlo: true }); await p.fill('#c-siape', '1234567'); await salvar();
  t = await toastTxt(); const ot = (await equipe()).find(m => m.email === 'otavio@ifrn.edu.br');
  ok('Professor cadastrado com SIAPE', ot && ot.siape === '1234567', await erroTxt());
  ok('Mensagem do professor fala de Arlo e termo (não de FIC)', /Arlo/.test(t) && !/FIC\./.test(t), t);
  // desligar auxiliar e cadastrar outro
  await p.evaluate(() => MQ.ui.fecharPainel()); await aba('equipe');
  const aux = (await equipe()).find(m => m.papel === 'auxiliar_adm' && m.status === 'ativa');
  await p.evaluate(id => MQ.ui.abrirPainel({ tipo: 'detalhe', id }), aux.id); await p.waitForTimeout(250);
  await p.click('[data-acao=desligar-abrir]'); await p.selectOption('#d-motivo', { index: 1 }); await p.fill('#d-det', 'Fim do contrato com a FUNCERN.'); await p.click('form[data-form=desligar] button[type=submit]'); await p.waitForTimeout(500);
  await aba('equipe');
  ok('Auxiliar desligado: aparece botão para cadastrar outro', await vis('[data-acao=novo][data-papel=auxiliar_adm]'));
  await abrirManual('[data-acao=novo][data-papel=auxiliar_adm]');
  await preencher({ nome: 'Paula Auxiliar Nova', cpf: cpf(), email: 'paula.aux@gmail.com', arlo: false, nasc: '1995-01-01' }); await salvar();
  ok('Novo auxiliar cadastrado', !!(await equipe()).find(m => m.email === 'paula.aux@gmail.com' && m.status === 'ativa'), await erroTxt());
  // coord técnica: desligar e cadastrar nova
  await p.evaluate(() => MQ.ui.fecharPainel());
  const ct = (await equipe()).find(m => m.papel === 'coord_tecnico' && m.status === 'ativa');
  await p.evaluate(id => MQ.ui.abrirPainel({ tipo: 'detalhe', id }), ct.id); await p.waitForTimeout(250);
  await p.click('[data-acao=desligar-abrir]'); await p.selectOption('#d-motivo', { index: 1 }); await p.fill('#d-det', 'Indicada pelo MPA para outra função.'); await p.click('form[data-form=desligar] button[type=submit]'); await p.waitForTimeout(500);
  await aba('equipe');
  ok('Coord. técnica desligada: botão para cadastrar nova', await vis('[data-acao=novo][data-papel=coord_tecnico]'));
  await abrirManual('[data-acao=novo][data-papel=coord_tecnico]');
  ok('Coord. técnica: tem perfil no campo', !!(await p.$('.perfil-campo')));
  await preencher({ nome: 'Tereza Coordenação Nova', cpf: cpf(), email: 'tereza@gmail.com', arlo: true, perfil: pf, exp: 'mais5' }); await salvar();
  ok('Nova coord. técnica cadastrada', !!(await equipe()).find(m => m.email === 'tereza@gmail.com'), await erroTxt());
  // falha de internet depois de criar: não pode deixar a coordenação cadastrar de novo
  await p.evaluate(() => { MQ.ui.fecharPainel(); MQ.ui.S.api._sp = MQ.ui.S.api.salvarPrivado; MQ.ui.S.api.salvarPrivado = async () => { throw new Error('Failed to fetch'); }; });
  await aba('equipe'); await abrirManual('[data-acao=novo][data-papel=agente][data-uf=BA]');
  await preencher({ nome: 'Quitéria Rede Fraca', cpf: cpf(), email: 'quiteria@gmail.com', arlo: false, perfil: pf, exp: 'ate2', nasc: '1970-01-01' }); await salvar();
  const tq = await toastTxt();
  ok('Internet cai depois de cadastrar: avisa que a pessoa FOI cadastrada e o que refazer', /foi cadastrada/.test(tq) && /"Editar"/.test(tq), tq);
  ok('...e abre a ficha dela (não o formulário de novo)', !(await p.$('form[data-form=cadastro]')) && /Quitéria/.test(await p.textContent('#painel-t').catch(() => '')));
  await p.evaluate(() => { MQ.ui.S.api.salvarPrivado = MQ.ui.S.api._sp; MQ.ui.fecharPainel(); });
  // histórico
  await p.evaluate(() => MQ.ui.fecharPainel()); await aba('historico');
  const h = await p.textContent('main');
  ok('Histórico registra cadastros e desligamentos', /cadastrou/.test(h) && /desligou/.test(h));
  ok('Sem erro de JavaScript', !errs.length, errs.join(' | '));
  R.forEach((r, i) => console.log(String(i + 1).padStart(2), r[0], '|', r[1], r[0] === 'FALHOU' ? '| ' + r[2] : ''));
  console.log('TOTAL', R.filter(r => r[0] === 'PASSOU').length, 'passou,', R.filter(r => r[0] === 'FALHOU').length, 'falhou');
  await b.close();
})().catch(e => { console.log('ERRO', e.stack.split('\n').slice(0, 3).join(' ')); R.forEach((r, i) => console.log(i + 1, r.join(' | '))); process.exit(1); });
