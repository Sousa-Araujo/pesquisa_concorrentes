/**
 * Perfis do sistema unificado de Market Share e o que cada um pode fazer.
 * Regras puras (sem banco), reaproveitadas por páginas, Server Actions e
 * testes. `admin` passa em qualquer verificação.
 */

export const PERFIS = [
  "admin",
  "coordenador_produto",
  "supervisor_parcerias",
  "coordenador_market_share",
  "avaliador",
  "diretoria",
] as const;

export type Perfil = (typeof PERFIS)[number];

export const ROTULO_PERFIL: Record<Perfil, string> = {
  admin: "Administrador",
  coordenador_produto: "Coordenador de Produto",
  supervisor_parcerias: "Supervisor de Parcerias",
  coordenador_market_share: "Coordenador de Market Share",
  avaliador: "Cliente Oculto (Avaliador)",
  diretoria: "Diretoria (consulta)",
};

/** Perfis (além de admin) que podem executar cada tipo de ação. */
export const PERMISSOES = {
  /** Ver dashboard e lista de pesquisas de concorrentes. */
  painelPesquisa: ["coordenador_produto", "coordenador_market_share", "diretoria"],
  /** Cadastrar/editar concorrentes e empreendimentos. */
  cadastros: ["coordenador_produto"],
  /** Corrigir/excluir coletas, dados próprios e gerir agentes de campo. */
  auditoriaPesquisa: ["coordenador_market_share"],
  /** Tela de usuários. O Coordenador de Market Share só gere avaliadores. */
  gerirUsuarios: ["coordenador_market_share"],
  /** Tela de recibos de pagamento do Cliente Oculto: só o administrador. */
  recibos: [],
  /** Tabelas e espelhos: enviar o documento para leitura pela IA. */
  tabelasEnviar: ["supervisor_parcerias", "coordenador_market_share"],
  /** Tabelas e espelhos: conferir a leitura e aprovar (vai para a Pesquisa). */
  tabelasConferir: ["coordenador_market_share"],
} as const satisfies Record<string, readonly Perfil[]>;

export type Permissao = keyof typeof PERMISSOES;

export function ehPerfil(valor: string): valor is Perfil {
  return (PERFIS as readonly string[]).includes(valor);
}

export function temPermissao(perfis: readonly string[], permissao: Permissao): boolean {
  if (perfis.includes("admin")) return true;
  return PERMISSOES[permissao].some((p) => perfis.includes(p));
}

/** Domínio de e-mail obrigatório para quem é da empresa. */
export const DOMINIO_EMAIL_EMPRESA = "sousaaraujo.com.br";

/**
 * Usuários internos precisam de e-mail @sousaaraujo.com.br. A exceção é
 * quem é só Avaliador (Cliente Oculto): são pessoas contratadas de fora,
 * normalmente para uma visita, sem e-mail da empresa.
 */
export function emailPermitidoPara(email: string, perfis: readonly string[]): boolean {
  const soAvaliador = perfis.length > 0 && perfis.every((p) => p === "avaliador");
  if (soAvaliador) return true;
  return email.trim().toLowerCase().endsWith(`@${DOMINIO_EMAIL_EMPRESA}`);
}

/**
 * O Coordenador de Market Share (sem admin) só pode criar ou alterar
 * usuários cujo único perfil é `avaliador`. O admin gere qualquer um.
 */
export function podeGerirUsuarioCom(perfisDeQuemPede: readonly string[], perfisDoAlvo: readonly string[]): boolean {
  if (perfisDeQuemPede.includes("admin")) return true;
  if (!temPermissao(perfisDeQuemPede, "gerirUsuarios")) return false;
  return perfisDoAlvo.length > 0 && perfisDoAlvo.every((p) => p === "avaliador");
}
