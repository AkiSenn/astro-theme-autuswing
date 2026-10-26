<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/assets/autuswing-header-dark.svg">
    <img src="docs/assets/autuswing-header-light.svg" width="760" alt="Autuswing · 秋漾 — A, pages, swing and star">
  </picture>
</p>

<p align="center">
  <strong>让文字有处安放，让阅读慢下来。</strong><br>
  经典侧栏 · 森林绿 · 静态博客 · 自在阅读
</p>

<p align="center">
  <a href="package.json"><img src="docs/assets/badge-version.svg" alt="Development version 0.2.0"></a>
  <a href="https://astro.build/"><img src="docs/assets/badge-astro.svg" alt="Astro 7.4.0"></a>
  <a href="package.json"><img src="docs/assets/badge-node.svg" alt="Node.js >= 22.22.0"></a>
</p>

<p align="center">
  <strong>简体中文</strong> | <a href="README.en.md">English</a>
</p>

<p align="center">
  <a href="https://akisenn.com/">正式站实景</a> ·
  <a href="#preview">主题预览</a> ·
  <a href="#quick-start">快速开始</a> ·
  <a href="docs/index.md">阅读文档</a>
</p>

---

**Autuswing · 秋漾** 是一个基于 Astro 的独立博客主题项目。名字取自 **Autu**mn 与 **Swing**：秋日的风，轻轻摇荡的秋千，以及属于自己的书写节奏。

它保留经典博客侧栏的辨识度，让日期卡片、温润的森林绿和清晰的正文排版陪伴技术笔记与日常记录。从宽屏上的专注阅读，到平板和手机上的轻便导航，界面随着屏幕展开，也尊重访客的深浅色与减少动态效果偏好。

