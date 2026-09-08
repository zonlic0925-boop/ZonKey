# -*- coding: utf-8 -*-
"""小红书物料 · 三功能真实体验轮（round-33，2026-09-08）——真实操作截屏组版。

本轮一张笔记讲三个功能（PDF 合并 / 房贷计算 / 二维码生成），素材全部来自
docs/screenshots/round33/raw/（Playwright 实拍当前版 UI：真文件、真数值、
真产物；房贷数字与二维码解码均经程序核验），非示意图。

红线（同 r31/r32 一体适用）：图卡零站外导流信息——无网址/域名/二维码外链/
GitHub/Gitee/微信/QQ/邮箱/手机号/「评论区自取」等句式。二维码功能演示卡中的
码内容是纯文字备忘（非链接、无外部信息）。生成时内置 BANNED 校验，命中即拒绝出图。

输出：docs/screenshots/round33/xhs/r33-01~08.png  1242×1656 (3:4)
运行：python scripts/gen_xhs_r33.py
"""
import re
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / 'docs' / 'screenshots' / 'round33' / 'raw'
OUT = ROOT / 'docs' / 'screenshots' / 'round33' / 'xhs'
OUT.mkdir(parents=True, exist_ok=True)

W, H = 1242, 1656
PAD = 40
SHOT_W = W - PAD * 2
INK = (26, 26, 46, 255)
GRAY = (108, 112, 128, 255)
WHITE = (255, 255, 255, 255)
CORAL = (255, 107, 107, 255)
SOFT = (255, 244, 240, 255)
DOT_OFF = (222, 226, 234, 255)

F_BOLD = 'C:/Windows/Fonts/msyhbd.ttc'
F_REG = 'C:/Windows/Fonts/msyh.ttc'

# 工具名词本身（PDF 合并 / 二维码生成）允许；外链渠道与引流句式一律禁
BANNED = [
    'http', 'www.', '.dev', '.com', '.cn', '.net', 'github', 'gitee',
    'release', '扫码', '扫一扫', '私信', '微信', 'qq', '邮箱', '手机号',
    '加v', '进群', '扣1', '评论区自取', '主页自取', '直达', '点链接',
    '域名', '链接地址', '下载地址',
]
BANNED_RE = re.compile('|'.join(re.escape(b) for b in BANNED), re.IGNORECASE)
URLISH = re.compile(r'[a-z0-9][a-z0-9-]{1,}\.[a-z]{2,}', re.IGNORECASE)


def lfont(sz, bold=True):
    return ImageFont.truetype(F_BOLD if bold else F_REG, sz)


def check_clean(*texts):
    bad = [t for t in texts if BANNED_RE.search(t)]
    bad += [t for t in texts if URLISH.search(t)]
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


