/* Mulheres & Quintais — configuração da página simulacao.html (18/10/2026).
   O sistema como fica no FIM do projeto, com dados inventados e SEM banco: nada aqui conversa com o servidor.
   1. Sem endereço do Supabase: o sistema roda no modo demonstração (MQ.apiDemo), que lê MQ.SIM_FIM (js/simulacao-dados.js).
   2. Relógio da página parado no último dia do projeto (30/09/2027) e andando a partir daí: prazos, "atrasada",
      meses de bolsa e cronograma aparecem como no encerramento, e não "no futuro". Só nesta página. */
window.MQ = window.MQ || {};
MQ.CONFIG = { supabaseUrl: '', supabaseAnonKey: '', semServiceWorker: true, cenario: 'fim' };
(function () {
  const Real = Date;
  const desloc = new Real('2027-09-30T09:00:00-03:00').getTime() - Real.now();
  function Simulada(...a) {
    if (!(this instanceof Simulada)) return new Real(Real.now() + desloc).toString();   // Date() sem new devolve texto
    return a.length ? new Real(...a) : new Real(Real.now() + desloc);
  }
  Simulada.prototype = Real.prototype;
  Simulada.now = () => Real.now() + desloc;
  Simulada.parse = Real.parse; Simulada.UTC = Real.UTC;
  window.Date = Simulada;
})();
/* 3. Armazenamento do navegador separado do sistema real (a página fica no mesmo endereço e dividiria o mesmo espaço, de uns 5 MB):
      as chaves da simulação ganham o prefixo "mq-sim:" e a cópia dos dados para uso sem internet (mq-cache-, 1,5 MB por perfil) fica
      só na memória. Assim a simulação não enche o espaço do sistema nem mexe no "último uso" que tira do sistema quem fica parado. */
(function () {
  try {
    const real = window.localStorage, P = 'mq-sim:', mem = new Map(), soMemoria = k => /^mq-cache-/.test(String(k));
    const loja = {
      getItem: k => soMemoria(k) ? (mem.has(k) ? mem.get(k) : null) : real.getItem(P + k),
      setItem: (k, v) => { if (soMemoria(k)) mem.set(k, String(v)); else real.setItem(P + k, String(v)); },
      removeItem: k => { mem.delete(k); real.removeItem(P + k); },
      clear: () => { mem.clear(); Object.keys(real).filter(k => k.indexOf(P) === 0).forEach(k => real.removeItem(k)); },
      key: () => null, get length() { return 0; }
    };
    Object.defineProperty(window, 'localStorage', { value: loja, configurable: true });
  } catch (e) { /* sem armazenamento: o sistema segue só na memória */ }
})();
