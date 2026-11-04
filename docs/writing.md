# 写作、日期与 URL

历史 Markdown 位于 `content/legacy/`，保留首次迁移的原始哈希、未知元数据和原图路径；主动修订旧文章须使用下述审批流程。原稿日期按 Asia/Shanghai（UTC+8）解释；缺少 updated 的历史文章、关于页从 `migration/*metadata.json` 取已公开的有效时间，不读取 clone/复制后的 mtime。更改标题时，仍通过原编号匹配回退值；显式新增 updated 优先。

新稿命令：`npm run new-post -- "标题"`。命令使用 crypto 创建一次编号，检查现有编号和保留路径，再以 wx 模式写新文件，同时持久化 `id` 与 `permalink: '/编号/'`。构建遇到缺编号、编号重复、路径冲突、跨域 permalink 或路径穿越会失败，不补写原稿。

## 日常写作与发布

```sh
npm run new-post -- "文章标题"
npm run new-post -- "技术教程" --template tutorial
npm run new-post -- "第一篇" --template series --series "Astro 实践"
npm run check:content -- --drafts
```

新文件默认 `draft: true`，构建、首页、归档、搜索、RSS、Sitemap 均不发布草稿。`published: false` 同样阻止发布；两者同时存在时，任一个禁止发布即可生效。完成写作后显式改为 `draft: false`，再运行 `npm run publish:check`：依赖 → 类型/原稿/单元/历史完整性检查 → 生产构建一次 → 同一产物的资源、动态内容与 SEO 门禁。成功输出独立候选目录及 READY，失败退出非零；不覆盖日常 `dist/`，也不部署。只公开候选里的 `site/`，上传前运行 `npm run verify:release -- <候选目录>`。见[发布与回滚手册](../deployment/release-runbook.md)。

| 字段                  | 要求                                                                                 |
| --------------------- | ------------------------------------------------------------------------------------ |
| title、date           | 必填；标题非空，日期必须是真实日历日期                                               |
| id 或 abbrlink        | 文章必须有持久 ID；1–64 位字母、数字、下划线或连字符；新稿脚本自动写入，不应手工重建 |
| permalink             | 选填安全站内路径；允许既有相对路径或 `.html`，不接受跨域、查询、片段及路径穿越       |
| updated               | 选填；不填沿用既有稳定回退；早于 date 提示作者核对                                   |
| description、excerpt  | 选填；手写优先，空值按既有正文摘要回退，不修改正文                                   |
| tags、categories      | 选填；支持既有字符串、数组及分类层级数组                                             |
| draft、published      | 选填布尔值；旧文章缺省仍公开，避免迁移行为变化；新稿默认草稿                         |
| noindex、search、feed | 选填布尔值；分别控制收录、站内搜索和 Feed，不提供访问保护                            |
| cover                 | 选填图片 URL；本地文件必须存在                                                       |
| series、series_order  | 选填系列名称与正整数顺序；当前保存元数据，不新增系列页面或导航                       |

Frontmatter 示例（编号仅作说明，实际保留新稿命令生成的 `id` 与 `permalink`）：

```yaml
---
title: '使用 Astro 写作'
date: '2026-11-04T10:00:00+08:00'
updated: '2026-11-04T15:00:00+08:00'
id: 'a1b2c3'
permalink: '/a1b2c3/'
description: '文章的手写摘要。'
author: '作者名'
tags: [Astro, 写作]
categories: [[技术, 前端]]
draft: true
noindex: false
search: true
feed: true
series: 'Astro 实践'
series_order: 1
---
```

不使用的选填字段可删除；布尔值使用未加引号的 `true`/`false`。校验保留合法字段原值和未知自定义字段，错误会标出文件、字段与原因；不会重新分配编号、规范化写回日期或改写 permalink。

原稿检查不写回文件。发布内容的无效元数据、重复 ID、缺图、站内坏链接/锚点会报错；未知自定义字段和缺失 alt 只提示。`--drafts` 可检查未完成草稿的资源，其资源问题仅警告，元数据与 ID 仍需有效。生产输出检查必须在本次构建后运行 `npm run check:content -- --output`；构建前暂缓检查尚未生成的归档等链接。外部 HTTP 链接只统计，不在常规验收中联网判断可用性（登录限制、限流和网络波动会误判）。

