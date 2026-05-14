import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        heading: ["var(--font-heading)", "serif"],
      },
      colors: {
        forest: {
          50: "#f0fdf4",
          500: "#22c55e",
          900: "#14532d",
        },
        earth: {
          500: "#a16207",
          900: "#422006",
        },
      },
    },
  },
  plugins: [],
};

export default config;
