/**
 * Leitura de tabelas por IA: escolhe o provedor e cai no reserva se ele falhar.
 * Padrão: Claude (ANTHROPIC_API_KEY) e, como reserva, Gemini (GEMINI_API_KEY).
 * IA_PROVEDOR=gemini inverte a ordem. Tudo dentro de ~165 s (a rota aceita 180 s).
 */
import "server-only";
import { ErroIA, type ResultadoIA } from "./comum";
import { claudeConfigurado, ErroClaudePassageiro, lerTabelaComClaude } from "./claude";
import { geminiConfigurado, lerTabelaComGemini } from "./gemini";

export { ErroIA } from "./comum";

export function iaConfigurada(): boolean {
  return claudeConfigurado() || geminiConfigurado();
}

export async function lerTabela(arquivo: Buffer, mime: string): Promise<ResultadoIA> {
  if (!iaConfigurada()) {
    throw new ErroIA("A leitura por IA ainda não está configurada (ANTHROPIC_API_KEY ou GEMINI_API_KEY). Preencha os números na conferência.");
  }
  const limite = Date.now() + 165_000;
  const resta = () => limite - Date.now();
  const geminiPrimeiro = process.env.IA_PROVEDOR === "gemini";

  if (geminiPrimeiro || !claudeConfigurado()) {
    try {
      return await lerTabelaComGemini(arquivo, mime, claudeConfigurado() ? 90_000 : resta());
    } catch (e) {
      if (!(e instanceof ErroIA) || !claudeConfigurado()) throw e;
      return lerTabelaComClaude(arquivo, mime, resta());
    }
  }

  try {
    // Deixa tempo para o Gemini tentar se o Claude falhar.
    return await lerTabelaComClaude(arquivo, mime, geminiConfigurado() ? 110_000 : resta());
  } catch (e) {
    if (!(e instanceof ErroClaudePassageiro)) throw e;
    console.warn(`[claude] ${e.message}`);
    if (!geminiConfigurado() || resta() < 20_000) throw new ErroIA(`${e.message} Use "Ler de novo com IA" mais tarde ou preencha os números.`);
    try {
      return await lerTabelaComGemini(arquivo, mime, resta());
    } catch (g) {
      if (g instanceof ErroIA) throw new ErroIA(`Claude: ${e.message} Gemini: ${g.message}`);
      throw g;
    }
  }
}
