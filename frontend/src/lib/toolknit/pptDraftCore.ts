/**
 * PPT 草稿构建核心 — 大纲 → 合法 .pptx（纯 JSZip，离线）。
 * OOXML 骨架对齐 ToolKnit ppt-draft-core.js 的已验证实现：
 * 16:9 版式、单 slideMaster/blank slideLayout/simple theme、逐页独立 slide XML。
 */

import JSZip from 'jszip';
import type { ParsedOutlineDeck } from './pptOutlineCore';

export const PPT_DRAFT_LIMITS = Object.freeze({
  minSlides: 1,
  maxSlides: 30,
  maxTitleChars: 120,
  maxBulletChars: 110,
  maxBulletsPerSlide: 6,
});

const EMU_PER_INCH = 914400;
const inch = (value: number) => Math.round(value * EMU_PER_INCH);
const SLIDE_CX = inch(13.333333); // 16:9 宽版
const SLIDE_CY = inch(7.5);

export interface PptDraftTheme {
  id: string;
  name: string;
  background: string;
  text: string;
  muted: string;
  accent: string;
}

export const PPT_DRAFT_THEMES: Record<string, PptDraftTheme> = {
  'minimal-mono': {
    id: 'minimal-mono',
    name: 'Minimal Mono',
    background: 'FFFFFF',
    text: '1A1A1A',
    muted: '5A6B7B',
    accent: '2E6FA3',
  },
  'memphis-coral': {
    id: 'memphis-coral',
    name: 'Memphis Coral',
    background: 'FDF6EC',
    text: '1F1F1F',
    muted: '6B5D52',
    accent: 'E4572E',
  },
};

const XML_HEADER = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

function xmlEscape(value: string): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    // 控制字符非法，替换为空格防文档损坏
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ' ');
}

// ===== OOXML 包部件（骨架对齐原版已验证实现） =====

function buildContentTypes(slideCount: number): string {
  const slides = Array.from(
    { length: slideCount },
    (_, index) =>
      `<Override PartName="/ppt/slides/slide${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`,
  ).join('');
  return `${XML_HEADER}
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.slideMaster+xml"/>
  <Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.slideLayout+xml"/>
  <Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>
  ${slides}
</Types>`;
}

function rootRels(): string {
  return `${XML_HEADER}
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`;
}

function buildPresentationXml(slideCount: number): string {
  const slideIds = Array.from(
    { length: slideCount },
    (_, index) => `<p:sldId id="${256 + index}" r:id="rId${index + 2}"/>`,
  ).join('');
  // sldSz 不带 type 属性：ST_SlideSizeType 枚举无 "wide"，非法值会令 PowerPoint 判定文件损坏
  return `${XML_HEADER}
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>
  <p:sldIdLst>${slideIds}</p:sldIdLst>
  <p:sldSz cx="${SLIDE_CX}" cy="${SLIDE_CY}"/>
  <p:notesSz cx="6858000" cy="9144000"/>
  <p:defaultTextStyle><a:defPPr><a:defRPr lang="zh-CN"/></a:defPPr></p:defaultTextStyle>
</p:presentation>`;
}

function buildPresentationRels(slideCount: number): string {
  const slideRels = Array.from(
    { length: slideCount },
    (_, index) =>
      `<Relationship Id="rId${index + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${index + 1}.xml"/>`,
  ).join('');
  return `${XML_HEADER}
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>
  ${slideRels}
  <Relationship Id="rId${slideCount + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/>
</Relationships>`;
}

function slideMasterXml(theme: PptDraftTheme): string {
  return `${XML_HEADER}
<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld>
  <p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>
  <p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>
  <p:txStyles><p:titleStyle/><p:bodyStyle/><p:otherStyle/></p:txStyles>
</p:sldMaster>`;
}

function slideLayoutXml(): string {
  return `${XML_HEADER}
<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank" preserve="1">
  <p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sldLayout>`;
}

