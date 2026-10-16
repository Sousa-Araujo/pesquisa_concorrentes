// Menu lateral do design system (trilho + painel) nas telas do Cliente Oculto.
// Mesmo menu das telas em React: os módulos vêm de /api/menu (src/lib/menu.ts).
// O conteúdo original da página vai para dentro de .ms-main, sem mudar nada nele.
(function () {
  'use strict';
  var CHAVE = 'ms-menu-recolhido';

  function css(href) {
    var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; document.head.appendChild(l);
  }
  css('https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700&display=swap');
  css('/design/tokens.css');
  css('/design/ms.css');
  css('/design/legado.css');
  // O design system do sistema usa o tema claro.
  document.documentElement.setAttribute('data-theme', 'light');

  var ICONES = {
    home: '<path d="M4 11l8-7 8 7"/><path d="M6 10v9h12v-9"/>',
    chart: '<path d="M4 20h16"/><rect x="6" y="11" width="3" height="6" rx="1"/><rect x="11" y="7" width="3" height="10" rx="1"/><rect x="16" y="13" width="3" height="4" rx="1"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    doc: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/><path d="M10 13h6M10 17h6"/>',
    users: '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3 3-5 6-5s6 2 6 5"/><circle cx="17" cy="9" r="2.5"/><path d="M16 15c3 0 5 2 5 4"/>',
    collapse: '<path d="M15 6l-6 6 6 6"/>',
    logout: '<path d="M10 4H5v16h5"/><path d="M14 8l4 4-4 4M18 12H9"/>'
  };
  function icone(nome) {
    return '<svg class="ms-icon" viewBox="0 0 24 24" aria-hidden="true">' + (ICONES[nome] || '') + '</svg>';
  }
  function el(tag, attrs, html) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    if (html !== undefined) e.innerHTML = html;
    return e;
  }

  function itemAtual(menu) {
    var caminho = location.pathname, melhor = { tam: -1 };
    menu.modulos.forEach(function (m) {
      m.grupos.forEach(function (g) {
        g.itens.forEach(function (i) {
          if (i.href && caminho === i.href && i.href.length > melhor.tam) melhor = { modulo: m.id, href: i.href, tam: i.href.length };
        });
      });
    });
    return melhor;
  }

  function montar(menu) {
    var atual = itemAtual(menu);
    var aberto = atual.modulo || (menu.modulos[0] && menu.modulos[0].id);
    var recolhido = false;
    try { recolhido = localStorage.getItem(CHAVE) === '1'; } catch (e) { /* sem armazenamento */ }

    var dual = el('div', { 'class': 'ms-dual' + (recolhido ? ' is-collapsed' : '') });
    var rail = el('div', { 'class': 'ms-rail' });
    var painel = el('nav', { 'class': 'ms-panel', id: 'ms-painel' });

    var marca = el('a', { href: '/inicio', 'class': 'ms-brand-mark', title: 'Sousa Araujo · Market Share', style: 'text-decoration:none' }, 'SA');
    rail.appendChild(marca);

    function desenharPainel() {
      var m = menu.modulos.filter(function (x) { return x.id === aberto; })[0];
      painel.innerHTML = '';
      if (!m) return;
      painel.setAttribute('aria-label', m.nome);
      painel.appendChild(el('h4', {}, '')).textContent = m.nome;
      painel.appendChild(el('p', { 'class': 'ms-panel-sub' }, '')).textContent = m.resumo;
      m.grupos.forEach(function (g) {
        painel.appendChild(el('div', { 'class': 'ms-panel-group' }, '')).textContent = g.nome;
        g.itens.forEach(function (i) {
          var a;
          if (i.href) {
            a = el('a', { href: i.href });
            if (i.href === atual.href) a.setAttribute('aria-current', 'page');
          } else {
            a = el('span', { 'class': 'ms-panel-off' });
          }
          a.textContent = i.nome;
          if (i.contador) { var c = el('span', { 'class': 'ms-count' }); c.textContent = i.contador; a.appendChild(c); }
          painel.appendChild(a);
        });
      });
    }

    var links = [];
    menu.modulos.forEach(function (m) {
      var pend = m.grupos.some(function (g) { return g.itens.some(function (i) { return i.contador; }); });
      var a = el('a', { href: '#', title: m.nome }, icone(m.icone) + (pend ? '<span class="ms-dot"></span>' : ''));
      if (m.id === aberto) a.setAttribute('aria-current', 'page');
      a.addEventListener('click', function (e) {
        e.preventDefault();
        aberto = m.id;
        links.forEach(function (x) { x.removeAttribute('aria-current'); });
        a.setAttribute('aria-current', 'page');
        if (dual.classList.contains('is-collapsed')) alternar();
        desenharPainel();
      });
      links.push(a);
      rail.appendChild(a);
    });

    var pe = el('div', { 'class': 'ms-rail-foot' });
    var btRecolher = el('button', { type: 'button', 'aria-controls': 'ms-painel' }, icone('collapse'));
    function alternar() {
      var fechado = dual.classList.toggle('is-collapsed');
      btRecolher.setAttribute('aria-expanded', String(!fechado));
      btRecolher.title = fechado ? 'Expandir menu' : 'Recolher menu';
      try { localStorage.setItem(CHAVE, fechado ? '1' : '0'); } catch (e) { /* sem armazenamento */ }
    }
    btRecolher.setAttribute('aria-expanded', String(!recolhido));
    btRecolher.title = recolhido ? 'Expandir menu' : 'Recolher menu';
    btRecolher.addEventListener('click', alternar);
    var btSair = el('button', { type: 'button', title: 'Sair' }, icone('logout'));
    btSair.addEventListener('click', function () {
      fetch('/api/co/auth/logout', { method: 'POST' }).catch(function () {}).then(function () { location.href = '/entrar'; });
    });
    var avatar = el('span', { 'class': 'ms-avatar' });
    avatar.textContent = menu.usuario.iniciais;
    avatar.title = menu.usuario.nome + ' · ' + menu.usuario.perfil;
    pe.appendChild(btRecolher); pe.appendChild(btSair); pe.appendChild(avatar);
    rail.appendChild(pe);

    dual.appendChild(rail);
    dual.appendChild(painel);
    desenharPainel();

    var shell = el('div', { 'class': 'ms-shell ms-legado' });
    var main = el('div', { 'class': 'ms-main' });
    while (document.body.firstChild) main.appendChild(document.body.firstChild);
    shell.appendChild(dual);
    shell.appendChild(main);
    document.body.appendChild(shell);
  }

  function iniciar() {
    fetch('/api/menu').then(function (r) { return r.ok ? r.json() : null; }).then(function (menu) {
      if (menu) montar(menu);
    }).catch(function () { /* sem menu: a página segue como está */ });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
