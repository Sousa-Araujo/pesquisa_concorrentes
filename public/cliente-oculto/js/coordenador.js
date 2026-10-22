(async function () {
  'use strict';
  const authUser = await COAuth.requireLogin(['coordenador']);
  if (!authUser) return;

  const CFG = window.COConfig;
  const { PILARES, JORNADA, STATUS_JORNADA, GRAVIDADES, STATUS_AVALIACAO,
          bandFor, toneColorVar, toneTintVar, pilarLabel, tipoTagHtml, mesReferencia,
          escapeHtml, escapeAttr, PERGUNTA_ORIGEM, formatarDataHora, formatarDuracao, indicadoresPrevia, fotosHtml, criteriosHtml, abrirFotos } = CFG;

  // Atendimento prévio online: tempos a partir do contato do cliente oculto.
  function previaHtml(idz) {
    const ind = indicadoresPrevia(idz);
    if (!ind.temPrevia) return '';
    const por = idz.previaPrimeiroRetornoPor === 'ia' ? ' (robô/IA)' : idz.previaPrimeiroRetornoPor === 'pessoa' ? ' (pessoa)' : '';
    const linhas = [
      ['Canal', idz.previaCanal],
      ['Contato do cliente oculto', formatarDataHora(idz.previaContatoEm)],
      ['Primeiro retorno', formatarDataHora(idz.previaPrimeiroRetornoEm) + (idz.previaPrimeiroRetornoEm ? por : '')],
      ['Contato do corretor', formatarDataHora(idz.previaSegundoContatoEm)],
      ['Visita agendada para', formatarDataHora(idz.previaAgendamentoEm)],
    ];
    return `
      <div style="display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:12px; margin-bottom:14px;">
        <div class="stat-tile"><div class="label">Tempo até o primeiro retorno${por}</div><div class="value">${formatarDuracao(ind.primeiroRetorno)}</div></div>
        <div class="stat-tile"><div class="label">Tempo até o contato do corretor</div><div class="value">${formatarDuracao(ind.segundoContato)}</div></div>
        <div class="stat-tile"><div class="label">Do contato até a visita agendada</div><div class="value">${formatarDuracao(ind.agendamento)}</div></div>
      </div>
      <dl class="id-grid">${linhas.map(([l, v]) => `<div class="id-item"><dt>${l}</dt><dd>${escapeHtml(v) || '—'}</dd></div>`).join('')}</dl>
      ${idz.previaObservacoes ? `<p class="pillar-evid" style="margin-top:8px;"><b>Observações:</b> ${escapeHtml(idz.previaObservacoes)}</p>` : ''}`;
  }
  function perguntaOrigemTexto(idz) {
    const p = PERGUNTA_ORIGEM[idz.recepcaoPerguntouOrigem];
    return p ? p.label : 'Não informado';
  }
  const api = window.CoworkApi;

  document.getElementById('themeToggle').addEventListener('click', () => {
    const html = document.documentElement;
    html.setAttribute('data-theme', html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
  });

  function toast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast._h);
    toast._h = setTimeout(() => t.classList.remove('show'), 1800);
  }

  // Pilha de relatórios visitados via link do comparativo — permite "Voltar para
  // o relatório anterior" em vez de voltar direto para a lista.
  let reportStack = [];

  const views = ['view-list', 'view-calibragem', 'view-report'];
  function showView(name) {
    views.forEach(v => document.getElementById(v).style.display = v === name ? 'block' : 'none');
    const backBtn = document.getElementById('backToListBtn');
    backBtn.style.display = name === 'view-list' ? 'none' : 'inline-flex';
    backBtn.textContent = (name === 'view-report' && reportStack.length) ? '← Voltar para o relatório anterior' : '← Avaliações';
    window.scrollTo(0, 0);
  }

  // Avisa quando existe um rascunho de gap preenchido (gap ou evidência digitados) mas
  // ainda não salvo com "✓ Salvar gap" — evita perder dados silenciosamente ao sair/concluir.
  function hasUnsavedGapDraft(containerId) {
    const drafts = document.querySelectorAll(`#${containerId} [data-save-new]`);
    for (const btn of drafts) {
      const row = btn.closest('.gap-row');
      if (!row) continue;
      const gap = (row.querySelector('[data-new="gap"]') || {}).value || '';
      const evidencia = (row.querySelector('[data-new="evidencia"]') || {}).value || '';
      if (gap.trim() || evidencia.trim()) return true;
    }
    return false;
  }
  async function confirmLeaveCalibragem() {
    const cur = views.find(v => document.getElementById(v).style.display !== 'none');
    if (cur !== 'view-calibragem') return true;
    if (!hasUnsavedGapDraft('gapsList')) return true;
    return coConfirmar('Há um gap preenchido mas não salvo nesta calibragem. Deseja sair mesmo assim e perder esse rascunho?', { titulo: 'Sair sem salvar o gap?', textoConfirmar: 'Sair', perigo: true });
  }

  document.getElementById('backToListBtn').addEventListener('click', async () => {
    if (!(await confirmLeaveCalibragem())) return;
    const cur = views.find(v => document.getElementById(v).style.display !== 'none');
    if (cur === 'view-report' && reportStack.length) {
      const prevId = reportStack.pop();
      history.pushState(null, '', `coordenador.html?id=${encodeURIComponent(prevId)}`);
      router();
      return;
    }
    reportStack = [];
    history.pushState(null, '', 'coordenador.html');
    router();
  });
  document.querySelector('.brand').addEventListener('click', async (e) => {
    const destino = e.currentTarget.href;
    e.preventDefault();
    if (await confirmLeaveCalibragem()) location.href = destino;
  });

  // ---------------------------------------------------------------------
  // Router — ?id=CO-2026-0001 opens the avaliação; no id = lista
  // ---------------------------------------------------------------------
  async function router() {
    const id = new URLSearchParams(location.search).get('id');
    if (!id) { showView('view-list'); refreshEmpreendimentoOptions(); loadList(); return; }
    let av;
    try { av = await api.obterAvaliacao(id); }
    catch (err) { toast(err.message); history.replaceState(null, '', 'coordenador.html'); showView('view-list'); loadList(); return; }

    if (av.status === 'Em Preenchimento') {
      showView('view-calibragem');
      document.getElementById('calibHeaderPanel').innerHTML = `
        <div class="panel-head"><h2>${escapeHtml(av.identificacao.empreendimento) || 'Avaliação'} <span class="id-mono">${av.id}</span></h2></div>
        <div class="empty-state">Esta avaliação ainda está em preenchimento pelo Cliente Oculto. Ela aparecerá aqui para calibragem assim que for finalizada.</div>`;
      document.getElementById('calibPillarCards').innerHTML = '';
      document.getElementById('panel-jornada-coord').style.display = 'none';
      document.getElementById('panel-gaps-coord').style.display = 'none';
      document.querySelector('#view-calibragem .form-actions').style.display = 'none';
      return;
    }
    document.getElementById('panel-jornada-coord').style.display = '';
    document.getElementById('panel-gaps-coord').style.display = '';
    document.querySelector('#view-calibragem .form-actions').style.display = '';

    if (av.status === 'Aguardando Calibragem') {
      const jaEstavaAberta = !!av.calibragemAberta;
      if (!jaEstavaAberta) {
        try { av = await api.abrirCalibragem(id); }
        catch (err) { toast(err.message); }
      }
      showView('view-calibragem');
      renderCalibragem(av);
      if (!jaEstavaAberta) toast('Calibragem iniciada — o Cliente Oculto não pode mais editar esta avaliação.');
    } else {
      showView('view-report');
      await renderReport(av);
    }
  }
  window.addEventListener('popstate', router);

  // Navegação "fresca" (clique na lista) começa uma pilha nova — diferente de
  // openLinkedReport, que empilha o relatório atual antes de trocar de página.
  function openAvaliacao(id) {
    reportStack = [];
    history.pushState(null, '', `coordenador.html?id=${encodeURIComponent(id)}`);
    router();
  }
  // Abre o relatório completo de um concorrente a partir do link no quadro comparativo,
  // empilhando o relatório atual para permitir voltar exatamente para ele.
  function openLinkedReport(id) {
    const current = new URLSearchParams(location.search).get('id');
    if (current) reportStack.push(current);
    history.pushState(null, '', `coordenador.html?id=${encodeURIComponent(id)}`);
    router();
  }

  // ---------------------------------------------------------------------
  // Lista — filtros (Empreendimento casado com Regional, período por mês, selo
  // de período em destaque, agrupamento Sousa x Concorrente com retrair/expandir)
  // e exclusão permanente de "Em Preenchimento". Os filtros só são aplicados ao
  // clicar em "Filtrar" — a Regional é a única exceção, pois só atualiza as
  // opções de Empreendimento na hora.
  // ---------------------------------------------------------------------
  const regionalSel = document.getElementById('filterRegional');
  const empSel = document.getElementById('filterEmpreendimento');
  const collapsedGroups = new Set();

  async function refreshEmpreendimentoOptions() {
    const regional = regionalSel.value;
    const atual = empSel.value;
    let rows = [];
    try { rows = await api.listarAvaliacoes({ regional }); }
    catch (err) { return; }
    const nomes = [...new Set(rows.filter(r => r.status !== 'Em Preenchimento' && r.empreendimento).map(r => r.empreendimento))]
      .sort((a, b) => a.localeCompare(b));
    empSel.innerHTML = '<option value="">Todos</option>' + nomes.map(n => `<option value="${escapeAttr(n)}">${escapeHtml(n)}</option>`).join('');
    if (nomes.includes(atual)) empSel.value = atual;
  }
  regionalSel.addEventListener('change', refreshEmpreendimentoOptions);

  document.getElementById('applyFiltersBtn').addEventListener('click', loadList);
  document.getElementById('filterQ').addEventListener('keydown', (e) => { if (e.key === 'Enter') loadList(); });
  document.getElementById('refreshBtn').addEventListener('click', () => {
    document.getElementById('filterQ').value = '';
    document.getElementById('filterStatus').value = '';
    regionalSel.value = '';
    document.getElementById('filterMes').value = '';
    document.getElementById('filterTipo').value = '';
    collapsedGroups.clear();
    refreshEmpreendimentoOptions();
    loadList();
  });

  async function loadList() {
    const filtros = {
      q: document.getElementById('filterQ').value.trim(),
      status: document.getElementById('filterStatus').value,
      regional: regionalSel.value,
      empreendimento: empSel.value,
      mes: document.getElementById('filterMes').value,
      tipoEmpreendimento: document.getElementById('filterTipo').value,
    };
    let rows;
    try { rows = await api.listarAvaliacoes(filtros); }
    catch (err) { toast(err.message); return; }
    // Nunca traz "Em Preenchimento", mesmo com o filtro de Status em "Todos"
    rows = rows.filter(r => r.status !== 'Em Preenchimento');

    document.getElementById('listEmpty').style.display = rows.length ? 'none' : 'block';

    // Agrupa cada concorrente sob o projeto Sousa vinculado, quando esse projeto
    // também está no conjunto filtrado; concorrentes sem vínculo (ou cujo Sousa
    // vinculado ficou fora do filtro atual) aparecem como linha avulsa.
    const byId = Object.fromEntries(rows.map(r => [r.id, r]));
    const sousaRows = rows.filter(r => r.tipoEmpreendimento !== 'concorrente').sort((a, b) => (b.dataVisita || '').localeCompare(a.dataVisita || ''));
    const concorrenteRows = rows.filter(r => r.tipoEmpreendimento === 'concorrente').sort((a, b) => (b.dataVisita || '').localeCompare(a.dataVisita || ''));
    const consumidos = new Set();
    const grupos = sousaRows.map(sousa => {
      const filhos = concorrenteRows.filter(c => c.vinculoSousaId === sousa.id && byId[sousa.id]);
      filhos.forEach(f => consumidos.add(f.id));
      return { tipo: 'grupo', pai: sousa, filhos };
    });
    const avulsas = concorrenteRows.filter(c => !consumidos.has(c.id)).map(c => ({ tipo: 'avulsa', item: c }));
    const topLevel = [...grupos.map(g => ({ ...g, _data: g.pai.dataVisita || '' })), ...avulsas.map(a => ({ ...a, _data: a.item.dataVisita || '' }))]
      .sort((a, b) => b._data.localeCompare(a._data));

    const linhas = [];
    topLevel.forEach(entry => {
      if (entry.tipo === 'grupo') {
        const temFilhos = entry.filhos.length > 0;
        const colapsado = temFilhos && collapsedGroups.has(entry.pai.id);
        linhas.push(rowHtml(entry.pai, { hasChildren: temFilhos, collapsed: colapsado, childCount: entry.filhos.length }));
        if (!colapsado) entry.filhos.forEach(f => linhas.push(rowHtml(f, { isChild: true })));
      } else {
        linhas.push(rowHtml(entry.item, { isAvulsaSemVinculo: !entry.item.vinculoSousaId }));
      }
    });
    document.getElementById('avTableBody').innerHTML = linhas.join('');

    const tbody = document.getElementById('avTableBody');
    tbody.querySelectorAll('tr[data-id]').forEach(tr => tr.addEventListener('click', (e) => {
      if (e.target.closest('[data-calibrar], [data-ver-relatorio], [data-toggle-group]')) return;
      openAvaliacao(tr.getAttribute('data-id'));
    }));
    tbody.querySelectorAll('[data-calibrar]').forEach(btn => btn.addEventListener('click', (e) => { e.stopPropagation(); openAvaliacao(btn.getAttribute('data-calibrar')); }));
    tbody.querySelectorAll('[data-ver-relatorio]').forEach(btn => btn.addEventListener('click', (e) => { e.stopPropagation(); openAvaliacao(btn.getAttribute('data-ver-relatorio')); }));
  }

  // delega o clique de retrair/expandir (as linhas são recriadas a cada loadList)
  document.getElementById('avTableBody').addEventListener('click', (e) => {
    const btn = e.target.closest('.group-toggle');
    if (!btn) return;
    e.stopPropagation();
    const groupId = btn.getAttribute('data-toggle-group');
    if (collapsedGroups.has(groupId)) collapsedGroups.delete(groupId); else collapsedGroups.add(groupId);
    loadList();
  });

  const fotosDaLista = {};
  document.addEventListener('click', (e) => {
    const btn = e.target.closest && e.target.closest('[data-ver-fotos]');
    if (!btn) return;
    e.stopPropagation();
    abrirFotos(fotosDaLista[btn.getAttribute('data-ver-fotos')], 0);
  }, true);

  function rowHtml(r, { hasChildren = false, isChild = false, isAvulsaSemVinculo = false, collapsed = false, childCount = 0 } = {}) {
    const st = STATUS_AVALIACAO[r.status] || {};
    const rowClass = r.status === 'Aguardando Calibragem' ? 'row-aguardando' : (r.status === 'Concluída' ? 'row-concluida' : '');
    const groupClass = isChild ? 'row-concorrente-child' : (hasChildren ? 'row-sousa-parent has-children' : '');
    const nota = r.notaGeralCalibrada;
    let acaoHtml;
    if (r.status === 'Aguardando Calibragem') acaoHtml = `<button class="btn btn-primary btn-sm" data-calibrar="${escapeAttr(r.id)}">🖊️ Calibrar</button>`;
    else if (r.status === 'Concluída') acaoHtml = `<button class="btn btn-ghost btn-sm" data-ver-relatorio="${escapeAttr(r.id)}">📄 Ver relatório</button>`;
    // Prévia das fotos da visita direto da lista (avaliações já enviadas).
    if (r.status !== 'Em Preenchimento' && r.fotos && r.fotos.length) {
      fotosDaLista[r.id] = r.fotos;
      acaoHtml += `<button class="btn btn-ghost btn-sm fotos-lista-btn" data-ver-fotos="${escapeAttr(r.id)}" title="Ver as fotos da visita"><img src="${escapeAttr(r.fotos[0].url)}" alt="" loading="lazy">${r.fotos.length} foto${r.fotos.length > 1 ? 's' : ''}</button>`;
    }
    else acaoHtml = `<span class="row-action-muted">Aguardando preenchimento</span>`;
    const vinculoAvulso = isAvulsaSemVinculo ? '<span class="vinculo-chip-standalone" title="Concorrente sem vínculo a um projeto Sousa Araujo">🔗 sem vínculo</span>' : '';
    const toggle = hasChildren
      ? `<button class="group-toggle" data-toggle-group="${escapeAttr(r.id)}" data-collapsed="${collapsed}" title="${collapsed ? 'Expandir' : 'Retrair'} concorrentes vinculados"><span class="chevron">▾</span></button>`
      : '';
    const childChip = hasChildren ? `<span class="child-count-chip">${childCount} vinculado${childCount > 1 ? 's' : ''}</span>` : '';
    const idCell = hasChildren ? `<div class="group-id-cell">${toggle}${r.id}</div>` : r.id;
    return `<tr class="row-clickable ${rowClass} ${groupClass}" data-id="${escapeAttr(r.id)}">
      <td class="id-mono">${idCell}</td>
      <td class="cel-emp">${escapeHtml(r.empreendimento) || '—'}${tipoTagHtml(r.tipoEmpreendimento)}${r.somentePrevia ? '<span class="tipo-tag" style="background:var(--excep-tint);color:var(--excep-ink);border:1px solid var(--excep);">Só prévia</span>' : ''}${vinculoAvulso}${childChip}</td>
      <td>${escapeHtml(r.regional) || '—'}</td>
      <td class="cel-data">${escapeHtml(r.dataVisita) || '—'}</td>
      <td><span class="status-badge ${st.tone || 'tone-muted'}">${st.icon || ''} ${r.status}</span></td>
      <td>${nota !== null && nota !== undefined ? Number(nota).toFixed(1) : '—'}</td>
      <td><div class="row-actions">${acaoHtml}</div></td>
    </tr>`;
  }

  // ---------------------------------------------------------------------
  // Calibragem — dados originais em leitura + auditoria de vínculo + inputs de
  // calibragem por pilar + jornada calibrada + gaps
  // ---------------------------------------------------------------------
  function preliminarInformada(av) {
    const notas = PILARES.filter(p => av.pilares[p.key].avaliado && av.pilares[p.key].notaInformada !== null)
      .map(p => av.pilares[p.key].notaInformada);
    if (!notas.length) return null;
    return Math.round((notas.reduce((a, b) => a + b, 0) / notas.length) * 10) / 10;
  }
  function jornadaFinal(av, key) {
    const j = av.jornada[key] || {};
    return (j.statusCalibrado !== null && j.statusCalibrado !== undefined && j.statusCalibrado !== '') ? j.statusCalibrado : j.status;
  }

  // Ligação com o cadastro da Pesquisa de Concorrentes: mostra o empreendimento
  // Sousa de referência e, quando o avaliador digitou um concorrente que não
  // estava na lista, deixa o Coordenador escolher o certo ou cadastrar um novo.
  async function desenharCadastroCoord(av) {
    const box = document.getElementById('coordCadastroBox');
    if (!box) return;
    const idz = av.identificacao;
    if (idz.tipoEmpreendimento !== 'concorrente') {
      box.innerHTML = idz.idEmpreendimento
        ? `<p class="field-help" style="margin-top:10px;">Cadastro da Pesquisa: <b>${escapeHtml(idz.empreendimentoCadastro || '')}</b> ✓</p>`
        : `<p class="field-help" style="margin-top:10px;">⚠ Empreendimento ainda não ligado ao cadastro da Pesquisa (registro antigo).</p>`;
      return;
    }
    const ref = idz.idEmpreendimento
      ? `Empreendimento Sousa de referência: <b>${escapeHtml(idz.empreendimentoCadastro || '')}</b>`
      : '⚠ Sem empreendimento Sousa de referência (registro antigo).';
    if (idz.idConcorrente) {
      box.innerHTML = `<p class="field-help" style="margin-top:10px;">${ref} · Concorrente do cadastro: <b>${escapeHtml(idz.concorrenteCadastro || '')}</b> ✓</p>`;
      return;
    }
    if (!idz.idEmpreendimento) { box.innerHTML = `<p class="field-help" style="margin-top:10px;">${ref}</p>`; return; }
    let lista = [];
    try { lista = await api.cadastroConcorrentes(idz.idEmpreendimento); } catch (err) { lista = []; }
    const digitado = idz.empreendimento || '';
    box.innerHTML = `
      <div class="field" style="margin-top:12px;">
        <label>Ligar ao cadastro de concorrentes</label>
        <p class="field-help" style="margin:0 0 6px;">${ref}. O Cliente Oculto digitou <b>"${escapeHtml(digitado)}"</b>, que não estava na lista.</p>
        <div style="display:flex; gap:8px; align-items:center;">
          <select data-coord-conc style="flex:1;">
            <option value="">Selecione…</option>
            ${lista.map(c => `<option value="${c.id}">${escapeHtml(c.nome)}</option>`).join('')}
            ${digitado ? `<option value="novo">Cadastrar novo concorrente: "${escapeHtml(digitado)}"</option>` : ''}
          </select>
          <button type="button" class="btn btn-primary btn-sm" data-coord-ligar>Ligar</button>
        </div>
      </div>`;
    box.querySelector('[data-coord-ligar]').addEventListener('click', async () => {
      const v = box.querySelector('[data-coord-conc]').value;
      if (!v) { toast('Escolha o concorrente ou cadastre um novo.'); return; }
      const ind = document.getElementById('calibSaveIndicator');
      if (ind) ind.textContent = 'Salvando…';
      try {
        const atualizada = await api.ligarConcorrenteCadastro(av.id, v === 'novo' ? { novoConcorrente: digitado } : { idConcorrente: Number(v) });
        if (ind) ind.textContent = 'Salvo ✓';
        Object.assign(av.identificacao, atualizada.identificacao);
        desenharCadastroCoord(av);
      } catch (err) {
        if (ind) ind.textContent = 'Erro ao salvar';
        toast(err.message);
      }
    });
  }

  function renderCalibragem(av) {
    const prelim = preliminarInformada(av);
    const band = bandFor(prelim);
    const tipoAtual = av.identificacao.tipoEmpreendimento || 'sousa';
    document.getElementById('calibHeaderPanel').innerHTML = `
      <div class="panel-head">
        <h2>${escapeHtml(av.identificacao.empreendimento) || 'Avaliação'} <span class="id-mono">${av.id}</span></h2>
        <span class="status-badge tone-abaixo">⏳ Aguardando Calibragem</span>
      </div>
      <p class="panel-hint">${escapeHtml(av.identificacao.regional) || '—'} · ${escapeHtml(av.identificacao.dataVisita) || '—'} · Cliente oculto: ${escapeHtml(av.identificacao.clienteOculto) || '—'} · Corretor: ${escapeHtml(av.identificacao.corretor) || '—'}</p>
      <p class="panel-hint">${av.identificacao.somentePrevia ? '<b>Só prévia</b> (a visita não foi realizada) · ' : ''}Recepção perguntou a origem do cliente: <b>${perguntaOrigemTexto(av.identificacao)}</b>${indicadoresPrevia(av.identificacao).temPrevia ? ` · Prévia online: primeiro retorno em <b>${formatarDuracao(indicadoresPrevia(av.identificacao).primeiroRetorno)}</b>, corretor em <b>${formatarDuracao(indicadoresPrevia(av.identificacao).segundoContato)}</b>` : ''}</p>
      <div class="nota-row">
        <span class="nota-badge ${band.tone}" style="font-size:13px; padding:8px 14px;">${prelim !== null ? prelim.toFixed(1) + ' · ' : ''}${band.label}</span>
        <span class="field-help">Resultado preliminar — baseado nas Notas Informadas (sujeito a calibragem)</span>
      </div>
      <div class="vinculo-audit-zone">
        <div class="vinculo-audit-label">🔍 Auditoria do vínculo — confira o que o Cliente Oculto registrou</div>
        <div class="grid cols-2">
          <div class="field">
            <label>Tipo de empreendimento</label>
            <div class="segmented eval-toggle" id="coordTipoToggle">
              <button type="button" data-val="sousa" class="${tipoAtual === 'sousa' ? 'active' : ''}">✓ Sousa Araujo</button>
              <button type="button" data-val="concorrente" class="${tipoAtual === 'concorrente' ? 'active' : ''}">Concorrente</button>
            </div>
          </div>
          <div class="field" id="coordVinculoField" style="display:${tipoAtual === 'concorrente' ? '' : 'none'};">
            <label>Empreendimento Sousa comparado</label>
            <input type="text" list="coordVinculoOptions" value="${escapeAttr(av.vinculoSousaLabel || '')}" data-coord-vinculo>
            <datalist id="coordVinculoOptions"></datalist>
            <p class="field-help" id="coordVinculoStatus"></p>
          </div>
        </div>
        <div id="coordCadastroBox"></div>
      </div>`;
    desenharCadastroCoord(av);

    const coordTipoToggle = document.getElementById('coordTipoToggle');
    const coordVinculoField = document.getElementById('coordVinculoField');
    const coordVinculoInput = document.querySelector('[data-coord-vinculo]');
    const coordVinculoStatus = document.getElementById('coordVinculoStatus');
    let coordVinculoOpcoesCache = [];
    const populateCoordVinculoOptions = async () => {
      try {
        const opcoes = await api.opcoesVinculo(av.id);
        coordVinculoOpcoesCache = opcoes;
        const dl = document.getElementById('coordVinculoOptions');
        if (dl) dl.innerHTML = opcoes.map(o => `<option value="${escapeAttr(o.label)}">`).join('');
      } catch (err) { /* autocomplete é auxiliar, não bloqueia a auditoria */ }
    };
    const refreshCoordVinculoStatus = () => {
      if (!coordVinculoStatus) return;
      const typed = coordVinculoInput ? coordVinculoInput.value.trim() : '';
      if (!typed) { coordVinculoStatus.textContent = ''; return; }
      const match = coordVinculoOpcoesCache.find(o => o.label === typed);
      if (match) { coordVinculoStatus.textContent = '✓ Vinculado — o comparativo aparecerá no relatório final.'; coordVinculoStatus.style.color = 'var(--good-deep)'; }
      else { coordVinculoStatus.textContent = '⏳ Projeto ainda não localizado — confira o nome e o período digitados.'; coordVinculoStatus.style.color = 'var(--text-muted)'; }
    };
    if (coordTipoToggle) {
      populateCoordVinculoOptions().then(refreshCoordVinculoStatus);
      coordTipoToggle.addEventListener('click', async (e) => {
        const btn = e.target.closest('button'); if (!btn) return;
        coordTipoToggle.querySelectorAll('button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const tipo = btn.getAttribute('data-val');
        if (coordVinculoField) coordVinculoField.style.display = tipo === 'concorrente' ? '' : 'none';
        const payload = { tipoEmpreendimento: tipo };
        if (tipo === 'sousa') { payload.vinculoSousaId = null; payload.vinculoSousaLabel = ''; if (coordVinculoInput) coordVinculoInput.value = ''; }
        document.getElementById('calibSaveIndicator').textContent = 'Salvando…';
        try {
          await api.atualizarVinculo(av.id, { tipoEmpreendimento: tipo });
          if (tipo === 'sousa') await api.atualizarVinculo(av.id, { vinculoSousaId: null, vinculoSousaLabel: '' });
          document.getElementById('calibSaveIndicator').textContent = 'Salvo ✓';
          refreshCoordVinculoStatus();
        } catch (err) { document.getElementById('calibSaveIndicator').textContent = 'Erro ao salvar'; toast(err.message); }
      });
      if (coordVinculoInput) {
        coordVinculoInput.addEventListener('blur', async () => {
          const typed = coordVinculoInput.value.trim();
          const match = coordVinculoOpcoesCache.find(o => o.label === typed);
          document.getElementById('calibSaveIndicator').textContent = 'Salvando…';
          try {
            await api.atualizarVinculo(av.id, { vinculoSousaId: match ? match.id : null, vinculoSousaLabel: typed });
            document.getElementById('calibSaveIndicator').textContent = 'Salvo ✓';
            refreshCoordVinculoStatus();
          } catch (err) { document.getElementById('calibSaveIndicator').textContent = 'Erro ao salvar'; toast(err.message); }
        });
      }
    }

    const wrap = document.getElementById('calibPillarCards');
    wrap.innerHTML = '';
    PILARES.forEach(p => {
      const st = av.pilares[p.key];
      const card = document.createElement('div');
      card.className = 'panel';
      if (!st.avaliado) {
        card.innerHTML = `<div class="panel-head"><h2><span class="panel-num">${p.n}</span>${p.nome}</h2><span class="band-chip tone-muted">Não avaliado pelo Cliente Oculto</span></div>${st.criterios ? criteriosHtml(p.key, st.criterios) : ''}`;
        wrap.appendChild(card);
        return;
      }
      const infBand = bandFor(st.notaInformada);
      card.innerHTML = `
        <div class="panel-head"><h2><span class="panel-num">${p.n}</span>${p.nome}</h2></div>
        ${st.criterios ? '' : `<div class="criteria-label">Critérios a serem utilizados na avaliação:</div>
        <div class="aspect-hint">${p.aspectos.map(a => `<span class="aspect-chip">${a}</span>`).join('')}</div>`}
        <div class="original-block">
          <div class="pillar-card-head">
            <h4><span class="tag-readonly">Somente leitura</span> Registro original — Cliente Oculto</h4>
            <span class="band-chip ${infBand.tone}">${st.notaInformada !== null ? (st.criterios ? 'Média ' : '') + st.notaInformada.toFixed(1) + ' · ' : ''}${infBand.label}</span>
          </div>
          ${st.criterios ? criteriosHtml(p.key, st.criterios)
            : `<p class="pillar-evid"><b>Evidências:</b> ${st.evidencia ? escapeHtml(st.evidencia) : '<span style="color:var(--text-muted)">Nenhuma evidência registrada.</span>'}</p>`}
          ${fotosHtml(av.fotos, p.key)}
        </div>
        <div class="calib-zone">
          <div class="calib-zone-label">🖊️ Calibragem do Coordenador — sua avaliação final para este pilar</div>
          <div class="calib-compare">
            <div class="compare-chip">
              <span class="compare-label">Nota do Cliente Oculto</span>
              <span class="compare-value" style="color:${toneColorVar(infBand.tone)};">${st.notaInformada !== null ? st.notaInformada.toFixed(1) : '—'}</span>
              <span class="band-chip ${infBand.tone}">${infBand.label}</span>
            </div>
            <span class="compare-arrow">→</span>
            <div class="compare-chip is-calibrada">
              <span class="compare-label">Sua calibragem</span>
              <span class="compare-value" data-compare-value="${p.key}">${st.notaCalibrada !== null && st.notaCalibrada !== undefined ? st.notaCalibrada.toFixed(1) : '—'}</span>
              <span class="band-chip tone-muted" data-compare-band="${p.key}">—</span>
            </div>
          </div>
          <div class="grid cols-2">
            <div class="field">
              <label>Nota calibrada (0 a 10)</label>
              <div class="nota-row">
                <input type="number" min="0" max="10" step="0.1" placeholder="0 a 10" data-calibrada="${p.key}" value="${st.notaCalibrada !== null && st.notaCalibrada !== undefined ? st.notaCalibrada : ''}">
                <span class="nota-badge" data-badge-calib="${p.key}">—</span>
              </div>
              ${st.notaInformada !== null ? `<button type="button" class="keep-note-btn" data-use-informada="${p.key}">✓ Manter nota informada (${st.notaInformada.toFixed(1)})</button>` : ''}
              <div class="diverge-hint" data-diverge="${p.key}" style="display:none;">⚠️ Nota calibrada diverge da nota informada pelo Cliente Oculto</div>
            </div>
            <div class="field">
              <label>Justificativa da calibragem</label>
              <textarea rows="2" placeholder="Ex.: atendimento correto e cordial, porém sem evidências de diferenciação suficientes para nota excepcional." data-just="${p.key}">${st.justificativaCalibragem || ''}</textarea>
            </div>
          </div>
        </div>
      `;
      wrap.appendChild(card);

      const calInput = card.querySelector(`[data-calibrada="${p.key}"]`);
      const badge = card.querySelector(`[data-badge-calib="${p.key}"]`);
      const justInput = card.querySelector(`[data-just="${p.key}"]`);
      const compareValueEl = card.querySelector(`[data-compare-value="${p.key}"]`);
      const compareBandEl = card.querySelector(`[data-compare-band="${p.key}"]`);
      const divergeEl = card.querySelector(`[data-diverge="${p.key}"]`);
      const refresh = () => {
        const v = calInput.value === '' ? null : parseFloat(calInput.value);
        const b = bandFor(v);
        badge.textContent = v === null ? '—' : b.label;
        badge.style.color = toneColorVar(b.tone);
        if (compareValueEl) { compareValueEl.textContent = v === null ? '—' : v.toFixed(1); compareValueEl.style.color = v === null ? '' : toneColorVar(b.tone); }
        if (compareBandEl) { compareBandEl.className = `band-chip ${v === null ? 'tone-muted' : b.tone}`; compareBandEl.textContent = v === null ? '—' : b.label; }
        if (v === null) { calInput.style.borderColor = ''; calInput.style.boxShadow = ''; }
        else { calInput.style.borderColor = toneColorVar(b.tone); calInput.style.boxShadow = `0 0 0 3px ${toneTintVar(b.tone)}`; }
        if (divergeEl) {
          const difere = v !== null && st.notaInformada !== null && Math.abs(v - st.notaInformada) >= 0.05;
          divergeEl.style.display = difere ? 'inline-flex' : 'none';
        }
      };
      // A calibragem já começa com a nota do avaliador; o Coordenador só ajusta o que precisar.
      if (calInput.value === '' && st.notaInformada !== null && st.notaInformada !== undefined) {
        calInput.value = st.notaInformada;
        saveCalibragem(av.id, p.key, calInput, justInput, st.notaInformada);
      }
      refresh();
      calInput.addEventListener('input', refresh);
      calInput.addEventListener('blur', () => saveCalibragem(av.id, p.key, calInput, justInput, st.notaInformada));
      justInput.addEventListener('blur', () => saveCalibragem(av.id, p.key, calInput, justInput, st.notaInformada));
      const useBtn = card.querySelector(`[data-use-informada="${p.key}"]`);
      if (useBtn) useBtn.addEventListener('click', () => {
        calInput.value = st.notaInformada;
        refresh();
        saveCalibragem(av.id, p.key, calInput, justInput, st.notaInformada);
      });
    });

    // Observações gerais da visita (formulário por critérios), só leitura.
    const obsAntiga = document.getElementById('panel-observacoes-coord');
    if (obsAntiga) obsAntiga.remove();
    if (av.identificacao.observacoesGerais) {
      const obs = document.createElement('div');
      obs.className = 'panel';
      obs.id = 'panel-observacoes-coord';
      obs.innerHTML = `<div class="panel-head"><h2>Observações gerais da visita</h2></div>
        <p class="pillar-evid">${escapeHtml(av.identificacao.observacoesGerais)}</p>`;
      document.getElementById('panel-jornada-coord').after(obs);
    }

    renderJornadaCoord(av);
    renderGapsCoord(av);
    document.getElementById('concludeBtn').onclick = () => onConcluir(av.id);
  }

  let calibSaveTimers = {};
  function saveCalibragem(avId, pilarKey, calInput, justInput, notaInformada) {
    const ind = document.getElementById('calibSaveIndicator');
    ind.textContent = 'Salvando…';
    clearTimeout(calibSaveTimers[pilarKey]);
    calibSaveTimers[pilarKey] = setTimeout(async () => {
      const notaCalibrada = calInput.value === '' ? null : parseFloat(calInput.value);
      try {
        await api.atualizarCalibragem(avId, pilarKey, {
          notaCalibrada,
          justificativaCalibragem: justInput.value,
        });
        ind.textContent = 'Salvo ✓';
        // Princípio de integridade: toda calibragem que difere da nota informada
        // deve possuir justificativa — aviso não bloqueante (não impede salvar).
        const difere = notaCalibrada !== null && notaInformada !== null && Math.abs(notaCalibrada - notaInformada) >= 0.05;
        if (difere && !justInput.value.trim()) toast('Registre uma justificativa para esta calibragem.');
      } catch (err) { ind.textContent = 'Erro ao salvar'; toast(err.message); }
    }, 250);
  }

  // ---- Jornada calibrada (Coordenador) ----
  const JORNADA_TINT = { 'var(--good)': 'var(--good-tint)', 'var(--warning)': 'var(--warning-tint)', 'var(--critical)': 'var(--critical-tint)', 'var(--text-muted)': 'var(--muted-tint)' };
  function colorizeJornadaSelect(select) {
    const s = STATUS_JORNADA[select.value] || STATUS_JORNADA.realizada;
    select.style.background = JORNADA_TINT[s.color] || 'var(--surface-3)';
    select.style.color = s.color === 'var(--text-muted)' ? 'var(--text-secondary)' : s.color;
    select.style.fontWeight = '650';
  }
  function renderJornadaCoord(av) {
    const el = document.getElementById('journeyCoordFields');
    el.innerHTML = '';
    JORNADA.forEach(j => {
      const informada = av.jornada[j.key].status;
      const infoS = STATUS_JORNADA[informada] || STATUS_JORNADA.realizada;
      const div = document.createElement('div');
      div.className = 'journey-calib-field';
      const opts = Object.entries(STATUS_JORNADA).map(([k, v]) => `<option value="${k}">${v.icon} ${v.label}</option>`).join('');
      div.innerHTML = `
        <label>${j.label}</label>
        <span class="original-chip" style="background:${JORNADA_TINT[infoS.color] || 'var(--muted-tint)'}; color:${infoS.color};">${infoS.icon} ${infoS.label} <span style="opacity:.7; font-weight:600;">(informado)</span></span>
        <select data-jornada-calib="${j.key}">${opts}</select>`;
      el.appendChild(div);
      const sel = div.querySelector('select');
      sel.value = jornadaFinal(av, j.key);
      colorizeJornadaSelect(sel);
    });
    el.onchange = async (e) => {
      const key = e.target.getAttribute('data-jornada-calib');
      if (!key) return;
      colorizeJornadaSelect(e.target);
      document.getElementById('calibSaveIndicator').textContent = 'Salvando…';
      try { await api.atualizarJornadaCalibrada(av.id, key, e.target.value); document.getElementById('calibSaveIndicator').textContent = 'Salvo ✓'; }
      catch (err) { document.getElementById('calibSaveIndicator').textContent = 'Erro ao salvar'; toast(err.message); }
    };
  }

  // ---- Gaps (Coordenador) ----
  const PILAR_OPTIONS_HTML = () => [...PILARES.map(p => ({ v: p.key, l: p.nome })), { v: 'jornada', l: 'Jornada Comercial' }, { v: 'outro', l: 'Outro' }]
    .map(o => `<option value="${o.v}">${o.l}</option>`).join('');

  function renderGapsCoord(av) {
    const listEl = document.getElementById('gapsList');
    const emptyEl = document.getElementById('gapsEmpty');
    emptyEl.style.display = av.gaps.length ? 'none' : 'block';
    listEl.innerHTML = av.gaps.map(g => `
      <div class="gap-row" data-gap-id="${g.id}">
        <input type="text" value="${escapeAttr(g.gap)}" disabled>
        <select disabled>${PILAR_OPTIONS_HTML()}</select>
        <input type="text" value="${escapeAttr(g.evidencia)}" disabled>
        <select disabled>${Object.entries(GRAVIDADES).map(([k, v]) => `<option ${g.gravidade === k ? 'selected' : ''}>${v.icon} ${v.label}</option>`).join('')}</select>
        <button class="gap-remove" data-remove-gap="${g.id}" title="Remover">×</button>
      </div>
    `).join('');
    listEl.querySelectorAll('[data-remove-gap]').forEach(btn => btn.addEventListener('click', async () => {
      try { const fresh = await api.removerGap(av.id, btn.getAttribute('data-remove-gap')); renderGapsCoord(fresh); Object.assign(av, fresh); }
      catch (err) { toast(err.message); }
    }));
    // define o valor do <select> de pilar após o render (evita depender do atributo "selected")
    Array.from(listEl.children).forEach((row, i) => {
      const g = av.gaps[i];
      if (g) row.querySelectorAll('select')[0].value = g.pilarRelacionado;
    });
  }

  document.getElementById('addGapBtn').addEventListener('click', () => {
    const id = new URLSearchParams(location.search).get('id');
    if (!id) return;
    openGapForm(id);
  });

  function openGapForm(avId) {
    const wrap = document.getElementById('gapsList');
    const row = document.createElement('div');
    row.className = 'gap-row';
    row.style.gridTemplateColumns = '1.6fr 1fr 1.6fr 0.9fr auto';
    row.innerHTML = `
      <input type="text" placeholder="Gap identificado" data-new="gap">
      <select data-new="pilar">${PILAR_OPTIONS_HTML()}</select>
      <input type="text" placeholder="Evidência observada" data-new="evidencia">
      <select data-new="gravidade">${Object.entries(GRAVIDADES).map(([k, v]) => `<option value="${k}">${v.icon} ${v.label}</option>`).join('')}</select>
      <button class="add-btn" style="white-space:nowrap;" data-save-new>✓ Salvar gap</button>
    `;
    wrap.appendChild(row);
    document.getElementById('gapsEmpty').style.display = 'none';
    row.querySelector('[data-save-new]').addEventListener('click', async () => {
      const gap = row.querySelector('[data-new="gap"]').value.trim();
      const evidencia = row.querySelector('[data-new="evidencia"]').value.trim();
      const pilarRelacionado = row.querySelector('[data-new="pilar"]').value;
      const gravidade = row.querySelector('[data-new="gravidade"]').value;
      if (!gap || !evidencia) { toast('Preencha o gap e a evidência antes de salvar.'); return; }
      try {
        const fresh = await api.adicionarGap(avId, { gap, evidencia, pilarRelacionado, gravidade });
        renderGapsCoord(fresh);
      } catch (err) { toast(err.message); }
    });
  }

  async function onConcluir(avId) {
    if (hasUnsavedGapDraft('gapsList')) {
      coAvisar('Existe um gap preenchido que ainda não foi salvo. Clique em "✓ Salvar gap" antes de concluir o diagnóstico, ou apague o rascunho.', 'Gap não salvo');
      return;
    }
    if (!(await coConfirmar('Após concluída, a avaliação não poderá mais ser editada nesta versão.', { titulo: 'Concluir o diagnóstico?', textoConfirmar: 'Concluir' }))) return;
    try {
      await api.concluir(avId);
      router();
    } catch (err) { toast(err.message); }
  }

  // ---------------------------------------------------------------------
  // Relatório executivo final
  // ---------------------------------------------------------------------
  function notaGeralCalibrada(av) {
    const notas = PILARES.filter(p => av.pilares[p.key].avaliado && av.pilares[p.key].notaCalibrada !== null && av.pilares[p.key].notaCalibrada !== undefined)
      .map(p => av.pilares[p.key].notaCalibrada);
    if (!notas.length) return null;
    return Math.round((notas.reduce((a, b) => a + b, 0) / notas.length) * 10) / 10;
  }
  function sortedGaps(av) {
    return [...av.gaps].sort((a, b) => (GRAVIDADES[b.gravidade]?.order || 0) - (GRAVIDADES[a.gravidade]?.order || 0));
  }
  function gapCounts(av) {
    const c = { baixa: 0, moderada: 0, alta: 0, critica: 0 };
    av.gaps.forEach(g => { if (c[g.gravidade] !== undefined) c[g.gravidade]++; });
    return c;
  }
  function buildSynthesis(av, notaGeral, counts, gapsOrdenados) {
    const destaques = PILARES.filter(p => av.pilares[p.key].avaliado && av.pilares[p.key].notaCalibrada !== null && av.pilares[p.key].notaCalibrada >= 8.0)
      .map(p => {
        const ev = (av.pilares[p.key].evidencia || '').trim();
        return `<b>${p.nome}</b> (${av.pilares[p.key].notaCalibrada.toFixed(1)})${ev ? ' — ' + escapeHtml(ev.slice(0, 140)) : ''}`;
      });
    const principais = gapsOrdenados.slice(0, 3).map(g => `${GRAVIDADES[g.gravidade].icon} <b>${escapeHtml(g.gap)}</b> <span style="color:var(--text-muted)">(${pilarLabel(g.pilarRelacionado)})</span>`);
    const maior = gapsOrdenados[0] || null;
    const band = bandFor(notaGeral);
    let leitura = '';
    if (notaGeral === null) {
      leitura = 'Não há pilares avaliados suficientes para compor uma leitura geral da visita.';
    } else {
      leitura = `A visita apresentou uma experiência comercial classificada como "${band.label.toLowerCase()}" (nota geral ${notaGeral.toFixed(1)}), com base nas notas calibradas pelo Coordenador de Market Share. `;
      const criticosAltos = counts.critica + counts.alta;
      if (criticosAltos > 0) {
        leitura += `Foram identificados ${criticosAltos} gap(s) de gravidade alta ou crítica`;
        if (maior) leitura += `, com destaque para "${maior.gap}" (${pilarLabel(maior.pilarRelacionado)})`;
        leitura += '. ';
      } else if (gapsOrdenados.length > 0) {
        leitura += `Foram identificados ${gapsOrdenados.length} gap(s) de gravidade baixa ou moderada, sem falhas de maior impacto registradas. `;
      } else {
        leitura += 'Não foram identificados gaps ao longo da visita. ';
      }
      const etapaInterrompida = JORNADA.find(j => jornadaFinal(av, j.key) === 'nao_realizada');
      const etapaParcial = JORNADA.find(j => jornadaFinal(av, j.key) === 'parcial');
      if (etapaInterrompida) leitura += `A jornada comercial não foi concluída integralmente — a etapa de "${etapaInterrompida.label}" não foi realizada.`;
      else if (etapaParcial) leitura += `A jornada comercial foi concluída, com execução parcial na etapa de "${etapaParcial.label}".`;
      else leitura += 'A jornada comercial foi concluída em todas as etapas aplicáveis.';
    }
    return { destaques, principais, maior, leitura, band };
  }

  // ---- Comparativo Sousa x Concorrente(s) — só no relatório do lado Sousa ----
  function comparativoLeitura(sousaNota, concorrentes) {
    if (sousaNota === null || sousaNota === undefined) return '';
    const validas = concorrentes.map(c => notaGeralCalibrada(c)).filter(n => n !== null && n !== undefined);
    if (!validas.length) return '';
    const media = Math.round((validas.reduce((a, b) => a + b, 0) / validas.length) * 10) / 10;
    const diff = Math.round((sousaNota - media) * 10) / 10;
    const rotulo = concorrentes.length > 1 ? 'da média dos concorrentes comparados' : 'do concorrente comparado';
    if (Math.abs(diff) < 0.05) return `A Sousa Araujo está tecnicamente empatada com a nota geral ${rotulo} (${media.toFixed(1)}).`;
    const dir = diff > 0 ? 'acima' : 'abaixo';
    return `A Sousa Araujo está ${Math.abs(diff).toFixed(1)} ponto(s) ${dir} da nota geral ${rotulo} (${media.toFixed(1)}).`;
  }
  // Uma linha do comparativo: recebe os valores já na ordem das colunas rankeadas e marca
  // com ✓ a maior nota da linha (nenhuma marcação em caso de empate no topo).
  function comparativoRowHtml(label, entidadesOrdenadas, valores, trClass) {
    let maxVal = null, maxCount = 0;
    valores.forEach(v => {
      if (v === null || v === undefined) return;
      if (maxVal === null || v > maxVal) { maxVal = v; maxCount = 1; }
      else if (v === maxVal) maxCount++;
    });
    const cells = entidadesOrdenadas.map((e, idx) => {
      const v = valores[idx];
      const isWin = maxVal !== null && maxCount === 1 && v === maxVal;
      const texto = v === null || v === undefined ? '—' : v.toFixed(1);
      return `<td class="${e.tipo === 'sousa' ? 'col-sousa' : ''}">${texto}${isWin ? ' <span class="win-mark" title="Maior nota da linha">✓</span>' : ''}</td>`;
    }).join('');
    return `<tr${trClass ? ` class="${trClass}"` : ''}><td>${label}</td>${cells}</tr>`;
  }
  // Ranking geral (maior nota geral primeiro) — define a ordem das colunas, compartilhada
  // pela tabela de notas e pela tabela de critérios de mesa. A coluna da Sousa Araujo mantém
  // um contorno tracejado para ficar identificável mesmo quando não estiver na 1ª posição.
  function buildOrdenadas(sousaAv, concorrentes) {
    const entidades = [
      { tipo: 'sousa', av: sousaAv, nota: notaGeralCalibrada(sousaAv) },
      ...concorrentes.map(c => ({ tipo: 'concorrente', av: c, nota: notaGeralCalibrada(c) })),
    ];
    return entidades
      .map((e, i) => Object.assign({ _i: i }, e))
      .sort((a, b) => {
        const av_ = a.nota === null || a.nota === undefined ? -Infinity : a.nota;
        const bv_ = b.nota === null || b.nota === undefined ? -Infinity : b.nota;
        if (bv_ !== av_) return bv_ - av_;
        return a._i - b._i;
      });
  }
  function buildHeadCols(ordenadas) {
    return ordenadas.map((e, idx) => {
      const nome = escapeHtml(e.av.identificacao.empreendimento) || (e.tipo === 'sousa' ? 'Sousa Araujo' : 'Concorrente');
      const mes = mesReferencia(e.av.identificacao.dataVisita) || '—';
      const rank = `<span class="rank-tag">${idx + 1}º</span>`;
      if (e.tipo === 'sousa') {
        return `<th class="col-sousa">${rank}${nome}<span class="col-sub">Sousa Araujo · ${mes}</span></th>`;
      }
      const sub = e.av.identificacao.construtora ? `Constr. ${escapeHtml(e.av.identificacao.construtora)} · ${mes}` : `Concorrente · ${mes}`;
      return `<th>${rank}<button type="button" class="comparativo-link" data-open-report="${escapeAttr(e.av.id)}">${nome}</button><span class="col-sub">${sub}</span></th>`;
    }).join('');
  }
  // Linha da tabela de "critérios de mesa" — sem marcação de maior/vencedor, porque
  // condição comercial (valor, desconto, pré/pós-chaves) não é um ranking de qualidade:
  // um valor maior não é necessariamente "melhor" (comparação deliberadamente neutra).
  function mesaRowHtml(label, ordenadas, valores) {
    const cells = ordenadas.map((e, idx) => {
      const v = valores[idx];
      const texto = (v === null || v === undefined || v === '') ? '—' : escapeHtml(String(v));
      return `<td class="${e.tipo === 'sousa' ? 'col-sousa' : ''}">${texto}</td>`;
    }).join('');
    return `<tr><td>${label}</td>${cells}</tr>`;
  }
  function buildCriteriosMesaHtml(ordenadas, headCols) {
    const linhas = [
      mesaRowHtml('Valor da unidade', ordenadas, ordenadas.map(e => e.av.identificacao.valorUnidadeDisplay)),
      mesaRowHtml('Valor do ato', ordenadas, ordenadas.map(e => e.av.identificacao.valorAtoDisplay)),
      mesaRowHtml('Quantidade de pré-chaves', ordenadas, ordenadas.map(e => e.av.identificacao.qtdPreChaves)),
      mesaRowHtml('Quantidade de pós-chaves', ordenadas, ordenadas.map(e => e.av.identificacao.qtdPosChaves)),
      mesaRowHtml('Desconto informado', ordenadas, ordenadas.map(e => e.av.identificacao.descontoDisplay)),
    ].join('');
    return `
      <div class="comparativo-card mesa-card">
        <div class="comparativo-head">
          <h3>📋 Critérios de mesa comparados</h3>
          <p>Condições comerciais informadas em cada visita — comparação neutra (sem marcação de "vencedor"), já que um valor maior não significa necessariamente uma condição melhor.</p>
        </div>
        <div class="comparativo-table-wrap">
          <table class="comparativo-table">
            <thead><tr>
              <th>Critério</th>
              ${headCols}
            </tr></thead>
            <tbody>${linhas}</tbody>
          </table>
        </div>
      </div>`;
  }
  // Seção simplificada e opcional do relatório: só existe no relatório do lado Sousa Araujo,
  // quando há ao menos um concorrente vinculado ao mesmo projeto e período (mês da visita).
  function buildComparativoHtml(sousaAv, concorrentes) {
    if (!sousaAv || !concorrentes || !concorrentes.length) return '';
    const sousaNota = notaGeralCalibrada(sousaAv);
    const titulo = concorrentes.length > 1 ? `Comparativo com ${concorrentes.length} concorrentes` : 'Comparativo com concorrente';
    const ordenadas = buildOrdenadas(sousaAv, concorrentes);
    const headCols = buildHeadCols(ordenadas);

    const linhasPilares = PILARES.map(p => {
      const valores = ordenadas.map(e => { const st = e.av.pilares[p.key]; return st.avaliado ? st.notaCalibrada : null; });
      return comparativoRowHtml(p.nome, ordenadas, valores);
    }).join('');
    const linhaGeral = comparativoRowHtml('Nota geral', ordenadas, ordenadas.map(e => e.nota), 'row-total');

    const leitura = comparativoLeitura(sousaNota, concorrentes);
    const notasHtml = `
      <div class="comparativo-card">
        <div class="comparativo-head">
          <h3>📊 ${titulo}</h3>
          <p>Notas calibradas, mesma régua de avaliação. Colunas ordenadas da maior para a menor nota geral — ✓ marca a maior nota de cada linha. Vínculo por projeto e período (mês da visita) — evita comparar ciclos mensais diferentes.</p>
        </div>
        <div class="comparativo-table-wrap">
          <table class="comparativo-table">
            <thead><tr>
              <th>Critério</th>
              ${headCols}
            </tr></thead>
            <tbody>
              ${linhasPilares}
              ${linhaGeral}
            </tbody>
          </table>
        </div>
        ${leitura ? `<p class="comparativo-leitura">${leitura}</p>` : ''}
      </div>`;

    return notasHtml + buildCriteriosMesaHtml(ordenadas, headCols);
  }

  async function renderReport(av) {
    const notaGeral = notaGeralCalibrada(av);
    let comparativoHtml = '';
    try {
      const tipoAv = av.identificacao.tipoEmpreendimento || 'sousa';
      // O comparativo só existe no relatório do lado Sousa Araujo — comparamos sempre a
      // Sousa com seus concorrentes vinculados, nunca o inverso, para não duplicar a seção.
      if (tipoAv !== 'concorrente') {
        const concorrentesVinculados = await api.concorrentesVinculados(av.id);
        if (concorrentesVinculados.length) comparativoHtml = buildComparativoHtml(av, concorrentesVinculados);
      }
    } catch (err) { comparativoHtml = ''; }
    const bandGeral = bandFor(notaGeral);
    const counts = gapCounts(av);
    const gaps = sortedGaps(av);
    const totalGaps = gaps.length;
    const synth = buildSynthesis(av, notaGeral, counts, gaps);
    const idz = av.identificacao;
    const gapsAltaCritica = counts.alta + counts.critica;

    const idRows = [
      ['Empreendimento', idz.empreendimento], ['Regional', idz.regional], ['Data da visita', idz.dataVisita], ['Horário', idz.horario],
      ['Cliente oculto (avaliador)', idz.clienteOculto], ['Recepcionista', idz.recepcionista], ['Corretor', idz.corretor],
      ['Área da unidade', idz.areaUnidadeDisplay], ['Valor da unidade', idz.valorUnidadeDisplay], ['Valor do ato', idz.valorAtoDisplay],
      ['Qtd. pré-chaves', idz.qtdPreChaves], ['Qtd. pós-chaves', idz.qtdPosChaves], ['Desconto informado', idz.descontoDisplay], ['Previsão de entrega', idz.previsaoEntrega], ['Campanha vigente', idz.campanhaVigente],
    ];
    if ((idz.tipoEmpreendimento || 'sousa') === 'concorrente') idRows.splice(1, 0, ['Construtora (concorrente)', idz.construtora]);
    idRows.push(['Recepção perguntou a origem do cliente', perguntaOrigemTexto(idz)]);
    const previaSecao = previaHtml(idz);
    const idHtml = idRows.map(([label, val]) => `<div class="id-item"><dt>${label}</dt><dd>${escapeHtml(val) || '—'}</dd></div>`).join('');

    const scorecardHtml = PILARES.map(p => {
      const st = av.pilares[p.key];
      const nota = st.avaliado ? st.notaCalibrada : null;
      const b = bandFor(nota);
      const pct = nota !== null && nota !== undefined ? Math.max(2, (nota / 10 * 100)) : 0;
      return `<div class="score-line">
        <span class="pname">${p.nome}</span>
        <div class="meter-track"><div class="meter-fill" style="width:${pct}%; background:${toneColorVar(b.tone)};"></div></div>
        <span class="sval">${nota !== null && nota !== undefined ? nota.toFixed(1) : 'Não avaliado'}</span>
      </div>`;
    }).join('');

    const journeyHtml = JORNADA.map(j => {
      const final = jornadaFinal(av, j.key);
      const s = STATUS_JORNADA[final];
      const jr = av.jornada[j.key];
      const foiCalibrada = jr.statusCalibrado !== null && jr.statusCalibrado !== undefined && jr.statusCalibrado !== '' && jr.statusCalibrado !== jr.status;
      return `<div class="journey-node"><div class="connector"></div>
        <div class="journey-dot" style="background:${s.color};">${s.icon}</div>
        <div class="journey-label">${j.label}</div>
        <div class="journey-status" style="color:${s.color};">${s.label}</div>
        ${foiCalibrada ? `<div class="journey-status" style="color:var(--text-muted); font-weight:600; text-transform:none; margin-top:2px;">(informado: ${STATUS_JORNADA[jr.status].label})</div>` : ''}
      </div>`;
    }).join('');

    const pillarCardsHtml = PILARES.map(p => {
      const st = av.pilares[p.key];
      if (!st.avaliado) return `<div class="pillar-card"><div class="pillar-card-head"><h4>${p.nome}</h4><span class="band-chip tone-muted">Não avaliado</span></div></div>`;
      const b = bandFor(st.notaCalibrada);
      const showDiff = st.notaInformada !== null && st.notaCalibrada !== null && st.notaCalibrada !== undefined && Math.abs(st.notaInformada - st.notaCalibrada) >= 0.05;
      return `<div class="pillar-card">
        <div class="pillar-card-head">
          <h4>${p.nome}</h4>
          <span class="band-chip ${b.tone}">${st.notaCalibrada !== null && st.notaCalibrada !== undefined ? st.notaCalibrada.toFixed(1) + ' · ' : ''}${b.label}</span>
        </div>
        ${st.criterios ? criteriosHtml(p.key, st.criterios)
          : `<p class="pillar-evid">${st.evidencia ? escapeHtml(st.evidencia) : '<span style="color:var(--text-muted)">Sem evidências registradas.</span>'}</p>`}
        ${fotosHtml(av.fotos, p.key)}
        ${showDiff ? `<div class="calib-note"><b>Nota informada: ${st.notaInformada.toFixed(1)}</b> &nbsp;|&nbsp; <b>Nota calibrada: ${st.notaCalibrada.toFixed(1)}</b><br>${st.justificativaCalibragem ? escapeHtml(st.justificativaCalibragem) : 'Calibragem aplicada conforme a régua de avaliação.'}</div>` : ''}
      </div>`;
    }).join('');

    const gapsHtml = gaps.length ? gaps.map(g => {
      const gr = GRAVIDADES[g.gravidade];
      return `<div class="gap-card">
        <div class="bar" style="background:${gr.color};"></div>
        <div class="body">
          <div class="top">
            <div><div class="gap-pilar">${pilarLabel(g.pilarRelacionado)}</div><p class="gap-title">${escapeHtml(g.gap)}</p></div>
            <span class="sev-badge" style="background:${gr.tint}; color:${gr.color};">${gr.icon} ${gr.label}</span>
          </div>
          ${g.evidencia ? `<p class="gap-evid"><b>Evidência:</b> ${escapeHtml(g.evidencia)}</p>` : ''}
        </div>
      </div>`;
    }).join('') : `<div class="empty-state">Nenhum gap identificado nesta visita.</div>`;

    const heroColor = toneColorVar(bandGeral.tone);
    const html = `
      <div class="report-sheet">
        <div class="report-header">
          <div class="report-title">
            <h2>${escapeHtml(idz.empreendimento) || 'Empreendimento não informado'} <span class="id-mono" style="font-weight:600; color:var(--text-muted);">${av.id}</span></h2>
            ${(idz.tipoEmpreendimento || 'sousa') === 'concorrente' ? `<p class="construtora">🏗️ ${escapeHtml(idz.construtora) || 'Construtora não informada'}</p>` : ''}
            <p>${escapeHtml(idz.regional) || '—'} · Cliente oculto: ${escapeHtml(idz.clienteOculto) || '—'}</p>
          </div>
          <div class="report-header-right">
            <span class="status-badge tone-bom">✔ Concluída</span>
            <div class="visit-stamp">
              <span class="vs-label">Visita realizada em</span>
              <span class="vs-value">📅 ${escapeHtml(idz.dataVisita) || '—'}${idz.horario ? ' às ' + escapeHtml(idz.horario) : ''}</span>
            </div>
          </div>
        </div>

        <div class="section-title"><span class="n">1</span>Identificação da visita</div>
        <dl class="id-grid">${idHtml}</dl>
        ${previaSecao ? `<div class="section-title"><span class="n">1.1</span>Atendimento prévio online — tempo de atendimento</div>${previaSecao}` : ''}
        ${idz.somentePrevia ? `<div class="empty-state">Só prévia: a visita ao decorado/PDV não foi realizada. Não há notas, jornada nem gaps.</div>` : `

        <div class="section-title"><span class="n">2</span>Score geral da experiência</div>
        <div class="kpi-hero-row">
          <div class="kpi-hero" style="--hero-color:${heroColor};">
            <div class="label">Nota Geral da Experiência</div>
            <div class="value">${notaGeral !== null ? notaGeral.toFixed(1) : '—'}</div>
            <div class="sub"><span class="band-chip ${bandGeral.tone}">${bandGeral.label}</span></div>
          </div>
          <div class="kpi-secondary-col">
            <div class="stat-tile"><div class="label">Pilares avaliados</div><div class="value">${PILARES.filter(p => av.pilares[p.key].avaliado).length}/${PILARES.length}</div></div>
            <div class="stat-tile"><div class="label">Gaps identificados</div><div class="value">${totalGaps}</div></div>
            <div class="stat-tile ${gapsAltaCritica > 0 ? 'alert' : 'calm'}"><div class="label">Gaps alta/crítica</div><div class="value">${gapsAltaCritica}</div></div>
          </div>
        </div>

        <div class="section-title"><span class="n">3</span>Scorecard executivo — 6 pilares</div>
        <div class="scorecard">${scorecardHtml}</div>
        ${comparativoHtml}

        <div class="section-title"><span class="n">4</span>Jornada comercial</div>
        <div class="journey-report">${journeyHtml}</div>

        <div class="section-title"><span class="n">5</span>Avaliação por pilar — evidências, nota informada x calibrada</div>
        ${pillarCardsHtml}
        ${idz.observacoesGerais ? `<div class="pillar-card"><div class="pillar-card-head"><h4>Observações gerais da visita</h4></div><p class="pillar-evid">${escapeHtml(idz.observacoesGerais)}</p></div>` : ''}

        <div class="section-title"><span class="n">6</span>Mapa de gaps</div>
        ${gapsHtml}

        <div class="section-title"><span class="n">7</span>Síntese executiva</div>
        ${synth.maior ? `<div class="leading-flag"><div class="k">Gap de maior gravidade</div><div class="v">${GRAVIDADES[synth.maior.gravidade].icon} ${escapeHtml(synth.maior.gap)} <span style="font-weight:500;color:var(--text-secondary);">— ${pilarLabel(synth.maior.pilarRelacionado)}</span></div></div>` : ''}
        <div class="synth-grid">
          <div class="synth-card"><h4>Destaques da visita</h4>${synth.destaques.length ? `<ul>${synth.destaques.map(d => `<li>${d}</li>`).join('')}</ul>` : '<p style="color:var(--text-muted)">Nenhum destaque de nota muito boa/excepcional identificado.</p>'}</div>
          <div class="synth-card"><h4>Principais gaps</h4>${synth.principais.length ? `<ul>${synth.principais.map(d => `<li>${d}</li>`).join('')}</ul>` : '<p style="color:var(--text-muted)">Nenhum gap identificado.</p>'}</div>
          <div class="synth-card synth-full"><h4>Leitura geral</h4><p>${synth.leitura}</p></div>
        </div>
        `}

        <div class="legend-row">
          <span class="legend-item"><span class="legend-dot" style="background:var(--excep)"></span>9,5–10 Excepcional</span>
          <span class="legend-item"><span class="legend-dot" style="background:var(--good)"></span>8,0–9,4 Muito bom</span>
          <span class="legend-item"><span class="legend-dot" style="background:var(--neutral-band)"></span>7,0–7,9 Adequado</span>
          <span class="legend-item"><span class="legend-dot" style="background:var(--warning)"></span>5,0–6,9 Abaixo do esperado</span>
          <span class="legend-item"><span class="legend-dot" style="background:var(--critical)"></span>0–4,9 Crítico</span>
          <span class="legend-item">🟢 Baixa · 🟡 Moderada · 🟠 Alta · 🔴 Crítica (gravidade de gap)</span>
        </div>
      </div>
    `;
    document.getElementById('reportContent').innerHTML = html;
    const reciboBtn = document.getElementById('reciboBtn');
    if (reciboBtn) reciboBtn.href = `recibo.html?avaliacao=${encodeURIComponent(av.id)}`;
    wireExport(av, notaGeral, bandGeral, counts, gaps, synth);
    document.querySelectorAll('#reportContent [data-open-report]').forEach(el => {
      el.addEventListener('click', (e) => { e.preventDefault(); openLinkedReport(el.getAttribute('data-open-report')); });
    });
  }

  // ---- Export CSV / TSV — mesma lógica/schema da v1, com ID + Status + Tipo/Vínculo ----
  const EXPORT_HEADERS = [
    'ID da avaliação', 'Status', 'Tipo de empreendimento', 'Empreendimento Sousa comparado', 'Construtora (concorrente)',
    'Empreendimento', 'Regional', 'Data da visita', 'Horário', 'Cliente oculto', 'Recepcionista', 'Corretor',
    'Área da unidade', 'Valor da unidade', 'Valor do ato', 'Qtd. pré-chaves', 'Qtd. pós-chaves', 'Desconto informado', 'Previsão de entrega', 'Campanha vigente',
    'Recepção - avaliado', 'Recepção - nota informada', 'Recepção - nota calibrada', 'Recepção - evidência', 'Recepção - justificativa calibragem',
    'Corretor (atend.) - avaliado', 'Corretor (atend.) - nota informada', 'Corretor (atend.) - nota calibrada', 'Corretor (atend.) - evidência', 'Corretor (atend.) - justificativa calibragem',
    'PDV - avaliado', 'PDV - nota informada', 'PDV - nota calibrada', 'PDV - evidência', 'PDV - justificativa calibragem',
    'Materiais - avaliado', 'Materiais - nota informada', 'Materiais - nota calibrada', 'Materiais - evidência', 'Materiais - justificativa calibragem',
    'Negociação - avaliado', 'Negociação - nota informada', 'Negociação - nota calibrada', 'Negociação - evidência', 'Negociação - justificativa calibragem',
    'Conhecimento técnico - avaliado', 'Conhecimento técnico - nota informada', 'Conhecimento técnico - nota calibrada', 'Conhecimento técnico - evidência', 'Conhecimento técnico - justificativa calibragem',
    'Nota geral', 'Classificação (régua)',
    'Jornada - Recepção+Triagem (informada)', 'Jornada - Recepção+Triagem (calibrada)',
    'Jornada - Apresentação do Produto (informada)', 'Jornada - Apresentação do Produto (calibrada)',
    'Jornada - Decorado/Maquete (informada)', 'Jornada - Decorado/Maquete (calibrada)',
    'Jornada - Simulação (informada)', 'Jornada - Simulação (calibrada)',
    'Jornada - Negociação (informada)', 'Jornada - Negociação (calibrada)',
    'Jornada - Fechamento/Próximo passo (informada)', 'Jornada - Fechamento/Próximo passo (calibrada)',
    'Jornada - Follow-up (informada)', 'Jornada - Follow-up (calibrada)',
    'Gaps - baixa', 'Gaps - moderada', 'Gaps - alta', 'Gaps - crítica', 'Gaps - total', 'Gap de maior gravidade', 'Gaps - detalhamento',
    'Destaques da visita', 'Principais gaps', 'Leitura geral',
  ];
  function stripTags(html) { const d = document.createElement('div'); d.innerHTML = html; return d.textContent || ''; }
  function normalizeDecimalPtBR(v) {
    let s = String(v === undefined || v === null ? '' : v);
    if (typeof v === 'number') return s.replace('.', ',');
    if (/^-?\d+\.\d+$/.test(s)) return s.replace('.', ',');
    return s;
  }
  function toTsvCell(v) { return normalizeDecimalPtBR(v).replace(/\t/g, ' ').replace(/\n/g, ' '); }
  function toCsvCell(v) { let s = normalizeDecimalPtBR(v).replace(/\n/g, ' '); if (/[;"\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"'; return s; }

  function buildExportRow(av, notaGeral, bandGeral, counts, gaps, synth) {
    const idz = av.identificacao;
    const yn = v => v ? 'Sim' : 'Não';
    const num = v => v === null || v === undefined || isNaN(v) ? '' : v.toFixed(1);
    const row = [av.id, av.status, (idz.tipoEmpreendimento === 'concorrente' ? 'Concorrente' : 'Sousa Araujo'), av.vinculoSousaLabel || '', idz.construtora || ''];
    [idz.empreendimento, idz.regional, idz.dataVisita, idz.horario, idz.clienteOculto, idz.recepcionista, idz.corretor,
     idz.areaUnidadeDisplay, idz.valorUnidadeDisplay, idz.valorAtoDisplay, idz.qtdPreChaves, idz.qtdPosChaves, idz.descontoDisplay, idz.previsaoEntrega, idz.campanhaVigente]
      .forEach(v => row.push(v || ''));
    PILARES.forEach(p => {
      const st = av.pilares[p.key];
      row.push(yn(st.avaliado));
      row.push(st.avaliado ? num(st.notaInformada) : '');
      row.push(st.avaliado ? num(st.notaCalibrada) : '');
      row.push(st.avaliado ? (st.evidencia || '') : '');
      row.push(st.avaliado ? (st.justificativaCalibragem || '') : '');
    });
    row.push(notaGeral !== null ? num(notaGeral) : 'Não avaliado');
    row.push(bandGeral.label);
    JORNADA.forEach(j => {
      const jr = av.jornada[j.key];
      row.push(STATUS_JORNADA[jr.status].label);
      row.push(jr.statusCalibrado ? STATUS_JORNADA[jr.statusCalibrado].label : '');
    });
    row.push(counts.baixa, counts.moderada, counts.alta, counts.critica, gaps.length);
    row.push(synth.maior ? `${synth.maior.gap} (${pilarLabel(synth.maior.pilarRelacionado)})` : '');
    row.push(gaps.map(g => `${g.gap} | ${pilarLabel(g.pilarRelacionado)} | ${g.evidencia || ''} | ${GRAVIDADES[g.gravidade].label}`).join(' ;; '));
    row.push(synth.destaques.map(stripTags).join(' ;; '));
    row.push(synth.principais.map(stripTags).join(' ;; '));
    row.push(synth.leitura);
    return row;
  }

  function wireExport(av, notaGeral, bandGeral, counts, gaps, synth) {
    document.getElementById('printBtn').onclick = async () => {
      // Miniaturas com carregamento preguiçoso podem sair em branco no PDF: carrega todas antes.
      const imgs = [...document.querySelectorAll('#reportContent img')];
      imgs.forEach(img => { img.loading = 'eager'; });
      await Promise.all(imgs.map(img => img.complete ? null : new Promise(ok => { img.onload = img.onerror = ok; })));
      window.print();
    };
    document.getElementById('copyRowBtn').onclick = async () => {
      const row = buildExportRow(av, notaGeral, bandGeral, counts, gaps, synth);
      const tsv = row.map(toTsvCell).join('\t');
      try { await navigator.clipboard.writeText(tsv); toast('Copiado! Cole na próxima linha vazia da planilha.'); }
      catch (e) { toast('Não foi possível copiar automaticamente.'); }
    };
    document.getElementById('downloadCsvBtn').onclick = () => {
      const row = buildExportRow(av, notaGeral, bandGeral, counts, gaps, synth);
      const csv = EXPORT_HEADERS.map(toCsvCell).join(';') + '\n' + row.map(toCsvCell).join(';');
      const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const nomeEmp = (av.identificacao.empreendimento || 'visita').replace(/[^a-z0-9]+/gi, '_');
      a.href = url; a.download = `${av.id}_${nomeEmp}.csv`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    };
    document.getElementById('downloadHtmlBtn').onclick = () => downloadReportHtml(av);
  }

  // Exporta o relatório como um .html autocontido (CSS embutido, sem
  // dependências externas) — para abrir em qualquer navegador ou anexar num
  // e-mail, além da opção de impressão/PDF.
  async function downloadReportHtml(av) {
    const sheet = document.querySelector('#reportContent .report-sheet');
    if (!sheet) return;
    const clone = sheet.cloneNode(true);
    // Sem o app/JS por trás, os links de drill-down do comparativo não
    // funcionariam — viram texto simples no arquivo exportado.
    clone.querySelectorAll('[data-open-report]').forEach((btn) => {
      const span = document.createElement('span');
      span.textContent = btn.textContent;
      span.style.fontWeight = '750';
      btn.replaceWith(span);
    });
    // Fotos embutidas no arquivo (o endereço /api/co/fotos só abre com login no sistema).
    await Promise.all([...clone.querySelectorAll('img[src^="/api/co/fotos/"]')].map(async (img) => {
      try {
        const blob = await fetch(img.getAttribute('src')).then((r) => r.blob());
        img.src = await new Promise((ok, falha) => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.onerror = falha; fr.readAsDataURL(blob); });
        img.removeAttribute('loading');
        const a = img.closest('a');
        if (a) a.replaceWith(img);
      } catch (err) { /* sem a foto, o arquivo sai só com a legenda */ }
    }));
    let css = '';
    try { css = await fetch('css/styles.css').then((r) => r.text()); }
    catch (err) { css = ''; }
    const nomeEmp = (av.identificacao.empreendimento || 'visita').replace(/[^a-z0-9]+/gi, '_');
    const titulo = `Relatório Cliente Oculto — ${av.identificacao.empreendimento || av.id}`;
    const doc = `<!doctype html>
<html lang="pt-BR" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(titulo)}</title>
<style>${css}</style>
</head>
<body>
<div class="app" style="padding-top:28px;">
${clone.outerHTML}
</div>
</body>
</html>`;
    const blob = new Blob([doc], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${av.id}_${nomeEmp}.html`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  router();
})();
