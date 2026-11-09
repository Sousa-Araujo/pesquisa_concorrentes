"use client";

/**
 * Menu do celular (como nos apps de compra): barra fixa embaixo com os módulos.
 * Tocar num módulo abre uma gaveta de baixo para cima com os itens dele; se o
 * módulo tem um item só, vai direto. Até 5 módulos cabem; acima disso os 4
 * primeiros e "Mais". Quem só tem um módulo (ex.: avaliador) vê os itens dele
 * direto na barra. As telas do Cliente Oculto montam a mesma barra em
 * public/design/shell.js. Só aparece no celular (CSS em ms.css).
 */
import { useEffect, useState } from "react";
import { CircleEllipsis, type LucideIcon } from "lucide-react";
import type { Icone, Menu, ModuloMenu } from "@/lib/menu";

export default function BarraInferior({
  menu, icones, moduloAtual, hrefAtual,
}: { menu: Menu; icones: Record<Icone, LucideIcon>; moduloAtual?: string; hrefAtual?: string }) {
  const [gaveta, setGaveta] = useState<string | null>(null);

  useEffect(() => {
    if (!gaveta) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setGaveta(null); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [gaveta]);

  const itensComLink = (m: ModuloMenu) => m.grupos.flatMap((g) => g.itens).filter((i) => i.href);
  const pendente = (m: ModuloMenu) => m.grupos.some((g) => g.itens.some((i) => i.contador));

  // Um módulo só: os itens dele viram as abas.
  if (menu.modulos.length === 1) {
    const m = menu.modulos[0];
    return (
      <nav className="ms-bottomnav" aria-label="Menu">
        {itensComLink(m).map((i) => {
          const Ic = icones[i.icone ?? m.icone];
          return (
            <a key={i.nome} href={i.href} aria-current={i.href === hrefAtual ? "page" : undefined}>
              <Ic aria-hidden="true" /><span className="ms-bottomnav-rotulo">{i.nome}</span>
            </a>
          );
        })}
      </nav>
    );
  }

  // Módulos que já têm tela vêm primeiro; os "em breve" ficam por último (no "Mais").
  const ordem = [...menu.modulos].sort((a, b) => Number(itensComLink(b).length > 0) - Number(itensComLink(a).length > 0));
  const muitos = ordem.length > 5;
  const naBarra = muitos ? ordem.slice(0, 4) : ordem;
  const noMais = muitos ? ordem.slice(4) : [];
  const naGaveta = gaveta === "__mais" ? noMais : menu.modulos.filter((m) => m.id === gaveta);

  function tocar(m: ModuloMenu) {
    const itens = itensComLink(m);
    if (itens.length === 1) window.location.href = itens[0].href!;
    else setGaveta(m.id);
  }

  return (
    <>
      <nav className="ms-bottomnav" aria-label="Módulos">
        {naBarra.map((m) => {
          const Ic = icones[m.icone];
          return (
            <button key={m.id} type="button" onClick={() => tocar(m)} aria-current={m.id === moduloAtual ? "page" : undefined}>
              <Ic aria-hidden="true" />
              {pendente(m) && <span className="ms-dot" />}
              <span className="ms-bottomnav-rotulo">{m.curto}</span>
            </button>
          );
        })}
        {muitos && (
          <button type="button" onClick={() => setGaveta("__mais")}
            aria-current={noMais.some((m) => m.id === moduloAtual) ? "page" : undefined}>
            <CircleEllipsis aria-hidden="true" />
            {noMais.some(pendente) && <span className="ms-dot" />}
            <span className="ms-bottomnav-rotulo">Mais</span>
          </button>
        )}
      </nav>
      {gaveta && (
        <>
          <div className="ms-sheet-fundo" onClick={() => setGaveta(null)} />
          <div className="ms-sheet" role="dialog" aria-modal="true" aria-label={gaveta === "__mais" ? "Mais" : naGaveta[0]?.nome}>
            <div className="ms-sheet-alca" />
            {naGaveta.map((m) => (
              <div key={m.id}>
                <h4>{m.nome}</h4>
                {m.grupos.map((g) => (
                  <div key={g.nome}>
                    <div className="ms-sheet-grupo">{g.nome}</div>
                    {g.itens.map((i) => i.href ? (
                      <a key={i.nome} href={i.href} aria-current={i.href === hrefAtual ? "page" : undefined}>
                        {i.nome}{i.contador ? <span className="ms-count">{i.contador}</span> : null}
                      </a>
                    ) : (
                      <span key={i.nome} className="ms-sheet-off">{i.nome}</span>
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
