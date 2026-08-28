import React from 'react'
import { ToolShell } from '../common/ToolShell'
import { TypographyView } from './TypographyView'
import { Type } from 'lucide-react'

export const TypographyToolView: React.FC = () => {
  return (
    <ToolShell
      title="文本排版与写作工具箱"
      subtitle="中英文自动盘古之白空格、全半角标点纠正、实时字数统计与强密码生成"
      icon={<Type className="w-5 h-5 text-mem-ink" />}
      colorVariant="pink"
    >
      <TypographyView />
    </ToolShell>
  )
}
