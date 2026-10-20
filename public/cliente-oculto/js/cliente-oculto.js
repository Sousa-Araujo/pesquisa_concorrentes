(async function () {
  'use strict';
  const authUser = await COAuth.requireLogin(['avaliador']);
  if (!authUser) return;

  const { PILARES, JORNADA, STATUS_JORNADA, escapeAttr, escapeHtml, bandFor, toneColorVar,
          regionalOptionsHtml, validarCamposObrigatorios, tipoTagHtml, PERGUNTA_ORIGEM, CANAIS_PREVIA,
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
    document.getElementById('reciboLink').href = 'recibo.html';
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
    buildPreviaFields();
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
    const host = document.getElementById('panel-previa');
    const old = document.getElementById('coFormBanner');
    if (old) old.remove();
    if (avaliacao.status === 'Em Preenchimento') return;
    const banner = document.createElement('div');
    banner.id = 'coFormBanner';
    banner.className = 'info-banner';
    banner.innerHTML = 'ℹ️ Esta avaliação já foi finalizada e está aguardando o Coordenador. Você ainda pode ajustar suas respostas até ele iniciar a calibragem.';
    host.parentNode.insertBefore(banner, host);
  }

  // Empreendimento e concorrente vêm do cadastro da Pesquisa de Concorrentes.
  // Visita Sousa: escolhe o empreendimento. Visita a concorrente: escolhe o
  // empreendimento Sousa de referência e o concorrente dele; se não estiver
  // na lista, marca "Outro" e digita o nome (o Coordenador liga depois).
  let concorrenteOutro = false;
  function applyTipoEmpreendimentoUI(tipo) {
    const conc = tipo === 'concorrente';
    const mostra = (id, sim) => { const e = document.getElementById(id); if (e) e.style.display = sim ? '' : 'none'; };
    mostra('cadConcField', conc);
    mostra('construtoraField', conc);
    mostra('empreendimentoField', conc && concorrenteOutro);
    const rotulo = document.querySelector('[data-cad-emp-label]');
    if (rotulo) rotulo.textContent = conc ? 'Empreendimento Sousa Araujo de referência' : 'Empreendimento';
    const empLabel = document.querySelector('#empreendimentoField label');
    if (empLabel) empLabel.innerHTML = 'Nome do empreendimento concorrente <span class="required-mark">*</span>';
  }

  let cadastroEmps = null;
  async function carregarCadastroEmps() {
    if (!cadastroEmps) {
      try { cadastroEmps = await api.cadastroEmpreendimentos(); } catch (err) { cadastroEmps = []; }
    }
    return cadastroEmps;
  }

  async function preencherCadEmp() {
    const idz = avaliacao.identificacao;
    const sel = document.querySelector('[data-cad-emp]');
    if (!sel) return;
    const reg = document.querySelector('[data-idfield="regional"]').value;
    const lista = (await carregarCadastroEmps()).filter(e => !reg || e.regional === reg);
    sel.innerHTML = `<option value="">${reg ? 'Selecione…' : 'Escolha a regional primeiro'}</option>` +
      lista.map(e => `<option value="${e.id}">${escapeHtml(e.nome)} — ${escapeHtml(e.cidade)}</option>`).join('');
    sel.disabled = !reg;
    sel.value = idz.idEmpreendimento && lista.some(e => e.id === idz.idEmpreendimento) ? String(idz.idEmpreendimento) : '';
    const ajuda = document.querySelector('[data-cad-emp-help]');
    if (ajuda) {
      // Avaliações antigas guardavam só o nome digitado.
      const antigo = !idz.idEmpreendimento && tipoEmpreendimento === 'sousa' && idz.empreendimento;
      ajuda.textContent = antigo ? `Registro antigo: "${idz.empreendimento}". Escolha o empreendimento na lista.` : '';
    }
    if (tipoEmpreendimento === 'concorrente') await preencherCadConc();
  }

  async function preencherCadConc() {
    const idz = avaliacao.identificacao;
    const sel = document.querySelector('[data-cad-conc]');
    if (!sel) return;
    if (!idz.idEmpreendimento) {
      sel.innerHTML = '<option value="">Escolha o empreendimento Sousa primeiro</option>';
      sel.disabled = true;
      return;
    }
    let lista = [];
    try { lista = await api.cadastroConcorrentes(idz.idEmpreendimento); } catch (err) { lista = []; }
    sel.disabled = false;
    sel.innerHTML = '<option value="">Selecione…</option>' +
      lista.map(c => `<option value="${c.id}">${escapeHtml(c.nome)}</option>`).join('') +
      '<option value="outro">Outro — não está na lista</option>';
    sel.value = idz.idConcorrente ? String(idz.idConcorrente) : (concorrenteOutro ? 'outro' : '');
  }

  // Salva já esperando a resposta: nome e regional vêm do cadastro no servidor.
  async function salvarCadastro(payload) {
    saving('Salvando…');
    try {
      avaliacao = await api.atualizarIdentificacao(avaliacao.id, payload);
      saving('Salvo ✓');
    } catch (err) {
      saving('Erro ao salvar');
      toast(err.message);
    }
    const idz = avaliacao.identificacao;
    const reg = document.querySelector('[data-idfield="regional"]');
    if (reg && idz.regional) reg.value = idz.regional;
    const nome = document.querySelector('[data-idfield="empreendimento"]');
    if (nome) nome.value = idz.empreendimento || '';
  }

  // Empreendimento, regional e avaliador ficam na Prévia (primeira etapa);
  // o resto da antiga Identificação fica em Condições.
  function buildIdFields() {
    const el = document.getElementById('idFields');
    const elPrevia = document.getElementById('previaIdFields');
    const raiz = document.getElementById('formState');
    el.innerHTML = '';
    elPrevia.innerHTML = '';

    const tipoDiv = document.createElement('div');
    tipoDiv.className = 'field';
    tipoDiv.style.gridColumn = '1 / -1';
    tipoDiv.innerHTML = `
      <label>Este é um empreendimento Sousa Araujo?</label>
      <div class="segmented eval-toggle" id="tipoEmpreendimentoToggle">
        <button type="button" data-val="sousa" class="active">✓ Sousa Araujo</button>
        <button type="button" data-val="concorrente">Concorrente</button>
      </div>
      <p class="field-help" style="margin-top:6px;">Se for um concorrente, escolha o empreendimento Sousa Araujo de referência e o concorrente. O comparativo no relatório é ligado automaticamente.</p>`;
    elPrevia.appendChild(tipoDiv);

    const regDiv = document.createElement('div');
    regDiv.className = 'field';
    regDiv.innerHTML = `<label>Regional <span class="required-mark">*</span></label><select data-idfield="regional">${regionalOptionsHtml('')}</select>`;
    elPrevia.appendChild(regDiv);

    const cadEmpDiv = document.createElement('div');
    cadEmpDiv.className = 'field';
    cadEmpDiv.id = 'cadEmpField';
    cadEmpDiv.innerHTML = `<label><span data-cad-emp-label>Empreendimento</span> <span class="required-mark">*</span></label>
      <select data-cad-emp></select><p class="field-help" data-cad-emp-help></p>`;
    elPrevia.appendChild(cadEmpDiv);

    const cadConcDiv = document.createElement('div');
    cadConcDiv.className = 'field';
    cadConcDiv.id = 'cadConcField';
    cadConcDiv.style.display = 'none';
    cadConcDiv.innerHTML = `<label>Concorrente <span class="required-mark">*</span></label>
      <select data-cad-conc></select>
      <p class="field-help">Não achou na lista? Escolha "Outro" e digite o nome. O Coordenador de Market Share liga ao cadastro na calibragem.</p>`;
    elPrevia.appendChild(cadConcDiv);

    const empField = makeSimpleField(ID_FIELDS_SIMPLE.find(f => f.key === 'empreendimento'));
    empField.id = 'empreendimentoField';
    empField.style.display = 'none';
    elPrevia.appendChild(empField);

    const construtoraDiv = document.createElement('div');
    construtoraDiv.className = 'field';
    construtoraDiv.id = 'construtoraField';
    construtoraDiv.style.display = 'none';
    construtoraDiv.innerHTML = `<label>Construtora responsável pelo concorrente</label><input type="text" placeholder="Ex.: COEVO" data-idfield="construtora">`;
    elPrevia.appendChild(construtoraDiv);

    elPrevia.appendChild(makeSimpleField(ID_FIELDS_SIMPLE.find(f => f.key === 'clienteOculto')));

    ID_FIELDS_SIMPLE.slice(1, 3).forEach(f => el.appendChild(makeSimpleField(f)));

    ID_FIELDS_SIMPLE.slice(4, 6).forEach(f => el.appendChild(makeSimpleField(f)));

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
      const novo = btn.getAttribute('data-val');
      if (novo === tipoEmpreendimento) return;
      tipoEmpreendimento = novo;
      concorrenteOutro = false;
      applyTipoEmpreendimentoUI(tipoEmpreendimento);
      const idEmp = avaliacao.identificacao.idEmpreendimento;
      // Trocou o tipo: o nome do empreendimento é refeito a partir do cadastro.
      const payload = { tipoEmpreendimento, idConcorrente: null };
      if (idEmp) payload.idEmpreendimento = idEmp;
      if (tipoEmpreendimento === 'concorrente') payload.empreendimento = '';
      salvarCadastro(payload).then(preencherCadEmp);
    });

    // Empreendimento e concorrente do cadastro
    raiz.querySelector('[data-idfield="regional"]').addEventListener('change', async () => {
      await preencherCadEmp();
      const sel = raiz.querySelector('[data-cad-emp]');
      if (avaliacao.identificacao.idEmpreendimento && !sel.value) {
        await salvarCadastro({ idEmpreendimento: null, idConcorrente: null });
        await preencherCadEmp();
      }
    });
    raiz.querySelector('[data-cad-emp]').addEventListener('change', async (e) => {
      concorrenteOutro = false;
      await salvarCadastro({ idEmpreendimento: e.target.value || null, idConcorrente: null });
      applyTipoEmpreendimentoUI(tipoEmpreendimento);
      await preencherCadEmp();
    });
    raiz.querySelector('[data-cad-conc]').addEventListener('change', async (e) => {
      if (e.target.value === 'outro') {
        concorrenteOutro = true;
        await salvarCadastro({ idConcorrente: null, empreendimento: '' });
        applyTipoEmpreendimentoUI(tipoEmpreendimento);
        const nome = raiz.querySelector('[data-idfield="empreendimento"]');
        if (nome) nome.focus();
        return;
      }
      concorrenteOutro = false;
      await salvarCadastro({ idConcorrente: e.target.value || null });
      applyTipoEmpreendimentoUI(tipoEmpreendimento);
    });

    // wire simple text/date/time fields
    raiz.querySelectorAll('[data-idfield]').forEach(input => {
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
  // Atendimento prévio online — contatos antes da visita. Pode existir sem
  // a visita ("só prévia"): aí os pilares e a jornada saem do formulário.
  // ---------------------------------------------------------------------
  const PREVIA_DATAS = [
    { key: 'previaContatoEm', label: 'Data e horário do contato', help: 'Quando você mandou a primeira mensagem ou ligou.' },
    { key: 'previaPrimeiroRetornoEm', label: 'Primeiro retorno (data e horário)', help: 'A primeira resposta, de uma pessoa ou de um robô/IA.' },
    { key: 'previaSegundoContatoEm', label: 'Contato do corretor (data e horário)', help: 'Quando um corretor falou com você.' },
    { key: 'previaAgendamentoEm', label: 'Visita agendada para (data e horário)', help: 'A data e o horário marcados no decorado/PDV.' },
  ];
  function buildPreviaFields() {
    const el = document.getElementById('previaFields');
    if (!el) return;
    el.innerHTML = `
      <div class="field">
        <label>Canal do contato</label>
        <select data-previa="previaCanal"><option value="">Selecione…</option>${CANAIS_PREVIA.map(c => `<option value="${escapeAttr(c)}">${escapeHtml(c)}</option>`).join('')}</select>
      </div>
      ${PREVIA_DATAS.map(f => `
      <div class="field">
        <label>${f.label}${f.key === 'previaPrimeiroRetornoEm' ? ' <span class="required-mark">*</span>' : ''}</label>
        <input type="datetime-local" data-previa="${f.key}">
        <p class="field-help">${f.help}</p>
        ${f.key === 'previaPrimeiroRetornoEm' ? `
        <div class="segmented small" id="previaRetornoPor" style="margin-top:6px;">
          <button type="button" data-val="pessoa">Pessoa</button>
          <button type="button" data-val="ia">Robô / IA</button>
        </div>` : ''}
      </div>`).join('')}
      <div class="field" style="grid-column:1 / -1;">
        <label>Observações da prévia</label>
        <textarea rows="2" data-previa="previaObservacoes" placeholder="Ex.: respondeu só no dia seguinte; pediu para ligar; não ofereceu horário."></textarea>
      </div>
      <div class="field" style="grid-column:1 / -1;">
        <label class="check-line"><input type="checkbox" data-somente-previa> Só prévia: a visita ao decorado/PDV não foi realizada</label>
        <p class="field-help">Marque quando o contato online foi feito mas a visita não aconteceu. Os pilares e a jornada saem do formulário e você já pode finalizar.</p>
      </div>`;
    el.querySelectorAll('[data-previa]').forEach(inp => {
      const salvar = () => saveIdentificacao({ [inp.getAttribute('data-previa')]: inp.value }, inp.getAttribute('data-previa'));
      inp.addEventListener('change', salvar);
      if (inp.tagName === 'TEXTAREA') inp.addEventListener('blur', salvar);
    });
    const porSeg = document.getElementById('previaRetornoPor');
    porSeg.addEventListener('click', (e) => {
      const btn = e.target.closest('button'); if (!btn) return;
      const jaAtivo = btn.classList.contains('active');
      porSeg.querySelectorAll('button').forEach(b => b.classList.remove('active'));
      if (!jaAtivo) btn.classList.add('active');
      saveIdentificacao({ previaPrimeiroRetornoPor: jaAtivo ? '' : btn.getAttribute('data-val') });
    });
    el.querySelector('[data-somente-previa]').addEventListener('change', (e) => {
      aplicarSomentePrevia(e.target.checked);
      saveIdentificacao({ somentePrevia: e.target.checked });
    });
  }

  // Só prévia: pilares e jornada saem do fluxo de etapas (e da validação).
  function aplicarSomentePrevia(sim) {
    document.querySelectorAll('#pillarPanels > .panel, #panel-jornada').forEach(p => p.classList.toggle('ms-step-fora', sim));
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
          <div class="fotos-pilar">
            <div class="fotos-head">
              <label>Fotos de comprovação <span class="field-help" style="display:inline;">(opcional — ex.: parede mofada, decorado desorganizado, sujeira)</span></label>
              <label class="btn btn-ghost btn-sm fotos-add">+ Adicionar foto<input type="file" accept="image/*" multiple hidden data-foto-input="${p.key}"></label>
            </div>
            <div class="fotos-grid" data-fotos-grid="${p.key}"></div>
          </div>
        </div>
      `;
      wrap.appendChild(panel);

      // Antes da avaliação da recepção: ela seguiu o protocolo de perguntar a origem do cliente?
      if (p.key === 'recepcao') {
        const perg = document.createElement('div');
        perg.className = 'field';
        perg.style.marginBottom = '12px';
        perg.innerHTML = `<label>A recepção perguntou como você ficou sabendo do empreendimento?</label>
          <div class="segmented" id="perguntaOrigem">${Object.entries(PERGUNTA_ORIGEM).map(([k, v]) => `<button type="button" data-val="${k}">${v.label}</button>`).join('')}</div>
          <p class="field-help">Protocolo da recepção: perguntar a origem do cliente para registrar na ferramenta.</p>`;
        panel.insertBefore(perg, panel.querySelector('.criteria-label'));
        const segPerg = perg.querySelector('#perguntaOrigem');
        segPerg.addEventListener('click', (e) => {
          const btn = e.target.closest('button'); if (!btn) return;
          segPerg.querySelectorAll('button').forEach(b => b.classList.toggle('active', b === btn));
          saveIdentificacao({ recepcaoPerguntouOrigem: btn.getAttribute('data-val') });
        });
      }

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

      panel.querySelector(`[data-foto-input="${p.key}"]`).addEventListener('change', (e) => {
        enviarFotos(p.key, [...e.target.files]);
        e.target.value = '';
      });

      const informadaInput = panel.querySelector(`[data-informada="${p.key}"]`);
      const badge = panel.querySelector(`[data-badge="${p.key}"]`);
      informadaInput.addEventListener('input', () => refreshBadge(informadaInput, badge));
      informadaInput.addEventListener('blur', () => savePilarInformada(p.key));
      panel.querySelector(`[data-evidencia="${p.key}"]`).addEventListener('blur', () => savePilarInformada(p.key));
    });
  }

  // ---------------------------------------------------------------------
  // Fotos de comprovação por pilar: reduzidas no aparelho antes de enviar
  // ---------------------------------------------------------------------
  function reduzirFoto(arquivo, lado, qualidade) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(arquivo);
      const img = new Image();
      img.onload = () => {
        const escala = Math.min(1, lado / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * escala); c.height = Math.round(img.height * escala);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL('image/jpeg', qualidade));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Não foi possível ler a foto.')); };
      img.src = url;
    });
  }
  async function enviarFotos(pilarKey, arquivos) {
    for (const arq of arquivos) {
      saving('Enviando foto…');
      try {
        let imagem = await reduzirFoto(arq, 1600, 0.8);
        if (imagem.length > 900000) imagem = await reduzirFoto(arq, 1280, 0.65);
        avaliacao.fotos = await api.adicionarFoto(avaliacao.id, { pilarKey, imagem });
        saving('Foto enviada ✓');
      } catch (err) {
        saving('Erro ao enviar foto');
        toast(err.message);
      }
      desenharFotos();
    }
  }
  function desenharFotos() {
    PILARES.forEach(p => {
      const grid = document.querySelector(`[data-fotos-grid="${p.key}"]`);
      if (!grid) return;
      const lista = (avaliacao.fotos || []).filter(f => f.pilarKey === p.key);
      grid.innerHTML = lista.map(f => `
        <figure class="foto-item">
          <a href="${escapeAttr(f.url)}" target="_blank" rel="noopener"><img src="${escapeAttr(f.url)}" alt="" loading="lazy"></a>
          <input type="text" placeholder="Legenda (opcional)" value="${escapeAttr(f.legenda || '')}" data-legenda-foto="${f.id}">
          <button type="button" class="btn btn-ghost btn-sm" data-remover-foto="${f.id}">Remover</button>
        </figure>`).join('');
    });
  }
  document.addEventListener('change', async (e) => {
    const fotoId = e.target.getAttribute && e.target.getAttribute('data-legenda-foto');
    if (!fotoId) return;
    try { avaliacao.fotos = await api.legendaFoto(avaliacao.id, fotoId, e.target.value); saving('Salvo ✓'); }
    catch (err) { toast(err.message); }
  });
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest && e.target.closest('[data-remover-foto]');
    if (!btn) return;
    if (!confirm('Remover esta foto?')) return;
    try { avaliacao.fotos = await api.removerFoto(avaliacao.id, btn.getAttribute('data-remover-foto')); desenharFotos(); }
    catch (err) { toast(err.message); }
  });

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
    concorrenteOutro = tipoEmpreendimento === 'concorrente' && !idz.idConcorrente && !!idz.empreendimento;
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

    applyTipoEmpreendimentoUI(tipoEmpreendimento);
    preencherCadEmp();

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

    desenharFotos();

    // Prévia online e pergunta da recepção
    document.querySelectorAll('[data-previa]').forEach(inp => { inp.value = idz[inp.getAttribute('data-previa')] || ''; });
    document.querySelectorAll('#previaRetornoPor button').forEach(b => b.classList.toggle('active', b.getAttribute('data-val') === idz.previaPrimeiroRetornoPor));
    const soPrevia = document.querySelector('[data-somente-previa]');
    if (soPrevia) soPrevia.checked = !!idz.somentePrevia;
    aplicarSomentePrevia(!!idz.somentePrevia);
    document.querySelectorAll('#perguntaOrigem button').forEach(b => b.classList.toggle('active', b.getAttribute('data-val') === idz.recepcaoPerguntouOrigem));
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
