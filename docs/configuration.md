# 配置迁移与消费边界

`src/config/site.json` 保留站名、描述、作者、语言、时区、正式 URL、root 和每页数量。`theme.json` 保留本站的外观和服务配置。导航、社交条目和背景列表在 `site.config.ts` 从原始数据派生，不保存容易过期的 menu_items/social_items 缓存。

完整逐键记录见 `migration/config-consumption.json`；迁入时的旧设置快照见 `migration/legacy-options.json`。这些是迁移证据，新站只读取 `src/config/`。

| 原配置范围                                                             | 新位置与行为                                                                                                        |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| avatar/favicon/apple_touch_icon、profile、since、menu、social、friends | site.config + Astro 组件；同一导航与外观数据，不绑定未来某套导航 DOM                                                |
| appearance、cards、animations                                          | 品牌 CSS token、三端布局与 visual.css 阅读样式；完整侧栏240–300px，平板72px；正文始终可见，关闭动画时不进行卡片位移 |
| article、reading、copyright                                            | 内容工具、PostCard/PostLayout、TOC、复制/分享/灯箱/阅读模块；related 仍关闭                                         |
| search                                                                 | 静态 search.json + 独立纯排序/浏览器模块；NFKC、多词 AND、12/6/1 权重与失败重试                                     |
| feed                                                                   | 官方 RSS + 独立 Atom，共用筛选；limit=0 表示全部，full_content 可选                                                 |
| seo                                                                    | SeoHead、官方 sitemap 与旧入口别名、robots；已公开日期稳定；预览强制 noindex                                        |
| comments 与六种 provider                                               | 稳定标识解析 + 原适配器；按页开关、延迟、收起、重试和主题同步；真实服务未开启                                       |
| math                                                                   | KaTeX 构建时渲染，自动检测公式；旧 mathjax/katex 字段兼容启用标记，仅含公式页面引用配套 CSS，详见 math-rendering.md |
| footer.runtime / visit_counter、analytics                              | 关于页计时、可选计数/分析模块；预览禁止外部计数/分析；原站关闭状态保留                                              |
| assets.image_fingerprint / cdn / preconnect                            | 图片 query 哈希、Vite assetsPrefix 与数学资源前缀、head preconnect                                                  |
| open_in_new / exclude                                                  | Markdown HTML 树上的站外链接增强，不修改原稿                                                                        |
| performance                                                            | Astro/Vite 压缩、可选 gzip/Brotli 侧文件、缓存头、渐进预取；侧文件不表示服务器已启用对应编码                        |
| pwa                                                                    | 静态 manifest、隔离 cache 名称的 SW、离线页；不缓存全部文章 HTML                                                    |

## 移除的旧构建控制项

`appearance.base_font_size` 为手机正文基准，默认16px；桌面/平板正文在基准上加1px。自定义代码字体、品牌色和圆角继续可用。默认卡片使用实色表面；显式启用背景图时才使用对应背景模糊，正文内容不依赖动态效果显示。

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
