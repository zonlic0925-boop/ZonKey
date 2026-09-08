# -*- coding: utf-8 -*-
"""小红书物料 · 限流重做版（round-31，2026-09-08）——去链接零引流口径。

背景：r29 小红书 4 卡（docs/screenshots/round29/xhs/）发布于 2026-09-07 20:47，
20:57 被限流（审核详情：笔记存在外部平台信息或联系方式的內容）。触发点：
每张卡底部域名 zonkey.pages.dev、xhs-04 二维码 + 「GitHub / Gitee 搜 ZonKey
Release 下载」、正文末行与评论区置顶链接均属站外导流。
本轮重做规则：
1. 图卡 / 配文零外部平台信息：无网址、无域名、无二维码、「扫一扫」、
   GitHub/Gitee/微信/QQ/邮箱等渠道名与联系方式、无「评论区自取/私信」句式。
2. 品牌词「ZonKey / ZONKEY」与工具名（含「二维码」功能名）不受影响。
3. 版面与 round-29 重排（背景色斑参数、子标题文案、底栏改为页码点+左滑提示），
   避免同图重发被重复判定。
内容口径与 App「更新内容」弹窗（i18n whatsnew r30）同源，保持不变。

输出：docs/screenshots/round31/xhs/xhs-01~04.png  1242×1656 (3:4)
运行：python scripts/gen_xhs_r31.py
"""
import re
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'docs' / 'screenshots' / 'round31' / 'xhs'

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

# —— 红线：图卡上禁止出现的任何字符串（大小写不敏感、子串匹配）——
BANNED = [
    'zonkey.pages', '.pages.dev', '.dev', 'http', 'www.', 'github', 'gitee',
    'release', '扫码', '扫一扫', '私信', '微信', 'qq', '邮箱', '手机号',
    '加v', '进群', '扣1', '评论区自取', '主页自取', '直达', '点链接',
]
BANNED_RE = re.compile('|'.join(re.escape(b) for b in BANNED), re.IGNORECASE)


def lfont(sz, bold=True):
    return ImageFont.truetype(F_BOLD if bold else F_REG, sz)


def check_clean(*texts):
    bad = []
    for t in texts:
        if BANNED_RE.search(t):
            bad.append(t)
    if bad:
        raise SystemExit(f'BANNED TOKEN FOUND:\n' + '\n'.join(f'  - {b}' for b in bad))


# ---------------- 基础绘制（与 gen_social_r29.py 同源） ----------------

def gradient(w, h, top=CREAM, bot=PEACH):
    base = Image.new('RGB', (1, h))
    for i in range(h):
        t = i / (h - 1)
        base.putpixel((0, i), tuple(int(a + (b - a) * t) for a, b in zip(top, bot)))
    return base.resize((w, h)).convert('RGBA')


def blobs(im, spots):
    layer = Image.new('RGBA', im.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for cx, cy, r, col, a in spots:
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=col[:3] + (a,))
    layer = layer.filter(ImageFilter.GaussianBlur(90))
    im.alpha_composite(layer)


def deco(im):
    """round-31 变体：色斑方位/配色与 r29 错开，避免同图重复判定。"""
    W, H = im.size
    blobs(im, [(-40, 90, 210, LAV, 46), (W - 20, H * 0.34, 185, TEAL, 42),
               (40, H - 150, 205, CORAL, 40)])


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
    # ASCII 连续串（数字/英文/版本号如 70+、v2.2.0、diff）作为整体断行
    units = re.findall(r'[0-9A-Za-z+#./]+|.', text)
    lines, line = [], ''
    for ch in units:
        if line and d.textlength(line + ch, font=f) > max_w:
            lines.append(line)
            line = '' if ch == ' ' else ch
        else:
            line += ch
    if line:
        lines.append(line)
    return lines


def draw_lines(d, xy, lines, f, fill=INK, gap=12):
    x, y = xy
    lh = d.textbbox((0, 0), '中', font=f)[3]
    for ln in lines:
        d.text((x, y), ln, font=f, fill=fill)
        y += lh + gap
    return y - gap - lh + lh if lines else y


