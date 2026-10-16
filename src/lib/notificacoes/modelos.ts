/**
 * Textos dos e-mails do sistema, no visual do design system Market Share
 * Sousa Araujo (logo, vinho da marca, cantos arredondados). HTML com estilos
 * inline e tabelas, que é o que os programas de e-mail entendem; tudo o que
 * vem do cadastro (nome da pessoa) passa por escape.
 */
import type { Email } from "./envio";
import { CODIGO_VALIDADE_MIN } from "@/lib/auth/codigo";
import { urlBase } from "@/lib/env";

const VINHO = "#ae2628";
const TEXTO = "#1f1e1c";
const TEXTO_2 = "#65645e";
const FUNDO = "#f5f4f1";
const LINHA = "#e9e8e4";
const FONTE = "Satoshi, 'Segoe UI', Arial, sans-serif";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Logo em PNG (programas de e-mail não mostram SVG). */
function logo(): string {
  return `<img src="${urlBase()}/design/logo-sousa-araujo-email.png" width="180" height="42" alt="Construtora Sousa Araujo" style="display:block;border:0;height:42px;width:180px">`;
}

function moldura(titulo: string, conteudo: string): string {
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;padding:0;background:${FUNDO}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${FUNDO};padding:32px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid ${LINHA};border-radius:14px">
<tr><td style="padding:24px 28px 18px;border-bottom:1px solid ${LINHA}">${logo()}</td></tr>
<tr><td style="padding:24px 28px 28px;font-family:${FONTE};font-size:15px;line-height:22px;color:${TEXTO}">
<h1 style="margin:0 0 14px;font-size:19px;line-height:26px;color:#111111">${titulo}</h1>
${conteudo}
</td></tr>
</table>
<p style="margin:16px 0 0;font-family:${FONTE};font-size:12px;line-height:18px;color:${TEXTO_2}">Market Share · Sousa Araujo<br>E-mail automático, não é preciso responder.</p>
</td></tr>
</table>
</body></html>`;
}

function paragrafo(html: string, cor = TEXTO): string {
  return `<p style="margin:0 0 14px;color:${cor}">${html}</p>`;
}

function botao(texto: string, link: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 18px"><tr><td style="background:${VINHO};border-radius:10px">
<a href="${esc(link)}" style="display:inline-block;padding:12px 22px;font-family:${FONTE};font-size:13px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#ffffff;text-decoration:none">${texto}</a>
</td></tr></table>`;
}

export function emailCodigo(para: string, nome: string, codigo: string): Email {
  return {
    para,
    assunto: `Seu código de acesso: ${codigo}`,
    texto: `Olá, ${nome}.\n\nSeu código de acesso ao sistema de Market Share é ${codigo}.\nEle vale por ${CODIGO_VALIDADE_MIN} minutos e só pode ser usado uma vez.\n\nSe você não pediu este código, ignore este e-mail.`,
    html: moldura(
      "Seu código de acesso",
      paragrafo(`Olá, ${esc(nome)}. Use este código para entrar no sistema de Market Share:`) +
        `<p style="margin:0 0 14px;padding:14px 0;background:${FUNDO};border-radius:10px;text-align:center;font-family:${FONTE};font-size:30px;line-height:36px;font-weight:700;letter-spacing:8px;color:#111111">${codigo}</p>` +
        paragrafo(`Ele vale por ${CODIGO_VALIDADE_MIN} minutos e só pode ser usado uma vez.`) +
        paragrafo("Se você não pediu este código, ignore este e-mail.", TEXTO_2),
    ),
  };
}

export function emailConvite(para: string, nome: string, link: string): Email {
  return {
    para,
    assunto: "Seu acesso ao sistema de Market Share",
    texto: `Olá, ${nome}.\n\nVocê foi cadastrado no sistema de Market Share da Sousa Araujo.\nPara entrar, abra o link abaixo e clique em "Enviar código". Você vai receber um código neste e-mail.\n\n${link}\n\nNão há senha para criar.`,
    html: moldura(
      "Seu acesso ao Market Share",
      paragrafo(`Olá, ${esc(nome)}. Você foi cadastrado no sistema de Market Share da Sousa Araujo.`) +
        paragrafo("Clique no botão abaixo e depois em <b>Enviar código</b>. Você vai receber um código neste e-mail. Não há senha para criar.") +
        botao("Acessar o sistema", link) +
        `<p style="margin:0;font-size:13px;line-height:19px;color:${TEXTO_2}">Se o botão não funcionar, copie este endereço no navegador:<br><span style="word-break:break-all">${esc(link)}</span></p>`,
    ),
  };
}

/** E-mail que o administrador manda para si mesmo para conferir a configuração do envio. */
export function emailTeste(para: string, nome: string): Email {
  return {
    para,
    assunto: "Teste de envio do sistema de Market Share",
    texto: `Olá, ${nome}.\n\nSe você recebeu este e-mail, o envio do sistema de Market Share está funcionando.`,
    html: moldura(
      "O envio de e-mail está funcionando",
      paragrafo(`Olá, ${esc(nome)}. Se você recebeu este e-mail, o sistema de Market Share já consegue enviar códigos de acesso e convites.`),
    ),
  };
}
