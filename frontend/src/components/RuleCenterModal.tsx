import React, { useState } from 'react'
import { 
  X, 
  Plus, 
  Trash2, 
  Save, 
  ShieldAlert, 
  Layers, 
  Building2, 
  UserCheck, 
  Stamp, 
  FileEdit,
  RotateCcw
} from 'lucide-react'
import { RedactionRule } from '../types'

interface RuleCenterModalProps {
  isOpen: boolean
  onClose: () => void
  rules: RedactionRule[]
  onSaveRules: (rules: RedactionRule[]) => void
}

export const RuleCenterModal: React.FC<RuleCenterModalProps> = ({
  isOpen,
  onClose,
  rules: initialRules,
  onSaveRules,
}) => {
  if (!isOpen) return null

  const [activeCategory, setActiveCategory] = useState<'enterprise' | 'pii' | 'stamp' | 'word'>('enterprise')
  const [rules, setRules] = useState<RedactionRule[]>(initialRules)
  const [newKeyword, setNewKeyword] = useState<string>('')

  const handleToggleRule = (name: string) => {
    setRules(prev => prev.map(r => r.name === name ? { ...r, enabled: !r.enabled } : r))
  }

  const handleAddKeyword = () => {
    if (!newKeyword.trim()) return
    // 添加到当前选中类别的规则列表
    setRules(prev => [
      ...prev,
      {
        name: newKeyword.trim(),
        enabled: true,
        color: '#f43f5e',
        category: activeCategory,
        keywords: [newKeyword.trim()]
      }
    ])
    setNewKeyword('')
  }

  const handleDeleteRule = (name: string) => {
    setRules(prev => prev.filter(r => r.name !== name))
  }

  const handleSave = () => {
    onSaveRules(rules)
    onClose()
  }

  const categoryRules = rules.filter(r => r.category === activeCategory)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-md">
      <div className="w-full max-w-3xl h-[620px] rounded-3xl glass-dropdown border border-white/20 shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* 头部 */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-sky-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">脱敏策略与规则配置中心</h2>
              <p className="text-xs text-slate-400">设置企业词库、个人隐私 (PII)、公章检测与敏感词映射</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 主体左右分区 */}
        <div className="flex-1 flex overflow-hidden">
          {/* 左侧类别导航 */}
          <div className="w-48 border-r border-white/10 p-3 flex flex-col gap-1.5 bg-black/20">
            <button
              onClick={() => setActiveCategory('enterprise')}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                activeCategory === 'enterprise'
                  ? 'bg-sky-500/25 text-sky-300 border border-sky-400/40'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>企业敏感词表</span>
            </button>

            <button
              onClick={() => setActiveCategory('pii')}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                activeCategory === 'pii'
                  ? 'bg-sky-500/25 text-sky-300 border border-sky-400/40'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <UserCheck className="w-4 h-4" />
              <span>个人隐私 (PII)</span>
            </button>

            <button
              onClick={() => setActiveCategory('stamp')}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                activeCategory === 'stamp'
                  ? 'bg-sky-500/25 text-sky-300 border border-sky-400/40'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Stamp className="w-4 h-4" />
              <span>公章 / 印章检测</span>
            </button>

            <button
              onClick={() => setActiveCategory('word')}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                activeCategory === 'word'
                  ? 'bg-sky-500/25 text-sky-300 border border-sky-400/40'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <FileEdit className="w-4 h-4" />
              <span>Word 替换词表</span>
            </button>
          </div>

          {/* 右侧规则列表与添加 */}
          <div className="flex-1 flex flex-col p-6 overflow-hidden">
            {/* 添加输入框 */}
            <div className="flex items-center gap-3 mb-4">
              <input
                type="text"
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddKeyword()}
                placeholder={`输入新的 ${activeCategory === 'enterprise' ? '企业敏感词' : '关键词或正则'} 并按回车`}
                className="flex-1 px-4 py-2.5 rounded-xl glass-card border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-400/50"
              />
              <button
                onClick={handleAddKeyword}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl glass-button text-xs font-medium text-sky-300 hover:text-white"
              >
                <Plus className="w-4 h-4" />
                <span>添加</span>
              </button>
            </div>

            {/* 规则项目列表 */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-2">
              {categoryRules.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-slate-500">
                  当前类别暂无自定义规则
                </div>
              ) : (
                categoryRules.map((rule) => (
                  <div
                    key={rule.name}
                    className="p-3 rounded-xl glass-card flex items-center justify-between border border-white/10 hover:border-white/20 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={rule.enabled}
                        onChange={() => handleToggleRule(rule.name)}
                        className="w-4 h-4 accent-sky-500 rounded cursor-pointer"
                      />
                      <span className="text-xs font-medium text-slate-200">{rule.name}</span>
                    </div>

                    <button
                      onClick={() => handleDeleteRule(rule.name)}
                      className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-white/10"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="p-4 border-t border-white/10 flex items-center justify-between bg-black/20">
          <button
            onClick={() => setRules(initialRules)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl glass-button text-xs text-slate-300 hover:text-white"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>重置默认规则</span>
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl glass-button text-xs text-slate-300 hover:text-white"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 px-6 py-2 rounded-xl glass-button-primary text-xs font-medium text-white shadow-glass-sm"
            >
              <Save className="w-4 h-4" />
              <span>保存并热更新规则</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
