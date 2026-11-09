// Diálogo do design system no lugar do confirm()/alert() do navegador, usado
// pelas telas em React (src/lib/cliente/dialogo.ts) e pelas do Cliente Oculto.
//   MSDialogo.confirmar({ titulo, mensagem, textoConfirmar, perigo }) → Promise<boolean>
//   MSDialogo.avisar({ titulo, mensagem }) → Promise<void>
//   MSDialogo.pedirTexto({ titulo, mensagem, rotulo, placeholder, textoConfirmar, perigo }) → Promise<string|null>
// Esc ou clique fora = cancelar. Estilos: .ms-dialogo* em public/design/ms.css.
(function (global) {
  'use strict';
  if (global.MSDialogo) return;

  function abrir(o, comCancelar) {
    return new Promise(function (resolver) {
      var anterior = document.activeElement;
      var fundo = document.createElement('div');
      fundo.className = 'ms-dialogo-fundo';
      var caixa = document.createElement('div');
      caixa.className = 'ms-dialogo';
      caixa.setAttribute('role', comCancelar ? 'alertdialog' : 'dialog');
      caixa.setAttribute('aria-modal', 'true');
      var titulo = document.createElement('h2');
      titulo.className = 'ms-dialogo-titulo';
      titulo.textContent = o.titulo || (comCancelar ? 'Confirmar' : 'Aviso');
      titulo.id = 'ms-dialogo-titulo-' + Date.now();
      caixa.setAttribute('aria-labelledby', titulo.id);
      var texto = document.createElement('p');
      texto.className = 'ms-dialogo-texto';
      texto.textContent = o.mensagem || '';
      var acoes = document.createElement('div');
      acoes.className = 'ms-dialogo-acoes';
      var ok = document.createElement('button');
      ok.type = 'button';
      ok.className = 'ms-dialogo-btn ' + (o.perigo ? 'ms-dialogo-btn--perigo' : 'ms-dialogo-btn--primario');
      ok.textContent = o.textoConfirmar || (comCancelar ? 'Confirmar' : 'Entendi');
      var cancelar = null;
      if (comCancelar) {
        cancelar = document.createElement('button');
        cancelar.type = 'button';
        cancelar.className = 'ms-dialogo-btn ms-dialogo-btn--secundario';
        cancelar.textContent = o.textoCancelar || 'Cancelar';
        acoes.appendChild(cancelar);
      }
      acoes.appendChild(ok);
      var campo = null, erroCampo = null, rotuloCampo = null;
      if (o.pedirTexto) {
        rotuloCampo = document.createElement('label');
        rotuloCampo.className = 'ms-dialogo-rotulo';
        rotuloCampo.textContent = o.rotulo || 'Motivo';
        campo = document.createElement('textarea');
        campo.className = 'ms-dialogo-campo';
        campo.rows = 3;
        campo.placeholder = o.placeholder || '';
        campo.id = 'ms-dialogo-campo-' + Date.now();
        rotuloCampo.setAttribute('for', campo.id);
        erroCampo = document.createElement('p');
        erroCampo.className = 'ms-dialogo-erro';
        campo.addEventListener('input', function () { erroCampo.textContent = ''; });
      }
      caixa.appendChild(titulo); caixa.appendChild(texto);
      if (campo) { caixa.appendChild(rotuloCampo); caixa.appendChild(campo); caixa.appendChild(erroCampo); }
      caixa.appendChild(acoes);
      fundo.appendChild(caixa);
      document.body.appendChild(fundo);
      requestAnimationFrame(function () { fundo.classList.add('is-aberto'); });

      function fechar(valor) {
        document.removeEventListener('keydown', tecla, true);
        fundo.classList.remove('is-aberto');
        setTimeout(function () { if (fundo.parentNode) fundo.parentNode.removeChild(fundo); }, 160);
        if (anterior && anterior.focus) anterior.focus();
        resolver(valor);
      }
      function tecla(e) {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); fechar(campo ? null : false); }
        if (e.key === 'Tab') {
          var focaveis = (campo ? [campo] : []).concat(cancelar ? [cancelar, ok] : [ok]);
          var i = focaveis.indexOf(document.activeElement);
          e.preventDefault();
          focaveis[(i + (e.shiftKey ? focaveis.length - 1 : 1)) % focaveis.length].focus();
        }
      }
      document.addEventListener('keydown', tecla, true);
      ok.addEventListener('click', function () {
        if (!campo) { fechar(true); return; }
        var v = campo.value.trim();
        if (!v) { erroCampo.textContent = o.erroVazio || 'Preencha este campo.'; campo.focus(); return; }
        fechar(v);
      });
      if (cancelar) cancelar.addEventListener('click', function () { fechar(campo ? null : false); });
      fundo.addEventListener('mousedown', function (e) { if (e.target === fundo) fechar(campo ? null : false); });
      // Campo de texto recebe o foco; ação destrutiva começa no Cancelar.
      (campo || (o.perigo && cancelar ? cancelar : ok)).focus();
    });
  }

  global.MSDialogo = {
    confirmar: function (o) { return abrir(o || {}, true); },
    pedirTexto: function (o) { return abrir(Object.assign({}, o || {}, { pedirTexto: true }), true); },
    avisar: function (o) { return abrir(typeof o === 'string' ? { mensagem: o } : (o || {}), false).then(function () {}); },
  };
})(window);
