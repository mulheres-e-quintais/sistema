const { chromium } = require(process.argv[2]);
const R = []; const ok = (n, c, d='') => R.push([c ? 'PASSOU' : 'FALHOU', n, d]);
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true, locale: 'pt-BR' });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await ctx.route('**/js/config.js', r => r.fulfill({ contentType: 'text/javascript', body: "window.MQ=window.MQ||{};MQ.CONFIG={supabaseUrl:'',supabaseAnonKey:'',semServiceWorker:true};" }));
  await ctx.route('**/cdn.jsdelivr.net/**', r => r.abort()); await ctx.route('**/fonts.g*/**', r => r.abort());
  await ctx.route('**/viacep.com.br/**', r => { const cep = r.request().url().match(/ws\/(\d+)/)[1];
    if (cep === '64600000') return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ cep: '64600-000', logradouro: '', bairro: '', localidade: 'Picos', uf: 'PI' }) });
    if (cep === '64600001') return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ erro: true }) });
    return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ cep, logradouro: 'Rua das Flores', bairro: 'Centro', localidade: 'Picos', uf: 'PI' }) }); });
  await p.goto('http://localhost:8766/'); await p.evaluate(() => { localStorage.clear(); sessionStorage.clear(); }); await p.reload(); await p.waitForSelector('.resumo');
  await p.click('button[data-p=coord_tecnico]'); await p.waitForTimeout(400); await p.evaluate(() => MQ.ui.fecharPainel && MQ.ui.fecharPainel());
  const tk = await p.evaluate(() => MQ.convitesUI.gerarLink({ papel: 'agente', uf: 'PI' }));
  const tkApoio = await p.evaluate(() => MQ.convitesUI.gerarLink({ papel: 'apoio', uf: 'BA' }));
  await p.evaluate(() => { location.hash = ''; });
  const abrir = async t => { await p.goto('http://localhost:8766/#convite=' + t); await p.waitForSelector('form[data-form=conv-enviar]', { timeout: 5000 }); await p.waitForTimeout(200); };
  await abrir(tk);
  ok('Link abre o formulário no celular', true);
  const txt = await p.textContent('.conv-boas'); ok('Mostra a função certa (Agente de campo · Piauí)', /Agente de campo/i.test(txt) && /Piau/.test(txt), txt.slice(0, 120));
  const larg = await p.evaluate(() => document.documentElement.scrollWidth); ok('Sem rolagem para os lados (360 px)', larg <= 360, 'largura ' + larg);
  // campos pequenos demais para o dedo
  const peq = await p.evaluate(() => [...document.querySelectorAll('form input:not([type=hidden]):not([type=checkbox]):not([type=radio]), form select, form button, form .sn')].filter(e => e.offsetParent && e.getBoundingClientRect().height < 40).map(e => (e.name || e.id || e.className || e.textContent).toString().slice(0, 30)));
  ok('Campos e botões com altura boa para o dedo (>= 40px)', !peq.length, peq.join(', '));
  const fs = await p.evaluate(() => [...document.querySelectorAll('form input:not([type=checkbox]):not([type=radio]), form select')].filter(e => e.offsetParent && parseFloat(getComputedStyle(e).fontSize) < 16).map(e => e.name));
  ok('Campos com letra >= 16px (iPhone não dá zoom sozinho)', !fs.length, fs.join(', '));
  // 1. envio vazio
  await p.click('form[data-form=conv-enviar] button[type=submit]'); await p.waitForTimeout(300);
  const errosVazio = await p.$$eval('.tem-erro', l => l.length);
  const box = await p.textContent('[data-erro]');
  ok('Enviar vazio: marca os campos com erro', errosVazio >= 5, errosVazio + ' marcados; ' + box);
  const foco = await p.evaluate(() => document.activeElement && document.activeElement.name);
  ok('Enviar vazio: leva o cursor ao primeiro erro (nome)', foco === 'nome', 'foco em ' + foco);
  const telErro = await p.$eval('#cv-tel', e => !!e.closest('.tem-erro'));
  ok('Celular é obrigatório no link (é por WhatsApp que chega o código)', telErro);
  // 2. máscaras
  await p.fill('#cv-cpf', ''); await p.type('#cv-cpf', '47602436075'); ok('CPF ganha pontos e traço ao digitar', (await p.inputValue('#cv-cpf')) === '476.024.360-75', await p.inputValue('#cv-cpf'));
  await p.fill('#cv-tel', ''); await p.type('#cv-tel', '89999112233'); ok('Celular ganha máscara', (await p.inputValue('#cv-tel')) === '(89) 99911-2233', await p.inputValue('#cv-tel'));
  await p.fill('#cv-cpf', ''); await p.type('#cv-cpf', '12345678900'); await p.click('#cv-email'); await p.waitForTimeout(150);
  ok('CPF errado avisa ao sair do campo', !!(await p.$('#cv-cpf ~ .dica-email')), await p.$eval('#cv-cpf', e => e.parentElement.textContent).catch(() => ''));
  await p.fill('#cv-cpf', ''); await p.type('#cv-cpf', '476.024.360-75');
  await p.type('#cv-email', ' Luzia@Gmail.com'); ok('E-mail fica minúsculo e sem espaço', (await p.inputValue('#cv-email')) === 'luzia@gmail.com', await p.inputValue('#cv-email'));
  await p.fill('#cv-email', ''); await p.type('#cv-email', 'luzia@gmial.com'); await p.click('#cv-nome'); await p.waitForTimeout(150);
  const sug = await p.$eval('#cv-email', e => e.parentElement.textContent);
  ok('E-mail com erro de digitação comum (gmial) sugere gmail.com', /gmail\.com/.test(sug) && /quis dizer|Confira/i.test(sug), sug.slice(-90));
  if (await p.$('.sug-email')) { await p.click('.sug-email'); ok('Botão "Usar gmail.com" corrige o e-mail', (await p.inputValue('#cv-email')) === 'luzia@gmail.com', await p.inputValue('#cv-email')); }
  await p.fill('#cv-email', ''); await p.type('#cv-email', 'luzia@gmail.con'); await p.click('#cv-nome'); await p.waitForTimeout(150);
  ok('E-mail terminando em .con sugere .com', /gmail\.com/.test(await p.$eval('#cv-email', e => e.parentElement.textContent)));
  await p.fill('#cv-email', ''); await p.type('#cv-email', 'luzia@gmail'); await p.click('#cv-nome'); await p.waitForTimeout(150);
  ok('E-mail sem ".com" avisa', /incompleto/i.test(await p.$eval('#cv-email', e => e.parentElement.textContent)));
  await p.fill('#cv-email', ''); await p.type('#cv-email', 'luzia@gmail.com');
  // nome de uma palavra
  await p.fill('#cv-nome', 'Luzia'); await p.click('form[data-form=conv-enviar] button[type=submit]'); await p.waitForTimeout(200);
  ok('Nome com uma palavra só: pede nome completo', /completo/i.test(await p.$eval('#cv-nome', e => e.closest('.campo').textContent)));
  await p.fill('#cv-nome', '  Luzia   Rural  Silva ');
  // arlo não respondido
  ok('Arlo sem resposta: marca a pergunta', !!(await p.$('#w-cadastro_arlo.tem-erro')));
  ok('Perfil no campo sem resposta: marca as 5 perguntas', (await p.$$eval('.perfil-campo .criterio.tem-erro', l => l.length)) === 5);
  // responde Arlo = Não, perfil
  await p.click('#w-cadastro_arlo label:has-text("Não")');
  for (const k of ['agricultora', 'atua_mulheres', 'mora_rural', 'internet', 'outra_bolsa']) await p.click(`#w-pf_${k} label:has-text("${k === 'outra_bolsa' ? 'Não' : 'Sim'}")`);
  ok('Tocar no "Sim" marca a opção (visual)', (await p.$$eval('.perfil-campo .sn.on', l => l.length)) === 5);
  await p.selectOption('#pf-exp', 'mais5');
  // nascimento: menor de 16 e futuro
  const hoje = new Date(); const menor = (hoje.getFullYear() - 10) + '-01-01';
  await p.fill('#dp-nasc', menor); await p.click('form[data-form=conv-enviar] button[type=submit]'); await p.waitForTimeout(200);
  ok('Nascimento de criança (10 anos) recusado', /inválida/i.test(await p.$eval('#dp-nasc', e => e.closest('.campo').textContent)));
  await p.fill('#dp-nasc', '1985-03-10');
  // NIS curto
  await p.fill('#dp-nis', '1234'); await p.click('form[data-form=conv-enviar] button[type=submit]'); await p.waitForTimeout(200);
  ok('NIS com poucos números recusado', /11 números/.test(await p.$eval('#dp-nis', e => e.closest('.campo').textContent)));
  await p.fill('#dp-nis', '');
  // CEP
  await p.fill('#dp-cep', ''); await p.type('#dp-cep', '64600100'); await p.waitForTimeout(500);
  ok('CEP de rua preenche rua, bairro e cidade', (await p.inputValue('#dp-log')) === 'Rua das Flores' && (await p.inputValue('#dp-cid')) === 'Picos' && (await p.inputValue('#dp-uf')) === 'PI');
  ok('CEP de rua leva o cursor para o Número', await p.evaluate(() => document.activeElement.name) === 'numero');
  await p.fill('#dp-log', ''); await p.fill('#dp-bai', ''); await p.fill('#dp-cid', '');
  await p.fill('#dp-cep', ''); await p.type('#dp-cep', '64600000'); await p.waitForTimeout(500);
  ok('CEP da cidade toda: preenche cidade e avisa para digitar a rua', (await p.inputValue('#dp-cid')) === 'Picos' && /cidade toda/.test(await p.textContent('#dp-cep-dica')));
  await p.fill('#dp-cep', ''); await p.type('#dp-cep', '64600001'); await p.waitForTimeout(500);
  ok('CEP que não existe avisa', /não encontrado/.test(await p.textContent('#dp-cep-dica')));
  await p.fill('#dp-cep', '646'); await p.click('form[data-form=conv-enviar] button[type=submit]'); await p.waitForTimeout(200);
  ok('CEP incompleto recusado', /8 números/.test(await p.$eval('#dp-cep', e => e.closest('.campo').textContent)));
  await p.fill('#dp-cep', ''); await p.fill('#dp-cid', 'Picos'); await p.fill('#dp-log', 'Sítio Baixa Verde');
  // socioeconômico incompleto
  await p.check('[name=tem_socio]'); await p.click('form[data-form=conv-enviar] button[type=submit]'); await p.waitForTimeout(200);
  ok('Socioeconômico marcado e vazio: pede raça, renda e pessoas', (await p.$$eval('[data-socio-campos] .tem-erro', l => l.length)) === 3);
  await p.selectOption('#dp-raca', 'Parda'); await p.fill('#dp-renda', '0'); await p.fill('#dp-pess', '4');
  // sem autorização LGPD
  await p.click('form[data-form=conv-enviar] button[type=submit]'); await p.waitForTimeout(200);
  ok('Sem autorizar os dados: não envia e marca a caixa', !!(await p.$('.check.tem-erro')) && !(await p.$('.conv-fim')));
  // rascunho: recarregar no meio não perde o que digitou
  await p.reload(); await p.waitForSelector('form[data-form=conv-enviar]'); await p.waitForTimeout(300);
  const nomeDepois = await p.inputValue('#cv-nome');
  ok('Recarregar a página no meio NÃO apaga o que já digitou', /Luzia/.test(nomeDepois), 'nome após recarregar: "' + nomeDepois + '"');
  if (!/Luzia/.test(nomeDepois)) {   // refaz para seguir
    await p.fill('#cv-nome', 'Luzia Rural Silva'); await p.fill('#cv-cpf', '476.024.360-75'); await p.fill('#cv-tel', '(89) 99911-2233'); await p.fill('#cv-email', 'luzia@gmail.com');
    await p.click('#w-cadastro_arlo label:has-text("Não")');
    for (const k of ['agricultora', 'atua_mulheres', 'mora_rural', 'internet', 'outra_bolsa']) await p.click(`#w-pf_${k} label:has-text("${k === 'outra_bolsa' ? 'Não' : 'Sim'}")`);
    await p.selectOption('#pf-exp', 'mais5'); await p.fill('#dp-nasc', '1985-03-10'); await p.fill('#dp-cid', 'Picos');
  }
  // falha de internet no envio
  await p.evaluate(() => { MQ.ui.S.api._env = MQ.ui.S.api.enviarPreCadastro; MQ.ui.S.api.enviarPreCadastro = async () => { throw new Error('Failed to fetch'); }; });
  await p.check('[name=consentimento_lgpd]'); await p.click('form[data-form=conv-enviar] button[type=submit]'); await p.waitForTimeout(400);
  const msgNet = (await p.textContent('[data-erro]')) || (await p.textContent('#toast').catch(() => ''));
  ok('Sem internet ao enviar: mensagem clara e dados continuam na tela', /internet|conex/i.test(msgNet) && (await p.inputValue('#cv-nome')).length > 5, msgNet);
  ok('Botão volta a funcionar depois da falha', await p.$eval('form[data-form=conv-enviar] button[type=submit]', b => !b.disabled && /Enviar/.test(b.textContent)));
  await p.evaluate(() => { MQ.ui.S.api.enviarPreCadastro = MQ.ui.S.api._env; });
  // envio certo
  await p.click('form[data-form=conv-enviar] button[type=submit]'); await p.waitForTimeout(600);
  ok('Envio certo: tela "Pronto, recebemos"', !!(await p.$('.conv-fim')), await p.textContent('#convite').then(t => t.slice(0, 80)));
  const fimTxt = await p.textContent('#convite');
  ok('Tela final mostra o e-mail informado (para ela conferir)', /luzia@gmail\.com/.test(fimTxt));
  const pre = await p.evaluate(() => JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k => /demo|mq/.test(k) && /pre_cadastros/.test(localStorage.getItem(k)))) || '{}').pre_cadastros);
  const x = (pre || [])[0] || {};
  ok('Guardou nome sem espaços extras', x.nome === 'Luzia Rural Silva', x.nome);
  ok('Guardou CPF só com números', x.cpf === '47602436075', x.cpf);
  ok('Guardou perfil no campo', x.perfil && x.perfil.experiencia === 'mais5' && x.perfil.agricultora === true, JSON.stringify(x.perfil));
  ok('Guardou telefone', !!x.telefone, x.telefone);
  ok('Guardou endereço (cidade)', x.endereco && x.endereco.cidade === 'Picos', JSON.stringify(x.endereco));
  ok('Rascunho apagado depois de enviar', !(await p.evaluate(() => Object.keys(localStorage).some(k => /rascunho|conv-/.test(k)))));
  // reabrir o mesmo link
  await p.goto('http://localhost:8766/#convite=x'); await p.goto('http://localhost:8766/#convite=' + tk); await p.waitForTimeout(600);
  ok('Mesmo link de novo: "Link sem validade"', /já foi usado/.test(await p.textContent('#convite')));
  await p.goto('http://localhost:8766/#convite=naoexiste123'); await p.waitForTimeout(600);
  ok('Link cortado/errado: explica', /não encontrado/i.test(await p.textContent('#convite')));
  // apoio com Arlo = Sim: só dados básicos + cidade
  await abrir(tkApoio);
  await p.fill('#cv-nome', 'Joana Bahia Souza'); await p.fill('#cv-cpf', '39053344705'); await p.fill('#cv-tel', '71988887777'); await p.fill('#cv-email', 'joana@gmail.com');
  await p.click('#w-cadastro_arlo label:has-text("Sim")'); await p.waitForTimeout(100);
  ok('Arlo = Sim esconde nascimento, NIS e CEP', !(await p.isVisible('#dp-nasc')) && !(await p.isVisible('#dp-cep')));
  ok('Arlo = Sim mantém a cidade visível (bolsista vai a campo)', await p.isVisible('#dp-cid'));
  for (const k of ['agricultora', 'atua_mulheres', 'mora_rural', 'internet', 'outra_bolsa']) await p.click(`#w-pf_${k} label:has-text("Sim")`);
  await p.selectOption('#pf-exp', 'ate2'); await p.check('[name=consentimento_lgpd]');
  await p.click('form[data-form=conv-enviar] button[type=submit]'); await p.waitForTimeout(300);
  ok('Arlo = Sim sem cidade: pede o município', /munic[ií]pio onde mora \(usado|cidade onde mora/i.test(await p.$eval('#dp-cid', e => e.closest('.campo').textContent)));
  await p.fill('#dp-cid', 'Juazeiro'); await p.click('form[data-form=conv-enviar] button[type=submit]'); await p.waitForTimeout(500);
  ok('Arlo = Sim envia com dados básicos', !!(await p.$('.conv-fim')));
  await p.screenshot({ path: '/tmp/claude-0/pw/cad/link-fim.png', fullPage: true });
  ok('Sem erro de JavaScript', !errs.length, errs.join(' | '));
  R.forEach((r, i) => console.log(String(i + 1).padStart(2), r[0], '|', r[1], r[0] === 'FALHOU' || process.env.V ? '| ' + r[2] : ''));
  console.log('TOTAL', R.filter(r => r[0] === 'PASSOU').length, 'passou,', R.filter(r => r[0] === 'FALHOU').length, 'falhou');
  await b.close();
})().catch(e => { console.log('ERRO', e.message); R.forEach(r => console.log(r.join(' | '))); process.exit(1); });
