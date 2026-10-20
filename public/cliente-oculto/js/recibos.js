// Meus recibos — o avaliador vê todos os recibos dele (o aberto primeiro), com
// status, visitas e total, e abre cada um para preencher, assinar ou consultar.
(async function () {
  'use strict';
  const authUser = await COAuth.requireLogin(['avaliador']);
  if (!authUser) return;
  const { escapeHtml, centavosToDisplay } = window.COConfig;
  const api = window.CoworkApi;
  const lista = document.getElementById('lista');

  const dataBR = (d) => { const m = String(d || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : ''; };
  const STATUS = {
    nao_assinado: { rotulo: 'Em aberto · falta assinar', tone: 'tone-abaixo', acao: 'Preencher e assinar', primaria: true },
    devolvido: { rotulo: 'Devolvido para correção', tone: 'tone-critico', acao: 'Corrigir e assinar', primaria: true },
    aguardando_aprovacao: { rotulo: 'Assinado · aguardando aprovação', tone: 'tone-muted', acao: 'Ver recibo' },
    aprovado: { rotulo: 'Aprovado · aguardando pagamento', tone: 'tone-bom', acao: 'Ver recibo' },
    pago: { rotulo: 'Pago', tone: 'tone-bom', acao: 'Ver recibo' },
  };

  let itens;
  try { itens = await api.meusRecibos(); }
  catch (err) { lista.innerHTML = `<div class="report-empty">Não foi possível carregar seus recibos (${escapeHtml(err.message)}).</div>`; return; }

  if (!itens.length) {
    lista.innerHTML = '<div class="report-empty">Você ainda não tem recibos. Eles aparecem aqui depois que você envia uma avaliação.</div>';
    return;
  }

  lista.innerHTML = itens.map((r) => {
    const st = STATUS[r.status] || STATUS.nao_assinado;
    const periodo = r.primeiraVisita === r.ultimaVisita ? dataBR(r.primeiraVisita) : `${dataBR(r.primeiraVisita)} a ${dataBR(r.ultimaVisita)}`;
    const quando = r.pagoEm ? ` · pago em ${dataBR(r.pagoEm)}` : r.assinadoEm ? ` · assinado em ${dataBR(r.assinadoEm)}` : '';
    return `<div class="minha-av">
      <div class="topo">
        <span class="nome">Recibo ${escapeHtml(r.id.slice(0, 8).toUpperCase())}</span>
        <span class="status-badge ${st.tone}">${st.rotulo}</span>
      </div>
      <div class="valor">${r.totalCentavos ? centavosToDisplay(r.totalCentavos) : 'R$ 0,00'}</div>
      <div class="info">${r.visitas} ${r.visitas === 1 ? 'visita' : 'visitas'}${periodo ? ` · ${periodo}` : ''}${quando}</div>
      ${r.empreendimentos.length ? `<div class="info">${escapeHtml(r.empreendimentos.join(', '))}</div>` : ''}
      ${r.status === 'devolvido' && r.devolvidoMotivo ? `<div class="info">Motivo da devolução: ${escapeHtml(r.devolvidoMotivo)}</div>` : ''}
      <div class="acoes">
        <a class="btn ${st.primaria ? 'btn-primary' : 'btn-ghost'} btn-sm" href="recibo.html?recibo=${encodeURIComponent(r.id)}">${st.acao}</a>
      </div>
    </div>`;
  }).join('');
})();
