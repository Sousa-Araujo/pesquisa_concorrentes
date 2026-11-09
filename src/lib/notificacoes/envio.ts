/**
 * Envio de e-mail (Resend) e SMS.
 *
 * Sem RESEND_API_KEY em desenvolvimento, o conteúdo é só impresso no log do
 * servidor (útil para testar o login localmente). Em produção, a ausência
 * da chave é um erro: nunca imprimimos códigos de acesso no log de produção.
 *
 * ENVIO_SIMULADO=1 faz o mesmo (só log) em um servidor de produção — use
 * APENAS no ambiente de teste do Railway, nunca no ambiente de produção.
 *
 * SMS: nenhum provedor foi escolhido ainda. Enquanto isso o agente de campo
 * recebe o código no e-mail cadastrado; sem e-mail, o envio falha em
 * produção com mensagem clara.
 */
const RESEND_URL = "https://api.resend.com/emails";

function emProducao(): boolean {
  return process.env.NODE_ENV === "production";
}

/** Só log, sem envio real: desenvolvimento ou ambiente de teste explicitamente marcado. */
function envioSimulado(): boolean {
  return !emProducao() || process.env.ENVIO_SIMULADO === "1";
}

/** Verdadeiro quando os e-mails só vão para o log (sem chave do Resend ou ENVIO_SIMULADO=1). */
export function emailSimulado(): boolean {
  return !process.env.RESEND_API_KEY || process.env.ENVIO_SIMULADO === "1";
}

export interface Email {
  para: string;
  assunto: string;
  texto: string;
  html: string;
}

export async function enviarEmail(email: Email): Promise<void> {
  const chave = process.env.RESEND_API_KEY;
  if (!chave || process.env.ENVIO_SIMULADO === "1") {
    if (!envioSimulado()) throw new Error("Envio de e-mail não configurado (RESEND_API_KEY).");
    console.info(`[email:simulado] para=${email.para} | ${email.assunto}\n${email.texto}`);
    return;
  }

  const resposta = await fetch(RESEND_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_REMETENTE ?? "Market Share Sousa Araujo <nao-responda@sousaaraujo.com.br>",
      to: [email.para],
      subject: email.assunto,
      text: email.texto,
      html: email.html,
    }),
  });
  if (!resposta.ok) {
    const corpo = await resposta.text().catch(() => "");
    throw new Error(`Falha ao enviar e-mail (${resposta.status}): ${corpo.slice(0, 200)}`);
  }
}

export async function enviarSms(telefone: string, texto: string): Promise<void> {
  if (!envioSimulado()) throw new Error("Envio de SMS ainda não configurado.");
  console.info(`[sms:simulado] para=${telefone} | ${texto}`);
}
