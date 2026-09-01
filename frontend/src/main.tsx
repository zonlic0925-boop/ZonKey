import React from 'react'
import ReactDOM from 'react-dom/client'
import { MotionConfig } from 'framer-motion'
import App from './App'
import { I18nProvider } from './i18n'
import { ThemeProvider } from './lib/theme/ThemeProvider'
import './index.css'

// MotionConfig reducedMotion="user"：系统开启「减少动态效果」时，
// 全应用 framer-motion 动画自动退化为纯透明度过渡——底层动效的无障碍底线。
// ThemeProvider：mem-* 主题变量（<html data-theme>）+ 背景纹理持久化。
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <I18nProvider>
        <MotionConfig reducedMotion="user">
          <App />
        </MotionConfig>
      </I18nProvider>
    </ThemeProvider>
  </React.StrictMode>,
)
