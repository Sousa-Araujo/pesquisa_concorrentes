/**
 * Diálogo do design system (confirmar/avisar) no lugar do confirm()/alert()
 * do navegador. A implementação é uma só, em public/design/dialogo.js,
 * carregada no layout raiz e nas telas do Cliente Oculto.
 */
interface OpcoesConfirmar {
  titulo?: string;
  mensagem: string;
  textoConfirmar?: string;
  textoCancelar?: string;
  /** Ação destrutiva: botão vermelho e foco inicial no Cancelar. */
  perigo?: boolean;
}

declare global {
  interface Window {
    MSDialogo?: {
      confirmar: (o: OpcoesConfirmar) => Promise<boolean>;
      avisar: (o: { titulo?: string; mensagem: string } | string) => Promise<void>;
    };
  }
}

export function confirmar(o: OpcoesConfirmar): Promise<boolean> {
  // Sem o script (ex.: bloqueado), cai no confirm do navegador.
  return window.MSDialogo ? window.MSDialogo.confirmar(o) : Promise.resolve(window.confirm(o.mensagem));
}

export function avisar(mensagem: string, titulo?: string): Promise<void> {
  if (window.MSDialogo) return window.MSDialogo.avisar({ mensagem, titulo });
  window.alert(mensagem);
  return Promise.resolve();
}
