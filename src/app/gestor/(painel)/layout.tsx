import Link from "next/link";
import { exigirPagina } from "@/lib/auth/acesso";
import { temPermissao, type Permissao } from "@/lib/auth/perfis";
import { sair } from "../../entrar/actions";

// Seção 26: menu mínimo (Dashboard, Pesquisas, Agentes, Concorrentes,
// Empreendimentos) + Dados próprios + Usuários. Cada item só aparece para
// os perfis que têm a permissão correspondente (src/lib/auth/perfis.ts).
const NAV: { href: string; label: string; permissao: Permissao }[] = [
  { href: "/gestor", label: "Dashboard", permissao: "painelPesquisa" },
  { href: "/gestor/pesquisas", label: "Pesquisas", permissao: "painelPesquisa" },
  { href: "/gestor/agentes", label: "Agentes", permissao: "auditoriaPesquisa" },
  { href: "/gestor/concorrentes", label: "Concorrentes", permissao: "cadastros" },
  { href: "/gestor/empreendimentos", label: "Empreendimentos", permissao: "cadastros" },
  { href: "/gestor/dados-proprios", label: "Dados próprios", permissao: "auditoriaPesquisa" },
  { href: "/gestor/usuarios", label: "Usuários", permissao: "gerirUsuarios" },
];

export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  const g = await exigirPagina("painelPesquisa", "gerirUsuarios");
  const nav = NAV.filter((n) => temPermissao(g.perfis, n.permissao));

  return (
    <div className="min-h-dvh">
      <header className="border-b border-black/[.06] bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <nav className="flex items-center gap-1">
            <Link href="/inicio" className="mr-4 font-bold text-brand">Market Share</Link>
            {nav.map((n) => (
              <Link key={n.href} href={n.href}
                className="rounded-lg px-3 py-2 text-sm font-medium text-ink/70 hover:bg-black/5">
                {n.label}
              </Link>
            ))}
          </nav>
          <form action={sair}>
            <button className="btn-ghost">Sair ({g.nome})</button>
          </form>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-6 py-8">{children}</div>
    </div>
  );
}
