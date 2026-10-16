import type { Config } from "tailwindcss";

// Cores do design system Market Share Sousa Araujo (public/design/tokens.css).
// Ficam em hex aqui para o Tailwind aceitar opacidade (ex.: text-ink/60); a cor
// do texto (ink) vem do token para acompanhar o tema escuro.
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "rgb(var(--ink-rgb) / <alpha-value>)",
        surface: "#f5f4f1",
        brand: "#ae2628",
        brandhi: "#922022",
        branddeep: "#420000",
        accent: "#9a6410",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        xl: "10px",
        "2xl": "14px",
      },
    },
  },
  plugins: [],
} satisfies Config;
