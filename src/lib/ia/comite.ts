/**
 * Leitura do PDF mensal do Comitê de Vendas pelo Claude. A IA só copia, por
 * produto, os campos que o Quadro Comparativo usa; a conversão em números e
 * a ligação com os empreendimentos são feitas pelo sistema
 * (src/lib/domain/comite.ts) e tudo passa pela conferência do administrador.
 */
import "server-only";
import { claudeConfigurado, ErroClaudePassageiro, lerJsonComClaude } from "./claude";
import { ErroIA } from "./comum";

const TEXTO_OU_NULO = { type: ["string", "null"] };
const INTEIRO_OU_NULO = { type: ["integer", "null"] };

const ESQUEMA = {
  type: "object",
  properties: {
    linhas: {
      type: "array",
      items: {
        type: "object",
        properties: {
          regional: { type: "string" },
          produto: { type: "string" },
          previsao_entrega: TEXTO_OU_NULO,
          ato_parcelas: INTEIRO_OU_NULO,
          presoluto_parcelas: INTEIRO_OU_NULO,
          presoluto_percentual: TEXTO_OU_NULO,
          desconto_financiado: TEXTO_OU_NULO,
          desconto_avista: TEXTO_OU_NULO,
        },
        required: [
          "regional", "produto", "previsao_entrega", "ato_parcelas", "presoluto_parcelas",
          "presoluto_percentual", "desconto_financiado", "desconto_avista",
        ],
        additionalProperties: false,
      },
    },
    observacoes: { type: "string" },
  },
  required: ["linhas", "observacoes"],
  additionalProperties: false,
};

const INSTRUCOES = `Você vai ler o PDF "Comitê Mensal de Vendas" de uma incorporadora. Ele tem uma tabela com uma linha por produto (empreendimento); a primeira coluna ("Reg") traz o código da regional (RVP, RAT, RGC ou RSP).
Extraia TODAS as linhas de produtos, na ordem do documento, sem pular nenhuma e sem incluir a linha "TOTAIS". Para cada produto copie, exatamente como está escrito:
- "regional": o código da primeira coluna (ex.: "RVP");
- "produto": o nome da coluna "Produto" (ex.: "SOU VIVER TAUBATÉ M2");
- "previsao_entrega": a coluna "Previsão de Entrega" (ex.: "junho/27");
- "ato_parcelas": o número da coluna "Ato + Parc." (inteiro);
- "presoluto_parcelas": o número sob "Pré-soluto" → "Nº de Parc." (inteiro);
- "presoluto_percentual": o percentual sob "Pré-soluto" → "%" (ex.: "12%");
- "desconto_financiado": a coluna de DESCONTO "Máx. por venda Financ.", como está escrito (ex.: "7,50%"). Se a célula trouxer um texto em vez de percentual (ex.: "Qualquer unidade a R$ 251.900,00, até dia 15/07, limitado a 04 vendas"), copie o texto inteiro;
- "desconto_avista": a coluna de DESCONTO "Máx. por venda à vista" (ex.: "20%"), como está escrito.
Se uma célula estiver vazia, use null. NÃO leia prêmio, share nem meta de vendas. Alinhe cada valor à linha do seu produto (a tabela tem células mescladas no cabeçalho: confira linha por linha). Em "observacoes", anote em português o que for útil para quem vai conferir (célula ilegível, linha duvidosa); se não houver nada, deixe vazio.`;

export function leituraComiteConfigurada(): boolean {
  return claudeConfigurado();
}

export interface LeituraComiteIA { linhas: unknown; observacoes: string; modelo: string }

/** Lê o PDF do comitê. Erros viram ErroIA, com mensagem pronta para a conferência. */
export async function lerComite(arquivo: Buffer, mime: string): Promise<LeituraComiteIA> {
  if (!claudeConfigurado()) {
    throw new ErroIA("A leitura do comitê por IA ainda não está configurada (ANTHROPIC_API_KEY). Preencha as linhas na conferência.");
  }
  try {
    const { json, modelo } = await lerJsonComClaude(arquivo, mime, 150_000, INSTRUCOES, ESQUEMA, "a tabela do comitê");
    return { linhas: json.linhas ?? [], observacoes: typeof json.observacoes === "string" ? json.observacoes : "", modelo };
  } catch (e) {
    if (e instanceof ErroClaudePassageiro) throw new ErroIA(`${e.message} Use "Ler de novo com IA" mais tarde ou preencha as linhas.`);
    throw e;
  }
}
