"use client";

import { useEffect, useState } from "react";
import Modal from "@/components/Modal";
import { formatarCompetenciaLonga } from "@/lib/domain/competencia";
import {
  solicitarCodigoAgente,
  entrarAgente,
  sairAgente,
  actRegionais,
  actCidades,
  actEmpreendimentos,
  actConcorrentes,
  cadastrarConcorrente,
  salvarColeta,
  type AgenteSessao,
  type ResumoColeta,
} from "./actions";
import CampoData from "@/components/CampoData";

type Opcao = { valor: string; texto: string };

export default function AgenteFluxo({
  competenciaInicial,
  agenteInicial,
}: {
  competenciaInicial: string;
  agenteInicial: AgenteSessao | null;
}) {
  const [agente, setAgente] = useState<AgenteSessao | null>(agenteInicial);

  if (!agente) {
    return <Login onOk={setAgente} />;
  }
  return (
    <Formulario
      agente={agente}
      competenciaInicial={competenciaInicial}
      onTrocarAgente={async () => { await sairAgente(); setAgente(null); }}
    />
  );
}

/* ------------------------------- Login ------------------------------- */
function Login({ onOk }: { onOk: (a: AgenteSessao) => void }) {
  const [telefone, setTelefone] = useState("");
  const [codigo, setCodigo] = useState("");
  const [etapa, setEtapa] = useState<"telefone" | "codigo">("telefone");
  const [aviso, setAviso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function pedirCodigo() {
    setErro(null); setAviso(null);
    setCarregando(true);
    const r = await solicitarCodigoAgente(telefone);
    setCarregando(false);
    if (!r.ok) { setErro(r.erro); return; }
    setEtapa("codigo");
    setAviso(r.data.canal === "email"
      ? "Enviamos um código de 6 números para o seu e-mail cadastrado."
      : "Enviamos um código de 6 números por SMS.");
  }

  async function entrar() {
    setErro(null);
    setCarregando(true);
    const r = await entrarAgente(telefone, codigo);
    setCarregando(false);
    if (r.ok) onOk(r.data);
    else setErro(r.erro);
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-6 py-12">
      <div>
        <p className="text-sm font-semibold uppercase tracking-widest text-brand">
          Identificação do agente
        </p>
        <h1 className="mt-2 text-2xl font-bold text-ink">
          {etapa === "telefone" ? "Informe seu telefone" : "Digite o código"}
        </h1>
      </div>
      {etapa === "telefone" ? (
        <div>
          <label className="rotulo" htmlFor="tel">Telefone</label>
          <input
            id="tel"
            className="campo"
            inputMode="tel"
            autoComplete="tel"
            placeholder="(00) 00000-0000"
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && telefone && pedirCodigo()}
          />
        </div>
      ) : (
        <div>
          <label className="rotulo" htmlFor="codigo">Código</label>
          <input
            id="codigo"
            className="campo text-center text-2xl tracking-[0.5em]"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
            onKeyDown={(e) => e.key === "Enter" && codigo.length === 6 && entrar()}
          />
        </div>
      )}
      {aviso && <p className="rounded-lg bg-brand/5 px-4 py-3 text-sm text-ink/80">{aviso}</p>}
      {erro && <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>}
      {etapa === "telefone" ? (
        <button className="btn-primary" onClick={pedirCodigo} disabled={carregando || !telefone}>
          {carregando ? "Enviando…" : "Receber código"}
        </button>
      ) : (
        <>
          <button className="btn-primary" onClick={entrar} disabled={carregando || codigo.length !== 6}>
            {carregando ? "Verificando…" : "Entrar"}
          </button>
          <button className="btn-ghost" onClick={pedirCodigo} disabled={carregando}>
            Reenviar código
          </button>
          <button className="btn-ghost" onClick={() => { setEtapa("telefone"); setCodigo(""); setAviso(null); setErro(null); }}>
            Trocar telefone
          </button>
        </>
      )}
      <p className="text-center text-xs text-ink/40">
        O acesso é liberado apenas para telefones cadastrados pela coordenação.
      </p>
    </main>
  );
}