> [!NOTE]
> **正式站已使用 Astro，仓库仍在整理。** [akisenn.com](https://akisenn.com/) 于 2026-10-26 完成迁移并通过生产与真机验收，此状态由站点维护者确认。仓库仍为 Private，包版本 `0.2.0` 是开发版本；尚无正式 GitHub Release 或版本标签，也尚未整理为零配置的通用 Starter。生产封存候选与本分支有差异，见[源码与生产对应说明](docs/repository-state.md)。

<a id="preview"></a>

## 主题预览

<p align="center">
  <img src="docs/assets/responsive-showcase.webp" width="1100" alt="Astro 正式站：桌面首页完整侧栏、深色文章阅读、平板与手机布局">
</p>

来自 [akisenn.com](https://akisenn.com/) 的真实页面，采集于 2026-10-27；平板和手机尺寸由浏览器视口模拟。拼图仅排版原始截图，不替换页面内容。它们展示正式站外观，不代表本分支构建与生产产物逐字节一致，也不替代真机验收。[全部深浅色截图与采集说明](docs/preview.md)。

## 功能概览

下表按[文档基线](docs/repository-state.md)的实际实现整理。“可选”表示需要配置；外部服务接入能力与真实服务验收分开看待。

| 方向 | 已有能力与边界 |
| --- | --- |
| 外观 | 森林绿、日期卡片、日间 / 夜间 / 跟随系统；可选全站背景与文章卡片壁纸 |
| 响应式布局 | 桌面完整侧栏；文章页迷你导航与独立目录；平板迷你栏；手机顶部导航与可收起目录 |
| 文章阅读 | 字数与阅读时间、章节锚点、目录高亮、代码复制、图片灯箱、分享和相邻文章；已移除阅读进度条 |
| Markdown | Astro 内容集合、草稿隔离、普通 / 教程 / 系列模板、表格、脚注、提示块及代码行标记；系列字段暂不生成系列页 |
| 数学公式 | KaTeX 构建时渲染、自动检测公式、按需引用本地样式和字体；旧数学标记不表示切换为 MathJax |
| 搜索与导航 | 按需读取静态搜索索引、多关键词匹配、键盘操作、标签 / 分类 / 年月归档与分页 |
| SEO 与订阅 | canonical、Open Graph、JSON-LD、robots、站长验证字段、Sitemap、RSS 与 Atom；可选全文 Feed |
| PWA | 可选安装、生成图标和离线提示页；不缓存文章全文，不承诺离线阅读文章 |
| 性能与交付 | Astro 静态生成、Vite 资源指纹、压缩、图片资源管线、可选预取与预压缩；服务器缓存需另外配置 |
| 站点设置 | 作者、头像、菜单、社交、排版、页脚、备案及可选评论 / 统计；预览隔离真实评论与分析请求，外部服务需单独验收 |

跨站复用、子路径托管及公开发行包仍需整理与验证，不能将现有实现描述为这些场景已全部验收。完整入口见[配置](docs/configuration.md)、[外观](docs/appearance.md)及[写作](docs/writing.md)。

<a id="quick-start"></a>

## 快速开始

面向已有私有仓库访问权限的开发者，需要 **Node.js ≥ 22.22.0**。请使用独立副本并先保留已有工作。本仓库包含站主内容、配置和迁移约束，不能直接当作自己的站点发布。

```sh
git clone https://github.com/AkiSenn/astro-theme-autuswing.git
cd astro-theme-autuswing
git switch codex/astro-migration
npm ci
npm run dev
```

打开 <http://127.0.0.1:4322/>。本文命令和功能核对于该分支的 `f1d0e65`，后续分支更新可能有差异。停止开发服务后，可检查和生成静态预览：

```sh
npm run check
npm run build
npm run preview
```

默认构建输出 `dist/`，使用预览 noindex 策略；上述命令不会部署。`src/config/site.json` 管站点身份，`src/config/theme.json` 管主题设置；生产候选构建另有门禁。详见[开始使用](docs/getting-started.md)。

## 文档导航

| 你想做什么 | 阅读 |
| --- | --- |
| 本地运行、理解预览与构建 | [开始使用](docs/getting-started.md) |
| 设置作者、菜单与可选服务 | [配置入口](docs/configuration.md) |
| 调整深浅色、壁纸和阅读布局 | [外观指南](docs/appearance.md) |
| 写文章、使用草稿、图片与公式 | [写作指南](docs/writing.md) |
| 理解永久链接、搜索与订阅 | [SEO 与 URL](docs/seo-and-urls.md) |
| 了解静态托管与缓存 | [部署原则](docs/deployment.md) |
| 使用项目 Logo 和品牌素材 | [品牌说明](docs/branding.md) |
| 阅读源码、选择必要检查 | [源码指南](docs/source-guide.md) |

[全部文档与历史开发记录 →](docs/index.md)

## 从 Hexo 到 Astro

[Hexo Autuswing](https://github.com/AkiSenn/hexo-theme-autuswing) 是此前的独立主题；这里是 Astro 的独立演进版本。两者延续侧栏与阅读设计，但模板、内容集合、构建和交付方式已经改变，并非简单替换运行时。Astro 版本不需要 Hexo、EJS 或 Hexo 的主题安装命令。

保留历史文章、编号和旧地址，是原站迁移的兼容工作。未来新用户不应被要求复制站主文章或运行完整历史迁移流程；通用化说明将在发行范围确定后补齐。

## 验证

日常源码检查使用 `npm run check` 和 `npm test`；内容、输出、浏览器和视觉检查按改动范围选择，见[源码指南](docs/source-guide.md#validation)。历史报告仍可查阅，不作为当前分支的新验收结果。文档和品牌修改只需检查链接、图片、命令与渲染，无需重跑整套生产验收。

## 许可证、致谢与项目状态

此文档基线的 [LICENSE](LICENSE) 和包元数据保留 **MIT 声明**。筛选快照以 `UNLICENSED` 标记待核实的项目授权边界。既有 MIT 声明不能替代对实际继承片段的来源核查，也不表示已获准公开发行；本轮不改动既有许可证。

感谢 **Yelee / MOxFIVE**、**Yilia / Litten**、Autuswing Hexo 版及历史 Yelee Next 参考项目。具体沿用范围仍需逐项闭合，致谢不代替许可。文章、头像、壁纸、品牌图形、图标和字体各有权利边界；见 [THIRD-PARTY.md](THIRD-PARTY.md)、[随包资源声明](public/assets/vendor/THIRD-PARTY.md)和[剩余开源准备事项](docs/repository-state.md#open-source)。正式站运行状态与开源准备分别维护。
