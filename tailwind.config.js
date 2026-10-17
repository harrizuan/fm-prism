/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        fm: {
          green: "#1a472a",
          "green-light": "#2d6a3f",
          "green-dark": "#0d2515",
          accent: "#4ade80",
        },
        attr: {
          terrible: "#ef4444",
          poor: "#f97316",
          average: "#eab308",
          good: "#22c55e",
          excellent: "#3b82f6",
          worldclass: "#a855f7",
        },
      },
    },
  },
  plugins: [],
};
