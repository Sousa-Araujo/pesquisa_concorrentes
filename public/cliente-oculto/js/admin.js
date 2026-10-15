(async function () {
  'use strict';
  const authUser = await COAuth.requireLogin(['admin']);
  if (!authUser) return;

  const CFG = window.COConfig;
  const { PILARES, JORNADA, STATUS_JORNADA, GRAVIDADES, STATUS_AVALIACAO,
          bandFor, toneColorVar, pilarLabel, tipoTagHtml, mesReferencia, regionalOptionsHtml,
          escapeHtml, escapeAttr } = CFG;
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

  let adminDirty = false; // há alterações não salvas na tela de edição

  const views = ['view-list', 'view-edit'];
  function showView(name) {
    views.forEach(v => document.getElementById(v).style.display = v === name ? 'block' : 'none');
    document.getElementById('backToListBtn').style.display = name === 'view-list' ? 'none' : 'inline-flex';
  }

  // Avisa quando existe um gap preenchido mas ainda não salvo com "✓ Salvar gap" —
  // evita perder dados silenciosamente ao sair da edição sem salvar.
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
  function confirmLeaveEdit() {
    const cur = views.find(v => document.getElementById(v).style.display !== 'none');
    if (cur !== 'view-edit') return true;
    if (hasUnsavedGapDraft('adminGapsList') && !confirm('Há um gap preenchido mas não salvo nesta edição. Deseja sair mesmo assim e perder esse rascunho?')) return false;
    if (adminDirty && !confirm('Há alterações não salvas nesta avaliação. Deseja sair mesmo assim e perdê-las?')) return false;
    return true;
  }

  document.getElementById('backToListBtn').addEventListener('click', () => {
    if (!confirmLeaveEdit()) return;
    history.pushState(null, '', 'admin.html');
    router();
  });
  document.getElementById('brandLink').addEventListener('click', (e) => {
    if (!confirmLeaveEdit()) { e.preventDefault(); }
  });

  // ---------------------------------------------------------------------
  // Router — ?id=CO-2026-0001 abre a edição; sem id = lista
  // ---------------------------------------------------------------------
  async function router() {
    const id = new URLSearchParams(location.search).get('id');
    if (!id) { showView('view-list'); loadList(); return; }
    let av;
    try { av = await api.obterAvaliacao(id); }
    catch (err) { toast(err.message); history.replaceState(null, '', 'admin.html'); showView('view-list'); loadList(); return; }
    adminDirty = false;
    showView('view-edit');
    renderEdit(av);
  }
  window.addEventListener('popstate', router);

  function openAvaliacao(id) {
    history.pushState(null, '', `admin.html?id=${encodeURIComponent(id)}`);
    router();
  }

  // ---------------------------------------------------------------------
  // Lista
  // ---------------------------------------------------------------------
  let adminListDebounce = null;
  document.getElementById('adminFilterQ').addEventListener('input', () => { clearTimeout(adminListDebounce); adminListDebounce = setTimeout(loadList, 250); });
  ['adminFilterStatus', 'adminFilterRegional', 'adminFilterTipo', 'adminShowDeleted'].forEach(id => document.getElementById(id).addEventListener('change', loadList));
  document.getElementById('adminRefreshBtn').addEventListener('click', loadList);

  async function loadList() {
    const includeExcluidas = document.getElementById('adminShowDeleted').checked;
    const filtros = {
      q: document.getElementById('adminFilterQ').value.trim(),
      status: document.getElementById('adminFilterStatus').value,
      regional: document.getElementById('adminFilterRegional').value,
      tipoEmpreendimento: document.getElementById('adminFilterTipo').value,
      includeExcluidas,
    };
    let rows;
    try { rows = await api.listarAvaliacoes(filtros); }
    catch (err) { toast(err.message); return; }

    const tbody = document.getElementById('adminTableBody');
    document.getElementById('adminListEmpty').style.display = rows.length ? 'none' : 'block';
    tbody.innerHTML = rows.map(r => {
      const st = r.excluida ? { tone: 'tone-excluida', icon: '🗑' } : (STATUS_AVALIACAO[r.status] || {});
      const rowClass = (r.excluida ? 'row-excluida ' : '') + (r.status === 'Aguardando Calibragem' ? 'row-aguardando' : (r.status === 'Concluída' ? 'row-concluida' : ''));
      const nota = r.notaGeralCalibrada;
      const podeVerRelatorio = r.status === 'Concluída' && !r.excluida;
      return `<tr class="row-clickable ${rowClass}" data-id="${escapeAttr(r.id)}">
        <td class="id-mono">${r.id}</td>
        <td>${escapeHtml(r.empreendimento) || '—'}${tipoTagHtml(r.tipoEmpreendimento)}</td>
        <td>${escapeHtml(r.regional) || '—'}</td>
        <td>${escapeHtml(r.dataVisita) || '—'}</td>
        <td>${mesReferencia(r.dataVisita) || '—'}</td>
        <td><span class="status-badge ${st.tone || 'tone-muted'}">${st.icon || ''} ${r.excluida ? 'Excluída' : r.status}</span></td>
        <td>${nota !== null && nota !== undefined ? Number(nota).toFixed(1) : '—'}</td>
        <td><div class="row-actions">
            ${r.excluida ? '' : `<button class="btn btn-ghost btn-sm" data-edit-row="${escapeAttr(r.id)}">✏️ Editar</button>`}
            <a class="btn btn-ghost btn-sm" href="coordenador.html?id=${encodeURIComponent(r.id)}" target="_blank" rel="noopener" ${podeVerRelatorio ? '' : 'aria-disabled="true" tabindex="-1" style="pointer-events:none; opacity:.5;" title="Disponível apenas após a conclusão do diagnóstico"'}>📄 Ver relatório</a>
            ${r.excluida
              ? `<button class="btn btn-ghost btn-sm" data-restore="${escapeAttr(r.id)}">Restaurar</button>`
              : `<button class="btn btn-danger-ghost btn-sm" data-delete-row="${escapeAttr(r.id)}">🗑 Excluir</button>`}
          </div></td>
      </tr>`;
    }).join('');
    tbody.querySelectorAll('tr[data-id]').forEach(tr => tr.addEventListener('click', (e) => {
      if (e.target.closest('[data-restore], [data-delete-row], [data-edit-row], a')) return;
      openAvaliacao(tr.getAttribute('data-id'));
    }));
    tbody.querySelectorAll('[data-edit-row]').forEach(btn => btn.addEventListener('click', (e) => { e.stopPropagation(); openAvaliacao(btn.getAttribute('data-edit-row')); }));
    tbody.querySelectorAll('[data-restore]').forEach(btn => btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      try { await api.restaurar(btn.getAttribute('data-restore')); toast('Avaliação restaurada.'); loadList(); }
      catch (err) { toast(err.message); }
    }));
    tbody.querySelectorAll('[data-delete-row]').forEach(btn => btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-delete-row');
      if (!confirm(`Excluir a avaliação ${id}? Ela sai das listas e relatórios, mas o registro é mantido (exclusão lógica) e pode ser restaurado depois.`)) return;
      try { await api.excluir(id); toast('Avaliação excluída.'); loadList(); }
      catch (err) { toast(err.message); }
    }));
  }

  // ---------------------------------------------------------------------
  // Edição total — ignora travas de status
  // ---------------------------------------------------------------------
  function markAdminDirty() {
    adminDirty = true;
    const hint = document.getElementById('adminUnsavedHint');
    if (hint) { hint.textContent = '● Alterações não salvas'; hint.classList.add('is-dirty'); }
    const b = document.getElementById('adminSaveBtnBottom');
    if (b) { b.disabled = false; b.textContent = '💾 Salvar alterações'; b.classList.remove('btn-saved-flash'); }
  }

  function refreshBadge(input, badgeEl) {
    const v = input.value === '' ? null : parseFloat(input.value);
    const b = bandFor(v);
    badgeEl.textContent = v === null ? '—' : b.label;
    badgeEl.style.color = toneColorVar(b.tone);
  }
  const JORNADA_TINT = { 'var(--good)': 'var(--good-tint)', 'var(--warning)': 'var(--warning-tint)', 'var(--critical)': 'var(--critical-tint)', 'var(--text-muted)': 'var(--muted-tint)' };
  function colorizeJornadaSelect(select) {
    const s = STATUS_JORNADA[select.value] || STATUS_JORNADA.realizada;
    select.style.background = JORNADA_TINT[s.color] || 'var(--surface-3)';
    select.style.color = s.color === 'var(--text-muted)' ? 'var(--text-secondary)' : s.color;
    select.style.fontWeight = '650';
  }
  function jornadaFinal(av, key) {
    const j = av.jornada[key] || {};
    return (j.statusCalibrado !== null && j.statusCalibrado !== undefined && j.statusCalibrado !== '') ? j.statusCalibrado : j.status;
  }

  function renderEdit(av) {
    const st = STATUS_AVALIACAO[av.status] || {};
    document.getElementById('adminHeaderPanel').innerHTML = `
      <div class="panel-head">
        <h2>${escapeHtml(av.identificacao.empreendimento) || 'Avaliação'} <span class="id-mono">${av.id}</span></h2>
        ${av.excluida
          ? `<span class="status-badge tone-excluida">🗑 Excluída</span>`
          : `<select id="adminStatusSelect" title="Alterar status da avaliação"
              style="font-family:inherit; font-size:13px; font-weight:650; color:var(--text-primary); background:var(--surface-3); border:1px solid var(--border-strong); border-radius:9px; padding:7px 10px; cursor:pointer;">
              ${Object.keys(STATUS_AVALIACAO).map(s => `<option value="${escapeAttr(s)}" ${s === av.status ? 'selected' : ''}>${STATUS_AVALIACAO[s].icon} ${s}</option>`).join('')}
            </select>`}
      </div>
      <p class="panel-hint">Edição irrestrita — ignora os travamentos normais de status. Use o campo Status acima para avançar ou corrigir a etapa da avaliação (ex.: quando o próprio Administrador registra a visita, ninguém mais vai clicar em "Finalizar" — mude aqui de "Em Preenchimento" para "Aguardando Calibragem").</p>
      <div class="admin-save-bar" style="justify-content:space-between; margin-top:10px;">
        <span>${av.excluida ? `<span class="field-help">Excluída em ${escapeHtml(av.excluidaEm)}</span>` : ''}</span>
        <div class="admin-save-bar">
          ${av.excluida
            ? `<button class="btn btn-ghost" id="adminRestoreBtn">Restaurar avaliação</button>`
            : `<button class="btn btn-danger-ghost" id="adminDeleteBtn">🗑 Excluir avaliação</button>`}
          <button class="btn btn-primary" id="adminSaveBtnTop">💾 Salvar alterações</button>
        </div>
      </div>`;
    const statusSelect = document.getElementById('adminStatusSelect');
    if (statusSelect) {
      statusSelect.addEventListener('change', async () => {
        const novoStatus = statusSelect.value;
        statusSelect.disabled = true;
        try {
          await api.adminAtualizarStatus(av.id, novoStatus);
          toast(`Status alterado para "${novoStatus}".`);
          router();
        } catch (err) {
          toast(err.message);
          statusSelect.value = av.status;
          statusSelect.disabled = false;
        }
      });
    }
    if (av.excluida) {
      document.getElementById('adminRestoreBtn').onclick = async () => {
        try { await api.restaurar(av.id); toast('Avaliação restaurada.'); router(); }
        catch (err) { toast(err.message); }
      };
    } else {
      document.getElementById('adminDeleteBtn').onclick = async () => {
        if (!confirm('Excluir esta avaliação? Ela sai das listas e relatórios, mas o registro é mantido (exclusão lógica) e pode ser restaurado depois.')) return;
        try {
          await api.excluir(av.id);
          toast('Avaliação excluída.');
          adminDirty = false;
          history.pushState(null, '', 'admin.html');
          router();
        } catch (err) { toast(err.message); }
      };
    }
    document.getElementById('adminSaveBtnTop').addEventListener('click', () => saveAllAdminChanges(av.id));
    document.getElementById('adminSaveBtnBottom').onclick = () => saveAllAdminChanges(av.id);

    const hint = document.getElementById('adminUnsavedHint');
    if (hint) { hint.textContent = ' '; hint.classList.remove('is-dirty'); }
    ['adminSaveBtnTop', 'adminSaveBtnBottom'].forEach(id => {
      const b = document.getElementById(id);
      if (b) { b.disabled = false; b.textContent = '💾 Salvar alterações'; b.classList.remove('btn-saved-flash'); }
    });

    buildIdFields(av);
    buildPillarCards(av);
    buildJourneyFields(av);
    renderGaps(av);
  }

  function buildIdFields(av) {
    const el = document.getElementById('adminIdFields');
    el.innerHTML = '';
    const idz = av.identificacao;
    const tipoAtual = idz.tipoEmpreendimento || 'sousa';

    const tipoDiv = document.createElement('div');
    tipoDiv.className = 'field';
    tipoDiv.style.gridColumn = '1 / -1';
    tipoDiv.innerHTML = `
      <label>Tipo de empreendimento</label>
      <div class="segmented eval-toggle" id="adminTipoToggle">
        <button type="button" data-val="sousa" class="${tipoAtual === 'sousa' ? 'active' : ''}">✓ Sousa Araujo</button>
        <button type="button" data-val="concorrente" class="${tipoAtual === 'concorrente' ? 'active' : ''}">Concorrente</button>
      </div>`;
    el.appendChild(tipoDiv);

    const vinculoDiv = document.createElement('div');
    vinculoDiv.className = 'field';
    vinculoDiv.id = 'adminVinculoField';
    vinculoDiv.style.gridColumn = '1 / -1';
    vinculoDiv.style.display = tipoAtual === 'concorrente' ? '' : 'none';
    vinculoDiv.innerHTML = `
      <label>Empreendimento Sousa comparado</label>
      <input type="text" list="adminVinculoOptions" value="${escapeAttr(av.vinculoSousaLabel || '')}" data-admin-vinculo>
      <datalist id="adminVinculoOptions"></datalist>`;
    el.appendChild(vinculoDiv);

    const construtoraDiv = document.createElement('div');
    construtoraDiv.className = 'field';
    construtoraDiv.id = 'adminConstrutoraField';
    construtoraDiv.style.display = tipoAtual === 'concorrente' ? '' : 'none';
    construtoraDiv.innerHTML = `<label>Construtora responsável pelo concorrente</label><input type="text" value="${escapeAttr(idz.construtora || '')}" data-admin-id="construtora">`;
    el.appendChild(construtoraDiv);

    const simpleFields = [
      ['empreendimento', 'Empreendimento', 'text'], ['dataVisita', 'Data da visita', 'date'], ['horario', 'Horário', 'time'],
      ['clienteOculto', 'Cliente oculto (avaliador)', 'text'], ['recepcionista', 'Recepcionista', 'text'], ['corretor', 'Corretor', 'text'],
    ];
    simpleFields.forEach(([key, label, type]) => {
      const div = document.createElement('div'); div.className = 'field';
      div.innerHTML = `<label>${label}</label><input type="${type}" value="${escapeAttr(idz[key])}" data-admin-id="${key}">`;
      el.appendChild(div);
    });
    const regDiv = document.createElement('div'); regDiv.className = 'field';
    regDiv.innerHTML = `<label>Regional</label><select data-admin-id="regional">${regionalOptionsHtml(idz.regional)}</select>`;
    el.appendChild(regDiv);
    [['areaUnidadeDisplay', 'Área da unidade', 'text'], ['valorUnidadeDisplay', 'Valor da unidade', 'text'], ['valorAtoDisplay', 'Valor do ato', 'text'],
     ['qtdPreChaves', 'Qtd. pré-chaves', 'text'], ['qtdPosChaves', 'Qtd. pós-chaves', 'text'], ['descontoDisplay', 'Desconto informado', 'text'], ['previsaoEntrega', 'Previsão de entrega', 'text'], ['campanhaVigente', 'Campanha vigente', 'text']]
      .forEach(([key, label, type]) => {
        const div = document.createElement('div'); div.className = 'field';
        div.innerHTML = `<label>${label}</label><input type="${type}" value="${escapeAttr(idz[key])}" data-admin-id="${key}">`;
        el.appendChild(div);
      });
    el.querySelectorAll('[data-admin-id]').forEach(input => {
      input.addEventListener('input', markAdminDirty);
      input.addEventListener('change', markAdminDirty);
    });

    const adminTipoToggle = document.getElementById('adminTipoToggle');
    const adminVinculoField = document.getElementById('adminVinculoField');
    const adminConstrutoraField = document.getElementById('adminConstrutoraField');
    const adminVinculoInput = document.querySelector('[data-admin-vinculo]');
    api.opcoesVinculo(av.id).then(opcoes => {
      const dl = document.getElementById('adminVinculoOptions');
      if (dl) dl.innerHTML = opcoes.map(o => `<option value="${escapeAttr(o.label)}">`).join('');
    }).catch(() => {});
    if (adminTipoToggle) {
      adminTipoToggle.addEventListener('click', (e) => {
        const btn = e.target.closest('button'); if (!btn) return;
        adminTipoToggle.querySelectorAll('button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const tipo = btn.getAttribute('data-val');
        if (adminVinculoField) adminVinculoField.style.display = tipo === 'concorrente' ? '' : 'none';
        if (adminConstrutoraField) adminConstrutoraField.style.display = tipo === 'concorrente' ? '' : 'none';
        if (tipo === 'sousa' && adminVinculoInput) adminVinculoInput.value = '';
        markAdminDirty();
      });
    }
    if (adminVinculoInput) {
      adminVinculoInput.addEventListener('input', markAdminDirty);
      adminVinculoInput.addEventListener('change', markAdminDirty);
    }
  }

  function buildPillarCards(av) {
    const wrap = document.getElementById('adminPillarCards');
    wrap.innerHTML = '';
    PILARES.forEach(p => {
      const st = av.pilares[p.key];
      const card = document.createElement('div');
      card.className = 'panel';
      card.innerHTML = `
        <div class="panel-head">
          <h2><span class="panel-num">${p.n}</span>${p.nome}</h2>
          <div class="segmented eval-toggle" data-admin-avaliado="${p.key}">
            <button type="button" class="${st.avaliado ? 'active' : ''}" data-val="sim">✓ Avaliado</button>
            <button type="button" class="${st.avaliado ? '' : 'active'}" data-val="nao">Não avaliado</button>
          </div>
        </div>
        <div class="criteria-label">Critérios a serem utilizados na avaliação:</div>
        <div class="aspect-hint">${p.aspectos.map(a => `<span class="aspect-chip">${a}</span>`).join('')}</div>
        <div class="grid cols-2">
          <div class="field">
            <label>Nota informada (Cliente Oculto)</label>
            <div class="nota-row"><input type="number" min="0" max="10" step="0.1" value="${st.notaInformada ?? ''}" data-admin-informada="${p.key}"><span class="nota-badge" data-admin-badge-inf="${p.key}">—</span></div>
          </div>
          <div class="field"><label>Evidências</label><textarea rows="2" data-admin-evidencia="${p.key}">${st.evidencia || ''}</textarea></div>
        </div>
        <div class="calib-zone" style="margin-top:14px;">
          <div class="calib-zone-label">🖊️ Calibragem (Coordenador)</div>
          <div class="grid cols-2">
            <div class="field">
              <label>Nota calibrada</label>
              <div class="nota-row"><input type="number" min="0" max="10" step="0.1" value="${st.notaCalibrada ?? ''}" data-admin-calibrada="${p.key}"><span class="nota-badge" data-admin-badge-cal="${p.key}">—</span></div>
            </div>
            <div class="field"><label>Justificativa</label><textarea rows="2" data-admin-justificativa="${p.key}">${st.justificativaCalibragem || ''}</textarea></div>
          </div>
        </div>`;
      wrap.appendChild(card);

      const seg = card.querySelector(`[data-admin-avaliado="${p.key}"]`);
      const infInput = card.querySelector(`[data-admin-informada="${p.key}"]`);
      const infBadge = card.querySelector(`[data-admin-badge-inf="${p.key}"]`);
      const evidInput = card.querySelector(`[data-admin-evidencia="${p.key}"]`);
      const calInput = card.querySelector(`[data-admin-calibrada="${p.key}"]`);
      const calBadge = card.querySelector(`[data-admin-badge-cal="${p.key}"]`);
      const justInput = card.querySelector(`[data-admin-justificativa="${p.key}"]`);
      refreshBadge(infInput, infBadge);
      const refreshCal = () => refreshBadge(calInput, calBadge);
      refreshCal();

      seg.addEventListener('click', (e) => { const btn = e.target.closest('button'); if (!btn) return; seg.querySelectorAll('button').forEach(b => b.classList.remove('active')); btn.classList.add('active'); markAdminDirty(); });
      infInput.addEventListener('input', () => { refreshBadge(infInput, infBadge); markAdminDirty(); });
      evidInput.addEventListener('input', markAdminDirty);
      calInput.addEventListener('input', () => { refreshCal(); markAdminDirty(); });
      justInput.addEventListener('input', markAdminDirty);
    });
  }

  function buildJourneyFields(av) {
    const el = document.getElementById('adminJourneyFields');
    el.innerHTML = '';
    el.style.gridTemplateColumns = 'repeat(auto-fit, minmax(180px, 1fr))';
    JORNADA.forEach(j => {
      const informado = av.jornada[j.key].status;
      const optsInf = Object.entries(STATUS_JORNADA).map(([k, v]) => `<option value="${k}" ${informado === k ? 'selected' : ''}>${v.icon} ${v.label}</option>`).join('');
      const calVal = jornadaFinal(av, j.key);
      const optsCal = Object.entries(STATUS_JORNADA).map(([k, v]) => `<option value="${k}" ${calVal === k ? 'selected' : ''}>${v.icon} ${v.label}</option>`).join('');
      const div = document.createElement('div'); div.className = 'journey-calib-field';
      div.innerHTML = `
        <label>${j.label}</label>
        <span class="micro-label">Informada (Cliente Oculto)</span>
        <select data-admin-jornada="${j.key}">${optsInf}</select>
        <span class="micro-label">Calibrada (Coordenador)</span>
        <select data-admin-jornada-calibrada="${j.key}">${optsCal}</select>`;
      el.appendChild(div);
      colorizeJornadaSelect(div.querySelector('[data-admin-jornada]'));
      colorizeJornadaSelect(div.querySelector('[data-admin-jornada-calibrada]'));
    });
    el.querySelectorAll('[data-admin-jornada]').forEach(sel => sel.addEventListener('change', () => { colorizeJornadaSelect(sel); markAdminDirty(); }));
    el.querySelectorAll('[data-admin-jornada-calibrada]').forEach(sel => sel.addEventListener('change', () => { colorizeJornadaSelect(sel); markAdminDirty(); }));
  }

  const PILAR_OPTIONS_HTML = () => [...PILARES.map(p => ({ v: p.key, l: p.nome })), { v: 'jornada', l: 'Jornada Comercial' }, { v: 'outro', l: 'Outro' }]
    .map(o => `<option value="${o.v}">${o.l}</option>`).join('');

  function renderGaps(av) {
    const listEl = document.getElementById('adminGapsList');
    const emptyEl = document.getElementById('adminGapsEmpty');
    emptyEl.style.display = av.gaps.length ? 'none' : 'block';
    listEl.innerHTML = av.gaps.map(g => `
      <div class="gap-row" data-gap-id="${g.id}">
        <input type="text" value="${escapeAttr(g.gap)}" data-admin-gap-field="gap">
        <select data-admin-gap-field="pilar">${PILAR_OPTIONS_HTML()}</select>
        <input type="text" value="${escapeAttr(g.evidencia)}" data-admin-gap-field="evidencia">
        <select data-admin-gap-field="gravidade">${Object.entries(GRAVIDADES).map(([k, v]) => `<option value="${k}" ${g.gravidade === k ? 'selected' : ''}>${v.icon} ${v.label}</option>`).join('')}</select>
        <button class="gap-remove" data-admin-remove-gap="${g.id}" title="Remover">×</button>
      </div>`).join('');
    Array.from(listEl.children).forEach((row, i) => {
      const g = av.gaps[i]; if (!g) return;
      row.querySelector('[data-admin-gap-field="pilar"]').value = g.pilarRelacionado;
    });
    listEl.querySelectorAll('[data-admin-gap-field]').forEach(field => {
      field.addEventListener('input', markAdminDirty);
      field.addEventListener('change', markAdminDirty);
    });
    listEl.querySelectorAll('[data-admin-remove-gap]').forEach(btn => btn.addEventListener('click', async () => {
      try { const fresh = await api.adminRemoverGap(av.id, btn.getAttribute('data-admin-remove-gap')); Object.assign(av, fresh); renderGaps(av); }
      catch (err) { toast(err.message); }
    }));
  }

  document.getElementById('adminAddGapBtn').addEventListener('click', () => {
    const avId = new URLSearchParams(location.search).get('id');
    if (!avId) return;
    const wrap = document.getElementById('adminGapsList');
    const row = document.createElement('div');
    row.className = 'gap-row';
    row.style.gridTemplateColumns = '1.6fr 1fr 1.6fr 0.9fr auto';
    row.innerHTML = `
      <input type="text" placeholder="Gap identificado" data-new="gap">
      <select data-new="pilar">${PILAR_OPTIONS_HTML()}</select>
      <input type="text" placeholder="Evidência observada" data-new="evidencia">
      <select data-new="gravidade">${Object.entries(GRAVIDADES).map(([k, v]) => `<option value="${k}">${v.icon} ${v.label}</option>`).join('')}</select>
      <button class="add-btn" style="white-space:nowrap;" data-save-new>✓ Salvar gap</button>`;
    wrap.appendChild(row);
    document.getElementById('adminGapsEmpty').style.display = 'none';
    row.querySelector('[data-save-new]').addEventListener('click', async () => {
      const gap = row.querySelector('[data-new="gap"]').value.trim();
      const evidencia = row.querySelector('[data-new="evidencia"]').value.trim();
      const pilarRelacionado = row.querySelector('[data-new="pilar"]').value;
      const gravidade = row.querySelector('[data-new="gravidade"]').value;
      if (!gap || !evidencia) { toast('Preencha o gap e a evidência antes de salvar.'); return; }
      try {
        await api.adminAdicionarGap(avId, { gap, evidencia, pilarRelacionado, gravidade });
        const av = await api.obterAvaliacao(avId);
        renderGaps(av);
      } catch (err) { toast(err.message); }
    });
  });

  async function saveAllAdminChanges(avId) {
    if (hasUnsavedGapDraft('adminGapsList')) {
      alert('Existe um gap preenchido que ainda não foi salvo. Clique em "✓ Salvar gap" antes de salvar as alterações, ou apague o rascunho — caso contrário ele não será incluído.');
      return;
    }
    const btns = ['adminSaveBtnTop', 'adminSaveBtnBottom'].map(id => document.getElementById(id)).filter(Boolean);
    const hint = document.getElementById('adminUnsavedHint');
    btns.forEach(b => { b.disabled = true; b.textContent = 'Salvando…'; });
    if (hint) hint.textContent = 'Salvando alterações…';

    try {
      const idPayload = {};
      document.querySelectorAll('#adminIdFields [data-admin-id]').forEach(input => { idPayload[input.getAttribute('data-admin-id')] = input.value; });
      const adminTipoBtn = document.querySelector('#adminTipoToggle button.active');
      const tipoSelecionado = adminTipoBtn ? adminTipoBtn.getAttribute('data-val') : 'sousa';
      idPayload.tipoEmpreendimento = tipoSelecionado;
      if (tipoSelecionado === 'concorrente') {
        const vinculoInput = document.querySelector('[data-admin-vinculo]');
        const typed = vinculoInput ? vinculoInput.value.trim() : '';
        const opcoes = await api.opcoesVinculo(avId);
        const match = opcoes.find(o => o.label === typed);
        idPayload.vinculoSousaId = match ? match.id : null;
        idPayload.vinculoSousaLabel = typed;
      } else {
        idPayload.vinculoSousaId = null;
        idPayload.vinculoSousaLabel = '';
      }
      await api.adminAtualizarIdentificacao(avId, idPayload);

      for (const seg of document.querySelectorAll('#adminPillarCards [data-admin-avaliado]')) {
        const key = seg.getAttribute('data-admin-avaliado');
        const card = seg.closest('.panel');
        const infInput = card.querySelector(`[data-admin-informada="${key}"]`);
        const evidInput = card.querySelector(`[data-admin-evidencia="${key}"]`);
        const calInput = card.querySelector(`[data-admin-calibrada="${key}"]`);
        const justInput = card.querySelector(`[data-admin-justificativa="${key}"]`);
        await api.adminAtualizarPilar(avId, key, {
          avaliado: seg.querySelector('button.active').getAttribute('data-val') === 'sim',
          notaInformada: infInput.value === '' ? null : parseFloat(infInput.value),
          evidencia: evidInput.value,
          notaCalibrada: calInput.value === '' ? null : parseFloat(calInput.value),
          justificativaCalibragem: justInput.value,
        });
      }

      for (const div of document.querySelectorAll('#adminJourneyFields .journey-calib-field')) {
        const infSel = div.querySelector('[data-admin-jornada]');
        const calSel = div.querySelector('[data-admin-jornada-calibrada]');
        await api.adminAtualizarJornada(avId, infSel.getAttribute('data-admin-jornada'), {
          status: infSel.value,
          statusCalibrado: calSel.value,
        });
      }

      for (const row of document.querySelectorAll('#adminGapsList .gap-row[data-gap-id]')) {
        await api.adminAtualizarGap(avId, row.getAttribute('data-gap-id'), {
          gap: row.querySelector('[data-admin-gap-field="gap"]').value,
          pilarRelacionado: row.querySelector('[data-admin-gap-field="pilar"]').value,
          evidencia: row.querySelector('[data-admin-gap-field="evidencia"]').value,
          gravidade: row.querySelector('[data-admin-gap-field="gravidade"]').value,
        });
      }

      adminDirty = false;
      if (hint) { hint.textContent = 'Todas as alterações foram salvas ✓'; hint.classList.remove('is-dirty'); }
      btns.forEach(b => { b.disabled = false; b.textContent = '✓ Salvo'; b.classList.add('btn-saved-flash'); });
      toast('Alterações salvas com sucesso.');
      setTimeout(() => {
        btns.forEach(b => { b.textContent = '💾 Salvar alterações'; b.classList.remove('btn-saved-flash'); });
        if (!adminDirty && hint) hint.textContent = ' ';
      }, 1600);
    } catch (err) {
      btns.forEach(b => { b.disabled = false; b.textContent = '💾 Salvar alterações'; });
      if (hint) { hint.textContent = 'Erro ao salvar — tente novamente.'; hint.classList.add('is-dirty'); }
      toast(err.message);
    }
  }

  router();
})();
