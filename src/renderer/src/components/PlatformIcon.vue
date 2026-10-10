<script setup lang="ts">
/**
 * 平台图标：品牌色圆角徽章 + 平台 logo 图形（离线可用）。
 * - 已收录真实 logo 图形的平台（微信 / 京东 / 云闪付 / 抖音）渲染矢量图形；
 * - 其余平台（银行 / 支付宝等）渲染品牌色徽章 + 字形，与真实品牌识别一致。
 */
import { computed } from 'vue'
import { platformOf } from '@shared/assets'
import { PLATFORM_LOGOS } from './platformLogos'

const props = withDefaults(
  defineProps<{
    /** 平台 key（见 shared/assets.ts 平台目录） */
    platform: string
    /** 徽章边长（px） */
    size?: number
  }>(),
  { size: 30 }
)

const info = computed(() => platformOf(props.platform))

/** logo 图形（{c} 占位符替换为品牌色，用于镂空细节；未收录时回退字形） */
const logo = computed(() => {
  const raw = PLATFORM_LOGOS[info.value.key]
  return raw ? raw.replace(/\{c\}/g, info.value.color) : null
})
</script>

<template>
  <span
    class="platform-icon"
    :style="{
      width: `${size}px`,
      height: `${size}px`,
      borderRadius: `${Math.round(size * 0.3)}px`,
      background: `linear-gradient(135deg, ${info.color}, ${info.color}dd)`,
      fontSize: `${Math.round(size * 0.46)}px`,
      color: info.ink ?? '#fff'
    }"
    :title="info.name"
  >
    <svg
      v-if="logo"
      class="platform-logo"
      viewBox="0 0 24 24"
      :width="Math.round(size * 0.68)"
      :height="Math.round(size * 0.68)"
      fill="#fff"
      aria-hidden="true"
      v-html="logo"
    />
    <template v-else>{{ info.glyph }}</template>
  </span>
</template>

<style scoped>
.platform-icon {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  line-height: 1;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.18);
  user-select: none;
}

.platform-logo {
  display: block;
}
</style>