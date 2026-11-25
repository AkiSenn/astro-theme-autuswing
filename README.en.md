<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/assets/autuswing-header-dark.svg">
    <img src="docs/assets/autuswing-header-light.svg" width="760" alt="Autuswing · 秋漾">
  </picture>
</p>

<p align="center">
  <strong>A calmer place to read.</strong><br>
  Classic sidebar · Forest green · Static publishing · Room for your words
</p>

<p align="center">
  <a href="package.json"><img src="docs/assets/badge-version.svg" alt="Version 0.2.0"></a>
  <a href="https://astro.build/"><img src="docs/assets/badge-astro.svg" alt="Astro 7.4.0"></a>
  <a href="package.json"><img src="docs/assets/badge-node.svg" alt="Node.js >= 22.22.0"></a>
</p>

<p align="center">
  <a href="README.md">简体中文</a> | <strong>English</strong>
</p>

<p align="center">
  <a href="https://demo.akisenn.com/">Live Demo</a> ·
  <a href="#quick-start">Quick Start</a> ·
  <a href="#configuration">Configuration</a>
</p>

---

**Autuswing** is a responsive static blog theme for Astro 7 inspired by the classic Yelee theme. Built for fast, distraction-free reading with warm forest greens, build-time KaTeX math, static full-text search, PWA offline support, and bilingual-commented YAML configuration.

## Features

- **Appearance & Layouts**: Light / dark / system themes, custom accents, font stacks, border radius, and `classic` / `editorial` / `compact` / `custom` layout presets.
- **Responsive Reading**: Full desktop sidebar on listings, compact reading rail + docked TOC on articles, adaptive tablet and mobile navigation, and full `prefers-reduced-motion` support.
- **Authoring Workflow**: Write posts in `content/posts/` and standalone pages in `content/pages/` (`about.md`), with `new-post` templates, draft isolation, `dev:drafts` preview, and article series navigation.
- **Build-Time Math**: Automatic KaTeX rendering with zero client JS and on-demand local math CSS/fonts.
- **Search, Feeds & SEO**: On-demand `/search.json`, RSS (`/rss.xml`), Atom (`/atom.xml`), Sitemap, Open Graph, JSON-LD, and optional 301 redirects.
- **Comments & Integrations**: Built-in adapters for Giscus, Utterances, Disqus, Waline, Twikoo, and Valine, plus optional visit counters and analytics (automatically isolated in preview builds).
- **Bilingual YAML Config**: Clean YAML config files with Chinese & English inline comments for every option.

## Quick Start

Requires **Node.js >= 22.22.0**.

```sh
git clone https://github.com/AkiSenn/astro-theme-autuswing.git my-blog
cd my-blog
npm ci
npm run dev
```

Open <http://127.0.0.1:4322/> in your browser.

## Configuration

All user settings live in `src/config/` with inline bilingual comments:

| File | Purpose |
| :--- | :--- |
| [src/config/site.yml](src/config/site.yml) | Site title, author, avatar, language (`en` / `zh-CN`), pagination, menu, social links, friend links, copyright, registrations, runtime |
| [src/config/theme.yml](src/config/theme.yml) | Color mode, typography, accents, radius, layout preset, motion, search, feeds, reading UX, comments, KaTeX, analytics, CDN, PWA |
| [src/config/environments.yml](src/config/environments.yml) | Canonical `origin` and `basePath` for `development`, `preview`, and `production` |
| [src/config/redirects.yml](src/config/redirects.yml) | Optional 301 URL redirect rules (leave as `[]` if unused) |

## Authoring & Commands

```sh
# Create a new post (persists a unique short ID and defaults to draft: true)
npm run new-post -- "Hello World"
npm run new-post -- "Part 1" --template series --series "Astro Guide"

# Local development (published only / including drafts)
npm run dev
npm run dev:drafts

# Content check, typecheck, and unit tests
npm run check:content
npm run check
npm test
```

## Production Build & Deployment

Uncomment `production` in `src/config/environments.yml` and set your HTTPS domain:

```yaml
production:
  origin: "https://your-blog.example.com"
  basePath: "/"
```

Build static files into `dist/`:

```sh
SITE_ENV=production npm run build
```

Deploy `dist/` to **Cloudflare Pages**, **Vercel**, **Netlify**, **GitHub Pages**, or any static web server (Nginx, Caddy, etc.). Builds without `SITE_ENV=production` default to preview mode with `noindex` protection.

## License & Credits

Released under the [MIT License](LICENSE). Inspired by **Yelee / MOxFIVE** and **Yilia / Litten**. See [THIRD-PARTY.md](THIRD-PARTY.md) and [public/assets/vendor/THIRD-PARTY.md](public/assets/vendor/THIRD-PARTY.md) for bundled third-party notices.
