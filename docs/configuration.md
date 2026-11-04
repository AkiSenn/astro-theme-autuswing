# 配置迁移与消费边界

`src/config/site.json` 保留站名、描述、作者、语言、时区、正式 URL、root 和每页数量。`theme.json` 保留本站的外观和服务配置。导航、社交条目和背景列表在 `site.config.ts` 从原始数据派生，不保存容易过期的 menu_items/social_items 缓存。

完整逐键记录见 `migration/config-consumption.json`；迁入时的旧设置快照见 `migration/legacy-options.json`。这些是迁移证据，新站只读取 `src/config/`。

| 原配置范围                                                             | 新位置与行为                                                                                                                                                    |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| avatar/favicon/apple_touch_icon、profile、since、menu、social、friends | site.config + Astro 组件；同一导航与外观数据，不绑定未来某套导航 DOM                                                                                            |
| appearance、cards、motion                                              | 品牌 CSS token、三端布局与 visual.css 阅读样式；完整侧栏240–300px，平板72px；正文始终可见，motion.enable 控制动效，motion.page 控制原生页面转场；卡片始终不位移 |
| article、reading、copyright                                            | 内容工具、PostCard/PostLayout、TOC、复制/分享/灯箱/阅读模块；related 仍关闭                                                                                     |
| search                                                                 | 静态 search.json + 独立纯排序/浏览器模块；NFKC、多词 AND、12/6/1 权重与失败重试                                                                                 |
| feed                                                                   | 官方 RSS + 独立 Atom，共用筛选；limit=0 表示全部，full_content 可选                                                                                             |
| seo                                                                    | SeoHead、官方 sitemap 与旧入口别名、robots；已公开日期稳定；预览强制 noindex                                                                                    |
| comments 与六种 provider                                               | 稳定标识解析 + 原适配器；按页开关、延迟、收起、重试和主题同步；真实服务未开启                                                                                   |
| math                                                                   | KaTeX 构建时渲染，自动检测公式；旧 mathjax/katex 字段兼容启用标记，仅含公式页面引用配套 CSS，详见 math-rendering.md                                             |
| footer.runtime / visit_counter、analytics                              | 关于页计时、可选计数/分析模块；预览禁止外部计数/分析；原站关闭状态保留                                                                                          |
| assets.image_fingerprint / cdn / preconnect                            | 图片 query 哈希、Vite assetsPrefix 与数学资源前缀、head preconnect                                                                                              |
| open_in_new / exclude                                                  | Markdown HTML 树上的站外链接增强，不修改原稿                                                                                                                    |
| performance                                                            | Astro/Vite 压缩、可选 gzip/Brotli 侧文件、缓存头、渐进预取；侧文件不表示服务器已启用对应编码                                                                    |
| pwa                                                                    | 静态 manifest、隔离 cache 名称的 SW、离线页；不缓存全部文章 HTML                                                                                                |

## 品牌、导航与社交

站名、SEO 默认作者与离线页标题作者读取 `site.json` 的 `title` / `author`；正式链接和 Markdown 站外链接判断读取 `url`。侧栏、页脚版权和文章版权的默认署名仍读取 `theme.json` 的 `profile.author`，侧栏标语读取 `profile.subtitle`；两处作者可按用途分别设置，界面字典不保存个人信息。

`theme.json` 的 `menu` 按键的声明顺序生成三端共用导航。值可直接写路径，也可写 `{ "path": "/notes/", "icon": "book", "new_tab": true }`；`url` 是 `path` 的兼容别名，同时提供时优先 `path`，两者均空时回到 `/`。内置键 `Home` / `Archives` / `Tags` / `Categories` / `Links` / `About` 使用界面字典和默认图标，其他键原样显示；显式 `icon` 优先，未知导航默认使用 `globe`。

`social` 同样保留声明顺序。值可为 URL 字符串，或 `{ "url": "https://example.com", "icon": "globe" }`；兼容 `path` 别名，优先 `url`，未写图标时使用条目名。空字符串、`false` 和 `null` 不生成条目；`true` 不是有效链接，会明确报错。`profile.email` 非空且没有名称为 `Email` / `Mail`（不区分大小写）的有效条目时，才追加邮箱入口。RSS 仍单独由 `feed.enable` 控制。

页脚主题署名由可选的 `footer.theme_name` / `footer.theme_url` 设置；旧配置缺少这两项时仍使用现有 AutuSwing 名称与仓库链接。`footer.powered_by` 继续控制整组来源信息。版权开关、起始年 `since`、备案信息和 `footer.custom` 的消费方式不变。导航、社交和主题署名链接沿用 `safeLink`，不支持的协议及以 `//` 开头的地址回退为 `#`；新窗口链接保留安全的 `rel` 属性。配置类型与派生规则集中在 `src/lib/site-options.ts`，由 `site.config.ts` 连接 JSON 与视图，不需要修改三套导航模板。

## 移除的旧构建控制项

搜索保持 `/search.json` 的每篇一条记录格式，默认首次输入查询才下载，当前页面复用索引与规范化文本。`search.content` 开启时索引完整正文、行内代码及代码块；旧 `search.max_content_length` 字段保留配置兼容，但不再截断正文。`search.excerpt_length` 控制命中上下文长度；仅标题或标签命中时回退到文章摘要。草稿、未发布、noindex、password 非空和 `search: false` 的文章仍不进入索引；noindex 本身不提供访问保护。

`appearance.base_font_size` 为手机正文基准，默认16px；平板正文在基准上加1px。桌面文章页在基准上加2px（默认18px），行高1.8；桌面其他页面仍在基准上加1px。自定义代码字体、品牌色和圆角继续可用。默认卡片使用实色表面；显式启用背景图时才使用对应背景模糊，正文内容不依赖动态效果显示。

以下项已从新 theme.json 移除，并在逐键清单中明确记录，不作为“已支持但无效”的选项保留：

| 旧键                                   | 处理理由与替代                                                                                                        |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| version                                | 原 Hexo 主题版本只保存在来源快照；新版本由 package.json 管理                                                          |
| urls.short / prefix / legacy_redirects | 历史文章保留 `/post/编号/` 及明确的 301 清单，新文章使用 `/编号/`；路由不由外观配置控制；自定义路径仍用文章 permalink |
| urls.length                            | **保留**在新配置，仅影响显式 new-post 命令；不影响历史编号或构建                                                      |
| search.path                            | 固定保留原公开 `/search.json` 入口；页面与端点共用这个契约                                                            |
| assets.critical_css                    | 手工关键 CSS 导出器移除，使用 Astro/Vite 的样式编译                                                                   |
| edge.provider / project_name           | 平台选择从主题 UI 配置移到 deployment 下的独立交付说明；不自动生成或发布多平台工程                                    |
| edge.asset_url                         | 与 assets.cdn 合并为单一资源前缀，当前为空；不改图片历史公开路径                                                      |

root 当前固定 `/`、时区固定 Asia/Shanghai，匹配 akisenn.com 的迁移契约。跨域、子路径、多语言站点结构或另一站点内容合并不是第二阶段的已验收部署能力；中英文标签字典保留并用于界面文本与交互反馈。

没有继承 SSH、宝塔发布器、生产 Worker 配置、访问凭据或另一站点数据。修改预览策略不自动授权部署。
