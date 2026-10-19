// Recibo de pagamento do Cliente Oculto (avaliador), no modelo oficial da Sousa Araujo.
// O avaliador preenche os dados pessoais e do PIX, a quantidade de pesquisas e o valor
// unitário (o total é calculado), assina no quadro e envia; o Coordenador de Market
// Share vê o mesmo recibo e marca como pago. Empreendimento, data e hora vêm da avaliação.
(async function () {
  'use strict';
  const authUser = await COAuth.requireLogin(['avaliador', 'coordenador']);
  if (!authUser) return;

  const { escapeHtml, moneyMaskFromDigits, centavosToDisplay, formatarDataHora } = window.COConfig;
  const api = window.CoworkApi;
  const ehAvaliador = authUser.papel === 'avaliador' || authUser.papel === 'admin';
  const ehCoordenador = authUser.papel === 'coordenador' || authUser.papel === 'admin';

  function toast(msg) {
    const t = document.getElementById('toast');
    if (!t) return alert(msg);
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toast._h); toast._h = setTimeout(() => t.classList.remove('show'), 3800);
  }

  const id = new URLSearchParams(location.search).get('id');
  if (!id) { document.getElementById('reciboCarregando').textContent = 'Avaliação não informada.'; return; }
  document.getElementById('reciboId').textContent = id;
  document.getElementById('voltarLink').href = authUser.papel === 'avaliador'
    ? `cliente-oculto.html?id=${encodeURIComponent(id)}` : `coordenador.html?id=${encodeURIComponent(id)}`;

  let dados;
  try { dados = await api.obterRecibo(id); }
  catch (err) { document.getElementById('reciboCarregando').textContent = `Não foi possível abrir o recibo (${err.message}).`; return; }
  document.getElementById('reciboCarregando').style.display = 'none';
  document.getElementById('reciboConteudo').style.display = '';

  // ---------------------------------------------------------------------
  // Valor por extenso (reais e centavos)
  // ---------------------------------------------------------------------
  const UN = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze',
    'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
  const DEZ = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
  const CEM = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];
  function ate999(n) {
    if (n === 100) return 'cem';
    const c = Math.floor(n / 100), r = n % 100, partes = [];
    if (c) partes.push(CEM[c]);
    if (r < 20) { if (r) partes.push(UN[r]); }
    else { partes.push(DEZ[Math.floor(r / 10)] + (r % 10 ? ' e ' + UN[r % 10] : '')); }
    return partes.join(' e ');
  }
  function inteiroPorExtenso(n) {
    if (n === 0) return 'zero';
    const mil = Math.floor(n / 1000), resto = n % 1000, partes = [];
    if (mil) partes.push(mil === 1 ? 'mil' : ate999(mil) + ' mil');
    if (resto) partes.push(ate999(resto));
    return partes.join(resto && (resto < 100 || resto % 100 === 0) ? ' e ' : ' ');
  }
  function valorPorExtenso(centavos) {
    if (!centavos) return '';
    const reais = Math.floor(centavos / 100), cents = centavos % 100, partes = [];
    if (reais) partes.push(inteiroPorExtenso(reais) + (reais === 1 ? ' real' : ' reais'));
    if (cents) partes.push(inteiroPorExtenso(cents) + (cents === 1 ? ' centavo' : ' centavos'));
    return partes.join(' e ');
  }

  // ---------------------------------------------------------------------
  // Formatação
  // ---------------------------------------------------------------------
  const campo = (k) => document.querySelector(`[data-r="${k}"]`);
  const cpfMascara = (v) => {
    const d = String(v || '').replace(/\D/g, '').slice(0, 11);
    return d.replace(/^(\d{3})(\d)/, '$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1-$2');
  };
  const telMascara = (v) => {
    const d = String(v || '').replace(/\D/g, '').slice(0, 11);
    if (d.length <= 2) return d ? `(${d}` : '';
    if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  };
  function cpfValido(c) {
    if (!/^\d{11}$/.test(c) || /^(\d)\1{10}$/.test(c)) return false;
    const dig = (n) => { let s = 0; for (let i = 0; i < n; i++) s += +c[i] * (n + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
    return dig(9) === +c[9] && dig(10) === +c[10];
  }
  const TIPO_PIX = { cpf: 'CPF', celular: 'Celular', email: 'E-mail', aleatoria: 'Chave aleatória' };
  const dataBR = (d) => d ? new Date(d).toLocaleDateString('pt-BR') : '';
  const visitaBR = (d) => { const m = String(d || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : ''; };
  const ou = (v, alt) => v ? escapeHtml(String(v)) : `<span style="color:#8f8d85">${alt}</span>`;

  // Empreendimento, data e hora da visita vêm da avaliação (na "só prévia", a data do contato).
  function visita() {
    const a = dados.avaliacao;
    const previa = a.somentePrevia && a.previaContatoEm ? formatarDataHora(a.previaContatoEm).split(' ') : null;
    return {
      empreendimento: a.empreendimento || '',
      data: previa ? previa[0] : visitaBR(a.dataVisita),
      hora: previa ? previa[1] : (a.horario || ''),
    };
  }

  // ---------------------------------------------------------------------
  // Formulário
  // ---------------------------------------------------------------------
  let valorUnitario = null;
  const quantidade = () => { const n = parseInt(campo('quantidadePesquisas').value, 10); return n > 0 ? n : null; };
  const total = () => (quantidade() && valorUnitario ? quantidade() * valorUnitario : null);
  function atualizarTotal() { document.getElementById('valorTotal').value = total() ? centavosToDisplay(total()) : ''; }

  function preencher() {
    const r = dados.recibo;
    campo('nomeCompleto').value = r.nomeCompleto || dados.avaliacao.clienteOculto || '';
    campo('telefone').value = telMascara(r.telefone);
    campo('cpf').value = cpfMascara(r.cpf);
    campo('chavePixTipo').value = r.chavePixTipo || '';
    campo('chavePix').value = r.chavePix || '';
    campo('quantidadePesquisas').value = r.quantidadePesquisas || 1;
    valorUnitario = r.valorUnitarioCentavos;
    campo('valorUnitario').value = centavosToDisplay(valorUnitario);
    atualizarTotal();
    const v = visita();
    document.getElementById('dadosVisita').innerHTML =
      `<div><dt>Empreendimento visitado</dt><dd>${ou(v.empreendimento, '—')}</dd></div>` +
      `<div><dt>Data da visita</dt><dd>${ou(v.data, '—')}</dd></div>` +
      `<div><dt>Hora da visita</dt><dd>${ou(v.hora, '—')}</dd></div>`;
    document.getElementById('reciboForm').style.display = ehAvaliador ? '' : 'none';
    if (!ehAvaliador) document.querySelector('.recibo-layout').style.gridTemplateColumns = 'minmax(0, 1fr)';
  }

  function payload() {
    return {
      nomeCompleto: campo('nomeCompleto').value,
      telefone: campo('telefone').value.replace(/\D/g, ''),
      cpf: campo('cpf').value.replace(/\D/g, ''),
      chavePixTipo: campo('chavePixTipo').value,
      chavePix: campo('chavePix').value,
      quantidadePesquisas: quantidade(),
      valorUnitarioCentavos: valorUnitario,
    };
  }

  let timer;
  function salvar() {
    clearTimeout(timer);
    document.getElementById('reciboSalvo').textContent = 'Salvando…';
    timer = setTimeout(async () => {
      try {
        dados = await api.salvarRecibo(id, payload());
        document.getElementById('reciboSalvo').textContent = 'Salvo ✓';
        desenharDoc();
      } catch (err) {
        document.getElementById('reciboSalvo').textContent = 'Erro ao salvar';
        toast(err.message);
      }
    }, 400);
  }

  campo('cpf').addEventListener('input', (e) => {
    e.target.value = cpfMascara(e.target.value);
    const d = e.target.value.replace(/\D/g, '');
    document.getElementById('cpfAviso').textContent = d.length === 11 && !cpfValido(d) ? 'CPF inválido — confira os números.' : '';
  });
  campo('telefone').addEventListener('input', (e) => { e.target.value = telMascara(e.target.value); });
  campo('valorUnitario').addEventListener('input', (e) => {
    const { centavos, display } = moneyMaskFromDigits(e.target.value);
    valorUnitario = centavos; e.target.value = display; atualizarTotal();
  });
  campo('quantidadePesquisas').addEventListener('input', atualizarTotal);
  ['nomeCompleto', 'telefone', 'cpf', 'chavePixTipo', 'chavePix', 'quantidadePesquisas', 'valorUnitario'].forEach(k => {
    campo(k).addEventListener('change', salvar);
  });

  // ---------------------------------------------------------------------
  // Quadro de assinatura (dedo ou mouse)
  // ---------------------------------------------------------------------
  const canvas = document.getElementById('assinaturaCanvas');
  const ctx = canvas.getContext('2d');
  let desenhou = false;
  function ajustarCanvas() {
    const r = canvas.getBoundingClientRect();
    canvas.width = Math.round(r.width * 2); canvas.height = Math.round(r.height * 2);
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#111111';
    desenhou = false;
  }
  ajustarCanvas();
  let desenhando = false;
  const ponto = (e) => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  canvas.addEventListener('pointerdown', (e) => {
    if (campo('cpf').disabled) return;
    desenhando = true; canvas.setPointerCapture(e.pointerId);
    const [x, y] = ponto(e); ctx.beginPath(); ctx.moveTo(x, y);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!desenhando) return;
    const [x, y] = ponto(e); ctx.lineTo(x, y); ctx.stroke(); desenhou = true;
  });
  canvas.addEventListener('pointerup', () => { desenhando = false; });
  document.getElementById('limparAssinatura').addEventListener('click', ajustarCanvas);

  document.getElementById('assinarBtn').addEventListener('click', async () => {
    if (!desenhou) { toast('Assine no quadro antes de enviar.'); return; }
    clearTimeout(timer);
    try {
      dados = await api.salvarRecibo(id, payload());
      dados = await api.assinarRecibo(id, canvas.toDataURL('image/png'));
      toast('Recibo assinado e enviado ✓');
      ajustarCanvas();
      desenharDoc();
    } catch (err) { toast(err.message); }
  });

  document.getElementById('imprimirBtn').addEventListener('click', () => window.print());
  document.getElementById('pagoBtn').addEventListener('click', async () => {
    const pago = !dados.recibo.pagoEm;
    if (pago && !confirm('Marcar este recibo como pago?')) return;
    try { dados = await api.marcarReciboPago(id, pago); desenharDoc(); } catch (err) { toast(err.message); }
  });

  // ---------------------------------------------------------------------
  // Documento (o que sai na impressão / PDF)
  // ---------------------------------------------------------------------
  function desenharDoc() {
    const r = dados.recibo, a = dados.avaliacao, v = visita();
    const tot = r.valorCentavos;
    const linha = (rot, val) => `<tr><th>${rot}</th><td>${val}</td></tr>`;
    document.getElementById('reciboDoc').innerHTML = `
      <img class="logo" src="/design/logo-sousa-araujo.svg" alt="Construtora Sousa Araujo">
      <h2>RECIBO</h2>
      <p class="valor">${tot ? centavosToDisplay(tot) : 'R$ [valor total]'}</p>
      <p>Recebi da <b>Construtora Sousa Araujo</b> a importância de <b>${tot ? centavosToDisplay(tot) : 'R$ [valor total]'}</b>
        (${tot ? valorPorExtenso(tot) : '[valor por extenso]'}), referente à prestação de serviço de cliente oculto
        — avaliação <b>${escapeHtml(a.id)}</b>, conforme os dados abaixo.</p>
      <h3>Dados do prestador</h3>
      <table>
        ${linha('Nome completo', ou(r.nomeCompleto, '[nome completo]'))}
        ${linha('Telefone', r.telefone ? telMascara(r.telefone) : ou('', '[telefone]'))}
        ${linha('CPF', r.cpf ? cpfMascara(r.cpf) : ou('', '[CPF]'))}
        ${linha('Tipo de chave PIX', r.chavePixTipo ? TIPO_PIX[r.chavePixTipo] : ou('', '[tipo]'))}
        ${linha('Chave PIX', ou(r.chavePix, '[chave PIX]'))}
      </table>
      <h3>Visita</h3>
      <table>
        ${linha('Empreendimento visitado', ou(v.empreendimento, '[empreendimento]'))}
        ${linha('Data da visita', ou(v.data, '[data]'))}
        ${linha('Hora da visita', ou(v.hora, '[hora]'))}
      </table>
      <h3>Pagamento</h3>
      <table>
        ${linha('Quantidade de pesquisas realizadas', ou(r.quantidadePesquisas, '[quantidade]'))}
        ${linha('Valor unitário por pesquisa', r.valorUnitarioCentavos ? centavosToDisplay(r.valorUnitarioCentavos) : ou('', '[valor unitário]'))}
        ${linha('Valor total', tot ? `<b>${centavosToDisplay(tot)}</b>` : ou('', '[valor total]'))}
      </table>
      <p>Para clareza, firmo o presente recibo, dando plena e geral quitação do valor acima.</p>
      <p class="local">Data: ${r.assinadoEm ? dataBR(r.assinadoEm) : '[data da assinatura]'}</p>
      <div class="assinatura">
        ${r.assinatura ? `<img src="${r.assinatura}" alt="Assinatura">` : ''}
        ${ou(r.nomeCompleto, '[nome completo]')}
      </div>`;

    const st = document.getElementById('reciboStatus');
    st.innerHTML = r.pagoEm
      ? `<span class="status-badge tone-bom">✔ Pago em ${dataBR(r.pagoEm)}</span>`
      : r.assinadoEm
        ? `<span class="status-badge tone-abaixo">Assinado em ${dataBR(r.assinadoEm)} · aguardando pagamento</span>`
        : `<span class="status-badge tone-muted">Ainda não assinado</span>`;
    const pagoBtn = document.getElementById('pagoBtn');
    pagoBtn.style.display = ehCoordenador && r.assinadoEm ? '' : 'none';
    pagoBtn.textContent = r.pagoEm ? 'Desfazer pagamento' : 'Marcar como pago';
    const bloqueado = !ehAvaliador || !!r.pagoEm;
    document.querySelectorAll('#reciboForm input, #reciboForm select, #reciboForm button').forEach(e => { e.disabled = bloqueado; });
    document.getElementById('valorTotal').disabled = false;
  }

  preencher();
  desenharDoc();
  // O documento acompanha a digitação antes de salvar.
  ['nomeCompleto', 'chavePix'].forEach(k => campo(k).addEventListener('input', () => {
    dados.recibo[k] = campo(k).value; desenharDoc();
  }));
})();
