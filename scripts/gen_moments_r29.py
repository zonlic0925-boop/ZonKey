# -*- coding: utf-8 -*-
"""round-29 朋友圈物料生成：docs/screenshots/round29/moments/moments-01~03.png
1080×1440（3:4）Memphis 风格，品牌色与 index.css 同源，皇冠图标 alpha_composite 合成。

文案口径（2026-09-07 用户反馈重做）：
- 写清楚「本次更新了什么」——本次=r29 两条核心变化：
  ① 转换结果点「打开」弹窗内直接预览（docx/xlsx 本机渲染、零上传、不跳转不白屏）
  ② 转换完成不再自动下载，要存档再点「下载」
- 不再把 r26-r28 旧功能混排成「这次更新」（QR/证件照等仅文案脚注提及，卡片不占主位）。
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
import qrcode

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'docs' / 'screenshots' / 'round29' / 'moments'
OUT.mkdir(parents=True, exist_ok=True)

W, H = 1080, 1440
CREAM = (255, 249, 240)
INK = (26, 26, 46)
CORAL = (255, 107, 107)
TEAL = (78, 205, 196)
YELLOW = (255, 230, 109)
SKY = (69, 183, 209)
WHITE = (255, 255, 255)

F_BOLD = 'C:/Windows/Fonts/msyhbd.ttc'
F_REG = 'C:/Windows/Fonts/msyh.ttc'


def font(size, bold=True):
    return ImageFont.truetype(F_BOLD if bold else F_REG, size)


def card_base():
    im = Image.new('RGB', (W, H), CREAM)
    d = ImageDraw.Draw(im)
    for (x, y, r, col) in [(90, 120, 26, TEAL), (990, 210, 18, CORAL), (70, 1300, 20, YELLOW), (1000, 1330, 28, SKY)]:
        d.ellipse([x - r, y - r, x + r, y + r], outline=col, width=6)
    return im, d


def panel(d, box, fill=WHITE, width=6, border=INK):
    x0, y0, x1, y1 = box
    d.rectangle([x0 + 10, y0 + 10, x1 + 10, y1 + 10], fill=INK)  # memphis 硬阴影
    d.rectangle(box, fill=fill, outline=border, width=width)


def _wrap(d, text, f, max_w):
    """把 text 按 max_w 折行，返回行列表（字符级折行，适配 CJK）。"""
    lines, line = [], ''
    for ch in text:
        if line and d.textlength(line + ch, font=f) > max_w:
            lines.append(line)
            line = ch
        else:
            line += ch
    if line:
        lines.append(line)
    return lines


def text_block(d, xy, lines, f, fill=INK, gap=13):
    """逐行绘制；返回最后一行底 y。"""
    x, y = xy
    lh = d.textbbox((0, 0), '中', font=f)[3]
    for i, ln in enumerate(lines):
        d.text((x, y), ln, font=f, fill=fill)
        if i < len(lines) - 1:
            y += lh + gap
    return y + lh


def chip(d, box, label, fill, fsize=34):
    panel(d, box, fill=fill, width=5)
    x0, y0, x1, y1 = box
    tw = d.textlength(label, font=font(fsize))
    d.text(((x0 + x1 - tw) / 2, (y0 + y1) / 2 - fsize * 0.72), label, font=font(fsize), fill=INK)


def qr_image(url, box_px):
    q = qrcode.QRCode(border=2, box_size=10)
    q.add_data(url)
    q.make(fit=True)
    im = q.make_image(fill_color='black', back_color='white').convert('RGB')
    return im.resize((box_px, box_px), Image.NEAREST)


def crown(im, center, size=150):
    icon = Image.open(ROOT / 'assets' / 'zonkey.png').convert('RGBA').resize((size, size), Image.LANCZOS)
    im.paste(icon, (center[0] - size // 2, center[1] - size // 2), icon)


def wordmark(d, cx, y, size=92):
    f = font(size)
    label = 'ZONKEY'
    tw = d.textlength(label, font=f)
    d.text((cx - tw / 2, y), label, font=f, fill=INK)
    tw2 = d.textlength('本地离线日用百宝箱', font=font(34, False))
    d.text((cx - tw2 / 2, y + size + 8), '本地离线日用百宝箱', font=font(34, False), fill=INK)


def qr_box(im, d, box, url):
    """小二维码 + 描边。box=(x0,y0,x1,y1)"""
    x0, y0, x1, y1 = box
    q = qr_image(url, x1 - x0)
    im.paste(q, (x0, y0))
    d.rectangle(box, outline=INK, width=4)


def delta_row(d, y0, symbol, text, col):
    """以前/现在 对比条；symbol 用强调色，正文用墨色。返回条底 y（含间距）。"""
    box = (80, y0, 1000, y0 + 94)
    panel(d, box, fill=WHITE, width=5, border=col)
    prefix = symbol + '  '
    f = font(34)
    px = d.textlength(prefix, font=f)
    d.text((110, y0 + 30), prefix, font=f, fill=col)
    d.text((110 + px, y0 + 30), text, font=f, fill=INK)
    return y0 + 116


# ---------------- moments-01 主卡：一句话讲清本次更新 ----------------
im, d = card_base()
crown(im, (W // 2, 190), 150)
wordmark(d, W // 2, 285)
chip(d, (W // 2 - 240, 470, W // 2 + 240, 545), '更新公告 · 2026 年 9 月', YELLOW, 36)

f_title = font(88)
f_sub = font(34, False)
sub = 'PDF 转 Word / Excel 的成果，在弹窗里直接预览——图文、表格都能看，文件不出本机。'
sub_lines = _wrap(d, sub, f_sub, 830)
panel(d, (80, 600, 1000, 1032))
y = text_block(d, (140, 650), ['转换完的文件，', '点「打开」当场看'], f_title)
y = text_block(d, (140, y + 44), sub_lines, f_sub)  # 说明 ≤2 行，结束 ≤1032

# 以前 / 现在：用户最关心的「改了什么」一目了然
ry = delta_row(d, y + 40, '×', '以前：转完自动下载，手机上「打开」还常白屏、跳转', CORAL)
ry = delta_row(d, ry, '√', '现在：点「打开」弹窗内即看，要存档再点「下载」', TEAL)

# 底部 chips（左）+ 小 QR（右下）
chip(d, (80, ry + 8, 500, ry + 83), '本机渲染 · 文件零上传', TEAL, 30)
chip(d, (520, ry + 8, 870, ry + 83), '手机网页版同样可用', SKY, 30)
qr_box(im, d, (890, ry - 2, 1010, ry + 118), 'https://zonkey.pages.dev')
im.save(OUT / 'moments-01.png')

# ---------------- moments-02 更新清单卡：本次更新 3 件事 ----------------
im, d = card_base()
chip(d, (W // 2 - 260, 110, W // 2 + 260, 185), '本次更新了什么', CORAL, 40)

items = [
    ('弹窗内直接预览', YELLOW,
     'PDF 转 Word / Excel 后点「打开」：内容在弹窗里原样渲染，图文表格直接看，不跳转、不白屏。'),
    ('不再自动下载', TEAL,
     '转换完成不再自动落文件、不再打断你；需要存档时点「下载」，按需保存一份。'),
    ('本机完成 · 零上传', SKY,
     '预览与转换都在你的设备上运行，文件不出本机、断网也能用；手机上同样适用。'),
]
y = 240
for tag, col, desc in items:
    panel(d, (80, y, 1000, y + 300))
    chip(d, (110, y + 34, 430, y + 102), tag, col, 33)
    d_lines = _wrap(d, desc, font(35, False), 800)
    text_block(d, (110, y + 126), d_lines, font(35, False))
    y += 320

# 底部说明条 + 日期锚点
note = '网页版本次更新已全部上线；桌面版同步更新——桌面端点「打开」仍走系统默认程序。'
n_lines = _wrap(d, note, font(30, False), 820)
panel(d, (80, y + 8, 1000, y + 8 + 52 + len(n_lines) * 44))
text_block(d, (120, y + 24), n_lines, font(30, False))
note_b = y + 8 + 52 + len(n_lines) * 44
tw = d.textlength('2026 年 9 月 · zonkey.pages.dev', font=font(30))
d.text(((W - tw) / 2, note_b + 22), '2026 年 9 月 · zonkey.pages.dev', font=font(30), fill=INK)
im.save(OUT / 'moments-02.png')

# ---------------- moments-03 获取方式卡 ----------------
im, d = card_base()
crown(im, (W // 2, 200), 140)
wordmark(d, W // 2, 300, size=84)

panel(d, (80, 500, 1000, 790))
d.text((130, 540), '网页版 · 扫码即用', font=font(56), fill=INK)
l1 = _wrap(d, '本次更新已上线：转换完的文件点「打开」就能看', font(34, False), 830)
l2 = _wrap(d, '手机上免安装直接用 · 文件只在你的设备上处理', font(34, False), 830)
text_block(d, (130, 626), l1, font(34, False))
text_block(d, (130, 700), l2, font(34, False))
im.paste(qr_image('https://zonkey.pages.dev', 300), (W // 2 - 150, 840))
d.rectangle([W // 2 - 150, 840, W // 2 + 150, 1140], outline=INK, width=6)

panel(d, (80, 1190, 1000, 1400))
d.text((130, 1226), '桌面版 · 完整能力', font=font(50), fill=INK)
text_block(d, (130, 1294), ['GitHub / Gitee 搜「ZonKey」'], font(34, False))
text_block(d, (130, 1350), ['Release 里有安装包和便携版'], font(34, False))
im.save(OUT / 'moments-03.png')

print('moments r29 ->', OUT)
for p in sorted(OUT.glob('*.png')):
    print(' ', p.name, Image.open(p).size)
