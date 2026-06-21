import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#04070D",
        carbon: "#0B1220",
        surface: "#0F1728",
        surfaceAlt: "#182135",
        panel: "#111A2B",
        line: "rgba(255,255,255,0.08)",
        gold: {
          50: "#FFF8DB",
          100: "#FEEFA7",
          200: "#FCE170",
          300: "#F7CF2F",
          400: "#E7B80D",
          500: "#C99700",
          600: "#9A7300"
        }
      },
      boxShadow: {
        soft: "0 12px 30px rgba(0, 0, 0, 0.28)",
        glow: "0 20px 60px rgba(231, 184, 13, 0.18)"
      },
      backgroundImage: {
        ice:
          "radial-gradient(circle at top left, rgba(255,255,255,0.06), transparent 30%), radial-gradient(circle at top right, rgba(247,207,47,0.12), transparent 24%), linear-gradient(160deg, #04070D 0%, #0B1220 48%, #111A2B 100%)"
      },
      borderRadius: {
        "4xl": "2rem"
      },
      fontFamily: {
        sans: ["Segoe UI", "Helvetica Neue", "Arial", "sans-serif"]
      }
    },
  },
  plugins: [],
};

export default config;
