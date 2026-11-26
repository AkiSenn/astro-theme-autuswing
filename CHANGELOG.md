# Changelog / 更新日志

本项目遵循语义化版本约定（Semantic Versioning）。

## [0.2.0] - 2026-11-26

Autuswing for Astro 首个公开开源发行版。

### Highlights / 核心亮点

- **Astro 7 静态博客架构**：基于 Astro 7.4 与内容集合构建，支持 `content/posts/` 文章、`content/pages/` 独立页面、`new-post` 短编号模板、草稿隔离与系列文章章节导航。
- **三端响应式阅读布局**：桌面完整侧栏、文章页 72px 迷你导航栏 + 独立停靠目录（带即时悬浮提示气泡）、平板侧栏与移动端顶部导航 + 底部抽屉目录；收起目录或中等屏幕下正文自动居中，跨文章记忆目录开关偏好，短文章（少于 2 个标题）保持完整侧栏。
- **跨浏览器页面转场**：支持原生跨文档 `@view-transition`，并为 Firefox / Gecko 等暂不支持原生跨页转场的浏览器提供轻量 CSS 退场/进场过渡，完整尊重 `prefers-reduced-motion`。
- **双语 YAML 配置**：`src/config/` 下 `site.yml`、`theme.yml`、`environments.yml`、`redirects.yml` 全部提供中英文逐项注释，修改保存即生效。
- **构建时数学公式与阅读工具**：自动检测含公式页面并按需加载本地 KaTeX 0.19.0 样式与字体（0 客户端渲染脚本）；内置静态全文搜索、RSS / Atom / Sitemap、PWA 离线支持与六种可选评论适配器。
- **在线演示与文档**：提供线上演示站 <https://demo.akisenn.com/>、中英文 README 与完整配置指南。
