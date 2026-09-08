# -*- coding: utf-8 -*-
"""小红书物料 · 真实用户使用体验轮（round-32，2026-09-08）——真实操作截屏组版。

背景：r31 零导流 4 卡（认识/更新总览）就绪后，本轮补「真实用户使用体验」向
图文：封面 + 6 帧真实操作截屏（本机真跑：拖入图纸 → 自动圈 5 处敏感词 →
全选 → 执行脱敏 → 抹前/抹后对比 → 导出产物 → 规则词表）。素材全部来自
docs/screenshots/round32/raw/（Playwright 实拍当前版 UI + 真实产物 PDF 高
清渲染裁剪），非设计示意图。

红线（同 r31 一体适用）：图卡零站外导流信息——无网址/域名/二维码/GitHub/
Gitee/微信/QQ/邮箱/手机号/「评论区自取」句式；品牌词 ZonKey 与工具名不受限。
生成时内置 BANNED 校验，命中即拒绝出图。

输出：docs/screenshots/round32/xhs/r32-01~07.png  1242×1656 (3:4)
运行：python scripts/gen_xhs_r32.py
"""
import re
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / 'docs' / 'screenshots' / 'round32' / 'raw'
OUT = ROOT / 'docs' / 'screenshots' / 'round32' / 'xhs'
OUT.mkdir(parents=True, exist_ok=True)

W, H = 1242, 1656
PAD = 40            # 截图左右留白
SHOT_W = W - PAD * 2
INK = (26, 26, 46, 255)
GRAY = (108, 112, 128, 255)
WHITE = (255, 255, 255, 255)
CORAL = (255, 107, 107, 255)
DOT_OFF = (222, 226, 234, 255)

F_BOLD = 'C:/Windows/Fonts/msyhbd.ttc'
F_REG = 'C:/Windows/Fonts/msyh.ttc'

BANNED = [
    'zonkey.pages', '.pages.dev', '.dev', 'http', 'www.', 'github', 'gitee',
    'release', '扫码', '扫一扫', '私信', '微信', 'qq', '邮箱', '手机号',
    '加v', '进群', '扣1', '评论区自取', '主页自取', '直达', '点链接',
    '二维码', 'domain', '网址',
]
BANNED_RE = re.compile('|'.join(re.escape(b) for b in BANNED), re.IGNORECASE)


def lfont(sz, bold=True):
    return ImageFont.truetype(F_BOLD if bold else F_REG, sz)


def check_clean(*texts):
    bad = [t for t in texts if BANNED_RE.search(t)]
    if bad:
        raise SystemExit('BANNED TOKEN FOUND:\n' + '\n'.join(f'  - {b}' for b in bad))


def rrect(base, box, radius, fill):
    d = ImageDraw.Draw(base)
    d.rounded_rectangle(box, radius=radius, fill=fill)


def paste_shot(base, img_path, top, bottom_limit, box_w=SHOT_W):
    """按宽度适配贴入圆角截图；返回底边 y。"""
    im = Image.open(img_path).convert('RGB')
    scale = min(box_w / im.width, 1.0)
    nw = int(im.width * scale)
    nh = int(im.height * scale)
    if bottom_limit and top + nh > bottom_limit:
        scale = (bottom_limit - top) / im.height
        nw = int(im.width * scale)
        nh = int(im.height * scale)
    im = im.resize((nw, nh), Image.LANCZOS)
    x0 = (W - nw) // 2
    mask = Image.new('L', (nw, nh), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, nw - 1, nh - 1], radius=22, fill=255)
    base.paste(im, (x0, top), mask)
    return top + nh


