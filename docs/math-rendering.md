# 历史公式审计与 KaTeX 构建时渲染

## 扫描结果

扫描 `E:/hexo-akisenn/source` 中全部现存 `.md`/`.markdown`，含文章、页面和存在时的草稿；只读，不改原文。当前4个 Markdown：3篇文章、1个关于页。另以迁移清单核对独立工程内副本与原稿哈希一致。本次不将已删除且不在工作区的 Git 历史版本当成现存文章。

| 历史内容                                            | 实际公式数      | KaTeX 结果   |
| --------------------------------------------------- | --------------- | ------------ |
| GitHub + Hexo + AutuSwing + Workers：搭建个性化博客 | 0               | 不需数学资源 |
| 网站笔记                                            | 0               | 不需数学资源 |
| 数学公式实验室：按需加载与公式排版                  | 4，行内2、独立2 | 全部成功     |
| 关于我                                              | 0               | 不需数学资源 |

有公式的文章为 **1/3篇**。检测出的命令为 `\pi`、`\int`、`\infty`、`\sqrt`、`\sum`、`\frac`，逐条实际调用 KaTeX 0.19.0 验证，无不支持项；目前没有启用 MathJax 的必要。代码围栏、缩进代码、行内代码、HTML属性与注释不计作公式；扫描也排除转义美元符号与常见价格文本。

完整文件哈希、公式原文、行号和验证结果见 [audit.json](evidence/math/audit.json)。复查命令：

```powershell
node scripts/audit-math.mjs E:/hexo-akisenn/source
```

也可传入独立工程的 `content/legacy`，在原目录不在本机时扫描副本。

## 当前渲染行为

1. 沿用现有四种定界符的 Markdown 保护层；公式由 Markdown 管线中的 KaTeX 插件在构建时渲染，输出可视 HTML 与可访问 MathML。实现使用官方 [renderToString API](https://katex.org/docs/api.html) 和[配套选项](https://katex.org/docs/options.html)。
2. 无 JavaScript 时也能显示公式。客户端已移除数学渲染模块、引擎配置与自动渲染脚本；不会为公式加载 KaTeX/MathJax JavaScript。
3. Post.math 从实际生成的数学节点判断，页面 head 只在包含这些节点时引用本地 KaTeX CSS。全文首页及分页也按本页文章实际内容判断；只有摘要、归档、标签、普通文章的页面不引用该样式。
4. 字体由该 CSS按需加载。构建器与已有本地 CSS/字体固定为同一0.19.0版本；依赖版本或构建代码变化会使 Astro 原生内容缓存失效。版本不匹配会中止构建。
5. 搜索、摘要、字数读取公式原文一次，避免将可视 HTML、MathML和TeX注释重复计数。历史数学文章仍为354字，日期、URL、标题与正文原稿不变。
6. 宏在单篇文章内共享、文章间隔离。无法识别的命令会中止构建并指出文章标题与表达式；不把解析错误降为红色占位公式，不自动加载 MathJax。

## 旧字段兼容与配置

| 文章字段                                       | 行为                                           |
| ---------------------------------------------- | ---------------------------------------------- |
| 未设置数学字段                                 | 自动检测，遇到公式即使用构建时 KaTeX           |
| `mathjax: true` / `katex: true` / `math: true` | 保留启用含义，使用 KaTeX；没有公式则不加载样式 |
| `math: 'mathjax'` / `math: 'katex'`            | 兼容旧字符串启用含义，均使用 KaTeX             |
| `math: false`，或字符串 off/false/none         | 明确关闭，优先于其他标记                       |
| 未设置 math、旧 mathjax/katex 显式 false       | 关闭；任一旧标记为true可启用                   |

全局只保留 `math.enable` 与 `math.katex.config`。config可提供 KaTeX 宏和排版选项，但 HTML+MathML 输出、遇错抛出、trust:false由实现固定。没有另建配置层。

原主题 `math.per_page` 的手动逐页启用被自动检测与明确关闭替代；`math.engine/source`、MathJax CDN、KaTeX浏览器脚本/auto_render/CSS地址项已从新工程配置删除，旧值仍在迁移来源快照中，逐键表明确记录替代关系。数学 CSS 来自与构建器同版本的本地资源，通用 `assets.cdn` 前缀仍可使用。

原稿中的旧 MathJax 教程文字及代码示例保持原样，没有为配合实现重写历史内容。旧 vendor 文件仍按原迁移清单保存与校验，它们的存在不代表页面引用或请求；本次没有将 MathJax 接入新管线。如果以后发现真实不兼容文章，再根据具体命令评估宏、语法兼容或 MathJax 方案。

## 验证

- `tests/math.test.ts`：定界符、排除代码/价格、旧字段、显式关闭、SSR/MathML、不支持命令失败、宏隔离、搜索文本。
- `scripts/verify-math.mjs`：真实 SSG 构建自动识别/旧标记/无公式/关闭/全文分页样式/失败阻断；临时文章与配置在 finally 恢复。
- `tests/browser/math-modes.spec.ts`：静态响应含公式、CSS/字体请求、无数学脚本、无 JavaScript、长公式内部滚动；完整三端回归继续执行。
- `scripts/verify-configurations.mjs`、`npm run verify`：配置缓存、输出、历史日期/链接/资源/Feed/地图不回退。

构建结果见 [build-check.json](evidence/math/build-check.json)，浏览器与最终检查记录保存在同目录。数学默认策略调整只在独立工程中实施，不修改原站、Yelee-Next或生产环境。

本次最终结果：16项单元测试、34项 Edge/Chromium 浏览器测试及7项数学真实构建检查通过；完整三端104组合与浅深色基础 axe 检查通过。Astro check 为0错误、0警告、1项保留的剪贴板兜底弃用提示；354个构建输出连续两次一致。原站652个文件哈希、两个原仓库工作区状态不变。公式截图：[手机](evidence/math/math-390.png)、[桌面](evidence/math/math-1280.png)；浏览器运行记录见 [browser-check.json](evidence/math/browser-check.json)。本轮没有增加其他浏览器引擎或真机验收结论。
