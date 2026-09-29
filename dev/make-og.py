"""生成社交分享卡片（og:image）

分享到微信 / 小红书 / 微博 时显示的缩略图。1200x630 是各平台通用比例。
改了品牌标语后重跑本脚本即可。

用法：python dev/make-og.py
"""

import os
from PIL import Image, ImageDraw, ImageFilter, ImageFont

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(BASE, "assets", "og-cover.png")

W, H = 1200, 630
BG = (4, 5, 10)

CYAN = (34, 211, 238)
VIOLET = (139, 92, 246)
WHITE = (255, 255, 255)
MUTED = (148, 163, 184)

FONT_BOLD = "C:/Windows/Fonts/msyhbd.ttc"
FONT_REG = "C:/Windows/Fonts/msyh.ttc"
FONT_MONO = "C:/Windows/Fonts/consola.ttf"


def font(path, size):
    try:
        return ImageFont.truetype(path, size)
    except OSError:
        return ImageFont.load_default()


def radial_glow(size, cx, cy, radius, color, peak_alpha):
    """用同心圆 + 高斯模糊模拟径向光晕。"""
    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    steps = 60
    for i in range(steps, 0, -1):
        r = int(radius * i / steps)
        a = int(peak_alpha * (1 - i / steps) ** 1.6)
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=color + (a,))
    return layer.filter(ImageFilter.GaussianBlur(radius * 0.28))


def linear_gradient(size, c1, c2, horizontal=True):
    grad = Image.new("RGB", size)
    d = ImageDraw.Draw(grad)
    n = size[0] if horizontal else size[1]
    for i in range(n):
        t = i / max(1, n - 1)
        col = tuple(int(c1[k] + (c2[k] - c1[k]) * t) for k in range(3))
        if horizontal:
            d.line([(i, 0), (i, size[1])], fill=col)
        else:
            d.line([(0, i), (size[0], i)], fill=col)
    return grad


def gradient_text(base, xy, text, fnt, c1, c2):
    """把渐变透过文字遮罩贴上去。

    渐变宽度只覆盖文字本身——若铺满整图，文字所在位置的颜色早已褪淡，
    看起来会发灰发白。
    """
    mask = Image.new("L", base.size, 0)
    ImageDraw.Draw(mask).text(xy, text, font=fnt, fill=255)
    bbox = mask.getbbox()
    if not bbox:
        return
    x1, x2 = bbox[0], bbox[2]
    grad = linear_gradient((max(1, x2 - x1), base.size[1]), c1, c2)
    layer = Image.new("RGB", base.size, (0, 0, 0))
    layer.paste(grad, (x1, 0))
    base.paste(layer, (0, 0), mask)


def main():
    img = Image.new("RGB", (W, H), BG)

    # 1) 两团光晕
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    glow = Image.alpha_composite(glow, radial_glow((W, H), 120, -60, 620, CYAN, 62))
    glow = Image.alpha_composite(glow, radial_glow((W, H), 1080, 40, 560, VIOLET, 58))
    glow = Image.alpha_composite(glow, radial_glow((W, H), 620, 700, 560, (16, 185, 129), 26))
    img = Image.alpha_composite(img.convert("RGBA"), glow).convert("RGB")

    # 2) 极淡网格
    grid = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(grid)
    for x in range(0, W, 60):
        gd.line([(x, 0), (x, H)], fill=(255, 255, 255, 8))
    for y in range(0, H, 60):
        gd.line([(0, y), (W, y)], fill=(255, 255, 255, 8))
    img = Image.alpha_composite(img.convert("RGBA"), grid).convert("RGB")

    d = ImageDraw.Draw(img)

    # 3) 左上角 logo
    chip = linear_gradient((64, 64), (103, 232, 249), (167, 139, 250))
    chip_mask = Image.new("L", (64, 64), 0)
    ImageDraw.Draw(chip_mask).rounded_rectangle([0, 0, 63, 63], radius=18, fill=255)
    img.paste(chip, (80, 72), chip_mask)

    f_logo = font(FONT_MONO, 30)
    bbox = d.textbbox((0, 0), "</>", font=f_logo)
    d.text((80 + (64 - (bbox[2] - bbox[0])) / 2 - bbox[0],
            72 + (64 - (bbox[3] - bbox[1])) / 2 - bbox[1]),
           "</>", font=f_logo, fill=(4, 5, 10))

    d.text((164, 82), "STACKTOP", font=font(FONT_MONO, 27), fill=WHITE)
    d.text((164, 114), "栈顶工作室", font=font(FONT_REG, 19), fill=MUTED)

    # 4) 主标题
    f_h1 = font(FONT_BOLD, 62)
    d.text((80, 210), "把你的数字化想法", font=f_h1, fill=WHITE)

    y2 = 292
    x = 80
    d.text((x, y2), "最快 ", font=f_h1, fill=WHITE)
    x += d.textlength("最快 ", font=f_h1)
    gradient_text(img, (int(x), y2), "7 天", f_h1, (103, 232, 249), (167, 139, 250))
    x += d.textlength("7 天", font=f_h1)
    d.text((x, y2), "变成", font=f_h1, fill=WHITE)

    gradient_text(img, (80, 374), "可上线产品", f_h1, (103, 232, 249), (167, 139, 250))

    # 5) 分隔线 + 信任标签
    #    必须画在 RGBA 覆盖层上——直接画在 RGB 图上时 alpha 会被忽略，半透明色会变成实心白块
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)

    od.line([(80, 486), (1120, 486)], fill=(255, 255, 255, 46), width=1)

    f_small = font(FONT_REG, 23)
    tags = ["独立全栈开发", "100% 源码交付", "拒绝二次加价", "一对一售后"]
    tx = 80
    for t in tags:
        tw = od.textlength(t, font=f_small)
        od.rounded_rectangle([tx, 518, tx + tw + 34, 566], radius=24,
                             fill=(255, 255, 255, 22), outline=(255, 255, 255, 64), width=1)
        od.text((tx + 17, 528), t, font=f_small, fill=(226, 232, 240, 255))
        tx += tw + 34 + 14

    f_url = font(FONT_MONO, 22)
    od.text((1120 - od.textlength("stacktop.pages.dev", font=f_url), 532),
            "stacktop.pages.dev", font=f_url, fill=(125, 142, 165, 255))

    img = Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB")

    img.save(OUT, "PNG", optimize=True)
    print("已生成: %s  %dx%d  %.0f KB" % (OUT, W, H, os.path.getsize(OUT) / 1024))


if __name__ == "__main__":
    main()
