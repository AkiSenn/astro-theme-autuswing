# 写作体验与文章阅读系统完善

## 基准和范围

起点工作区干净，基准标签 `astro-style-baseline` 指向 `92887a2`。开始时重新运行类型检查和原有 20 项单元测试，再逐阶段实现。当前 12 个 CSS 模块、桌面完整侧栏/文章迷你栏与独立目录、平板迷你栏、手机直接导航、正文宽度字号和原生跨文档转场均保持。

274 张批准截图和 274 份 CSS/几何指标的 SHA256 全部保持一致；没有修改基准配置、放宽色差或像素预算。最终视觉回归仍为阈值 0.1、差异像素预算 0。[保护校验](evidence/writing-reading/protection.json)记录了原稿、public、迁移数据、SEO/地址/重定向、部署相关源文件及依赖清单的保护结果。主题配置的唯一改动是移除 `reading.progress`。

## 写作流程

| 项目     | 已完成                                                                                                                                                           |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 元数据   | `content-schema.ts` 与 Content Collections/检查脚本共用规则；title/date 必填，真实日历日期校验，description/updated/tags/categories/cover 等选填，兼容未知旧字段 |
| 新稿     | 创建时一次生成并持久化 ID/permalink，检查冲突，wx 写入不覆盖；普通、教程、系列模板；默认 draft:true                                                              |
| 草稿     | draft:true 或 published:false 均排除生产页面、首页、归档、搜索、Feed、Sitemap；显式本地 dev 预览，静态 build 始终忽略预览草稿环境开关                            |
| 描述     | 手写 description/excerpt 优先；保留现有正文摘要回退，不写回正文或强制前言                                                                                        |
| 发布检查 | 原稿校验 → 构建 → 产物站内链接/锚点校验；缺图、重复 ID、无效日期报错，缺 alt/未知自定义字段提示                                                                  |
| 外部链接 | 显式 --remote 启用 HTTP 检查；限时、并发上限、HEAD 不可用时回退 GET；404/410 与网络/登录限制区分                                                                 |
| 系列     | 保存 series/series_order 元数据并提供模板；没有增加系列页面或额外内容管理系统                                                                                    |

常用命令：

```sh
npm run new-post -- "文章标题"
npm run new-post -- "技术教程" --template tutorial
npm run new-post -- "第一篇" --template series --series "Astro 实践"
npm run dev:drafts -- --port 4323
npm run check:content -- --drafts
npm run publish:check
npm run check:content -- --output --remote
```

旧稿继续使用原 `/post/编号/`，新稿保持保存好的 `/编号/`。本轮没有改写原始 Markdown、公开地址、日期、SEO 配置、评论身份或部署。

## 技术阅读能力

- 复用 Astro/Shiki 的 metadata/line hooks，支持代码文件名、`{2,4-6}` 行高亮、`add={4}` / `del={5}`；语言/文件名/复制按钮在独立工具栏，标记和行号不混入复制文本。长代码仍独立横向滚动。
- 新文章的本地公开图片及封面可推断尺寸；相对导入图片使用 Astro 原生响应式资源输出和适合正文的 sizes，灯箱打开时使用完整尺寸优化源，也支持显式 data-fullsize。保留 figure/figcaption、加载策略、历史路径及键盘预览。
- 修复新导入图片在摘要/全文 Feed 中可能保留 Astro 占位符的问题：只对此类内容调用 Astro 提供的 Content 渲染结果。全文 Feed 使用完整、绝对的优化图片源，去除不适合阅读器的站内响应式候选地址；旧文章处理路径保持。
- 表格继续采用既有 `.table-wrap` 内部滚动与列最小宽度。补充复杂表格/合并单元格回归，不重做整站表格样式。
- GFM 脚注、任务列表与 KaTeX 沿用 Astro/现有管线；新增轻量提示块和 H2–H6 章节链接复制。正文 H1 继续按原兼容逻辑降为 H2，公开标题 ID 不变。

新增 CSS 集中在 `content.css` 的可选代码标记、文件名、标题链接、H5/H6、提示块和脚注规则，复用现有颜色/间距/圆角变量。没有增加新的 CSS 模块、UI 库或动画体系。

## 测试样本

`tests/fixtures/markdown/reading.md` 覆盖长中文、混排、长短代码、H1–H6、图片/说明、多图、宽表与 HTML 合并单元格、引用/列表/脚注/提示块、四种公式定界符、链接/锚点、特殊字符及长单词。

样本由测试请求拦截器使用真实 Markdown processor 注入真实文章外壳。它不属于生产集合，不生成静态路由；普通请求 `/__test__/markdown/` 返回 404，不进入搜索、Feed、Sitemap。`npm run test:markdown` 运行专项并生成诊断截图，截图不自动成为新的批准基准。

专项覆盖 320、390、430、768、820、1180、1366、1440、1920、2560px；冻结回归还覆盖 375、1024 及各布局断点附近。包括原生文档跳转后代码复制、灯箱、目录、前进后退及复制章节链接。

## 旧进度条清理

删除 BaseLayout 的进度条 DOM、overlays.css 的固定条与打印规则、tokens.css 的专用层级、theme.json 的进度配置、reading.ts 的文章高度/位置/比例计算。

