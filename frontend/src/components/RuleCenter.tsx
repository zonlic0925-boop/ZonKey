import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Plus,
  Trash2,
  Save,
  RefreshCw,
  KeyRound,
  CreditCard,
  Smartphone,
  FileCheck,
  Building,
  Lock,
  FileCode,
  Stamp,
  WifiOff,
} from 'lucide-react';
import { apiFetch, normalizePiiRules } from '../lib/api';
import { APP_NAME } from '../lib/brand';
import { PiiRuleAddForm, NewPiiRulePayload } from './PiiRuleAddForm';
import { useI18n } from '../i18n';

interface RuleCenterProps {
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
  backendOnline?: boolean | null;
}

export const RuleCenter: React.FC<RuleCenterProps> = ({ onNotify, backendOnline }) => {
  const { t } = useI18n();
  const [enterpriseTerms, setEnterpriseTerms] = useState<string[]>([]);
  const [piiRules, setPiiRules] = useState<any[]>([]);
  const [wordRules, setWordRules] = useState<any[]>([]);
  const [sealRules, setSealRules] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [newTerm, setNewTerm] = useState('');

  const fetchRules = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [drawing, document] = await Promise.all([
        apiFetch<any>('/api/rules/drawing', undefined, 15000),
        apiFetch<any>('/api/rules/document', undefined, 15000),
      ]);
      setEnterpriseTerms(drawing.enterprise_terms || []);
      setPiiRules(normalizePiiRules(document.pii_rules || []));
      setWordRules(document.word_replace_rules || []);
      setSealRules(document.seal_rules || {});
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('rules.loadFailed');
      setLoadError(msg);
      onNotify(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (backendOnline === true) {
      fetchRules();
    } else if (backendOnline === false) {
      setLoading(false);
      setLoadError(t('rules.backendOffline'));
    }
  }, [backendOnline]);

  const handleAddTerm = () => {
    if (!newTerm.trim()) return;
    if (enterpriseTerms.includes(newTerm.trim())) {
      onNotify(t('rules.termExists'), 'info');
      return;
    }
    setEnterpriseTerms((prev) => [...prev, newTerm.trim()]);
    setNewTerm('');
  };

  const handleRemoveTerm = (term: string) => {
    setEnterpriseTerms((prev) => prev.filter((t) => t !== term));
  };

  const handleTogglePii = (ruleId: string) => {
    setPiiRules((prev) =>
      prev.map((r) => (r.id === ruleId ? { ...r, enabled: !r.enabled } : r))
    );
  };

  const handleAddPiiRule = (rule: NewPiiRulePayload) => {
    setPiiRules((prev) => [...prev, rule]);
  };

  const handleRemovePiiRule = (ruleId: string) => {
    setPiiRules((prev) => prev.filter((r) => r.id !== ruleId));
  };

  const handleSaveDrawing = async () => {
    setSaving(true);
    try {
      await apiFetch('/api/rules/drawing/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enterprise_terms: enterpriseTerms }),
      });
      onNotify(t('rules.drawingSaved'), 'success');
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : t('rules.saveFailed'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDocument = async () => {
    setSaving(true);
    try {
      await apiFetch('/api/rules/document/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pii_rules: piiRules }),
      });
      onNotify(t('rules.documentSaved', { appName: APP_NAME }), 'success');
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : t('rules.saveFailed'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const piiIcon = (name: string) => {
    if (name.includes('身份证')) return <KeyRound className="w-5 h-5" />;
    if (name.includes('护照')) return <FileCheck className="w-5 h-5" />;
    if (name.includes('手机')) return <Smartphone className="w-5 h-5" />;
    if (name.includes('银行卡')) return <CreditCard className="w-5 h-5" />;
    return <Lock className="w-5 h-5" />;
  };

  if (backendOnline === false) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="memphis-card p-8 max-w-md text-center flex flex-col items-center gap-3">
          <WifiOff className="w-10 h-10 text-mem-coral" />
          <h3 className="font-display font-bold">{t('rules.offlineTitle')}</h3>
          <p className="text-sm text-mem-ink/60">{t('rules.offlineHint')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 w-full h-full p-3 md:p-6 overflow-hidden flex flex-col gap-4 min-h-0">
      <div className="flex gap-4 text-[11px] flex-wrap">
        <span className="px-3 py-1 rounded-lg bg-mem-yellow/40 border-2 border-mem-ink/20">
          {t('rules.summaryDrawing')}: {t('rules.itemCount', { count: enterpriseTerms.length })}
        </span>
        <span className="px-3 py-1 rounded-lg bg-mem-teal/30 border-2 border-mem-ink/20">
          {t('rules.summaryPii', { appName: APP_NAME })}: {t('rules.itemCount', { count: piiRules.length })}
        </span>
        <span className="px-3 py-1 rounded-lg bg-mem-pink/30 border-2 border-mem-ink/20">
          {t('rules.summaryWordReplace')}: {t('rules.itemCount', { count: wordRules.length })}
        </span>
        <span className="px-3 py-1 rounded-lg bg-mem-sky/20 border-2 border-mem-ink/20">
          {t('rules.summarySeal')}: {t('rules.itemCount', { count: Object.keys(sealRules).length })}
        </span>
      </div>

      <div className="flex-1 min-h-0 flex flex-col xl:flex-row gap-4 xl:gap-6">
        {/* 工程图纸敏感词 */}
        <div className="flex-1 h-full memphis-card p-6 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between pb-4 border-b-2 border-mem-ink/10">
            <div className="flex items-center gap-2">
              <Building className="w-5 h-5 text-mem-sky" />
              <div>
                <h2 className="text-sm font-display font-bold">{t('rules.drawingTitle')}</h2>
                <p className="text-[11px] text-mem-ink/50">{t('rules.drawingSubtitle')}</p>
              </div>
            </div>
            <span className="text-xs px-2.5 py-1 rounded-lg bg-mem-teal/30 border-2 border-mem-ink/20 font-semibold">
              {t('rules.itemCount', { count: enterpriseTerms.length })}
            </span>
          </div>

          <div className="pt-4 flex gap-2">
            <input
              type="text"
              placeholder={t('rules.termPlaceholder')}
              value={newTerm}
              onChange={(e) => setNewTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddTerm()}
              className="memphis-input flex-1"
            />
            <button onClick={handleAddTerm} className="memphis-btn-secondary flex items-center gap-1.5">
              <Plus className="w-4 h-4" />
              {t('rules.add')}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto py-4 flex flex-wrap gap-2.5 content-start pr-1">
            {loading && (
              <div className="w-full flex items-center justify-center text-mem-ink/40 gap-2 py-8">
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span className="text-xs">{t('rules.loading')}</span>
              </div>
            )}
            {!loading && loadError && (
              <div className="w-full text-center text-mem-coral text-xs py-8">{loadError}</div>
            )}
            {!loading && !loadError && enterpriseTerms.length === 0 && (
              <div className="w-full text-center text-mem-ink/40 text-xs py-8">{t('rules.emptyDrawing')}</div>
            )}
            {!loading &&
              enterpriseTerms.map((term) => (
                <div
                  key={term}
                  className="px-3.5 py-1.5 rounded-xl bg-mem-yellow/30 border-2 border-mem-ink/20 text-xs flex items-center gap-2 group"
                >
                  <span>{term}</span>
                  <button
                    onClick={() => handleRemoveTerm(term)}
                    className="text-mem-ink/40 hover:text-mem-coral transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
          </div>

          <div className="pt-3 border-t-2 border-mem-ink/10 mt-auto">
            <button
              onClick={handleSaveDrawing}
              disabled={saving || loading}
              className="memphis-btn-secondary w-full flex items-center justify-center gap-1.5 text-xs"
            >
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {t('rules.saveDrawing')}
            </button>
          </div>
        </div>

        {/* PII + Word + 印章 */}
        <div className="flex-1 h-full memphis-card p-6 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between pb-4 border-b-2 border-mem-ink/10">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-mem-teal" />
              <div>
                <h2 className="text-sm font-display font-bold">{t('rules.piiTitle', { appName: APP_NAME })}</h2>
                <p className="text-[11px] text-mem-ink/50">{t('rules.piiSource')}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={fetchRules} className="memphis-btn-ghost p-2" title={t('rules.reloadTitle')}>
                <RefreshCw className="w-4 h-4" />
              </button>
              <button
                onClick={handleSaveDocument}
                disabled={saving || loading}
                className="memphis-btn-primary flex items-center gap-1.5 text-xs"
              >
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>{t('rules.savePii', { appName: APP_NAME })}</span>
              </button>
            </div>
          </div>

          <PiiRuleAddForm disabled={loading} onAdd={handleAddPiiRule} onNotify={onNotify} />

          <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
            {loading && (
              <div className="flex items-center justify-center text-mem-ink/40 gap-2 py-8">
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span className="text-xs">{t('rules.loadingPii')}</span>
              </div>
            )}

            {!loading && piiRules.map((rule) => {
              const isEnabled = rule.enabled !== false;
              return (
                <div
                  key={rule.id}
                  className={`p-4 rounded-xl border-2 transition-all flex items-center justify-between gap-2 ${
                    isEnabled
                      ? 'bg-mem-lime/25 border-mem-teal shadow-memphis-sm'
                      : 'bg-white border-mem-ink/15 text-mem-ink/40'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => handleTogglePii(rule.id)}
                    className="flex items-center gap-3.5 flex-1 min-w-0 text-left cursor-pointer"
                  >
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center border-2 shrink-0 ${
                        isEnabled ? 'bg-mem-teal/30 border-mem-ink' : 'bg-mem-cream border-mem-ink/20'
                      }`}
                    >
                      {piiIcon(rule.name || '')}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold truncate">{rule.name}</div>
                      <div className="text-[11px] text-mem-ink/50 mt-0.5 truncate">
                        {rule.category || t('rules.categoryFallback')} · {rule.description || t('rules.descriptionFallback')}
                      </div>
                    </div>
                  </button>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span
                      className={`text-[11px] px-2.5 py-1 rounded-lg font-medium border ${
                        isEnabled ? 'bg-mem-teal/30 border-mem-ink/30' : 'bg-mem-cream border-mem-ink/15'
                      }`}
                    >
                      {isEnabled ? t('rules.enabled') : t('rules.disabled')}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemovePiiRule(rule.id)}
                      className="p-1.5 rounded-lg text-mem-ink/40 hover:text-mem-coral hover:bg-mem-coral/10 transition-colors"
                      title={t('rules.deleteTitle')}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}

            {!loading && wordRules.length > 0 && (
              <div className="pt-2">
                <div className="text-xs font-bold flex items-center gap-2 mb-2">
                  <FileCode className="w-4 h-4 text-mem-pink" />
                  {t('rules.wordReplaceTitle', { count: wordRules.length })}
                </div>
                {wordRules.map((rule: any, idx: number) => (
                  <div
                    key={idx}
                    className="p-3 mb-2 rounded-xl bg-mem-pink/10 border-2 border-mem-ink/15 text-xs"
                  >
                    <div className="font-semibold">{rule.name || t('rules.unnamedRule', { index: idx + 1 })}</div>
                    <div className="text-mem-ink/50 mt-1 font-mono text-[10px] truncate">
                      {rule.find} → {rule.replace}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!loading && Object.keys(sealRules).length > 0 && (
              <div className="pt-2">
                <div className="text-xs font-bold flex items-center gap-2 mb-2">
                  <Stamp className="w-4 h-4 text-mem-coral" />
                  {t('rules.sealTitle')}
                </div>
                {Object.entries(sealRules).map(([key, rule]: [string, any]) => (
                  <div
                    key={key}
                    className="p-3 mb-2 rounded-xl bg-mem-coral/10 border-2 border-mem-ink/15 text-xs flex justify-between"
                  >
                    <span className="font-semibold">{rule.name || key}</span>
                    <span className="text-mem-ink/50">{rule.enabled !== false ? t('rules.sealEnabled') : t('rules.sealDisabled')}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
