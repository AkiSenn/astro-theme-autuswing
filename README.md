# Autuswing for Astro

GitHub：[`AkiSenn/astro-theme-autuswing`](https://github.com/AkiSenn/astro-theme-autuswing)（私有仓库）。这是 Autuswing 的独立 Astro 版本，当前保留 AkiSenn 博客的迁移内容与配置，尚未整理为使用示例内容的通用发行包。

AutuSwing 从 Hexo 迁移到 Astro 的独立项目。当前进行本地验收，保留预览 noindex 和关闭的真实评论。保留森林绿、日期卡片与个人侧栏：PC首页及普通页面使用272px完整侧栏；PC文章页复用72px迷你导航，并提供260px独立目录。平板仍为72px迷你栏，手机仍为顶部品牌与横向导航。文章外层上限860px、默认正文实际810px，较窄窗口弹性缩小。目录入口按实际布局保持唯一：手机悬浮按钮、迷你栏按钮、已展开面板的收起按钮。PC 底部样式见[功能与社交分区](docs/sidebar-bottom.md)，社交区说明见[纯图标布局](docs/social-links.md)，目录行为见[目录入口统一](docs/contents-controls.md)，布局方案见[首页与文章布局分离](docs/reading-layout.md)，前序宽度调整记录见[宽屏补充](docs/desktop-reading-wide.md)。

## 本地运行

动效已更新为 [Autuswing Motion 1.0](docs/motion-system.md)：主内容使用原生跨文档转场（320ms / 14px，旧内容淡出120ms），保持静态多页面导航；侧栏不做位移动画。旧头像摇晃、缩放入场和卡片上移已移除，按钮反馈为150ms。配置入口为 `theme.motion.enable/page`，减少动画模式关闭装饰性动效。

Node.js ≥22.22.0。依赖版本与锁文件已固定。

```powershell
cd E:\autuswing-astro
npm ci
npm run check
npm run build
npm run preview
```

预览地址：**http://127.0.0.1:4322/**。开发模式用 `npm run dev`，同端口，请先结束占用该端口的预览进程。构建默认输出预览策略（noindex、关闭真实评论和统计），不会部署。

本轮已经启动的 Nginx 验收地址：**http://127.0.0.1:8788/**。复现命令见[宝塔 Nginx 静态交付](deployment/README.md)，验收结果、截图和未完成项见[第五阶段报告](docs/phase-5.md)。

## 内容与职责

- `content/legacy/`：3 篇原稿与关于页的逐字节副本，不重新序列化 front matter。
- `content/posts/`：新稿。`npm run new-post -- "文章标题"` 只在创建时生成并保存编号；build 不写文章。
- URL：旧文保持 `/post/原编号/`，新文采用 `https://akisenn.com/编号/`；新稿的完整 permalink 创建时一并保存。
- `src/config/site.json` / `theme.json`：站点数据与单主题设置，不保存发布凭据。
- `src/lib/`：内容、路由、日期、SEO、搜索、评论身份、Markdown 兼容；不依赖侧栏或卡片 DOM。
- 数学公式默认由 KaTeX 在构建时渲染，含公式页面才加载配套样式；保留旧文章的 `mathjax` 等标记。详见[数学扫描与实现](docs/math-rendering.md)。
- `src/components/` / `layouts/`：原生 Astro 视图；没有 React、Vue、Svelte 或 Hexo 运行时。
- `src/scripts/`：独立的原生交互模块。`responsive` 管理目录与断点焦点恢复；`dialogs` 保持搜索、目录、灯箱互斥。已移除抽屉与导航页签脚本。
- `src/styles/`：基础样式、Astro 渲染适配、三端布局与视觉样式按职责分开；没有远程字体或新 UI 框架。代码复制工具栏独立于横向滚动区域，正文默认可见。
- `migration/`：来源哈希、冻结的历史时间和锚点、旧配置映射；构建缓存和结果只写 `.astro/`、`dist/`。

## 验证

```powershell
npm run test
npm run verify
npm run test:browser
node scripts/verify-fixtures.mjs
node scripts/verify-reproducible.mjs
node scripts/verify-configurations.mjs
node scripts/verify-motion.mjs
```

浏览器测试默认使用本机 Edge；没有 Edge 时在 `playwright.config.ts` 调整 channel，并安装对应 Playwright 浏览器。fixture 脚本只临时写入新工程并在 finally 中恢复，不能在他人正在编辑相同配置时并行执行。

`verify-motion.mjs` 会重建 dist，需在浏览器测试之前单独运行。动效专项为 `tests/browser/motion.spec.ts`；设置 `PLAYWRIGHT_BASE_URL=http://127.0.0.1:8788` 可用本地 Nginx 验证该专项。普通完整套件默认使用4322端口，其中部分旧测试固定了该来源。

## 备份与范围

迁移前备份：`E:/autuswing-backups/2026-10-16T00-59-43-724Z/`。包含原工作区（含未提交/未跟踪文件）、public、主题独立包与 Git 历史 bundle；源码与主题都已解压逐文件 SHA256 核对。排除可重装的 node_modules 和工具缓存，没有远程服务器或评论数据库快照。

原站 `E:/hexo-akisenn`、Yelee-Next、生产域名和 516700.xyz 均不由本工程写入。第一阶段审计保存在 `E:/autuswing-astro-audit-20261016`。

详细说明：[阶段五本地验收](docs/phase-5.md)、[阶段四交付](docs/phase-4.md)、[阶段三记录](docs/phase-3.md)、[阶段二记录](docs/phase-2.md)、[配置迁移](docs/configuration.md)、[写作与 URL](docs/writing.md)、[宝塔 Nginx 静态交付](deployment/README.md)。

原主题、图标、样式及适配脚本沿用 MIT 许可；原稿保留作者原有内容许可。数学 vendor 的版本、许可证与校验清单见 `public/assets/vendor/`。本项目没有迁移 Yelee-Next，也没有双主题运行系统。
