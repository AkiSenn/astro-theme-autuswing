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

新文件默认 `draft: true`，构建、首页、归档、搜索、RSS、Sitemap 均不发布草稿。`published: false` 同样阻止发布；两者同时存在时，任一个禁止发布即可生效。完成写作后显式改为 `draft: false`，再运行 `npm run publish:check`：类型检查 → 原稿检查 → 静态构建 → 产物链接检查 → 单元测试 → 历史导入/输出验证。本命令不部署。

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
