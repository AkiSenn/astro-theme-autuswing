# 第二阶段：基础迁移交付

项目：`E:/autuswing-astro`，独立 Git 仓库。原博客、主题、生产基础设施和 Yelee-Next 均未被写入。本阶段没有发布测试站或切换正式站点。

## 已实现

- Astro 7.4.0、TypeScript 6、Content Collections、原生 Astro 组件与静态输出；没有 Hexo、EJS、React/Vue/Svelte 运行时。
- 三篇文章与关于页按字节导入，9 张原站图片保持路径；本地数学库和许可、6 张可选背景（默认关闭）均有来源记录。
- 首页、文章、归档总/年/月、标签/分类及层级分类、普通页、友链、关于、分页、404。
- 历史文章继续 `/post/原编号/`；按用户补充，新文章使用 `https://akisenn.com/编号/`。创建命令持久化 id 与 permalink，构建不分配编号、不改原稿；检测重复编号、保留页面、静态资源和历史别名冲突。
- 历史有效日期、缺失 updated 的回退和正文锚点冻结；关于页公开 lastmod 也从审计的旧 sitemap 保留。
- canonical、OG/Twitter、结构化数据、RSS/Atom、标准/百度/文本地图、robots；9 个基础历史别名及尾斜杠/index.html 形式生成 21 条 301 规则。
- 本地搜索、深浅色/系统模式与旧偏好迁移、TOC、阅读进度、代码复制/高亮/行号、灯箱、分享、相邻文章、可选相关文章、版权、关于页运行时间。
- MathJax/KaTeX、四种 TeX 定界符、按页加载与全文卡片；六种评论适配器及延迟/折叠/超时/重试/外观同步，本站关闭状态保留。
- PWA 壳与离线页、指纹资源、可选压缩、缓存规则、计数/分析开关；预览禁止索引和真实评论/分析，增加实际 host 检查。

## 保留的视觉与职责边界

现阶段沿用旧主题 CSS 和大部分视觉比例，只添加 Astro/Shiki 适配及必要的对比度修复。桌面完整侧栏、手机抽屉与菜单/目录页签仍是迁移基线，**不是第三阶段的最终导航**。

通用功能位于 lib、config 与独立交互模块，组件读取统一数据。Sidebar、Header、PostCard、PostLayout、TOC、Search、AppearanceToggle、Comments、Footer 等职责已分开。第三阶段会替换 drawer/navigation-tabs 适配模块，并增加平板迷你侧栏和手机横向导航；没有提前建设双主题框架。

## 验证与证据

| 项目 | 证据与边界 |
| --- | --- |
| 安装/检查/构建 | 已使用锁文件 npm ci；Astro check 无错误，保留一项旧剪贴板兜底 API 的弃用提示；SSG 正常构建 |
| 源数据与资源 | `output-check.json`、`source-integrity.json`；原稿和图片哈希、26 个历史 canonical、551 处本地引用、RSS/Atom 与地图核对 |
| 纯逻辑 | 10 项 node:test 通过，覆盖 ID/新旧路径、YAML、时区、冲突、搜索、TeX、标题、Hexo 标签检测与重定向 |
| 受控构建 | `fixture-check.json`：真实 .html、自定义路径、层级分类、分页、索引过滤、根路径新 ID、创建后不变、冲突阻断；临时内容最终清理 |
| 配置与缓存 | `configuration-check.json`：切换配置后的缓存失效、每页0/全文数学/数学关闭/地图关闭/压缩/英文标签/正式与预览抓取策略 |
| 浏览器 | 23 项 Playwright Edge 测试通过，见 `browser-check.json`：页面/搜索/模式/TOC/灯箱、数学本地资源、六种模拟 SDK、失败重试、PWA、无JS、宽表和九种宽度；截图存 evidence，禁用滚动入场动画以完整展示正文 |
| 连续构建 | `reproducible-build.json`：连续两次 dist 文件清单及内容哈希一致 |

所有数值以本目录 evidence 中实际执行结果为准。截图是当前第二阶段与旧站的比较材料，不代表三端新设计已验收。只有首页完成基础 axe 检查，不能据此宣称全站所有状态已符合无障碍标准。

## 仍待后续验收

1. 第三阶段：全侧栏/迷你侧栏/顶部横向导航、独立移动 TOC、跨断点状态和触控。
2. 第四阶段：704px 阅读正文、中文排版、字号、留白和微交互；当前仍保留旧版部分过小元信息与宽屏行宽。
3. 第五阶段：Firefox/WebKit/真机、完整浅深色截图、真实评论服务、网络性能与独立托管的 301/404/缓存/字体验证。
4. Workers/ESA/Nginx 目前只有静态交付准备与本地重定向适配器测试；Cloudflare 自动 HTML 规范化与未来显式 .html 页面仍需平台实测。
5. 未获得完整历史访问日志/Search Console；当前保护清单覆盖审计发现的公开地址，不能证明所有互联网旧链接已穷尽。已删除旧文不自动恢复。

已阅读并记录用户提供的[千灵参考文章](reference-qianling.md)。保留现有发布时间排序和 AutuSwing 身份；未引入 Pagefind、Pure、UnoCSS、额外统计、数据库修改或 DNS 改动。

## 备份

`E:/autuswing-backups/2026-10-16T00-59-43-724Z`：当前工作区和 public 的 652 个文件已解压逐项校验；主题另包验证；Git history bundle 验证通过。node_modules 可从锁文件重装；备份不是远程服务器/数据库快照。
