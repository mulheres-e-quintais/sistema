/* Ambiente isolado para testar os módulos do navegador no Node, sem mudar a arquitetura do sistema.
   Cada chamada cria um "navegador" novo e vazio (vm), com substitutos (stubs) para document, localStorage,
   navigator, location e FormData. Assim um teste nunca herda dados de outro. */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const JS = path.join(__dirname, '..', '..', 'js');

class ArmazenamentoFalso {
  constructor() { this.m = new Map(); }
  getItem(k) { return this.m.has(k) ? this.m.get(k) : null; }
  setItem(k, v) { this.m.set(k, String(v)); }
  removeItem(k) { this.m.delete(k); }
  clear() { this.m.clear(); }
  key(i) { return [...this.m.keys()][i] ?? null; }
  get length() { return this.m.size; }
}

/* FormData de mentira: new FormDataFalso({ nome: 'Ana', pf_x: ['a', 'b'] }) */
class FormDataFalso {
  constructor(obj = {}) { this.o = obj; }
  get(k) { const v = this.o[k]; return v === undefined ? null : Array.isArray(v) ? v[0] : v; }
  getAll(k) { const v = this.o[k]; return v === undefined ? [] : Array.isArray(v) ? v : [v]; }
  has(k) { return k in this.o; }
  forEach(fn) { Object.entries(this.o).forEach(([k, v]) => (Array.isArray(v) ? v : [v]).forEach(x => fn(x, k))); }
}

function elementoFalso() {
  return { style: {}, dataset: {}, innerHTML: '', classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, setAttribute() {}, removeAttribute() {}, appendChild() {},
    insertAdjacentHTML() {}, querySelector: () => null, querySelectorAll: () => [], closest: () => null, addEventListener() {}, focus() {}, remove() { this.removido = true; } };
}

/**
 * Carrega arquivos de js/ num contexto novo e devolve { MQ, janela, ouvintes }.
 * opcoes.ui: objeto que substitui MQ.ui (para módulos que leem o estado da tela).
 */
function carregar(arquivos, opcoes = {}) {
  const ouvintes = {}; const ouvintesJanela = {};
  // #app e #painel guardam o HTML desenhado, para os testes das telas lerem
  const app = elementoFalso(); let painel = null;
  const corpo = Object.assign(elementoFalso(), { appendChild(el) { if (el.id === 'painel') painel = el; }, contains: () => false });
  const acha = sel => sel === '#app' ? app : sel === '#painel' ? (painel && !painel.removido ? painel : null) : null;
  const documento = {
    addEventListener(tipo, fn) { (ouvintes[tipo] = ouvintes[tipo] || []).push(fn); },
    removeEventListener() {}, querySelector: acha, querySelectorAll: () => [], getElementById: id => acha('#' + id),
    createElement: () => elementoFalso(), body: corpo, documentElement: elementoFalso(), title: '', activeElement: null
  };
  const janela = {
    MQ: {}, console, Date, Math, JSON, Promise, Map, Set, Array, Object, String, Number, Boolean, RegExp, Error, Intl, URL,
    setTimeout, clearTimeout, setInterval, clearInterval, encodeURIComponent, decodeURIComponent, parseInt, parseFloat, isNaN,
    localStorage: new ArmazenamentoFalso(), sessionStorage: new ArmazenamentoFalso(),
    navigator: { onLine: true, userAgent: 'node-teste' }, location: { origin: 'https://exemplo.test', pathname: '/sistema/', hash: '', host: 'exemplo.test' },
    document: documento, FormData: FormDataFalso, crypto: globalThis.crypto, fetch: async () => { throw new Error('Failed to fetch'); },
    addEventListener(tipo, fn) { (ouvintesJanela[tipo] = ouvintesJanela[tipo] || []).push(fn); }, removeEventListener() {}, matchMedia: () => ({ matches: false, addEventListener() {} }),
    Event: class { constructor(t) { this.type = t; } }, indexedDB: undefined,
    MutationObserver: class { observe() {} disconnect() {} }, requestAnimationFrame: fn => setTimeout(fn, 0), scrollTo() {}, scrollY: 0, innerWidth: 390
  };
  janela.window = janela; janela.self = janela; janela.globalThis = janela;
  if (opcoes.ui) janela.MQ.ui = opcoes.ui;
  const ctx = vm.createContext(janela);
  for (const a of arquivos) {
    const arq = path.join(JS, a);
    new vm.Script(fs.readFileSync(arq, 'utf8'), { filename: arq }).runInContext(ctx);
  }
  if (opcoes.ui) janela.MQ.ui = Object.assign(janela.MQ.ui || {}, opcoes.ui);
  return { MQ: janela.MQ, janela, ouvintes, ouvintesJanela, app: () => app.innerHTML, painel: () => (painel && !painel.removido ? painel.innerHTML : '') };
}

/* data relativa a hoje, no formato AAAA-MM-DD (fuso local) */
function diaMais(n) {
  const d = new Date(Date.now() - new Date().getTimezoneOffset() * 6e4 + n * 864e5);
  return d.toISOString().slice(0, 10);
}
/* gera CPF válido a partir de 9 dígitos */
function cpfValido(base9) {
  const n = String(base9).padStart(9, '0').split('').map(Number);
  const dv = a => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * (a.length + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
  n.push(dv(n)); n.push(dv(n)); return n.join('');
}
/* objetos criados dentro do vm têm outro Object.prototype: normaliza para comparar com deepStrictEqual */
const simples = o => JSON.parse(JSON.stringify(o));

module.exports = { carregar, FormDataFalso, diaMais, cpfValido, simples };
