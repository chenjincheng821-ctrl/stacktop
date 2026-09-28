"""二维码图片规整工具

微信导出的二维码图片通常带一大圈灰底空白、且不是正方形，直接放进网页会被拉变形
（QR 拉变形可能导致扫不出来）。这个脚本会自动找出二维码区域、裁成正方形、补白边、
输出纯白底的 PNG。

用法：
    python dev/fix-qr.py <源图片路径> [输出路径]

示例：
    python dev/fix-qr.py "C:/Users/xxx/Desktop/我的二维码.jpg"
    python dev/fix-qr.py "C:/Users/xxx/Desktop/我的二维码.jpg" assets/wechat-qr.png

依赖 Pillow：
    C:/Users/<你>/.workbuddy-ai/binaries/python/envs/default/Scripts/python.exe -m pip install pillow
"""

import os
import sys

from PIL import Image

DEFAULT_OUT = os.path.join(os.path.dirname(__file__), "..", "assets", "wechat-qr.png")
OUT_SIZE = 600
THRESHOLD = 200


def fix(src, dst):
    im = Image.open(src).convert("L")
    w, h = im.size
    print("原始尺寸: %d x %d  宽高比 %.2f" % (w, h, w / h))

    bbox = im.point(lambda v: 255 if v < THRESHOLD else 0).getbbox()
    if not bbox:
        raise SystemExit("没找到二维码区域，检查一下图片是不是纯白或者路径传错了")

    x0, y0, x1, y1 = bbox
    qr_w, qr_h = x1 - x0, y1 - y0
    ratio = qr_w / qr_h
    print("二维码区域: %dx%d  位置 (%d,%d)-(%d,%d)" % (qr_w, qr_h, x0, y0, x1, y1))
    print("区域宽高比 %.3f %s" % (ratio, "（正方形，正常）" if abs(ratio - 1) < 0.06 else "（非正方形，需人工检查）"))

    side = max(qr_w, qr_h)
    quiet = int(side * 0.09)
    print("四周静区: %d px (约占 %.0f%%)" % (quiet, quiet / side * 100))

    cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
    half = side // 2 + quiet

    canvas = Image.new("L", (half * 2, half * 2), 255)
    crop = im.crop((max(0, cx - half), max(0, cy - half),
                    min(w, cx + half), min(h, cy + half)))
    canvas.paste(crop, (max(0, half - cx), max(0, half - cy)))

    clean = canvas.point(lambda v: 255 if v > THRESHOLD else v)
    final = clean.resize((OUT_SIZE, OUT_SIZE), Image.LANCZOS).point(lambda v: 255 if v > 235 else v)

    os.makedirs(os.path.dirname(os.path.abspath(dst)), exist_ok=True)
    final.save(dst, "PNG", optimize=True)

    print("输出: %s" % os.path.abspath(dst))
    print("尺寸: %d x %d  文件: %.1f KB" % (OUT_SIZE, OUT_SIZE, os.path.getsize(dst) / 1024))
    print("\n记得确认 config.js 里 contact.wechatQr 指向这个文件。")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        raise SystemExit(1)
    fix(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else DEFAULT_OUT)
