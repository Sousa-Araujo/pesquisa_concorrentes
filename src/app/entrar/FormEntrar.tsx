"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { confirmarCodigo, solicitarCodigo } from "./actions";

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
  const [etapa, setEtapa] = useState<"email" | "codigo">("email");
  const [aviso, setAviso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function enviarCodigo() {
    setErro(null); setAviso(null);
    setCarregando(true);
    const r = await solicitarCodigo(email);
    setCarregando(false);
    if (!r.ok) { setErro(r.erro); return; }
    setEtapa("codigo");
    setCodigo("");
    setAviso(`Se ${email.trim()} estiver cadastrado, você vai receber um código de 6 números em instantes.`);
  }

  async function entrar() {
    setErro(null);
    setCarregando(true);
    const r = await confirmarCodigo(email, codigo);
    if (!r.ok) { setCarregando(false); setErro(r.erro); return; }
    router.replace("/inicio");
    router.refresh();
  }

  return (
    <main className="grid min-h-dvh md:grid-cols-[1.1fr_1fr]">
      <section
        className="hidden flex-col justify-between p-12 md:flex"
        style={{ background: "var(--brand-deep)", color: "var(--on-brand)" }}
      >
        <div className="flex items-center gap-3">
          <span className="ms-brand-mark">SA</span>
          <span className="text-sm font-bold tracking-wide">
            SOUSA ARAUJO
            <small className="block text-[11px] font-medium uppercase tracking-[0.14em] opacity-80">Market Share</small>
          </span>
        </div>
        <div className="max-w-md">
          <h2 className="text-[32px] font-bold leading-[38px]">Pesquisa de concorrentes e Cliente Oculto num só lugar.</h2>
          <p className="mt-3 opacity-80">Acesso sem senha: você recebe um código no seu e-mail.</p>
        </div>
        <p className="text-xs opacity-70">Uso interno · Sousa Araujo</p>
      </section>

      <section className="flex flex-col justify-center px-6 py-12" style={{ background: "var(--surface)" }}>
        <div className="mx-auto grid w-full max-w-sm gap-5">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.1em]" style={{ color: "var(--brand-text)" }}>Market Share · Sousa Araujo</p>
            <h1 className="mt-2 text-2xl font-bold text-ink">
              {etapa === "email" ? "Entrar" : "Digite o código"}
            </h1>
            {etapa === "email" && veioDeConvite && (
              <p className="mt-1 text-sm" style={{ color: "var(--text-2)" }}>Confira seu e-mail e clique em Enviar código.</p>
            )}
          </div>

          {etapa === "email" ? (
            <div>
              <label className="rotulo" htmlFor="email">E-mail</label>
              <input
                id="email"
                type="email"
                className="campo"
                autoComplete="email"
                placeholder="nome@sousaaraujo.com.br"
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

          {etapa === "email" ? (
            <button className="btn-primary" onClick={enviarCodigo} disabled={carregando || !email}>
              {carregando ? "Enviando…" : "Enviar código"}
            </button>
          ) : (
            <div className="grid gap-2">
              <button className="btn-primary" onClick={entrar} disabled={carregando || codigo.length !== 6}>
                {carregando ? "Entrando…" : "Entrar"}
              </button>
              <div className="flex justify-between">
                <button className="btn-ghost" onClick={enviarCodigo} disabled={carregando}>Reenviar código</button>
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
            Não há senha. O acesso é liberado para quem foi cadastrado pela coordenação.
          </p>
        </div>
      </section>
    </main>
  );
}