def chip(base, y, text, x_center, fsize=26):
    """圆角小胶囊标签（素人感关键词），返回底边 y。"""
    f = lfont(fsize, True)
    tb = base  # measure
    d0 = ImageDraw.Draw(Image.new('RGB', (4, 4)))
    tw = d0.textlength(text, font=f)
    pad_x, pad_y = 22, 12
    cw = int(tw) + pad_x * 2
    ch = fsize + pad_y * 2
    x0 = int(x_center - cw / 2)
    rrect(base, [x0, y, x0 + cw, y + ch], ch // 2, CORAL)
    d = ImageDraw.Draw(base)
    d.text((x0 + pad_x, y + pad_y), text, font=f, fill=WHITE)
    return y + ch


def text_block(base, y, lines, fsize, lh, fill, bold=True, x=70):
    d = ImageDraw.Draw(base)
    f = lfont(fsize, bold)
    for ln in lines:
        d.text((x, y), ln, font=f, fill=fill)
        y += lh
    return y


def page_dots(base, total, cur):
    y = 1548
    cx = W // 2
    total_w = (total - 1) * 30 + 16
    x = cx - total_w // 2
    d = ImageDraw.Draw(base)
    for i in range(total):
        r = 8 if i == cur else 6
        col = CORAL if i == cur else DOT_OFF
        d.ellipse([x - r, y - r, x + r, y + r], fill=col)
        x += 30
    # 右下「左滑」
    f = lfont(22, False)
    hint = '左滑看完整流程'
    tw = d.textlength(hint, font=f)
    d.text((W - 70 - tw, y - 14), hint, font=f, fill=GRAY)


def frame_ui(idx, kicker, title, sub, shot_name, dots):
    """常规帧：白底 + 顶部文字 + 真实截图。"""
    check_clean(kicker, *title, *sub)
    base = Image.new('RGB', (W, H), WHITE)
    y = text_block(base, 148, [kicker], 27, 40, CORAL, bold=False)
    y = text_block(base, y + 18, title, 52, 72, INK)
    y = text_block(base, y + 14, sub, 27, 42, GRAY, bold=False)
    y += 40
    paste_shot(base, RAW / shot_name, y, 1500)
    page_dots(base, 7, dots)
    base.save(OUT / f'r32-{idx:02d}.png')
    print('wrote r32-%02d.png (%s)' % (idx, shot_name))


def frame_compare(idx, title, sub, before, after, dots):
    """对比帧：同一区域 抹前/抹后 上下叠放，标签小胶囊。"""
    check_clean(*title, *sub)
    base = Image.new('RGB', (W, H), WHITE)
    text_block(base, 148, ['真实流程 · ④'], 27, 40, CORAL, bold=False)
    y = text_block(base, 200, title, 52, 72, INK)
    y = text_block(base, y + 14, sub, 27, 42, GRAY, bold=False)
    y += 40
    # 两段作物上下叠放，各自左上角叠“脱敏前/脱敏后”小胶囊
    for img, label in ((before, '抹除前'), (after, '抹除后')):
        im = Image.open(RAW / img).convert('RGB')
        scale = SHOT_W / im.width
        nw, nh = int(im.width * scale), int(im.height * scale)
        im = im.resize((nw, nh), Image.LANCZOS)
        x0 = (W - nw) // 2
        mask = Image.new('L', (nw, nh), 0)
        ImageDraw.Draw(mask).rounded_rectangle([0, 0, nw - 1, nh - 1], radius=22, fill=255)
        base.paste(im, (x0, y), mask)
        # 胶囊锚定每半张右上角空白区（NOTES 区左上为文字行，右侧留白）
        f = lfont(24, True)
        d0 = ImageDraw.Draw(Image.new('RGB', (4, 4)))
        tw = int(d0.textlength(label, font=f))
        cw = tw + 44
        chh = 48
        cx1 = x0 + nw - 24
        rrect(base, [cx1 - cw, y + 24, cx1, y + 24 + chh], chh // 2, CORAL)
        d = ImageDraw.Draw(base)
        d.text((cx1 - cw + 22, y + 24 + 12), label, font=f, fill=WHITE)
        y += nh + 24
    page_dots(base, 7, dots)
    base.save(OUT / f'r32-{idx:02d}.png')
    print('wrote r32-%02d.png (compare)' % idx)


def frame_cover():
    base = Image.new('RGB', (W, H), WHITE)
    text_block(base, 170, ['把图纸发出去之前', '先把它抹干净'], 72, 100, INK)
    y = text_block(base, 386, ['本地免费工具 ZonKey · 真实操作实拍', '发给客户 / 供应商的每一版，都先过一遍'], 28, 44, GRAY, bold=False)
    # 关键词胶囊
    cx = W // 2
    for t in ['PDF 图纸', '合同 / 公文', 'Word 文档']:
        check_clean(t)
    y += 26
    chips = ['PDF 图纸', '合同 / 公文', 'Word 文档']
    total_w = sum(60 + 26 * len(t) + 26 for t in chips)
    x = cx - total_w // 2 + 13
    for t in chips:
        f = lfont(25, True)
        d0 = ImageDraw.Draw(Image.new('RGB', (4, 4)))
        tw = int(d0.textlength(t, font=f))
        cw = tw + 44
        chh = 25 + 22
        rrect(base, [x, y, x + cw, y + chh], chh // 2, CORAL)
        d = ImageDraw.Draw(base)
        d.text((x + 22, y + 11), t, font=f, fill=WHITE)
        x += cw + 26
    # 底部主视觉：脱敏后整页 UI 截图
    paste_shot(base, RAW / '04_ui_after_view.png', 700, 1560)
    f = lfont(24, False)
    d = ImageDraw.Draw(base)
    hint = '左滑 · 看完整流程'
    tw = d.textlength(hint, font=f)
    d.text(((W - tw) / 2, 1580), hint, font=f, fill=GRAY)
    base.save(OUT / 'r32-01.png')
    print('wrote r32-01.png (cover)')


if __name__ == '__main__':
    # 封面 + 6 帧（顺序即笔记图序）
    frame_cover()
    frame_ui(2, '真实流程 · ①', ['打开 ZonKey 首页，', '进「智能脱敏」'],
             ['文件本地处理、不上传', '免费，断网也能用'], '01_home.png', 1)
    frame_ui(3, '真实流程 · ②', ['图纸 PDF 拖进去', '自动开扫'],
             ['标题栏、敏感标注自动识别', '不用自己一个个找'], '02_center_upload.png', 2)
    frame_ui(4, '真实流程 · ③', ['5 处敏感词，自动圈好'],
             ['命中词、页码、来源都在侧栏', '先点「全选」把 5 处全部纳入'], '03_hits_all_selected.png', 3)
    frame_compare(5, ['抹除前 vs 抹除后'],
                  ['同一块区域：敏感说明三行被清掉', '相邻技术要求原文保留'], 'before_notes.png', 'after_notes.png', 4)
    frame_ui(6, '真实流程 · ⑤', ['导出 PDF', '原文件不会被动'],
             ['输出的是 _desensitized 副本', '整页核对留白位置无误再导出'], '04_ui_after_view.png', 5)
    frame_ui(7, '加分项', ['敏感词表自己说了算'],
             ['公司名 / 人名 / 项目代号', '加进规则以后自动圈'], '05_rules_center.png', 6)
