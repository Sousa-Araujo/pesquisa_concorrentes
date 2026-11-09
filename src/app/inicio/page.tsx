import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import { usuarioAtual } from "@/lib/auth/acesso";
import { montarMenu, telaInicial } from "@/lib/menu";

export const dynamic = "force-dynamic";

/**
 * Depois do login cada perfil cai direto na tela principal do seu trabalho
 * (design system: "Tela inicial de cada perfil"). Sem tela própria para o
 * perfil (ex.: Supervisor de Parcerias, enquanto o módulo de tabelas não
 * sai), mostra um aviso dentro do menu.
 */
export default async function InicioPage() {
  const u = await usuarioAtual();
  if (!u) redirect("/entrar");
  const destino = telaInicial(u.perfis);
  if (destino) redirect(destino);

  const menu = await montarMenu(u);
  return (
    <AppShell menu={menu}>
      <div className="ms-pagehead"><div><h1>Olá, {u.nome.split(" ")[0]}</h1><p>Market Share · Sousa Araujo</p></div></div>
      <div className="ms-content">
        <p className="ms-alert ms-alert--info" role="status">
          {menu.modulos.length
            ? "O módulo Tabelas e espelhos está em construção. Assim que for liberado, ele aparece aqui."
            : "Seu perfil ainda não tem módulos liberados. Fale com a coordenação."}
        </p>
      </div>
    </AppShell>
  );
}
