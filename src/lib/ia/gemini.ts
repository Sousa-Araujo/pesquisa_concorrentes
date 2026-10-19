/**
 * Leitura de tabela de preços / espelho de vendas pelo Google Gemini.
 * Manda o arquivo (PDF ou imagem) junto com as instruções e pede a lista de
 * unidades em JSON (valor de tabela e status de cada uma). A IA só lê o
 * documento: os totais são calculados pelo sistema (src/lib/domain/tabelas.ts)
 * e tudo passa pela conferência do Coordenador de Market Share.
 *
 * Variáveis: GEMINI_API_KEY (obrigatória) e GEMINI_MODELO (opcional; padrão
 * abaixo). Para trocar de modelo ou de conta basta trocar as variáveis.
 */
import "server-only";

const MODELO_PADRAO = "gemini-3.8-flash";
/** Usados, em ordem, quando o principal está sobrecarregado ou demorando. */
const MODELOS_RESERVA = ["gemini-3.6-flash", "gemini-3.5-flash"];

const INSTRUCOES = `Você vai ler a tabela de preços ou o espelho de vendas de um empreendimento imobiliário (apartamentos).
Extraia TODAS as unidades (apartamentos/casas) que aparecem no documento, uma por item, sem pular nenhuma.
Para cada unidade informe:
- "unidade": a identificação como aparece (ex.: "121 NYC", "Apto 32 Torre B");
- "valor_tabela": o valor de tabela (preço cheio) da unidade em reais, como número (ex.: 374400.00). Se o documento só tiver um valor por unidade, use esse valor aqui. Se não houver valor, use null;
- "valor_desconto": o valor com desconto (ex.: "Valor de Venda com Desconto", "com desconto bom pagador", "valor promocional"), em reais, como número. Se o documento não trouxer valor com desconto, use null. Não calcule: só copie o que está escrito;
Atenção ao formato dos números no documento (pode estar com vírgula ou ponto de milhar). Se a mesma unidade aparecer em mais de uma página (ex.: condições SBPE e MCMV), liste-a só uma vez;
- "status": "disponivel", "reservada", "vendida" ou "outro" (permuta, bloqueada, fora de venda etc.);
- "status_original": o texto do status como está no documento (ex.: "Reservada Roger", "VENDIDO").
Se o documento não mostrar status, considere as unidades listadas com preço como "disponivel".
Não invente unidades nem valores. Em "observacoes", anote em português o que for útil para quem vai conferir (torres, condições, unidades ilegíveis).`;

const ESQUEMA = {
  type: "OBJECT",
  properties: {
    unidades: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          unidade: { type: "STRING" },
          valor_tabela: { type: "NUMBER", nullable: true },
          valor_desconto: { type: "NUMBER", nullable: true },
          status: { type: "STRING", enum: ["disponivel", "reservada", "vendida", "outro"] },
          status_original: { type: "STRING" },
        },
        required: ["unidade", "status"],
      },
    },
    observacoes: { type: "STRING" },
  },
  required: ["unidades"],
};

export class ErroIA extends Error {}

export function iaConfigurada(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

/** Erro passageiro do Google (sobrecarga, limite por minuto): vale tentar de novo. */
class ErroPassageiro extends ErroIA {}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Tenta o modelo configurado e, se o Google estiver sobrecarregado, tenta de
 * com os modelos reserva. Tudo dentro de ~160 s (a rota aceita 180 s).
 */
export async function lerTabelaComGemini(arquivo: Buffer, mime: string) {
  const chave = process.env.GEMINI_API_KEY;
  if (!chave) throw new ErroIA("A leitura por IA ainda não está configurada (GEMINI_API_KEY). Preencha os números na conferência.");
  const principal = process.env.GEMINI_MODELO || MODELO_PADRAO;
  // Principal, reservas e de novo o principal: se um travar, os outros ainda têm tempo.
  const modelos = [principal, ...MODELOS_RESERVA.filter((m) => m !== principal), principal];
  const limite = Date.now() + 160_000;
  let ultimo: ErroIA | null = null;
  for (let i = 0; i < modelos.length; i++) {
    const resta = limite - Date.now();
    if (resta < 15_000) break;
    try {
      return await chamar(chave, modelos[i], arquivo, mime, Math.min(50_000, resta));
    } catch (e) {
      if (!(e instanceof ErroPassageiro)) throw e;
      ultimo = e;
      await esperar(2_000 * (i + 1));
    }
  }
  if (ultimo?.message.toLowerCase().includes("quota")) {
    throw new ErroIA("O limite de uso da conta do Gemini foi atingido (no plano gratuito ele renova a cada dia). Use \"Ler de novo com IA\" mais tarde ou preencha os números.");
  }
  throw new ErroIA(`A IA está sobrecarregada no momento (${ultimo?.message ?? "sem resposta"}). Use "Ler de novo com IA" daqui a alguns minutos ou preencha os números.`);
}

async function chamar(chave: string, modelo: string, arquivo: Buffer, mime: string, prazo: number) {
  const controle = new AbortController();
  const tempo = setTimeout(() => controle.abort(), prazo);
  let resposta: Response;
  try {
    resposta = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelo)}:generateContent`, {
      method: "POST",
      signal: controle.signal,
      headers: { "Content-Type": "application/json", "x-goog-api-key": chave },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ inline_data: { mime_type: mime, data: arquivo.toString("base64") } }, { text: INSTRUCOES }] }],
        generationConfig: { responseMimeType: "application/json", responseSchema: ESQUEMA, temperature: 0 },
      }),
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw new ErroPassageiro(`${modelo}: demorou demais para responder`);
    throw new ErroPassageiro("Não foi possível falar com a IA.");
  } finally {
    clearTimeout(tempo);
  }
  const corpo = await resposta.json().catch(() => null) as Record<string, unknown> | null;
  if (!resposta.ok) {
    const msg = (corpo?.error as { message?: string } | undefined)?.message ?? `erro ${resposta.status}`;
    if ([429, 500, 502, 503, 504].includes(resposta.status)) throw new ErroPassageiro(`${modelo}: ${msg}`);
    throw new ErroIA(`A IA recusou o documento: ${msg}`);
  }
  const texto = ((corpo?.candidates as { content?: { parts?: { text?: string }[] } }[] | undefined)?.[0]?.content?.parts ?? [])
    .map((p) => p.text ?? "").join("");
  try {
    const json = JSON.parse(texto) as { unidades?: unknown; observacoes?: string };
    return { unidades: json.unidades ?? [], observacoes: json.observacoes ?? "", modelo };
  } catch {
    throw new ErroIA("A IA não devolveu a lista de unidades. Preencha os números na conferência ou tente de novo.");
  }
}
