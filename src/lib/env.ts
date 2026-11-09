/**
 * Leitura de variáveis de ambiente obrigatórias, com erro claro se ausente.
 * Sempre chamada dentro de funções (nunca no topo do módulo), para não
 * derrubar o build/rotas que não precisam da variável em questão.
 */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Variável de ambiente ausente: ${name}. Configure-a em Railway → Service → Variables.`,
    );
  }
  return value;
}

/** Endereço público do sistema (links de convite e imagens dos e-mails). */
export function urlBase(): string {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}
