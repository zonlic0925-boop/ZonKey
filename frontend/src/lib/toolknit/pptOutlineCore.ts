/**
 * PPT 大纲生成核心 — 离线模板驱动（无 AI、无联网，语义对齐 ToolKnit
 * ppt-outline-core.js 的角色/类型体系；生成逻辑为确定性模板填充）。
 *
 * 产物为结构化大纲（可导出 Markdown），可直接交给「草稿生成」构建 .pptx。
 */

export const PPT_OUTLINE_LIMITS = Object.freeze({
  maxTopicChars: 500,
  minSlides: 3,
  maxSlides: 30,
  maxSlideBodyItems: 6,
});

export type PptOutlineLocale = 'zh-CN' | 'en';

export const PPT_OUTLINE_DECK_TYPES = [
  'auto',
  'product-launch',
  'investor-pitch',
  'work-report',
  'training',
  'industry-research',
  'competitive-analysis',
  'short-video-demo',
  'project-review',
] as const;

export type PptOutlineDeckType = (typeof PPT_OUTLINE_DECK_TYPES)[number];

type SlideRole =
  | 'cover' | 'agenda' | 'context' | 'problem' | 'insight' | 'evidence'
  | 'comparison' | 'workflow' | 'roadmap' | 'risk' | 'recommendation' | 'closing';

export interface PptOutlineSlide {
  role: SlideRole;
  title: string;
  bullets: string[];
}

export interface PptOutline {
  title: string;
  deckType: Exclude<PptOutlineDeckType, 'auto'>;
  locale: PptOutlineLocale;
  audience: string;
  purpose: string;
  slides: PptOutlineSlide[];
}

export interface PptOutlineRequest {
  topic: string;
  deckType?: PptOutlineDeckType;
  locale?: PptOutlineLocale;
  slideCount?: number;
  audience?: string;
  purpose?: string;
}

// ===== 各演示类型的内容角色序列（cover/closing 固定首尾） =====

const DECK_ROLE_SEQUENCES: Record<Exclude<PptOutlineDeckType, 'auto'>, SlideRole[]> = {
  'product-launch': ['agenda', 'problem', 'insight', 'workflow', 'comparison', 'evidence', 'roadmap', 'recommendation'],
  'investor-pitch': ['agenda', 'problem', 'insight', 'evidence', 'comparison', 'roadmap', 'risk', 'recommendation'],
  'work-report': ['agenda', 'context', 'evidence', 'insight', 'risk', 'roadmap'],
  training: ['agenda', 'context', 'workflow', 'workflow', 'evidence', 'recommendation'],
  'industry-research': ['agenda', 'context', 'insight', 'evidence', 'comparison', 'recommendation'],
  'competitive-analysis': ['agenda', 'context', 'comparison', 'insight', 'risk', 'recommendation'],
  'short-video-demo': ['context', 'workflow', 'evidence', 'closing'],
  'project-review': ['agenda', 'context', 'evidence', 'risk', 'roadmap'],
};

// 兜底序列：auto 或未知类型
const FALLBACK_SEQUENCE: SlideRole[] = ['agenda', 'context', 'problem', 'insight', 'evidence', 'roadmap', 'recommendation'];

// ===== 模板文案（zh-CN / en 双语） =====

interface RoleTemplates {
  title: (topic: string) => string;
  bullets: (topic: string) => string[];
}

