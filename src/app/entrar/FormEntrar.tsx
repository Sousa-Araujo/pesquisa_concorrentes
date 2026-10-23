"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { confirmarCodigo, solicitarCodigo, type TipoAcesso } from "./actions";

export default function FormEntrar({
  emailInicial,
  veioDeConvite,
}: {
  emailInicial: string;
  veioDeConvite: boolean;
}) {
  const router = useRouter();
  const [email, setEmail] = useState(emailInicial);
  const [codigo, setCodigo] = useState("");
  const [etapa, setEtapa] = useState<"email" | "escolher" | "codigo">("email");
  const [tipo, setTipo] = useState<TipoAcesso>("equipe");
  const [aviso, setAviso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  // Quem chega na tela de entrada não pode ver o menu guardado de outra pessoa (public/design/shell.js).
  useEffect(() => { try { sessionStorage.removeItem("ms-menu-cache"); } catch { /* sem armazenamento */ } }, []);

  async function enviarCodigo(escolhido?: TipoAcesso) {
    setErro(null); setAviso(null);
    setCarregando(true);
    const r = await solicitarCodigo(email, escolhido ?? (etapa === "codigo" ? tipo : undefined));
    setCarregando(false);
    if (!r.ok) { setErro(r.erro); return; }
    // O mesmo e-mail é da equipe e de um agente de campo: a pessoa escolhe por onde entrar.
    if ("escolher" in r) { setEtapa("escolher"); return; }
    setTipo(r.tipo);
    setEtapa("codigo");
    setCodigo("");
    setAviso(`Se ${email.trim()} estiver cadastrado, você vai receber um código de 6 números em instantes.`);
  }

  async function entrar() {
    setErro(null);
    setCarregando(true);
    const r = await confirmarCodigo(email, codigo, tipo);
    if (!r.ok) { setCarregando(false); setErro(r.erro); return; }
    router.replace(r.destino);
    router.refresh();
  }

  return (
    <main className="grid min-h-dvh md:grid-cols-[1.1fr_1fr]">
      <section
        className="hidden flex-col justify-between p-12 md:flex"
        style={{ background: "var(--brand-deep)", color: "var(--on-brand)" }}
      >
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/design/logo-sousa-araujo-branco.svg" alt="Construtora Sousa Araujo" height={40} style={{ height: 40, width: "auto" }} />
          <small className="mt-2 block text-[11px] font-medium uppercase tracking-[0.14em] opacity-80">Market Share</small>
        </div>
        <div className="max-w-md">
          <h2 className="text-[32px] font-bold leading-[38px]">Pesquisa de concorrentes e Cliente Oculto num só lugar.</h2>
          <p className="mt-3 opacity-80">Equipe e agentes de campo entram por aqui, sem senha: você recebe um código no seu e-mail.</p>
        </div>
        <p className="text-xs opacity-70">Uso interno · Sousa Araujo</p>
      </section>

      <section className="flex flex-col justify-center px-6 py-12" style={{ background: "var(--surface)" }}>
        <div className="mx-auto grid w-full max-w-sm gap-5">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.1em]" style={{ color: "var(--brand-text)" }}>Market Share · Sousa Araujo</p>
            <h1 className="mt-2 text-2xl font-bold text-ink">
              {etapa === "email" ? "Entrar no sistema" : etapa === "escolher" ? "Por onde você quer entrar?" : "Digite o código"}
            </h1>
            {etapa === "email" && !veioDeConvite && (
              <p className="mt-1 text-sm" style={{ color: "var(--text-2)" }}>Informe seu e-mail. Enviamos um código de acesso.</p>
            )}
            {etapa === "email" && veioDeConvite && (
              <p className="mt-1 text-sm" style={{ color: "var(--text-2)" }}>Confira seu e-mail e clique em Enviar código.</p>
            )}
          </div>

          {etapa === "escolher" ? (
            <div className="grid gap-2">
              <p className="text-sm" style={{ color: "var(--text-2)" }}>
                {email.trim()} está cadastrado na equipe e como agente de campo.
              </p>
              <button className="btn-primary" onClick={() => enviarCodigo("equipe")} disabled={carregando}>
                Entrar como equipe Sousa Araujo
              </button>
              <button className="btn-secundario" onClick={() => enviarCodigo("agente")} disabled={carregando}>
                Entrar como agente de campo
              </button>
            </div>
          ) : etapa === "email" ? (
            <div>
              <label className="rotulo" htmlFor="email">E-mail</label>
              <input
                id="email"
                type="email"
                className="campo"
                autoComplete="email"
                placeholder="seu@email.com.br"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && email && enviarCodigo()}
              />
            </div>
          ) : (
            <div>
              <label className="rotulo" htmlFor="codigo">Código recebido no e-mail</label>
              <input
                id="codigo"
                className="campo text-center text-2xl font-bold tracking-[0.5em]"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                autoFocus
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
                onKeyDown={(e) => e.key === "Enter" && codigo.length === 6 && entrar()}
              />
            </div>
          )}

          {aviso && <p className="ms-alert ms-alert--info" role="status">{aviso}</p>}
          {erro && <p className="ms-alert ms-alert--error" role="alert">{erro}</p>}

          {etapa === "escolher" ? (
            <button className="btn-ghost" onClick={() => { setEtapa("email"); setErro(null); }} disabled={carregando}>
              Usar outro e-mail
            </button>
          ) : etapa === "email" ? (
            <button className="btn-primary" onClick={() => enviarCodigo()} disabled={carregando || !email}>
              {carregando ? "Enviando…" : "Receber código"}
            </button>
          ) : (
            <div className="grid gap-2">
              <button className="btn-primary" onClick={entrar} disabled={carregando || codigo.length !== 6}>
                {carregando ? "Entrando…" : "Entrar"}
              </button>
              <div className="flex justify-between">
                <button className="btn-ghost" onClick={() => enviarCodigo(tipo)} disabled={carregando}>Reenviar código</button>
                <button
                  className="btn-ghost"
                  onClick={() => { setEtapa("email"); setAviso(null); setErro(null); }}
                  disabled={carregando}
                >
                  Usar outro e-mail
                </button>
              </div>
            </div>
          )}

          <p className="text-center text-xs" style={{ color: "var(--text-2)" }}>
            Não há senha. O sistema reconhece se você é da equipe ou agente de campo e abre a tela certa.
          </p>
        </div>
      </section>
    </main>
  );
}