def chip(base, y, text, x_center, fsize=26, fill=CORAL, text_fill=WHITE):
    f = lfont(fsize, True)
    d0 = ImageDraw.Draw(Image.new('RGB', (4, 4)))
    tw = d0.textlength(text, font=f)
    pad_x, pad_y = 22, 12
    cw = int(tw) + pad_x * 2
    ch = fsize + pad_y * 2
    x0 = int(x_center - cw / 2)
    rrect(base, [x0, y, x0 + cw, y + ch], ch // 2, fill)
    d = ImageDraw.Draw(base)
    d.text((x0 + pad_x, y + pad_y), text, font=f, fill=text_fill)
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
    f = lfont(22, False)
    hint = '左滑看完整体验'
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
    page_dots(base, 8, dots)
    base.save(OUT / f'r33-{idx:02d}.png')
    print('wrote r33-%02d.png (%s)' % (idx, shot_name))


def frame_tips(idx):
    """结尾帧：三个真实小提醒（无截图）。"""
    title = ['三个真实小提醒']
    tips = [
        ('①', '合并 PDF：输出顺序 = 文件列表顺序，先排好再点合并'),
        ('②', '房贷：年限和还款方式都算一遍，数字对比才直观'),
        ('③', '二维码：别把身份证号这类隐私写进去，谁扫都能看到'),
    ]
    check_clean(*title, *[t for _, t in tips])
    base = Image.new('RGB', (W, H), WHITE)
    rrect(base, [70, 240, W - 70, 880], 36, SOFT)
    text_block(base, 300, title, 52, 72, INK)
    y = 460
    d = ImageDraw.Draw(base)
    f = lfont(30, True)
    for no, tip in tips:
        rrect(base, [70 + 46, y + 8, 70 + 46 + 26, y + 8 + 26], 7, CORAL)
        d.text((70 + 46, y), no, font=lfont(22, True), fill=WHITE)
        d.text((70 + 120, y + 2), tip, font=lfont(30, False), fill=INK)
        y += 96
    y += 30
    f = lfont(26, False)
    d.text((70 + 46, y), '以上全部来自 ZonKey · 本地离线小工具', font=f, fill=GRAY)
    page_dots(base, 8, 7)
    base.save(OUT / 'r33-08.png')
    print('wrote r33-08.png (tips)')


def frame_cover():
    check_clean('PDF 合并', '房贷计算', '二维码生成')
    base = Image.new('RGB', (W, H), WHITE)
    text_block(base, 170, ['3 件小事，', '一个本地工具箱搞定'], 72, 100, INK)
    y = text_block(base, 400, ['PDF 合并 · 房贷计算 · 二维码', '亲测真实 · 全部本地离线'], 28, 44, GRAY, bold=False)
    # 关键词胶囊（精确测宽居中）
    cx = W // 2
    chips = ['PDF 合并', '房贷计算', '二维码生成']
    f = lfont(25, True)
    d0 = ImageDraw.Draw(Image.new('RGB', (4, 4)))
    cws = [int(d0.textlength(t, font=f)) + 44 for t in chips]
    total_w = sum(cws) + 26 * (len(chips) - 1)
    x = cx - total_w // 2
    chh = 25 + 22
    for t, cw in zip(chips, cws):
        rrect(base, [x, y + 26, x + cw, y + 26 + chh], chh // 2, CORAL)
        d = ImageDraw.Draw(base)
        d.text((x + 22, y + 26 + 11), t, font=f, fill=WHITE)
        x += cw + 26
    # 底部主视觉：合并列表真实界面
    paste_shot(base, RAW / 'merge-02_files_added.png', 640, 1520)
    page_dots(base, 8, 0)
    base.save(OUT / 'r33-01.png')
    print('wrote r33-01.png (cover)')


if __name__ == '__main__':
    # 封面 + 7 帧（顺序即笔记图序）
    frame_cover()
    frame_ui(2, '① PDF 合并', ['两份说明书', '合成一份 PDF'],
             ['两个 PDF 一起拖进去，按列表顺序合并', '原文件不动，输出「合并副本」'], 'merge-02_files_added.png', 1)
    frame_ui(3, '① PDF 合并', ['合并完成', '上篇 + 下篇 = 4 页'],
             ['顺序没乱，一次搞定', '打开就是完整版，需要时可下载'], 'merge-03_task_done.png', 2)
    frame_ui(4, '② 房贷计算', ['100 万 · 30 年', '月供 4,270 元'],
             ['按年利率 3.1% 等额本息算出来的', '总利息 53.7 万，心里有数了'], 'loan-02_result_30y.png', 3)
    frame_ui(5, '② 房贷计算', ['切「等额本金」', '总利息省 7.1 万'],
             ['两种还法对比：首月 5,361 vs 4,270', '买房前自己先算一遍，不被带节奏'], 'loan-04_result_principal.png', 4)
    frame_ui(6, '③ 二维码生成', ['把一段文字', '做成二维码'],
             ['文字、链接、Wi-Fi、名片都支持', '本地生成，不联网也能出码'], 'qr-01_content_typed.png', 5)
    frame_ui(7, '③ 二维码生成', ['生成完保存图片', '扫出来一字不差'],
             ['刚才那段文字解码完全一致', '存下来想贴哪贴哪'], 'qr-02_generated.png', 6)
    frame_tips(8)
    print('DONE: 8 cards in', OUT)
