import AppShell from "@/components/AppShell";
import { exigirPagina } from "@/lib/auth/acesso";
import { montarMenu } from "@/lib/menu";

// Telas internas com o menu lateral do design system (trilho + painel).
// Os módulos e itens de cada perfil vêm de src/lib/menu.ts.
export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  // Cada página confere a própria permissão; aqui basta ter acesso a algum módulo do painel.
  const u = await exigirPagina("painelPesquisa", "gerirUsuarios", "tabelasEnviar", "tabelasConferir", "recibos");
  const menu = await montarMenu(u);
  return (
    <AppShell menu={menu}>
      <div className="w-full px-6 py-6">{children}</div>
    </AppShell>
  );
}