/* ----------------------------- Formulário ---------------------------- */
function Formulario({
  agente,
  competenciaInicial,
  onTrocarAgente,
}: {
  agente: AgenteSessao;
  competenciaInicial: string;
  onTrocarAgente: () => void;
}) {
  // Competência escolhida pelo agente ("YYYY-MM"); começa no mês vigente.
  const [competencia, setCompetencia] = useState(competenciaInicial);
  const competenciaMesAno = `${competencia}-01`;
  const competenciaLabel = /^\d{4}-\d{2}$/.test(competencia)
    ? formatarCompetenciaLonga(competenciaMesAno)
    : "—";

  const [regionais, setRegionais] = useState<Opcao[]>([]);
  const [cidades, setCidades] = useState<Opcao[]>([]);
  const [emps, setEmps] = useState<Opcao[]>([]);
  const [concs, setConcs] = useState<Opcao[]>([]);

  const [regional, setRegional] = useState("");
  const [idCidade, setIdCidade] = useState("");
  const [idEmp, setIdEmp] = useState("");
  const [idConc, setIdConc] = useState("");
  const [estoque, setEstoque] = useState("");
  const [vendas, setVendas] = useState("");

  const [modalNovo, setModalNovo] = useState(false);
  const [confirmarAtualizar, setConfirmarAtualizar] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [resumo, setResumo] = useState<(ResumoColeta & { rotulo: string }) | null>(null);

  useEffect(() => {
    actRegionais().then((rs) =>
      setRegionais(rs.map((r) => ({ valor: r.regional, texto: r.regional }))),
    );
  }, []);

  // Cascata: cada mudança limpa os níveis abaixo (seções 15–18).
  async function mudarRegional(v: string) {
    setRegional(v); setIdCidade(""); setIdEmp(""); setIdConc("");
    setCidades([]); setEmps([]); setConcs([]);
    if (v) {
      const cs = await actCidades(v);
      setCidades(cs.map((c) => ({ valor: String(c.id_cidade), texto: c.cidade })));
    }
  }
  async function mudarCidade(v: string) {
    setIdCidade(v); setIdEmp(""); setIdConc(""); setEmps([]); setConcs([]);
    if (v) {
      const es = await actEmpreendimentos(Number(v));
      setEmps(es.map((e) => ({ valor: String(e.id_empreendimento), texto: e.empreendimento })));
    }
  }
  async function mudarEmp(v: string) {
    setIdEmp(v); setIdConc(""); setConcs([]);
    if (v) await recarregarConcorrentes(Number(v));
  }
  async function recarregarConcorrentes(emp: number) {
    const cs = await actConcorrentes(emp);
    setConcs(cs.map((c) => ({ valor: String(c.id_concorrente), texto: c.concorrente })));
  }

  const rotuloConcorrente = concs.find((c) => c.valor === idConc)?.texto ?? "";

  async function salvar(atualizar = false) {
    setErro(null);
    if (!idConc || estoque === "" || vendas === "") {
      setErro("Selecione o concorrente e informe estoque e vendas.");
      return;
    }
    if (!/^\d{4}-\d{2}$/.test(competencia)) {
      setErro("Selecione a competência (mês/ano).");
      return;
    }
    setSalvando(true);
    const r = await salvarColeta({
      id_concorrente: Number(idConc),
      estoque: Number(estoque),
      vendas: Number(vendas),
      mes_ano: competenciaMesAno,
      atualizar,
    });
    setSalvando(false);

    if (r.ok) {
      setConfirmarAtualizar(null);
      setResumo({ ...r.data, rotulo: rotuloConcorrente });
      return;
    }
    if (r.jaExiste) {
      setConfirmarAtualizar(r.competencia ?? "");
      return;
    }
    setErro(r.erro);
  }

  function novaColeta() {
    // Mantém agente, regional, cidade, empreendimento, competência (seção 24).
    setResumo(null);
    setIdConc("");
    setEstoque("");
    setVendas("");
  }

  if (resumo) {
    return (
      <Resumo
        resumo={resumo}
        competenciaLabel={competenciaLabel}
        contexto={{
          regional,
          cidade: cidades.find((c) => c.valor === idCidade)?.texto ?? "",
          empreendimento: emps.find((e) => e.valor === idEmp)?.texto ?? "",
        }}
        onNova={novaColeta}
      />
    );
  }

  return (
    <main className="mx-auto max-w-md px-5 pb-24 pt-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-brand">Agente</p>
          <p className="text-lg font-semibold text-ink">{agente.nome}</p>
        </div>
        <button className="btn-ghost" onClick={onTrocarAgente}>Sair</button>
      </div>

      <div className="mb-4 rounded-xl bg-brand/5 px-4 py-3">
        <label className="rotulo" htmlFor="competencia">Competência</label>
        <CampoData id="competencia" tipo="mes" value={competencia} onChange={setCompetencia} />
        <p className="mt-1 text-xs text-brand">{competenciaLabel}</p>
      </div>

      <div className="grid gap-4">
        <Select label="Regional" value={regional} onChange={mudarRegional} options={regionais} />
        <Select label="Cidade" value={idCidade} onChange={mudarCidade} options={cidades} disabled={!regional} />
        <Select label="Empreendimento" value={idEmp} onChange={mudarEmp} options={emps} disabled={!idCidade} />

        <div>
          <div className="flex items-center justify-between">
            <label className="rotulo">Concorrente</label>
            {idEmp && (
              <button className="btn-ghost" onClick={() => setModalNovo(true)}>+ Novo concorrente</button>
            )}
          </div>
          <select
            className="campo"
            value={idConc}
            disabled={!idEmp}
            onChange={(e) => setIdConc(e.target.value)}
          >
            <option value="">Selecione…</option>
            {concs.map((o) => (
              <option key={o.valor} value={o.valor}>{o.texto}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="rotulo" htmlFor="est">Estoque atual</label>
            <input id="est" className="campo" inputMode="numeric" pattern="[0-9]*"
              value={estoque} onChange={(e) => setEstoque(e.target.value.replace(/\D/g, ""))} />
          </div>
          <div>
            <label className="rotulo" htmlFor="ven">Vendas no mês</label>
            <input id="ven" className="campo" inputMode="numeric" pattern="[0-9]*"
              value={vendas} onChange={(e) => setVendas(e.target.value.replace(/\D/g, ""))} />
          </div>
        </div>

        {erro && <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>}

        <button className="btn-primary" onClick={() => salvar(false)} disabled={salvando}>
          {salvando ? "Salvando…" : "Salvar coleta"}
        </button>
      </div>

      {modalNovo && (
        <ModalNovoConcorrente
          idEmpreendimento={Number(idEmp)}
          contexto={{
            regional,
            cidade: cidades.find((c) => c.valor === idCidade)?.texto ?? "",
            empreendimento: emps.find((e) => e.valor === idEmp)?.texto ?? "",
          }}
          onFechar={() => setModalNovo(false)}
          onCriado={async (id) => {
            setModalNovo(false);
            await recarregarConcorrentes(Number(idEmp));
            setIdConc(String(id));
          }}
        />
      )}

      {confirmarAtualizar !== null && (
        <Confirmacao
          competencia={confirmarAtualizar}
          onCancelar={() => setConfirmarAtualizar(null)}
          onAtualizar={() => salvar(true)}
          ocupado={salvando}
        />
      )}
    </main>
  );
}

/* ------------------------------ Auxiliares --------------------------- */
function Select({
  label, value, onChange, options, disabled,
}: {
  label: string; value: string; onChange: (v: string) => void;
  options: Opcao[]; disabled?: boolean;
}) {
  return (
    <div>
      <label className="rotulo">{label}</label>
      <select className="campo" value={value} disabled={disabled}
        onChange={(e) => onChange(e.target.value)}>
        <option value="">Selecione…</option>
        {options.map((o) => (
          <option key={o.valor} value={o.valor}>{o.texto}</option>
        ))}
      </select>
    </div>
  );
}

function ModalNovoConcorrente({
  idEmpreendimento, contexto, onFechar, onCriado,
}: {
  idEmpreendimento: number;
  contexto: { regional: string; cidade: string; empreendimento: string };
  onFechar: () => void;
  onCriado: (id: number) => void;
}) {
  const [nome, setNome] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    setErro(null); setSalvando(true);
    const r = await cadastrarConcorrente({ id_empreendimento: idEmpreendimento, nome });
    setSalvando(false);
    if (r.ok) onCriado(r.data.id_concorrente);
    else setErro(r.erro);
  }

  return (
    <Modal titulo="Cadastrar novo concorrente" onFechar={onFechar} alinhamento="base" largura="estreita">
      <h2 className="text-lg font-semibold text-ink">Cadastrar novo concorrente</h2>
      <p className="mt-1 text-sm text-ink/60">Informe apenas o nome. O código é gerado automaticamente.</p>
      {/* Contexto já definido pela seleção em cascata (seção 13: exibir
          Regional/Cidade/Empreendimento, mesmo preenchidos automaticamente). */}
      <div className="mt-3 rounded-lg bg-black/[.03] px-3 py-2 text-sm text-ink/70">
        <p>{contexto.regional} · {contexto.cidade}</p>
        <p className="font-medium text-ink">{contexto.empreendimento}</p>
      </div>
      <div className="mt-4">
        <label className="rotulo" htmlFor="nc">Nome do concorrente</label>
        <input id="nc" className="campo" value={nome}
          onChange={(e) => setNome(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && salvar()} />
      </div>
      {erro && <p role="alert" className="mt-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>}
      <div className="mt-5 flex gap-3">
        <button className="btn-secundario flex-1" onClick={onFechar}>
          Cancelar
        </button>
        <button className="btn-primary flex-1" onClick={salvar} disabled={salvando || !nome.trim()}>
          {salvando ? "Salvando…" : "Salvar"}
        </button>
      </div>
    </Modal>
  );
}

function Confirmacao({
  competencia, onCancelar, onAtualizar, ocupado,
}: {
  competencia: string; onCancelar: () => void; onAtualizar: () => void; ocupado: boolean;
}) {
  return (
    <Modal titulo="Coleta já existente" onFechar={onCancelar} alinhamento="base" largura="estreita">
      <h2 className="text-lg font-semibold text-ink">Coleta já existente</h2>
      <p className="mt-2 text-sm text-ink/70">
        Já existe uma coleta para este concorrente em <strong>{competencia}</strong>. Deseja atualizar?
      </p>
      <div className="mt-5 flex gap-3">
        <button className="btn-secundario flex-1" onClick={onCancelar}>
          Cancelar
        </button>
        <button className="btn-primary flex-1" onClick={onAtualizar} disabled={ocupado}>
          {ocupado ? "Atualizando…" : "Atualizar coleta"}
        </button>
      </div>
    </Modal>
  );
}

function Resumo({
  resumo, competenciaLabel, contexto, onNova,
}: {
  resumo: ResumoColeta & { rotulo: string };
  competenciaLabel: string;
  contexto: { regional: string; cidade: string; empreendimento: string };
  onNova: () => void;
}) {
  return (
    <main className="mx-auto max-w-md px-5 py-10">
      <div className="card">
        <div className="mb-4 flex items-center gap-2 text-brand">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand/10">✓</span>
          <p className="font-semibold">
            {resumo.atualizado ? "Coleta atualizada com sucesso." : "Coleta registrada com sucesso."}
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <Linha t="Regional" v={contexto.regional} />
          <Linha t="Cidade" v={contexto.cidade} />
          <Linha t="Empreendimento" v={contexto.empreendimento} full />
          <Linha t="Concorrente" v={resumo.rotulo} full />
          <Linha t="Competência" v={competenciaLabel} />
          <Linha t="Estoque" v={String(resumo.estoque)} />
          <Linha t="Vendas" v={String(resumo.vendas)} />
        </dl>
      </div>
      <button className="btn-primary mt-6" onClick={onNova}>Nova coleta</button>
    </main>
  );
}

function Linha({ t, v, full }: { t: string; v: string; full?: boolean }) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <dt className="text-ink/50">{t}</dt>
      <dd className="font-medium text-ink">{v || "—"}</dd>
    </div>
  );
}
