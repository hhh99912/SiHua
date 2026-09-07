/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // SCADA custom dark palette
        scada: {
          dark: '#040810',
          panel: '#0a1224',
          card: '#0c1830',
          border: '#1b2d4b',
          cyan: '#00f2ff',
          blue: '#0066ff',
          amber: '#f59e0b',
          green: '#10b981',
          red: '#ef4444',
        }
      }
    },
  },
  plugins: [],
}
