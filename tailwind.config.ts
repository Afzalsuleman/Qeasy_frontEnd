import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: {
          DEFAULT: "#4f46e5",
          hover: "#4338ca",
          light: "#818cf8",
        },
        secondary: {
          DEFAULT: "#f1f5f9",
          dark: "#e2e8f0",
        },
        border: {
          DEFAULT: "#e2e8f0",
          light: "#f1f5f9",
        },
      },
    },
  },
  plugins: [],
};
export default config;

