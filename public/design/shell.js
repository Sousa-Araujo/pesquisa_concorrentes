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
  // Tema escolhido no menu do usuário (o mesmo das telas em React: src/lib/cliente/perfil.ts).
  var CHAVE_TEMA = 'ms-tema';
  function lerTema() {
    try { return localStorage.getItem(CHAVE_TEMA) === 'dark' ? 'dark' : 'light'; } catch (e) { return 'light'; }
  }
  document.documentElement.setAttribute('data-theme', lerTema());

  // Esconde o layout antigo da página (cabeçalho do Cliente Oculto) até o menu
  // novo estar montado, para ele não aparecer por um instante ao trocar de tela.
  var esconde = document.createElement('style');
  esconde.textContent = 'body > *:not(.ms-app) { visibility: hidden; }';
  document.head.appendChild(esconde);
  function mostrar() { if (esconde.parentNode) esconde.parentNode.removeChild(esconde); }
  // Se o menu não carregar, a página aparece do jeito que está.
  setTimeout(mostrar, 3000);

  // Ícones do Lucide (public/design/vendor/lucide.min.js), os mesmos das telas em React.
  var ICONES = { home: 'house', chart: 'chart-column', eye: 'eye', doc: 'file-text', users: 'users', receipt: 'receipt', plus: 'circle-plus', list: 'list-checks', menu: 'menu', logout: 'log-out' };
  function icone(nome) {
    return '<i data-lucide="' + (ICONES[nome] || nome) + '" aria-hidden="true"></i>';
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
    // Páginas do Cliente Oculto fora do menu (ex.: recibo) abrem o módulo do Cliente Oculto.
    if (!melhor.modulo && caminho.indexOf('/cliente-oculto/') === 0) melhor.modulo = 'co';
    return melhor;
  }

  // Reduz a foto para 160×160 (recorte central) em JPEG, como em src/lib/cliente/perfil.ts.
  function reduzirFoto(arquivo, pronto, falhou) {
    var url = URL.createObjectURL(arquivo);
    var img = new Image();
    img.onload = function () {
      var lado = 160, c = document.createElement('canvas');
      c.width = lado; c.height = lado;
      var m = Math.min(img.width, img.height);
      c.getContext('2d').drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, lado, lado);
      URL.revokeObjectURL(url);
      pronto(c.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = function () { URL.revokeObjectURL(url); falhou('Não foi possível ler a imagem.'); };
    img.src = url;
  }

  // Navbar: logo da Sousa Araujo e o menu da pessoa (o mesmo de src/components/Navbar.tsx).
  function navbar(u) {
    var topo = el('header', { 'class': 'ms-topbar' });
    topo.appendChild(el('a', { href: '/inicio', 'class': 'ms-topbar-logo', 'aria-label': 'Início' },
      '<img class="ms-logo-claro" src="/design/logo-sousa-araujo.svg" alt="Construtora Sousa Araujo">' +
      '<img class="ms-logo-escuro" src="/design/logo-sousa-araujo-branco.svg" alt="Construtora Sousa Araujo">'));

    var acoes = el('div', { 'class': 'ms-topbar-acoes' });
    var bt = el('button', { type: 'button', 'class': 'ms-icon-btn', title: 'Minha conta', 'aria-haspopup': 'menu', 'aria-expanded': 'false' },
      '<i data-lucide="settings" aria-hidden="true"></i>');
    var caixa = el('div', { 'class': 'ms-user-menu', role: 'menu', hidden: '' });

    var cab = el('div', { 'class': 'ms-user-head' });
    var avatar = el('span', { 'class': 'ms-avatar' });
    function desenharAvatar(foto) {
      avatar.innerHTML = '';
      if (foto) { var i = el('img', { alt: '' }); i.src = foto; avatar.appendChild(i); }
      else avatar.textContent = u.iniciais;
    }
    desenharAvatar(u.foto);
    var dados = el('div');
    dados.appendChild(el('b')).textContent = u.nome;
    var email = dados.appendChild(el('small')); email.textContent = u.email; email.title = u.email;
    dados.appendChild(el('small')).textContent = u.perfil;
    cab.appendChild(avatar); cab.appendChild(dados);
    caixa.appendChild(cab);
    caixa.appendChild(el('div', { 'class': 'ms-user-sep' }));

    var arquivo = el('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', hidden: '' });
    arquivo.addEventListener('change', function () {
      var f = arquivo.files && arquivo.files[0];
      arquivo.value = '';
      if (!f) return;
      reduzirFoto(f, function (foto) {
        fetch('/api/perfil/foto', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ foto: foto }) })
          .then(function (r) { if (!r.ok) throw new Error(); desenharAvatar(foto); })
          .catch(function () { alert('Não foi possível salvar a foto.'); });
      }, function (msg) { alert(msg); });
    });
    var btFoto = el('button', { type: 'button', role: 'menuitem', 'class': 'ms-user-item' }, '<i data-lucide="camera" aria-hidden="true"></i>Foto do perfil');
    btFoto.addEventListener('click', function () { arquivo.click(); });

    var escuro = lerTema() === 'dark';
    var chave = el('span', { 'class': 'ms-switch', 'data-on': String(escuro) });
    var btTema = el('button', { type: 'button', role: 'menuitemcheckbox', 'aria-checked': String(escuro), 'class': 'ms-user-item' }, '<i data-lucide="moon" aria-hidden="true"></i>Tema escuro');
    btTema.appendChild(chave);
    btTema.addEventListener('click', function () {
      escuro = !escuro;
      var tema = escuro ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', tema);
      try { localStorage.setItem(CHAVE_TEMA, tema); } catch (e) { /* sem armazenamento */ }
      chave.setAttribute('data-on', String(escuro));
      btTema.setAttribute('aria-checked', String(escuro));
    });

    var btSair = el('button', { type: 'button', role: 'menuitem', 'class': 'ms-user-item ms-user-item--sair' }, '<i data-lucide="log-out" aria-hidden="true"></i>Sair');
    btSair.addEventListener('click', function () {
      fetch('/api/co/auth/logout', { method: 'POST' }).catch(function () {}).then(function () { location.href = '/entrar'; });
    });

    caixa.appendChild(btFoto); caixa.appendChild(arquivo); caixa.appendChild(btTema);
    // "Ver o sistema como" (administrador com mais de um perfil).
    if (u.visoes && u.visoes.length) {
      caixa.appendChild(el('div', { 'class': 'ms-user-sep' }));
      caixa.appendChild(el('div', { 'class': 'ms-user-grupo' })).textContent = 'Ver o sistema como';
      u.visoes.forEach(function (v) {
        var atual = (u.visao || '') === v.valor;
        var b = el('button', { type: 'button', role: 'menuitemradio', 'aria-checked': String(atual), 'class': 'ms-user-item' },
          '<i data-lucide="user-round" aria-hidden="true"></i>' + (atual ? '<i data-lucide="check" class="ms-user-check" aria-hidden="true"></i>' : ''));
        b.insertBefore(document.createTextNode(v.rotulo), b.childNodes[1] || null);
        b.addEventListener('click', function () {
          if (atual) return;
          fetch('/api/perfil/visao', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ perfil: v.valor }) })
            .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error); location.href = j.destino; }); })
            .catch(function (e) { alert(e.message || 'Não foi possível trocar a visualização.'); });
        });
        caixa.appendChild(b);
      });
    }
    caixa.appendChild(el('div', { 'class': 'ms-user-sep' }));
    caixa.appendChild(btSair);

    function abrir(sim) {
      if (sim) caixa.removeAttribute('hidden'); else caixa.setAttribute('hidden', '');
      bt.setAttribute('aria-expanded', String(sim));
    }
    bt.addEventListener('click', function () { abrir(caixa.hasAttribute('hidden')); });
    document.addEventListener('mousedown', function (e) { if (!acoes.contains(e.target)) abrir(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') abrir(false); });

    acoes.appendChild(bt); acoes.appendChild(caixa);
    topo.appendChild(acoes);
    return topo;
  }

  // Celular: barra de baixo com os módulos e gaveta com os itens (a mesma de
  // src/components/BarraInferior.tsx). Um módulo só: os itens viram as abas.
  function barraInferior(menu, atual) {
    var frag = document.createDocumentFragment();
    var barra = el('nav', { 'class': 'ms-bottomnav', 'aria-label': 'Menu' });
    var comLink = function (m) {
      var r = [];
      m.grupos.forEach(function (g) { g.itens.forEach(function (i) { if (i.href) r.push(i); }); });
      return r;
    };
    var pendente = function (m) { return m.grupos.some(function (g) { return g.itens.some(function (i) { return i.contador; }); }); };
    var rotulo = function (txt) { var s = el('span', { 'class': 'ms-bottomnav-rotulo' }); s.textContent = txt; return s; };

    if (menu.modulos.length === 1) {
      var unico = menu.modulos[0];
      comLink(unico).forEach(function (i) {
        var a = el('a', { href: i.href }, icone(i.icone || unico.icone));
        if (i.href === atual.href) a.setAttribute('aria-current', 'page');
        a.appendChild(rotulo(i.nome));
        barra.appendChild(a);
      });
      frag.appendChild(barra);
      return frag;
    }

    var fundo = el('div', { 'class': 'ms-sheet-fundo', hidden: '' });
    var gaveta = el('div', { 'class': 'ms-sheet', role: 'dialog', 'aria-modal': 'true', hidden: '' });
    function fechar() { fundo.setAttribute('hidden', ''); gaveta.setAttribute('hidden', ''); }
    function abrir(modulos, titulo) {
      gaveta.innerHTML = '';
      gaveta.setAttribute('aria-label', titulo);
      gaveta.appendChild(el('div', { 'class': 'ms-sheet-alca' }));
      modulos.forEach(function (m) {
        gaveta.appendChild(el('h4')).textContent = m.nome;
        m.grupos.forEach(function (g) {
          gaveta.appendChild(el('div', { 'class': 'ms-sheet-grupo' })).textContent = g.nome;
          g.itens.forEach(function (i) {
            var item;
            if (i.href) {
              item = el('a', { href: i.href });
              if (i.href === atual.href) item.setAttribute('aria-current', 'page');
            } else item = el('span', { 'class': 'ms-sheet-off' });
            item.textContent = i.nome;
            if (i.contador) { var c = el('span', { 'class': 'ms-count' }); c.textContent = i.contador; item.appendChild(c); }
            gaveta.appendChild(item);
          });
        });
      });
      fundo.removeAttribute('hidden'); gaveta.removeAttribute('hidden');
    }
    fundo.addEventListener('click', fechar);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') fechar(); });

    // Módulos que já têm tela vêm primeiro; os "em breve" ficam por último (no "Mais").
    var ordem = menu.modulos.slice().sort(function (a, b) { return (comLink(b).length > 0) - (comLink(a).length > 0); });
    var muitos = ordem.length > 5;
    var naBarra = muitos ? ordem.slice(0, 4) : ordem;
    var noMais = muitos ? ordem.slice(4) : [];
    naBarra.forEach(function (m) {
      var b = el('button', { type: 'button' }, icone(m.icone) + (pendente(m) ? '<span class="ms-dot"></span>' : ''));
      if (m.id === atual.modulo) b.setAttribute('aria-current', 'page');
      b.appendChild(rotulo(m.curto || m.nome));
      b.addEventListener('click', function () {
        var itens = comLink(m);
        if (itens.length === 1) location.href = itens[0].href;
        else abrir([m], m.nome);
      });
      barra.appendChild(b);
    });
    if (muitos) {
      var mais = el('button', { type: 'button' }, icone('circle-ellipsis') + (noMais.some(pendente) ? '<span class="ms-dot"></span>' : ''));
      if (noMais.some(function (m) { return m.id === atual.modulo; })) mais.setAttribute('aria-current', 'page');
      mais.appendChild(rotulo('Mais'));
      mais.addEventListener('click', function () { abrir(noMais, 'Mais'); });
      barra.appendChild(mais);
    }
    frag.appendChild(barra); frag.appendChild(fundo); frag.appendChild(gaveta);
    return frag;
  }

  function montar(menu) {
    var atual = itemAtual(menu);
    var aberto = atual.modulo || (menu.modulos[0] && menu.modulos[0].id);
    // No celular o painel abre por cima do conteúdo (gaveta), então começa sempre fechado.
    var celular = window.matchMedia('(max-width: 720px)');
    var recolhido = celular.matches;
    if (!celular.matches) try { recolhido = localStorage.getItem(CHAVE) === '1'; } catch (e) { /* sem armazenamento */ }

    var dual = el('div', { 'class': 'ms-dual' + (recolhido ? ' is-collapsed' : ''), 'data-pronto': '' });
    var rail = el('div', { 'class': 'ms-rail' });
    var painel = el('nav', { 'class': 'ms-panel', id: 'ms-painel' });

    var btRecolher = el('button', { type: 'button', 'class': 'ms-rail-menu', 'aria-controls': 'ms-painel' }, icone('menu'));
    rail.appendChild(btRecolher);

    function desenharPainel() {
      var m = menu.modulos.filter(function (x) { return x.id === aberto; })[0];
      painel.innerHTML = '';
      if (!m) return;
      painel.setAttribute('aria-label', m.nome);
      painel.appendChild(el('h4', {}, '')).textContent = m.nome;
      m.grupos.forEach(function (g) {
        painel.appendChild(el('div', { 'class': 'ms-panel-group' }, '')).textContent = g.nome;
        g.itens.forEach(function (i) {
          var a;
          if (i.href) {
            a = el('a', { href: i.href });
            if (i.href === atual.href) a.setAttribute('aria-current', 'page');
            // Escolher a tela recolhe o menu (e a tela seguinte já abre recolhida).
            a.addEventListener('click', function () {
              if (!dual.classList.contains('is-collapsed')) alternar();
            });
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
        // Clicar no módulo que já está aberto recolhe (ou reabre) o painel.
        var fechado = dual.classList.contains('is-collapsed');
        if (m.id === aberto && !fechado) { alternar(); return; }
        aberto = m.id;
        links.forEach(function (x) { x.removeAttribute('aria-current'); });
        a.setAttribute('aria-current', 'page');
        if (dual.classList.contains('is-collapsed')) alternar();
        desenharPainel();
      });
      links.push(a);
      rail.appendChild(a);
    });

    function alternar() {
      var fechado = dual.classList.toggle('is-collapsed');
      btRecolher.setAttribute('aria-expanded', String(!fechado));
      btRecolher.title = fechado ? 'Expandir menu' : 'Recolher menu';
      if (!celular.matches) try { localStorage.setItem(CHAVE, fechado ? '1' : '0'); } catch (e) { /* sem armazenamento */ }
    }
    // Celular: tocar fora do menu aberto fecha o painel.
    document.addEventListener('pointerdown', function (e) {
      if (celular.matches && !dual.classList.contains('is-collapsed') && !dual.contains(e.target)) alternar();
    });
    btRecolher.setAttribute('aria-expanded', String(!recolhido));
    btRecolher.title = recolhido ? 'Expandir menu' : 'Recolher menu';
    btRecolher.addEventListener('click', alternar);

    dual.appendChild(rail);
    dual.appendChild(painel);
    desenharPainel();

    var app = el('div', { 'class': 'ms-app ms-legado' });
    var shell = el('div', { 'class': 'ms-shell' });
    var main = el('div', { 'class': 'ms-main' });
    while (document.body.firstChild) main.appendChild(document.body.firstChild);
    shell.appendChild(dual);
    shell.appendChild(main);
    app.appendChild(navbar(menu.usuario));
    app.appendChild(shell);
    app.appendChild(barraInferior(menu, atual));
    document.body.appendChild(app);
    if (window.lucide) window.lucide.createIcons({ attrs: { width: 18, height: 18, 'stroke-width': 1.75 } });
    mostrar();
  }

  function iniciar() {
    fetch('/api/menu').then(function (r) { return r.ok ? r.json() : null; }).then(function (menu) {
      if (menu) montar(menu); else mostrar();
    }).catch(function () { mostrar(); /* sem menu: a página segue como está */ });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
