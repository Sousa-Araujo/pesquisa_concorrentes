/**
 * Formulário por critérios do Cliente Oculto (modelo 2): cada pilar tem 4
 * critérios com nota 0–10 e evidência obrigatória. O item 4.4 é Sim/Não
 * (Sim = 10, Não = 0). "Não se aplica" tira o critério da média, mas a
 * evidência continua obrigatória. A nota informada do pilar é a média
 * simples dos critérios aplicáveis, calculada aqui no servidor.
 *
 * Os textos dos critérios ficam em public/cliente-oculto/js/config.js
 * (CRITERIOS); aqui só as chaves, os nomes curtos e o tipo de resposta.
 */
export const MODELO_CRITERIOS = 2;

export interface DefCriterio { key: string; nome: string; simNao?: boolean }

export const CRITERIOS: Record<string, DefCriterio[]> = {
  recepcao: [
    { key: "1.1", nome: "Prontidão no atendimento" },
    { key: "1.2", nome: "Cordialidade e receptividade" },
    { key: "1.3", nome: "Condução do cadastro" },
    { key: "1.4", nome: "Direcionamento e espera" },
  ],
  corretorAtend: [
    { key: "2.1", nome: "Investigação das necessidades" },
    { key: "2.2", nome: "Escuta e personalização" },
    { key: "2.3", nome: "Clareza e domínio nas respostas" },
    { key: "2.4", nome: "Ética, lealdade comercial e respeito à concorrência" },
  ],
  pdv: [
    { key: "3.1", nome: "Acesso e estacionamento" },
    { key: "3.2", nome: "Limpeza e conservação" },
    { key: "3.3", nome: "Organização e funcionalidade" },
    { key: "3.4", nome: "Recursos de apresentação" },
  ],
  materiais: [
    { key: "4.1", nome: "Disponibilidade de materiais" },
    { key: "4.2", nome: "Qualidade visual e legibilidade" },
    { key: "4.3", nome: "Clareza e consistência das informações" },
    { key: "4.4", nome: "Utilidade do material para o cliente", simNao: true },
  ],
  negociacao: [
    { key: "5.1", nome: "Adequação da proposta ao perfil" },
    { key: "5.2", nome: "Clareza das condições comerciais" },
    { key: "5.3", nome: "Argumentação e tratamento de dúvidas ou objeções" },
    { key: "5.4", nome: "Formalização e próximos passos" },
  ],
  conhecimento: [
    { key: "6.1", nome: "Características do produto" },
    { key: "6.2", nome: "Áreas, diferenciais e acabamentos" },
    { key: "6.3", nome: "Disponibilidade e prazo" },
    { key: "6.4", nome: "Regras e processo de venda" },
  ],
};

export interface RespostaCriterio { nota: number | null; na: boolean; evidencia: string }
export type RespostasPilar = Record<string, RespostaCriterio>;

/** Limpa o que veio da tela: só chaves conhecidas, nota 0–10 (Sim/Não vira 10/0). */
export function normalizarRespostas(pilar: string, entrada: unknown): RespostasPilar {
  const defs = CRITERIOS[pilar] ?? [];
  const bruto = (entrada && typeof entrada === "object" ? entrada : {}) as Record<string, Record<string, unknown>>;
  const out: RespostasPilar = {};
  for (const d of defs) {
    const r = bruto[d.key] ?? {};
    const na = r.na === true;
    let nota: number | null = null;
    if (!na && r.nota !== null && r.nota !== undefined && r.nota !== "") {
      const n = Number(r.nota);
      if (!Number.isFinite(n) || n < 0 || n > 10) throw new Error(`Nota do item ${d.key} deve estar entre 0 e 10.`);
      nota = d.simNao ? (n >= 5 ? 10 : 0) : Math.round(n * 10) / 10;
    }
    out[d.key] = { nota, na, evidencia: String(r.evidencia ?? "").slice(0, 4000) };
  }
  return out;
}

/** Média simples dos critérios aplicáveis com nota (null se nenhum). */
export function mediaPilar(respostas: RespostasPilar): number | null {
  const notas = Object.values(respostas).filter((r) => !r.na && r.nota !== null).map((r) => r.nota as number);
  if (!notas.length) return null;
  return Math.round((notas.reduce((a, b) => a + b, 0) / notas.length) * 100) / 100;
}

/** O pilar só fica "não avaliado" quando todos os critérios são "Não se aplica". */
export function pilarAvaliado(respostas: RespostasPilar): boolean {
  return Object.values(respostas).some((r) => !r.na);
}

/** Evidência do pilar montada a partir dos critérios (relatórios e calibragem antigos leem este campo). */
export function evidenciaPilar(pilar: string, respostas: RespostasPilar): string {
  return (CRITERIOS[pilar] ?? [])
    .map((d) => {
      const r = respostas[d.key];
      if (!r || !r.evidencia.trim()) return null;
      const nota = r.na ? "não se aplica" : r.nota === null ? "sem nota" : d.simNao ? (r.nota === 10 ? "Sim" : "Não") : String(r.nota).replace(".", ",");
      return `${d.key} ${d.nome} (${nota}): ${r.evidencia.trim()}`;
    })
    .filter(Boolean)
    .join("\n");
}

/** Itens que faltam para finalizar: nota (ou "Não se aplica") e evidência em todos os critérios. */
export function pendenciasCriterios(todas: Record<string, RespostasPilar | null | undefined>): string[] {
  const falta: string[] = [];
  for (const [pilar, defs] of Object.entries(CRITERIOS)) {
    const resp = todas[pilar] ?? {};
    for (const d of defs) {
      const r = resp[d.key];
      if (!r || (!r.na && r.nota === null) || !r.evidencia.trim()) falta.push(d.key);
    }
  }
  return falta;
}
