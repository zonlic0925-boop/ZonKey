/**
 * Markdown 编辑器核心 — 移植自 ToolKnit markdown-editor-core.js。
 * 当前版本：markdown-it (GFM 风格) + 任务列表 + 工具栏动作 + 大纲提取 + 独立 HTML 导出。
 * 数学公式 (KaTeX) 与 Mermaid 图表留待后续版本接入。
 */
import MarkdownIt from 'markdown-it';
import taskLists from 'markdown-it-task-lists';

type MarkdownItInstance = InstanceType<typeof MarkdownIt>;

export const MARKDOWN_DRAFT_KEY = 'zonscale.markdown.draft.v1';

export const DEFAULT_MARKDOWN = `# ZonScale Markdown 文档

> 一份留在本机、可以随时继续编辑的文档。

## 从这里开始

右侧输入 Markdown，左侧会实时呈现排版结果。你可以使用顶部工具栏插入常用语法。

### 常用内容

- [x] 支持任务列表 (GFM)
- [x] 表格、代码块、引用
- [ ] 写下你的下一项计划

| 能力 | 状态 | 说明 |
| --- | :---: | --- |
| 实时预览 | 可用 | 输入后自动更新 |
| 本地草稿 | 可用 | 不会上传文档内容 |
| 离线导出 | 可用 | Markdown 或 HTML |

---

继续写下你的内容。`;

export function createMarkdownRenderer(): MarkdownItInstance {
  const md: MarkdownItInstance = new MarkdownIt({ html: false, linkify: true, typographer: true, breaks: false });
  md.use(taskLists as never, { enabled: true, label: true, labelAfter: true });
  return md;
}

const headingParser = new MarkdownIt({ html: false });

export interface MarkdownHeading {
  level: number;
  text: string;
  line: number;
  id: string;
}

function inlineHeadingText(token: { children?: Array<{ type: string; content: string; attrGet?: (name: string) => string | null }> }): string {
  const children = token?.children || [];
  return children
    .map((child) => {
      if (['text', 'code_inline'].includes(child.type)) return child.content;
      if (child.type === 'image') return child.content || (child.attrGet ? child.attrGet('alt') : '') || '';
      if (['softbreak', 'hardbreak'].includes(child.type)) return ' ';
      return '';
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractMarkdownHeadingsFromTokens(tokens: Array<Record<string, unknown>> = []): MarkdownHeading[] {
  const headings: MarkdownHeading[] = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index] as { type: string; tag?: string; map?: number[] };
    if (token.type !== 'heading_open') continue;
    const inline = tokens[index + 1] as Parameters<typeof inlineHeadingText>[0];
    const text = inlineHeadingText(inline ?? {});
    if (!text) continue;
    headings.push({
      level: Number((token.tag ?? 'h1').slice(1)),
      text,
      line: ((token.map?.[0] ?? 0) as number) + 1,
      id: `md-heading-${headings.length + 1}`,
    });
  }
  return headings;
}

export function extractMarkdownHeadings(markdown = ''): MarkdownHeading[] {
  return extractMarkdownHeadingsFromTokens(headingParser.parse(String(markdown), {}) as unknown as Array<Record<string, unknown>>);
}

export type MarkdownAction =
  | 'bold' | 'italic' | 'strike' | 'code' | 'link' | 'quote'
  | 'h1' | 'h2' | 'h3' | 'ul' | 'ol' | 'task' | 'divider' | 'table' | 'codeblock';

const TOOL_ACTIONS: Record<MarkdownAction, [string, string, string]> = {
  bold: ['**', '**', '加粗文字'],
  italic: ['*', '*', '斜体文字'],
  strike: ['~~', '~~', '删除线文字'],
  code: ['`', '`', '代码'],
  link: ['[', '](https://example.com)', '链接文字'],
  quote: ['> ', '', '引用内容'],
  h1: ['# ', '', '一级标题'],
  h2: ['## ', '', '二级标题'],
  h3: ['### ', '', '三级标题'],
  ul: ['- ', '', '列表项目'],
  ol: ['1. ', '', '列表项目'],
  task: ['- [ ] ', '', '待办事项'],
  divider: ['\n---\n', '', ''],
  table: ['\n| 列一 | 列二 |\n| --- | --- |\n| 内容 | 内容 |\n', '', ''],
  codeblock: ['\n```text\n', '\n```\n', '代码内容'],
};

export interface MarkdownActionResult {
  text: string;
  start: number;
  end: number;
}

export function applyMarkdownAction(text: string, start: number, end: number, action: MarkdownAction): MarkdownActionResult {
  const source = String(text ?? '');
  const safeStart = Math.max(0, Math.min(Number(start) || 0, source.length));
  const safeEnd = Math.max(safeStart, Math.min(Number(end) || safeStart, source.length));
  const selected = source.slice(safeStart, safeEnd);
  const spec = TOOL_ACTIONS[action];
  if (!spec) return { text: source, start: safeStart, end: safeEnd };
  const [prefix, suffix, fallback] = spec;
  const body = selected || fallback;
  const inserted = `${prefix}${body}${suffix}`;
  const next = `${source.slice(0, safeStart)}${inserted}${source.slice(safeEnd)}`;
  const selectionStart = safeStart + prefix.length;
  return { text: next, start: selectionStart, end: selectionStart + body.length };
}

export function sanitizeExportBaseName(value: string, fallback = 'zonscale-document'): string {
  const name = String(value || fallback)
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
    .replace(/[. ]+$/g, '')
    .trim()
    .slice(0, 80);
  return name || fallback;
}

export function buildStandaloneMarkdownHtml({ title, renderedHtml }: { title: string; renderedHtml: string }): string {
  const safeTitle = String(title || 'ZonScale Markdown').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] as string);
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${safeTitle}</title><style>
:root{color-scheme:light;--ink:#17201d;--muted:#5e6b66;--line:#dce3df;--accent:#136f63}
*{box-sizing:border-box}body{margin:0;background:#eef2ef;color:var(--ink);font:16px/1.8 system-ui,-apple-system,"Segoe UI","Microsoft YaHei",sans-serif}
main{width:min(900px,calc(100% - 40px));margin:40px auto;padding:56px 64px;background:#fff;border:1px solid var(--line);box-shadow:0 18px 50px rgba(18,38,32,.08)}
h1,h2,h3,h4,h5,h6{line-height:1.35;margin:1.8em 0 .65em}h1{font-size:2.35rem;border-bottom:2px solid var(--ink);padding-bottom:.35em}h2{font-size:1.7rem;border-bottom:1px solid var(--line);padding-bottom:.25em}
a{color:var(--accent)}blockquote{margin:1.4em 0;padding:.25em 1.2em;border-left:4px solid var(--accent);color:var(--muted);background:#f5f8f6}code{padding:.15em .35em;background:#eef3f0;border-radius:4px}pre{overflow:auto;padding:20px;background:#17201d;color:#f2f6f4;border-radius:6px}pre code{padding:0;background:none;color:inherit}
table{width:100%;border-collapse:collapse;margin:1.5em 0}th,td{padding:10px 12px;border:1px solid var(--line);text-align:left}th{background:#f3f6f4}img,svg{max-width:100%;height:auto}hr{border:0;border-top:1px solid var(--line);margin:2.2em 0}
input[type=checkbox]{margin-right:.4em}
@media(max-width:680px){main{width:100%;margin:0;padding:30px 22px;border:0}h1{font-size:1.9rem}}
@media print{body{background:#fff}main{width:auto;margin:0;padding:0;border:0;box-shadow:none}}
</style></head><body><main>${renderedHtml}</main></body></html>`;
}
