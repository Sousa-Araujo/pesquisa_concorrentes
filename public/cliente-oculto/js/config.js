// Config compartilhada entre as telas do Cliente Oculto e do Coordenador de Market Share.
// Mesmo vocabulário de pilares/jornada/gravidade/régua da versão 1 — preservado.
(function (global) {
  'use strict';

  const PILARES = [
    { key: 'recepcao', nome: 'Atendimento da Recepção', n: 1,
      aspectos: ['Acolhimento','Cordialidade','Simpatia','Postura','Iniciativa','Abordagem inicial','Coleta de informações','Triagem','Direcionamento ao corretor'] },
    { key: 'corretorAtend', nome: 'Atendimento do Corretor', n: 2,
      aspectos: ['Postura','Cordialidade','Comunicação','Escuta','Investigação de necessidades','Condução','Personalização','Ética','Clareza','Experiência proporcionada'] },
    { key: 'pdv', nome: 'Qualidade e Estrutura do PDV', n: 3,
      aspectos: ['Estacionamento','Conservação','Limpeza','Organização','Comunicação visual','Conforto','Funcionalidade','Decorado','Maquete','Materiais expostos'] },
    { key: 'materiais', nome: 'Materiais de Marketing', n: 4,
      aspectos: ['Panfletos','Folders','Books','Plantas','Apresentações','Materiais digitais','Materiais impressos','Materiais entregues ao cliente'] },
    { key: 'negociacao', nome: 'Capacidade de Negociação do Corretor', n: 5,
      aspectos: ['Apresentação das condições','Argumentação','Tratamento de objeções','Apresentação de descontos','Alternativas comerciais','Tentativa de fechamento','Formalização da proposta','Próximo passo'] },
    { key: 'conhecimento', nome: 'Conhecimento Técnico do Empreendimento e Políticas de Venda', n: 6,
      aspectos: ['Produto','Tipologias','Metragens','Áreas comuns','Diferenciais','Acabamento','Disponibilidade','Prazo de entrega','Financiamento','Ato','Pré-chaves','Políticas de venda','Campanhas'] },
  ];

  const JORNADA = [
    { key: 'recepcaoTriagem', label: 'Recepção + Triagem' },
    { key: 'apresentacaoProduto', label: 'Apresentação do Produto' },
    { key: 'decoradoMaquete', label: 'Decorado / Maquete' },
    { key: 'simulacao', label: 'Simulação' },
    { key: 'negociacaoEtapa', label: 'Negociação' },
    { key: 'fechamento', label: 'Fechamento / Próximo Passo' },
    { key: 'followup', label: 'Follow-up' },
  ];

  const STATUS_JORNADA = {
    realizada:      { label: 'Realizada',     icon: '✔', color: 'var(--good)' },
    parcial:        { label: 'Parcial',       icon: '◐', color: 'var(--warning)' },
    nao_realizada:  { label: 'Não realizada', icon: '✖', color: 'var(--critical)' },
    na:             { label: 'Não aplicável', icon: '–', color: 'var(--text-muted)' },
  };

  const GRAVIDADES = {
    baixa:    { label: 'Baixa',    icon: '🟢', color: 'var(--good)',     tint: 'var(--good-tint)',     order: 1 },
    moderada: { label: 'Moderada', icon: '🟡', color: 'var(--warning)',  tint: 'var(--warning-tint)',  order: 2 },
    alta:     { label: 'Alta',     icon: '🟠', color: 'var(--serious)',  tint: 'var(--serious-tint)',  order: 3 },
    critica:  { label: 'Crítica',  icon: '🔴', color: 'var(--critical)', tint: 'var(--critical-tint)', order: 4 },
  };

  const REGIONAIS = ['RVP', 'RAT', 'RGC', 'RGSP'];
  const REGIONAL_LABELS = {
    RVP: 'Regional do Vale do Paraíba',
    RAT: 'Regional do Alto Tietê',
    RGSP: 'Regional da Grande São Paulo',
    RGC: 'Regional da Grande Campinas',
  };
  function regionalOptionsHtml(selected) {
    return `<option value="">Selecione…</option>` + REGIONAIS.map(r =>
      `<option value="${r}" ${r === selected ? 'selected' : ''}>${r} — ${REGIONAL_LABELS[r]}</option>`
    ).join('');
  }

  const MESES_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  // Formata a data da visita como "Mês/Ano" (ex.: "Ago/2026") para exibição —
  // usado no comparativo e nas listas para deixar o período visualmente claro.
  function mesReferencia(dataVisita) {
    if (!dataVisita) return '';
    const partes = dataVisita.split('-');
    if (partes.length < 2) return '';
    const idx = parseInt(partes[1], 10) - 1;
    if (isNaN(idx) || idx < 0 || idx > 11) return '';
    return `${MESES_PT[idx]}/${partes[0]}`;
  }

  const STATUS_AVALIACAO = {
    'Em Preenchimento':      { tone: 'tone-muted',  icon: '✎' },
    'Aguardando Calibragem': { tone: 'tone-abaixo', icon: '⏳' },
    'Concluída':             { tone: 'tone-bom',    icon: '✔' },
  };

  function bandFor(nota) {
    if (nota === null || nota === undefined || isNaN(nota)) return { label: 'Não avaliado', tone: 'tone-muted' };
    if (nota >= 9.5) return { label: 'Excepcional', tone: 'tone-excepcional' };
    if (nota >= 8.0) return { label: 'Muito bom', tone: 'tone-bom' };
    if (nota >= 7.0) return { label: 'Adequado', tone: 'tone-adequado' };
    if (nota >= 5.0) return { label: 'Abaixo do esperado', tone: 'tone-abaixo' };
    return { label: 'Crítico', tone: 'tone-critico' };
  }
  function toneColorVar(tone) {
    return {
      'tone-excepcional': 'var(--excep-deep)', 'tone-bom': 'var(--good)', 'tone-adequado': 'var(--neutral-band)',
      'tone-abaixo': 'var(--warning)', 'tone-critico': 'var(--critical)', 'tone-muted': 'var(--text-muted)',
    }[tone];
  }
  function toneTintVar(tone) {
    return {
      'tone-excepcional': 'var(--excep-tint)', 'tone-bom': 'var(--good-tint)', 'tone-adequado': 'var(--neutral-tint)',
      'tone-abaixo': 'var(--warning-tint)', 'tone-critico': 'var(--critical-tint)', 'tone-muted': 'var(--muted-tint)',
    }[tone];
  }

  function pilarLabel(key) {
    const p = PILARES.find(p => p.key === key);
    if (p) return p.nome;
    if (key === 'jornada') return 'Jornada Comercial';
    return 'Outro';
  }

  function tipoTagHtml(tipo) {
    return tipo === 'concorrente' ? '<span class="tipo-tag tipo-concorrente">Concorrente</span>' : '';
  }

  // Campos de identificação obrigatórios para o Cliente Oculto conseguir Finalizar —
  // validados no cliente (bloqueando o botão) e espelhados no relatório/admin.
  const CAMPOS_OBRIGATORIOS_LABELS = {
    empreendimento: 'Empreendimento', dataVisita: 'Data da visita',
    clienteOculto: 'Cliente oculto (avaliador)', corretor: 'Corretor', regional: 'Regional',
    previaPrimeiroRetornoEm: 'Primeiro retorno (prévia online)',
  };
  // Só prévia (a visita ao decorado não aconteceu): não há data da visita nem
  // corretor do PDV, mas a prévia precisa ter pelo menos o primeiro contato.
  const CAMPOS_OBRIGATORIOS_SO_PREVIA = {
    empreendimento: 'Empreendimento', clienteOculto: 'Cliente oculto (avaliador)', regional: 'Regional',
    previaContatoEm: 'Data e horário do contato (prévia online)',
    previaPrimeiroRetornoEm: 'Primeiro retorno (prévia online)',
  };
  function validarCamposObrigatorios(identificacao) {
    const faltando = [];
    const campos = identificacao && identificacao.somentePrevia ? CAMPOS_OBRIGATORIOS_SO_PREVIA : CAMPOS_OBRIGATORIOS_LABELS;
    Object.entries(campos).forEach(([key, label]) => {
      const v = identificacao ? identificacao[key] : null;
      if (!v || !String(v).trim()) faltando.push(label);
    });
    // Empreendimento e concorrente vêm do cadastro da Pesquisa de Concorrentes.
    if (identificacao && !identificacao.idEmpreendimento) {
      faltando.push(identificacao.tipoEmpreendimento === 'concorrente'
        ? 'Empreendimento Sousa Araujo de referência' : 'Empreendimento (escolha na lista)');
    }
    return faltando;
  }

  // -------------------------------------------------------------------------
  // Fotos de comprovação (somente leitura: calibragem e relatório)
  // -------------------------------------------------------------------------
  function fotosHtml(fotos, pilarKey) {
    const lista = (fotos || []).filter(f => f.pilarKey === pilarKey);
    if (!lista.length) return '';
    return `<div class="fotos-grid fotos-leitura">${lista.map(f => `
      <figure class="foto-item"><a href="${escapeAttr(f.url)}" target="_blank" rel="noopener"><img src="${escapeAttr(f.url)}" alt="${escapeAttr(f.legenda || 'Foto da visita')}" loading="lazy"></a>
      ${f.legenda ? `<figcaption>${escapeHtml(f.legenda)}</figcaption>` : ''}</figure>`).join('')}</div>`;
  }

  // -------------------------------------------------------------------------
  // Pergunta da recepção e atendimento prévio online
  // -------------------------------------------------------------------------
  const PERGUNTA_ORIGEM = {
    sim: { label: 'Sim, perguntou', curto: 'Sim', tone: 'tone-bom' },
    nao: { label: 'Não perguntou', curto: 'Não', tone: 'tone-critico' },
    na: { label: 'Não houve recepção', curto: 'Não houve recepção', tone: 'tone-muted' },
  };
  const CANAIS_PREVIA = ['WhatsApp', 'Site / formulário', 'Instagram / Facebook', 'Portal imobiliário', 'Telefone', 'E-mail', 'Outro'];

  // "AAAA-MM-DDTHH:MM" (horário local) → minutos desde 1970, sem fuso.
  function minutosDe(valor) {
    const m = String(valor || '').match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
    if (!m) return null;
    return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) / 60000;
  }
  function formatarDataHora(valor) {
    const m = String(valor || '').match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
    return m ? `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}` : '';
  }
  function formatarDuracao(min) {
    if (min === null || min === undefined) return '—';
    if (min < 0) return 'data anterior ao contato';
    if (min < 60) return `${Math.round(min)} min`;
    const h = Math.floor(min / 60), r = Math.round(min % 60);
    if (h < 24) return r ? `${h} h ${r} min` : `${h} h`;
    const d = Math.floor(h / 24), hh = h % 24;
    return hh ? `${d} d ${hh} h` : `${d} d`;
  }
  // Tempos de atendimento contados a partir do contato do cliente oculto.
  function indicadoresPrevia(idz) {
    const ini = minutosDe(idz && idz.previaContatoEm);
    const ate = (v) => { const f = minutosDe(v); return ini === null || f === null ? null : f - ini; };
    return {
      temPrevia: !!(idz && (idz.previaContatoEm || idz.previaCanal)),
      primeiroRetorno: ate(idz && idz.previaPrimeiroRetornoEm),
      segundoContato: ate(idz && idz.previaSegundoContatoEm),
      agendamento: ate(idz && idz.previaAgendamentoEm),
    };
  }

  // -------------------------------------------------------------------------
  // Máscaras — moeda BRL, área (m²) e percentual
  // -------------------------------------------------------------------------
  const currencyFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

  // Digitação "estilo caixa eletrônico": cada dígito entra pela direita, os
  // últimos dois viram centavos. Retorna {centavos, display}.
  function moneyMaskFromDigits(rawDigits) {
    const digits = (rawDigits || '').replace(/\D/g, '');
    if (!digits) return { centavos: null, display: '' };
    const centavos = parseInt(digits, 10);
    return { centavos, display: currencyFmt.format(centavos / 100) };
  }
  function centavosToDisplay(centavos) {
    if (centavos === null || centavos === undefined || isNaN(centavos)) return '';
    return currencyFmt.format(centavos / 100);
  }

  // Área — aceita dígitos e vírgula; formata como "45 m²" / "58,5 m²".
  function areaMaskFromInput(raw) {
    const cleaned = (raw || '').replace(/[^\d,]/g, '');
    if (!cleaned) return { valor: null, display: '' };
    const normalized = cleaned.replace(',', '.');
    const valor = parseFloat(normalized);
    if (isNaN(valor)) return { valor: null, display: '' };
    const display = `${cleaned.replace(/,+/g, ',')} m²`;
    return { valor, display };
  }

  // Percentual — aceita dígitos e vírgula; formata como "5%" / "3,5%".
  function percentMaskFromInput(raw) {
    const cleaned = (raw || '').replace(/[^\d,]/g, '');
    if (!cleaned) return { valor: null, display: '' };
    const normalized = cleaned.replace(',', '.');
    const valor = parseFloat(normalized);
    if (isNaN(valor)) return { valor: null, display: '' };
    return { valor, display: `${cleaned}%` };
  }

  function escapeHtml(s) { return (s || '').toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function escapeAttr(s) { return (s || '').toString().replace(/&/g, '&amp;').replace(/"/g, '&quot;'); }

  global.COConfig = {
    PILARES, JORNADA, STATUS_JORNADA, GRAVIDADES, REGIONAIS, REGIONAL_LABELS, STATUS_AVALIACAO,
    CAMPOS_OBRIGATORIOS_LABELS,
    bandFor, toneColorVar, toneTintVar, pilarLabel, tipoTagHtml,
    regionalOptionsHtml, mesReferencia, validarCamposObrigatorios,
    PERGUNTA_ORIGEM, CANAIS_PREVIA, formatarDataHora, formatarDuracao, indicadoresPrevia, fotosHtml,
    moneyMaskFromDigits, centavosToDisplay, areaMaskFromInput, percentMaskFromInput,
    escapeHtml, escapeAttr,
  };
})(window);

// Diálogo do sistema (public/design/dialogo.js) no lugar do confirm()/alert()
// do navegador; o do navegador fica de reserva se o script não carregar.
window.coConfirmar = function (mensagem, o) {
  o = Object.assign({}, o || {}, { mensagem: mensagem });
  return window.MSDialogo ? window.MSDialogo.confirmar(o) : Promise.resolve(window.confirm(mensagem));
};
window.coAvisar = function (mensagem, titulo) {
  if (window.MSDialogo) return window.MSDialogo.avisar({ mensagem: mensagem, titulo: titulo });
  window.alert(mensagem);
  return Promise.resolve();
};
