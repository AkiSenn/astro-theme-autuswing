# 写作、日期与 URL

历史 Markdown 位于 `content/legacy/`，保留文件字节、未知元数据和原图路径。原稿日期按 Asia/Shanghai（UTC+8）解释；缺少 updated 的历史文章、关于页从 `migration/*metadata.json` 取已公开的有效时间，不读取 clone/复制后的 mtime。更改标题或移动历史文章时，仍通过原编号匹配回退值；显式新增 updated 优先。

新稿命令：`npm run new-post -- "标题"`。命令使用 crypto 创建一次编号，检查现有编号和保留路径，再以 wx 模式写新文件，同时持久化 `id` 与 `permalink: '/编号/'`。构建遇到缺编号、编号重复、路径冲突、跨域 permalink 或路径穿越会失败，不补写原稿。

## 日常写作与发布

```sh
npm run new-post -- "文章标题"
npm run new-post -- "技术教程" --template tutorial
npm run new-post -- "第一篇" --template series --series "Astro 实践"
npm run check:content -- --drafts
```

新文件默认 `draft: true`，构建、首页、归档、搜索、RSS、Sitemap 均不发布草稿。`published: false` 同样阻止发布；两者同时存在时，任一个禁止发布即可生效。完成写作后显式改为 `draft: false`，再运行 `npm run publish:check`：依赖 → 类型/原稿/单元/历史完整性检查 → 生产构建一次 → 同一产物的资源、动态内容与 SEO 门禁。成功输出独立候选目录及 READY，失败退出非零；不覆盖日常 `dist/`，也不部署。只公开候选里的 `site/`，上传前运行 `npm run verify:release -- <候选目录>`。见[发布与回滚手册](../deployment/release-runbook.md)。

| 字段                 | 要求                                                           |
| -------------------- | -------------------------------------------------------------- |
| title、date          | 必填；标题非空，日期必须是真实日历日期                         |
| id 或 abbrlink       | 文章必须有持久 ID；新稿脚本自动写入 id/permalink，不应手工重建 |
| updated              | 选填；不填沿用既有稳定回退；早于 date 提示作者核对             |
| description、excerpt | 选填；手写优先，空值按既有正文摘要回退，不修改正文             |
| tags、categories     | 选填；支持既有字符串、数组及分类层级数组                       |
| draft、published     | 选填布尔值；旧文章缺省仍公开，避免迁移行为变化；新稿默认草稿   |
| cover                | 选填图片 URL；本地文件必须存在                                 |
| series、series_order | 选填系列名称与正整数顺序；当前保存元数据，不新增系列页面或导航 |

原稿检查不写回文件。发布内容的无效元数据、重复 ID、缺图、站内坏链接/锚点会报错；未知自定义字段和缺失 alt 只提示。`--drafts` 可检查未完成草稿的资源，其资源问题仅警告，元数据与 ID 仍需有效。生产输出检查必须在本次构建后运行 `npm run check:content -- --output`；构建前暂缓检查尚未生成的归档等链接。外部 HTTP 链接只统计，不在常规验收中联网判断可用性（登录限制、限流和网络波动会误判）。

图片说明可使用原生 `<figure><img ...><figcaption>说明</figcaption></figure>`；保持历史 `/img/...` 原地址。新图可放在文章旁或 `src/assets/` 并使用相对 Markdown 图片路径，交由 Astro 原生资源管线处理；公开目录的图片不会自动生成缩略图。不要只依靠 CSS 缩放超大原图，优先在写作时导出适合正文的图像，灯箱所需原图单独保留。

公开路径区分两类：**历史文章继续使用 `/post/原编号/`；新文章使用根路径 `/编号/`**，例如 `https://akisenn.com/a1b2c3/`。显式 permalink 优先，历史 id/abbrlink、前导零与既有自定义地址保持不变。新文章从创建时就持久化完整 permalink，改标题、移动文件或以后调整默认规则不会改写地址。分类支持层级数组与多分支，不以文件名生成公开编号。Astro 集合内部 ID 与公开编号分开。

`permalink: /custom.html` 输出真实 HTML 文件，目录地址输出 index.html。未知 Hexo 标签会报错并标出文件位置；围栏、行内代码中的标签示例不当作实际标签。原生 HTML、表格、more、四种 TeX 定界符均通过 Astro Markdown 管线及薄兼容层处理。

