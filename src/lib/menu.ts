/**
 * Menu lateral (trilho + painel) do design system: os módulos e itens que
 * cada perfil enxerga e a tela inicial de cada perfil. Uma definição só,
 * usada pelo menu das telas em React e pelo das telas do Cliente Oculto
 * (via /api/menu).
 */
import "server-only";
import { db } from "@/lib/db/pool";
import { temPermissao, ROTULO_PERFIL, ehPerfil } from "@/lib/auth/perfis";
import { papelCO } from "@/lib/cliente-oculto/repo";
import type { UsuarioAtual } from "@/lib/auth/acesso";

export type Icone = "home" | "chart" | "eye" | "doc" | "users" | "receipt" | "plus" | "list";

export interface ItemMenu {
  nome: string;
  /** Sem href = ainda não disponível. */
  href?: string;
  /** Ícone do item na barra de baixo do celular, quando a pessoa só tem um módulo. */
  icone?: Icone;
  contador?: number;
}
export interface GrupoMenu { nome: string; itens: ItemMenu[] }
export interface ModuloMenu {
  id: string;
  nome: string;
  /** Nome curto, para a barra de baixo do celular. */
  curto: string;
  icone: Icone;
  /** Linha com o número que importa no módulo. */
  resumo: string;
  grupos: GrupoMenu[];
}
export interface Menu {
  usuario: {
    nome: string; email: string; iniciais: string; perfil: string; foto: string | null;
    /** Administrador com mais de um perfil: opções de "Ver o sistema como" ("" = todos os perfis). */
    visoes: { valor: string; rotulo: string }[] | null;
    visao: string;
  };
  modulos: ModuloMenu[];
}

function iniciais(nome: string): string {
  const p = nome.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase();
}

async function aguardandoCalibragem(): Promise<number> {
  const { rows } = await db().query<{ n: number }>(
    `select count(*)::int as n from co_avaliacoes where status = 'Aguardando Calibragem' and not excluida`,
  );
  return rows[0].n;
}

async function recibosAPagar(): Promise<number> {
  const { rows } = await db().query<{ n: number }>(
    `select count(*)::int as n from co_recibos_avaliador r
      where r.assinado_em is not null and r.pago_em is null`, // a aprovar ou a pagar
  );
  return rows[0].n;
}

