/**
 * 平台 Logo 图形库：以真实品牌 logo 为原型的自绘矢量图形（24×24 viewBox，离线可用）。
 * - 内容为 SVG 内部标记，默认以白色填充显示在品牌色徽章上；
 * - `{c}` 占位符在渲染时替换为平台品牌色，用于眼睛、音符孔等镂空细节；
 * - 未收录的平台（银行等）由 PlatformIcon 回退为品牌色徽章 + 字形，
 *   与真实银行 logo「品牌色 + 行名首字」的视觉识别一致。
 */
export const PLATFORM_LOGOS: Record<string, string> = {
  /** 微信支付：双聊天气泡（微信经典图形）+ 品牌色眼睛 */
  wechat: `
    <ellipse cx="9.3" cy="9.5" rx="7.3" ry="5.9"/>
    <polygon points="5.6,13.9 4.6,17.6 8.6,15.5"/>
    <ellipse cx="16.6" cy="14.9" rx="5.4" ry="4.5"/>
    <polygon points="19.9,18.1 20.7,21.2 17.6,19.6"/>
    <circle cx="6.8" cy="8.4" r="1.05" fill="{c}"/>
    <circle cx="11.8" cy="8.4" r="1.05" fill="{c}"/>
    <circle cx="14.8" cy="13.9" r="0.95" fill="{c}"/>
    <circle cx="18.4" cy="13.9" r="0.95" fill="{c}"/>
  `,
  /** 京东金融：吉祥物狗头（垂耳 + 圆脸 + 口鼻） */
  jd: `
    <polygon points="6.1,3.2 4.4,9.4 9.3,6.8"/>
    <polygon points="17.9,3.2 19.6,9.4 14.7,6.8"/>
    <ellipse cx="12" cy="13.7" rx="7.7" ry="7.1"/>
    <circle cx="9.2" cy="12.4" r="1.25" fill="{c}"/>
    <circle cx="14.8" cy="12.4" r="1.25" fill="{c}"/>
    <ellipse cx="12" cy="16.7" rx="1.8" ry="1.35" fill="{c}"/>
  `,
  /** 云闪付：银联三色斜带标志（白色三档透明度） */
  unionpay: `
    <g transform="translate(3.2 0) skewX(-16)">
      <rect x="4.6" y="4.2" width="3.6" height="15.6" rx="1.8"/>
      <rect x="10.2" y="4.2" width="3.6" height="15.6" rx="1.8" opacity="0.72"/>
      <rect x="15.8" y="4.2" width="3.6" height="15.6" rx="1.8" opacity="0.46"/>
    </g>
  `,
  /** 抖音：音符标志（符杆 + 顶部符旗 + 圆形符头镂空） */
  douyin: `
    <rect x="14.6" y="3" width="3.8" height="12.8" rx="1.9"/>
    <polygon points="14.6,3 21.4,5.3 21.4,9.3 14.6,7"/>
    <ellipse cx="12" cy="17.1" rx="4.6" ry="4"/>
    <ellipse cx="12" cy="17.1" rx="2" ry="1.65" fill="{c}"/>
  `
}