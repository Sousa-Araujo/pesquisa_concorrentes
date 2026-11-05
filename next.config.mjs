import { readFileSync } from "node:fs";

// Versão do sistema (package.json) disponível nas telas: rodapé "Versão: x.y.z".
const { version } = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));

const producao = process.env.NODE_ENV === "production";

/**
 * Cabeçalhos de segurança em todas as respostas (docs/seguranca.md).
 * Política de conteúdo (CSP): só o próprio sistema e a fonte Satoshi (Fontshare).
 * Em desenvolvimento o Next precisa de eval e websocket para recarregar a tela.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${producao ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline' https://api.fontshare.com",
  "font-src 'self' data: https://api.fontshare.com https://cdn.fontshare.com",
  "img-src 'self' data: blob:",
  `connect-src 'self'${producao ? "" : " ws: wss:"}`,
  // O PDF das tabelas é mostrado num iframe do próprio sistema.
  "frame-src 'self' blob:",
  "frame-ancestors 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const cabecalhos = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  ...(producao ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }] : []),
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  env: { NEXT_PUBLIC_APP_VERSION: version },
  async headers() {
    return [{ source: "/:path*", headers: cabecalhos }];
  },
};
export default nextConfig;