export async function montarMenu(u: UsuarioAtual): Promise<Menu> {
  const p = u.perfis;
  const ehAdmin = p.includes("admin");
  const tem = (...x: string[]) => ehAdmin || x.some((y) => p.includes(y));
  const modulos: ModuloMenu[] = [];

  if (temPermissao(p, "painelPesquisa")) {
    modulos.push({
      id: "inicio", nome: "Dashboard", curto: "Início", icone: "home", resumo: "Resumo do mês",
      grupos: [{ nome: "Geral", itens: [
        { nome: "Comparativo", href: "/gestor/comparativo" },
        { nome: "Visão geral", href: "/gestor" },
      ] }],
    });
    const cadastros: ItemMenu[] = [];
    if (temPermissao(p, "cadastros")) {
      cadastros.push({ nome: "Concorrentes", href: "/gestor/concorrentes" }, { nome: "Empreendimentos", href: "/gestor/empreendimentos" });
    }
    if (temPermissao(p, "auditoriaPesquisa")) {
      cadastros.push({ nome: "Agentes de campo", href: "/gestor/agentes" }, { nome: "Dados próprios", href: "/gestor/dados-proprios" });
    }
    modulos.push({
      id: "pesquisa", nome: "Pesquisa de Concorrentes", curto: "Pesquisa", icone: "chart", resumo: "Estoque e vendas dos concorrentes",
      grupos: [{ nome: "Acompanhar", itens: [{ nome: "Coletas", href: "/gestor/pesquisas" }] },
        ...(cadastros.length ? [{ nome: "Cadastros", itens: cadastros }] : [])],
    });
  }

  const papel = papelCO(p);
  if (papel) {
    const itens: ItemMenu[] = [];
    let resumo = "Avaliações das visitas";
    if (papel === "avaliador" && !tem("coordenador_market_share")) {
      itens.push(
        { nome: "Nova avaliação", href: "/cliente-oculto/cliente-oculto.html", icone: "plus" },
        { nome: "Minhas avaliações", href: "/cliente-oculto/minhas.html", icone: "list" },
        { nome: "Meus recibos", href: "/cliente-oculto/recibos.html", icone: "receipt" },
      );
    } else {
      const n = await aguardandoCalibragem();
      resumo = n ? `${n} aguardando calibragem` : "Nenhuma avaliação aguardando";
      itens.push({ nome: "Avaliações e calibragem", href: "/cliente-oculto/coordenador.html", contador: n || undefined });
      if (ehAdmin) itens.push({ nome: "Correções (administrador)", href: "/cliente-oculto/admin.html" });
    }
    const grupos: GrupoMenu[] = [];
    // O administrador vê todas as funcionalidades, inclusive registrar uma visita.
    if (ehAdmin) grupos.push({ nome: "Visitas", itens: [{ nome: "Nova avaliação", href: "/cliente-oculto/cliente-oculto.html" }] });
    grupos.push({ nome: "Avaliações", itens });
    modulos.push({ id: "co", nome: "Cliente Oculto", curto: "Cliente oculto", icone: "eye", resumo, grupos });
  }

  if (temPermissao(p, "tabelasEnviar") || temPermissao(p, "tabelasConferir")) {
    const { rows: [pc] } = await db().query<{ n: number }>(`select count(*)::int as n from leituras_tabela where status = 'para_conferir'`);
    const itens: ItemMenu[] = [{ nome: "Enviar e acompanhar", href: "/gestor/tabelas" }];
    if (temPermissao(p, "tabelasConferir")) itens.push({ nome: "Para conferir", href: "/gestor/tabelas/conferir", contador: pc.n || undefined });
    modulos.push({
      id: "tabelas", nome: "Tabelas e espelhos", curto: "Tabelas", icone: "doc",
      resumo: pc.n ? `${pc.n} leitura(s) para conferir` : "Leitura de tabelas por IA",
      grupos: [{ nome: "Leitura por IA", itens }],
    });
  }

  // Recibos de pagamento do Cliente Oculto: módulo próprio (Coordenador de Market Share e administrador).
  if (temPermissao(p, "recibos")) {
    const n = await recibosAPagar();
    modulos.push({
      id: "recibos", nome: "Recibos", curto: "Recibos", icone: "receipt",
      resumo: n ? `${n} a aprovar ou pagar` : "Nenhum recibo pendente",
      grupos: [{ nome: "Pagamentos", itens: [{ nome: "Recibos do Cliente Oculto", href: "/gestor/recibos", contador: n || undefined }] }],
    });
  }

  if (temPermissao(p, "gerirUsuarios")) {
    modulos.push({
      id: "admin", nome: "Administração", curto: "Admin", icone: "users", resumo: ehAdmin ? "Pessoas, perfis e convites" : "Avaliadores e acessos",
      grupos: [
        { nome: "Acesso", itens: [{ nome: ehAdmin ? "Usuários" : "Avaliadores", href: "/gestor/usuarios" }] },
        ...(ehAdmin ? [{ nome: "Integrações", itens: [{ nome: "Dados do CV", href: "/gestor/dados-cv" }] }] : []),
      ],
    });
  }

  const principal = p.find(ehPerfil);
  const { rows: [foto] } = await db().query<{ foto: string | null }>(
    `select foto from usuarios where id_usuario = $1`, [u.id_usuario],
  );
  const cadastrados = u.perfisCadastrados.filter(ehPerfil);
  const visoes = cadastrados.includes("admin") && cadastrados.length > 1
    ? [{ valor: "", rotulo: "Administrador (todos os perfis)" },
       ...cadastrados.filter((x) => x !== "admin").map((x) => ({ valor: x, rotulo: ROTULO_PERFIL[x] }))]
    : null;
  return {
    usuario: {
      nome: u.nome, email: u.email, iniciais: iniciais(u.nome),
      perfil: principal ? ROTULO_PERFIL[principal] + (u.visao ? " (visualização)" : "") : "", foto: foto?.foto ?? null,
      visoes, visao: u.visao ?? "",
    },
    modulos,
  };
}

/** Tela em que cada perfil entra direto (design system: "Tela inicial de cada perfil"). */
export function telaInicial(perfis: readonly string[]): string | null {
  if (perfis.includes("diretoria") && !perfis.includes("admin")) return "/gestor/comparativo";
  if (perfis.includes("admin")) return "/gestor";
  if (perfis.includes("coordenador_market_share")) return "/cliente-oculto/coordenador.html";
  if (perfis.includes("coordenador_produto")) return "/gestor/concorrentes";
  // O avaliador começa pela lista dele (abrir "Nova avaliação" já cria um rascunho).
  if (perfis.includes("avaliador")) return "/cliente-oculto/minhas.html";
  if (perfis.includes("supervisor_parcerias")) return "/gestor/tabelas";
  return null;
}
