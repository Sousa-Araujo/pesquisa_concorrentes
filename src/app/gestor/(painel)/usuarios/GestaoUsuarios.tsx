"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Pencil } from "lucide-react";
import Modal from "@/components/Modal";
import type { LinhaUsuario } from "@/lib/data/gestor";
import { DOMINIO_EMAIL_EMPRESA, PERFIS, ROTULO_PERFIL, ehPerfil, type Perfil } from "@/lib/auth/perfis";
import { criarUsuario, definirStatusUsuario, editarUsuario, reenviarConvite, testarEnvioEmail } from "./actions";
import CampoData from "@/components/CampoData";

function dataCurta(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function diaBr(ymd: string): string {
  const [a, m, d] = ymd.split("-");
  return `${d}/${m}/${a}`;
}

export default function GestaoUsuarios({
  itens, idUsuarioAtual, ehAdmin,
}: {
  itens: LinhaUsuario[];
  idUsuarioAtual: string;
  ehAdmin: boolean;
}) {
  const router = useRouter();
  const [criando, setCriando] = useState(false);
  const [editando, setEditando] = useState<LinhaUsuario | null>(null);
  const [mensagem, setMensagem] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  async function executar(acao: () => Promise<{ ok: true; aviso?: string } | { ok: false; erro: string }>) {
    setMensagem(null);
    const r = await acao();
    if (r.ok) {
      if (r.aviso) setMensagem({ tipo: "ok", texto: r.aviso });
      router.refresh();
    } else {
      setMensagem({ tipo: "erro", texto: r.erro });
    }
  }

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">{ehAdmin ? "Usuários" : "Avaliadores"}</h1>
          <p className="text-sm text-ink/50">
            Sem senha: ao cadastrar, a pessoa recebe um convite por e-mail e entra com um código.
            Sem exclusão — apenas inativação.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {ehAdmin && (
            <button className="btn-acao" title="Envia um e-mail de teste para você" onClick={() => executar(testarEnvioEmail)}>
              <Mail size={13} aria-hidden="true" />Testar envio de e-mail
            </button>
          )}
          <button className="btn-primary btn-cabecalho" onClick={() => { setMensagem(null); setCriando(true); }}>
            {ehAdmin ? "Cadastrar usuário" : "Cadastrar avaliador"}
          </button>
        </div>
      </div>

      {mensagem && (
        <p
          role={mensagem.tipo === "erro" ? "alert" : "status"}
          className={`rounded-lg px-4 py-3 text-sm ${mensagem.tipo === "erro" ? "bg-red-50 text-red-700" : "bg-brand/10 text-ink"}`}
        >
          {mensagem.texto}
        </p>
      )}

      <div className="card overflow-x-auto !p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-black/[.06] text-ink/50">
            <tr>
              <th className="px-4 py-3 font-medium">Nome</th>
              <th className="px-4 py-3 font-medium">Perfis</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Último acesso</th>
              <th className="px-4 py-3 text-right font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {itens.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-ink/50">Nenhum usuário cadastrado.</td></tr>
            )}
            {itens.map((u) => {
              const ehVoce = u.id_usuario === idUsuarioAtual;
              return (
                <tr key={u.id_usuario} className="border-b border-black/[.04] align-top">
                  <td className="px-4 py-3">
                    <p className="font-medium text-ink">{u.nome}{ehVoce && <span className="ml-1 text-xs text-ink/40">(você)</span>}</p>
                    <p className="text-xs text-ink/50">{u.email}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-ink/70">
                    {u.perfis.filter(ehPerfil).map((p) => ROTULO_PERFIL[p]).join(", ")}
                  </td>
                  <td className="px-4 py-3">
                    <StatusUsuario u={u} />
                  </td>
                  <td className="px-4 py-3 text-ink/60">
                    {u.ultimo_acesso_em ? dataCurta(u.ultimo_acesso_em) : (
                      <span className="text-xs">{u.convite_enviado_em ? `Convite em ${dataCurta(u.convite_enviado_em)}` : "Nunca entrou"}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="acoes-linha">
                      <button className="btn-acao" onClick={() => { setMensagem(null); setEditando(u); }}><Pencil size={13} aria-hidden="true" />Editar</button>
                      {u.ativo && (
                        <button className="btn-acao btn-acao--neutro" onClick={() => executar(() => reenviarConvite(u.id_usuario))}>
                          Reenviar convite
                        </button>
                      )}
                      {!ehVoce && (
                        <button className="btn-acao btn-acao--neutro" onClick={() => executar(() => definirStatusUsuario(u.id_usuario, !u.ativo))}>
                          {u.ativo ? "Inativar" : "Ativar"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {(criando || editando) && (
        <FormUsuario
          usuario={editando}
          ehAdmin={ehAdmin}
          onFechar={() => { setCriando(false); setEditando(null); }}
          onSalvo={(aviso) => {
            setCriando(false); setEditando(null);
            if (aviso) setMensagem({ tipo: "ok", texto: aviso });
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function StatusUsuario({ u }: { u: LinhaUsuario }) {
  if (!u.ativo) return <span className="rounded bg-black/10 px-2 py-0.5 text-xs text-ink/50">Inativo</span>;
  if (u.acesso_expirado) return <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">Acesso expirado</span>;
  return (
    <div>
      <span className="ms-tag ms-tag--good">Ativo</span>
      {u.acesso_ate && <p className="mt-1 text-xs text-ink/50">até {diaBr(u.acesso_ate)}</p>}
    </div>
  );
}

function FormUsuario({
  usuario, ehAdmin, onFechar, onSalvo,
}: {
  usuario: LinhaUsuario | null;
  ehAdmin: boolean;
  onFechar: () => void;
  onSalvo: (aviso?: string) => void;
}) {
  const [nome, setNome] = useState(usuario?.nome ?? "");
  const [email, setEmail] = useState(usuario?.email ?? "");
  const [perfis, setPerfis] = useState<string[]>(usuario?.perfis ?? (ehAdmin ? [] : ["avaliador"]));
  const [temporario, setTemporario] = useState(Boolean(usuario?.acesso_ate));
  const [ate, setAte] = useState(usuario?.acesso_ate ?? "");
  const [ativo, setAtivo] = useState(usuario?.ativo ?? true);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  function alternar(p: Perfil) {
    setPerfis((atual) => (atual.includes(p) ? atual.filter((x) => x !== p) : [...atual, p]));
  }

  async function salvar() {
    setErro(null);
    if (temporario && !ate) { setErro("Informe até quando o acesso vale."); return; }
    setSalvando(true);
    const dados = { nome, email, perfis, acesso_expira_em: temporario ? ate : "", ativo };
    const r = usuario ? await editarUsuario(usuario.id_usuario, dados) : await criarUsuario(dados);
    setSalvando(false);
    if (r.ok) onSalvo(r.aviso);
    else setErro(r.erro);
  }

  const titulo = usuario ? "Editar usuário" : ehAdmin ? "Cadastrar usuário" : "Cadastrar avaliador";
  return (
    <Modal titulo={titulo} onFechar={onFechar}>
      <h2 className="text-lg font-semibold text-ink">{titulo}</h2>
      <div className="mt-4 grid gap-4">
        <div>
          <label className="rotulo" htmlFor="u-nome">Nome</label>
          <input id="u-nome" className="campo !text-base !py-2" value={nome} onChange={(e) => setNome(e.target.value)} />
        </div>
        <div>
          <label className="rotulo" htmlFor="u-email">E-mail</label>
          <input id="u-email" className="campo !text-base !py-2" type="email" autoComplete="off" value={email}
            onChange={(e) => setEmail(e.target.value)} />
          <p className="mt-1 text-xs text-ink/40">
            Qualquer e-mail; o administrador precisa ser @{DOMINIO_EMAIL_EMPRESA}.
            {!usuario && " O convite de acesso será enviado para este endereço."}
          </p>
        </div>

        {ehAdmin && (
          <fieldset>
            <legend className="rotulo">Perfis</legend>
            <div className="grid gap-2">
              {PERFIS.map((p) => (
                <label key={p} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={perfis.includes(p)} onChange={() => alternar(p)} />
                  {ROTULO_PERFIL[p]}
                </label>
              ))}
            </div>
          </fieldset>
        )}

        <div className="grid gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={temporario} onChange={(e) => setTemporario(e.target.checked)} />
            Acesso temporário
          </label>
          {temporario && (
            <div>
              <label className="rotulo" htmlFor="u-ate">Acesso vale até (inclusive)</label>
              <CampoData id="u-ate" tipo="data" value={ate} onChange={setAte} />
              <p className="mt-1 text-xs text-ink/40">Depois desse dia o acesso expira sozinho. Para recontratar, basta mudar a data.</p>
            </div>
          )}
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
          Usuário ativo
        </label>
        {erro && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{erro}</p>}
      </div>
      <div className="mt-5 flex gap-3">
        <button className="btn-secundario flex-1" onClick={onFechar}>Cancelar</button>
        <button className="btn-primary flex-1" onClick={salvar} disabled={salvando || !nome.trim() || !email.trim()}>
          {salvando ? "Salvando…" : usuario ? "Salvar" : "Salvar e enviar convite"}
        </button>
      </div>
    </Modal>
  );
}
