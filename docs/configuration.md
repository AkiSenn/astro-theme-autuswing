← [项目首页](../README.md) · [文档首页](index.md)

# 配置迁移与消费边界

`src/config/site.yml` 集中管理品牌、作者、导航、社交及页脚身份，以及时区和每页数量。域名及路径在[部署环境](deployment-environments.md)（`src/config/environments.yml`）配置。`src/config/theme.yml` 管理外观和服务配置，配置文件内含中英文逐项注释。导航、社交条目和背景列表在 `site.config.ts` 从原始数据派生。

| 配置范围 | 位置与行为 |
| --- | --- |
| avatar/favicon/apple_touch_icon、profile、since、menu、social、friends | `site.yml` + 构建期校验；三端导航共用同一数据 |
| appearance、cards、motion                                              | 颜色、字体、圆角、卡片和动效。`motion.enable` 控制动效，`motion.page` 控制原生页面转场                                                                        |
| layout                                                                 | 响应式栏宽、内容留白和阅读密度，见下方布局配置                                                                                                               |
| article、reading、copyright                                            | 内容工具、PostCard/PostLayout、TOC、复制/分享/灯箱/阅读模块；related 仍关闭                                                                                     |
| search                                                                 | 静态 search.json + 独立纯排序/浏览器模块；NFKC、多词 AND、12/6/1 权重与失败重试                                                                                 |
| feed                                                                   | 官方 RSS + 独立 Atom，共用筛选；limit=0 表示全部，full_content 可选                                                                                             |
| seo                                                                    | SeoHead、官方 sitemap 与旧入口别名、robots；已公开日期稳定；预览强制 noindex                                                                                    |
| comments 与六种 provider                                               | 稳定标识解析 + 原适配器；按页开关、延迟、收起、重试和主题同步；真实服务未开启                                                                                   |
| math                                                                   | KaTeX 构建时渲染，自动检测公式；旧 mathjax/katex 字段兼容启用标记，仅含公式页面引用配套 CSS，详见 math-rendering.md                                             |
| site.runtime / footer.visit_counter、analytics                              | 关于页计时、可选计数/分析模块；预览禁止外部计数/分析；原站关闭状态保留                                                                                          |
| assets.image_fingerprint / cdn / preconnect                            | 图片 query 哈希、Vite assetsPrefix 与数学资源前缀、head preconnect                                                                                              |
| open_in_new / exclude                                                  | Markdown HTML 树上的站外链接增强，不修改原稿                                                                                                                    |
| performance                                                            | Astro/Vite 压缩、可选 gzip/Brotli 侧文件、缓存头、渐进预取；侧文件不表示服务器已启用对应编码                                                                    |
| pwa                                                                    | 静态 manifest、隔离 cache 名称的 SW、离线页；不缓存全部文章 HTML                                                                                                |

## 品牌、导航与社交

站点身份集中在 `src/config/site.yml`。见[站点身份配置](site-identity.md)的字段表、示例和迁移说明。主题的版权、Powered by、计数、分析等显示开关仍在 `theme.yml`。

## 移除的旧构建控制项

搜索保持 `/search.json` 的每篇一条记录格式，默认首次输入查询才下载，当前页面复用索引与规范化文本。`search.content` 开启时索引完整正文、行内代码及代码块；旧 `search.max_content_length` 字段保留配置兼容，但不再截断正文。`search.excerpt_length` 控制命中上下文长度；仅标题或标签命中时回退到文章摘要。草稿、未发布、noindex 和 `search: false` 的文章不进入索引。非空 `password` 会阻断内容校验；noindex 本身不提供访问保护。

`appearance.base_font_size` 为手机正文基准，默认16px；平板正文在基准上加1px。桌面文章页在基准上加2px（默认18px），行高1.8；桌面其他页面仍在基准上加1px。自定义代码字体、品牌色和圆角继续可用。默认卡片使用实色表面；显式启用背景图时才使用对应背景模糊，正文内容不依赖动态效果显示。

以下项已从新 theme.yml 移除，并在逐键清单中明确记录，不作为“已支持但无效”的选项保留：

| 旧键                                   | 处理理由与替代                                                                                                        |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| version                                | 原 Hexo 主题版本只保存在来源快照；新版本由 package.json 管理                                                          |
| urls.short / prefix / legacy_redirects | 历史文章保留 `/post/编号/` 及明确的 301 清单，新文章使用 `/编号/`；路由不由外观配置控制；自定义路径仍用文章 permalink |
| urls.length                            | **保留**在新配置，仅影响显式 new-post 命令；不影响历史编号或构建                                                      |
| search.path                            | 固定保留原公开 `/search.json` 入口；页面与端点共用这个契约                                                            |
| assets.critical_css                    | 手工关键 CSS 导出器移除，使用 Astro/Vite 的样式编译                                                                   |
| edge.provider / project_name           | 平台选择从主题 UI 配置移到 deployment 下的独立交付说明；不自动生成或发布多平台工程                                    |
| edge.asset_url                         | 与 assets.cdn 合并为单一资源前缀，当前为空；不改图片历史公开路径                                                      |

