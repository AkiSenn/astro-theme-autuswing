# 写作、日期与 URL

历史 Markdown 位于 `content/legacy/`，保留文件字节、未知元数据和原图路径。原稿日期按 Asia/Shanghai（UTC+8）解释；缺少 updated 的历史文章、关于页从 `migration/*metadata.json` 取已公开的有效时间，不读取 clone/复制后的 mtime。更改标题或移动历史文章时，仍通过原编号匹配回退值；显式新增 updated 优先。

新稿命令：`npm run new-post -- "标题"`。命令使用 crypto 创建一次编号，检查现有编号和保留路径，再以 wx 模式写新文件，同时持久化 `id` 与 `permalink: '/编号/'`。构建遇到缺编号、编号重复、路径冲突、跨域 permalink 或路径穿越会失败，不补写原稿。

公开路径区分两类：**历史文章继续使用 `/post/原编号/`；新文章使用根路径 `/编号/`**，例如 `https://akisenn.com/a1b2c3/`。显式 permalink 优先，历史 id/abbrlink、前导零与既有自定义地址保持不变。新文章从创建时就持久化完整 permalink，改标题、移动文件或以后调整默认规则不会改写地址。分类支持层级数组与多分支，不以文件名生成公开编号。Astro 集合内部 ID 与公开编号分开。

`permalink: /custom.html` 输出真实 HTML 文件，目录地址输出 index.html。未知 Hexo 标签会报错并标出文件位置；围栏、行内代码中的标签示例不当作实际标签。原生 HTML、表格、more、四种 TeX 定界符均通过 Astro Markdown 管线及薄兼容层处理。

推荐新稿 date/updated 使用带明确时区的 ISO 字符串。迁移稿允许原来的无时区时间和仅日期格式，统一解释为 UTC+8。缺少 updated 的新稿以 date 为准，后续修改时显式填写 updated，不自动使用构建时间。

preview 默认 noindex，分享、RSS/Atom 标识与评论身份始终使用正式 canonical。`comment_id` 可覆盖默认路径标识；预览不初始化真实评论，生产配置当前也保持关闭。密码字段只按原主题排除索引，不代表实现了内容加密。

复制副本校验：`npm run verify`。从另一份相同基线恢复缺失的内容/资源：`node scripts/import-legacy.mjs <基线目录>`，只接受清单哈希一致的输入，不覆盖不同内容的目标文件。
