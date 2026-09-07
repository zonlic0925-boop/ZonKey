# -*- coding: utf-8 -*-
"""round-29 朋友圈物料生成：docs/screenshots/round29/moments/moments-01~03.png
1080×1440（3:4）Memphis 风格，品牌色与 index.css 同源，皇冠图标 alpha_composite 合成。
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
    # Memphis 装饰点/圈
    for (x, y, r, col) in [(90, 120, 26, TEAL), (990, 210, 18, CORAL), (70, 1300, 20, YELLOW), (1000, 1330, 28, SKY)]:
        d.ellipse([x - r, y - r, x + r, y + r], outline=col, width=6)
    return im, d

def panel(d, box, fill=WHITE, width=6):
    x0, y0, x1, y1 = box
    d.rectangle([x0 + 10, y0 + 10, x1 + 10, y1 + 10], fill=INK)  # memphis 硬阴影
    d.rectangle(box, fill=fill, outline=INK, width=width)

def text_cjk(d, xy, text, f, fill=INK, max_w=None):
    x, y = xy
    if max_w is None:
        d.text((x, y), text, font=f, fill=fill)
        return d.textbbox((x, y), text, font=f)[3]
    line, last_w = '', 0
    for ch in text:
        w = d.textlength(line + ch, font=f)
        if max_w and w > max_w and line:
            d.text((x, y), line, font=f, fill=fill)
            y += d.textbbox((0, 0), line, font=f)[3] + 14
            line = ch
        else:
            line += ch
    d.text((x, y), line, font=f, fill=fill)
    return y + d.textbbox((0, 0), line, font=f)[3]

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

# ---------------- moments-01 主卡 ----------------
im, d = card_base()
crown(im, (W // 2, 190), 150)
wordmark(d, W // 2, 285)
chip(d, (W // 2 - 250, 470, W // 2 + 250, 545), '更新快报 · ROUND 29', YELLOW, 36)
panel(d, (80, 600, W - 80, 1030))
text_cjk(d, (140, 660), '手机上，', font(104))
text_cjk(d, (140, 790), '直接打开了', font(104))
text_cjk(d, (140, 940), 'PDF 转 Word / Excel → 点「打开」即看', font(40, False))
chip(d, (80, 1090, 470, 1170), '弹窗内直接预览', TEAL, 36)
chip(d, (490, 1090, 880, 1170), '本机渲染零上传', SKY, 36)
chip(d, (240, 1200, 840, 1280), '要存文件，一键下载', CORAL, 38)
im.paste(qr_image('https://zonkey.pages.dev', 120), (W - 190, H - 190))
d.rectangle([W - 190, H - 190, W - 70, H - 70], outline=INK, width=4)
im.save(OUT / 'moments-01.png')

# ---------------- moments-02 更新清单卡 ----------------
im, d = card_base()
chip(d, (W // 2 - 300, 110, W // 2 + 300, 185), '这次更新了什么', CORAL, 40)
items = [
    ('第 29 轮', '手机「打开」直接预览：PDF 转 Word/Excel 弹窗内即看，不用先下载', YELLOW),
    ('第 28 轮', '二维码生成/识别 手机网页版可用，离线也能用', TEAL),
    ('第 27 轮', '证件照换底色手机可用；「打开文件」白屏修复', SKY),
    ('第 26 轮', '「任务完成」弹窗统一交付：打开 / 下载一键直达', CORAL),
]
y = 250
for tag, line, col in items:
    panel(d, (80, y, W - 80, y + 265))
    chip(d, (120, y + 40, 380, y + 110), tag, col, 34)
    text_cjk(d, (120, y + 135), line, font(36, False), max_w=W - 280)
    y += 290
im.save(OUT / 'moments-02.png')

# ---------------- moments-03 获取方式卡 ----------------
im, d = card_base()
crown(im, (W // 2, 200), 140)
wordmark(d, W // 2, 300)
panel(d, (80, 500, W - 80, 780))
d.text((140, 540), '网页版 · 扫码即用', font=font(56), fill=INK)
text_cjk(d, (140, 630), '手机浏览器打开 zonkey.pages.dev', font(40, False))
text_cjk(d, (140, 690), '不用安装，本次更新已上线', font(40, False))
im.paste(qr_image('https://zonkey.pages.dev', 300), (W // 2 - 150, 840))
d.rectangle([W // 2 - 150, 840, W // 2 + 150, 1140], outline=INK, width=6)
panel(d, (80, 1190, W - 80, 1370))
d.text((140, 1230), '桌面版 · 完整能力', font=font(52), fill=INK)
text_cjk(d, (140, 1310), 'GitHub / Gitee 搜「ZonKey」· 免费开源', font(38, False))
im.save(OUT / 'moments-03.png')

print('moments r29 ->', OUT)
for p in sorted(OUT.glob('*.png')):
    print(' ', p.name, Image.open(p).size)
