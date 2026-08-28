import React, { useState } from 'react'
import { ToolShell } from '../common/ToolShell'
import { HashCalcView } from './HashCalcView'
import { CryptoSuiteView } from './CryptoSuiteView'
import { RegexTesterView } from './RegexTesterView'
import { JsonDiffView } from './JsonDiffView'
import { Hash, KeyRound, Search, FileCode } from 'lucide-react'

export const CryptoToolboxView: React.FC = () => {
  const [subTool, setSubTool] = useState<'hash' | 'crypto' | 'regex' | 'json'>('hash')

  return (
    <ToolShell
      title="开发与安全密码学工具箱"
      subtitle="100% 纯本地离线计算，文件与敏感数据绝不上传"
      icon={<KeyRound className="w-5 h-5 text-mem-ink" />}
      colorVariant="coral"
      subOptions={[
        { id: 'hash', label: '哈希摘要计算', icon: <Hash className="w-4 h-4" /> },
        { id: 'crypto', label: '编码与加解密', icon: <KeyRound className="w-4 h-4" /> },
        { id: 'regex', label: '正则实时测试', icon: <Search className="w-4 h-4" /> },
        { id: 'json', label: 'JSON 工具与对比', icon: <FileCode className="w-4 h-4" /> },
      ]}
      activeSubId={subTool}
      onSubChange={(id: string) => setSubTool(id as any)}
    >
      {subTool === 'hash' && <HashCalcView />}
      {subTool === 'crypto' && <CryptoSuiteView />}
      {subTool === 'regex' && <RegexTesterView />}
      {subTool === 'json' && <JsonDiffView />}
    </ToolShell>
  )
}
