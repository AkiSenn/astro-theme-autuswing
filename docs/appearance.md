← [项目首页](../README.md) · [文档首页](index.md)

# 外观与阅读布局

森林绿、浅纸色和日期卡片构成 Astro 版的阅读基调。侧栏延续经典博客识别，正文使用清晰的留白；默认实色表面，启用背景图时再应用相应材质。实现依据与正式站差异见[源码状态](repository-state.md)。

## 深浅色与个人信息

在自己的独立副本编辑 `src/config/theme.json` 的相应键，不用完整替换文件。这里列出的是局部字段：

```json
{
  "color_mode": "auto",
  "avatar": "/img/my-avatar.webp",
  "profile": {
    "author": "你的名字",
    "subtitle": "慢慢记录，认真生活。"
  }
}
```

`color_mode` 使用 `auto`、`light` 或 `dark`；访客可通过外观按钮切换。作者、标语是站主内容，不在界面翻译文件里修改。本地静态图片放在 `public/img/`，URL 写 `/img/文件名`，不包含 `public/` 或本机盘符。

`avatar`、`favicon`、`apple_touch_icon`、`seo.social_image` 与 `pwa.icon` 是独立设置。文档中的新项目 Logo 尚未写入运行目录，也未替换现有头像或图标；素材入口见[品牌说明](branding.md)。

## 排版与背景

| 字段 | 用途 |
| --- | --- |
| `appearance.base_font_size` | 手机正文基准；平板和桌面按布局增加字号 |
| `appearance.sidebar_width` | 桌面完整侧栏宽度；CSS 将其限制在 240–300px |
| `appearance.width` | 内容区宽度输入；各布局仍有自己的上限 |
| `appearance.radius`、`accent` | 圆角与主色 |
| `appearance.font_family`、`code_font` | 正文与代码字体；字体文件和许可需另行准备 |
| `appearance.background_image` | `false` 关闭；支持图片地址、列表或现有内置背景编号数量 |
| `appearance.background_overlay` | 全站背景遮罩 |
| `cards.wallpaper`、`wallpaper_overlay` | 卡片背景图与遮罩 |

全站背景列表按页面路径稳定选图。单篇 front matter 的 `wallpaper` 覆盖默认卡片壁纸，`wallpaper: false` 关闭该文章的继承；`cover` 是独立封面。图片地址需与实际资源一致，未确认授权的内置壁纸不作为公开发行素材推荐。

Astro 版不会照搬 Hexo 的悬停抬升和头像摇晃：卡片保持位置稳定，动效设置在 `motion.enable` / `motion.page`，尊重系统减少动态效果。CSS 对不支持的效果提供相应回退，不宣称所有浏览器都有相同转场。

## 三端阅读

| 场景 | 布局 |
| --- | --- |
| 桌面首页、普通页 | 完整侧栏与文章列表 / 页面 |
| 桌面文章 | 迷你导航与独立目录；可用空间不足时折叠目录 |
| 平板 | 迷你栏，目录按布局打开与关闭 |
| 手机 | 顶部品牌和横向导航，文章目录入口与可收起面板 |

目录、搜索、图片查看的焦点与互斥由客户端模块管理。正文无须等待入场动效才可见；章节高亮保留，阅读进度条已移除。目录设置使用 `reading.toc`、`article.toc`，单篇可写 `toc: false`。

详见[当前正式站截图](preview.md)、[配置说明](configuration.md)；精确断点与样式职责见[源码指南](source-guide.md)，历史设计讨论集中在[文档索引](index.md)。本轮未加入测试站的阅读联动原型。
