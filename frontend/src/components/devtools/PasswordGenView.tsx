import React, { useState } from "react";
import { Key, Copy, Check, RefreshCw } from "lucide-react";
import { MemphisCard } from "../common/MemphisCard";
import { MemphisButton } from "../common/MemphisButton";
import { generatePassword, evaluatePasswordStrength } from "../../lib/toolknit/developerCore";

export const PasswordGenView: React.FC = () => {
  const [length, setLength] = useState<number>(16);
  const [uppercase, setUppercase] = useState<boolean>(true);
  const [lowercase, setLowercase] = useState<boolean>(true);
  const [numbers, setNumbers] = useState<boolean>(true);
  const [symbols, setSymbols] = useState<boolean>(true);
  const [excludeSimilar, setExcludeSimilar] = useState<boolean>(false);
  const [password, setPassword] = useState<string>("");
  const [copied, setCopied] = useState<boolean>(false);

  const handleGenerate = () => {
    const p = generatePassword({ length, uppercase, lowercase, numbers, symbols, excludeSimilar });
    setPassword(p);
    setCopied(false);
  };

  const handleCopy = () => {
    if (!password) return;
    navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const strength = password ? evaluatePasswordStrength(password) : null;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <MemphisCard className="p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-mem-ink/20 pb-4">
          <div className="flex items-center gap-2">
            <Key className="w-6 h-6 text-mem-coral" />
            <h2 className="font-display font-black text-xl text-mem-ink">密码生成器</h2>
          </div>
          <MemphisButton variant="coral" onClick={handleGenerate}>
            <RefreshCw className="w-4 h-4 mr-1" /> 生成密码
          </MemphisButton>
        </div>

        {password ? (
          <div className="p-4 bg-slate-900 rounded-lg text-mem-sky font-mono text-xl flex items-center justify-between break-all">
            <span>{password}</span>
            <button onClick={handleCopy} className="ml-4 p-2 bg-white/10 hover:bg-white/20 text-white rounded transition-colors">
              {copied ? <Check className="w-5 h-5 text-green-400" /> : <Copy className="w-5 h-5" />}
            </button>
          </div>
        ) : null}

        {strength ? (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-bold text-mem-ink">
              <span>密码强度: {strength.label}</span>
              <span>{strength.score} / 100</span>
            </div>
            <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden border border-mem-ink">
              <div className="h-full bg-mem-sky" style={{ width: String(strength.score) + "%" }} />
            </div>
          </div>
        ) : null}

        <div className="pt-4 border-t border-mem-ink/20 space-y-3">
          <div className="flex items-center justify-between">
            <label className="font-bold text-sm text-mem-ink">密码长度: {length}</label>
            <input type="range" min={6} max={64} value={length} onChange={e => setLength(Number(e.target.value))} className="w-48" />
          </div>
          <div className="grid grid-cols-2 gap-3 pt-2 text-sm">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={uppercase} onChange={e => setUppercase(e.target.checked)} className="w-4 h-4" />
              包含大写字母 (A-Z)
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={lowercase} onChange={e => setLowercase(e.target.checked)} className="w-4 h-4" />
              包含小写字母 (a-z)
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={numbers} onChange={e => setNumbers(e.target.checked)} className="w-4 h-4" />
              包含数字 (0-9)
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={symbols} onChange={e => setSymbols(e.target.checked)} className="w-4 h-4" />
              包含特殊符号 (!@#$)
            </label>
            <label className="flex items-center gap-2 cursor-pointer col-span-2">
              <input type="checkbox" checked={excludeSimilar} onChange={e => setExcludeSimilar(e.target.checked)} className="w-4 h-4" />
              排除易混淆字符 (il1Lo0O)
            </label>
          </div>
        </div>
      </MemphisCard>
    </div>
  );
};

