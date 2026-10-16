// Fluxo em etapas do design system (componente "Etapas") nas telas de
// preenchimento do Cliente Oculto: registro da visita, calibragem e edição do
// administrador. Uma etapa por vez, com Voltar / Próximo; a barra no topo mostra
// o progresso e permite voltar às etapas já vistas.
// Não muda nada do que as telas salvam: só mostra e esconde as seções.
(function () {
  'use strict';

  // Tela → contêiner do formulário, seções fixas (contexto, sempre visíveis) e
  // botões que só aparecem na última etapa.
  var TELAS = [
    { vista: '#formState', fixas: [], final: '#finalizeBtn' },
    { vista: '#view-calibragem', fixas: ['#calibHeaderPanel'], final: '#concludeBtn' },
    { vista: '#view-edit', fixas: ['#adminHeaderPanel'], final: null }
  ];

  function visivel(el) { return !!el && el.offsetParent !== null; }
  function titulo(panel) {
    var h = panel.querySelector('.panel-head h2');
    if (!h) return 'Etapa';
    var t = h.cloneNode(true);
    var num = t.querySelector('.panel-num');
    if (num) num.remove();
    return t.textContent.trim();
  }

  function Fluxo(cfg, vista) {
    this.cfg = cfg;
    this.vista = vista;
    this.atual = 0;
    this.vistas = 0; // maior etapa já alcançada
    this.assinatura = '';
    this.barra = document.createElement('div');
    this.barra.className = 'ms-steps';
    this.nav = document.createElement('div');
    this.nav.className = 'ms-steps-nav';
    this.nav.innerHTML = '<button type="button" class="ms-btn ms-btn--secondary" data-voltar>Voltar</button>' +
      '<span class="ms-steps-pos"></span>' +
      '<button type="button" class="ms-btn ms-btn--primary" data-proximo>Próximo</button>';
    var self = this;
    this.nav.querySelector('[data-voltar]').addEventListener('click', function () { self.ir(self.atual - 1); });
    this.nav.querySelector('[data-proximo]').addEventListener('click', function () { self.ir(self.atual + 1); });
  }

  Fluxo.prototype.etapas = function () {
    var fixas = this.cfg.fixas;
    return Array.prototype.filter.call(
      this.vista.querySelectorAll(':scope > .panel, :scope > div > .panel'),
      function (p) { return !fixas.some(function (s) { return p.matches(s); }); }
    );
  };

  Fluxo.prototype.ir = function (i) {
    var n = this.etapas().length;
    this.atual = Math.max(0, Math.min(i, n - 1));
    this.vistas = Math.max(this.vistas, this.atual);
    this.aplicar(true);
  };

  Fluxo.prototype.aplicar = function (rolar) {
    var etapas = this.etapas();
    var n = etapas.length;
    if (!n) return;
    if (this.atual > n - 1) this.atual = n - 1;
    var self = this;

    // Barra de progresso com o nome de cada etapa (as já alcançadas são clicáveis).
    var pct = n > 1 ? Math.round((this.atual / (n - 1)) * 100) : 100;
    var html = '<div class="ms-steps-head"><b>Etapa ' + (this.atual + 1) + ' de ' + n + '</b><span></span></div>' +
      '<div class="ms-steps-track"><i style="width:' + pct + '%"></i></div><ol class="ms-steps-list">';
    etapas.forEach(function (p, i) {
      var estado = i < self.atual ? 'is-done' : i === self.atual ? 'is-current' : (i <= self.vistas ? 'is-seen' : '');
      html += '<li class="' + estado + '"><button type="button" data-etapa="' + i + '"' + (i <= self.vistas ? '' : ' disabled') +
        ' title="' + titulo(p).replace(/"/g, '&quot;') + '"><span>' + (i < self.atual ? '✓' : i + 1) + '</span></button></li>';
    });
    html += '</ol>';
    this.barra.innerHTML = html;
    this.barra.querySelector('.ms-steps-head span').textContent = titulo(etapas[this.atual]);
    this.barra.querySelectorAll('[data-etapa]').forEach(function (b) {
      b.addEventListener('click', function () { self.ir(Number(b.getAttribute('data-etapa'))); });
    });

    // Só a etapa atual fica na tela; para mudar algo, volta-se pelo Voltar ou
    // pelos círculos da barra.
    etapas.forEach(function (p, i) {
      p.classList.toggle('ms-step-current', i === self.atual);
      p.classList.toggle('ms-step-hidden', i !== self.atual);
    });

    // Barra antes da primeira etapa; Voltar/Próximo logo depois da etapa atual.
    var primeira = etapas[0];
    if (this.barra.nextElementSibling !== primeira && primeira.parentNode) {
      var antes = primeira.parentNode === this.vista ? primeira : primeira.parentNode;
      if (antes.previousElementSibling !== this.barra) this.vista.insertBefore(this.barra, antes);
    }
    var atual = etapas[this.atual];
    if (atual.nextElementSibling !== this.nav) atual.parentNode.insertBefore(this.nav, atual.nextSibling);
    this.nav.querySelector('[data-voltar]').disabled = this.atual === 0;
    this.nav.querySelector('[data-proximo]').hidden = this.atual === n - 1;
    this.nav.querySelector('.ms-steps-pos').textContent = this.atual === n - 1 ? 'Última etapa' : 'Próxima: ' + titulo(etapas[this.atual + 1]);
    if (this.cfg.final) {
      var fim = document.querySelector(this.cfg.final);
      if (fim) fim.classList.toggle('ms-step-hidden', this.atual !== n - 1);
    }
    this.assinatura = n + ':' + this.atual;
    if (rolar) this.barra.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };

  var fluxos = {};
  function verificar() {
    TELAS.forEach(function (cfg) {
      var vista = document.querySelector(cfg.vista);
      if (!visivel(vista)) return;
      var f = fluxos[cfg.vista] || (fluxos[cfg.vista] = new Fluxo(cfg, vista));
      // As telas redesenham as seções ao salvar; reaplica o estado quando isso acontece.
      var etapas = f.etapas();
      var precisa = !etapas.length ? false :
        f.assinatura !== etapas.length + ':' + f.atual ||
        etapas.some(function (p, i) { return !p.classList.contains(i === f.atual ? 'ms-step-current' : 'ms-step-hidden'); }) ||
        !f.barra.isConnected || !f.nav.isConnected;
      if (precisa) f.aplicar(false);
    });
  }

  function iniciar() {
    verificar();
    setInterval(verificar, 400);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
