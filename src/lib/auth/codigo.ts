/**
 * Regras do código de acesso (login sem senha) e dos tokens opacos de
 * sessão e convite. Funções puras — o acesso ao banco fica em
 * src/lib/auth/acesso.ts.
 */
import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

/** Validade do código enviado por e-mail/SMS. */
export const CODIGO_VALIDADE_MIN = 10;
/** Chutes errados permitidos por código antes de exigir um novo. */
export const CODIGO_MAX_TENTATIVAS = 5;
/** Intervalo mínimo entre dois pedidos de código para a mesma pessoa. */
export const CODIGO_INTERVALO_SEG = 60;
/** Máximo de códigos pedidos por pessoa dentro da janela abaixo. */
export const CODIGO_MAX_POR_JANELA = 5;
export const CODIGO_JANELA_MIN = 15;

/** Código numérico de 6 dígitos (000000–999999), aleatório criptográfico. */
export function gerarCodigo(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/** Remove espaços e qualquer coisa que não seja dígito (ex.: "123 456"). */
export function normalizarCodigo(valor: string): string {
  return valor.replace(/\D/g, "");
}

/** HMAC do código com o segredo da aplicação — só isso vai para o banco. */
export function hashCodigo(codigo: string, segredo: string): string {
  return createHmac("sha256", segredo).update(codigo).digest("hex");
}

export function hashesIguais(a: string, b: string): boolean {
  const ba = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/** Token opaco para cookie de sessão e link de convite. */
export function gerarToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Hash do token guardado no banco (o token em si só existe no cookie/link). */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export type SituacaoCodigo = "valido" | "inexistente" | "expirado" | "usado" | "bloqueado";

/** Situação de um código guardado, antes de comparar o valor digitado. */
export function situacaoCodigo(
  registro: { expira_em: Date; usado_em: Date | null; tentativas: number } | undefined,
  agora: Date,
): SituacaoCodigo {
  if (!registro) return "inexistente";
  if (registro.usado_em) return "usado";
  if (registro.tentativas >= CODIGO_MAX_TENTATIVAS) return "bloqueado";
  if (registro.expira_em.getTime() <= agora.getTime()) return "expirado";
  return "valido";
}

/**
 * Decide se um novo código pode ser pedido, olhando os pedidos recentes
 * (datas de criação, mais recente primeiro). Retorna a mensagem de bloqueio
 * ou null se pode enviar.
 */
export function motivoBloqueioPedido(criadosRecentes: Date[], agora: Date): string | null {
  const ultimo = criadosRecentes[0];
  if (ultimo && agora.getTime() - ultimo.getTime() < CODIGO_INTERVALO_SEG * 1000) {
    return "Aguarde 1 minuto para pedir outro código.";
  }
  const inicioJanela = agora.getTime() - CODIGO_JANELA_MIN * 60 * 1000;
  const naJanela = criadosRecentes.filter((d) => d.getTime() >= inicioJanela).length;
  if (naJanela >= CODIGO_MAX_POR_JANELA) {
    return "Muitos códigos pedidos. Tente de novo em alguns minutos.";
  }
  return null;
}

export const MENSAGEM_SITUACAO: Record<Exclude<SituacaoCodigo, "valido">, string> = {
  inexistente: "Peça um código para entrar.",
  expirado: "Este código expirou. Peça um novo.",
  usado: "Este código já foi usado. Peça um novo.",
  bloqueado: "Muitas tentativas erradas. Peça um novo código.",
};
