/**
 * Leitura de tabela de preços / espelho de vendas pelo Claude (Anthropic).
 * Manda o PDF ou a imagem com as instruções e recebe a lista de unidades no
 * formato JSON exigido (structured outputs). Os totais continuam sendo
 * calculados pelo sistema e tudo passa pela conferência.
 *
 * Variáveis: ANTHROPIC_API_KEY (obrigatória) e CLAUDE_MODELO (opcional;
 * padrão abaixo).
 */
import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { ErroIA, INSTRUCOES, type ResultadoIA } from "./comum";

/** Haiku 5.5: acertou 100% nos testes com o Splendore, ~15x mais barato que o Sonnet 5.5. */
const MODELO_PADRAO = "claude-haiku-5-5";

/** Modelos que aceitam a reserva automática da API quando recusam (o Haiku não tem). */
const ACEITA_FALLBACK = /^claude-(sonnet-5-5|opus-5|opus-5-5|fable-5|fable-5-1)$/;

/** Falha que vale passar para o provedor reserva (Gemini). */
export class ErroClaudePassageiro extends ErroIA {}

const NUMERO_OU_NULO = { type: ["number", "null"] };

const ESQUEMA = {
  type: "object",
  properties: {
    unidades: {
      type: "array",
      items: {
        type: "object",
        properties: {
          unidade: { type: "string" },
          valor_tabela: NUMERO_OU_NULO,
          valor_desconto: NUMERO_OU_NULO,
          status: { type: "string", enum: ["disponivel", "reservada", "vendida", "outro"] },
          status_original: { type: "string" },
        },
        required: ["unidade", "valor_tabela", "valor_desconto", "status", "status_original"],
        additionalProperties: false,
      },
    },
    observacoes: { type: "string" },
  },
  required: ["unidades", "observacoes"],
  additionalProperties: false,
};

export function claudeConfigurado(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

const IMAGENS = ["image/png", "image/jpeg", "image/webp"] as const;

export async function lerTabelaComClaude(arquivo: Buffer, mime: string, prazoMs: number): Promise<ResultadoIA> {
  if (!claudeConfigurado()) throw new ErroIA("A leitura pelo Claude não está configurada (ANTHROPIC_API_KEY).");
  const modelo = process.env.CLAUDE_MODELO || MODELO_PADRAO;
  // Uma nova tentativa automática do SDK (429/5xx/conexão) dentro do prazo.
  const cliente = new Anthropic({ timeout: prazoMs, maxRetries: 1 });
  const dados = arquivo.toString("base64");
  const documento: Anthropic.Beta.BetaContentBlockParam = (IMAGENS as readonly string[]).includes(mime)
    ? { type: "image", source: { type: "base64", media_type: mime as (typeof IMAGENS)[number], data: dados } }
    : { type: "document", source: { type: "base64", media_type: "application/pdf", data: dados } };

  let resposta: Anthropic.Beta.BetaMessage;
  try {
    resposta = await cliente.beta.messages.create({
      model: modelo,
      max_tokens: 32000,
      // Se o modelo recusar por política, a API tenta o modelo indicado por ela.
      ...(ACEITA_FALLBACK.test(modelo) ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
      output_config: { effort: "medium", format: { type: "json_schema", schema: ESQUEMA } },
      messages: [{ role: "user", content: [documento, { type: "text", text: INSTRUCOES }] }],
    });
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) {
      throw new ErroClaudePassageiro("A chave do Claude (ANTHROPIC_API_KEY) não foi aceita.");
    }
    if (e instanceof Anthropic.BadRequestError) {
      // Ex.: sem crédito na conta, arquivo inválido.
      const semCredito = /credit balance/i.test(e.message);
      throw new ErroClaudePassageiro(semCredito ? "A conta do Claude está sem crédito." : `O Claude recusou o arquivo: ${e.message}`);
    }
    if (e instanceof Anthropic.RateLimitError) throw new ErroClaudePassageiro("O Claude atingiu o limite de uso por minuto.");
    if (e instanceof Anthropic.APIConnectionTimeoutError) throw new ErroClaudePassageiro("O Claude demorou demais para responder.");
    if (e instanceof Anthropic.APIConnectionError) throw new ErroClaudePassageiro("Não foi possível falar com o Claude.");
    if (e instanceof Anthropic.APIError) throw new ErroClaudePassageiro(`O Claude está indisponível no momento (erro ${e.status}).`);
    throw e;
  }

  if (resposta.stop_reason === "refusal") throw new ErroClaudePassageiro("O Claude não aceitou ler este documento.");
  if (resposta.stop_reason === "max_tokens") throw new ErroClaudePassageiro("A lista de unidades ficou grande demais para uma leitura.");
  const texto = resposta.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  try {
    const json = JSON.parse(texto) as { unidades?: unknown; observacoes?: string };
    return { unidades: json.unidades ?? [], observacoes: json.observacoes ?? "", modelo: resposta.model };
  } catch {
    throw new ErroClaudePassageiro("O Claude não devolveu a lista de unidades.");
  }
}
