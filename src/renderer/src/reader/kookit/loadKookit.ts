/**
 * kookit 内核加载层。
 * 内核为 686KB 的压缩混淆 ESM 包（vendor/kookit.min.js，koodo-reader v2.4.6），
 * 内部以裸模块引用 underscore / rangy / jszip / fflate / chardet / js-untar / mammoth / marked 等
 * 第三方依赖（由构建器打包解析），故必须作为源码模块经 Vite 引入，不能放入 public 目录。
 * 采用动态 import：内核随阅读路由懒加载，不拖慢应用冷启动。
 */
/** kookit 内核模块（对应 vendor/kookit.min.js 的具名导出） */
export type KookitModule = typeof import('./vendor/kookit.min.js')

let cache: Promise<KookitModule> | null = null

/** 加载 kookit 内核模块（成功后缓存；失败时清空缓存以便重试） */
export function loadKookit(): Promise<KookitModule> {
  if (!cache) {
    // 内核在模块求值时就捕获 window.pdfjsLib（const pdfjsLib = window.pdfjsLib），
    // 因此必须先注入全局实例再加载内核；pdfjs 复用项目已配置 Worker 的实例
    const pending = (async () => {
      const { pdfjs } = await import('../pdf-lib')
      ;(globalThis as Record<string, unknown>)['pdfjsLib'] = pdfjs
      return import('./vendor/kookit.min.js')
    })()
    pending.catch(() => {
      if (cache === pending) cache = null
    })
    cache = pending
  }
  return cache
}