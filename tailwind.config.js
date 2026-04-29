/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Neutral scale — all values are CSS variables so themes flip dark↔light
        vault: {
          900: "rgb(var(--v-900) / <alpha-value>)",
          800: "rgb(var(--v-800) / <alpha-value>)",
          700: "rgb(var(--v-700) / <alpha-value>)",
          600: "rgb(var(--v-600) / <alpha-value>)",
          500: "rgb(var(--v-500) / <alpha-value>)",
          400: "rgb(var(--v-400) / <alpha-value>)",
          300: "rgb(var(--v-300) / <alpha-value>)",
          200: "rgb(var(--v-200) / <alpha-value>)",
          100: "rgb(var(--v-100) / <alpha-value>)",
          50:  "rgb(var(--v-50)  / <alpha-value>)",
        },
        // Semantic colors — swap safely per theme
        accent:       "rgb(var(--accent)       / <alpha-value>)",
        "accent-fg":  "rgb(var(--accent-fg)    / <alpha-value>)",
        danger:       "rgb(var(--danger)        / <alpha-value>)",
        "danger-fg":  "rgb(var(--danger-fg)     / <alpha-value>)",
        success:      "rgb(var(--success)       / <alpha-value>)",
        "success-fg": "rgb(var(--success-fg)    / <alpha-value>)",
        favorite:     "rgb(var(--favorite)      / <alpha-value>)",
        warn:         "rgb(var(--warn)          / <alpha-value>)",
      },
    },
  },
  plugins: [],
};
