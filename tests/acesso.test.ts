import { describe, it, expect } from "vitest";
import {
  CODIGO_MAX_TENTATIVAS,
  gerarCodigo,
  gerarToken,
  hashCodigo,
  hashToken,
  hashesIguais,
  motivoBloqueioPedido,
  normalizarCodigo,
  situacaoCodigo,
} from "../src/lib/auth/codigo";
import { podeGerirUsuarioCom, temPermissao } from "../src/lib/auth/perfis";
import { usuarioSchema } from "../src/lib/validation/schemas";

const agora = new Date("2026-10-15T12:00:00Z");
const minutos = (n: number) => new Date(agora.getTime() + n * 60_000);

describe("Código de acesso", () => {
  it("tem sempre 6 dígitos, inclusive com zeros à esquerda", () => {
    for (let i = 0; i < 200; i++) expect(gerarCodigo()).toMatch(/^\d{6}$/);
  });

  it("aceita o código digitado com espaços ou traço", () => {
    expect(normalizarCodigo(" 123 456 ")).toBe("123456");
    expect(normalizarCodigo("123-456")).toBe("123456");
  });

  it("guarda só o HMAC e compara com segurança", () => {
    const h = hashCodigo("123456", "segredo");
    expect(h).not.toContain("123456");
    expect(hashesIguais(h, hashCodigo("123456", "segredo"))).toBe(true);
    expect(hashesIguais(h, hashCodigo("123457", "segredo"))).toBe(false);
    expect(hashesIguais(h, hashCodigo("123456", "outro-segredo"))).toBe(false);
  });

  it("classifica o código guardado antes de comparar", () => {
    const base = { expira_em: minutos(10), usado_em: null, tentativas: 0 };
    expect(situacaoCodigo(undefined, agora)).toBe("inexistente");
    expect(situacaoCodigo(base, agora)).toBe("valido");
    expect(situacaoCodigo({ ...base, expira_em: minutos(-1) }, agora)).toBe("expirado");
    expect(situacaoCodigo({ ...base, usado_em: agora }, agora)).toBe("usado");
    expect(situacaoCodigo({ ...base, tentativas: CODIGO_MAX_TENTATIVAS }, agora)).toBe("bloqueado");
  });

  it("limita pedidos: 1 por minuto e 5 a cada 15 minutos", () => {
    expect(motivoBloqueioPedido([], agora)).toBeNull();
    expect(motivoBloqueioPedido([minutos(-0.5)], agora)).toMatch(/1 minuto/);
    expect(motivoBloqueioPedido([minutos(-2)], agora)).toBeNull();
    const cinco = [-2, -4, -6, -8, -10].map(minutos);
    expect(motivoBloqueioPedido(cinco, agora)).toMatch(/Muitos códigos/);
    const antigos = [-2, -4, -6, -8, -20].map(minutos);
    expect(motivoBloqueioPedido(antigos, agora)).toBeNull();
  });

  it("gera tokens únicos e guarda só o hash", () => {
    const a = gerarToken();
    expect(a).not.toBe(gerarToken());
    expect(hashToken(a)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(a)).not.toContain(a);
  });
});

describe("Perfis e permissões", () => {
  it("administrador passa em qualquer permissão", () => {
    for (const p of ["painelPesquisa", "cadastros", "auditoriaPesquisa", "gerirUsuarios"] as const) {
      expect(temPermissao(["admin"], p)).toBe(true);
    }
  });

  it("cada perfil vê só o que é da sua função", () => {
    expect(temPermissao(["coordenador_produto"], "cadastros")).toBe(true);
    expect(temPermissao(["coordenador_produto"], "auditoriaPesquisa")).toBe(false);
    expect(temPermissao(["coordenador_market_share"], "auditoriaPesquisa")).toBe(true);
    expect(temPermissao(["diretoria"], "painelPesquisa")).toBe(true);
    expect(temPermissao(["diretoria"], "cadastros")).toBe(false);
    expect(temPermissao(["avaliador"], "painelPesquisa")).toBe(false);
    expect(temPermissao(["supervisor_parcerias"], "painelPesquisa")).toBe(false);
  });

  it("perfis se somam", () => {
    expect(temPermissao(["diretoria", "coordenador_produto"], "cadastros")).toBe(true);
  });

  it("Coordenador de Market Share só gere avaliadores", () => {
    const cms = ["coordenador_market_share"];
    expect(podeGerirUsuarioCom(cms, ["avaliador"])).toBe(true);
    expect(podeGerirUsuarioCom(cms, ["avaliador", "diretoria"])).toBe(false);
    expect(podeGerirUsuarioCom(cms, ["admin"])).toBe(false);
    expect(podeGerirUsuarioCom(cms, [])).toBe(false);
    expect(podeGerirUsuarioCom(["admin"], ["admin", "diretoria"])).toBe(true);
    expect(podeGerirUsuarioCom(["diretoria"], ["avaliador"])).toBe(false);
  });
});

describe("Cadastro de usuário", () => {
  const valido = { nome: " Ana ", email: " Ana@Exemplo.com ", perfis: ["avaliador"], acesso_expira_em: "", ativo: true };

  it("normaliza nome, e-mail e data vazia", () => {
    const r = usuarioSchema.parse(valido);
    expect(r).toEqual({ nome: "Ana", email: "ana@exemplo.com", perfis: ["avaliador"], acesso_expira_em: null, ativo: true });
  });

  it("exige ao menos um perfil conhecido", () => {
    expect(usuarioSchema.safeParse({ ...valido, perfis: [] }).success).toBe(false);
    expect(usuarioSchema.safeParse({ ...valido, perfis: ["gestor"] }).success).toBe(false);
  });

  it("só o administrador precisa de e-mail da empresa", () => {
    const admin = { ...valido, perfis: ["admin"] };
    expect(usuarioSchema.safeParse({ ...admin, email: "fulano@gmail.com" }).success).toBe(false);
    expect(usuarioSchema.safeParse({ ...admin, email: "Fulano@SousaAraujo.com.br" }).success).toBe(true);
    expect(usuarioSchema.safeParse({ ...admin, email: "fulano@sousaaraujo.com.br.fake.com" }).success).toBe(false);
    expect(usuarioSchema.safeParse({ ...valido, perfis: ["admin", "diretoria"], email: "x@gmail.com" }).success).toBe(false);
    expect(usuarioSchema.safeParse({ ...valido, perfis: ["coordenador_produto"], email: "fulano@gmail.com" }).success).toBe(true);
    expect(usuarioSchema.safeParse({ ...valido, perfis: ["avaliador", "diretoria"], email: "x@gmail.com" }).success).toBe(true);
    expect(usuarioSchema.safeParse({ ...valido, email: "avaliador@gmail.com" }).success).toBe(true);
  });

  it("remove perfis repetidos e valida a data do acesso temporário", () => {
    expect(usuarioSchema.parse({ ...valido, perfis: ["avaliador", "avaliador"] }).perfis).toEqual(["avaliador"]);
    expect(usuarioSchema.parse({ ...valido, acesso_expira_em: "2026-11-30" }).acesso_expira_em).toBe("2026-11-30");
    expect(usuarioSchema.safeParse({ ...valido, acesso_expira_em: "30/11/2026" }).success).toBe(false);
  });
});
