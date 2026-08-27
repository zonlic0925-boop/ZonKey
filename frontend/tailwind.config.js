/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        mem: {
          cream: '#FFF9F0',
          ink: '#1A1A2E',
          coral: '#FF6B6B',
          teal: '#4ECDC4',
          yellow: '#FFE66D',
          pink: '#FF9FF3',
          sky: '#45B7D1',
          lime: '#96E6A1',
        },
      },
      boxShadow: {
        memphis: '4px 4px 0px 0px #1A1A2E',
        'memphis-sm': '2px 2px 0px 0px #1A1A2E',
        'memphis-lg': '6px 6px 0px 0px #1A1A2E',
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        body: ['"DM Sans"', 'system-ui', 'sans-serif'],
        brand: ['"Audiowide"', '"Righteous"', 'system-ui', 'sans-serif'],
        'brand-script': ['"Caveat"', 'cursive'],
      },
    },
  },
  plugins: [],
}