图片说明可使用原生 `<figure><img ...><figcaption>说明</figcaption></figure>`；保持历史 `/img/...` 原地址。新图可放在文章旁或 `src/assets/` 并使用相对 Markdown 图片路径，交由 Astro 原生资源管线处理；公开目录的图片不会自动生成缩略图。不要只依靠 CSS 缩放超大原图，优先在写作时导出适合正文的图像，灯箱所需原图单独保留。

公开路径区分两类：**历史文章继续使用 `/post/原编号/`；新文章使用根路径 `/编号/`**，例如 `https://akisenn.com/a1b2c3/`。显式 permalink 优先，历史 id/abbrlink、前导零与既有自定义地址保持不变。新文章从创建时就持久化完整 permalink，改标题、移动文件或以后调整默认规则不会改写地址。分类支持层级数组与多分支，不以文件名生成公开编号。Astro 集合内部 ID 与公开编号分开。

`permalink: /custom.html` 输出真实 HTML 文件，目录地址输出 index.html。未知 Hexo 标签会报错并标出文件位置；围栏、行内代码中的标签示例不当作实际标签。原生 HTML、表格、more、四种 TeX 定界符均通过 Astro Markdown 管线及薄兼容层处理。

推荐新稿 date/updated 使用带明确时区的 ISO 字符串。迁移稿允许原来的无时区时间和仅日期格式，统一解释为 UTC+8。缺少 updated 的新稿以 date 为准，后续修改时显式填写 updated，不自动使用构建时间。

数学公式自动检测并在构建时由 KaTeX 渲染，支持 `$…$`、`$$…$$`、`\(…\)`、`\[…\]`；新稿不必添加启用标记。旧 `mathjax: true`、`katex: true`、`math: true` 仍可保留，均使用 KaTeX。`math: false` 明确关闭；没有 `math` 主开关时，旧引擎的显式 false 表示关闭，任一 true 可启用。含不支持命令时构建会报出文章标题和表达式，先核查语法与宏，再评估是否需要 MathJax，不自动切换。详见[扫描结果与配置](math-rendering.md)。

preview 默认 noindex，分享、RSS/Atom 标识与评论身份始终使用正式 canonical。`comment_id` 可覆盖默认路径标识；预览不初始化真实评论，生产配置当前也保持关闭。`password` 不提供加密或访问保护，非空值（包括纯空白）会阻断校验；仅兼容旧的空字符串。历史文章须先确认公开意图：仅禁止收录使用 `noindex: true`，保密内容应设为草稿或 `published: false`，再明确迁移非空 password，不能自动转为可索引内容。

复制副本校验：`npm run verify`。一次性导入工具已归档在迁移前备份的 `import-tools`，不属于新工程的日常构建命令；恢复内容时先核对迁移清单哈希，不覆盖不同内容的目标文件。

需要联网核对外部链接时，可显式执行 `npm run check:content -- --output --remote`。它以最多四个并发请求检查 HTTP 状态，单次请求限时八秒；404/410 报错，登录限制、限流、服务错误或网络超时仅提示核对。普通发布检查不依赖外网。HTTP 成功状态不保证远程内容、站外锚点或需要登录的内容正确。

## 历史文章受控修订

首次迁移的 `migration/source-manifest.json`、有效元数据与原站证据不覆盖。旧文章默认仍须逐字节匹配首次迁移哈希；主动修订只通过独立审批记录放行，图片和独立页面继续使用原有完整性规则。

1. 只编辑要修订的 `content/legacy/posts/` 稿件，按需显式填写 `updated`。不改 `id/abbrlink`、`permalink` 或原始 `date`，保留历史章节锚点。正文修改不会自动改写这些字段，也不会自动更新时间。
2. 执行 `npm run legacy:approve -- --id 55b0541c`，只查看旧批准哈希 `from` 与当前文件哈希 `to`；此操作不写文件。用 `git diff -- <稿件路径>` 审阅实际改动。
3. 将审阅后的文章单独提交到 Git。此时普通发布检查仍应拒绝尚未批准的内容。
4. 使用刚才核对的完整 SHA256，显式确认文章 ID、两个哈希与原因：

