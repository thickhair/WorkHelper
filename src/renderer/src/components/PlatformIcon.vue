<script setup lang="ts">
/**
 * 平台图标：自绘品牌色 SVG 徽章（离线可用）。
 * 圆角方形品牌底色 + 白色平台字形（如「支」「微」「建」），高辨识度且风格统一。
 */
import { computed } from 'vue'
import { platformOf } from '@shared/assets'

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
</script>

<template>
  <span
    class="platform-icon"
    :style="{
      width: `${size}px`,
      height: `${size}px`,
      borderRadius: `${Math.round(size * 0.3)}px`,
      background: `linear-gradient(135deg, ${info.color}, ${info.color}dd)`,
      fontSize: `${Math.round(size * 0.46)}px`
    }"
    :title="info.name"
  >
    {{ info.glyph }}
  </span>
</template>

<style scoped>
.platform-icon {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-weight: 700;
  line-height: 1;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.18);
  user-select: none;
}
</style>
