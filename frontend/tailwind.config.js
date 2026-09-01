/** @type {import('tailwindcss').Config} */
// mem-* 色板挂 CSS 变量（index.css :root 与 data-theme 预设块定义），
// 用 `rgb(var(--x) / <alpha-value>)` 形式保住全站 bg-mem-*/30 这类透明度语法；
// 换主题 = <html data-theme="..."> 一个属性，组件类名零改动。
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        mem: {
          cream: 'rgb(var(--mem-cream) / <alpha-value>)',
          ink: 'rgb(var(--mem-ink) / <alpha-value>)',
          coral: 'rgb(var(--mem-coral) / <alpha-value>)',
          teal: 'rgb(var(--mem-teal) / <alpha-value>)',
          yellow: 'rgb(var(--mem-yellow) / <alpha-value>)',
          pink: 'rgb(var(--mem-pink) / <alpha-value>)',
          sky: 'rgb(var(--mem-sky) / <alpha-value>)',
          lime: 'rgb(var(--mem-lime) / <alpha-value>)',
          lavender: 'rgb(var(--mem-lavender) / <alpha-value>)',
          orange: 'rgb(var(--mem-orange) / <alpha-value>)',
          // 卡片/面板白底走变量：深色主题下整体翻成暗卡底，bg-white 类零改动跟随
          surface: 'rgb(var(--mem-surface) / <alpha-value>)',
        },
        // bg-white/text-white 语义归一到 surface：主题切换不漏白块
        white: 'rgb(var(--mem-surface) / <alpha-value>)',
      },
      boxShadow: {
        memphis: '4px 4px 0px 0px rgb(var(--mem-shadow-rgb) / 1)',
        'memphis-sm': '2px 2px 0px 0px rgb(var(--mem-shadow-rgb) / 1)',
        'memphis-lg': '6px 6px 0px 0px rgb(var(--mem-shadow-rgb) / 1)',
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
