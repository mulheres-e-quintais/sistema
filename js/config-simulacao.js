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
