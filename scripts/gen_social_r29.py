# -*- coding: utf-8 -*-
"""v2.2.0（2026-09-07）三平台社交物料：朋友圈 + 小红书 + 抖音。

内容口径（2026-09-07 用户反馈定稿）：只讲「今天这次更新」= App 内「这次更新
了什么」弹窗 r29 三条（打开直接预览 / 本机渲染零上传 / 要存档再点下载），
r26–r28 旧轮功能一律不混入清单（曾因混轮被打回）。

输出：
- docs/screenshots/round29/moments/moments-01~03.png  1080×1440 (3:4)   朋友圈
- docs/screenshots/round29/xhs/xhs-01~04.png          1242×1656 (3:4)   小红书
- docs/screenshots/round29/douyin/douyin-01~03.png    1080×1920 (9:16)  抖音图文

设计（区别于旧 Memphis 硬阴影版）：柔和渐变底 + 大圆角白卡软阴影 + 马克笔高亮
+ 手机弹窗示意图（转换完成 → 打开/下载），品牌色与 index.css 同源。
改文案后重跑：python scripts/gen_social_r29.py
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont
import qrcode

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'docs' / 'screenshots' / 'round29'
DOMAIN = 'zonkey.pages.dev'

INK = (26, 26, 46, 255)
GRAY = (110, 114, 130, 255)
WHITE = (255, 255, 255, 255)
CORAL = (255, 107, 107, 255)
TEAL = (78, 205, 196, 255)
YELLOW = (255, 230, 109, 255)
SKY = (69, 183, 209, 255)
LAV = (167, 139, 250, 255)
ORANGE = (255, 169, 77, 255)
CREAM = (255, 249, 240)
PEACH = (255, 234, 222)

F_BOLD = 'C:/Windows/Fonts/msyhbd.ttc'
F_REG = 'C:/Windows/Fonts/msyh.ttc'


def lfont(sz, bold=True):
    return ImageFont.truetype(F_BOLD if bold else F_REG, sz)


# ---------------- 基础绘制 ----------------

def gradient(w, h, top=CREAM, bot=PEACH):
    base = Image.new('RGB', (1, h))
    for i in range(h):
        t = i / (h - 1)
        base.putpixel((0, i), tuple(int(a + (b - a) * t) for a, b in zip(top, bot)))
    return base.resize((w, h)).convert('RGBA')


def blobs(im, spots):
    """柔和色斑背景：spots = [(cx, cy, r, color, alpha)]"""
    layer = Image.new('RGBA', im.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for cx, cy, r, col, a in spots:
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=col[:3] + (a,))
    layer = layer.filter(ImageFilter.GaussianBlur(90))
    im.alpha_composite(layer)


def card(im, box, r=32, fill=WHITE, shadow=True, outline=None, width=0):
    x0, y0, x1, y1 = box
    if shadow:
        sh = Image.new('RGBA', im.size, (0, 0, 0, 0))
        sd = ImageDraw.Draw(sh)
        sd.rounded_rectangle([x0, y0 + 12, x1, y1 + 12], r, fill=(26, 26, 46, 55))
        im.alpha_composite(sh.filter(ImageFilter.GaussianBlur(14)))
    d = ImageDraw.Draw(im, 'RGBA')
    d.rounded_rectangle(box, r, fill=fill, outline=outline, width=width)


def wrap(d, text, f, max_w):
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


def lines_h(d, lines, f, gap):
    lh = d.textbbox((0, 0), '中', font=f)[3]
    return len(lines) * lh + (len(lines) - 1) * gap


def draw_lines(d, xy, lines, f, fill=INK, gap=12):
    x, y = xy
    lh = d.textbbox((0, 0), '中', font=f)[3]
    for ln in lines:
        d.text((x, y), ln, font=f, fill=fill)
        y += lh + gap
    return y - gap - lh + lh if lines else y


def pill(d, x, y, label, fill, fsize, h=None, tc=INK, padx=None):
    """以 (x,y) 为左上角画圆角胶囊标签，返回宽度。"""
    f = lfont(fsize)
    h = h or fsize + 30
    padx = padx if padx is not None else fsize * 0.9
    w = d.textlength(label, font=f) + padx * 2
    d.rounded_rectangle([x, y, x + w, y + h], h / 2, fill=fill)
    d.text((x + w / 2, y + h / 2), label, font=f, fill=tc, anchor='mm')
    return w


def pill_w(d, label, fsize, padx=None):
    f = lfont(fsize)
    padx = padx if padx is not None else fsize * 0.9
    return d.textlength(label, font=f) + padx * 2


def rich_line(im, x, y, segments, f, hl=YELLOW):
    """segments = [(text, 是否高亮)]，高亮词后面马克笔底色。返回结束 x。"""
    d = ImageDraw.Draw(im, 'RGBA')
    for text, hl_on in segments:
        w = d.textlength(text, font=f)
        if hl_on:
            m = Image.new('RGBA', im.size, (0, 0, 0, 0))
            md = ImageDraw.Draw(m)
            asc, desc = f.getmetrics()
            md.rounded_rectangle([x - 6, y - 8, x + w + 6, y + asc + desc * 0.1 + 6],
                                 14, fill=hl[:3] + (170,))
            im.alpha_composite(m)
            d = ImageDraw.Draw(im, 'RGBA')
        d.text((x, y), text, font=f, fill=INK)
        x += w
    return x


def qr_image(url, box_px):
    q = qrcode.QRCode(border=2, box_size=10)
    q.add_data(url)
    q.make(fit=True)
    im = q.make_image(fill_color='black', back_color='white').convert('RGB')
    return im.resize((box_px, box_px), Image.NEAREST)


def qr_box(im, d, box, url='https://' + DOMAIN):
    x0, y0, x1, y1 = box
    q = qr_image(url, x1 - x0)
    im.paste(q, (x0, y0))
    d.rounded_rectangle(box, 8, outline=INK, width=3)


def crown(im, center, size):
    icon = Image.open(ROOT / 'assets' / 'zonkey.png').convert('RGBA').resize((size, size), Image.LANCZOS)
    im.alpha_composite(icon, (center[0] - size // 2, center[1] - size // 2))


def brand_row(im, x, y, s=1.0, chip_label=None, chip_fill=YELLOW):
    """左上角品牌行：皇冠 + ZONKEY + 副标；chip_label 画在右边距。"""
    W = im.width
    cs = int(84 * s)
    crown(im, (x + cs // 2, y + cs // 2), cs)
    d = ImageDraw.Draw(im, 'RGBA')
    tx = x + cs + int(18 * s)
    d.text((tx, y + cs * 0.16), 'ZONKEY', font=lfont(int(38 * s)), fill=INK)
    d.text((tx + 2, y + cs * 0.62), '本地离线日用百宝箱', font=lfont(int(24 * s), False), fill=GRAY)
    if chip_label:
        cw = pill_w(d, chip_label, int(28 * s))
        pill(d, W - 80 - cw, y + cs * 0.18, chip_label, chip_fill, int(28 * s))


def phone(im, x, y, w, h):
    """手机弹窗示意：转换完成 → 文件 → 预览 → [打开][下载]。"""
    d = ImageDraw.Draw(im, 'RGBA')
    sh = Image.new('RGBA', im.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(sh)
    sd.rounded_rectangle([x, y + 16, x + w, y + h], int(w * 0.14), fill=(26, 26, 46, 70))
    im.alpha_composite(sh.filter(ImageFilter.GaussianBlur(16)))
    d = ImageDraw.Draw(im, 'RGBA')
    d.rounded_rectangle([x, y, x + w, y + h], int(w * 0.14), fill=(31, 31, 54, 255))
    si = w * 0.035
    sx, sy, sx1, sy1 = x + si, y + si, x + w - si, y + h - si
    d.rounded_rectangle([sx, sy, sx1, sy1], int(w * 0.10), fill=WHITE)
    u = w / 390
    p = u * 18
    d.rounded_rectangle([sx + w / 2 - u * 42, sy + u * 10, sx + w / 2 + u * 42, sy + u * 20],
                        u * 5, fill=(232, 234, 240, 255))
    px0, py0, px1, py1 = sx + p, sy + u * 40, sx1 - p, sy1 - p * 0.35
    d.rounded_rectangle([px0, py0, px1, py1], u * 16, fill=(245, 246, 250, 255))
    # 弹窗头
    hr = py0 + u * 20
    d.ellipse([px0 + u * 18, hr, px0 + u * 48, hr + u * 30], fill=TEAL)
    d.text((px0 + u * 33, hr + u * 15), '√', font=lfont(int(u * 20)), fill=WHITE, anchor='mm')
    d.text((px0 + u * 60, hr + u * 15), '转换完成', font=lfont(int(u * 24)), fill=INK, anchor='lm')
    # 文件名胶囊
    fp_y = hr + u * 46
    d.rounded_rectangle([px0 + u * 18, fp_y, px1 - u * 18, fp_y + u * 36], u * 10, fill=(228, 231, 238, 255))
    d.text(((px0 + px1) / 2, fp_y + u * 18), '合同_desensitized.docx',
           font=lfont(int(u * 16), False), fill=(90, 94, 110), anchor='mm')
    # 预览区
    pv_y = fp_y + u * 52
    pv_bot = py1 - u * 108
    d.rounded_rectangle([px0 + u * 18, pv_y, px1 - u * 18, pv_bot], u * 12, fill=WHITE)
    d.text((px0 + u * 34, pv_y + u * 26), '项目报告', font=lfont(int(u * 19)), fill=INK, anchor='lm')
    for i, lw in enumerate([0.72, 0.86, 0.6]):
        ly = pv_y + u * 56 + i * u * 26
        d.rounded_rectangle([px0 + u * 34, ly, px0 + u * 34 + (px1 - px0 - u * 68) * lw, ly + u * 10],
                            u * 5, fill=(226, 229, 236, 255))
    ty = pv_bot - u * 122
    tw = (px1 - px0 - u * 68) / 3
    for r in range(3):
        for c in range(3):
            cell = [px0 + u * 34 + c * tw, ty + r * u * 30,
                    px0 + u * 34 + (c + 1) * tw, ty + (r + 1) * u * 30]
            fill = (78, 205, 196, 60) if r == 0 else (248, 249, 252, 255)
            d.rectangle(cell, fill=fill, outline=(228, 231, 238, 255), width=1)
    # 按钮
    by = py1 - u * 90
    bw = (px1 - px0 - u * 18 * 2 - u * 14) / 2
    d.rounded_rectangle([px0 + u * 18, by, px0 + u * 18 + bw, by + u * 54], u * 27, fill=TEAL)
    d.text((px0 + u * 18 + bw / 2, by + u * 27), '打开', font=lfont(int(u * 22)), fill=WHITE, anchor='mm')
    bx = px0 + u * 18 + bw + u * 14
    d.rounded_rectangle([bx, by, bx + bw, by + u * 54], u * 27, fill=WHITE, outline=INK, width=2)
    d.text((bx + bw / 2, by + u * 27), '下载', font=lfont(int(u * 22)), fill=INK, anchor='mm')
    d.rounded_rectangle([sx + w / 2 - u * 50, sy1 - u * 14, sx + w / 2 + u * 50, sy1 - u * 8],
                        u * 3, fill=(210, 213, 222, 255))


def deco(im):
    blobs(im, [(im.width + 40, 60, 190, TEAL, 55), (-30, im.height * 0.42, 170, CORAL, 45),
               (im.width + 20, im.height - 120, 210, YELLOW, 50)])


# ---------------- 更新内容（真源：whatsnew r29 三条，2026-09-07） ----------------
# r29 = 今天 v2.2.0 的更新；任务完成弹窗(r26)、证件照/二维码(r27/r28)等旧轮
# 功能已随更早版本上线，不写进「本次更新」清单（2026-09-07 用户反馈定稿）。

UPDATES = [
    ('点「打开」直接预览', TEAL,
     'PDF 转 Word / Excel 完成后点「打开」，图文表格在弹窗里直接看，不用先下载。'),
    ('本机渲染 · 零上传', SKY,
     '预览在你自己手机上完成，文件不离开设备；断网也能用。'),
    ('要存档，再点「下载」', CORAL,
     '转换完不再自动落文件、不打断你；需要保存时一键下载一份。'),
]

FOOTNOTE = '桌面版同步 v2.2.0 · 更新说明弹窗已补齐最近四轮'


def updates_list(im, x, y, w, item_h, title_fs, desc_fs, gap):
    d = ImageDraw.Draw(im, 'RGBA')
    for i, (tag, col, desc) in enumerate(UPDATES):
        box = (x, y, x + w, y + item_h)
        card(im, box, r=28)
        d = ImageDraw.Draw(im, 'RGBA')
        cd = item_h * 0.36
        cy = y + item_h / 2
        d.ellipse([x + item_h * 0.14, cy - cd / 2, x + item_h * 0.14 + cd, cy + cd / 2], fill=col)
        d.text((x + item_h * 0.14 + cd / 2, cy), str(i + 1), font=lfont(int(cd * 0.5)),
               fill=INK, anchor='mm')
        tx = x + item_h * 0.14 + cd + item_h * 0.12
        tb = d.textbbox((0, 0), tag, font=lfont(title_fs))
        d.text((tx, y + item_h * 0.16), tag, font=lfont(title_fs), fill=INK)
        dl = wrap(d, desc, lfont(desc_fs, False), x + w - tx - item_h * 0.12)
        draw_lines(d, (tx, y + item_h * 0.16 + tb[3] + 8), dl, lfont(desc_fs, False), GRAY, gap=8)
        y += item_h + gap
    return y


# ---------------- 朋友圈（1080×1440，重做版） ----------------

def moments():
    W, H = 1080, 1440
    out = OUT / 'moments'
    out.mkdir(parents=True, exist_ok=True)

    # 01 主卡
    im = gradient(W, H)
    deco(im)
    brand_row(im, 80, 64, 1.0, 'v2.2.0 · 2026-09-07')
    d = ImageDraw.Draw(im, 'RGBA')
    pill(d, 80, 208, '手机网页版 · 本次更新', (255, 107, 107, 38), 30)
    rich_line(im, 80, 300, [('转换完的文件', False)], lfont(84))
    rich_line(im, 80, 404, [('点', False), ('「打开」', True), ('当场看', False)], lfont(84))
    d = ImageDraw.Draw(im, 'RGBA')
    sub = 'PDF 转 Word / Excel 完成后，点「打开」在弹窗里直接预览——图文表格当场看，不用先下载一份文件。'
    draw_lines(d, (80, 552), wrap(d, sub, lfont(32, False), 900), lfont(32, False), GRAY, gap=10)

    # 左：以前 / 现在
    card(im, (80, 700, 590, 878), r=26, outline=(255, 107, 107, 130), width=3)
    d = ImageDraw.Draw(im, 'RGBA')
    d.text((120, 730), '× 以前', font=lfont(34), fill=CORAL)
    draw_lines(d, (120, 786), wrap(d, '转完自动就开始下载，手机上「打开」还常白屏、跳转', lfont(28, False), 420),
               lfont(28, False), GRAY, gap=8)
    card(im, (80, 902, 590, 1080), r=26, outline=(78, 205, 196, 150), width=3)
    d = ImageDraw.Draw(im, 'RGBA')
    d.text((120, 932), '√ 现在', font=lfont(34), fill=(30, 150, 142))
    draw_lines(d, (120, 988), wrap(d, '点「打开」弹窗内直接看，要存档再点「下载」', lfont(28, False), 420),
               lfont(28, False), GRAY, gap=8)
    d.text((82, 1100), '桌面版打开方式不变 · 界面为功能示意', font=lfont(24, False), fill=GRAY)

    # 右：手机示意
    phone(im, 646, 660, 364, 580)

    # 底条
    card(im, (80, 1290, 1000, 1392), r=24)
    d = ImageDraw.Draw(im, 'RGBA')
    qr_box(im, d, (96, 1302, 188, 1394 - 12))
    d = ImageDraw.Draw(im, 'RGBA')
    pill(d, 212, 1312, '本机渲染 · 零上传', (78, 205, 196, 60), 26)
    d = ImageDraw.Draw(im, 'RGBA')
    pill(d, 500, 1312, '断网可用', (69, 183, 209, 45), 26)
    d = ImageDraw.Draw(im, 'RGBA')
    d.text((988, 1341), DOMAIN, font=lfont(28), fill=INK, anchor='rm')
    im.convert('RGB').save(out / 'moments-01.png')

    # 02 清单卡
    im = gradient(W, H)
    deco(im)
    d = ImageDraw.Draw(im, 'RGBA')
    l1 = '本次更新 · v2.2.0'
    w1 = pill_w(d, l1, 30)
    l2 = '2026-09-07'
    w2 = pill_w(d, l2, 30)
    cx = W / 2
    pill(d, cx - (w1 + w2 + 20) / 2, 96, l1, (255, 107, 107, 38), 30)
    d = ImageDraw.Draw(im, 'RGBA')
    pill(d, cx - (w1 + w2 + 20) / 2 + w1 + 20, 96, l2, (255, 230, 109, 90), 30)
    d = ImageDraw.Draw(im, 'RGBA')
    d.text((cx, 226), '这次更新了什么', font=lfont(78), fill=INK, anchor='ma')
    y = updates_list(im, 80, 386, 920, 250, 42, 29, 30)
    d = ImageDraw.Draw(im, 'RGBA')
    draw_lines(d, (80, y + 26), wrap(d, FOOTNOTE, lfont(27, False), 700), lfont(27, False), GRAY, gap=8)
    qr_box(im, d, (840, y + 8, 1000, y + 168), 'https://' + DOMAIN)
    im.convert('RGB').save(out / 'moments-02.png')

    # 03 获取卡
    im = gradient(W, H)
    deco(im)
    crown(im, (W // 2, 170), 112)
    d = ImageDraw.Draw(im, 'RGBA')
    d.text((W / 2, 246), 'ZONKEY', font=lfont(76), fill=INK, anchor='ma')
    d.text((W / 2, 348), '本地离线日用百宝箱', font=lfont(30, False), fill=GRAY, anchor='ma')

    card(im, (80, 440, 1000, 880), r=30)
    d = ImageDraw.Draw(im, 'RGBA')
    pill(d, 140, 492, '网页版 · 扫码即用', (78, 205, 196, 60), 34)
    d = ImageDraw.Draw(im, 'RGBA')
    draw_lines(d, (142, 596), wrap(d, '免安装，手机浏览器直接用', lfont(32, False), 430),
               lfont(32, False), INK, gap=10)
    draw_lines(d, (142, 662), wrap(d, '本次更新已在网页版上线', lfont(32, False), 430),
               lfont(32, False), GRAY, gap=10)
    qr_box(im, d, (640, 500, 920, 780))

    card(im, (80, 920, 1000, 1250), r=30)
    d = ImageDraw.Draw(im, 'RGBA')
    pill(d, 140, 970, '桌面版 · 完整能力', (255, 230, 109, 90), 34)
    d = ImageDraw.Draw(im, 'RGBA')
    draw_lines(d, (142, 1074), ['脱敏引擎 / OCR 导出 / 证书签名'], lfont(32, False), INK, gap=10)
    draw_lines(d, (142, 1138), ['GitHub / Gitee 搜「ZonKey」→ Release 下载'], lfont(32, False), GRAY, gap=10)
    pw = [pill_w(d, t, 26) for t in ('安装版', '便携版', 'macOS')]
    px = 142
    for t, w_ in zip(('安装版', '便携版', 'macOS'), pw):
        pill(d, px, 1180, t, (245, 246, 250, 255), 26)
        d = ImageDraw.Draw(im, 'RGBA')
        px += w_ + 16
    d = ImageDraw.Draw(im, 'RGBA')
    d.text((W / 2, 1330), f'免费开源 · 无广告 · 不注册不登录 · {DOMAIN}',
           font=lfont(28), fill=INK, anchor='ma')
    im.convert('RGB').save(out / 'moments-03.png')


# ---------------- 小红书（1242×1656） ----------------

def xhs():
    W, H = 1242, 1656
    out = OUT / 'xhs'
    out.mkdir(parents=True, exist_ok=True)

    # 01 封面
    im = gradient(W, H)
    deco(im)
    brand_row(im, 90, 72, 1.08, 'v2.2.0')
    d = ImageDraw.Draw(im, 'RGBA')
    pill(d, 90, 236, '手机网页版 · 本次更新', (255, 107, 107, 38), 32)
    rich_line(im, 90, 344, [('PDF 转 Word', False)], lfont(110))
    rich_line(im, 90, 486, [('终于能', False), ('直接看', True), ('了', False)], lfont(110))
    d = ImageDraw.Draw(im, 'RGBA')
    sub = '转换完点「打开」，弹窗里直接看图文表格——不用先下载，文件不出手机。'
    draw_lines(d, (90, 652), wrap(d, sub, lfont(35, False), 1000), lfont(35, False), GRAY, gap=10)
    px = 90
    for t, col in (('免费开源', (255, 230, 109, 90)), ('文件不上传', (78, 205, 196, 60)),
                   ('断网可用', (69, 183, 209, 45))):
        pill(d, px, 800, t, col, 30)
        d = ImageDraw.Draw(im, 'RGBA')
        px += pill_w(d, t, 30) + 18
    phone(im, (W - 470) // 2, 900, 470, 620)
    d = ImageDraw.Draw(im, 'RGBA')
    d.text((W / 2, 1572), DOMAIN, font=lfont(36), fill=INK, anchor='ma')
    im.convert('RGB').save(out / 'xhs-01.png')

    # 02 更新清单
    im = gradient(W, H)
    deco(im)
    d = ImageDraw.Draw(im, 'RGBA')
    l1, l2 = '本次更新 · v2.2.0', '2026-09-07'
    w1, w2 = pill_w(d, l1, 32), pill_w(d, l2, 32)
    pill(d, W / 2 - (w1 + w2 + 20) / 2, 104, l1, (255, 107, 107, 38), 32)
    d = ImageDraw.Draw(im, 'RGBA')
    pill(d, W / 2 - (w1 + w2 + 20) / 2 + w1 + 20, 104, l2, (255, 230, 109, 90), 32)
    d = ImageDraw.Draw(im, 'RGBA')
    d.text((W / 2, 240), '这次更新了什么', font=lfont(84), fill=INK, anchor='ma')
    y = updates_list(im, 90, 412, W - 180, 290, 46, 31, 28)
    d = ImageDraw.Draw(im, 'RGBA')
    draw_lines(d, (90, y + 30), wrap(d, FOOTNOTE, lfont(29, False), 760), lfont(29, False), GRAY, gap=8)
    qr_box(im, d, (W - 260, y + 8, W - 100, y + 168))
    d = ImageDraw.Draw(im, 'RGBA')
    d.text((90, y + 220), DOMAIN, font=lfont(30), fill=INK)
    im.convert('RGB').save(out / 'xhs-02.png')

    # 03 认识卡
    im = gradient(W, H)
    deco(im)
    d = ImageDraw.Draw(im, 'RGBA')
    pill(d, 90, 110, '它是谁', (255, 230, 109, 90), 30)
    d = ImageDraw.Draw(im, 'RGBA')
    d.text((90, 210), '先认识一下 ZonKey', font=lfont(80), fill=INK)
    card(im, (90, 350, W - 90, 590), r=28)
    d = ImageDraw.Draw(im, 'RGBA')
    desc = '一款本地离线日用百宝箱：智能脱敏为核心，8 大中心 70+ 项工具，全部在你的设备上完成，不联网。'
    draw_lines(d, (140, 402), wrap(d, desc, lfont(33, False), W - 320), lfont(33, False), INK, gap=12)
    centers = ['智能脱敏', 'PDF 工坊', 'PPT', '图像', '音视频', '文本', '计算开发', '系统硬件']
    cols = [(78, 205, 196, 60), (255, 107, 107, 38), (255, 230, 109, 90), (69, 183, 209, 45),
            (167, 139, 250, 50), (150, 230, 161, 60), (255, 169, 77, 55), (255, 159, 243, 50)]
    cw = (W - 180 - 3 * 18) / 4
    for i, (t, c) in enumerate(zip(centers, cols)):
        r_, c_ = divmod(i, 4)
        pill(d, 90 + c_ * (cw + 18), 640 + r_ * 96, t, c, 29, h=76, padx=10)
        d = ImageDraw.Draw(im, 'RGBA')
    card(im, (90, 880, W - 90, 1300), r=28)
    feats = [
        ('文件永不上传——断网也能用', TEAL),
        ('免费开源 · 无广告 · 不注册不登录', CORAL),
        ('杀手锏「智能脱敏」：图纸 / 公文敏感词自动识别抹除、输出副本原件不动（桌面版独有）', YELLOW),
    ]
    fy = 940
    for text, col in feats:
        d = ImageDraw.Draw(im, 'RGBA')
        d.ellipse([140, fy + 14, 168, fy + 42], fill=col)
        fl = wrap(d, text, lfont(32, False), W - 360)
        draw_lines(d, (196, fy), fl, lfont(32, False), INK, gap=10)
        fy += 60 * len(fl) + 36
    d = ImageDraw.Draw(im, 'RGBA')
    d.text((W / 2, 1400), '本轮更新全在手机网页版 · 桌面版同步 v2.2.0',
           font=lfont(30, False), fill=GRAY, anchor='ma')
    d.text((W / 2, 1500), DOMAIN, font=lfont(38), fill=INK, anchor='ma')
    im.convert('RGB').save(out / 'xhs-03.png')

    # 04 获取卡
    im = gradient(W, H)
    deco(im)
    crown(im, (W // 2, 200), 124)
    d = ImageDraw.Draw(im, 'RGBA')
    d.text((W / 2, 284), 'ZONKEY', font=lfont(84), fill=INK, anchor='ma')
    d.text((W / 2, 396), '本地离线日用百宝箱', font=lfont(32, False), fill=GRAY, anchor='ma')
    card(im, (90, 500, W - 90, 990), r=30)
    d = ImageDraw.Draw(im, 'RGBA')
    pill(d, 150, 560, '网页版 · 扫码即用', (78, 205, 196, 60), 36)
    d = ImageDraw.Draw(im, 'RGBA')
    draw_lines(d, (152, 676), wrap(d, '免安装，手机浏览器直接用', lfont(34, False), 480),
               lfont(34, False), INK, gap=10)
    draw_lines(d, (152, 748), wrap(d, '本次更新已在网页版上线', lfont(34, False), 480),
               lfont(34, False), GRAY, gap=10)
    qr_box(im, d, (W - 420, 590, W - 120, 890))
    card(im, (90, 1030, W - 90, 1400), r=30)
    d = ImageDraw.Draw(im, 'RGBA')
    pill(d, 150, 1088, '桌面版 · 完整能力', (255, 230, 109, 90), 36)
    d = ImageDraw.Draw(im, 'RGBA')
    draw_lines(d, (152, 1204), ['脱敏引擎 / OCR 导出 / 证书签名'], lfont(34, False), INK, gap=10)
    draw_lines(d, (152, 1272), ['GitHub / Gitee 搜「ZonKey」→ Release 下载'], lfont(34, False), GRAY, gap=10)
    d = ImageDraw.Draw(im, 'RGBA')
    d.text((W / 2, 1480), f'免费开源 · 无广告 · 不注册不登录', font=lfont(30, False), fill=GRAY, anchor='ma')
    d.text((W / 2, 1552), DOMAIN, font=lfont(40), fill=INK, anchor='ma')
    im.convert('RGB').save(out / 'xhs-04.png')


# ---------------- 抖音（1080×1920） ----------------

def douyin():
    W, H = 1080, 1920
    out = OUT / 'douyin'
    out.mkdir(parents=True, exist_ok=True)

    # 01 封面
    im = gradient(W, H)
    deco(im)
    brand_row(im, 80, 84, 1.0, 'v2.2.0 · 2026-09-07')
    d = ImageDraw.Draw(im, 'RGBA')
    pill(d, 80, 240, '手机网页版 · 本次更新', (255, 107, 107, 38), 30)
    rich_line(im, 80, 356, [('转完', False), ('直接看', True)], lfont(118))
    rich_line(im, 80, 516, [('不用先下载', False)], lfont(118))
    d = ImageDraw.Draw(im, 'RGBA')
    sub = 'PDF 转 Word / Excel 完成后点「打开」，弹窗里直接预览——文件不出手机。'
    draw_lines(d, (80, 692), wrap(d, sub, lfont(34, False), 900), lfont(34, False), GRAY, gap=10)
    phone(im, (W - 450) // 2, 850, 450, 780)
    d = ImageDraw.Draw(im, 'RGBA')
    t = '免费开源 · 文件不上传 · 断网可用'
    tw = d.textlength(t, font=lfont(30, False))
    d.rounded_rectangle([(W - tw) / 2 - 30, 1700, (W + tw) / 2 + 30, 1766], 33, fill=(255, 255, 255, 220))
    d.text((W / 2, 1733), t, font=lfont(30, False), fill=INK, anchor='mm')
    d.text((W / 2, 1812), DOMAIN, font=lfont(38), fill=INK, anchor='ma')
    im.convert('RGB').save(out / 'douyin-01.png')

    # 02 清单
    im = gradient(W, H)
    deco(im)
    d = ImageDraw.Draw(im, 'RGBA')
    l1, l2 = '本次更新 · v2.2.0', '2026-09-07'
    w1, w2 = pill_w(d, l1, 30), pill_w(d, l2, 30)
    pill(d, W / 2 - (w1 + w2 + 20) / 2, 116, l1, (255, 107, 107, 38), 30)
    d = ImageDraw.Draw(im, 'RGBA')
    pill(d, W / 2 - (w1 + w2 + 20) / 2 + w1 + 20, 116, l2, (255, 230, 109, 90), 30)
    d = ImageDraw.Draw(im, 'RGBA')
    d.text((W / 2, 250), '这次更新了什么', font=lfont(80), fill=INK, anchor='ma')
    y = updates_list(im, 80, 424, W - 160, 310, 44, 31, 30)
    d = ImageDraw.Draw(im, 'RGBA')
    nl = wrap(d, FOOTNOTE, lfont(29, False), 620)
    draw_lines(d, (80, y + 30), nl, lfont(29, False), GRAY, gap=8)
    qr_box(im, d, (W - 250, y + 20, W - 90, y + 180))
    d = ImageDraw.Draw(im, 'RGBA')
    d.text((80, y + 260), DOMAIN, font=lfont(32), fill=INK)
    im.convert('RGB').save(out / 'douyin-02.png')

    # 03 获取
    im = gradient(W, H)
    deco(im)
    crown(im, (W // 2, 220), 120)
    d = ImageDraw.Draw(im, 'RGBA')
    d.text((W / 2, 306), 'ZONKEY', font=lfont(80), fill=INK, anchor='ma')
    d.text((W / 2, 416), '本地离线日用百宝箱', font=lfont(32, False), fill=GRAY, anchor='ma')
    card(im, (80, 540, W - 80, 1120), r=30)
    d = ImageDraw.Draw(im, 'RGBA')
    pill(d, 140, 604, '网页版 · 扫码即用', (78, 205, 196, 60), 36)
    d = ImageDraw.Draw(im, 'RGBA')
    draw_lines(d, (142, 724), wrap(d, '免安装，手机浏览器直接用', lfont(34, False), 460),
               lfont(34, False), INK, gap=10)
    draw_lines(d, (142, 796), wrap(d, '本次更新已在网页版上线', lfont(34, False), 460),
               lfont(34, False), GRAY, gap=10)
    qr_box(im, d, (660, 620, 960, 920))
    card(im, (80, 1160, W - 80, 1560), r=30)
    d = ImageDraw.Draw(im, 'RGBA')
    pill(d, 140, 1224, '桌面版 · 完整能力', (255, 230, 109, 90), 36)
    d = ImageDraw.Draw(im, 'RGBA')
    draw_lines(d, (142, 1344), ['脱敏引擎 / OCR 导出 / 证书签名'], lfont(34, False), INK, gap=10)
    draw_lines(d, (142, 1412), ['GitHub / Gitee 搜「ZonKey」→ Release 下载'], lfont(34, False), GRAY, gap=10)
    d = ImageDraw.Draw(im, 'RGBA')
    d.text((W / 2, 1650), '免费开源 · 无广告 · 不注册不登录', font=lfont(30, False), fill=GRAY, anchor='ma')
    d.text((W / 2, 1730), DOMAIN, font=lfont(42), fill=INK, anchor='ma')
    im.convert('RGB').save(out / 'douyin-03.png')


if __name__ == '__main__':
    moments()
    xhs()
    douyin()
    print('social r29 ->', OUT)
    for sub in ('moments', 'xhs', 'douyin'):
        for p in sorted((OUT / sub).glob('*.png')):
            print(' ', sub, p.name, Image.open(p).size)
