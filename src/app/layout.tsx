import type { Metadata, Viewport } from "next";
// Design system Market Share Sousa Araujo: tokens + componentes ms-*.
// Os arquivos ficam em public/design porque as telas do Cliente Oculto também os usam.
import "../../public/design/tokens.css";
import "../../public/design/ms.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Market Share · Sousa Araujo",
  description: "Pesquisa de concorrentes e Cliente Oculto da Sousa Araujo.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#420000",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        {/* Fonte Satoshi (a mesma do site sousaaraujo.com.br). */}
        <link rel="preconnect" href="https://api.fontshare.com" />
        <link rel="stylesheet" href="https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700&display=swap" />
      </head>
      <body>{children}</body>
    </html>
  );
}
