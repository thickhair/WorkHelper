/**
 * pdfjs 实例：集中配置 Worker 资源（Vite 以 ?url 方式打包 worker 文件），
 * 供 PDF 阅读引擎与元数据解析共用，避免重复初始化。
 */
import * as pdfjs from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

export { pdfjs }