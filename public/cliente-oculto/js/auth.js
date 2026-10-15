// Guarda de login — compartilhada por todas as telas protegidas.
// No sistema unificado o login é feito em /entrar (código por e-mail) e a
// sessão é a mesma do restante do sistema; aqui só conferimos o papel.
// Cada página chama `await COAuth.requireLogin([...papéis permitidos])` como a
// primeira coisa que seu script faz; sem sessão válida ou papel incompatível,
// esta função já redireciona e devolve null (a página que chamou deve parar
// de executar quando receber null).
(function (global) {
  'use strict';

  const HOME_BY_PAPEL = {
    avaliador: 'cliente-oculto.html',
    coordenador: 'coordenador.html',
    admin: 'admin.html',
  };

  const PAPEL_LABEL = { avaliador: 'Cliente Oculto', coordenador: 'Coordenador', admin: 'Administrador' };

  function escapeHtml(s) { return (s || '').toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  async function fetchMe() {
    try {
      const res = await fetch('/api/co/auth/me');
      if (res.status === 403) { location.href = '/inicio'; return null; }
      if (!res.ok) return null;
      return await res.json();
    } catch (e) { return null; }
  }

  async function requireLogin(papeisPermitidos) {
    const user = await fetchMe();
    if (!user) {
      location.href = '/entrar';
      return null;
    }
    if (papeisPermitidos && papeisPermitidos.length && user.papel !== 'admin' && !papeisPermitidos.includes(user.papel)) {
      location.href = HOME_BY_PAPEL[user.papel] || '/inicio';
      return null;
    }
    renderUserChip(user);
    return user;
  }

  function renderUserChip(user) {
    const nameEl = document.getElementById('userChipName');
    const logoutBtn = document.getElementById('logoutBtn');
    if (nameEl) {
      nameEl.textContent = `${user.nome} · ${PAPEL_LABEL[user.papel] || user.papel}`;
      nameEl.style.display = '';
    }
    if (logoutBtn) {
      logoutBtn.style.display = '';
      logoutBtn.addEventListener('click', logout);
    }
  }

  async function logout() {
    try { await fetch('/api/co/auth/logout', { method: 'POST' }); } catch (e) { /* segue mesmo assim */ }
    location.href = '/entrar';
  }

  global.COAuth = { requireLogin, logout, fetchMe, HOME_BY_PAPEL };
})(window);
