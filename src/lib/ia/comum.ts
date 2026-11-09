/**
 * O que é comum aos provedores de IA da leitura de tabelas (Claude e Gemini):
 * as instruções e o erro que a tela mostra para quem confere.
 */

/** Erro com mensagem pronta para a conferência. */
export class ErroIA extends Error {}

/** O que a leitura devolve, seja qual for o provedor. */
export interface ResultadoIA {
  unidades: unknown;
  observacoes: string;
  modelo: string;
}

export const INSTRUCOES = `Você vai ler a tabela de preços ou o espelho de vendas de um empreendimento imobiliário (apartamentos).
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
