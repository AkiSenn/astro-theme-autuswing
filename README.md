# AutuSwing Astro

AutuSwing 从 Hexo 迁移到 Astro 的独立项目。当前为第二阶段：静态内容与功能迁移，保留旧版森林绿、日期卡片、完整侧栏和移动抽屉，便于比较。第三阶段才重构为桌面完整侧栏、平板迷你侧栏和手机顶部导航。

## 本地运行

Node.js ≥22.22.0。依赖版本与锁文件已固定。

```powershell
cd E:\autuswing-astro
npm ci
npm run check
npm run build
npm run preview
```

预览地址：**http://127.0.0.1:4322/**。开发模式用 `npm run dev`，同端口，请先结束占用该端口的预览进程。构建默认输出预览策略（noindex、关闭真实评论和统计），不会部署。

## 内容与职责

- `content/legacy/`：3 篇原稿与关于页的逐字节副本，不重新序列化 front matter。
- `content/posts/`：新稿。`npm run new-post -- "文章标题"` 只在创建时生成并保存编号；build 不写文章。
- URL：旧文保持 `/post/原编号/`，新文采用 `https://akisenn.com/编号/`；新稿的完整 permalink 创建时一并保存。
- `src/config/site.json` / `theme.json`：站点数据与单主题设置，不保存发布凭据。
- `src/lib/`：内容、路由、日期、SEO、搜索、评论身份、Markdown 兼容；不依赖侧栏或卡片 DOM。
- `src/components/` / `layouts/`：原生 Astro 视图；没有 React、Vue、Svelte 或 Hexo 运行时。
- `src/scripts/`：独立的原生交互模块。`drawer` 与 `navigation-tabs` 是第二阶段保留旧布局的临时适配器，第三阶段替换。
- `migration/`：来源哈希、冻结的历史时间和锚点、旧配置映射；构建缓存和结果只写 `.astro/`、`dist/`。

## 验证

```powershell
npm run test
npm run verify
npm run test:browser
node scripts/verify-fixtures.mjs
node scripts/verify-reproducible.mjs
node scripts/verify-configurations.mjs
```

浏览器测试默认使用本机 Edge；没有 Edge 时在 `playwright.config.ts` 调整 channel，并安装对应 Playwright 浏览器。fixture 脚本只临时写入新工程并在 finally 中恢复，不能在他人正在编辑相同配置时并行执行。

## 备份与范围

迁移前备份：`E:/autuswing-backups/2026-10-16T00-59-43-724Z/`。包含原工作区（含未提交/未跟踪文件）、public、主题独立包与 Git 历史 bundle；源码与主题都已解压逐文件 SHA256 核对。排除可重装的 node_modules 和工具缓存，没有远程服务器或评论数据库快照。

原站 `E:/hexo-akisenn`、Yelee-Next、生产域名和 516700.xyz 均不由本工程写入。第一阶段审计保存在 `E:/autuswing-astro-audit-20261016`。

详细说明：[阶段二交付](docs/phase-2.md)、[配置迁移](docs/configuration.md)、[写作与 URL](docs/writing.md)、[静态部署边界](deployment/README.md)。

原主题、图标、样式及适配脚本沿用 MIT 许可；原稿保留作者原有内容许可。数学 vendor 的版本、许可证与校验清单见 `public/assets/vendor/`。本项目没有迁移 Yelee-Next，也没有双主题运行系统。
