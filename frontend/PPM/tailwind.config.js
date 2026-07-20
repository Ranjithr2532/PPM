/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#0046ff",
          light: "#4d79ff",
          dark: "#0030b3",
        },
      },
    },
  },
  plugins: [],
}

