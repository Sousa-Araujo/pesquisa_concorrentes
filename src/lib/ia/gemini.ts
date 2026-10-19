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

type Motivo = "cota" | "sobrecarga" | "demora" | "conexao" | "resposta";

/** Falha que vale tentar em outro modelo (ou mais tarde). */
class ErroPassageiro extends ErroIA {
  constructor(public modelo: string, public motivo: Motivo, detalhe: string) {
    super(`${modelo}: ${detalhe}`);
  }
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Tenta o modelo configurado e depois os reservas (cada modelo tem a sua cota
 * no Google; no plano gratuito, 20 leituras por dia). Modelo sem cota não é tentado de novo. Tudo dentro de ~165 s
 * (a rota aceita 180 s).
 */
export async function lerTabelaComGemini(arquivo: Buffer, mime: string) {
  const chave = process.env.GEMINI_API_KEY;
  if (!chave) throw new ErroIA("A leitura por IA ainda não está configurada (GEMINI_API_KEY). Preencha os números na conferência.");
  const principal = process.env.GEMINI_MODELO || MODELO_PADRAO;
  // Uma volta só: no plano gratuito, até as recusas por sobrecarga contam na cota do dia.
  const modelos = [principal, ...MODELOS_RESERVA.filter((m) => m !== principal)];
  const limite = Date.now() + 165_000;
  const falhas: ErroPassageiro[] = [];
  const semCota = new Set<string>();
  for (let i = 0; i < modelos.length; i++) {
    const modelo = modelos[i];
    if (semCota.has(modelo)) continue;
    const resta = limite - Date.now();
    if (resta < 20_000) break;
    try {
      return await chamar(chave, modelo, arquivo, mime, Math.min(80_000, resta));
    } catch (e) {
      if (!(e instanceof ErroPassageiro)) throw e;
      console.warn(`[gemini] ${e.message}`);
      falhas.push(e);
      if (e.motivo === "cota") semCota.add(modelo);
      else await esperar(2_000);
    }
  }
  const tentados = new Set(falhas.map((f) => f.modelo));
  const conta = (m: Motivo) => falhas.filter((f) => f.motivo === m).length;
  let msg: string;
  if (semCota.size > 0 && semCota.size === tentados.size) {
    msg = "O limite de uso da conta do Gemini foi atingido em todos os modelos (no plano gratuito ele renova a cada dia).";
  } else if (conta("demora") > 0 && conta("demora") >= conta("sobrecarga")) {
    msg = "A IA demorou demais para ler este documento (o Google está lento agora).";
  } else {
    msg = "A IA está sobrecarregada no momento.";
  }
  const resumo = [...tentados].map((m) => {
    const ultima = [...falhas].reverse().find((f) => f.modelo === m)!;
    return `${m}: ${{ cota: "sem cota hoje", sobrecarga: "sobrecarregado", demora: "demorou demais", conexao: "sem conexão", resposta: "resposta incompleta" }[ultima.motivo]}`;
  }).join("; ");
  throw new ErroIA(`${msg} Use "Ler de novo com IA" daqui a alguns minutos ou preencha os números. (${resumo})`);
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
    if ((e as Error).name === "AbortError") throw new ErroPassageiro(modelo, "demora", "demorou demais para responder");
    throw new ErroPassageiro(modelo, "conexao", "não foi possível falar com a IA");
  } finally {
    clearTimeout(tempo);
  }
  const corpo = await resposta.json().catch(() => null) as Record<string, unknown> | null;
  if (!resposta.ok) {
    const msg = (corpo?.error as { message?: string } | undefined)?.message ?? `erro ${resposta.status}`;
    if (resposta.status === 429) throw new ErroPassageiro(modelo, /quota/i.test(msg) ? "cota" : "sobrecarga", msg);
    if ([500, 502, 503, 504].includes(resposta.status)) throw new ErroPassageiro(modelo, "sobrecarga", msg);
    throw new ErroIA(`A IA recusou o documento: ${msg}`);
  }
  const texto = ((corpo?.candidates as { content?: { parts?: { text?: string }[] } }[] | undefined)?.[0]?.content?.parts ?? [])
    .map((p) => p.text ?? "").join("");
  try {
    const json = JSON.parse(texto) as { unidades?: unknown; observacoes?: string };
    return { unidades: json.unidades ?? [], observacoes: json.observacoes ?? "", modelo };
  } catch {
    // Resposta cortada ou fora do formato: tenta o próximo modelo.
    throw new ErroPassageiro(modelo, "resposta", "não devolveu a lista de unidades");
  }
}