默认使用根路径 `/` 与中英文界面词典（`zh-CN` / `en`）；多环境域名与子路径在 `src/config/environments.yml` 配置。

在子路径构建中，配置和 Markdown 中以单个 `/` 开头的站内引用使用站点逻辑路径：例如在 `/archives/` 挂载下，正文的 `/archives/` 仍指归档页，输出为 `/archives/archives/`。不要在普通链接里手写部署前缀。相对路径、页面锚点和外站 URL 保持原意。

如果 Markdown 内联 HTML 必须使用最终发布地址，可在对应元素上标记 `data-autuswing-url-space="mounted"`，让该元素自己的链接、资源及内联 CSS 保留原值。旧内容中无歧义的预挂载静态文件仍兼容，包括正文和全文 Feed 的附件链接。静态构建以实际生成的路由和历史重定向为准；省略尾斜杠的已声明路由也具有优先权。只有去掉前缀后能找到实际的 public 文件、且原路径没有对应路由或静态文件时，才按历史附件处理。若挂载名恰好与目录路由同名，并在裸地址碰到一个实际静态文件，构建会在该地址保留归档页（沿用其规范 URL），把冲突文件保存到挂载内的 `/_autuswing/static/` 下。原始文件不变，实际下载地址记录在 `.astro/autuswing-build.json` 的 `routeCollisions` 中。子路径 PWA 的挂载和发布边界见[部署环境](deployment-environments.md#pwa)。

没有继承 SSH、宝塔发布器、生产 Worker 配置、访问凭据或另一站点数据。修改预览策略不自动授权部署。

## 基础外观配置

修改 `src/config/theme.yml` 的 `appearance` 后重新构建，无须修改组件。配置在构建时校验，错误会指出字段；不加载外部字体或增加客户端脚本。

| 字段          | 默认值 | 允许值与影响                                                                   |
| ------------- | ------ | ------------------------------------------------------------------------------ |
| `accent`      | `""`   | 空值沿用原浅绿/深绿；非空只接受 `#RGB` 或 `#RRGGBB`，作为两种模式共用强调色    |
| `accent_dark` | `""`   | 可选深色强调色；空值跟随 `accent`，两者为空时保留原深色强调色                  |
| `font_family` | `""`   | 逗号分隔的正文字体族，含空格的名称建议加引号；空值保留现有系统字体栈           |
| `code_font`   | `""`   | 同上，仅影响代码字体；空值保留 Cascadia Code / Consolas / monospace            |
| `radius`      | `18`   | 0–32 的数字，单位 px；仅调整现有 `--radius` 消费处，不改变按钮、弹层等独立圆角 |

例如将以上五项设为 `"#365d85"`、`"#b3cfee"`、`"Georgia, serif"`、`"Consolas, monospace"`、`8`。字体必须已安装或另行合法提供；建议保留通用后备族。自选强调色应分别检查浅深色可读性；本配置不自动调整背景、语法高亮或保证对比度。恢复空字体、空颜色与 `radius: 18` 即恢复现有设计。

两个字体字段均接受逗号分隔的列表。每项可为裸写的 CSS 标识符（支持 Unicode，多个词以普通空格连接）或单个带引号的名称；引号内的空格、逗号属于名称。通用字体关键字开头时须单独成项，例如 `serif, cursive`；`Noto Serif, serif` 仍有效。兼容性别名 `-webkit-body` 也须遵循这一规则。

`inherit`、`initial`、`unset`、`revert`、`revert-layer`、`revert-rule` 和 `default` 不可裸写，只按 ASCII 忽略大小写。裸写的 `revert-rule` 在目标引擎中接受情况不同；如确为字体名，请写 `"revert-rule", serif`。配置不支持控制字符、CSS 声明、注释、函数或转义。需使用标点或数字开头的名称时，优先用引号，例如 `"Hawaii 5-0", sans-serif`。

## 响应式布局与阅读密度

在 `src/config/theme.yml` 的 `layout.preset` 选择布局，再运行 `npm run build:preview` 和 `npm run preview` 查看效果。预设在构建时解析。

- `classic` 是默认预设，沿用 R3-A2-2 的布局和历史兼容规则。
- `editorial` 加宽侧栏、停靠目录和文章外框，使用宽松间距，适合长文阅读。
- `compact` 沿用 Classic 的宽度与横向留白，只缩短列表、卡片、段落和模块的纵向间距。
- `custom` 使用显式填写的字段。只填需要调整的项，其余按 Classic 的默认及兼容规则解析。

优先级为**显式字段 → 所选预设 → 兼容默认值**。尺寸使用有限的 JSON 数字，单位为 px，允许范围包含两个端点。

| 字段 | Classic / Custom 回退 | Editorial | Compact | 允许范围与生效范围 |
| --- | ---: | ---: | ---: | --- |
| `home_sidebar_width` | 272 | 300 | 272 | 240–320。窗口宽度 ≥1000px 时，首页和普通页面的完整侧栏 |
| `article_sidebar_width` | 72 | 88 | 72 | 68–104。窗口宽度 ≥720px 时，文章页的迷你侧栏。普通页的平板侧栏为 72px |
| `toc_width` | 260 | 288 | 260 | 180–320。窗口宽度 ≥1280px 时，文章停靠目录的宽度。收起目录时仍保留栏位 |
| `content_max_width` | 860 | 980 | 860 | 640–1120。窗口宽度 ≥1000px 时，文章外框上限，含边框和内边距。可用空间不足时收窄 |
| `desktop_gutter` | 24 | 32 | 24 | 16–40。720–999px 时是每侧留白。≥1000px 时，原有 `clamp(24px, 3vw, 64px)` 曲线整体加上配置值与 24px 的差值 |
| `mobile_gutter` | 16 | 20 | 16 | 8–32。窗口宽度 <720px 时，作用于普通页外壳留白、贴边文章卡片内距和文章页页脚留白 |
| `density` | `comfortable` | `spacious` | `compact` | `compact`、`comfortable`、`spacious`。控制文章段落、标题、列表项、首页卡片、页面区块和文章模块的纵向间距 |

`layout.preset` 选择一组布局默认值，`layout.density` 只调整纵向间距。三档密度 `compact`、`comfortable`、`spacious` 分别使用基准间距的 80%、100%、125%。例如 `preset: "editorial"` 可配合 `density: "compact"` 使用宽版尺寸和紧凑间距。

布局根据窗口宽度选择形态。<720px 使用顶部导航，720–999px 使用简化侧栏。1180px 横屏采用桌面侧栏，文章目录以弹层打开。1280–1439px 可手动展开停靠目录，1440px 起默认展开。以上阈值由主题管理。

省略 `preset` 等同于 `classic`。Classic、Compact 和 Custom 在省略 `layout.home_sidebar_width` 时读取旧 `appearance.sidebar_width` 并限制在 240–300px，旧字段也省略时采用 272px。Editorial 优先使用自己的预设侧栏宽度。显式填写 `layout.home_sidebar_width` 可覆盖任一预设。`appearance.width` 与 1120px 共同限制主内容外层和页脚宽度。

旧配置的 `layout.density` 仍视为显式覆盖。旧文件若含 `"density": "comfortable"`，切到 Editorial 后会采用舒适间距。删除该字段即可使用 Editorial 的宽松间距。其他显式尺寸也按同样的优先级处理。

### 宽阅读示例

以下虚构站点使用 Editorial，并将桌面文章外框上限调到 1040px。站点身份填写在 `src/config/site.yml`。

```yaml
title: "松窗笔记"
subtitle: "文字与代码"
description: "记录写作、设计和开发练习"
author: "林远"
language: "zh-CN"
timezone: "Asia/Shanghai"
per_page: 10
```

将下列键合入 `src/config/theme.yml`，保留文件中其余配置。

```yaml
layout:
  preset: "editorial"
  content_max_width: 1040
```

只想调整目录和手机留白时，可将 `layout` 设为 `{ "preset": "custom", "toc_width": 280, "mobile_gutter": 18 }`。

恢复 Classic 时，将整个 `layout` 对象替换为 `{ "preset": "classic" }`。也可以删去整个 `layout` 对象，让主题使用默认预设。若希望一并恢复旧字段的出厂值，把 `appearance.sidebar_width` 设为 `272`，`appearance.width` 设为 `1680`。

三种预设的实页对照见本次开发验收报告附带的截图索引，按页面和窗口尺寸查看。

构建错误会指出要修正的字段。`"preset": "wide"` 或 `"preset": null` 应改为四种预设之一。`"toc_width": "260px"` 应改为数字 `260`。`"desktop_gutter": 41` 应改为 16–40 内的数字。`"density": "normal"` 应改用表中的三个值之一。`NaN` 和 `Infinity` 会在 JSON 解析阶段报错。

```text
layout.preset: 使用 classic、editorial、compact 或 custom
layout.toc_width: 使用 180–320 的有限数字，单位 px
layout.desktop_gutter: 使用 16–40 的有限数字，单位 px
layout.density: 使用 compact、comfortable 或 spacious
```
