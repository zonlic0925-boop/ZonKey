import React, { useEffect, useState } from 'react';
import {
  FileCode,
  Upload,
  Sparkles,
  Layers,
  RefreshCw,
  Plus,
  Trash2,
  Download,
  ShieldCheck,
} from 'lucide-react';

import { apiFetch, buildDownloadUrl, parseDownloadUrl } from '../lib/api';
import { APP_NAME } from '../lib/brand';
import { ExportDownloadButton } from './ExportDownloadButton';
import { WordHighlightText } from './WordHighlightText';
import { useI18n } from '../i18n';

interface WordViewProps {
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
  backendOnline?: boolean | null;
}

interface WordCustomRule {
  find: string;
  replace: string;
  mode: string;
  enabled?: boolean;
}

const LOCATION_KEYS: Record<string, string> = {
  body: 'word.locationBody',
};

function locationLabel(location: string, t: (key: string) => string): string {
  if (location in LOCATION_KEYS) return t(LOCATION_KEYS[location]);
  if (location.startsWith('header:')) return t('word.locationHeader');
  if (location.startsWith('footer:')) return t('word.locationFooter');
  if (location.startsWith('table:')) return t('word.locationTable');
  return location;
}

export const WordView: React.FC<WordViewProps> = ({ onNotify, backendOnline }) => {
  const { t } = useI18n();
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<any>(null);
  const [redacting, setRedacting] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [rulesLoaded, setRulesLoaded] = useState(false);
  const [activeRuleSummary, setActiveRuleSummary] = useState({ pii: 0, word: 0 });
  const [customRules, setCustomRules] = useState<WordCustomRule[]>([
    { find: '', replace: '*', mode: 'exact' },
  ]);

  const reloadDocumentRules = async () => {
    const data = await apiFetch<any>('/api/rules/document', undefined, 15000);
    const loaded = (data.word_replace_rules || [])
      .filter((rule: any) => rule.enabled !== false && String(rule.find || '').trim())
      .map((rule: any) => ({
        find: String(rule.find),
        replace: rule.replace || '*',
        mode: rule.mode || 'regex',
        enabled: true,
      }));

    const enabledPii = (data.pii_rules || []).filter((rule: any) => rule.enabled !== false);
    setActiveRuleSummary({
      pii: enabledPii.length,
      word: loaded.length,
    });
    return loaded;
  };

  useEffect(() => {
    if (backendOnline !== true || rulesLoaded) return;
    reloadDocumentRules()
      .then((loaded) => {
        if (loaded.length) {
          setCustomRules(loaded);
        }
        setRulesLoaded(true);
      })
      .catch(() => setRulesLoaded(true));
  }, [backendOnline, rulesLoaded]);

  const buildCustomRulesPayload = () =>
    customRules
      .filter((r) => r.find.trim() !== '')
      .map((r) => ({
        find: r.find.trim(),
        replace: r.replace || '*',
        mode: r.mode || 'exact',
        enabled: r.enabled !== false,
      }));

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    if (backendOnline === false) {
      onNotify(t('word.backendOffline'), 'error');
      return;
    }
    const selected = files[0];
    if (!selected.name.toLowerCase().endsWith('.docx')) {
      onNotify(t('word.docxOnly'), 'error');
      e.target.value = '';
      return;
    }
    setScanning(true);
    setScanResult(null);
    setDownloadUrl(null);

    const formData = new FormData();
    formData.append('file', selected);
    const payloadRules = buildCustomRulesPayload();
    if (payloadRules.length) {
      formData.append('custom_rules', JSON.stringify(payloadRules));
    }

    try {
      try {
        await reloadDocumentRules();
      } catch {
        /* 仍尝试扫描，服务端会从配置文件加载 PII 规则 */
      }

      const data = await apiFetch<any>('/api/word/upload-and-scan', { method: 'POST', body: formData });
      setScanResult(data);
      setActiveRuleSummary((prev) => ({
        pii: data.active_pii_rules ?? prev.pii,
        word: data.active_word_rules ?? prev.word,
      }));
      onNotify(
        data.total_matches > 0
          ? t('word.scanCompleteWithHits', { appName: APP_NAME, count: data.total_matches })
          : t('word.scanCompleteNoHits'),
        data.total_matches > 0 ? 'success' : 'info'
      );
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : t('word.scanFailed'), 'error');
    } finally {
      setScanning(false);
      e.target.value = '';
    }
  };

  const handleAddRule = () => {
    setCustomRules((prev) => [...prev, { find: '', replace: '*', mode: 'exact' }]);
  };

  const handleRemoveRule = (index: number) => {
    setCustomRules((prev) => prev.filter((_, i) => i !== index));
  };

  const handleExecuteRedact = async () => {
    if (!scanResult) return;
    setRedacting(true);
    try {
      const validRules = buildCustomRulesPayload();
      const data = await apiFetch<any>('/api/word/execute-redaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_id: scanResult.file_id,
          custom_rules: validRules,
        }),
      });
      setDownloadUrl(buildDownloadUrl(undefined, data.download_name));
      onNotify(
        t('word.redactComplete', { count: data.matches_count ?? 0, filename: data.download_name }),
        'success'
      );
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : t('word.redactFailed'), 'error');
    } finally {
      setRedacting(false);
    }
  };

  const renderParagraphBlock = (block: any, key: string | number) => {
    const hasMatches = block.matches?.length > 0;
    return (
      <div
        key={key}
        className={`p-4 rounded-xl border-2 text-xs leading-relaxed ${
          hasMatches
            ? 'bg-mem-coral/10 border-mem-coral/40'
            : 'bg-white border-mem-ink/10 text-mem-ink/60'
        }`}
      >
        <div className="text-[10px] text-mem-ink/40 mb-1 flex items-center justify-between gap-2">
          <span>
            {locationLabel(block.location || 'body', t)} #{block.index + 1}
          </span>
          {hasMatches && (
            <span className="text-mem-coral font-semibold px-2 py-0.5 rounded-lg bg-mem-coral/15 shrink-0">
              {t('word.matchCount', { count: block.matches.length })}
            </span>
          )}
        </div>
        <div>
          <WordHighlightText text={block.text} matches={block.matches} />
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 w-full h-full p-3 md:p-6 overflow-y-auto lg:overflow-hidden flex flex-col lg:flex-row gap-4 lg:gap-6 min-h-0">
      <div className="w-full lg:w-[460px] lg:h-full shrink-0 flex flex-col gap-4 lg:max-h-none lg:overflow-y-auto">
        <div className="p-6 memphis-card flex flex-col items-center justify-center text-center relative overflow-hidden group">
          <input
            type="file"
            accept=".docx"
            onChange={handleFileUpload}
            className="absolute inset-0 opacity-0 cursor-pointer z-10"
          />
          <div className="w-14 h-14 rounded-xl bg-mem-pink/40 border-2 border-mem-ink flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
            <FileCode className="w-6 h-6 text-mem-ink" />
          </div>
          <h3 className="text-sm font-display font-bold">{t('word.uploadTitle')}</h3>
          <p className="text-xs text-mem-ink/50 mt-1">{t('word.uploadSubtitle')}</p>
        </div>

        <div className="flex-1 memphis-card p-5 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between pb-3 border-b-2 border-mem-ink/10">
            <span className="text-xs font-bold flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-mem-coral" />
              {t('word.rulesTitle')}
            </span>
            <button onClick={handleAddRule} className="memphis-btn-ghost text-[11px] flex items-center gap-1">
              <Plus className="w-3 h-3" /> {t('word.addEntry')}
            </button>
          </div>

          <div className="my-3 p-3 rounded-xl bg-mem-teal/15 border-2 border-mem-ink/15 text-[11px] leading-relaxed text-mem-ink/70">
            <div className="flex items-center gap-1.5 font-semibold text-mem-ink mb-1">
              <ShieldCheck className="w-3.5 h-3.5 text-mem-teal" />
              {t('word.builtinTitle', { appName: APP_NAME })}
            </div>
            <p>{t('word.builtinSummary', { piiCount: activeRuleSummary.pii, wordCount: activeRuleSummary.word })}</p>
            <p className="mt-1 text-mem-ink/55">{t('word.builtinHint')}</p>
          </div>

          {scanResult && (
            <div className="mb-3 p-3 rounded-xl bg-mem-teal/20 border-2 border-mem-ink/20 flex items-center justify-between">
              <span className="text-xs">{t('word.scanResultLabel')}</span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-lg bg-mem-yellow/60 border border-mem-ink/20">
                {t('word.scanResultCount', { count: scanResult.total_matches })}
              </span>
            </div>
          )}

          <div className="flex-1 overflow-y-auto space-y-2.5 py-2 pr-1">
            <div className="text-[11px] text-mem-ink/50 mb-1">{t('word.replaceSectionHint')}</div>
            {customRules.map((rule, idx) => (
              <div key={idx} className="p-3 rounded-xl bg-mem-cream border-2 border-mem-ink/15 space-y-2">
                <div className="flex items-center gap-2">
                  <select
                    value={rule.mode}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCustomRules((prev) => prev.map((r, i) => (i === idx ? { ...r, mode: val } : r)));
                    }}
                    className="memphis-input text-[11px] py-1.5 w-24 shrink-0"
                  >
                    <option value="exact">{t('word.modeExact')}</option>
                    <option value="regex">{t('word.modeRegex')}</option>
                  </select>
                  {customRules.length > 1 && (
                    <button
                      onClick={() => handleRemoveRule(idx)}
                      className="ml-auto p-1.5 rounded-lg text-mem-ink/40 hover:text-mem-coral transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  placeholder={t('word.findPlaceholder')}
                  value={rule.find}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCustomRules((prev) => prev.map((r, i) => (i === idx ? { ...r, find: val } : r)));
                  }}
                  className="memphis-input w-full py-1.5 text-xs"
                />
                <input
                  type="text"
                  placeholder={t('word.replacePlaceholder')}
                  value={rule.replace}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCustomRules((prev) => prev.map((r, i) => (i === idx ? { ...r, replace: val } : r)));
                  }}
                  className="memphis-input w-full py-1.5 text-xs"
                />
              </div>
            ))}
          </div>

          <div className="pt-3 border-t-2 border-mem-ink/10 space-y-2">
            {parseDownloadUrl(downloadUrl) && (
              <ExportDownloadButton
                info={parseDownloadUrl(downloadUrl)!}
                label={t('export.labelWord')}
                onNotify={onNotify}
              />
            )}
            <button
              onClick={handleExecuteRedact}
              disabled={!scanResult || redacting}
              className="memphis-btn-primary w-full flex items-center justify-center gap-2"
            >
              {redacting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>{t('word.redactExecuting')}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>{t('word.redactExecute')}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-[40vh] lg:min-h-0 lg:h-full memphis-card p-4 md:p-6 flex flex-col lg:overflow-hidden">
        <div className="flex items-center justify-between pb-4 border-b-2 border-mem-ink/10">
          <span className="text-xs font-bold flex items-center gap-2">
            <Layers className="w-4 h-4 text-mem-pink" />
            {scanResult ? t('word.previewTitleWithFile', { filename: scanResult.filename }) : t('word.previewTitleEmpty')}
          </span>
          {scanResult && (
            <span className="text-[11px] text-mem-ink/50">
              {t('word.previewStats', {
                paragraphs: scanResult.paragraphs.length,
                tables: scanResult.tables.length,
                matches: scanResult.total_matches,
              })}
            </span>
          )}
        </div>

        <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-2">
          {scanning && (
            <div className="h-full flex flex-col items-center justify-center text-mem-ink/50 gap-3">
              <RefreshCw className="w-6 h-6 animate-spin text-mem-pink" />
              <span className="text-xs">{t('word.previewScanning', { appName: APP_NAME })}</span>
            </div>
          )}

          {!scanning && !scanResult && (
            <div className="h-full flex flex-col items-center justify-center text-mem-ink/40 gap-2">
              <FileCode className="w-10 h-10 opacity-30" />
              <span className="text-xs">{t('word.previewEmptyTitle')}</span>
              <span className="text-[11px]">{t('word.previewEmptyHint')}</span>
            </div>
          )}

          {!scanning && scanResult?.paragraphs.map((p: any) => renderParagraphBlock(p, `${p.location}-${p.index}`))}

          {!scanning &&
            scanResult?.tables.map((table: any) => (
              <div key={`table-${table.table_index}`} className="space-y-2">
                <div className="text-[11px] font-bold text-mem-ink/60">{t('word.tableTitle', { index: table.table_index + 1 })}</div>
                {table.rows.map((row: any[], rowIdx: number) =>
                  row.map((cell: any) =>
                    renderParagraphBlock(
                      {
                        index: rowIdx,
                        location: `table:${table.table_index}`,
                        text: cell.text,
                        matches: cell.matches || [],
                      },
                      `table-${table.table_index}-${rowIdx}-${cell.col_index}`
                    )
                  )
                )}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};
