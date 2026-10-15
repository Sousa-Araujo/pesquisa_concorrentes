#!/usr/bin/env node
/**
 * Aplica as migrations em db/migrations (idempotente, controlada por uma
 * tabela `_migrations`) e garante o primeiro Administrador a partir de
 * ADMIN_EMAIL / ADMIN_NOME, se definidos.
 *
 * Roda automaticamente antes de `next start` (ver "start" em package.json),
 * então basta cadastrar as variáveis no Railway e o primeiro deploy já sobe
 * com o schema pronto e o primeiro login funcionando — sem passo manual.
 *
 * Escrito em JS puro (sem TypeScript/tsx) de propósito: builders de deploy
 * costumam podar devDependencies na imagem final, e este script roda no
 * boot do container, então não pode depender de nada que só exista em dev.
 */
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, "..", "db", "migrations");

function precisaSsl(connectionString) {
  try {
    const { hostname } = new URL(connectionString);
    return !(
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname.endsWith(".railway.internal")
    );
  } catch {
    return true;
  }
}

async function aplicarMigrations(client) {
  await client.query(`
    create table if not exists _migrations (
      nome text primary key,
      aplicada_em timestamptz not null default now()
    )
  `);

  const arquivos = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const arquivo of arquivos) {
    const { rows } = await client.query(`select 1 from _migrations where nome = $1`, [arquivo]);
    if (rows.length) {
      console.log(`[migrate] ${arquivo} já aplicada, pulando.`);
      continue;
    }

    const sql = readFileSync(path.join(MIGRATIONS_DIR, arquivo), "utf8");
    console.log(`[migrate] aplicando ${arquivo}...`);
    await client.query("begin");
    try {
      await client.query(sql);
      await client.query(`insert into _migrations (nome) values ($1)`, [arquivo]);
      await client.query("commit");
      console.log(`[migrate] ${arquivo} aplicada com sucesso.`);
    } catch (err) {
      await client.query("rollback");
      throw new Error(`Falha ao aplicar ${arquivo}: ${err.message}`);
    }
  }
}

/**
 * Garante o primeiro Administrador a partir de ADMIN_EMAIL / ADMIN_NOME
 * (aceita também os nomes antigos GESTOR_EMAIL / GESTOR_NOME). Não há
 * senha: o administrador entra pela tela /entrar com o código enviado
 * ao e-mail.
 */
async function bootstrapAdmin(client) {
  const email = process.env.ADMIN_EMAIL ?? process.env.GESTOR_EMAIL;
  const nome = process.env.ADMIN_NOME ?? process.env.GESTOR_NOME ?? "Administrador";

  if (!email) {
    console.log("[migrate] ADMIN_EMAIL não definido — pulando bootstrap do administrador.");
    return;
  }

  const { rows } = await client.query(
    `select id_usuario from usuarios where lower(email) = lower($1)`,
    [email],
  );
  if (rows.length) {
    console.log(`[migrate] usuário ${email} já existe, pulando bootstrap.`);
    return;
  }

  await client.query(
    `insert into usuarios (nome, email, perfis, ativo) values ($1, $2, '{admin}', true)`,
    [nome, email],
  );
  console.log(`[migrate] administrador ${email} criado.`);
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.log("[migrate] DATABASE_URL ausente — pulando migrations (build/ambiente sem banco).");
    return;
  }

  const pool = new pg.Pool({
    connectionString,
    ssl: precisaSsl(connectionString) ? { rejectUnauthorized: false } : false,
  });

  const client = await pool.connect();
  try {
    await aplicarMigrations(client);
    await bootstrapAdmin(client);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("[migrate] falhou:", err);
  process.exit(1);
});
