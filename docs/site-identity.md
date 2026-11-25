← [开始使用](../README.md)

# 站点身份

在 `src/config/site.yml` 填写自己的站点身份；`theme.yml` 继续管理外观、布局、预设和功能开关。构建时检查身份字段；组件通过同一个配置入口取得作者、品牌、导航和页脚信息。站点身份不会增加客户端脚本。

[完整中性示例](examples/site-identity.yml) 可作为起点。示例使用保留域名，在预览构建中使用；正式域名及发布校验仍按原有部署文档设置。新站应从生成的 Autuswing Starter 开始；更换身份配置不会移除当前实例的内容和静态资源。

| 字段 | 类型 | 缺省和用途 |
| --- | --- | --- |
| `title`、`description`、`author`、`language` | 必填，非空字符串 | 站点名称、默认摘要、站点作者和页面默认语言；沿用现有中英文字典 |
| `subtitle` | 字符串 | 可选副标题 |
| `profile.tagline`、`profile.bio` | 字符串 | 缺省分别隐藏侧栏标语、关于页简介 |
| `profile.avatar`、`favicon`、`apple_touch_icon` | 图片路径；`favicon` 也可为数组 | 站点根路径对应 `public/` 中现有文件，或 HTTP(S) URL；不填头像时显示通用图形 |
| `profile.homepage` | HTTP(S) URL | 可选作者主页；有此值时，站点作者的文章输出 Open Graph 和结构化数据作者链接 |
| `menu` | 必填对象，可为 `{}` | 按声明顺序输出，值为站内路径、HTTP(S) URL，或 `{ "path": "/notes/", "icon": "book", "new_tab": true }`；对象仍接受 `url` 别名 |
| `social` | 数组 | 每项有 `name`、可选 `url`、`icon`、`label`、`enabled`；省略名称以外的显示字段时按下文回退 |
| `friends` | 数组 | 友链页使用 `name`、`url`，可选 `description` |
| `footer.copyright` | 对象 | `holder` 缺省使用站点作者；`since` 为不晚于当年的整数年份，缺省只显示当年；跨年后重建 |
| `footer.registrations` | 数组 | 每项必填 `label`，可选 HTTP(S) `url` 和 `icon`；无链接显示文字，无记录不输出备案区 |
| `footer.statement`、`footer.extra` | 字符串 | 可选纯文本；仅从自己信任的配置迁移旧 `footer.custom` HTML 到 `footer.custom_html` |
| `runtime` | 对象 | 配置时填 `since`，沿用原日期解析规则，可选 `text`；不填则不显示关于页计时 |
| `seo.social_image`、`seo.twitter` | 图片路径、字符串 | 可选社交分享默认图、Twitter 站点账号 |
| `pwa.short_name`、`pwa.icon` | 字符串、站内图片路径 | 短名称缺省使用站名；图标原图至少 512 × 512，缺省不生成图标 |

内置导航键 `Home`、`Archives`、`Tags`、`Categories`、`Links`、`About` 使用现有翻译和图标，其他键原样显示。社交条目支持站内根路径、HTTP(S)、`mailto:` 和 `tel:`；缺少 URL、URL 为空或 `enabled: false` 的条目不生成链接。启用项目不得重复使用相同名称（不区分大小写）或 URL。标签和图标名分别回退到 `name`，未知图标显示首字母。RSS 入口仍由 `theme.feed.enable` 单独控制。

页面默认作者、Atom 作者、RSS `dc:creator` 均使用 `author`。文章已有显式署名时，其独立署名优先；版权主体的自定义仅用于站点页脚。备案只填写自己站点已获准展示的真实信息。主题的 AutuSwing 仓库链接是项目署名，与站长身份无关。

## 从上一版迁移

| 原位置 | 新位置 |
| --- | --- |
| `site.yml` 的站名、描述、语言和默认作者 | 保持原位置；删除重复的 `theme.profile.author` |
| `theme.profile.subtitle / aboutme`、`theme.avatar` | `site.profile.tagline / bio / avatar` |
| `theme.favicon / apple_touch_icon / menu / friends` | 移到 `site.yml` 的同名键 |
| `theme.social` 映射、`theme.profile.email` | 转为有序的 `site.social` 数组；邮箱作为显式 `mailto:` 条目，删除未启用条目 |
| `theme.since`、`theme.footer.icp*`、`theme.footer.police_icp*`、`theme.footer.custom` | `site.footer.copyright.since`、`site.footer.registrations / custom_html`；备案改为逐项填写 |
| `theme.footer.runtime` | `site.runtime`；只迁移已启用的计时 |
| `theme.seo.social_image / twitter`、`theme.pwa.short_name / icon` | 移到 `site.yml` 的同名对象中 |

例如 `src/config/site.yml: social[1].url must be a valid URL with an allowed scheme` 表示第二项的 URL 无效；请改为完整地址或受支持的本地路径。若提示头像文件不存在，检查路径是否相对于 `public/`，并确认文件名和扩展名。可选字段不使用空字符串或 `null` 作为占位（空社交 URL 除外）。

时区和分页保持原位置。旧 URL 和 root 迁移到 `src/config/environments.yml`；新站按 Starter README 配置。