```sh
npm run legacy:approve -- --id 55b0541c --from <旧SHA256> --to <新SHA256> --reason "更新已过时的操作说明" --confirm 55b0541c
```

命令要求当前稿件字节与 Git HEAD 内的已提交内容一致，且其他历史文章没有未批准修改。它只以 `wx` 新建 `migration/revisions/55b0541c.000001.json`，不覆盖旧记录或原迁移哈希；后续审批继续递增序号。记录包含文章 ID、源文件、旧/新 SHA256、原因、UTC 审批时间和内容提交编号。无需启用评论或连接任何外部服务。

5. 审阅并提交新 JSON 记录，然后执行 `npm run publish:check`。发布脚本只读取审批文件；ID/路径不符、断链、缺记录、错误哈希、错误时间、缺少所引用 Git 提交，或审批后再次改稿，均会拒绝发布。

已有修订记录的构建环境必须保留所引用的 Git 内容提交；浅克隆应先补齐历史。普通 Git 审查保护审批文件，本机制不提供另一个身份认证系统。不要手改、删除旧审批文件或把构建发现的哈希直接写回清单。无 Git 的源码导出若包含审批记录会被拒绝；已封存候选的 `verify:release` 和回滚仍不依赖源码仓库。

批准后，`article:modified_time` 按已批准稿件的显式 `updated` 或原稳定回退校验，不再强制等于首次迁移时间；原始发布日期和 canonical 仍锁定。未经修订的历史公式数量继续按原契约检查；已批准修订允许公式内容变化，仍须通过正常 Markdown/数学与输出校验。

## 本地草稿预览

`npm run dev:drafts` 显式开启本地写作预览；已有静态预览占用端口时可用 `npm run dev:drafts -- --port 4323`。只有 Astro dev 模式会读取 `ASTRO_PREVIEW_DRAFTS=1`。即使误将该环境变量带入静态构建，也仍然过滤草稿；草稿在本地不进入搜索与 Feed，并保持 noindex。普通 `npm run dev` 也不显示草稿。预览地址就是新稿 frontmatter 保存的 permalink。

该命令固定监听 `127.0.0.1`，强制使用 `SITE_ENV=preview`，避免继承终端中的生产模式而启用真实评论、统计或收录。只接受 `--port <端口>` 或 `--port=<端口>`，范围为 1–65535，默认 4322；无效端口、`--host`、`--config`、`--root` 等其他参数均在启动前报错。它复用 Astro dev，不提供对外分享草稿的服务。

## 技术 Markdown

围栏代码支持 `ts title="src/demo.ts" {2,4-6} add={4} del={5}`：语言和文件名在工具栏展示；行号、高亮、增删标记不进入复制文本。也可使用 `filename=` / `file=`；只有显式标记的代码行新增背景色。标准 `diff` 代码块继续由 Shiki 高亮。

原生 GFM 脚注、任务列表、表格沿用 Astro；`> [!NOTE]`、`TIP`、`IMPORTANT`、`WARNING`、`CAUTION` 使用现有引用样式表达提示。正文 H1 继续按原兼容规则降为 H2，页面标题保留唯一 H1。H2–H6 的复制章节链接按钮支持悬停与键盘焦点，使用正式 canonical 加原有标题 ID，不改变锚点。

新文章的公开目录图片可在构建时获得尺寸属性，原图路径不变；历史文章不自动补属性，以保持冻结的像素与布局指标。新导入的相对 Markdown 图片使用 Astro 原生 `srcset`，sizes 按约 810px 实际正文及窄屏布局估算，不引入第二套图片生成器。远程图不在构建时探测；作者应显式提供尺寸。说明文字使用 figcaption，alt 用于表达图片内容。

响应式图片在灯箱打开时使用其完整尺寸的优化源，而不是已选中的窄屏缩略版本。手写 HTML 图也可用 `data-fullsize="原图地址"` 指定按需加载的大图；常规阅读不会主动请求该地址。

完整样本位于 `tests/fixtures/markdown/reading.md`。`npm run test:markdown` 验证各屏幕和文章交互并生成诊断截图；样本不会被生产发布。`npm run verify:writing` 会创建一次性草稿、运行生产隔离/发布/本地预览/响应式图片契约，结束后删除自己的临时稿件并恢复普通预览构建；不要与其他构建或浏览器回归同时运行。
