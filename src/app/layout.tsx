import type { Metadata, Viewport } from "next";
// Design system Market Share Sousa Araujo: tokens + componentes ms-*.
// Os arquivos ficam em public/design porque as telas do Cliente Oculto também os usam.
import "../../public/design/tokens.css";
import "../../public/design/ms.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Market Share · Sousa Araujo",
  description: "Pesquisa de concorrentes e Cliente Oculto da Sousa Araujo.",
  icons: { icon: "/design/icone-sousa-araujo.svg", apple: "/design/icone-sousa-araujo.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#420000",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" data-theme="light" suppressHydrationWarning>
      <head>
        {/* Tema e menu recolhido escolhidos pelo usuário, aplicados antes de desenhar a tela (sem piscar). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem("ms-tema")==="dark")document.documentElement.setAttribute("data-theme","dark")}catch(e){}`
              + `try{if(matchMedia("(max-width: 720px)").matches||localStorage.getItem("ms-menu-recolhido")==="1")document.documentElement.setAttribute("data-menu-recolhido","")}catch(e){}`,
          }}
        />
        {/* Fonte Satoshi (a mesma do site sousaaraujo.com.br). */}
        <link rel="preconnect" href="https://api.fontshare.com" />
        <link rel="stylesheet" href="https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700&display=swap" />
        {/* Diálogo do sistema no lugar do confirm()/alert() (src/lib/cliente/dialogo.ts). */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script src="/design/dialogo.js" />
      </head>
      <body>{children}</body>
    </html>
  );
}
