import { readFileSync } from "node:fs";

// Versão do sistema (package.json) disponível nas telas: rodapé "Versão: x.y.z".
const { version } = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));

/** @type {import('next').NextConfig} */
const nextConfig = { reactStrictMode: true, env: { NEXT_PUBLIC_APP_VERSION: version } };
export default nextConfig;
