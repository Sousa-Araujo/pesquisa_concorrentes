// Minhas avaliações — tela inicial do Cliente Oculto (avaliador): as avaliações
// dele, para continuar o preenchimento ou abrir o recibo de pagamento.
(async function () {
  'use strict';
  const authUser = await COAuth.requireLogin(['avaliador']);
  if (!authUser) return;
  const { escapeHtml, escapeAttr, STATUS_AVALIACAO } = window.COConfig;
  const api = window.CoworkApi;
  const lista = document.getElementById('lista');

  const dataBR = (d) => { const m = String(d || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : ''; };

  let itens;
  try { itens = await api.listarAvaliacoes({}); }
  catch (err) { lista.innerHTML = `<div class="report-empty">Não foi possível carregar suas avaliações (${escapeHtml(err.message)}).</div>`; return; }

  if (!itens.length) {
    lista.innerHTML = `<div class="report-empty">Você ainda não tem avaliações.<br><a class="btn btn-primary" style="margin-top:12px;" href="cliente-oculto.html">+ Começar uma avaliação</a></div>`;
    return;
  }

  lista.innerHTML = itens.map((a) => {
    const st = STATUS_AVALIACAO[a.status] || {};
    const emPreenchimento = a.status === 'Em Preenchimento';
    const editavel = emPreenchimento || (a.status === 'Aguardando Calibragem' && !a.calibragemAberta);
    const url = `cliente-oculto.html?id=${encodeURIComponent(a.id)}`;
    return `<div class="minha-av">
      <div class="topo">
        <span class="nome">${escapeHtml(a.empreendimento) || 'Empreendimento não informado'}</span>
        <span class="status-badge ${st.tone || 'tone-muted'}">${st.icon || ''} ${escapeHtml(a.status)}</span>
      </div>
      <div class="info">${escapeHtml(a.id)}${a.dataVisita ? ` · visita de ${dataBR(a.dataVisita)}` : ''}${a.somentePrevia ? ' · só prévia' : ''}</div>
      <div class="acoes">
        <a class="btn ${emPreenchimento ? 'btn-primary' : 'btn-ghost'} btn-sm" href="${escapeAttr(url)}">${editavel ? (emPreenchimento ? 'Continuar' : 'Revisar') : 'Ver'}</a>
        ${emPreenchimento ? '' : `<a class="btn btn-ghost btn-sm" href="recibo.html?avaliacao=${encodeURIComponent(a.id)}">Recibo de pagamento</a>`}
      </div>
    </div>`;
  }).join('');
})();
