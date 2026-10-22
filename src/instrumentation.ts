/**
 * Tarefas do servidor ao iniciar (só no servidor Node): ver
 * src/instrumentation-node.ts.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./instrumentation-node");
  }
}
