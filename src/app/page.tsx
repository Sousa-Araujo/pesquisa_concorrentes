import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-8 px-6 py-12">
      <header>
        <p className="text-sm font-semibold uppercase tracking-widest text-brand">
          Market Share · Sousa Araujo
        </p>
        <h1 className="mt-2 text-3xl font-bold text-ink">
          Pesquisa de concorrentes e Cliente Oculto
        </h1>
        <p className="mt-3 text-ink/60">
          Escolha por onde entrar.
        </p>
      </header>

      <div className="grid gap-4">
        <Link href="/agente" className="card group transition hover:border-brand/40">
          <p className="text-lg font-semibold text-ink">Sou Agente de Campo</p>
          <p className="mt-1 text-sm text-ink/60">
            Registrar coleta com meu telefone.
          </p>
        </Link>
        <Link href="/entrar" className="card group transition hover:border-brand/40">
          <p className="text-lg font-semibold text-ink">Equipe Sousa Araujo</p>
          <p className="mt-1 text-sm text-ink/60">
            Coordenadores, supervisores, avaliadores e administradores.
          </p>
        </Link>
      </div>
    </main>
  );
}
