import type { Config } from "tailwindcss";

export default {
  content: ["./popup.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Space Grotesk", "Segoe UI", "sans-serif"]
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(255,255,255,0.08), 0 18px 40px rgba(5, 8, 16, 0.45)"
      }
    }
  },
  plugins: []
} satisfies Config;
