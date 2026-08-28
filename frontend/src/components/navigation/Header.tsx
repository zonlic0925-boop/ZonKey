import React from 'react'
import { motion } from 'framer-motion'
import { snappySpring } from '../../motion/springConfigs'
import {
  ShieldCheck,
  FileText,
  Image as ImageIcon,
  Music,
  Terminal,
  Type,
  Settings,
  Sparkles,
} from 'lucide-react'

export type MainCategory = 'redact' | 'pdf' | 'image' | 'media' | 'devtools' | 'typography'

interface HeaderProps {
  activeTab: MainCategory
  onTabChange: (tab: MainCategory) => void
  onOpenRules: () => void
}

const CATEGORIES = [
  { id: 'redact' as MainCategory, label: '智能脱敏', icon: ShieldCheck, color: 'bg-mem-coral text-white' },
  { id: 'pdf' as MainCategory, label: '文档 PDF', icon: FileText, color: 'bg-mem-sky text-white' },
  { id: 'image' as MainCategory, label: '图像工坊', icon: ImageIcon, color: 'bg-mem-sun text-mem-ink' },
  { id: 'media' as MainCategory, label: '音频媒体', icon: Music, color: 'bg-mem-teal text-white' },
  { id: 'devtools' as MainCategory, label: '安全开发', icon: Terminal, color: 'bg-mem-lavender text-white' },
  { id: 'typography' as MainCategory, label: '文本排版', icon: Type, color: 'bg-mem-yellow text-mem-ink' },
]

export const Header: React.FC<HeaderProps> = ({ activeTab, onTabChange, onOpenRules }) => {
  return (
    <header className="sticky top-0 z-40 bg-mem-cream/95 backdrop-blur-md border-b-[2.5px] border-mem-ink px-4 py-2.5 flex items-center justify-between">
      {/* Brand & Logo */}
      <div className="flex items-center gap-3">
        <motion.div
          whileHover={{ rotate: 10, scale: 1.05 }}
          className="w-10 h-10 bg-mem-coral border-2 border-mem-ink rounded-xl flex items-center justify-center shadow-memphis-sm"
        >
          <Sparkles className="w-5 h-5 text-white" />
        </motion.div>
        <div>
          <div className="flex items-center gap-1.5">
            <h1 className="font-display font-black text-lg tracking-tight text-mem-ink">ZonScale</h1>
            <span className="bg-mem-lime text-mem-ink text-[10px] font-display font-black px-1.5 py-0.5 rounded border border-mem-ink shadow-[1.5px_1.5px_0px_#18181B]">
              v2.1 PRO
            </span>
          </div>
          <p className="text-[10px] font-bold text-mem-ink/50 leading-none">
            100% 离线脱敏与多功能工作台
          </p>
        </div>
      </div>

      {/* Main Categories Navigation Tabs */}
      <nav className="flex items-center gap-1.5 p-1 bg-white border-2 border-mem-ink rounded-2xl shadow-memphis-sm">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon
          const isActive = activeTab === cat.id

          return (
            <button
              key={cat.id}
              onClick={() => onTabChange(cat.id)}
              className={`relative px-3.5 py-1.5 rounded-xl font-display font-black text-xs transition-colors flex items-center gap-1.5 z-10 ${
                isActive ? 'text-mem-ink' : 'text-mem-ink/60 hover:text-mem-ink'
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="activeHeaderPill"
                  transition={snappySpring}
                  className="absolute inset-0 bg-mem-yellow border-2 border-mem-ink rounded-xl -z-10 shadow-memphis-sm"
                />
              )}
              <Icon className="w-3.5 h-3.5" />
              <span>{cat.label}</span>
            </button>
          )
        })}
      </nav>

      {/* Rules & Settings button */}
      <div className="flex items-center gap-2">
        <button
          onClick={onOpenRules}
          className="px-3 py-1.5 bg-white border-2 border-mem-ink rounded-xl font-display font-black text-xs flex items-center gap-1.5 shadow-memphis-sm hover:-translate-x-0.5 hover:-translate-y-0.5 transition-transform"
        >
          <Settings className="w-3.5 h-3.5 text-mem-ink" />
          <span>脱敏规则</span>
        </button>
      </div>
    </header>
  )
}
