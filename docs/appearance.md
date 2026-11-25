← [项目首页](../README.md) · [文档首页](index.md)

# 外观与阅读布局

本页说明 R3 的 Astro 外观配置。正式站截图的时间和来源见[截图与来源](preview.md)。

## 深浅色和个人信息

在自己的独立副本编辑 `src/config/theme.yml`（配色与开关）与 `src/config/site.yml`（作者、头像与标语）中对应的键：

```yaml
# src/config/theme.yml
color_mode: "auto"

# src/config/site.yml
author: "你的名字"
profile:
  avatar: "/img/my-avatar.webp"
  tagline: "慢慢记录，认真生活。"
```

`color_mode` 可选 `auto`、`light` 或 `dark`，访客通过外观按钮切换。作者和标语属于站主内容，不应写入界面翻译文件。本地静态图片放在 `public/img/`，URL 写 `/img/文件名`，不包含 `public/` 或本机盘符。

头像、`favicon`、`apple_touch_icon`、`seo.social_image` 和 `pwa.icon` 是独立设置。文档的新项目 Logo 没有替换运行目录或正式站图标；素材入口见[品牌说明](branding.md)。

## 排版和背景

| 字段 | 用途 |
| --- | --- |
| `appearance.base_font_size` | 手机正文基准，其他布局在其上调整字号 |
| `layout.home_sidebar_width` | 桌面完整侧栏宽度，显式值优先。部分预设在省略时回退至 `appearance.sidebar_width` |
| `appearance.width`、`radius`、`accent`、`accent_dark` | 外框宽度输入、圆角、浅色及深色主色 |
| `appearance.font_family`、`code_font` | 正文和代码字体；字体文件及许可另行准备 |
| `appearance.background_image` | `false` 关闭；可使用地址、地址列表或现有内置背景数量选择 |
| `appearance.background_overlay` | 全站背景遮罩 |
| `cards.wallpaper`、`wallpaper_overlay` | 默认卡片壁纸及其遮罩 |

背景列表按页面路径稳定选图。文章 front matter 的 `wallpaper` 覆盖默认壁纸，`wallpaper: false` 关闭该文章继承；`cover` 是独立封面。未确认授权的内置壁纸不作为未来公开包的可自由再分发素材推荐。

## 三端阅读与动效

| 场景 | 响应式布局 |
| --- | --- |
| 桌面首页、普通页 | 完整侧栏与列表 / 页面 |
| 桌面文章 | 迷你导航与独立目录，空间不足时折叠目录 |
| 平板 | 迷你栏和可开合目录 |
| 手机 | 顶部品牌、横向导航和目录面板 |

阅读工具包含章节高亮、回到顶部和代码复制。通过 `layout.preset` 选择 Classic、Editorial、Compact 或 Custom。Compact 默认只缩短纵向间距。尺寸、回退规则和显式配置优先级见[布局配置](configuration.md#响应式布局与阅读密度)。

目录设置使用 `reading.toc`、`article.toc`，文章可用 `toc: false` 关闭。动效由 `motion.enable` / `motion.page` 控制，尊重减少动态效果；main 的动效规则已移除旧头像摇晃和卡片位移，不承诺所有浏览器拥有相同的原生转场。

样式按令牌、布局、导航、卡片、正文、阅读工具和弹层等职责组织。入口见[源码指南](source-guide.md)和[样式架构](styles-architecture.md)。