推荐新稿 date/updated 使用带明确时区的 ISO 字符串。迁移稿允许原来的无时区时间和仅日期格式，统一解释为 UTC+8。缺少 updated 的新稿以 date 为准，后续修改时显式填写 updated，不自动使用构建时间。

数学公式自动检测并在构建时由 KaTeX 渲染，支持 `$…$`、`$$…$$`、`\(…\)`、`\[…\]`；新稿不必添加启用标记。旧 `mathjax: true`、`katex: true`、`math: true` 仍可保留，均使用 KaTeX。`math: false` 明确关闭；没有 `math` 主开关时，旧引擎的显式 false 表示关闭，任一 true 可启用。含不支持命令时构建会报出文章标题和表达式，先核查语法与宏，再评估是否需要 MathJax，不自动切换。详见[扫描结果与配置](math-rendering.md)。

preview 默认 noindex，分享、RSS/Atom 标识与评论身份始终使用正式 canonical。`comment_id` 可覆盖默认路径标识；预览不初始化真实评论，生产配置当前也保持关闭。密码字段只按原主题排除索引，不代表实现了内容加密。

复制副本校验：`npm run verify`。一次性导入工具已归档在迁移前备份的 `import-tools`，不属于新工程的日常构建命令；恢复内容时先核对迁移清单哈希，不覆盖不同内容的目标文件。

需要联网核对外部链接时，可显式执行 `npm run check:content -- --output --remote`。它以最多四个并发请求检查 HTTP 状态，单次请求限时八秒；404/410 报错，登录限制、限流、服务错误或网络超时仅提示核对。普通发布检查不依赖外网。HTTP 成功状态不保证远程内容、站外锚点或需要登录的内容正确。

## 本地草稿预览

`npm run dev:drafts` 显式开启本地写作预览；已有静态预览占用端口时可用 `npm run dev:drafts -- --port 4323`。只有 Astro dev 模式会读取 `ASTRO_PREVIEW_DRAFTS=1`。即使误将该环境变量带入静态构建，也仍然过滤草稿；草稿在本地不进入搜索与 Feed，并保持 noindex。普通 `npm run dev` 也不显示草稿。预览地址就是新稿 frontmatter 保存的 permalink。

## 技术 Markdown

围栏代码支持 `ts title="src/demo.ts" {2,4-6} add={4} del={5}`：语言和文件名在工具栏展示；行号、高亮、增删标记不进入复制文本。也可使用 `filename=` / `file=`；只有显式标记的代码行新增背景色。标准 `diff` 代码块继续由 Shiki 高亮。

原生 GFM 脚注、任务列表、表格沿用 Astro；`> [!NOTE]`、`TIP`、`IMPORTANT`、`WARNING`、`CAUTION` 使用现有引用样式表达提示。正文 H1 继续按原兼容规则降为 H2，页面标题保留唯一 H1。H2–H6 的复制章节链接按钮支持悬停与键盘焦点，使用正式 canonical 加原有标题 ID，不改变锚点。

新文章的公开目录图片可在构建时获得尺寸属性，原图路径不变；历史文章不自动补属性，以保持冻结的像素与布局指标。新导入的相对 Markdown 图片使用 Astro 原生 `srcset`，sizes 按约 810px 实际正文及窄屏布局估算，不引入第二套图片生成器。远程图不在构建时探测；作者应显式提供尺寸。说明文字使用 figcaption，alt 用于表达图片内容。

响应式图片在灯箱打开时使用其完整尺寸的优化源，而不是已选中的窄屏缩略版本。手写 HTML 图也可用 `data-fullsize="原图地址"` 指定按需加载的大图；常规阅读不会主动请求该地址。

完整样本位于 `tests/fixtures/markdown/reading.md`。`npm run test:markdown` 验证各屏幕和文章交互并生成诊断截图；样本不会被生产发布。`npm run verify:writing` 会创建一次性草稿、运行生产隔离/发布/本地预览/响应式图片契约，结束后删除自己的临时稿件并恢复普通预览构建；不要与其他构建或浏览器回归同时运行。
