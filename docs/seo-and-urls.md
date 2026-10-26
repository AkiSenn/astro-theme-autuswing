← [项目首页](../README.md) · [文档首页](index.md)

# SEO、搜索、订阅与永久链接

这些能力来自 Astro 内容集合、路由与静态端点，不能沿用 Hexo 配置教程。域名和路径既影响搜索引擎，也影响订阅与评论身份；当前仓库保留原站迁移契约，跨站与子路径使用尚需验证。

## 稳定地址与日期

历史文章使用 `/post/原编号/`，新稿命令在创建时保存 `id` 与 `permalink: '/编号/'`。显式 permalink 优先，已有编号、前导零和自定义地址应保留。构建不会重新随机分配编号，也不把文章标题当作永久链接。

自定义 `.html` 路径输出 HTML 文件，目录路径输出 `index.html`。重复编号、路径冲突、跨域 permalink 和路径穿越会阻断构建。旧地址跳转来自迁移清单，生成 HTML 与 `_redirects` 等交付资料；真正的 HTTP 跳转需托管环境采用相应规则。

日期和 updated 的稳定回退、草稿及旧稿受控修订见[写作指南](writing.md)。不要通过刷新构建时间伪造最后修改时间，不覆盖迁移清单来消除错误。

## 元数据与站长验证

`src/config/site.json` 提供正式站点身份，`theme.json` 的 `seo` 分组控制地图、JSON-LD、社交图片和验证值。页面输出 canonical、Open Graph、Twitter Card、文章发布日期 / 修改日期及可选 JSON-LD。验证字段只填对应 meta 的 content 值，账号认证与地图提交需要站主自行完成。

默认预览输出 noindex；它与正式 canonical 分开处理。noindex 是抓取提示，不是访问控制。`password` 字段也不提供内容加密，不能把私密内容放入静态公开产物。

## 地图与端点

| 路径 | 行为 |
| --- | --- |
| `/sitemap-index.xml`、`/sitemap-0.xml` 等 | Astro Sitemap 集成负责索引和分片 |
| `/sitemap.xml` | 保留原公开入口，内容来自上述索引 |
| `/baidusitemap.xml`、`/sitemap.txt` | 从生成的地图保留的兼容输出 |
| `/robots.txt` | 抓取策略；预览禁止抓取 |
| `/rss.xml`、`/atom.xml` | RSS / Atom，受 `feed` 分组控制 |
| `/search.json` | 按需读取的静态搜索数据 |

地图排除不可索引内容和特殊页面；草稿、未发布内容不进入公开路由与索引。`noindex`、`password` 与单篇 `search: false` / `feed: false` 分别参与相应筛选。排除索引不等于隐藏可访问的页面。

## 搜索与订阅

搜索使用规范化文本、多关键词匹配和标题 / 标签 / 正文权重，支持键盘操作。`search.enable`、内容长度和数量等选项见[配置](configuration.md)，不依赖外部搜索服务。

`feed.enable` 开关订阅，`feed.limit: 0` 表示全部，`feed.full_content` 选择摘要或全文。全文订阅会将相对链接转换为绝对地址；RSS 阅读器的样式与网站不同，不承诺复刻正文视觉。站点域名变更时应同时核对 canonical、Feed、地图、历史跳转和评论身份，而非只修改导航链接。
