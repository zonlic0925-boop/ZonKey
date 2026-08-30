import React from 'react'
import { 
  History, 
  ShieldCheck, 
  Download, 
  CheckCircle2, 
  Clock, 
  FileText,
  FileSpreadsheet
} from 'lucide-react'

export interface AuditRecord {
  id: string
  timestamp: string
  fileName: string
  fileType: string
  redactionCount: number
  mode: string
  operator: string
  status: 'success' | 'warning' | 'error'
}

export const AuditView: React.FC = () => {
  const auditRecords: AuditRecord[] = [
    {
      id: 'AUD-20260826-001',
      timestamp: '2026-08-26 14:32:18',
      fileName: 'AA01_1K4168_A.pdf',
      fileType: 'PDF 图纸',
      redactionCount: 4,
      mode: '矢量真删除 + 边框归位',
      operator: '系统自动/本地离线',
      status: 'success'
    },
    {
      id: 'AUD-20260826-002',
      timestamp: '2026-08-26 14:28:05',
      fileName: 'BA02_2K5890_Markup.pdf',
      fileType: '纯栅格扫描件',
      redactionCount: 7,
      mode: 'RapidOCR + 坐标去重融合',
      operator: '系统自动/本地离线',
      status: 'success'
    },
    {
      id: 'AUD-20260826-003',
      timestamp: '2026-08-26 13:50:22',
      fileName: '技术合作保密补充协议.docx',
      fileType: 'Word 文档',
      redactionCount: 12,
      mode: 'PII 正则 + 敏感企业词掩码',
      operator: '系统自动/本地离线',
      status: 'success'
    }
  ]

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden p-8 gap-6 bg-slate-950/40 select-none">
      {/* 头部信息 */}
      <div className="p-6 rounded-3xl glass-panel border border-white/15 flex items-center justify-between shadow-glass">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400">
            <History className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">脱敏审计追踪与合规溯源日志</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              记录每次脱敏执行的详细元数据、敏感词命中项、脱敏模式与时间戳，支持一键导出审计报告。
            </p>
          </div>
        </div>

        <button
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl glass-button text-xs font-medium text-emerald-300 hover:text-white border-emerald-400/30 hover:border-emerald-400/60"
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>导出 CSV 审计报表</span>
        </button>
      </div>

      {/* 审计表格面板 */}
      <div className="flex-1 rounded-3xl glass-panel border border-white/10 p-6 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 text-slate-400 pb-3 font-semibold">
                <th className="pb-3 px-4">审计单号</th>
                <th className="pb-3 px-4">时间戳</th>
                <th className="pb-3 px-4">文件名称</th>
                <th className="pb-3 px-4">类型</th>
                <th className="pb-3 px-4">脱敏点数</th>
                <th className="pb-3 px-4">脱敏策略</th>
                <th className="pb-3 px-4">状态</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-200">
              {auditRecords.map((item) => (
                <tr key={item.id} className="hover:bg-white/5 transition-colors">
                  <td className="py-3.5 px-4 font-mono text-sky-400 font-medium">{item.id}</td>
                  <td className="py-3.5 px-4 text-slate-400">{item.timestamp}</td>
                  <td className="py-3.5 px-4 font-medium flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-slate-400" />
                    <span>{item.fileName}</span>
                  </td>
                  <td className="py-3.5 px-4 text-slate-400">{item.fileType}</td>
                  <td className="py-3.5 px-4 font-mono font-bold text-rose-400">{item.redactionCount} 处</td>
                  <td className="py-3.5 px-4 text-slate-300">{item.mode}</td>
                  <td className="py-3.5 px-4">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold border border-emerald-400/30">
                      <CheckCircle2 className="w-3 h-3" /> 合规成功
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
