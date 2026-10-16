// Calendário, seletor de mês e de horário do design system (Flatpickr, em português)
// nas telas do Cliente Oculto. Troca os campos nativos date/month/time sem mudar o valor
// que as telas leem: data "AAAA-MM-DD", mês "AAAA-MM", horário "HH:MM". A pessoa vê
// "14/10/2026", "outubro de 2026" e "09:30". Campos criados depois (formulários
// montados por script) também são trocados.
(function () {
  'use strict';
  if (!window.flatpickr) return;
  if (flatpickr.l10ns && flatpickr.l10ns.pt) flatpickr.localize(flatpickr.l10ns.pt);
  var VALOR = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');

  function opcoes(tipo) {
    var base = { allowInput: true, disableMobile: true, altInput: true };
    if (tipo === 'date') return Object.assign(base, { dateFormat: 'Y-m-d', altFormat: 'd/m/Y' });
    if (tipo === 'month') {
      var plugins = window.monthSelectPlugin ? [new monthSelectPlugin({ shorthand: true, dateFormat: 'Y-m', altFormat: 'F \\d\\e Y' })] : [];
      return Object.assign(base, { dateFormat: 'Y-m', altFormat: 'F \\d\\e Y', plugins: plugins });
    }
    return Object.assign(base, { enableTime: true, noCalendar: true, dateFormat: 'H:i', altFormat: 'H:i', time_24hr: true });
  }

  function aplicar(input) {
    if (input._flatpickr || input.hasAttribute('data-sem-calendario')) return;
    var tipo = input.getAttribute('type');
    input.setAttribute('type', 'text');
    var fp = flatpickr(input, opcoes(tipo));
    if (fp.altInput) {
      fp.altInput.className = input.className + ' ms-data';
      fp.altInput.placeholder = tipo === 'date' ? 'dd/mm/aaaa' : tipo === 'month' ? 'Escolha o mês' : 'hh:mm';
      fp.altInput.disabled = input.disabled;
    }
    // Quando a tela preenche o campo por script (ao abrir uma avaliação), o calendário acompanha.
    var sincronizando = false;
    Object.defineProperty(input, 'value', {
      configurable: true,
      get: function () { return VALOR.get.call(input); },
      set: function (v) {
        VALOR.set.call(input, v);
        if (sincronizando) return;
        sincronizando = true;
        try { if (v) fp.setDate(v, false); else fp.clear(false); } finally { sincronizando = false; }
      }
    });
  }

  function varrer(raiz) {
    raiz.querySelectorAll('input[type="date"], input[type="month"], input[type="time"]').forEach(aplicar);
  }

  function iniciar() {
    varrer(document);
    new MutationObserver(function (mudancas) {
      mudancas.forEach(function (m) {
        m.addedNodes.forEach(function (n) { if (n.nodeType === 1) varrer(n); });
      });
    }).observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
