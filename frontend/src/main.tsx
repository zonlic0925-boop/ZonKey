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

// 壳层白屏看门狗心跳（round-15）：desktop_app.py 的 watchdog 每 5s 轮询
// 此值；首屏挂载成功后每 2s +1。只有主线程存活才能推进它，所以「页面
// 渲染完成但 JS 卡死」也能被壳层检测（仅浏览器运行时无人消费，零开销）。
declare global {
  interface Window {
    __zsHeartbeat?: number
  }
}
window.__zsHeartbeat = 0
setInterval(() => {
  window.__zsHeartbeat = (window.__zsHeartbeat || 0) + 1
}, 2000)

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
