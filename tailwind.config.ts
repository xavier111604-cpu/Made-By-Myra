import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        cream: "#FFF9F8",
        blush: { DEFAULT: "#F6DCE0", dusty: "#EBC2CA", hover: "#E8B5C0" },
        charcoal: "#302A29",
        gold: "#BB9255",
        line: "#EFE5E3",
      },
      fontFamily: {
        script: ["var(--font-caveat)", "cursive"],
        sans: ["var(--font-dm-sans)", "system-ui", "sans-serif"],
      },
      borderRadius: { xl2: "1.25rem" },
      boxShadow: {
        soft: "0 6px 24px -10px rgba(48, 42, 41, 0.18)",
        lift: "0 14px 34px -14px rgba(48, 42, 41, 0.25)",
      },
      keyframes: {
        "fade-up": { "0%": { opacity: "0", transform: "translateY(12px)" }, "100%": { opacity: "1", transform: "none" } },
        "fade-in": { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        float: { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-8px)" } },
        "slide-in": { "0%": { transform: "translateX(100%)" }, "100%": { transform: "none" } },
      },
      animation: {
        "fade-up": "fade-up 0.7s ease-out both",
        "fade-in": "fade-in 0.4s ease-out both",
        float: "float 5s ease-in-out infinite",
        "slide-in": "slide-in 0.3s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
