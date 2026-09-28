/* Mulheres & Quintais — máscaras de digitação: CPF, celular e e-mail (valem em todos os formulários) */
(function () {
  const dig = v => String(v || '').replace(/\D/g, '');
  const fmtCPF = d => { d = d.slice(0, 11);
    return d.length > 9 ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}` : d.length > 6 ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
      : d.length > 3 ? `${d.slice(0, 3)}.${d.slice(3)}` : d; };
  const fmtTel = d => { d = d.slice(0, 11); if (!d) return '';
    if (d.length <= 2) return `(${d}`;
    const meio = d.length === 11 ? 5 : 4; const ddd = d.slice(0, 2), r = d.slice(2);
    return r.length > meio ? `(${ddd}) ${r.slice(0, meio)}-${r.slice(meio)}` : `(${ddd}) ${r}`; };
  const TIPOS = { cpf: { fmt: fmtCPF, max: 14, ph: '000.000.000-00' }, tel: { fmt: fmtTel, max: 15, ph: '(00) 00000-0000' } };
  const tipoDe = el => el.readOnly ? null : el.name === 'cpf' || el.dataset.mascara === 'cpf' ? 'cpf'
    : (el.name === 'telefone' || el.type === 'tel' || el.dataset.mascara === 'tel') ? 'tel' : null;

  // aplica a máscara mantendo o cursor depois do mesmo número de dígitos
  function aplicar(el, t) {
    const pos = el.selectionStart == null ? el.value.length : el.selectionStart;
    const antes = dig(el.value.slice(0, pos)).length;
    const novo = TIPOS[t].fmt(dig(el.value));
    if (novo === el.value) return;
    el.value = novo;
    let n = 0, p = 0; while (p < novo.length && n < antes) { if (/\d/.test(novo[p])) n++; p++; }
    try { el.setSelectionRange(p, p); } catch (e) {}
  }
  document.addEventListener('input', ev => {
    const el = ev.target; if (!el || el.tagName !== 'INPUT') return;
    const t = tipoDe(el);
    if (t) { if (!el.maxLength || el.maxLength < 0) el.maxLength = TIPOS[t].max; aplicar(el, t); return; }
    if (el.type === 'email') {   // e-mail: sem espaços e em minúsculas
      const pos = el.selectionStart; const v = el.value.replace(/\s+/g, '').toLowerCase();
      if (v !== el.value) { el.value = v; try { el.setSelectionRange(pos, pos); } catch (e) {} }
      el.classList.remove('invalido'); const d = el.parentElement.querySelector('.dica-email'); if (d) d.remove();
    }
  });
  // ao sair do campo: confere CPF e e-mail e avisa na hora
  document.addEventListener('focusout', ev => {
    const el = ev.target; if (!el || el.tagName !== 'INPUT' || el.readOnly || !el.value) return;
    let msg = '';
    if (tipoDe(el) === 'cpf' && MQ.regras && !MQ.regras.cpfValido(el.value)) msg = 'CPF inválido: confira os 11 números.';
    if (tipoDe(el) === 'tel' && dig(el.value).length < 10) msg = 'Celular incompleto: DDD e número.';
    if (el.type === 'email' && MQ.regras && !MQ.regras.emailValido(el.value)) msg = 'E-mail incompleto ou com erro (ex.: nome@gmail.com).';
    const velho = el.parentElement.querySelector('.dica-email'); if (velho) velho.remove();
    el.classList.toggle('invalido', !!msg);
    if (msg) el.insertAdjacentHTML('afterend', `<span class="dica dica-email" role="alert">${msg}</span>`);
  });
  document.addEventListener('focusin', ev => {
    const el = ev.target; if (!el || el.tagName !== 'INPUT') return; const t = tipoDe(el);
    if (t && !el.placeholder) el.placeholder = TIPOS[t].ph;
    if (t === 'cpf' || t === 'tel') el.inputMode = t === 'cpf' ? 'numeric' : 'tel';
  });
  MQ.mascaras = { fmtCPF, fmtTel };
})();