function themeXml(theme: PptDraftTheme): string {
  // fmtScheme 必须恰好 3 组 fill / 3 组 line / 3 组 effect / 3 组 bgFill（ECMA-376），
  // 少于 3 组 PowerPoint 会判定文件损坏拒绝打开。
  return `${XML_HEADER}
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="${xmlEscape(theme.name)}">
  <a:themeElements>
    <a:clrScheme name="${xmlEscape(theme.name)}"><a:dk1><a:srgbClr val="${theme.text}"/></a:dk1><a:lt1><a:srgbClr val="${theme.background}"/></a:lt1><a:dk2><a:srgbClr val="${theme.muted}"/></a:dk2><a:lt2><a:srgbClr val="${theme.background}"/></a:lt2><a:accent1><a:srgbClr val="${theme.accent}"/></a:accent1><a:accent2><a:srgbClr val="${theme.muted}"/></a:accent2><a:accent3><a:srgbClr val="${theme.text}"/></a:accent3><a:accent4><a:srgbClr val="888888"/></a:accent4><a:accent5><a:srgbClr val="666666"/></a:accent5><a:accent6><a:srgbClr val="444444"/></a:accent6><a:hlink><a:srgbClr val="${theme.accent}"/></a:hlink><a:folHlink><a:srgbClr val="${theme.muted}"/></a:folHlink></a:clrScheme>
    <a:fontScheme name="${xmlEscape(theme.name)}"><a:majorFont><a:latin typeface="Microsoft YaHei"/><a:ea typeface="Microsoft YaHei"/><a:cs typeface="Microsoft YaHei"/></a:majorFont><a:minorFont><a:latin typeface="Microsoft YaHei"/><a:ea typeface="Microsoft YaHei"/><a:cs typeface="Microsoft YaHei"/></a:minorFont></a:fontScheme>
    <a:fmtScheme name="${xmlEscape(theme.name)}">
      <a:fillStyleLst>
        <a:solidFill><a:srgbClr val="${theme.background}"/></a:solidFill>
        <a:solidFill><a:srgbClr val="${theme.accent}"/></a:solidFill>
        <a:solidFill><a:srgbClr val="${theme.muted}"/></a:solidFill>
      </a:fillStyleLst>
      <a:lnStyleLst>
        <a:ln w="9525"><a:solidFill><a:srgbClr val="${theme.muted}"/></a:solidFill></a:ln>
        <a:ln w="19050"><a:solidFill><a:srgbClr val="${theme.text}"/></a:solidFill></a:ln>
        <a:ln w="28575"><a:solidFill><a:srgbClr val="${theme.accent}"/></a:solidFill></a:ln>
      </a:lnStyleLst>
      <a:effectStyleLst>
        <a:effectStyle><a:effectLst/></a:effectStyle>
        <a:effectStyle><a:effectLst/></a:effectStyle>
        <a:effectStyle><a:effectLst/></a:effectStyle>
      </a:effectStyleLst>
      <a:bgFillStyleLst>
        <a:solidFill><a:srgbClr val="${theme.background}"/></a:solidFill>
        <a:solidFill><a:srgbClr val="${theme.accent}"/></a:solidFill>
        <a:solidFill><a:srgbClr val="${theme.muted}"/></a:solidFill>
      </a:bgFillStyleLst>
    </a:fmtScheme>
  </a:themeElements>
</a:theme>`;
}

function docPropsCore(title: string): string {
  const now = new Date().toISOString();
  return `${XML_HEADER}
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>${xmlEscape(title)}</dc:title>
  <dc:creator>ZonScale</dc:creator>
  <cp:lastModifiedBy>ZonScale</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified>
</cp:coreProperties>`;
}

function docPropsApp(slideCount: number): string {
  return `${XML_HEADER}
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>ZonScale</Application>
  <PresentationFormat>On-screen Show (16:9)</PresentationFormat>
  <Slides>${slideCount}</Slides>
  <Notes>0</Notes>
  <HiddenSlides>0</HiddenSlides>
  <MMClips>0</MMClips>
  <ScaleCrop>false</ScaleCrop>
  <Company>ZonScale</Company>
  <AppVersion>2.0</AppVersion>
</Properties>`;
}

// ===== 幻灯片形状 =====

interface Paragraph {
  text: string;
  sizePt: number;
  bold?: boolean;
  color: string;
  align?: 'l' | 'ctr';
}

function textShape(options: {
  shapeId: number;
  name: string;
  x: number;
  y: number;
  cx: number;
  cy: number;
  paragraphs: Paragraph[];
  anchor?: 't' | 'ctr' | 'b';
}): string {
  const body = options.paragraphs
    .map(
      (para) =>
        `<a:p><a:pPr algn="${para.align ?? 'l'}"/><a:r><a:rPr lang="zh-CN" altLang="en-US" sz="${Math.round(para.sizePt * 100)}" b="${para.bold ? 1 : 0}" dirty="0"><a:solidFill><a:srgbClr val="${para.color}"/></a:solidFill></a:rPr><a:t>${xmlEscape(para.text)}</a:t></a:r></a:p>`,
    )
    .join('');
  return `<p:sp><p:nvSpPr><p:cNvPr id="${options.shapeId}" name="${xmlEscape(options.name)}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${options.x}" y="${options.y}"/><a:ext cx="${options.cx}" cy="${options.cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr><p:txBody><a:bodyPr wrap="square" anchor="${options.anchor ?? 't'}"><a:normAutofit/></a:bodyPr><a:lstStyle/>${body}</p:txBody></p:sp>`;
}

function accentBar(theme: PptDraftTheme, shapeId: number): string {
  return `<p:sp><p:nvSpPr><p:cNvPr id="${shapeId}" name="AccentBar"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${inch(0.6)}" y="${inch(0.5)}"/><a:ext cx="${inch(0.9)}" cy="${inch(0.055)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="${theme.accent}"/></a:solidFill><a:ln><a:noFill/></a:ln></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="zh-CN"/></a:p></p:txBody></p:sp>`;
}