def pill(d, x, y, label, fill, fsize, h=None, tc=INK, padx=None):
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


def crown(im, center, size):
    icon = Image.open(ROOT / 'assets' / 'zonkey.png').convert('RGBA').resize((size, size), Image.LANCZOS)
    im.alpha_composite(icon, (center[0] - size // 2, center[1] - size // 2))


def brand_row(im, x, y, s=1.0, chip_label=None, chip_fill=YELLOW):
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
    """手机示意（应用首页）：状态栏 + 搜索条 + 高频小工具墙 + 底部导航。"""
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
    d.rounded_rectangle([sx + w / 2 - u * 42, sy + u * 10, sx + w / 2 + u * 42, sy + u * 20],
                        u * 5, fill=(232, 234, 240, 255))
    pad = u * 24
    cx0, cx1 = sx + pad, sx1 - pad
    d.text((cx0, sy + u * 42), 'ZONKEY', font=lfont(int(u * 26)), fill=INK)
    d.ellipse([cx1 - u * 34, sy + u * 44, cx1, sy + u * 78], fill=TEAL)
    sr_y = sy + u * 96
    d.rounded_rectangle([cx0, sr_y, cx1, sr_y + u * 50], u * 25, fill=WHITE,
                        outline=(232, 234, 240, 255), width=2)
    d.text((cx0 + u * 22, sr_y + u * 25), '搜索 70+ 工具', font=lfont(int(u * 19), False),
           fill=(150, 154, 170, 255), anchor='lm')
    lab_y = sr_y + u * 60
    d.text((cx0, lab_y), '高频小工具', font=lfont(int(u * 23)), fill=INK)
    nav_y = sy1 - u * 64
    grid_top = lab_y + u * 42
    gw = cx1 - cx0
    gap = u * 18
    tw_ = (gw - gap) / 2
    th_ = (nav_y - u * 14 - grid_top - gap) / 2
    names = ['二维码', '证件照', '图片打码', 'PDF 批处理']
    subs = ['生成 / 识别', '换底 / 裁剪', '局部模糊', '多文件排队']
    cols = [TEAL, CORAL, SKY, YELLOW]
    for i in range(4):
        r_, c_ = divmod(i, 2)
        tx0 = cx0 + c_ * (tw_ + gap)
        ty0 = grid_top + r_ * (th_ + gap)
        d.rounded_rectangle([tx0, ty0, tx0 + tw_, ty0 + th_], u * 16, fill=WHITE,
                            outline=(232, 234, 240, 255), width=2)
        dotr = u * 9
        d.ellipse([tx0 + u * 16 - dotr, ty0 + u * 25 - dotr,
                   tx0 + u * 16 + dotr, ty0 + u * 25 + dotr], fill=cols[i])
        d.text((tx0 + u * 32, ty0 + u * 11), names[i], font=lfont(int(u * 17)), fill=INK)
        d.text((tx0 + u * 32, ty0 + u * 38), subs[i], font=lfont(int(u * 12), False), fill=GRAY)
    for i, lab in enumerate(('首页', '工具', '我的')):
        nx = cx0 + gw * (i + 0.5) / 3
        d.text((nx, nav_y + u * 8), lab, font=lfont(int(u * 19), i == 0),
               fill=INK if i == 0 else GRAY, anchor='ma')
    d.rounded_rectangle([sx + w / 2 - u * 50, sy1 - u * 14, sx + w / 2 + u * 50, sy1 - u * 8],
                        u * 3, fill=(210, 213, 222, 255))


def page_dots(im, n, total=4, cy=1630):
    """底部居中页码点；n=当前页（0 起）。"""
    d = ImageDraw.Draw(im, 'RGBA')
    W = im.width
    gap = 46
    x0 = W / 2 - (total - 1) * gap / 2
    for i in range(total):
        cx = x0 + i * gap
        if i == n:
            d.ellipse([cx - 11, cy - 11, cx + 11, cy + 11], fill=CORAL)
        else:
            d.ellipse([cx - 10, cy - 10, cx + 10, cy + 10], fill=(255, 255, 255, 200))
            d.ellipse([cx - 10, cy - 10, cx + 10, cy + 10], outline=(230, 215, 210, 255), width=2)


def hint(im, label):
    """内容区底部居中提示行（进入点必须 ≤1550，dots cy1630 不冲突）。"""
    check_clean(label)
    d = ImageDraw.Draw(im, 'RGBA')
    d.text((im.width / 2, 1592), label, font=lfont(30, False), fill=GRAY, anchor='mm')


# ---------------- 文案（真源：App「更新内容」弹窗 r30 口径） ----------------

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
COVER_SUB = ('首版还只会给图纸、公文里的敏感信息打码，如今长成 8 大中心 70+ 工具的'
             '本地百宝箱——最近又上了 10 款小工具和批处理。')
ALL_TEXTS = []


def remember(*texts):
    ALL_TEXTS.extend(texts)


def updates_list(im, x, y, w, pad=36, title_fs=48, desc_fs=32, gap=46):
    d = ImageDraw.Draw(im, 'RGBA')
    cd = 42
    for i, (tag, col, desc) in enumerate(UPDATES):
        remember(tag, desc)
        tf = lfont(title_fs)
        df = lfont(desc_fs, False)
        th = d.textbbox((0, 0), '中', font=tf)[3]
        lh = d.textbbox((0, 0), '中', font=df)[3]
        desc_lines = wrap(d, desc, df, w - pad * 2)
        desc_h = len(desc_lines) * lh + (len(desc_lines) - 1) * 10
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


# ---------------- 四张卡 ----------------

def xhs01():
    W, H = 1242, 1656
    im = gradient(W, H)
    deco(im)
    remember('v2.2.0', '更新总览 · 自首版发布以来', '从首版发布到现在', '一直在上新', COVER_SUB,
             '免费无广告', '文件不上传', '断网可用', '左滑 · 看更新清单')
    brand_row(im, 90, 72, 1.08, 'v2.2.0')
    d = ImageDraw.Draw(im, 'RGBA')
    pill(d, 90, 236, '更新总览 · 自首版发布以来', (255, 107, 107, 38), 32)
    d = ImageDraw.Draw(im, 'RGBA')
    d.text((90, 352), '从首版发布到现在', font=lfont(104), fill=INK)
    rich_line(im, 90, 494, [('一直', False), ('在上新', True)], lfont(104))
    d = ImageDraw.Draw(im, 'RGBA')
    draw_lines(d, (90, 664), wrap(d, COVER_SUB, lfont(34, False), 1000),
               lfont(34, False), GRAY, gap=10)
    px = 90
    for t, col in (('免费无广告', (255, 230, 109, 90)), ('文件不上传', (78, 205, 196, 60)),
                   ('断网可用', (69, 183, 209, 45))):
        pill(d, px, 852, t, col, 30)
        d = ImageDraw.Draw(im, 'RGBA')
        px += pill_w(d, t, 30) + 18
    app_home(im, (W - 470) // 2, 940, 470, 540)
    hint(im, '左滑 · 看更新清单')
    page_dots(im, 0)
    im.convert('RGB').save(OUT / 'xhs-01.png')


def xhs02():
    W, H = 1242, 1656
    im = gradient(W, H)
    deco(im)
    remember('更新总览', 'v1.0 → v2.2.0', '更新了什么', FOOTNOTE)
    d = ImageDraw.Draw(im, 'RGBA')
    l1, l2 = '更新总览', 'v1.0 → v2.2.0'
    w1, w2 = pill_w(d, l1, 32), pill_w(d, l2, 32)
    pill(d, W / 2 - (w1 + w2 + 20) / 2, 104, l1, (255, 107, 107, 38), 32)
    d = ImageDraw.Draw(im, 'RGBA')
    pill(d, W / 2 - (w1 + w2 + 20) / 2 + w1 + 20, 104, l2, (255, 230, 109, 90), 32)
    d = ImageDraw.Draw(im, 'RGBA')
    d.text((W / 2, 244), '更新了什么', font=lfont(96), fill=INK, anchor='ma')
    y = updates_list(im, 90, 408, W - 180)
    d = ImageDraw.Draw(im, 'RGBA')
    fl = wrap(d, FOOTNOTE, lfont(29, False), W - 240)
    y2 = draw_lines(d, (90, y + 24), fl, lfont(29, False), GRAY, gap=8)
    assert y2 <= 1560, f'xhs-02 内容溢出底栏: {y2}'
    hint(im, '左滑 · 认识 ZonKey')
    page_dots(im, 1)
    im.convert('RGB').save(OUT / 'xhs-02.png')
    print(f'  xhs-02 list_end={y} footnote_end={y2}')


def xhs03():
    W, H = 1242, 1656
    im = gradient(W, H)
    deco(im)
    desc = '一款本地离线日用百宝箱：智能脱敏为核心，8 大中心 70+ 项工具，全部在你的设备上完成，不联网。'
    tagline = '工具再多，文件也只在你自己的设备上'
    tagline2 = '这是 ZonKey 一直不变的底线'
    remember('它是谁', '先认识一下 ZonKey', desc, tagline, tagline2,
             '文件永不上传，断网也能用', '免费无广告，不注册不登录',
             '杀手锏「智能脱敏」：图纸 / 公文敏感词自动识别抹除，输出副本原件不动（桌面版独有）')
    d = ImageDraw.Draw(im, 'RGBA')
    pill(d, 90, 110, '它是谁', (255, 230, 109, 90), 30)
    d = ImageDraw.Draw(im, 'RGBA')
    d.text((90, 210), '先认识一下 ZonKey', font=lfont(80), fill=INK)
    card(im, (90, 350, W - 90, 590), r=28)
    d = ImageDraw.Draw(im, 'RGBA')
    draw_lines(d, (140, 402), wrap(d, desc, lfont(33, False), W - 320), lfont(33, False), INK, gap=12)
    centers = ['智能脱敏', 'PDF 工坊', 'PPT', '图像', '音视频', '文本', '计算开发', '系统硬件']
    cols = [(78, 205, 196, 60), (255, 107, 107, 38), (255, 230, 109, 90), (69, 183, 209, 45),
            (167, 139, 250, 50), (150, 230, 161, 60), (255, 169, 77, 55), (255, 159, 243, 50)]
    remember(*centers)
    cw = (W - 180 - 3 * 18) / 4
    for i, (t, c) in enumerate(zip(centers, cols)):
        r_, c_ = divmod(i, 4)
        pill(d, 90 + c_ * (cw + 18), 640 + r_ * 96, t, c, 29, h=76, padx=10)
        d = ImageDraw.Draw(im, 'RGBA')
    card(im, (90, 880, W - 90, 1300), r=28)
    feats = [
        ('文件永不上传，断网也能用', TEAL),
        ('免费无广告，不注册不登录', CORAL),
        ('杀手锏「智能脱敏」：图纸 / 公文敏感词自动识别抹除，输出副本原件不动（桌面版独有）', YELLOW),
    ]
    fy = 940
    for text, col in feats:
        d = ImageDraw.Draw(im, 'RGBA')
        d.ellipse([140, fy + 14, 168, fy + 42], fill=col)
        fl = wrap(d, text, lfont(32, False), W - 360)
        draw_lines(d, (196, fy), fl, lfont(32, False), INK, gap=10)
        fy += 60 * len(fl) + 36
    card(im, (90, 1330, W - 90, 1470), r=28)
    d = ImageDraw.Draw(im, 'RGBA')
    d.text((W / 2, 1376), tagline, font=lfont(31), fill=INK, anchor='ma')
    d.text((W / 2, 1426), tagline2, font=lfont(26, False), fill=GRAY, anchor='ma')
    hint(im, '左滑 · 看怎么用上')
    page_dots(im, 2)
    im.convert('RGB').save(OUT / 'xhs-03.png')
    print(f'  xhs-03 feats_end={fy}')


def xhs04():
    W, H = 1242, 1656
    im = gradient(W, H)
    deco(im)
    remember('ZONKEY', '本地离线日用百宝箱', '怎么用上 ZonKey', '网页版',
             '浏览器打开就能用', '手机 / 电脑 / 平板通用 · 无需安装',
             '纯前端小工具浏览器本地直跑，断网可用', '桌面版', 'Windows / macOS 双端安装包与便携版',
             '智能脱敏引擎 / OCR 导出 / 证书签名', '安装版', '便携版',
             '搜索 ZonKey 就能找到', '免费开源 · 无广告 · 不注册不登录')
    crown(im, (W // 2, 206), 112)
    d = ImageDraw.Draw(im, 'RGBA')
    d.text((W / 2, 288), 'ZONKEY', font=lfont(84), fill=INK, anchor='ma')
    d.text((W / 2, 396), '本地离线日用百宝箱', font=lfont(32, False), fill=GRAY, anchor='ma')

    lab = '怎么用上 ZonKey'
    lw = pill_w(d, lab, 34)
    pill(d, (W - lw) / 2, 470, lab, (78, 205, 196, 55), 34)

    # 网页版卡
    card(im, (90, 580, W - 90, 950), r=30)
    d = ImageDraw.Draw(im, 'RGBA')
    pill(d, 150, 636, '网页版', (78, 205, 196, 60), 34)
    d = ImageDraw.Draw(im, 'RGBA')
    draw_lines(d, (152, 742), ['浏览器打开就能用'], lfont(34, False), INK, gap=10)
    g1 = wrap(d, '手机 / 电脑 / 平板通用 · 无需安装', lfont(30, False), 560)
    g2 = wrap(d, '纯前端小工具浏览器本地直跑，断网可用', lfont(30, False), 560)
    assert len(g1) == 1 and len(g2) == 1, (g1, g2)
    draw_lines(d, (152, 812), g1, lfont(30, False), GRAY, gap=8)
    draw_lines(d, (152, 856), g2, lfont(30, False), GRAY, gap=8)
    # 桌面版卡
    card(im, (90, 986, W - 90, 1336), r=30)
    d = ImageDraw.Draw(im, 'RGBA')
    pill(d, 150, 1042, '桌面版', (255, 230, 109, 90), 34)
    d = ImageDraw.Draw(im, 'RGBA')
    draw_lines(d, (152, 1148), ['Windows / macOS 双端安装包与便携版'], lfont(32, False), INK, gap=10)
    draw_lines(d, (152, 1214), ['智能脱敏引擎 / OCR 导出 / 证书签名'], lfont(32, False), GRAY, gap=10)
    pw = [pill_w(d, t, 26) for t in ('安装版', '便携版')]
    px = 152
    for t, w_ in zip(('安装版', '便携版'), pw):
        pill(d, px, 1266, t, (245, 246, 250, 255), 26)
        d = ImageDraw.Draw(im, 'RGBA')
        px += w_ + 16

    d = ImageDraw.Draw(im, 'RGBA')
    d.text((W / 2, 1430), '搜索 ZonKey 就能找到', font=lfont(34), fill=INK, anchor='ma')
    d.text((W / 2, 1510), '免费开源 · 无广告 · 不注册不登录', font=lfont(27, False), fill=GRAY, anchor='ma')
    im.convert('RGB').save(OUT / 'xhs-04.png')


if __name__ == '__main__':
    OUT.mkdir(parents=True, exist_ok=True)
    check_clean(*ALL_TEXTS)  # 先清空：随画卡边画边收集
    xhs01()
    xhs02()
    xhs03()
    xhs04()
    check_clean(*ALL_TEXTS)
    print('xhs round-31 ->', OUT)
    for p in sorted(OUT.glob('*.png')):
        print(' ', p.name, Image.open(p).size)
