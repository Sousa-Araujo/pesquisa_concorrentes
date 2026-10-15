// Cliente de API — única porta de entrada para a camada de persistência.
// Nenhuma outra parte do frontend fala com fetch() diretamente: se o backend mudar
// de endereço (ex.: quando a aplicação subir para a nuvem), só este arquivo muda.
(function (global) {
  'use strict';

  const BASE = '/api/co';

  async function request(method, url, body) {
    const opts = { method, headers: {} };
    if (body !== undefined) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    const res = await fetch(BASE + url, opts);
    let data = null;
    try { data = await res.json(); } catch (e) { /* sem corpo */ }
    if (!res.ok) {
      const err = new Error((data && data.error) || `Erro ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return data;
  }

  global.CoworkApi = {
    criarAvaliacao: () => request('POST', '/avaliacoes'),
    listarAvaliacoes: (filtros) => {
      const params = new URLSearchParams(Object.entries(filtros || {}).filter(([, v]) => v));
      const qs = params.toString();
      return request('GET', '/avaliacoes' + (qs ? `?${qs}` : ''));
    },
    obterAvaliacao: (id) => request('GET', `/avaliacoes/${encodeURIComponent(id)}`),
    atualizarIdentificacao: (id, campos) => request('PUT', `/avaliacoes/${encodeURIComponent(id)}/identificacao`, campos),
    atualizarPilarInformada: (id, pilarKey, campos) => request('PUT', `/avaliacoes/${encodeURIComponent(id)}/pilares/${pilarKey}/informada`, campos),
    atualizarJornada: (id, etapaKey, status) => request('PUT', `/avaliacoes/${encodeURIComponent(id)}/jornada/${etapaKey}`, { status }),
    finalizar: (id) => request('POST', `/avaliacoes/${encodeURIComponent(id)}/finalizar`),

    // Vínculo Sousa x Concorrente
    opcoesVinculo: (id) => request('GET', `/avaliacoes/${encodeURIComponent(id)}/opcoes-vinculo`),
    concorrentesVinculados: (id) => request('GET', `/avaliacoes/${encodeURIComponent(id)}/concorrentes`),
    atualizarVinculo: (id, campos) => request('PUT', `/avaliacoes/${encodeURIComponent(id)}/vinculo`, campos),

    // Coordenador de Market Share — etapa 2
    abrirCalibragem: (id) => request('POST', `/avaliacoes/${encodeURIComponent(id)}/abrir-calibragem`),
    atualizarCalibragem: (id, pilarKey, campos) => request('PUT', `/avaliacoes/${encodeURIComponent(id)}/pilares/${pilarKey}/calibragem`, campos),
    atualizarJornadaCalibrada: (id, etapaKey, statusCalibrado) => request('PUT', `/avaliacoes/${encodeURIComponent(id)}/jornada/${etapaKey}/calibragem`, { statusCalibrado }),
    adicionarGap: (id, gap) => request('POST', `/avaliacoes/${encodeURIComponent(id)}/gaps`, gap),
    removerGap: (id, gapId) => request('DELETE', `/avaliacoes/${encodeURIComponent(id)}/gaps/${gapId}`),
    concluir: (id) => request('POST', `/avaliacoes/${encodeURIComponent(id)}/concluir`),

    // Exclusão lógica (Administrador)
    excluir: (id) => request('POST', `/avaliacoes/${encodeURIComponent(id)}/excluir`),
    restaurar: (id) => request('POST', `/avaliacoes/${encodeURIComponent(id)}/restaurar`),

    // Administrador — bypass completo
    adminAtualizarIdentificacao: (id, campos) => request('PUT', `/admin/avaliacoes/${encodeURIComponent(id)}/identificacao`, campos),
    adminAtualizarPilar: (id, pilarKey, campos) => request('PUT', `/admin/avaliacoes/${encodeURIComponent(id)}/pilares/${pilarKey}`, campos),
    adminAtualizarJornada: (id, etapaKey, campos) => request('PUT', `/admin/avaliacoes/${encodeURIComponent(id)}/jornada/${etapaKey}`, campos),
    adminAdicionarGap: (id, gap) => request('POST', `/admin/avaliacoes/${encodeURIComponent(id)}/gaps`, gap),
    adminAtualizarGap: (id, gapId, gap) => request('PUT', `/admin/avaliacoes/${encodeURIComponent(id)}/gaps/${gapId}`, gap),
    adminRemoverGap: (id, gapId) => request('DELETE', `/admin/avaliacoes/${encodeURIComponent(id)}/gaps/${gapId}`),
    adminAtualizarStatus: (id, status) => request('PUT', `/admin/avaliacoes/${encodeURIComponent(id)}/status`, { status }),
    adminAtualizarCalibragemAberta: (id, aberta) => request('PUT', `/admin/avaliacoes/${encodeURIComponent(id)}/calibragem-aberta`, { aberta }),
    adminAtualizarVinculo: (id, campos) => request('PUT', `/admin/avaliacoes/${encodeURIComponent(id)}/vinculo`, campos),

    // Sessão (login e usuários ficam no sistema unificado: /entrar e /gestor/usuarios)
    authLogout: () => request('POST', '/auth/logout'),
    authMe: () => request('GET', '/auth/me'),
  };
})(window);
