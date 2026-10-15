(async function () {
  'use strict';
  const authUser = await COAuth.requireLogin(['avaliador']);
  if (!authUser) return;

  const { PILARES, JORNADA, STATUS_JORNADA, escapeAttr, escapeHtml, bandFor, toneColorVar,
          regionalOptionsHtml, validarCamposObrigatorios, tipoTagHtml,
          moneyMaskFromDigits, centavosToDisplay, areaMaskFromInput, percentMaskFromInput } = window.COConfig;
  const api = window.CoworkApi;

  document.getElementById('themeToggle').addEventListener('click', () => {
    const html = document.documentElement;
    html.setAttribute('data-theme', html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
  });

  let avaliacao = null;
  let descontoTipo = 'valor'; // 'valor' | 'percentual'
  let tipoEmpreendimento = 'sousa'; // 'sousa' | 'concorrente'

  function toast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast._h);
    toast._h = setTimeout(() => t.classList.remove('show'), 1800);
  }
  function saving(text) { document.getElementById('saveIndicator').textContent = text; }

  // ---------------------------------------------------------------------
  // Bootstrap: resume ?id=... or create a new avaliação
  // ---------------------------------------------------------------------
  async function bootstrap() {
    const params = new URLSearchParams(location.search);
    let id = params.get('id');
    try {
      if (id) {
        avaliacao = await api.obterAvaliacao(id);
      } else {
        avaliacao = await api.criarAvaliacao();
        history.replaceState(null, '', `cliente-oculto.html?id=${encodeURIComponent(avaliacao.id)}`);
      }
    } catch (err) {
      document.getElementById('loadingState').innerHTML =
        `<div class="report-empty">Não foi possível carregar a avaliação (${escapeAttr(err.message)}). <br><a href="cliente-oculto.html">Iniciar nova avaliação</a></div>`;
      return;
    }
    document.getElementById('idChip').style.display = 'inline-flex';
    document.getElementById('idChip').textContent = avaliacao.id;
    document.getElementById('loadingState').style.display = 'none';

    // Trava final: só quando concluída, ou quando o Coordenador já abriu a calibragem.
    // Fora disso (Em Preenchimento, ou Aguardando Calibragem ainda não aberta), o
    // formulário continua acessível — apenas com o botão Finalizar oculto e um aviso.
    const travaFinal = avaliacao.status === 'Concluída' ||
      (avaliacao.status === 'Aguardando Calibragem' && avaliacao.calibragemAberta);
    if (travaFinal) {
      showLocked();
    } else {
      showForm();
    }
  }

  function showLocked() {
    document.getElementById('lockedState').style.display = 'block';
    document.getElementById('lockedIdText').textContent = avaliacao.id;
    const badge = document.getElementById('lockedStatusBadge');
    badge.textContent = avaliacao.status;
    badge.className = 'status-badge ' + (window.COConfig.STATUS_AVALIACAO[avaliacao.status] || {}).tone;
    const msg = document.querySelector('#lockedState .confirm-wrap p');
    if (msg) {
      msg.textContent = avaliacao.status === 'Concluída'
        ? 'Esta avaliação já foi concluída pelo Coordenador de Market Share e não pode mais ser editada.'
        : 'O Coordenador de Market Share já iniciou a calibragem desta avaliação — a edição foi encerrada para o Cliente Oculto. Os dados que você preencheu ficam preservados como o registro original da visita.';
    }
  }

  // ---------------------------------------------------------------------
  // Form rendering
  // ---------------------------------------------------------------------
  const ID_FIELDS_SIMPLE = [
    { key: 'empreendimento', label: 'Empreendimento', type: 'text', required: true },
    { key: 'dataVisita', label: 'Data da visita', type: 'date', required: true },
    { key: 'horario', label: 'Horário', type: 'time' },
    { key: 'clienteOculto', label: 'Cliente oculto (avaliador)', type: 'text', required: true },
    { key: 'recepcionista', label: 'Recepcionista', type: 'text' },
    { key: 'corretor', label: 'Corretor', type: 'text', required: true },
    { key: 'qtdPreChaves', label: 'Qtd. pré-chaves', type: 'text' },
    { key: 'qtdPosChaves', label: 'Qtd. pós-chaves', type: 'text' },
    { key: 'previsaoEntrega', label: 'Previsão de entrega', type: 'text', placeholder: 'Ex.: Dez/2027' },
    { key: 'campanhaVigente', label: 'Campanha vigente', type: 'text' },
  ];

  function showForm() {
    document.getElementById('formState').style.display = 'block';
    buildIdFields();
    buildPillarPanels();
    buildJourneyFields();
    fillFormFromState();

    // Trava final avaliada acima em bootstrap(); aqui só decidimos se o Finalizar
    // aparece (só "Em Preenchimento") e se mostramos o aviso de "aguardando, mas
    // ainda editável".
    const podeFinalizar = avaliacao.status === 'Em Preenchimento';
    document.getElementById('finalizeBtn').style.display = podeFinalizar ? 'inline-flex' : 'none';
    document.getElementById('finalizeBtn').addEventListener('click', onFinalize);
    renderFormBanner();
  }

  function renderFormBanner() {
    const host = document.getElementById('panel-identificacao');
    const old = document.getElementById('coFormBanner');
    if (old) old.remove();
    if (avaliacao.status === 'Em Preenchimento') return;
    const banner = document.createElement('div');
    banner.id = 'coFormBanner';
    banner.className = 'info-banner';
    banner.innerHTML = 'ℹ️ Esta avaliação já foi finalizada e está aguardando o Coordenador. Você ainda pode ajustar suas respostas até ele iniciar a calibragem.';
    host.parentNode.insertBefore(banner, host);
  }

  function applyTipoEmpreendimentoUI(tipo) {
    const vinculoField = document.getElementById('vinculoSousaField');
    const construtoraField = document.getElementById('construtoraField');
    const empLabel = document.querySelector('#empreendimentoField label');
    if (vinculoField) vinculoField.style.display = tipo === 'concorrente' ? '' : 'none';
    if (construtoraField) construtoraField.style.display = tipo === 'concorrente' ? '' : 'none';
    if (empLabel) empLabel.innerHTML = (tipo === 'concorrente' ? 'Nome do empreendimento concorrente' : 'Empreendimento') + ' <span class="required-mark">*</span>';
  }

  function buildIdFields() {
    const el = document.getElementById('idFields');
    el.innerHTML = '';

    const tipoDiv = document.createElement('div');
    tipoDiv.className = 'field';
    tipoDiv.style.gridColumn = '1 / -1';
    tipoDiv.innerHTML = `
      <label>Este é um empreendimento Sousa Araujo?</label>
      <div class="segmented eval-toggle" id="tipoEmpreendimentoToggle">
        <button type="button" data-val="sousa" class="active">✓ Sousa Araujo</button>
        <button type="button" data-val="concorrente">Concorrente</button>
      </div>
      <p class="field-help" style="margin-top:6px;">Se esta visita foi a um empreendimento concorrente, você poderá vinculá-la a um projeto Sousa Araujo para comparação no relatório final.</p>`;
    el.appendChild(tipoDiv);

    const empField = makeSimpleField(ID_FIELDS_SIMPLE.find(f => f.key === 'empreendimento'));
    empField.id = 'empreendimentoField';
    el.appendChild(empField);

    const vinculoDiv = document.createElement('div');
    vinculoDiv.className = 'field';
    vinculoDiv.id = 'vinculoSousaField';
    vinculoDiv.style.gridColumn = '1 / -1';
    vinculoDiv.style.display = 'none';
    vinculoDiv.innerHTML = `
      <label>Empreendimento Sousa Araujo comparado <span class="required-mark">*</span></label>
      <input type="text" list="vinculoSousaOptions" placeholder="Digite para buscar o projeto Sousa Araujo do mesmo período..." data-vinculo-sousa>
      <datalist id="vinculoSousaOptions"></datalist>
      <p class="field-help" id="vinculoSousaStatus"></p>`;
    el.appendChild(vinculoDiv);

    const construtoraDiv = document.createElement('div');
    construtoraDiv.className = 'field';
    construtoraDiv.id = 'construtoraField';
    construtoraDiv.style.display = 'none';
    construtoraDiv.innerHTML = `<label>Construtora responsável pelo concorrente</label><input type="text" placeholder="Ex.: COEVO" data-idfield="construtora">`;
    el.appendChild(construtoraDiv);

    ID_FIELDS_SIMPLE.slice(1, 3).forEach(f => el.appendChild(makeSimpleField(f)));

    const regDiv = document.createElement('div');
    regDiv.className = 'field';
    regDiv.innerHTML = `<label>Regional <span class="required-mark">*</span></label><select data-idfield="regional">${regionalOptionsHtml('')}</select>`;
    el.appendChild(regDiv);

    ID_FIELDS_SIMPLE.slice(3, 6).forEach(f => el.appendChild(makeSimpleField(f)));

    const areaDiv = document.createElement('div');
    areaDiv.className = 'field';
    areaDiv.innerHTML = `<label>Área da unidade</label><input type="text" placeholder="Ex.: 45 m²" data-mask="area">`;
    el.appendChild(areaDiv);

    const valUnidDiv = document.createElement('div');
    valUnidDiv.className = 'field';
    valUnidDiv.innerHTML = `<label>Valor da unidade</label><input type="text" placeholder="Ex.: R$ 350.000,00" data-mask="money" data-mask-field="valorUnidade">`;
    el.appendChild(valUnidDiv);

    const valAtoDiv = document.createElement('div');
    valAtoDiv.className = 'field';
    valAtoDiv.innerHTML = `<label>Valor do ato</label><input type="text" placeholder="Ex.: R$ 15.000,00" data-mask="money" data-mask-field="valorAto">`;
    el.appendChild(valAtoDiv);

    el.appendChild(makeSimpleField(ID_FIELDS_SIMPLE.find(f => f.key === 'qtdPreChaves')));
    el.appendChild(makeSimpleField(ID_FIELDS_SIMPLE.find(f => f.key === 'qtdPosChaves')));

    const descDiv = document.createElement('div');
    descDiv.className = 'field';
    descDiv.innerHTML = `
      <label>Desconto informado</label>
      <div class="nota-row" style="margin-bottom:6px;">
        <div class="segmented small" id="descontoTipoToggle">
          <button type="button" data-val="valor" class="active">R$</button>
          <button type="button" data-val="percentual">%</button>
        </div>
      </div>
      <input type="text" placeholder="Ex.: R$ 10.000,00 ou 3%" data-mask="desconto">`;
    el.appendChild(descDiv);

    el.appendChild(makeSimpleField(ID_FIELDS_SIMPLE.find(f => f.key === 'previsaoEntrega')));
    el.appendChild(makeSimpleField(ID_FIELDS_SIMPLE.find(f => f.key === 'campanhaVigente')));

    // tipo toggle
    const tipoToggle = document.getElementById('tipoEmpreendimentoToggle');
    tipoToggle.addEventListener('click', (e) => {
      const btn = e.target.closest('button'); if (!btn) return;
      tipoToggle.querySelectorAll('button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      tipoEmpreendimento = btn.getAttribute('data-val');
      applyTipoEmpreendimentoUI(tipoEmpreendimento);
      if (tipoEmpreendimento === 'concorrente') refreshVinculoSousaOptions();
      saveIdentificacao({ tipoEmpreendimento });
    });

    // vínculo Sousa — autocomplete resolvido no blur
    const vinculoInput = el.querySelector('[data-vinculo-sousa]');
    vinculoInput.addEventListener('blur', () => {
      const typed = vinculoInput.value.trim();
      const match = vinculoSousaOpcoesCache.find(o => o.label === typed);
      updateVinculoStatus(match ? match.id : null, typed);
      saveIdentificacao({ vinculoSousaId: match ? match.id : null, vinculoSousaLabel: match ? match.label : typed });
    });

    // wire simple text/date/time fields
    el.querySelectorAll('[data-idfield]').forEach(input => {
      input.addEventListener('blur', onIdFieldCommit);
      input.addEventListener('change', onIdFieldCommit);
    });

    // area mask
    const areaInput = el.querySelector('[data-mask="area"]');
    areaInput.addEventListener('blur', () => {
      const { valor, display } = areaMaskFromInput(areaInput.value);
      areaInput.value = display;
      saveIdentificacao({ areaUnidadeM2: valor, areaUnidadeDisplay: display });
    });

    // money masks (live)
    el.querySelectorAll('[data-mask="money"]').forEach(input => {
      input.addEventListener('input', () => {
        const { centavos, display } = moneyMaskFromDigits(input.value);
        input.value = display;
        const field = input.getAttribute('data-mask-field');
        const payload = {};
        payload[`${field}Centavos`] = centavos;
        payload[`${field}Display`] = display;
        saveIdentificacao(payload, field);
      });
    });

    // desconto tipo toggle
    const toggle = document.getElementById('descontoTipoToggle');
    const descInput = el.querySelector('[data-mask="desconto"]');
    toggle.addEventListener('click', (e) => {
      const btn = e.target.closest('button'); if (!btn) return;
      toggle.querySelectorAll('button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      descontoTipo = btn.getAttribute('data-val');
      descInput.value = '';
      descInput.placeholder = descontoTipo === 'valor' ? 'Ex.: R$ 10.000,00' : 'Ex.: 3%';
    });
    descInput.addEventListener('input', () => {
      if (descontoTipo === 'valor') {
        const { centavos, display } = moneyMaskFromDigits(descInput.value);
        descInput.value = display;
        saveIdentificacao({ descontoTipo: 'valor', descontoValorCentavos: centavos, descontoPercentual: null, descontoDisplay: display }, 'desconto');
      } else {
        const { valor, display } = percentMaskFromInput(descInput.value);
        descInput.value = display;
        saveIdentificacao({ descontoTipo: 'percentual', descontoPercentual: valor, descontoValorCentavos: null, descontoDisplay: display }, 'desconto');
      }
    });
  }

  // Opções Sousa Araujo (mesmo período/regional) disponíveis para o vínculo de
  // comparação — cacheadas após a última busca, para resolver o texto digitado
  // no autocomplete para o id da avaliação Sousa correspondente no blur.
  let vinculoSousaOpcoesCache = [];
  async function refreshVinculoSousaOptions() {
    try {
      const opcoes = await api.opcoesVinculo(avaliacao.id);
      vinculoSousaOpcoesCache = opcoes;
      const dl = document.getElementById('vinculoSousaOptions');
      if (dl) dl.innerHTML = opcoes.map(o => `<option value="${escapeAttr(o.label)}">`).join('');
    } catch (err) { /* silencioso — autocomplete é auxiliar, não bloqueia o preenchimento */ }
  }
  function updateVinculoStatus(resolvedId, typed) {
    const statusEl = document.getElementById('vinculoSousaStatus');
    if (!statusEl) return;
    if (!typed) { statusEl.textContent = ''; return; }
    if (resolvedId) { statusEl.textContent = '✓ Vinculado — o comparativo aparecerá no relatório final.'; statusEl.style.color = 'var(--good-deep)'; }
    else { statusEl.textContent = '⏳ Projeto ainda não localizado — verifique o nome e o período, ou avise o Coordenador de Market Share para ajustar o vínculo na calibragem.'; statusEl.style.color = 'var(--text-muted)'; }
  }

  function makeSimpleField(f) {
    const div = document.createElement('div');
    div.className = 'field';
    div.innerHTML = `<label>${f.label}${f.required ? ' <span class="required-mark">*</span>' : ''}</label><input type="${f.type}" placeholder="${f.placeholder || ''}" data-idfield="${f.key}">`;
    return div;
  }

  // Um timer de debounce POR CAMPO (chave opcional) — nunca um timer único
  // compartilhado, senão o blur de um campo cancela o save pendente de outro
  // e os dados digitados anteriormente se perdem silenciosamente.
  let idSaveTimers = {};
  function onIdFieldCommit(e) {
    const key = e.target.getAttribute('data-idfield');
    if (!key) return;
    saveIdentificacao({ [key]: e.target.value });
  }
  function saveIdentificacao(payload, debounceKey) {
    saving('Salvando…');
    const doSave = async () => {
      try {
        avaliacao = await api.atualizarIdentificacao(avaliacao.id, payload);
        saving('Salvo ✓');
      } catch (err) {
        saving('Erro ao salvar');
        toast(err.message);
      }
    };
    if (!debounceKey) { doSave(); return; }
    clearTimeout(idSaveTimers[debounceKey]);
    idSaveTimers[debounceKey] = setTimeout(doSave, 200);
  }

  // ---------------------------------------------------------------------
  // Pilares — apenas Nota Informada + Evidências (sem calibragem/gaps)
  // ---------------------------------------------------------------------
  function buildPillarPanels() {
    const wrap = document.getElementById('pillarPanels');
    wrap.innerHTML = '';
    PILARES.forEach(p => {
      const panel = document.createElement('div');
      panel.className = 'panel';
      panel.innerHTML = `
        <div class="panel-head">
          <h2><span class="panel-num">${p.n}</span>${p.nome}</h2>
          <div class="segmented" data-avaliado="${p.key}">
            <button type="button" class="active" data-val="sim">Avaliado</button>
            <button type="button" data-val="nao">Não avaliado</button>
          </div>
        </div>
        <div class="criteria-label">Critérios a serem utilizados na avaliação:</div>
        <div class="aspect-hint">${p.aspectos.map(a => `<span class="aspect-chip">${a}</span>`).join('')}</div>
        <div class="pillar-body" data-body="${p.key}">
          <div class="grid cols-2">
            <div class="field">
              <label>Nota informada (0 a 10) <span class="required-mark">*</span></label>
              <div class="nota-row">
                <input type="number" min="0" max="10" step="0.1" data-informada="${p.key}">
                <span class="nota-badge" data-badge="${p.key}">—</span>
              </div>
            </div>
            <div class="field">
              <label>Evidências observadas <span class="required-mark">*</span></label>
              <textarea rows="2" placeholder="Fatos concretos observados na visita (não opiniões genéricas)" data-evidencia="${p.key}"></textarea>
            </div>
          </div>
        </div>
      `;
      wrap.appendChild(panel);

      const seg = panel.querySelector(`[data-avaliado="${p.key}"]`);
      const body = panel.querySelector(`[data-body="${p.key}"]`);
      seg.addEventListener('click', (e) => {
        const btn = e.target.closest('button'); if (!btn) return;
        seg.querySelectorAll('button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const avaliadoBool = btn.getAttribute('data-val') === 'sim';
        body.style.opacity = avaliadoBool ? '1' : '0.4';
        body.style.pointerEvents = avaliadoBool ? 'auto' : 'none';
        savePilarInformada(p.key);
      });

      const informadaInput = panel.querySelector(`[data-informada="${p.key}"]`);
      const badge = panel.querySelector(`[data-badge="${p.key}"]`);
      informadaInput.addEventListener('input', () => refreshBadge(informadaInput, badge));
      informadaInput.addEventListener('blur', () => savePilarInformada(p.key));
      panel.querySelector(`[data-evidencia="${p.key}"]`).addEventListener('blur', () => savePilarInformada(p.key));
    });
  }

  function refreshBadge(input, badgeEl) {
    const v = input.value === '' ? null : parseFloat(input.value);
    const b = bandFor(v);
    badgeEl.textContent = b.label;
    badgeEl.style.color = toneColorVar(b.tone);
  }

  let pilarSaveTimers = {};
  function savePilarInformada(key) {
    saving('Salvando…');
    clearTimeout(pilarSaveTimers[key]);
    pilarSaveTimers[key] = setTimeout(async () => {
      const seg = document.querySelector(`[data-avaliado="${key}"]`);
      const avaliadoBool = seg.querySelector('button.active').getAttribute('data-val') === 'sim';
      const notaInformada = document.querySelector(`[data-informada="${key}"]`).value;
      const evidencia = document.querySelector(`[data-evidencia="${key}"]`).value;
      try {
        avaliacao = await api.atualizarPilarInformada(avaliacao.id, key, {
          avaliado: avaliadoBool,
          notaInformada: notaInformada === '' ? null : parseFloat(notaInformada),
          evidencia,
        });
        saving('Salvo ✓');
      } catch (err) {
        saving('Erro ao salvar');
        toast(err.message);
      }
    }, 250);
  }

  // ---------------------------------------------------------------------
  // Jornada
  // ---------------------------------------------------------------------
  function buildJourneyFields() {
    const el = document.getElementById('journeyFields');
    el.innerHTML = '';
    JORNADA.forEach(j => {
      const div = document.createElement('div');
      div.className = 'journey-step-field';
      const opts = Object.entries(STATUS_JORNADA).map(([k, v]) => `<option value="${k}">${v.icon} ${v.label}</option>`).join('');
      div.innerHTML = `<label>${j.label}</label><select data-jornada="${j.key}">${opts}</select>`;
      el.appendChild(div);
    });
    el.addEventListener('change', async (e) => {
      const key = e.target.getAttribute('data-jornada');
      if (!key) return;
      saving('Salvando…');
      try {
        avaliacao = await api.atualizarJornada(avaliacao.id, key, e.target.value);
        saving('Salvo ✓');
      } catch (err) {
        saving('Erro ao salvar'); toast(err.message);
      }
    });
  }

  // ---------------------------------------------------------------------
  // Fill form from loaded state (resume flow)
  // ---------------------------------------------------------------------
  function fillFormFromState() {
    const idz = avaliacao.identificacao;
    tipoEmpreendimento = idz.tipoEmpreendimento || 'sousa';
    const tipoToggle = document.getElementById('tipoEmpreendimentoToggle');
    tipoToggle.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.getAttribute('data-val') === tipoEmpreendimento));
    applyTipoEmpreendimentoUI(tipoEmpreendimento);

    ID_FIELDS_SIMPLE.forEach(f => {
      const input = document.querySelector(`[data-idfield="${f.key}"]`);
      if (input) input.value = idz[f.key] || '';
    });
    const regSel = document.querySelector('[data-idfield="regional"]');
    if (regSel) regSel.value = idz.regional || '';
    document.querySelector('[data-idfield="construtora"]').value = idz.construtora || '';

    const vinculoInput = document.querySelector('[data-vinculo-sousa]');
    if (vinculoInput) {
      vinculoInput.value = avaliacao.vinculoSousaLabel || '';
      updateVinculoStatus(avaliacao.vinculoSousaId, avaliacao.vinculoSousaLabel);
      if (tipoEmpreendimento === 'concorrente') refreshVinculoSousaOptions();
    }

    const areaInput = document.querySelector('[data-mask="area"]');
    if (areaInput) areaInput.value = idz.areaUnidadeDisplay || '';
    document.querySelector('[data-mask-field="valorUnidade"]').value = idz.valorUnidadeDisplay || '';
    document.querySelector('[data-mask-field="valorAto"]').value = idz.valorAtoDisplay || '';
    if (idz.descontoTipo) {
      descontoTipo = idz.descontoTipo;
      const toggle = document.getElementById('descontoTipoToggle');
      toggle.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.getAttribute('data-val') === descontoTipo));
    }
    document.querySelector('[data-mask="desconto"]').value = idz.descontoDisplay || '';

    PILARES.forEach(p => {
      const st = avaliacao.pilares[p.key];
      const seg = document.querySelector(`[data-avaliado="${p.key}"]`);
      seg.querySelectorAll('button').forEach(b => b.classList.toggle('active', (b.getAttribute('data-val') === 'sim') === !!st.avaliado));
      const body = document.querySelector(`[data-body="${p.key}"]`);
      body.style.opacity = st.avaliado ? '1' : '0.4';
      body.style.pointerEvents = st.avaliado ? 'auto' : 'none';
      const informadaInput = document.querySelector(`[data-informada="${p.key}"]`);
      informadaInput.value = st.notaInformada === null || st.notaInformada === undefined ? '' : st.notaInformada;
      refreshBadge(informadaInput, document.querySelector(`[data-badge="${p.key}"]`));
      document.querySelector(`[data-evidencia="${p.key}"]`).value = st.evidencia || '';
    });

    JORNADA.forEach(j => {
      const sel = document.querySelector(`[data-jornada="${j.key}"]`);
      sel.value = (avaliacao.jornada[j.key] && avaliacao.jornada[j.key].status) || 'realizada';
    });
  }

  // ---------------------------------------------------------------------
  // Finalizar — bloqueia se faltar campo obrigatório
  // ---------------------------------------------------------------------
  async function onFinalize() {
    // vinculoSousaId/vinculoSousaLabel vivem no topo da avaliação (não em
    // identificacao) — mescla para a validação compartilhada em COConfig.
    const faltando = validarCamposObrigatorios(Object.assign({}, avaliacao.identificacao, {
      vinculoSousaId: avaliacao.vinculoSousaId, vinculoSousaLabel: avaliacao.vinculoSousaLabel,
    }));
    if (faltando.length) {
      toast(`Preencha os campos obrigatórios antes de finalizar: ${faltando.join(', ')}.`);
      return;
    }
    if (!confirm('Finalizar e enviar esta avaliação? Depois de enviada, os dados ficam preservados como registro original e a avaliação segue para calibragem do Coordenador de Market Share.')) return;
    try {
      avaliacao = await api.finalizar(avaliacao.id);
      document.getElementById('formState').style.display = 'none';
      showLocked();
    } catch (err) {
      toast(err.message);
    }
  }

  bootstrap();
})();
