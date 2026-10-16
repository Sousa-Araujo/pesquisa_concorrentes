"use client";

/**
 * Menu lateral padrão do design system: trilho (ícones dos módulos) +
 * painel (itens do módulo escolhido). Recolher esconde o painel; a escolha
 * fica guardada no navegador. Classes ms-* de public/design/ms.css.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Icone, Menu, ModuloMenu } from "@/lib/menu";

const CHAVE_RECOLHIDO = "ms-menu-recolhido";

const ICONES: Record<Icone | "collapse" | "logout", React.ReactNode> = {
  home: <><path d="M4 11l8-7 8 7" /><path d="M6 10v9h12v-9" /></>,
  chart: <><path d="M4 20h16" /><rect x="6" y="11" width="3" height="6" rx="1" /><rect x="11" y="7" width="3" height="10" rx="1" /><rect x="16" y="13" width="3" height="4" rx="1" /></>,
  eye: <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
  doc: <><path d="M7 3h7l5 5v13H7z" /><path d="M14 3v5h5" /><path d="M10 13h6M10 17h6" /></>,
  users: <><circle cx="9" cy="8" r="3" /><path d="M3 20c0-3 3-5 6-5s6 2 6 5" /><circle cx="17" cy="9" r="2.5" /><path d="M16 15c3 0 5 2 5 4" /></>,
  collapse: <path d="M15 6l-6 6 6 6" />,
  logout: <><path d="M10 4H5v16h5" /><path d="M14 8l4 4-4 4M18 12H9" /></>,
};

function Ic({ nome }: { nome: keyof typeof ICONES }) {
  return <svg className="ms-icon" viewBox="0 0 24 24" aria-hidden="true">{ICONES[nome]}</svg>;
}

/** O item cujo href mais longo casa com o endereço atual. */
function itemAtual(menu: Menu, caminho: string): { modulo?: string; href?: string } {
  let melhor: { modulo?: string; href?: string; tam: number } = { tam: -1 };
  for (const m of menu.modulos) {
    for (const g of m.grupos) {
      for (const i of g.itens) {
        if (!i.href) continue;
        const casa = caminho === i.href || caminho.startsWith(i.href + "/");
        if (casa && i.href.length > melhor.tam) melhor = { modulo: m.id, href: i.href, tam: i.href.length };
      }
    }
  }
  return melhor;
}

async function sair() {
  await fetch("/api/co/auth/logout", { method: "POST" }).catch(() => {});
  window.location.href = "/entrar";
}

export default function AppShell({ menu, children }: { menu: Menu; children: React.ReactNode }) {
  const caminho = usePathname();
  const atual = itemAtual(menu, caminho);
  const [aberto, setAberto] = useState<string>(atual.modulo ?? menu.modulos[0]?.id ?? "");
  const [recolhido, setRecolhido] = useState(false);

  useEffect(() => {
    try { setRecolhido(localStorage.getItem(CHAVE_RECOLHIDO) === "1"); } catch { /* sem armazenamento */ }
  }, []);
  useEffect(() => { if (atual.modulo) setAberto(atual.modulo); }, [atual.modulo]);

  function alternar() {
    setRecolhido((r) => {
      try { localStorage.setItem(CHAVE_RECOLHIDO, r ? "0" : "1"); } catch { /* sem armazenamento */ }
      return !r;
    });
  }

  const modulo: ModuloMenu | undefined = menu.modulos.find((m) => m.id === aberto);
  const temPendencia = (m: ModuloMenu) => m.grupos.some((g) => g.itens.some((i) => i.contador));

  return (
    <div className="ms-shell" style={{ minHeight: "100dvh" }}>
      <div className={`ms-dual${recolhido ? " is-collapsed" : ""}`} style={{ position: "sticky", top: 0, height: "100dvh" }}>
        <div className="ms-rail">
          <Link href="/inicio" className="ms-brand-mark" title="Sousa Araujo · Market Share" style={{ textDecoration: "none" }}>SA</Link>
          {menu.modulos.map((m) => (
            <a
              key={m.id}
              href="#"
              title={m.nome}
              aria-current={m.id === aberto ? "page" : undefined}
              onClick={(e) => { e.preventDefault(); setAberto(m.id); if (recolhido) alternar(); }}
            >
              <Ic nome={m.icone} />
              {temPendencia(m) && <span className="ms-dot" />}
            </a>
          ))}
          <div className="ms-rail-foot">
            <button type="button" onClick={alternar} title={recolhido ? "Expandir menu" : "Recolher menu"} aria-expanded={!recolhido} aria-controls="ms-painel">
              <Ic nome="collapse" />
            </button>
            <button type="button" onClick={sair} title="Sair"><Ic nome="logout" /></button>
            <span className="ms-avatar" title={`${menu.usuario.nome} · ${menu.usuario.perfil}`}>{menu.usuario.iniciais}</span>
          </div>
        </div>
        {modulo && (
          <nav className="ms-panel" id="ms-painel" aria-label={modulo.nome} style={{ overflowY: "auto" }}>
            <h4>{modulo.nome}</h4>
            <p className="ms-panel-sub">{modulo.resumo}</p>
            {modulo.grupos.map((g) => (
              <div key={g.nome}>
                <div className="ms-panel-group">{g.nome}</div>
                {g.itens.map((i) =>
                  i.href ? (
                    <a key={i.nome} href={i.href} aria-current={i.href === atual.href ? "page" : undefined}>
                      {i.nome}
                      {i.contador ? <span className="ms-count">{i.contador}</span> : null}
                    </a>
                  ) : (
                    <span key={i.nome} className="ms-panel-off">{i.nome}</span>
                  ),
                )}
              </div>
            ))}
          </nav>
        )}
      </div>
      <div className="ms-main">{children}</div>
    </div>
  );
}
