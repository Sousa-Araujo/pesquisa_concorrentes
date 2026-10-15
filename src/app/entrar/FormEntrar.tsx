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
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6 py-12">
      <div>
        <p className="text-sm font-semibold uppercase tracking-widest text-brand">Market Share · Sousa Araujo</p>
        <h1 className="mt-2 text-2xl font-bold text-ink">
          {etapa === "email" ? "Entrar" : "Digite o código"}
        </h1>
        {etapa === "email" && veioDeConvite && (
          <p className="mt-2 text-sm text-ink/60">Confira seu e-mail e clique em Enviar código.</p>
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
            className="campo text-center text-2xl tracking-[0.5em]"
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

      {aviso && <p className="rounded-lg bg-brand/5 px-4 py-3 text-sm text-ink/80">{aviso}</p>}
      {erro && <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>}

      {etapa === "email" ? (
        <button className="btn-primary" onClick={enviarCodigo} disabled={carregando || !email}>
          {carregando ? "Enviando…" : "Enviar código"}
        </button>
      ) : (
        <div className="grid gap-2">
          <button className="btn-primary" onClick={entrar} disabled={carregando || codigo.length !== 6}>
            {carregando ? "Entrando…" : "Entrar"}
          </button>
          <button className="btn-ghost" onClick={enviarCodigo} disabled={carregando}>Reenviar código</button>
          <button
            className="btn-ghost"
            onClick={() => { setEtapa("email"); setAviso(null); setErro(null); }}
            disabled={carregando}
          >
            Usar outro e-mail
          </button>
        </div>
      )}

      <p className="text-center text-xs text-ink/40">
        Não há senha. O acesso é liberado para quem foi cadastrado pela coordenação.
      </p>
    </main>
  );
}
