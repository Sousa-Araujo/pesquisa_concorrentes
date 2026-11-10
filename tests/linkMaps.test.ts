import { describe, it, expect } from "vitest";
import { lerLinkMaps } from "../src/lib/domain/linkMaps";

describe("lerLinkMaps", () => {
  it("vazio é sem link", () => {
    expect(lerLinkMaps("")).toEqual({ ok: true, valor: null });
    expect(lerLinkMaps("   ")).toEqual({ ok: true, valor: null });
    expect(lerLinkMaps(null)).toEqual({ ok: true, valor: null });
  });
  it("aceita os formatos de link do Google Maps", () => {
    for (const l of [
      "https://maps.app.goo.gl/AbC123xyz",
      "https://www.google.com/maps/place/Sou+Viver/@-23.5,-46.6,17z",
      "https://google.com/maps?q=-23.5,-46.6",
      "https://maps.google.com/?q=Rua+X",
      "https://www.google.com.br/maps/place/Rua+X",
      "https://goo.gl/maps/AbC123",
    ]) expect(lerLinkMaps(l)).toMatchObject({ ok: true });
  });
  it("acrescenta https quando falta", () => {
    expect(lerLinkMaps("maps.app.goo.gl/AbC123")).toEqual({ ok: true, valor: "https://maps.app.goo.gl/AbC123" });
  });
  it("recusa o que não é Google Maps ou não é seguro", () => {
    for (const l of [
      "http://maps.app.goo.gl/AbC", "javascript:alert(1)", "https://example.com/maps/x", "https://google.com/search?q=x",
      "https://maps.google.com.evil.com/", "https://evilgoogle.com/maps/x", "https://user:pw@www.google.com/maps/x", "isso não é um link",
      `https://www.google.com/maps/${"a".repeat(700)}`,
    ]) expect(lerLinkMaps(l)).toEqual({ ok: false });
  });
});