const TEMPLATES: Record<PptOutlineLocale, Record<SlideRole, RoleTemplates>> = {
  'zh-CN': {
    cover: {
      title: (t) => t,
      bullets: (t) => [`${t} · 汇报大纲`],
    },
    agenda: {
      title: () => '目录',
      bullets: () => ['背景与现状', '核心问题与洞察', '方案与计划'],
    },
    context: {
      title: (t) => `背景：${t} 的现状`,
      bullets: (t) => [
        `${t} 当前所处的环境与约束`,
        '相关方关注的关键点',
        '本部分需要传达的核心事实',
      ],
    },
    problem: {
      title: (t) => `问题：${t} 面临的挑战`,
      bullets: () => [
        '现状与目标之间的差距',
        '问题的影响面与紧迫性',
        '为什么现在必须解决',
      ],
    },
    insight: {
      title: (t) => `核心洞察：${t}`,
      bullets: () => [
        '一、从事实中提炼的关键判断',
        '二、判断背后的依据链',
        '三、对后续行动的指引',
      ],
    },
    evidence: {
      title: (t) => `数据与佐证：${t}`,
      bullets: () => [
        '关键数据 / 指标（此处填入）',
        '对比基准与变化趋势',
        '来源与口径说明',
      ],
    },
    comparison: {
      title: (t) => `方案对比：${t}`,
      bullets: () => [
        '方案 A：优势 / 代价',
        '方案 B：优势 / 代价',
        '对比结论与选择理由',
      ],
    },
    workflow: {
      title: (t) => `执行路径：${t}`,
      bullets: () => [
        '第一步：准备与输入',
        '第二步：关键动作',
        '第三步：交付与验收',
      ],
    },
    roadmap: {
      title: (t) => `里程碑规划：${t}`,
      bullets: () => [
        '近期（1 个月内）：……',
        '中期（1 个季度）：……',
        '远期（半年以上）：……',
      ],
    },
    risk: {
      title: (t) => `风险与对策：${t}`,
      bullets: () => [
        '风险一：影响与概率 → 缓解措施',
        '风险二：影响与概率 → 缓解措施',
        '兜底预案',
      ],
    },
    recommendation: {
      title: (t) => `行动建议：${t}`,
      bullets: () => [
        '立即执行的事项',
        '需要决策 / 资源支持的事项',
        '下一步时间表',
      ],
    },
    closing: {
      title: () => '总结与致谢',
      bullets: (t) => [`回顾：${t} 的关键结论`, 'Q & A'],
    },
  },
  en: {
    cover: {
      title: (t) => t,
      bullets: (t) => [`${t} · Outline`],
    },
    agenda: {
      title: () => 'Agenda',
      bullets: () => ['Background', 'Key problems & insights', 'Plan & next steps'],
    },
    context: {
      title: (t) => `Background: ${t}`,
      bullets: () => ['Current environment & constraints', 'What stakeholders care about', 'Key facts to convey'],
    },
    problem: {
      title: (t) => `Problem: challenges around ${t}`,
      bullets: () => ['Gap between status quo and goal', 'Impact & urgency', 'Why it must be solved now'],
    },
    insight: {
      title: (t) => `Key insight: ${t}`,
      bullets: () => ['The judgment distilled from facts', 'The evidence chain behind it', 'What it implies for action'],
    },
    evidence: {
      title: (t) => `Evidence: ${t}`,
      bullets: () => ['Key metrics (fill in)', 'Baseline & trend comparison', 'Source & definition notes'],
    },
    comparison: {
      title: (t) => `Options compared: ${t}`,
      bullets: () => ['Option A: strengths / costs', 'Option B: strengths / costs', 'Conclusion & rationale'],
    },
    workflow: {
      title: (t) => `Execution path: ${t}`,
      bullets: () => ['Step 1: preparation & inputs', 'Step 2: key actions', 'Step 3: delivery & acceptance'],
    },
    roadmap: {
      title: (t) => `Milestones: ${t}`,
      bullets: () => ['Near term (1 month): …', 'Mid term (1 quarter): …', 'Long term (6+ months): …'],
    },
    risk: {
      title: (t) => `Risks & mitigations: ${t}`,
      bullets: () => ['Risk 1: impact & likelihood → mitigation', 'Risk 2: impact & likelihood → mitigation', 'Fallback plan'],
    },
    recommendation: {
      title: (t) => `Recommendations: ${t}`,
      bullets: () => ['Execute immediately', 'Needs decision / resources', 'Next-step timeline'],
    },
    closing: {
      title: () => 'Summary & Thanks',
      bullets: (t) => [`Recap: key takeaways of ${t}`, 'Q & A'],
    },
  },
};

const DECK_TYPE_LABELS: Record<PptOutlineLocale, Record<Exclude<PptOutlineDeckType, 'auto'>, string>> = {
  'zh-CN': {
    'product-launch': '产品发布', 'investor-pitch': '融资路演', 'work-report': '工作汇报',
    training: '培训课件', 'industry-research': '行业研究', 'competitive-analysis': '竞品分析',
    'short-video-demo': '短视频脚本', 'project-review': '项目复盘',
  },
  en: {
    'product-launch': 'Product Launch', 'investor-pitch': 'Investor Pitch', 'work-report': 'Work Report',
    training: 'Training', 'industry-research': 'Industry Research', 'competitive-analysis': 'Competitive Analysis',
    'short-video-demo': 'Short Video Demo', 'project-review': 'Project Review',
  },
};

// ===== 归一化 =====

export function normalizePptOutlineRequest(request: PptOutlineRequest): Required<PptOutlineRequest> {
  const topic = String(request.topic || '').trim().slice(0, PPT_OUTLINE_LIMITS.maxTopicChars);
  if (!topic) throw new Error('Topic is required');
  const locale: PptOutlineLocale = request.locale === 'en' ? 'en' : 'zh-CN';

  let deckType = request.deckType && PPT_OUTLINE_DECK_TYPES.includes(request.deckType) ? request.deckType : 'auto';
  if (deckType === 'auto') deckType = 'product-launch'; // auto 兜底为最通用类型

  let slideCount = Number(request.slideCount);
  if (!Number.isSafeInteger(slideCount)) slideCount = 10;
  slideCount = Math.min(Math.max(slideCount, PPT_OUTLINE_LIMITS.minSlides), PPT_OUTLINE_LIMITS.maxSlides);

  return {
    topic,
    deckType,
    locale,
    slideCount,
    audience: String(request.audience || '').trim().slice(0, 200),
    purpose: String(request.purpose || '').trim().slice(0, 200),
  };
}

