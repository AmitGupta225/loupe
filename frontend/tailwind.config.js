/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        alabaster: "#F8F7F4",
        stone: "#F1EFEA",
        carbon: "#111111",
        slate: "#52525B",
        hairline: "#E4E2DD",
        obsidian: "#18181B",
        crimson: "#DC2626",
        amber: "#D97706",
        steel: "#2563EB",
        emerald: "#059669",
      },
      fontFamily: {
        serif: ["Newsreader", "Source Serif 4", "Instrument Serif", "serif"],
        sans: ["Plus Jakarta Sans", "Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "IBM Plex Mono", "monospace"],
      },
    },
  },
  plugins: [],
};
