import Link from "next/link";
import { redirect } from "next/navigation";
import { usuarioAtual } from "@/lib/auth/acesso";
import { ROTULO_PERFIL, ehPerfil, temPermissao } from "@/lib/auth/perfis";
import { sair } from "../entrar/actions";

export const dynamic = "force-dynamic";

interface Modulo {
  titulo: string;
  descricao: string;
  href?: string;
  emBreve?: boolean;
}

/** Tela inicial depois do login: só os módulos que o perfil da pessoa usa. */
export default async function InicioPage() {
  const u = await usuarioAtual();
  if (!u) redirect("/entrar");

  const p = u.perfis;
  const tem = (...perfis: string[]) => p.includes("admin") || perfis.some((x) => p.includes(x));
  const modulos: Modulo[] = [];

  if (temPermissao(p, "painelPesquisa")) {
    modulos.push({
      titulo: "Pesquisa de Concorrentes",
      descricao: "Dashboard, coletas mensais, concorrentes e empreendimentos.",
      href: "/gestor",
    });
  }
  // Cliente Oculto: cada papel cai direto na sua tela.
  const telaCO = p.includes("admin")
    ? "admin.html"
    : p.includes("coordenador_market_share")
      ? "coordenador.html"
      : p.includes("avaliador")
        ? "cliente-oculto.html"
        : null;
  if (telaCO) {
    modulos.push({
      titulo: "Cliente Oculto",
      descricao: p.includes("avaliador") && !tem("coordenador_market_share")
        ? "Preencher a avaliação da sua visita."
        : "Avaliações das visitas, calibragem e relatórios.",
      href: `/cliente-oculto/${telaCO}`,
    });
  }
  if (tem("supervisor_parcerias", "coordenador_market_share")) {
    modulos.push({
      titulo: "Tabelas e espelhos",
      descricao: "Envio de tabelas e espelhos dos concorrentes, lidos por IA.",
      emBreve: true,
    });
  }
  if (temPermissao(p, "gerirUsuarios")) {
    modulos.push({
      titulo: "Usuários",
      descricao: p.includes("admin") ? "Cadastrar pessoas, perfis e convites." : "Cadastrar avaliadores e acessos temporários.",
      href: "/gestor/usuarios",
    });
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-8 px-6 py-12">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-brand">Market Share · Sousa Araujo</p>
          <h1 className="mt-2 text-2xl font-bold text-ink">Olá, {u.nome.split(" ")[0]}</h1>
          <p className="mt-1 text-sm text-ink/60">
            {p.filter(ehPerfil).map((x) => ROTULO_PERFIL[x]).join(" · ")}
          </p>
        </div>
        <form action={sair}>
          <button className="btn-ghost">Sair</button>
        </form>
      </header>

      {modulos.length === 0 ? (
        <p className="card text-ink/70">Seu perfil ainda não tem módulos liberados. Fale com a coordenação.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {modulos.map((m) =>
            m.href ? (
              <Link key={m.titulo} href={m.href} className="card transition hover:border-brand/40">
                <p className="text-lg font-semibold text-ink">{m.titulo}</p>
                <p className="mt-1 text-sm text-ink/60">{m.descricao}</p>
              </Link>
            ) : (
              <div key={m.titulo} className="card opacity-60">
                <p className="text-lg font-semibold text-ink">{m.titulo}</p>
                <p className="mt-1 text-sm text-ink/60">{m.descricao}</p>
                <p className="mt-3 text-xs font-semibold uppercase tracking-widest text-ink/50">Em breve</p>
              </div>
            ),
          )}
        </div>
      )}
    </main>
  );
}