原先滚动更新函数同时服务返回顶部和浮动工具，因此保留它们需要的 passive scroll / rAF / resize 更新；这些监听器不再计算文章进度。目录的 IntersectionObserver、章节高亮、目录内部滚动、返回顶部与减少动画行为保留。浏览器测试已改为验证进度条不存在以及原有阅读操作正常。

## 验收结果

机器验收汇总见 [summary.json](evidence/writing-reading/summary.json)。浏览器完整套件与后加的深色专项分开记录，合计不伪装为一次测试运行。

| 检查                    | 结果 / 证据                                                                                                                                                                                                      |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Astro check、静态 build | 通过；0 errors、0 warnings，保留原有 execCommand 复制回退的 1 条弃用 hint                                                                                                                                        |
| 单元测试                | 27/27；日期/元数据/模板/只读检查、可选远程检查、渲染样本及旧契约                                                                                                                                                 |
| Edge 功能               | 完整套件 93/93，加深色 Markdown 专项 1/1，合计 94 项，0 skipped / flaky；[完整报告](evidence/writing-reading/functional-final.json)、[补充报告](evidence/writing-reading/markdown-dark-edge.json)                |
| 冻结视觉                | Edge 53 + WebKit 53 = 106/106，0 skipped / flaky；[最终报告](evidence/writing-reading/visual-final.json)                                                                                                         |
| WebKit 补充功能         | 返回、目录、Markdown、动效专项 37/37，加深色专项 1/1，合计 38 项，0 skipped / flaky；[专项报告](evidence/writing-reading/webkit-functional.json)、[深色报告](evidence/writing-reading/markdown-dark-webkit.json) |
| 生产/写作构建契约       | 草稿隔离、显式发布、稳定 ID/canonical、手写描述、本地草稿、响应式图片/封面、图片与公式混合、全文 Feed、样本不发布均通过；[记录](evidence/writing-reading/production-content.json)                                |
| 原有 fixture 脚本       | 文件 permalink、分页、分类层级、可见性、静态资源冲突、旧别名冲突、重复 ID、新稿默认草稿及发布持久性通过                                                                                                          |
| 内容与输出              | 原导入文件 307、可选资源 6、原站源文件 365 哈希通过；26 个 canonical 页面、3 篇文章、879 处本地引用、4 个公式容器、3 条 Feed、26 条 Sitemap、21 条重定向；[输出记录](evidence/writing-reading/output-check.json) |
| HTTP 外链               | 12 次引用去重为 11 个 URL，检查时均返回 200；站内及本地图片检查 0 errors / warnings；[记录](evidence/writing-reading/links-check.json)                                                                           |

开发中发现并修复了标题定位属性变化、浮动零宽容器破坏长标题均衡换行、历史图片尺寸属性的亚像素舍入差异，以及打包后用 import.meta.url 推断公开资源根目录的问题。开发中断/失败报告作为诊断保留；最终结论使用上述 final / corrections / production 记录，不把早期运行算作通过。未更新批准截图以容纳这些差异。

## 限制和后续

- Firefox 已实际尝试启动，环境返回 `spawn UNKNOWN`；[失败记录](evidence/writing-reading/firefox.json)。不计入已验证浏览器。未进行实体手机/平板测试。
- 历史图片继续保持批准的渲染几何，没有自动补尺寸属性；减少它们的加载位移需要后续单独批准。远程图片不自动探测尺寸，作者可用 HTML 显式填写。
- 外链记录只证明检查时的 HTTP 状态，不验证站外锚点或登录内容。
- 既有迁移哈希检查继续保护导入快照；未来作者主动修订历史稿件时，应单独审核该保护策略，保持原站备份和公开地址。
- 真实评论按既有要求保持关闭；服务适配器由既有受控测试覆盖，真实服务验收仍待配置。
- 没有新增运行时依赖，没有正式发布、上传、DNS 或服务器配置变更。预览继续使用项目现有的本地 Node 服务。

## 分阶段提交与主要文件

- `19ac5d8`：审计与实施顺序。
- `1b156e2`：共享 Schema、默认草稿、创建模板、发布检查。
- `26c3a86`：技术 Markdown、非公开样本、本地草稿预览与对应测试。
- `e782382`：原生图片、封面、全文 Feed 和可选外链检查兼容。
- `d318c81`：完整移除进度条、保留 TOC/返回顶部。

写作：`src/lib/content-schema.ts`、`src/content.config.ts`、`src/lib/dates.ts`、`scripts/new-post.mjs`、`scripts/check-content.ts`、`scripts/dev-drafts.mjs`、`templates/`。

阅读：`src/lib/markdown*.mjs`、`src/lib/content.ts`、`src/lib/feeds.ts`、`src/layouts/PostLayout.astro`、`src/scripts/media.ts`、`src/styles/content.css`。

清理：`src/layouts/BaseLayout.astro`、`src/scripts/reading.ts`、`src/styles/overlays.css`、`src/styles/tokens.css`、`src/config/theme.json`。

测试：`tests/writing.test.ts`、`tests/markdown-reading.test.ts`、`tests/fixtures/markdown/`、`tests/browser/markdown-*.ts`、`tests/browser/motion.spec.ts`、`scripts/verify-writing.mjs`、`scripts/verify-fixtures.mjs`。
