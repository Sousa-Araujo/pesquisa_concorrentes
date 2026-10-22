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
  function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }

  // Nome resumido de cada etapa no fluxo (o nome completo fica no título).
  var CURTOS = {
    'identificação da visita': 'Identificação',
    'condições': 'Condições',
    'atendimento prévio online': 'Prévia',
    'atendimento da recepção': 'Recepção',
    'atendimento do corretor': 'Corretor',
    'qualidade e estrutura do pdv': 'PDV',
    'materiais de marketing': 'Marketing',
    'capacidade de negociação do corretor': 'Negociação',
    'conhecimento técnico do empreendimento e políticas de venda': 'Conhecimento',
    'jornada comercial': 'Jornada',
    'observações gerais da visita': 'Observações',
    'mapa de gaps': 'Gaps'
  };
  function curto(t) {
    var k = t.toLowerCase().replace(/\s+/g, ' ').trim();
    if (CURTOS[k]) return CURTOS[k];
    var p = t.split(/\s+/);
    return p.length > 2 ? p.slice(0, 2).join(' ') : t;
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
      // .ms-step-fora: seção fora do fluxo nesta avaliação (ex.: só prévia, sem pilares).
      function (p) { return !p.classList.contains('ms-step-fora') && !fixas.some(function (s) { return p.matches(s); }); }
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

    // Fluxo: um segmento por etapa com o nome resumido embaixo (as já
    // alcançadas são clicáveis).
    // No celular os nomes somem da barra e o da etapa atual vai para o título.
    var html = '<div class="ms-steps-head"><b>Etapa ' + (this.atual + 1) + ' de ' + n +
      '<span class="ms-steps-atual"> · ' + esc(titulo(etapas[this.atual])) + '</span></b></div><ol class="ms-steps-flow">';
    etapas.forEach(function (p, i) {
      var estado = i < self.atual ? 'is-done' : i === self.atual ? 'is-current' : (i <= self.vistas ? 'is-seen' : '');
      html += '<li class="' + estado + '"><button type="button" data-etapa="' + i + '"' + (i <= self.vistas ? '' : ' disabled') +
        (i === self.atual ? ' aria-current="step"' : '') + ' title="' + esc(titulo(p)) + '"><i></i><span>' + esc(curto(titulo(p))) + '</span></button></li>';
    });
    html += '</ol>';
    this.barra.innerHTML = html;
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
