# kookit 内核来源与许可说明

本目录包含来自开源项目 koodo-reader 的阅读渲染内核（压缩混淆包，无源码）：

| 文件 | 来源 | 版本 | 许可 |
| --- | --- | --- | --- |
| `kookit.min.js` | [koodo-reader](https://github.com/koodo-reader/koodo-reader) `src/assets/lib/kookit.min.js` | v2.4.6 | AGPL-3.0 |
| `kookit-extra-browser.min.js` | [koodo-reader](https://github.com/koodo-reader/koodo-reader) `src/assets/lib/kookit-extra-browser.min.js` | v2.4.6 | AGPL-3.0 |

说明：

- 本项目为开源项目，经评估后按用户要求集成上述内核；授权适配工作后续单独处理。
- 内核文件保持原样，不做任何修改。
- `kookit.min.js` 的具名导出：`BookHelper`、`StyleHelper`、`EpubRender`、`PdfRender`、`PdfTextRender`、`MobiRender`、`DocxRender`、`Fb2Render`、`TxtRender`、`MdRender`、`HtmlRender`、`ComicRender`、`CacheRender`。
- `kookit.min.js` 以裸模块形式引用 `underscore`、`rangy`、`jszip`、`fflate`、`chardet`、`js-untar`、`mammoth`、`marked`、`mhtml2html`，因此必须作为源码模块经构建器（Vite/Rollup）打包引入，不能放入 `public/` 目录（浏览器无法解析裸模块）。
- `kookit-extra-browser.min.js` 提供 `ConfigService` / `HighlightUtil` / `ReadingTimeUtil` / `SqlStatement` / `KookitConfig` 等辅助能力，但会额外引入 `axios`、`megajs`、`@aws-sdk/client-s3`、`crypto-js`、`webdav`、`sse.js` 等云同步依赖；Spike 验证未使用（核心渲染不依赖它，`ConfigService` 仅作为 `StyleHelper` 的入参，可用自实现对象替代）。

## 相关外部资源

内核的 PDF 渲染会按固定路径 `./lib/pdfjs/` 加载辅助资源（实现于压缩包内、不可配置），对应下列文件：

| 路径 | 来源 | 说明 |
| --- | --- | --- |
| `src/renderer/public/lib/pdfjs/text_layer_builder.css` | pdfjs（经 koodo-reader public/lib/pdfjs 转存） | PDF 文本层样式，Apache-2.0 |
| `src/renderer/public/lib/pdfjs/annotation_layer_builder.css` | pdfjs（经 koodo-reader public/lib/pdfjs 转存） | PDF 注释层样式，Apache-2.0 |
| `src/renderer/public/lib/pdfjs/cmaps/` | `pdfjs-dist`（npm，Apache-2.0） | CJK 字符映射表 |
| `src/renderer/public/lib/pdfjs/standard_fonts/` | `pdfjs-dist`（npm，Apache-2.0） | 标准字体（PDF 未内嵌字体时的回退） |

另外，内核的 PDF 渲染依赖全局 `pdfjsLib`（koodo 在 index.html 中注入 pdfjs 4.7.76），本项目在 `loadKookit.ts` 中注入 `pdfjs-dist` 实例并配置 Worker。