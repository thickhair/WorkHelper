"""生成应用图标：绿色渐变圆角方块 + 白色对勾与星光。

输出：
- build/icon.png（512x512）
- build/icon.ico（包含 16~256 多尺寸，供 electron-builder 打包使用）
"""
import os
from PIL import Image, ImageDraw

SIZE = 512
SS = 4  # 超采样倍率，保证边缘平滑
S = SIZE * SS
TOP = (109, 190, 132)     # #6DBE84
BOTTOM = (54, 118, 74)    # #36764A


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def main():
    img = Image.new('RGBA', (S, S))
    px = img.load()
    for y in range(S):
        color = lerp(TOP, BOTTOM, y / (S - 1))
        for x in range(S):
            px[x, y] = (*color, 255)

    # 圆角遮罩
    mask = Image.new('L', (S, S), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * 0.23), fill=255)
    img.putalpha(mask)

    draw = ImageDraw.Draw(img)
    # 白色对勾
    draw.line(
        [(S * 0.30, S * 0.54), (S * 0.44, S * 0.68), (S * 0.72, S * 0.37)],
        fill=(255, 255, 255, 255),
        width=int(S * 0.078),
        joint='curve',
    )
    # 右上角四角星光
    cx, cy, r = S * 0.755, S * 0.25, S * 0.085
    draw.polygon(
        [(cx, cy - r), (cx + r * 0.26, cy - r * 0.26), (cx + r, cy),
         (cx + r * 0.26, cy + r * 0.26), (cx, cy + r), (cx - r * 0.26, cy + r * 0.26),
         (cx - r, cy), (cx - r * 0.26, cy - r * 0.26)],
        fill=(255, 255, 255, 235),
    )

    img = img.resize((SIZE, SIZE), Image.LANCZOS)
    out_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'build')
    os.makedirs(out_dir, exist_ok=True)
    img.save(os.path.join(out_dir, 'icon.png'))
    img.save(
        os.path.join(out_dir, 'icon.ico'),
        sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )
    print('ICON_OK ->', out_dir)


if __name__ == '__main__':
    main()