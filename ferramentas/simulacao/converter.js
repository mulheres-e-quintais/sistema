/* Mulheres & Quintais — converte as tabelas exportadas do banco (depois do 95_simulacao_completa.sql) para o formato
   da demonstração e grava js/simulacao-dados.js, lido só pela página simulacao.html. Uso: chamado pelo gerar.sh.
   Tudo é inventado: nomes, CPFs (gerados), e-mails @exemplo.invalid. A coordenação geral ganha telefone e e-mail fictícios. */
const fs = require('fs'); const path = require('path');
const dir = process.argv[2]; const raiz = path.join(__dirname, '..', '..');
const T = n => JSON.parse(fs.readFileSync(path.join(dir, n + '.json'), 'utf8') || '[]') || [];
// carimbos de data e hora no mesmo formato da demonstração (ISO em UTC): a ordenação por texto continua certa
const ISO = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?([+-]\d\d:\d\d|Z)$/;
const norm = v => { if (Array.isArray(v)) return v.map(norm);
  if (v && typeof v === 'object') { const o = {}; for (const k of Object.keys(v)) o[k] = norm(v[k]); return o; }
  return typeof v === 'string' && ISO.test(v) ? new Date(v).toISOString() : v; };
const cpf = seed => { const n = String(seed).padStart(9, '0').slice(-9).split('').map(Number);
  const dv = a => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * (a.length + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
  n.push(dv(n)); n.push(dv(n)); return n.join(''); };

const equipe = norm(T('equipe'));
const cg = equipe.find(m => m.papel === 'coord_geral');
Object.assign(cg, { nome: 'Cleone Lima', cpf: cpf(123456781), email: 'coordenacao.geral@exemplo.invalid', telefone: '(84) 90000-0001', siape: null });
equipe.forEach(m => { m.exemplo = m.id !== cg.id; });
const ativo = (papel, uf) => equipe.find(m => m.papel === papel && m.status === 'ativa' && (!uf || m.uf === uf));
const privado = {}; norm(T('equipe_privado')).forEach(p => { if (p.equipe_id !== cg.id) privado[p.equipe_id] = p; });
const solicVis = {}; T('solicitacao_visitas').forEach(x => { solicVis[x.visita_id] = x.solicitacao_id; });
const parametros = {}; norm(T('parametros')).forEach(p => { parametros[p.chave] = p.valor; });
const marca = l => l.map(x => Object.assign(x, { exemplo: true }));
const fichas = marca(norm(T('fichas'))), diagnosticos = marca(norm(T('diagnosticos')));
// fim do projeto: nenhuma ficha parada sem decisão (no 95 algumas ficam aguardando ou devolvidas, para mostrar a fila).
// Aqui elas foram decididas e entram no fim da lista de espera.
{ let pos = Math.max(0, ...fichas.map(f => +f.posicao_espera || 0));
  const tec = (equipe.find(m => m.papel === 'coord_tecnico' && m.status === 'ativa') || cg).id;
  fichas.filter(f => f.situacao !== 'aprovada').forEach(f => Object.assign(f, { situacao: 'aprovada', resultado: 'lista_espera', posicao_espera: ++pos,
    aprovada_por: tec, aprovada_em: '2027-01-20T13:00:00.000Z', obs_coordenacao: null, atualizado_em: '2027-01-20T13:00:00.000Z' })); }
// passagem ou evento cuja data já passou não fica esperando decisão no último dia: foi autorizado pelo valor estimado
const pedidos = norm(T('pedidos_apoio'));
pedidos.filter(x => ['enviado', 'conferido'].includes(x.situacao) && x.data_ref < '2027-09-30').forEach(x => Object.assign(x, { situacao: 'autorizado',
  valor_autorizado: +((x.dados || {}).valor_estimado) || 0, conferido_por: cg.id, conferido_em: '2027-07-10T13:00:00.000Z', decidido_por: cg.id, decidido_em: '2027-07-10T14:00:00.000Z' }));
const obs = norm(T('observadores')).map(o => { const r = Object.assign({}, o, { tem_senha: !!o.user_id || o.status === 'ativo' }); delete r.codigo_hash; delete r.codigo_expira; return r; });

// pagamentos: no último dia só setembro fica no caminho (pedido e aval); agosto e antes já foram lançados no Arlo
const solicitacoes = norm(T('solicitacoes_pagamento'));
{ const aux = (ativo('auxiliar_adm') || cg).id; let k = 900;
  solicitacoes.filter(x => x.situacao === 'avalizada' && String(x.mes) < '2027-09').forEach(x => Object.assign(x, { situacao: 'lancada', arlo_por: aux,
    arlo_em: new Date(new Date(x.aval_em).getTime() + 4 * 864e5).toISOString(), arlo_protocolo: 'ARLO-' + String(x.mes).slice(0, 7).replace('-', '') + '-' + (++k) })); }
// planilha de gastos mês a mês, como a da FUNCERN (no 95 cada item vem numa linha só, em setembro, e o gráfico "Ritmo do gasto"
// mostrava tudo gasto no fim): bolsas e despesas fixas todo mês; ajuda de custo, combustível, diárias e veículo no ritmo das
// visitas; kits na implantação (jan a mai/2027); passagens e eventos no mês de cada autorização.
const execPlanilhas = norm(T('execucao_planilhas'));
{ const visitas = norm(T('visitas')); const MESES = []; for (let a = 2026, m = 10; a < 2027 || m <= 9; m === 12 ? (a++, m = 1) : m++) MESES.push(a + '-' + String(m).padStart(2, '0'));
  const porMesVis = MESES.map(k => visitas.filter(v => v.situacao === 'realizada' && String(v.data_realizada).slice(0, 7) === k).length);
  const pesos = item => {
    if (/^(ajuda_|combustivel|diarias|locacao_veiculo)/.test(item)) return porMesVis;
    if (/^(quintais|kit|material|maquinas|equipamentos)/.test(item)) return MESES.map(k => k >= '2027-01' && k <= '2027-05' ? 1 : 0);
    if (/^(passagem|evento)/.test(item)) { const ped = pedidos.filter(x => x.situacao === 'autorizado' && (item.startsWith('evento') ? x.tipo === 'evento' : x.tipo === 'passagem'));
      const w = MESES.map(k => ped.filter(x => String(x.decidido_em).slice(0, 7) === k).length); if (w.some(Boolean)) return w; }
    return MESES.map(() => 1); };
  const ABR = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  execPlanilhas.forEach(pl => { let n = 1; const novas = [];
    pl.linhas.forEach(l => {
      if (l.item === 'repasse_mda' || !(+l.valor)) { novas.push(Object.assign({}, l, { linha: ++n })); return; }
      const w = pesos(l.item); const soma = w.reduce((t, x) => t + x, 0); let resto = Math.round(l.valor * 100);
      const partes = MESES.map((k, i) => ({ k, c: Math.floor(Math.round(l.valor * 100) * w[i] / soma) })).filter(x => x.c > 0);
      resto -= partes.reduce((t, x) => t + x.c, 0); if (partes.length) partes[partes.length - 1].c += resto;
      partes.forEach(x => { const [a, m] = x.k.split('-'); const dia = x.k === '2027-09' ? '25' : '20';
        const rot = (l.descricao || l.texto) + ' – ' + ABR[+m - 1] + '/' + a.slice(2);
        novas.push(Object.assign({}, l, { linha: ++n, data: x.k + '-' + dia, valor: x.c / 100, texto: rot, descricao: rot })); }); });
    pl.linhas = novas; });
}
const d = {
  cenario: 'fim', perfil: 'coord_geral',
  eu: { coord_geral: cg.id, coord_tecnico: (ativo('coord_tecnico') || {}).id, bolsista: (ativo('articulacao', 'PI') || ativo('articulacao') || {}).id,
    agente: (ativo('agente', 'PI') || ativo('agente') || {}).id, professor: (ativo('professor_fic') || {}).id, auxiliar: (ativo('auxiliar_adm') || {}).id },
  equipe, privado, fichas, diagnosticos,
  visitas: norm(T('visitas')), avaliacoes: norm(T('avaliacoes')), custos: norm(T('custos_visita')),
  solicitacoes, solic_visitas: solicVis, entregas: norm(T('entregas_mes')),
  turmas: norm(T('turmas_fic')), matriculas: norm(T('matriculas_fic')), ficEncontros: norm(T('fic_encontros')), ficPresencas: norm(T('fic_presencas')),
  pedidos, documentos: norm(T('documentos_projeto')), execPlanilhas,
  aguaSituacoes: norm(T('agua_situacoes')), canaisVenda: norm(T('canais_venda')), orientacoesVenda: norm(T('orientacoes_venda')),
  observadores: obs, relatos: norm(T('relatos_problema')), convites: norm(T('convites')), pre_cadastros: norm(T('pre_cadastros')),
  vitrine: norm(T('vitrine_fotos')), acessos: norm(T('acessos')), ciencias: norm(T('ciencias')), apl: norm(T('apl_municipios')),
  kitItens: norm(T('kit_itens')), parametros, auditoria: norm(T('auditoria')),
  filaCelular: {}, pedidosAcesso: [], testes: [],
  fic: true, aux: true   // já vêm do banco: a demonstração não acrescenta os exemplos dela
};
const falta = Object.entries(d.eu).filter(([, v]) => !v).map(([k]) => k);
if (falta.length) { console.error('Perfis sem pessoa na simulação:', falta.join(', ')); process.exit(1); }
const js = '/* GERADO por ferramentas/simulacao/gerar.sh a partir do supabase/95_simulacao_completa.sql: não edite aqui.\n'
  + '   Só a página simulacao.html lê este arquivo. Tudo inventado (nomes, CPFs, e-mails @exemplo.invalid). */\n'
  + 'window.MQ = window.MQ || {};\nMQ.SIM_FIM = ' + JSON.stringify(d) + ';\n';
fs.writeFileSync(path.join(raiz, 'js', 'simulacao-dados.js'), js);
console.log('js/simulacao-dados.js:', Math.round(js.length / 1024), 'KB ·', fichas.length, 'fichas ·', d.visitas.length, 'visitas ·', equipe.length, 'pessoas');
