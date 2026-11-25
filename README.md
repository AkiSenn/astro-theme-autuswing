<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/assets/autuswing-header-dark.svg">
    <img src="docs/assets/autuswing-header-light.svg" width="760" alt="Autuswing · 秋漾">
  </picture>
</p>

<p align="center">
  <strong>让文字有处安放，让阅读慢下来。</strong><br>
  经典侧栏 · 森林绿 · 静态博客 · 自在阅读
</p>

<p align="center">
  <a href="package.json"><img src="docs/assets/badge-version.svg" alt="Version 0.2.0"></a>
  <a href="https://astro.build/"><img src="docs/assets/badge-astro.svg" alt="Astro 7.4.0"></a>
  <a href="package.json"><img src="docs/assets/badge-node.svg" alt="Node.js >= 22.22.0"></a>
</p>

<p align="center">
  <strong>简体中文</strong> | <a href="README.en.md">English</a>
</p>

<p align="center">
  <a href="https://demo.akisenn.com/">在线演示站</a> ·
  <a href="#快速开始">快速开始</a> ·
  <a href="#配置文件一览">配置文件</a>
</p>

---

**Autuswing · 秋漾** 是一款基于 Astro 7 的响应式静态博客主题，灵感源自经典 Hexo 主题 Yelee。名字取自 **Autu**mn 与 **Swing**：秋日的风、轻轻摇荡的秋千，以及属于自己的书写节奏。

它保留经典博客侧栏的辨识度，结合温润的森林绿、卡片与排版系统、三端自适应阅读布局、构建时 KaTeX 数学公式、离线 PWA 与完整的 YAML 双语配置。

## 核心特性

- **外观与布局**：浅色 / 深色 / 跟随系统，支持自定义主色、字体栈、圆角，以及 `classic` / `editorial` / `compact` / `custom` 四种布局预设。
- **三端阅读体验**：桌面首页完整侧栏、文章页迷你导航 + 独立停靠目录、平板与移动端自适应导航，尊重 `prefers-reduced-motion`。
- **写作与内容**：`content/posts/` 写文章、`content/pages/` 写独立页（如 `about.md`），提供 `new-post` 短编号模板、草稿隔离、`dev:drafts` 本地草稿预览和系列文章章节导航。
- **数学公式**：构建时 KaTeX 渲染，自动检测含公式页面，仅在需要时引入本地样式与字体。
- **搜索与订阅**：按需加载的静态全文搜索（`/search.json`）、RSS（`/rss.xml`）、Atom（`/atom.xml`）、Sitemap、JSON-LD 与可选自定义 301 重定向。
- **评论与扩展**：内置 Giscus、Utterances、Disqus、Waline、Twikoo、Valine 六种评论适配器，以及可选 Vercount 访问计数与 GA / 百度统计（预览构建自动隔离）。
- **开箱即用的双语配置**：全部配置文件采用 YAML 格式并自带中英文逐项注释，修改即生效。

## 快速开始

环境要求：**Node.js >= 22.22.0**

```sh
git clone https://github.com/AkiSenn/astro-theme-autuswing.git my-blog
cd my-blog
npm ci
npm run dev
```

打开 <http://127.0.0.1:4322/> 查看实时预览。

## 配置文件一览

所有站主配置都在 `src/config/` 目录下，每个文件均内置完整中英文注释：

| 文件 | 用途 |
| :--- | :--- |
| [src/config/site.yml](src/config/site.yml) | 站点标题、作者、头像、语言（`zh-CN` / `en`）、分页、菜单、社交链接、友链、版权与备案、运行时长 |
| [src/config/theme.yml](src/config/theme.yml) | 色彩模式、字体、主色、圆角、布局预设、动效、搜索、订阅、阅读、评论、KaTeX、统计、CDN、PWA |
| [src/config/environments.yml](src/config/environments.yml) | 本地开发、预览站、正式站各自的域名（`origin`）与挂载路径（`basePath`） |
| [src/config/redirects.yml](src/config/redirects.yml) | 可选 URL 301 重定向规则（无需求保持 `[]` 即可） |

详细配置文档：
- [站点身份配置](docs/site-identity.md)（含 [中性示例](docs/examples/site-identity.yml)）
- [主题功能与布局配置](docs/configuration.md)
- [外观与排版指南](docs/appearance.md)
- [部署环境与子路径说明](docs/deployment-environments.md)

## 写作与常用命令

```sh
# 新建文章（自动生成唯一短编号并默认设为 draft: true）
npm run new-post -- "我的第一篇文章"
npm run new-post -- "系列教程" --template series --series "Astro 笔记"

# 本地预览（仅看已发布文章 / 包含草稿）
npm run dev
npm run dev:drafts

# 检查内容链接、类型与单元测试
npm run check:content
npm run check
npm test
```

- 文章放在 `content/posts/`
- 独立页面放在 `content/pages/`（例如 `content/pages/about.md` 对应 `/about/`）
- 静态图片放在 `public/img/`

## 构建与部署

先在 `src/config/environments.yml` 中取消 `production` 的注释并填入你的正式 HTTPS 域名：

```yaml
production:
  origin: "https://your-blog.example.com"
  basePath: "/"
```

然后执行生产构建：

```sh
# macOS / Linux
SITE_ENV=production npm run build
```

```powershell
# Windows PowerShell
$env:SITE_ENV = 'production'
npm run build
Remove-Item Env:SITE_ENV
```

静态产物输出在 `dist/` 目录，可直接部署到 **Cloudflare Pages**、**Vercel**、**Netlify**、**GitHub Pages** 或任意 **Nginx** 静态服务器。未设置 `SITE_ENV=production` 时默认构建为带 `noindex` 保护的预览模式。

## 致谢与许可证

以 [MIT License](LICENSE) 开源。灵感致谢 **Yelee / MOxFIVE** 与 **Yilia / Litten**；内置第三方资源授权见 [THIRD-PARTY.md](THIRD-PARTY.md) 与 [public/assets/vendor/THIRD-PARTY.md](public/assets/vendor/THIRD-PARTY.md)。