function buildCoverSlideXml(deckTitle: string, subtitle: string, theme: PptDraftTheme): string {
  const content = [
    textShape({
      shapeId: 2,
      name: 'DeckTitle',
      x: inch(0.8),
      y: inch(2.5),
      cx: SLIDE_CX - inch(1.6),
      cy: inch(1.8),
      paragraphs: [{ text: deckTitle.slice(0, PPT_DRAFT_LIMITS.maxTitleChars), sizePt: 40, bold: true, color: theme.text }],
      anchor: 'b',
    }),
    textShape({
      shapeId: 3,
      name: 'DeckSubtitle',
      x: inch(0.8),
      y: inch(4.6),
      cx: SLIDE_CX - inch(1.6),
      cy: inch(0.8),
      paragraphs: [{ text: subtitle.slice(0, PPT_DRAFT_LIMITS.maxTitleChars), sizePt: 16, color: theme.muted }],
    }),
    accentBar(theme, 4),
  ].join('');
  return buildSlideXml(content, theme);
}

function buildContentSlideXml(title: string, bullets: string[], theme: PptDraftTheme): string {
  const cleaned = bullets.slice(0, PPT_DRAFT_LIMITS.maxBulletsPerSlide);
  const paragraphs: Paragraph[] = cleaned.length
    ? cleaned.map((bullet, index) => ({
        text: `•  ${bullet.slice(0, PPT_DRAFT_LIMITS.maxBulletChars)}`,
        sizePt: 18,
        bold: false,
        align: 'l' as const,
        color: index === 0 ? theme.text : theme.muted,
      }))
    : [{ text: ' ', sizePt: 18, color: theme.muted }];

  const content = [
    textShape({
      shapeId: 2,
      name: 'SlideTitle',
      x: inch(0.6),
      y: inch(0.45),
      cx: SLIDE_CX - inch(1.2),
      cy: inch(0.9),
      paragraphs: [{ text: title.slice(0, PPT_DRAFT_LIMITS.maxTitleChars), sizePt: 28, bold: true, color: theme.text }],
    }),
    textShape({
      shapeId: 3,
      name: 'SlideBody',
      x: inch(0.9),
      y: inch(1.75),
      cx: SLIDE_CX - inch(1.8),
      cy: SLIDE_CY - inch(2.35),
      paragraphs,
    }),
    accentBar(theme, 4),
  ].join('');
  return buildSlideXml(content, theme);
}

function buildSlideXml(content: string, theme: PptDraftTheme): string {
  return `${XML_HEADER}
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:bg><p:bgPr><a:solidFill><a:srgbClr val="${theme.background}"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
      ${content}
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sld>`;
}

// ===== 构建 =====

export interface PptDraftResult {
  bytes: Uint8Array;
  fileName: string;
  slideCount: number;
  theme: string;
}

export function createPptDraftFileName(deckTitle: string): string {
  const base =
    (String(deckTitle || 'draft')
      .split(/[\\/]/)
      .pop() || 'draft')
      .replace(/[\\/:*?"<>|]/g, '_')
      .replace(/\s+/g, '_')
      .slice(0, 60)
      .replace(/^[._]+|[._]+$/g, '') || 'draft';
  return `${base}_draft.pptx`;
}

export async function buildPptDraftPptx(deck: ParsedOutlineDeck, themeId = 'minimal-mono'): Promise<PptDraftResult> {
  const theme = PPT_DRAFT_THEMES[themeId] ?? PPT_DRAFT_THEMES['minimal-mono'];
  const slides = (deck.slides || []).slice(0, PPT_DRAFT_LIMITS.maxSlides);
  if (!slides.length) throw new Error('Outline has no slides');
  const deckTitle = (deck.title || slides[0].title || 'Presentation').slice(0, PPT_DRAFT_LIMITS.maxTitleChars);

  const zip = new JSZip();
  zip.file('[Content_Types].xml', buildContentTypes(slides.length));
  zip.file('_rels/.rels', rootRels());
  zip.file('docProps/core.xml', docPropsCore(deckTitle));
  zip.file('docProps/app.xml', docPropsApp(slides.length));
  zip.file('ppt/presentation.xml', buildPresentationXml(slides.length));
  zip.file('ppt/_rels/presentation.xml.rels', buildPresentationRels(slides.length));
  zip.file('ppt/slideMasters/slideMaster1.xml', slideMasterXml(theme));
  zip.file(
    'ppt/slideMasters/_rels/slideMaster1.xml.rels',
    `${XML_HEADER}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/></Relationships>`,
  );
  zip.file('ppt/slideLayouts/slideLayout1.xml', slideLayoutXml());
  zip.file(
    'ppt/slideLayouts/_rels/slideLayout1.xml.rels',
    `${XML_HEADER}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>`,
  );
  zip.file('ppt/theme/theme1.xml', themeXml(theme));

  slides.forEach((slide, index) => {
    const xml =
      index === 0
        ? buildCoverSlideXml(deckTitle, slide.title, theme)
        : buildContentSlideXml(slide.title, slide.bullets, theme);
    zip.file(`ppt/slides/slide${index + 1}.xml`, xml);
    zip.file(
      `ppt/slides/_rels/slide${index + 1}.xml.rels`,
      `${XML_HEADER}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/></Relationships>`,
    );
  });

  const bytes = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  return { bytes, fileName: createPptDraftFileName(deckTitle), slideCount: slides.length, theme: theme.id };
}
