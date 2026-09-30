"""生成案例封面图（设备框样式）

为什么不用原始截图直接当封面：
  截图宽度 1200px，缩到卡片里只有 400px 左右，密集表格会糊成一团色块，
  而且脱敏的模糊条会直接暴露在外，观感很差。
  这里把截图装进「浏览器窗口 / 手机」框里，配上品牌底色与光晕，
  既统一了视觉与比例，也让截图变成「作品」而不是「截图」。

用法：python dev/make-case-covers.py
"""

import os

from PIL import Image, ImageDraw, ImageFilter, ImageFont

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(BASE, "dev", "cases-clean")    # 无角标的脱敏截图（由 redact-cases.py 生成）
OUT = os.path.join(BASE, "assets", "cases")       # 封面输出（会部署）

W, H = 1200, 750
S = 2                       # 超采样倍数，缩回去时圆角/描边才平滑
BG = (4, 5, 10)

CYAN = (34, 211, 238)
VIOLET = (139, 92, 246)
PINK = (244, 114, 182)

FONT_MONO = "C:/Windows/Fonts/consola.ttf"
FONT_REG = "C:/Windows/Fonts/msyh.ttc"


def px(v):
    return int(round(v * S))


def font(path, size):
    try:
        return ImageFont.truetype(path, px(size))
    except OSError:
        return ImageFont.load_default()


def radial_glow(size, cx, cy, radius, color, peak_alpha):
    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    steps = 70
    for i in range(steps, 0, -1):
        r = int(radius * i / steps)
        a = int(peak_alpha * (1 - i / steps) ** 1.7)
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=color + (a,))
    return layer.filter(ImageFilter.GaussianBlur(radius * 0.3))


def background(glows):
    """深色底 + 光晕 + 极淡网格。glows: [(cx, cy, radius, color, alpha), ...]"""
    img = Image.new("RGBA", (px(W), px(H)), BG + (255,))
    for (cx, cy, r, c, a) in glows:
        img = Image.alpha_composite(img, radial_glow((px(W), px(H)), px(cx), px(cy), px(r), c, a))

    grid = Image.new("RGBA", (px(W), px(H)), (0, 0, 0, 0))
    gd = ImageDraw.Draw(grid)
    for x in range(0, px(W), px(60)):
        gd.line([(x, 0), (x, px(H))], fill=(255, 255, 255, 9))
    for y in range(0, px(H), px(60)):
        gd.line([(0, y), (px(W), y)], fill=(255, 255, 255, 9))
    return Image.alpha_composite(img, grid)


def rounded_mask(size, box, radius):
    m = Image.new("L", size, 0)
    ImageDraw.Draw(m).rounded_rectangle(box, radius=radius, fill=255)
    return m


def drop_shadow(canvas, box, radius, blur, alpha):
    sh = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(sh)
    d.rounded_rectangle([box[0], box[1] + px(22), box[2], box[3] + px(22)],
                        radius=radius, fill=(0, 0, 0, alpha))
    sh = sh.filter(ImageFilter.GaussianBlur(px(blur)))
    return Image.alpha_composite(canvas, sh)


