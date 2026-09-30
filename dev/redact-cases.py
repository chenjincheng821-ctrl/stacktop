"""案例截图脱敏：模糊个股名称/代码列与个人收益数字，保留整体结构与图表。

坐标以 1080x585（图 1/2）或 367x786（图 3）的预览尺寸为基准定义，
脚本内部按实际尺寸等比缩放，便于对照预览图调整。
"""

import os

from PIL import Image, ImageFilter, ImageDraw, ImageFont

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # 项目根目录
OUT = os.path.join(BASE, "assets", "cases")          # 脱敏后的图（会部署，带角标，供弹窗大图用）
RAW = os.path.join(BASE, "dev", "cases-raw")         # 原始截图（已 gitignore）
CLEAN = os.path.join(BASE, "dev", "cases-clean")     # 无角标版（供封面脚本用，已 gitignore）

# ── 图 1：A股看盘工作台（深色）────────────────────────────────────────
# 坐标以原图 1912x962 为基准（用 _grid.png 校准得出）
# 只模糊「名称列 / 领涨股列」，标题、表头、涨幅、成交额、图表全部保留
DARK_REF = (1912, 962)
# 三列卡片的垂直位置并不一致（右列表格比左列高约 20px，且多一列股票代码），
# 逐列抠坐标已失败三次。改为整片模糊：顶部导航与底部图表保持清晰，中间全部遮蔽。
# 牺牲一点信息密度，换取零遗漏——个股名一旦泄露就是合规问题。
DARK_REGIONS = [
    (0, 120, 1912, 604),
]

# ── 图 2：A股收盘复盘工作台（浅色）────────────────────────────────────
# 坐标以原图 1912x962 为基准。只模糊 4 张资讯卡的正文（内含个股名称），
# 保留标题、标签、统计数字与整体布局
LIGHT_REF = (1912, 962)
# 主内容区在 x≈455 之后（左侧是双列导航）。卡片正文含个股名称与数据源，
# 用两块大区域整片覆盖，避免逐卡片抠坐标出错。
LIGHT_REGIONS = [
    (280, 378, 1012, 412),   # 「本次实际来源」行（含数据源名称）
    (452, 626, 1052, 962),   # 左卡片列全部内容
    (1052, 626, 1768, 962),  # 右卡片列全部内容
]

# ── 图 3：嘀嘀打卡（移动端）──────────────────────────────────────────
# 坐标以原图 367x786 为基准。模糊个人收益数字，保留界面结构与平台名
MOBILE_REF = (367, 786)
MOBILE_REGIONS = [
    (26, 146, 343, 234),     # 9月整月 汇总卡（总收入/支出/净收入/提现）
    (26, 236, 343, 290),     # 当日汇总数字行
    (26, 334, 343, 362),     # 我的手机 汇总条
    (118, 360, 343, 472),    # 台子明细 数字列（累计现金等）
]


def blur_regions(img, ref_size, regions, radius):
    """按参考尺寸定义的矩形，等比映射到实际尺寸后做高斯模糊。"""
    for box in _boxes(img, ref_size, regions):
        img.paste(img.crop(box).filter(ImageFilter.GaussianBlur(radius)), box)
    return img


def pixelate_regions(img, ref_size, regions, block):
    """马赛克遮蔽。

    大块高斯模糊看起来像「图片糊了」，马赛克则是通用的「刻意遮蔽」视觉语言，
    观感更专业。block 为马赛克方块边长（原图像素）。
    """
    for box in _boxes(img, ref_size, regions):
        w, h = box[2] - box[0], box[3] - box[1]
        small = img.crop(box).resize((max(1, w // block), max(1, h // block)), Image.BILINEAR)
        img.paste(small.resize((w, h), Image.NEAREST), box)
    return img


def _boxes(img, ref_size, regions):
    sx = img.width / ref_size[0]
    sy = img.height / ref_size[1]
    out = []
    for (x1, y1, x2, y2) in regions:
        b = (max(0, int(x1 * sx)), max(0, int(y1 * sy)),
             min(img.width, int(x2 * sx)), min(img.height, int(y2 * sy)))
        if b[2] > b[0] and b[3] > b[1]:
            out.append(b)
    return out


def add_badge(img):
    """右下角加「数据已脱敏」角标。"""
    d = ImageDraw.Draw(img, "RGBA")
    text = "数据已脱敏"
    try:
        font = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 13)
    except OSError:
        font = ImageFont.load_default()

    bbox = d.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    pad = 7
    x2, y2 = img.width - 12, img.height - 12
    x1, y1 = x2 - tw - pad * 2, y2 - th - pad * 2
    d.rounded_rectangle([x1, y1, x2, y2], radius=6, fill=(0, 0, 0, 150))
    d.text((x1 + pad, y1 + pad - 1), text, font=font, fill=(255, 255, 255, 235))
    return img


def process(src, dst, ref_size, regions, out_width, radius=9, mode="blur", block=14):
    img = Image.open(os.path.join(RAW, src)).convert("RGB")
    if mode == "pixelate":
        pixelate_regions(img, ref_size, regions, block)
    else:
        blur_regions(img, ref_size, regions, radius)
    ratio = out_width / img.width
    img = img.resize((out_width, int(img.height * ratio)), Image.LANCZOS)

    # 先存一份无角标的干净版给封面脚本（角标要打在封面上，不能跟着截图跑进设备框）
    os.makedirs(CLEAN, exist_ok=True)
    img.save(os.path.join(CLEAN, dst), "PNG", optimize=True)

    # 再存带角标的版本给弹窗大图
    add_badge(img)
    img.save(os.path.join(OUT, dst), "PNG", optimize=True)
    print("  %-22s -> %-22s %dx%d  %.0f KB" % (
        src, dst, img.width, img.height,
        os.path.getsize(os.path.join(OUT, dst)) / 1024))


if __name__ == "__main__":
    print("生成脱敏后的案例图：")
    process("_raw-stock-dark.png", "stock-workbench-dark.png", DARK_REF, DARK_REGIONS, 1200,
            mode="pixelate", block=15)
    process("_raw-stock-light.png", "stock-workbench-light.png", LIGHT_REF, LIGHT_REGIONS, 1200,
            mode="pixelate", block=16)
    process("_raw-checkin.png", "didicheck-mobile.png", MOBILE_REF, MOBILE_REGIONS, 367, radius=7)
    print("\n完成。检查 assets/cases/ 下的输出图。")
