"use client";

/**
 * Navbar do design system: logo da Sousa Araujo à esquerda e, à direita, o
 * menu da pessoa (engrenagem): nome, e-mail e perfil, foto do perfil, tema
 * escuro e sair. As telas do Cliente Oculto montam a mesma navbar em
 * public/design/shell.js.
 */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Camera, LogOut, Moon, Settings } from "lucide-react";
import type { Menu } from "@/lib/menu";
import { aplicarTema, enviarFoto, reduzirFoto, temaAtual } from "@/lib/cliente/perfil";

async function sair() {
  await fetch("/api/co/auth/logout", { method: "POST" }).catch(() => {});
  window.location.href = "/entrar";
}

export default function Navbar({ usuario }: { usuario: Menu["usuario"] }) {
  const [aberto, setAberto] = useState(false);
  const [escuro, setEscuro] = useState(false);
  const [foto, setFoto] = useState(usuario.foto);
  const caixa = useRef<HTMLDivElement>(null);
  const arquivo = useRef<HTMLInputElement>(null);

  useEffect(() => { setEscuro(temaAtual() === "dark"); }, []);
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => { if (!caixa.current?.contains(e.target as Node)) setAberto(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setAberto(false); };
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [aberto]);

  async function trocarFoto(f: File | undefined) {
    if (!f) return;
    try {
      const nova = await reduzirFoto(f);
      await enviarFoto(nova);
      setFoto(nova);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Não foi possível salvar a foto.");
    }
  }

  function alternarTema() {
    aplicarTema(escuro ? "light" : "dark");
    setEscuro(!escuro);
  }

  return (
    <header className="ms-topbar">
      <Link href="/inicio" className="ms-topbar-logo" aria-label="Início">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="ms-logo-claro" src="/design/logo-sousa-araujo.svg" alt="Construtora Sousa Araujo" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="ms-logo-escuro" src="/design/logo-sousa-araujo-branco.svg" alt="Construtora Sousa Araujo" />
      </Link>
      <div className="ms-topbar-acoes" ref={caixa}>
        <button
          type="button"
          className="ms-icon-btn"
          title="Minha conta"
          aria-haspopup="menu"
          aria-expanded={aberto}
          onClick={() => setAberto((a) => !a)}
        >
          <Settings aria-hidden="true" />
        </button>
        <div className="ms-user-menu" role="menu" hidden={!aberto}>
          <div className="ms-user-head">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <span className="ms-avatar">{foto ? <img src={foto} alt="" /> : usuario.iniciais}</span>
            <div>
              <b>{usuario.nome}</b>
              <small title={usuario.email}>{usuario.email}</small>
              <small>{usuario.perfil}</small>
            </div>
          </div>
          <div className="ms-user-sep" />
          <button type="button" role="menuitem" className="ms-user-item" onClick={() => arquivo.current?.click()}>
            <Camera aria-hidden="true" />
            Foto do perfil
          </button>
          <input
            ref={arquivo}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hidden
            onChange={(e) => { trocarFoto(e.target.files?.[0]); e.target.value = ""; }}
          />
          <button type="button" role="menuitemcheckbox" aria-checked={escuro} className="ms-user-item" onClick={alternarTema}>
            <Moon aria-hidden="true" />
            Tema escuro
            <span className="ms-switch" data-on={escuro} />
          </button>
          <div className="ms-user-sep" />
          <button type="button" role="menuitem" className="ms-user-item ms-user-item--sair" onClick={sair}>
            <LogOut aria-hidden="true" />
            Sair
          </button>
        </div>
      </div>
    </header>
  );
}