def fit(img, w, h):
    """等比缩放到填满 w×h，然后居中裁切。"""
    r = max(w / img.width, h / img.height)
    nw, nh = int(img.width * r), int(img.height * r)
    img = img.resize((nw, nh), Image.LANCZOS)
    return img.crop(((nw - w) // 2, (nh - h) // 2, (nw - w) // 2 + w, (nh - h) // 2 + h))


def add_badge(img):
    """右下角加「数据已脱敏」角标。必须画在 RGBA 覆盖层上，否则 alpha 会被忽略。"""
    d = ImageDraw.Draw(img, "RGBA")
    text = "数据已脱敏"
    try:
        f = ImageFont.truetype(FONT_REG, 13)
    except OSError:
        f = ImageFont.load_default()
    bbox = d.textbbox((0, 0), text, font=f)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    pad = 7
    x2, y2 = img.width - 14, img.height - 14
    x1, y1 = x2 - tw - pad * 2, y2 - th - pad * 2
    d.rounded_rectangle([x1, y1, x2, y2], radius=6, fill=(0, 0, 0, 155))
    d.text((x1 + pad, y1 + pad - 1), text, font=f, fill=(255, 255, 255, 240))
    return img


def finish(canvas, dst):
    out = canvas.convert("RGB").resize((W, H), Image.LANCZOS)
    out = add_badge(out)
    out.save(dst, "PNG", optimize=True)
    print("  %-34s %dx%d  %.0f KB" % (os.path.basename(dst), W, H, os.path.getsize(dst) / 1024))


def desktop_cover(src, dst, title, glows):
    shot = Image.open(src).convert("RGB")

    mx = 58
    fw = W - mx * 2
    chrome = 46
    fh = chrome + int(fw * shot.height / shot.width)
    fx, fy = mx, (H - fh) // 2

    box = [px(fx), px(fy), px(fx + fw), px(fy + fh)]
    canvas = background(glows)
    canvas = drop_shadow(canvas, box, px(16), 26, 190)

    frame_mask = rounded_mask(canvas.size, box, px(16))

    # 窗口底色
    body = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    ImageDraw.Draw(body).rounded_rectangle(box, radius=px(16), fill=(11, 13, 22, 255))
    canvas = Image.alpha_composite(canvas, Image.composite(body, Image.new("RGBA", canvas.size, (0, 0, 0, 0)), frame_mask))

    # 标题栏
    bar = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    bd = ImageDraw.Draw(bar)
    bd.rounded_rectangle([box[0], box[1], box[2], box[1] + px(chrome)], radius=px(16), fill=(16, 19, 32, 255))
    bd.rectangle([box[0], box[1] + px(chrome) - px(16), box[2], box[1] + px(chrome)], fill=(16, 19, 32, 255))
    bd.line([(box[0], box[1] + px(chrome)), (box[2], box[1] + px(chrome))], fill=(255, 255, 255, 26), width=px(1))
    canvas = Image.alpha_composite(canvas, bar)

    d = ImageDraw.Draw(canvas)
    # 三个圆点
    for i, c in enumerate([(255, 95, 87), (254, 188, 46), (40, 200, 64)]):
        cx = box[0] + px(28 + i * 24)
        cy = box[1] + px(chrome / 2)
        d.ellipse([cx - px(6.5), cy - px(6.5), cx + px(6.5), cy + px(6.5)], fill=c + (185,))

    # 地址栏胶囊
    pw, ph = px(300), px(26)
    pxx = box[0] + (box[2] - box[0] - pw) // 2
    pyy = box[1] + (px(chrome) - ph) // 2
    d.rounded_rectangle([pxx, pyy, pxx + pw, pyy + ph], radius=ph // 2, fill=(255, 255, 255, 20))
    f_lbl = font(FONT_REG, 13)
    tb = d.textbbox((0, 0), title, font=f_lbl)
    d.text((pxx + (pw - (tb[2] - tb[0])) / 2 - tb[0], pyy + (ph - (tb[3] - tb[1])) / 2 - tb[1]),
           title, font=f_lbl, fill=(130, 146, 170, 255))

    # 截图
    cw, ch = box[2] - box[0], box[3] - (box[1] + px(chrome))
    shot = fit(shot, cw, ch)
    canvas.paste(shot, (box[0], box[1] + px(chrome)), frame_mask.crop(
        (box[0], box[1] + px(chrome), box[2], box[3])))

    # 外描边
    edge = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    ImageDraw.Draw(edge).rounded_rectangle(box, radius=px(16), outline=(255, 255, 255, 38), width=px(1.4))
    canvas = Image.alpha_composite(canvas, edge)

    finish(canvas, dst)


def mobile_cover(src, dst, glows):
    shot = Image.open(src).convert("RGB")

    ph_h = 664
    ph_w = int(ph_h * shot.width / shot.height)
    px0, py0 = (W - ph_w) // 2, (H - ph_h) // 2

    box = [px(px0), px(py0), px(px0 + ph_w), px(py0 + ph_h)]
    canvas = background(glows)
    canvas = drop_shadow(canvas, box, px(44), 30, 200)

    frame_mask = rounded_mask(canvas.size, box, px(44))

    body = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    ImageDraw.Draw(body).rounded_rectangle(box, radius=px(44), fill=(11, 13, 22, 255))
    canvas = Image.alpha_composite(canvas, Image.composite(body, Image.new("RGBA", canvas.size, (0, 0, 0, 0)), frame_mask))

    inset = px(9)
    inner = [box[0] + inset, box[1] + inset, box[2] - inset, box[3] - inset]
    inner_mask = rounded_mask(canvas.size, inner, px(36))

    cw, ch = inner[2] - inner[0], inner[3] - inner[1]
    shot = fit(shot, cw, ch)
    canvas.paste(shot, (inner[0], inner[1]), inner_mask.crop(tuple(inner)))

    edge = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    ImageDraw.Draw(edge).rounded_rectangle(box, radius=px(44), outline=(255, 255, 255, 44), width=px(1.4))
    canvas = Image.alpha_composite(canvas, edge)

    finish(canvas, dst)


if __name__ == "__main__":
    print("生成案例封面：")
    desktop_cover(
        os.path.join(SRC, "stock-workbench-dark.png"),
        os.path.join(OUT, "cover-stock-workbench.png"),
        "A股全流程复盘工作台",
        [(230, 60, 660, CYAN, 58), (1030, 110, 620, VIOLET, 54)],
    )
    mobile_cover(
        os.path.join(SRC, "didicheck-mobile.png"),
        os.path.join(OUT, "cover-income-tracker.png"),
        [(300, 120, 620, PINK, 52), (980, 560, 600, VIOLET, 50)],
    )
    print("\n完成。封面用于案例卡片，原脱敏截图仍用于弹窗大图。")
