import AppShell from "@/components/AppShell";
import { exigirPagina } from "@/lib/auth/acesso";
import { montarMenu } from "@/lib/menu";

// Telas internas com o menu lateral do design system (trilho + painel).
// Os módulos e itens de cada perfil vêm de src/lib/menu.ts.
export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  const u = await exigirPagina("painelPesquisa", "gerirUsuarios");
  const menu = await montarMenu(u);
  return (
    <AppShell menu={menu}>
      <div className="mx-auto w-full max-w-6xl px-6 py-8">{children}</div>
    </AppShell>
  );
}
