/**
 * kookit 内核类型声明（vendor/kookit.min.js，koodo-reader v2.4.6，AGPL-3.0）。
 * 压缩混淆包无法从源码推导完整类型，此处仅声明本项目使用的具名导出与最小方法面；
 * 详见同目录 NOTICE.md。
 */
import type { KookitBookConfig, KookitConfigLike, KookitRendition } from '../types'

/** 书籍渲染工厂：result 为书籍文件的 ArrayBuffer，kookit 传入内核自身命名空间 */
export declare class BookHelper {
  static getRendition(
    result: ArrayBuffer,
    config: KookitBookConfig,
    kookit: unknown
  ): KookitRendition
}

/** 样式工具：默认阅读样式（ConfigService 由调用方传入，可用自实现对象替代） */
export declare class StyleHelper {
  static getDefaultCss(configService: KookitConfigLike, bookKey?: string): string
}