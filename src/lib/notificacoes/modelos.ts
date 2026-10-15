/**
 * Textos dos e-mails de acesso. HTML simples, com escape de tudo o que
 * vem do cadastro (nome da pessoa).
 */
import type { Email } from "./envio";
import { CODIGO_VALIDADE_MIN } from "@/lib/auth/codigo";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function moldura(conteudo: string): string {
  return `<div style="font-family:Arial,sans-serif;font-size:15px;color:#1f2937;max-width:480px">${conteudo}<p style="color:#6b7280;font-size:12px;margin-top:32px">Sousa Araujo · Market Share</p></div>`;
}

export function emailCodigo(para: string, nome: string, codigo: string): Email {
  return {
    para,
    assunto: `Seu código de acesso: ${codigo}`,
    texto: `Olá, ${nome}.\n\nSeu código de acesso ao sistema de Market Share é ${codigo}.\nEle vale por ${CODIGO_VALIDADE_MIN} minutos e só pode ser usado uma vez.\n\nSe você não pediu este código, ignore este e-mail.`,
    html: moldura(
      `<p>Olá, ${esc(nome)}.</p><p>Seu código de acesso ao sistema de Market Share é:</p>` +
        `<p style="font-size:28px;font-weight:bold;letter-spacing:6px">${codigo}</p>` +
        `<p>Ele vale por ${CODIGO_VALIDADE_MIN} minutos e só pode ser usado uma vez.</p>` +
        `<p style="color:#6b7280">Se você não pediu este código, ignore este e-mail.</p>`,
    ),
  };
}

export function emailConvite(para: string, nome: string, link: string): Email {
  return {
    para,
    assunto: "Seu acesso ao sistema de Market Share",
    texto: `Olá, ${nome}.\n\nVocê foi cadastrado no sistema de Market Share da Sousa Araujo.\nPara entrar, abra o link abaixo e clique em "Enviar código". Você vai receber um código neste e-mail.\n\n${link}\n\nNão há senha para criar.`,
    html: moldura(
      `<p>Olá, ${esc(nome)}.</p><p>Você foi cadastrado no sistema de Market Share da Sousa Araujo.</p>` +
        `<p>Para entrar, clique no botão abaixo e depois em <b>Enviar código</b>. Você vai receber um código neste e-mail. Não há senha para criar.</p>` +
        `<p><a href="${esc(link)}" style="display:inline-block;background:#1d4ed8;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">Acessar o sistema</a></p>` +
        `<p style="color:#6b7280;font-size:13px">Se o botão não funcionar, copie este endereço no navegador:<br>${esc(link)}</p>`,
    ),
  };
}
