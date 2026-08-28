import React, { useState } from 'react'
import { MemphisCard } from '../common/MemphisCard'
import { MemphisButton } from '../common/MemphisButton'
import { Code, Link2, FileJson, Clock, Calculator, ShieldCheck, Copy, Check } from 'lucide-react'
import {
  encodeBase64, decodeBase64,
  encodeUrl, decodeUrl,
  formatJson, minifyJson,
  parseJwt,
  convertTimestamp, getNowTimestamps
} from '../../lib/toolknit/developerCore'
import { calculateBmi, calculateMortgage, convertUnits } from '../../lib/toolknit/calcCore'

type ToolTab = 'base64' | 'url' | 'json' | 'jwt' | 'time' | 'bmi' | 'mortgage' | 'units'

export const DevToolboxView: React.FC = () => {
  const [tab, setTab] = useState<ToolTab>('base64')
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  // BMI
  const [height, setHeight] = useState(175)
  const [weight, setWeight] = useState(70)
  const [bmiRes, setBmiRes] = useState<any>(null)

  // Mortgage
  const [loan, setLoan] = useState(100)
  const [rate, setRate] = useState(3.5)
  const [years, setYears] = useState(30)
  const [mortRes, setMortRes] = useState<any>(null)

  // Units
  const [unitCategory, setUnitCategory] = useState<'length'|'weight'|'temperature'>('length')
  const [unitVal, setUnitVal] = useState(100)
  const [unitFrom, setUnitFrom] = useState('m')
  const [unitTo, setUnitTo] = useState('ft')
  const [unitRes, setUnitRes] = useState<number|null>(null)

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  const tabs: { id: ToolTab; label: string }[] = [
    { id: 'base64', label: 'Base64' },
    { id: 'url', label: 'URL 编解码' },
    { id: 'json', label: 'JSON 格式化' },
    { id: 'jwt', label: 'JWT 解析' },
    { id: 'time', label: '时间戳转换' },
    { id: 'bmi', label: 'BMI 计算' },
    { id: 'mortgage', label: '房贷计算' },
    { id: 'units', label: '单位换算' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex gap-2 flex-wrap">
        {tabs.map(t => (
          <MemphisButton key={t.id} variant={tab === t.id ? 'sky' : 'white'} size="sm"
            onClick={() => { setTab(t.id); setInput(''); setOutput(''); setError('') }}>
            {t.label}
          </MemphisButton>
        ))}
      </div>

      <MemphisCard className="p-4 space-y-4">
        {tab === 'base64' && (
          <div className="space-y-3">
            <textarea value={input} onChange={e => setInput(e.target.value)} rows={4} placeholder="输入文本或 Base64..."
              className="w-full p-2 border-2 border-mem-ink rounded-xl text-xs font-mono" />
            <div className="flex gap-2">
              <MemphisButton variant="sky" size="sm" onClick={() => { try { setOutput(encodeBase64(input)); setError('') } catch(e:any){ setError(e.message) } }}>编码</MemphisButton>
              <MemphisButton variant="teal" size="sm" onClick={() => { try { setOutput(decodeBase64(input)); setError('') } catch(e:any){ setError(e.message) } }}>解码</MemphisButton>
            </div>
            {output && (
              <div className="relative">
                <textarea readOnly value={output} rows={4} className="w-full p-2 border-2 border-mem-ink rounded-xl text-xs font-mono bg-slate-50" />
                <button onClick={() => handleCopy(output)} className="absolute top-2 right-2 p-1 bg-white border border-mem-ink rounded text-xs">
                  {copied ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            )}
          </div>
        )}

        {tab === 'url' && (
          <div className="space-y-3">
            <textarea value={input} onChange={e => setInput(e.target.value)} rows={4} placeholder="输入 URL 字符串..."
              className="w-full p-2 border-2 border-mem-ink rounded-xl text-xs font-mono" />
            <div className="flex gap-2">
              <MemphisButton variant="sky" size="sm" onClick={() => setOutput(encodeUrl(input))}>编码</MemphisButton>
              <MemphisButton variant="teal" size="sm" onClick={() => setOutput(decodeUrl(input))}>解码</MemphisButton>
            </div>
            {output && <textarea readOnly value={output} rows={4} className="w-full p-2 border-2 border-mem-ink rounded-xl text-xs font-mono bg-slate-50" />}
          </div>
        )}

        {tab === 'json' && (
          <div className="space-y-3">
            <textarea value={input} onChange={e => setInput(e.target.value)} rows={6} placeholder="输入 JSON 数据..."
              className="w-full p-2 border-2 border-mem-ink rounded-xl text-xs font-mono" />
            <div className="flex gap-2">
              <MemphisButton variant="sky" size="sm" onClick={() => { try { setOutput(formatJson(input)); setError('') } catch(e:any){ setError(e.message) } }}>格式化</MemphisButton>
              <MemphisButton variant="teal" size="sm" onClick={() => { try { setOutput(minifyJson(input)); setError('') } catch(e:any){ setError(e.message) } }}>压缩</MemphisButton>
            </div>
            {output && <textarea readOnly value={output} rows={8} className="w-full p-2 border-2 border-mem-ink rounded-xl text-xs font-mono bg-slate-50" />}
          </div>
        )}

        {tab === 'jwt' && (
          <div className="space-y-3">
            <textarea value={input} onChange={e => setInput(e.target.value)} rows={4} placeholder="粘贴 JWT Token (eyJhbGciOi...)"
              className="w-full p-2 border-2 border-mem-ink rounded-xl text-xs font-mono" />
            <MemphisButton variant="sky" size="sm" onClick={() => { try { const p = parseJwt(input); setOutput(JSON.stringify(p, null, 2)); setError('') } catch(e:any){ setError(e.message) } }}>解析</MemphisButton>
            {output && <textarea readOnly value={output} rows={8} className="w-full p-2 border-2 border-mem-ink rounded-xl text-xs font-mono bg-slate-50" />}
          </div>
        )}

        {tab === 'time' && (
          <div className="space-y-3">
            <div className="p-3 bg-mem-sky/10 border-2 border-mem-ink rounded-xl space-y-1 text-xs font-mono">
              <p>当前时间戳 (秒): <b>{getNowTimestamps().seconds}</b></p>
              <p>当前时间戳 (毫秒): <b>{getNowTimestamps().milliseconds}</b></p>
              <p>当前时间: <b>{getNowTimestamps().iso}</b></p>
            </div>
            <div className="flex gap-2">
              <input type="text" value={input} onChange={e => setInput(e.target.value)} placeholder="输入时间戳或日期字符串..."
                className="flex-1 p-2 border-2 border-mem-ink rounded-xl text-xs font-mono" />
              <MemphisButton variant="sky" size="sm" onClick={() => {
                const res = convertTimestamp(input)
                if (res) setOutput(JSON.stringify(res, null, 2))
                else setError('无效的时间格式')
              }}>转换</MemphisButton>
            </div>
            {output && <pre className="p-3 bg-slate-50 border-2 border-mem-ink rounded-xl text-xs font-mono">{output}</pre>}
          </div>
        )}

        {tab === 'bmi' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div><label className="block font-bold mb-1">身高 (cm): {height}</label>
                <input type="range" min={100} max={220} value={height} onChange={e => setHeight(+e.target.value)} className="w-full" /></div>
              <div><label className="block font-bold mb-1">体重 (kg): {weight}</label>
                <input type="range" min={30} max={150} value={weight} onChange={e => setWeight(+e.target.value)} className="w-full" /></div>
            </div>
            <MemphisButton variant="sky" size="sm" onClick={() => setBmiRes(calculateBmi(height, weight))}>计算 BMI</MemphisButton>
            {bmiRes && (
              <div className="p-4 bg-mem-sky/10 border-2 border-mem-ink rounded-xl text-center">
                <p className="text-3xl font-display font-black text-mem-ink">{bmiRes.bmi}</p>
                <p className="text-xs font-bold text-mem-sky mt-1">{bmiRes.category} (理想范围: {bmiRes.idealWeightRange})</p>
              </div>
            )}
          </div>
        )}

        {tab === 'mortgage' && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div><label className="block font-bold mb-1">贷款金额 (万元)</label>
                <input type="number" value={loan} onChange={e => setLoan(+e.target.value)} className="w-full p-1.5 border-2 border-mem-ink rounded-lg" /></div>
              <div><label className="block font-bold mb-1">年利率 (%)</label>
                <input type="number" step="0.1" value={rate} onChange={e => setRate(+e.target.value)} className="w-full p-1.5 border-2 border-mem-ink rounded-lg" /></div>
              <div><label className="block font-bold mb-1">贷款年限 (年)</label>
                <input type="number" value={years} onChange={e => setYears(+e.target.value)} className="w-full p-1.5 border-2 border-mem-ink rounded-lg" /></div>
            </div>
            <MemphisButton variant="sky" size="sm" onClick={() => setMortRes(calculateMortgage(loan * 10000, rate, years))}>计算房贷</MemphisButton>
            {mortRes && (
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 bg-mem-sky/10 border-2 border-mem-ink rounded-xl">
                  <p className="text-lg font-black">{mortRes.monthlyPayment.toFixed(2)}</p>
                  <p className="text-[10px] font-bold text-mem-ink/60">月供 (元)</p>
                </div>
                <div className="p-3 bg-mem-sky/10 border-2 border-mem-ink rounded-xl">
                  <p className="text-lg font-black">{(mortRes.totalInterest/10000).toFixed(2)}</p>
                  <p className="text-[10px] font-bold text-mem-ink/60">总利息 (万元)</p>
                </div>
                <div className="p-3 bg-mem-sky/10 border-2 border-mem-ink rounded-xl">
                  <p className="text-lg font-black">{(mortRes.totalPayment/10000).toFixed(2)}</p>
                  <p className="text-[10px] font-bold text-mem-ink/60">还款总额 (万元)</p>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'units' && (
          <div className="space-y-3">
            <div className="flex gap-2">
              {(['length', 'weight', 'temperature'] as const).map(c => (
                <MemphisButton key={c} variant={unitCategory === c ? 'sky' : 'white'} size="sm" onClick={() => {
                  setUnitCategory(c)
                  if (c === 'length') { setUnitFrom('m'); setUnitTo('ft') }
                  else if (c === 'weight') { setUnitFrom('kg'); setUnitTo('lb') }
                  else { setUnitFrom('c'); setUnitTo('f') }
                  setUnitRes(null)
                }}>{c === 'length' ? '长度' : c === 'weight' ? '重量' : '温度'}</MemphisButton>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <input type="number" value={unitVal} onChange={e => setUnitVal(+e.target.value)} className="w-32 p-2 border-2 border-mem-ink rounded-xl text-xs" />
              <span className="text-xs font-bold font-mono">{unitFrom} ➔ {unitTo}</span>
              <MemphisButton variant="teal" size="sm" onClick={() => {
                const r = convertUnits(unitVal, unitFrom, unitTo, unitCategory)
                setUnitRes(r)
              }}>换算</MemphisButton>
            </div>
            {unitRes !== null && (
              <p className="text-sm font-mono font-bold">换算结果: {unitVal} {unitFrom} = <span className="text-mem-coral text-base">{unitRes.toFixed(4)}</span> {unitTo}</p>
            )}
          </div>
        )}

        {error && <p className="text-xs font-bold text-red-600">{error}</p>}
      </MemphisCard>
    </div>
  )
}
