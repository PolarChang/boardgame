import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        parchment: {
          DEFAULT: "#f7f4eb",
          dark: "#f0e8d8",
          light: "#fcf9f2",
        },
        grid: {
          line: "#eaddca",
        },
        ink: {
          DEFAULT: "#2d241e",
          dark: "#1a1512",
          light: "#5c4f43",
          muted: "#8a7a6a",
        },
        "euro-blue": {
          DEFAULT: "#2c5d63",
          dark: "#1e3d59",
          light: "#3d7a82",
        },
        "wax-red": {
          DEFAULT: "#a84343",
          dark: "#8a3535",
          light: "#c45a5a",
        },
        brass: {
          DEFAULT: "#c5a059",
          dark: "#b0883a",
          light: "#d4b87a",
        },
        sepia: {
          DEFAULT: "#6b4423",
          light: "#8b6914",
        },
      },
      fontFamily: {
        heading: ["Cinzel", "serif"],
        body: ["DM Sans", "sans-serif"],
        elegant: ["Cormorant Garamond", "serif"],
        display: ["Playfair Display", "serif"],
      },
      boxShadow: {
        euro: "0 2px 8px rgba(45, 36, 30, 0.08)",
        "euro-lg": "0 4px 16px rgba(197, 160, 89, 0.15)",
        wax: "0 1px 3px rgba(168, 67, 67, 0.4)",
      },
    },
  },
  plugins: [],
};

export default config;