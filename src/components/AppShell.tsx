"use client";

/**
 * Estrutura padrão das telas: navbar (logo e menu da pessoa) em cima e, abaixo,
 * o menu lateral do design system: trilho (ícones dos módulos) + painel (itens
 * do módulo escolhido). O botão ☰ no topo do trilho recolhe o painel com
 * animação; o conteúdo ocupa a largura que sobrar. A escolha fica guardada no
 * navegador. Ícones: Lucide. Classes ms-* de public/design/ms.css.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ChartColumn, Eye, FileText, House, Menu as MenuIcon, Receipt, Users, type LucideIcon } from "lucide-react";
import Navbar from "@/components/Navbar";
import type { Icone, Menu, ModuloMenu } from "@/lib/menu";

const CHAVE_RECOLHIDO = "ms-menu-recolhido";

const ICONES: Record<Icone, LucideIcon> = { home: House, chart: ChartColumn, eye: Eye, doc: FileText, users: Users, receipt: Receipt };

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

/** Mesma largura do @media do menu em public/design/ms.css. */
function ehCelular(): boolean {
  return window.matchMedia("(max-width: 720px)").matches;
}

export default function AppShell({ menu, children }: { menu: Menu; children: React.ReactNode }) {
  const caminho = usePathname();
  const atual = itemAtual(menu, caminho);
  const [aberto, setAberto] = useState<string>(atual.modulo ?? menu.modulos[0]?.id ?? "");
  const [recolhido, setRecolhido] = useState(false);
  // Sem animação até ler a escolha salva, para a tela não "fechar" sozinha ao abrir.
  const [pronto, setPronto] = useState(false);

  useLayoutEffect(() => {
    // No celular o painel abre por cima do conteúdo, então a tela sempre começa com ele fechado.
    if (ehCelular()) setRecolhido(true);
    else try { setRecolhido(localStorage.getItem(CHAVE_RECOLHIDO) === "1"); } catch { /* sem armazenamento */ }
    const t = requestAnimationFrame(() => setPronto(true));
    return () => cancelAnimationFrame(t);
  }, []);
  useEffect(() => { if (atual.modulo) setAberto(atual.modulo); }, [atual.modulo]);

  // Celular: tocar fora do menu aberto fecha o painel.
  const dual = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (recolhido) return;
    const fora = (e: PointerEvent) => {
      if (ehCelular() && !dual.current?.contains(e.target as Node)) setRecolhido(true);
    };
    document.addEventListener("pointerdown", fora);
    return () => document.removeEventListener("pointerdown", fora);
  }, [recolhido]);

  function alternar() {
    setRecolhido((r) => {
      // A escolha só fica guardada no computador; no celular o painel é uma gaveta.
      if (!ehCelular()) try { localStorage.setItem(CHAVE_RECOLHIDO, r ? "0" : "1"); } catch { /* sem armazenamento */ }
      return !r;
    });
  }

  const modulo: ModuloMenu | undefined = menu.modulos.find((m) => m.id === aberto);
  const temPendencia = (m: ModuloMenu) => m.grupos.some((g) => g.itens.some((i) => i.contador));

  return (
    <div className="ms-app">
      <Navbar usuario={menu.usuario} />
      <div className="ms-shell">
      <div ref={dual} className={`ms-dual${recolhido ? " is-collapsed" : ""}`} data-pronto={pronto ? "" : undefined}>
        <div className="ms-rail">
          <button
            type="button"
            className="ms-rail-menu"
            onClick={alternar}
            title={recolhido ? "Expandir menu" : "Recolher menu"}
            aria-expanded={!recolhido}
            aria-controls="ms-painel"
          >
            <MenuIcon size={18} aria-hidden="true" />
          </button>
          {menu.modulos.map((m) => {
            const Ic = ICONES[m.icone];
            return (
              <a
                key={m.id}
                href="#"
                title={m.nome}
                aria-current={m.id === aberto ? "page" : undefined}
                onClick={(e) => {
                  e.preventDefault();
                  // Clicar no módulo que já está aberto recolhe (ou reabre) o painel.
                  if (m.id === aberto && !recolhido) { alternar(); return; }
                  setAberto(m.id);
                  if (recolhido) alternar();
                }}
              >
                <Ic size={18} aria-hidden="true" />
                {temPendencia(m) && <span className="ms-dot" />}
              </a>
            );
          })}
        </div>
        {modulo && (
          <nav className="ms-panel" id="ms-painel" aria-label={modulo.nome} aria-hidden={recolhido} style={{ overflowY: "auto" }}>
            <h4>{modulo.nome}</h4>
            {modulo.grupos.map((g) => (
              <div key={g.nome}>
                <div className="ms-panel-group">{g.nome}</div>
                {g.itens.map((i) =>
                  i.href ? (
                    <a key={i.nome} href={i.href} aria-current={i.href === atual.href ? "page" : undefined} tabIndex={recolhido ? -1 : undefined}>
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
    </div>
  );
}
