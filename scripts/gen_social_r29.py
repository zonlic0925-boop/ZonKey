# -*- coding: utf-8 -*-
"""v2.2.0（2026-09-07）三平台社交物料：朋友圈 + 小红书 + 抖音。

内容口径（2026-09-07 用户反馈重做，第二次）：不再把「打开/直接预览」当更新卖点
——首版起转换产物即可直接打开。更新内容=「自首版发布（v1.0）以来陆续上线的
主要新功能」总览：①10 款高频小工具（二维码/证件照/打码等）②PDF·图像·PPT
批处理 ③「任务完成」弹窗 ④手机网页版同步可用。与 App 内「更新内容」弹窗
（i18n whatsnew r30，WHATSNEW_ROUND=30）同口径。旧轮（r26-r29「打开预览」）
文案已整体移除，勿回退。

输出：
- docs/screenshots/round29/moments/moments-01~03.png  1080×1440 (3:4)   朋友圈
- docs/screenshots/round29/xhs/xhs-01~04.png          1242×1656 (3:4)   小红书
- docs/screenshots/round29/douyin/douyin-01~03.png    1080×1920 (9:16)  抖音图文

设计（区别于旧 Memphis 硬阴影版）：柔和渐变底 + 大圆角白卡软阴影 + 马克笔高亮
+ 手机示意（应用首页 · 高频小工具墙），品牌色与 index.css 同源。
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


def app_home(im, x, y, w, h):
    """手机示意（应用首页）：状态栏 + 搜索条 + 高频小工具墙 + 底部导航。

    更新口径下首页示意的是「小工具们」（二维码/证件照/打码/批处理…），
    不再是旧版的「转换完成 → 打开/下载」弹窗——打开预览首版即有，不当作新卖点。
    """
    d = ImageDraw.Draw(im, 'RGBA')
    sh = Image.new('RGBA', im.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(sh)
    sd.rounded_rectangle([x, y + 16, x + w, y + h], int(w * 0.14), fill=(26, 26, 46, 70))
    im.alpha_composite(sh.filter(ImageFilter.GaussianBlur(16)))
    d = ImageDraw.Draw(im, 'RGBA')
    d.rounded_rectangle([x, y, x + w, y + h], int(w * 0.14), fill=(31, 31, 54, 255))
    si = w * 0.035
    sx, sy, sx1, sy1 = x + si, y + si, x + w - si, y + h - si
    d.rounded_rectangle([sx, sy, sx1, sy1], int(w * 0.10), fill=(246, 247, 251, 255))
    u = w / 390
    # 状态栏
    d.rounded_rectangle([sx + w / 2 - u * 42, sy + u * 10, sx + w / 2 + u * 42, sy + u * 20],
                        u * 5, fill=(232, 234, 240, 255))
    pad = u * 24
    cx0, cx1 = sx + pad, sx1 - pad
    # 顶栏：首页标题 + 头像点
    d.text((cx0, sy + u * 42), 'ZONKEY', font=lfont(int(u * 26)), fill=INK)
    d.ellipse([cx1 - u * 34, sy + u * 44, cx1, sy + u * 78], fill=TEAL)
    # 搜索条
    sr_y = sy + u * 96
    d.rounded_rectangle([cx0, sr_y, cx1, sr_y + u * 50], u * 25, fill=WHITE,
                        outline=(232, 234, 240, 255), width=2)
    d.text((cx0 + u * 22, sr_y + u * 25), '搜索 70+ 工具', font=lfont(int(u * 19), False),
           fill=(150, 154, 170, 255), anchor='lm')
    # 区块标题
    lab_y = sr_y + u * 72
    d.text((cx0, lab_y), '高频小工具', font=lfont(int(u * 24)), fill=INK)
    # 底部导航（固定）与工具墙区域
    nav_y = sy1 - u * 64
    grid_top = lab_y + u * 46
    gw = cx1 - cx0
    gap = u * 20
    tw_ = (gw - gap * 2) / 3
    th_ = (nav_y - u * 16 - grid_top - gap) / 2
    names = ['二维码', '证件照', '图片打码', 'PDF 批处理', '文本 diff', '单位换算']
    subs = ['生成 / 识别', '换底 / 裁剪', '局部模糊', '多文件', '逐行对比', '进制转换']
    cols = [TEAL, CORAL, SKY, YELLOW, ORANGE, LAV]
    for i in range(6):
        r_, c_ = divmod(i, 3)
        tx0 = cx0 + c_ * (tw_ + gap)
        ty0 = grid_top + r_ * (th_ + gap)
        d.rounded_rectangle([tx0, ty0, tx0 + tw_, ty0 + th_], u * 18, fill=WHITE,
                            outline=(232, 234, 240, 255), width=2)
        col = cols[i]
        dotr = u * 11
        d.ellipse([tx0 + tw_ / 2 - dotr, ty0 + u * 24 - dotr, tx0 + tw_ / 2 + dotr, ty0 + u * 24 + dotr],
                  fill=col)
        d.text((tx0 + tw_ / 2, ty0 + u * 56), names[i], font=lfont(int(u * 21)), fill=INK, anchor='ma')
        d.text((tx0 + tw_ / 2, ty0 + u * 86), subs[i], font=lfont(int(u * 15), False),
               fill=GRAY, anchor='ma')
    # 底部导航
    for i, lab in enumerate(('首页', '工具', '我的')):
        nx = cx0 + gw * (i + 0.5) / 3
        d.text((nx, nav_y + u * 8), lab, font=lfont(int(u * 19), i == 0),
               fill=INK if i == 0 else GRAY, anchor='ma')
    d.rounded_rectangle([sx + w / 2 - u * 50, sy1 - u * 14, sx + w / 2 + u * 50, sy1 - u * 8],
                        u * 3, fill=(210, 213, 222, 255))


def deco(im):
    blobs(im, [(im.width + 40, 60, 190, TEAL, 55), (-30, im.height * 0.42, 170, CORAL, 45),
               (im.width + 20, im.height - 120, 210, YELLOW, 50)])


# ---------------- 更新内容（真源：App「更新内容」弹窗 r30，2026-09-07） ----------------
# 口径=自首版发布（v1.0）以来陆续上线的更新总览。「打开/直接预览」首版即有，
# 不写入（2026-09-07 用户反馈定稿，第二次重做）。

UPDATES = [
    ('小工具新增 10 款', TEAL,
     '二维码生成/识别、证件照换底色与裁剪、图片打码、文本 diff、正则测试、批量重命名、重复文件查找、PDF 书签编辑、文字朗读、单位/进制换算'),
    ('PDF / 图像 / PPT 批处理', SKY,
     '多个文件一次排队处理：逐文件进度、随时可停，完成后打包 ZIP 一次交付'),
    ('「任务完成」弹窗', CORAL,
     '任何工具处理完统一弹出：打开 / 下载一步到位，桌面版支持原生另存为'),
    ('手机网页版同步', ORANGE,
     '二维码、证件照等纯前端工具浏览器本地直跑、断网可用；触屏裁剪与页面缩放已适配'),
]

FOOTNOTE = '以上更新已随 v2.2.0 上线 · 网页版与桌面版同步'

COVER_SUB_SHORT = ('首版(v1.0)还是脱敏工作台，现在已是 8 大中心 70+ 工具百宝箱——'
                   '10 款小工具、批处理、任务弹窗持续上新，全程离线免费。')
COVER_SUB_LONG = ('首版(v1.0)还是智能脱敏工作台，如今长成 8 大中心 70+ 工具的本地百宝箱——'
                  '二维码、证件照、图片打码等 10 款小工具与批处理、任务弹窗陆续上新。')


def updates_list(im, x, y, w, pad, title_fs, desc_fs, gap):
    """编号圆点 + 标题 + 描述的自适应清单卡。返回最后一项底部 y。

    每项高度按实际换行行数计算（2–3 行描述的平台自动留高）。
    """
    d = ImageDraw.Draw(im, 'RGBA')
    cd = 42
    for i, (tag, col, desc) in enumerate(UPDATES):
        tf = lfont(title_fs)
        df = lfont(desc_fs, False)
        th = d.textbbox((0, 0), '中', font=tf)[3]
        lh = d.textbbox((0, 0), '中', font=df)[3]
        desc_lines = wrap(d, desc, df, w - pad * 2)
        desc_h = len(desc_lines) * lh + (len(desc_lines) - 1) * 6
        item_h = pad * 2 + max(cd, th) + 10 + desc_h
        card(im, (x, y, x + w, y + item_h), r=26)
        d = ImageDraw.Draw(im, 'RGBA')
        cy = y + pad + max(cd, th) / 2
        d.ellipse([x + pad, cy - cd / 2, x + pad + cd, cy + cd / 2], fill=col)
        d.text((x + pad + cd / 2, cy), str(i + 1), font=lfont(int(cd * 0.5)), fill=WHITE, anchor='mm')
        d.text((x + pad + cd + 18, cy), tag, font=tf, fill=INK, anchor='lm')
        draw_lines(d, (x + pad, y + pad + max(cd, th) + 10), desc_lines, df, GRAY, gap=6)
        y += item_h + gap
    return y - gap


# ---------------- 朋友圈（1080×1440） ----------------

def moments():
    W, H = 1080, 1440
    out = OUT / 'moments'
    out.mkdir(parents=True, exist_ok=True)

    # 01 主卡
    im = gradient(W, H)
    deco(im)
    brand_row(im, 80, 64, 1.0, 'v2.2.0 · 2026-09-07')
    d = ImageDraw.Draw(im, 'RGBA')
    pill(d, 80, 208, '更新总览 · 自首版发布以来', (255, 107, 107, 38), 30)
    d = ImageDraw.Draw(im, 'RGBA')
    d.text((80, 300), '从首版发布到现在', font=lfont(84), fill=INK)
    rich_line(im, 80, 412, [('一直', False), ('在上新', True)], lfont(84))
    d = ImageDraw.Draw(im, 'RGBA')
    draw_lines(d, (80, 560), wrap(d, COVER_SUB_SHORT, lfont(30, False), 900),
               lfont(30, False), GRAY, gap=10)

    # 左：首版 / 现在
    card(im, (80, 720, 590, 898), r=26, outline=(255, 107, 107, 130), width=3)
    d = ImageDraw.Draw(im, 'RGBA')
    d.text((120, 750), '× 第一版', font=lfont(34), fill=CORAL)
    draw_lines(d, (120, 808), wrap(d, '图纸、公文、Word 敏感信息，本机一键抹除', lfont(28, False), 420),
               lfont(28, False), GRAY, gap=8)
    card(im, (80, 922, 590, 1100), r=26, outline=(78, 205, 196, 150), width=3)
    d = ImageDraw.Draw(im, 'RGBA')
    d.text((120, 952), '√ 现在', font=lfont(34), fill=(30, 150, 142))
    draw_lines(d, (120, 1010), wrap(d, '8 大中心 70+ 工具：小工具、批处理、转换、音视频一箱装',
                                    lfont(28, False), 420), lfont(28, False), GRAY, gap=8)
    d.text((82, 1120), '界面为功能示意 · 完整清单与获取方式见后页', font=lfont(24, False), fill=GRAY)

    # 右：手机示意（小工具墙）
    app_home(im, 646, 660, 364, 580)

    # 底条
    card(im, (80, 1290, 1000, 1392), r=24)
    d = ImageDraw.Draw(im, 'RGBA')
    qr_box(im, d, (96, 1302, 188, 1394 - 12))
    d = ImageDraw.Draw(im, 'RGBA')
    px = 212
    for t, col in (('10 款小工具', (78, 205, 196, 60)), ('批处理', (69, 183, 209, 45)),
                   ('任务弹窗', (255, 107, 107, 40))):
        pw = pill_w(d, t, 24)
        pill(d, px, 1312, t, col, 24)
        d = ImageDraw.Draw(im, 'RGBA')
        px += pw + 14
    d.text((988, 1341), DOMAIN, font=lfont(28), fill=INK, anchor='rm')
    im.convert('RGB').save(out / 'moments-01.png')

    # 02 清单卡
    im = gradient(W, H)
    deco(im)
    d = ImageDraw.Draw(im, 'RGBA')
    l1 = '更新总览'
    w1 = pill_w(d, l1, 30)
    l2 = 'v1.0 → v2.2.0'
    w2 = pill_w(d, l2, 30)
    cx = W / 2
    pill(d, cx - (w1 + w2 + 20) / 2, 96, l1, (255, 107, 107, 38), 30)
    d = ImageDraw.Draw(im, 'RGBA')
    pill(d, cx - (w1 + w2 + 20) / 2 + w1 + 20, 96, l2, (255, 230, 109, 90), 30)
    d = ImageDraw.Draw(im, 'RGBA')
    d.text((cx, 240), '更新了什么', font=lfont(84), fill=INK, anchor='ma')
    y = updates_list(im, 80, 400, 920, 28, 39, 26, 24)
    d = ImageDraw.Draw(im, 'RGBA')
    draw_lines(d, (80, y + 30), wrap(d, FOOTNOTE, lfont(27, False), 700), lfont(27, False), GRAY, gap=8)
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
    draw_lines(d, (142, 662), wrap(d, '最新 v2.2.0 已上线：软件内有完整更新说明', lfont(32, False), 430),
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
    pill(d, 90, 236, '更新总览 · 自首版发布以来', (255, 107, 107, 38), 32)
    d = ImageDraw.Draw(im, 'RGBA')
    d.text((90, 352), '从首版发布到现在', font=lfont(104), fill=INK)
    rich_line(im, 90, 494, [('一直', False), ('在上新', True)], lfont(104))
    d = ImageDraw.Draw(im, 'RGBA')
    draw_lines(d, (90, 664), wrap(d, COVER_SUB_LONG, lfont(34, False), 1000),
               lfont(34, False), GRAY, gap=10)
    px = 90
    for t, col in (('免费开源', (255, 230, 109, 90)), ('文件不上传', (78, 205, 196, 60)),
                   ('断网可用', (69, 183, 209, 45))):
        pill(d, px, 846, t, col, 30)
        d = ImageDraw.Draw(im, 'RGBA')
        px += pill_w(d, t, 30) + 18
    app_home(im, (W - 470) // 2, 960, 470, 540)
    d = ImageDraw.Draw(im, 'RGBA')
    d.text((W / 2, 1572), DOMAIN, font=lfont(36), fill=INK, anchor='ma')
    im.convert('RGB').save(out / 'xhs-01.png')

    # 02 更新清单
    im = gradient(W, H)
    deco(im)
    d = ImageDraw.Draw(im, 'RGBA')
    l1, l2 = '更新总览', 'v1.0 → v2.2.0'
    w1, w2 = pill_w(d, l1, 32), pill_w(d, l2, 32)
    pill(d, W / 2 - (w1 + w2 + 20) / 2, 104, l1, (255, 107, 107, 38), 32)
    d = ImageDraw.Draw(im, 'RGBA')
    pill(d, W / 2 - (w1 + w2 + 20) / 2 + w1 + 20, 104, l2, (255, 230, 109, 90), 32)
    d = ImageDraw.Draw(im, 'RGBA')
    d.text((W / 2, 244), '更新了什么', font=lfont(96), fill=INK, anchor='ma')
    y = updates_list(im, 90, 408, W - 180, 30, 46, 31, 28)
    d = ImageDraw.Draw(im, 'RGBA')
    draw_lines(d, (90, y + 30), wrap(d, FOOTNOTE, lfont(29, False), 800), lfont(29, False), GRAY, gap=8)
    qr_box(im, d, (W - 260, y + 8, W - 100, y + 168))
    d = ImageDraw.Draw(im, 'RGBA')
    d.text((W / 2, 1552), DOMAIN, font=lfont(36), fill=INK, anchor='ma')
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
    d.text((W / 2, 1400), '以上更新已全部上线 · 完整清单见软件「更新内容」弹窗',
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
    draw_lines(d, (152, 748), wrap(d, '最新 v2.2.0 已上线：软件内有完整更新说明', lfont(34, False), 480),
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
    pill(d, 80, 240, '更新总览 · 自首版发布以来', (255, 107, 107, 38), 30)
    d = ImageDraw.Draw(im, 'RGBA')
    d.text((80, 352), '从首版发布到现在', font=lfont(100), fill=INK)
    rich_line(im, 80, 500, [('一直', False), ('在上新', True)], lfont(116))
    d = ImageDraw.Draw(im, 'RGBA')
    draw_lines(d, (80, 700), wrap(d, COVER_SUB_LONG, lfont(34, False), 900),
               lfont(34, False), GRAY, gap=10)
    app_home(im, (W - 450) // 2, 920, 450, 700)
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
    l1, l2 = '更新总览', 'v1.0 → v2.2.0'
    w1, w2 = pill_w(d, l1, 30), pill_w(d, l2, 30)
    pill(d, W / 2 - (w1 + w2 + 20) / 2, 116, l1, (255, 107, 107, 38), 30)
    d = ImageDraw.Draw(im, 'RGBA')
    pill(d, W / 2 - (w1 + w2 + 20) / 2 + w1 + 20, 116, l2, (255, 230, 109, 90), 30)
    d = ImageDraw.Draw(im, 'RGBA')
    d.text((W / 2, 250), '更新了什么', font=lfont(80), fill=INK, anchor='ma')
    y = updates_list(im, 80, 430, W - 160, 30, 48, 31, 34)
    d = ImageDraw.Draw(im, 'RGBA')
    nl = wrap(d, FOOTNOTE, lfont(29, False), 620)
    draw_lines(d, (80, y + 30), nl, lfont(29, False), GRAY, gap=8)
    qr_box(im, d, (W - 250, y + 20, W - 90, y + 180))
    t = '免费开源 · 无广告 · 不注册不登录'
    tw = d.textlength(t, font=lfont(30, False))
    d.rounded_rectangle([(W - tw) / 2 - 30, 1700, (W + tw) / 2 + 30, 1766], 33, fill=(255, 255, 255, 220))
    d.text((W / 2, 1733), t, font=lfont(30, False), fill=INK, anchor='mm')
    d.text((W / 2, 1812), DOMAIN, font=lfont(38), fill=INK, anchor='ma')
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
    draw_lines(d, (142, 796), wrap(d, '最新 v2.2.0 已上线：软件内有完整更新说明', lfont(34, False), 460),
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