// ===== 生成 =====

export function generatePptOutline(request: PptOutlineRequest): PptOutline {
  const normalized = normalizePptOutlineRequest(request);
  const { topic, locale, slideCount, audience, purpose } = normalized;
  const templates = TEMPLATES[locale];

  const sequence: SlideRole[] =
    normalized.deckType in DECK_ROLE_SEQUENCES
      ? DECK_ROLE_SEQUENCES[normalized.deckType as Exclude<PptOutlineDeckType, 'auto'>]
      : FALLBACK_SEQUENCE;

  // 中段角色数量 = 目标页数 - 封面 - 结尾；不足则裁剪中段，超出则用 insight/evidence 轮转补足
  const bodyTarget = Math.max(slideCount - 2, 0);
  const body: SlideRole[] = [];
  const filler: SlideRole[] = ['insight', 'evidence', 'workflow'];
  for (let index = 0; body.length < bodyTarget; index += 1) {
    const role = index < sequence.length ? sequence[index] : filler[index % filler.length];
    if (role === 'closing') continue;
    body.push(role);
  }

  const slides: PptOutlineSlide[] = [];
  slides.push(buildRoleSlide('cover', templates, topic));
  if (body.length > 1) slides.push(buildRoleSlide('agenda', templates, topic));
  const bodyStart = slides.length;
  for (const role of body) slides.push(buildRoleSlide(role, templates, topic));
  slides.push(buildRoleSlide('closing', templates, topic));

  // 超出目标页数时从正文中段裁剪（保封面/目录/结尾）
  while (slides.length > slideCount && slides.length - bodyStart > 0) {
    slides.splice(bodyStart, 1);
  }

  const titleSuffix = DECK_TYPE_LABELS[locale][normalized.deckType as Exclude<PptOutlineDeckType, 'auto'>];
  const deckTitle = locale === 'zh-CN' ? `${topic}（${titleSuffix}）` : `${topic} (${titleSuffix})`;

  return {
    title: deckTitle,
    deckType: normalized.deckType as Exclude<PptOutlineDeckType, 'auto'>,
    locale,
    audience,
    purpose,
    slides: slides.slice(0, PPT_OUTLINE_LIMITS.maxSlides),
  };
}

function buildRoleSlide(role: SlideRole, templates: Record<SlideRole, RoleTemplates>, topic: string): PptOutlineSlide {
  const template = templates[role];
  return {
    role,
    title: template.title(topic),
    bullets: template.bullets(topic).slice(0, PPT_OUTLINE_LIMITS.maxSlideBodyItems),
  };
}

// ===== Markdown 序列化 / 解析（大纲 → 人工编辑 → 草稿 的桥） =====

export function createPptOutlineMarkdown(outline: PptOutline): string {
  const lines: string[] = [`# ${outline.title}`, ''];
  for (const slide of outline.slides) {
    lines.push(`## ${slide.title}`);
    for (const bullet of slide.bullets) lines.push(`- ${bullet}`);
    lines.push('');
  }
  return lines.join('\n');
}

export interface ParsedOutlineDeck {
  title: string;
  slides: { title: string; bullets: string[] }[];
}

/** 解析用户编辑后的大纲 Markdown（# 总标题 / ## 页标题 / - 条目） */
export function parsePptOutlineMarkdown(text: string): ParsedOutlineDeck {
  const deck: ParsedOutlineDeck = { title: '', slides: [] };
  let current: { title: string; bullets: string[] } | null = null;

  for (const rawLine of String(text || '').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith('# ') && !line.startsWith('## ')) {
      deck.title = line.slice(2).trim();
      continue;
    }
    if (line.startsWith('## ')) {
      if (current) deck.slides.push(current);
      current = { title: line.slice(3).trim(), bullets: [] };
      continue;
    }
    const bulletMatch = /^[-*·]\s+(.*)$/.exec(line);
    if (bulletMatch && current) {
      if (current.bullets.length < PPT_OUTLINE_LIMITS.maxSlideBodyItems) {
        current.bullets.push(bulletMatch[1].trim());
      }
      continue;
    }
    // 无标记的普通文本行：附加到最后一个条目（容错手工输入）
    if (current && current.bullets.length > 0) {
      current.bullets[current.bullets.length - 1] += ` ${line}`;
    } else if (current) {
      current.bullets.push(line);
    }
  }
  if (current) deck.slides.push(current);

  if (!deck.title && deck.slides.length === 0) {
    throw new Error('Outline is empty — expected "# title" and "## slide" lines');
  }
  if (deck.slides.length > PPT_OUTLINE_LIMITS.maxSlides) {
    deck.slides.length = PPT_OUTLINE_LIMITS.maxSlides;
  }
  return deck;
}
