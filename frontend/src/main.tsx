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

// 启动加载层退场（index.html #zs-boot）：React 已挂载，把「正在加载中，
// 请勿离开」提示层淡出移除。找不到层（缓存旧 index.html）或移除失败都
// 不影响挂载流程。淡出时长与 index.css 内 transition 对齐（450ms）。
function dismissBootScreen(): void {
  try {
    const boot = document.getElementById('zs-boot')
    if (!boot) return
    boot.classList.add('zs-boot-done')
    window.setTimeout(() => boot.remove(), 500)
  } catch {
    /* ignore */
  }
}
// 首帧真实绘制完成后才退场（双 rAF），避免加载层撤得太早露出白屏一闪；
// 600ms 定时是兜底（rAF 被 GPU 卡死吞掉时也能退场）。
requestAnimationFrame(() => requestAnimationFrame(dismissBootScreen))
window.setTimeout(dismissBootScreen, 600)

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
