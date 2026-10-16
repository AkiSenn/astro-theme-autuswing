# 全站社交链接精简

后续仅对 PC 完整侧栏底部增加功能/社交分区，移置分隔线并细化按钮层级，见[侧栏底部优化](sidebar-bottom.md)。本文的手机、平板页脚方案继续保留，历史截图与验收记录不覆盖。

2026-10-17（Asia/Singapore），独立工程 `E:/autuswing-astro`。本次仅修改共享社交链接及页脚排布，沿用站点配色、图标、链接与其他布局。

## 源码与实现

- `SocialLinks.astro` 继续读取 `theme.social_items` 和 RSS 配置，移除可见文字 span；保留每个链接的 `aria-label`、`title`、原始地址、mailto、RSS 路径及外链属性。添加 `tabindex="0"`，确保本地 WebKit 默认设置下也按 DOM 顺序进行 Tab 导航；不用正数 tabindex 或自定义键盘脚本。桌面侧栏和页脚复用同一个组件，无独立数据副本。
- 直接使用现有 SVG sprite 的 `i-mail`、`i-github`、`i-bilibili`、`i-rss`。没有替换为通用图标，也没有新增图标库或依赖。
- `responsive.css` 统一 `.social-links` 及侧栏/页脚规则：Flex 横排、居中、`gap: 8px`，保留 wrap 以兼容将来的更多配置项。当前四项总宽 200px，窄屏无需横向滚动。
- 每个链接 `width/height/min-width/min-height: 44px`，`flex: 0 0 44px`，内边距为零、圆角 8px；SVG 为 20×20px。沿用全站 `:focus-visible` 的 2px 品牌色描边与 4px 外偏移；hover 使用已有 `--green-soft`，title 提供浏览器原生提示。
- 侧栏图标上间距 8px；页脚社交区下间距 12px，版权及备案继续用已有居中行和间距。`visual.css` 删除旧的侧栏 12px 图标间距覆盖，避免不同断点产生不一致。
- `Footer.astro` 保持分隔线、社交区、版权/Powered by、备案的顺序；可选访问统计移至备案之后，保留统计和自定义内容能力。原有 28px/36px 页脚纵向内边距、紧凑布局底部安全空间继续保留。

| 实际布局 | 显示位置 |
| --- | --- |
| PC 完整侧栏（首页、归档、标签、友链、关于等） | 侧栏底部四个图标横向居中，页脚副本隐藏 |
| PC 文章迷你侧栏 | 页脚居中，迷你栏不加入社交链接 |
| 平板迷你侧栏 | 页脚居中，迷你栏不加入社交链接 |
| 手机顶部导航 | 页脚居中 |

沿用既有页面类型及 720/1000px 布局规则，没有新增 JavaScript、导航数据或主题切换逻辑。桌面目录、正文宽度、文章卡片、SEO、搜索、评论和部署配置未修改。

## 检查方式与截图

新增 `tests/browser/social-links.spec.ts`，在两种浏览器中各检查 46 组页面/视口组合：

- 首页与文章覆盖 320×640、375×812、390×844、430×932、719/720×900、768×1024、820×1180、999/1000×900、1024×768、1180×820、1280×900、1366×768、1440×900、1920×1080、2560×1440。
- 归档、标签、友链、关于另在 390、820、1440px 检查。
- 每组确认只显示一组四个图标、链接地址与 SVG 对应正确、纯图标可访问名称齐全、20px 图形与 44px 点击区域、8px 均匀间距、水平居中、单行、无横向溢出；以 `elementFromPoint` 确认链接中心没有被悬浮工具遮挡。
- 覆盖深浅色、键盘 Tab 焦点、悬停反馈、title 和关闭 JavaScript 后的直接链接。

修改前的 Windows Edge 几何基线见 [before.json](evidence/social-links/before.json)。桌面测试文件加入同一浏览器的 16 组严格对比，确认正文、卡片、主内容与两种导航的 x/y/宽高、字号、行高均不变；只允许包围页脚的整页容器高度随社交区调整。精确像素基线不混用不同浏览器。

| 暗色视口 | 首页 | 文章 |
| --- | --- | --- |
| 手机 320×640 | [页脚](evidence/social-links/edge/social-home-320x640.png) | [页脚](evidence/social-links/edge/social-article-320x640.png) |
| 手机 390×844 | [页脚](evidence/social-links/edge/social-home-390x844.png) | [页脚](evidence/social-links/edge/social-article-390x844.png) |
| 平板竖屏 768×1024 | [页脚](evidence/social-links/edge/social-home-768x1024.png) | [页脚](evidence/social-links/edge/social-article-768x1024.png) |
| 平板横屏 1024×768 | [完整侧栏](evidence/social-links/edge/social-home-1024x768.png) | [迷你栏页脚](evidence/social-links/edge/social-article-1024x768.png) |
| PC 1366×768 | [完整侧栏](evidence/social-links/edge/social-home-1366x768.png) | [迷你栏页脚](evidence/social-links/edge/social-article-1366x768.png) |
| PC 1920×1080 | [完整侧栏](evidence/social-links/edge/social-home-1920x1080.png) | [迷你栏页脚](evidence/social-links/edge/social-article-1920x1080.png) |

另有[浅色页脚](evidence/social-links/edge/social-footer-light.png)、[暗色页脚](evidence/social-links/edge/social-footer-dark.png)，WebKit 对应截图保存在同级 `webkit` 目录。

1024px 横屏首页按现有宽度规则采用完整侧栏，文章仍为迷你栏；不使用“平板设备名称”强制改变已经完成的布局。

## 首轮发现与复查方式

Edge 首轮完整套件 57 项通过；WebKit 首轮 45 项通过、3 项失败，见 [webkit-initial-results.json](evidence/social-links/webkit-initial-results.json)，不将这次运行记作全部通过：

1. 社交区键盘测试发现本地 WebKit 的默认 Tab 遍历跳过未显式设置 tabindex 的链接。对照实验中，旧的带文字链接也会被跳过，设置 `tabindex="0"` 后可以依次进入 Email、GitHub、bilibili、RSS。因此将零 tabindex 加入共享组件，保持原生锚点与自然文档顺序。
2. 搜索结果的 5 秒断言遇到索引仍在加载；原测试独立重复 3 次，有 1 次通过、2 次超时，见 [search-repeat-results.json](evidence/social-links/search-repeat-results.json)。进一步在两个本地服务中分别检查不带主题的 JSON 请求及真实搜索，6 次搜索均返回正确结果，见 [search-diagnostic.json](evidence/social-links/search-diagnostic.json)。这些数据不足以宣称根因来自服务器或浏览器。本轮只为测试补充等待索引响应及其 body 完成，然后继续验证原来的一条正确结果，不修改搜索功能。
3. 触控导航的 URL 断言遇到页面仍在导航中；测试将目标 URL 等待与 tap 同时注册，导航完成后继续原 URL、目录与锚点断言，不修改导航功能。

测试没有增加原来的断言超时，没有重试后忽略失败，也没有删除功能断言。最终构建冻结后串行执行两个浏览器的完整套件，避免并行检查干扰诊断；最终结果另外记录。

## 最终验收结果

机器汇总见 [summary.json](evidence/social-links/summary.json)。

| 项目 | 结果 |
| --- | --- |
| 最终 Windows Edge 完整套件 | 57 项通过，见 `edge-final-results.json` |
| 最终 Playwright WebKit 完整套件 | 48 项通过，见 `webkit-results.json` |
| 最终本地 Nginx 浏览器验收 | Edge/WebKit 共 4 项通过 |
| 最终浏览器检查总计 | 109 项通过，无跳过、失败或不稳定重试 |
| 社交区页面/视口矩阵 | 每种浏览器 46 组，共 92 组；居中偏差小于 1px，无遮挡、重复或横向溢出 |
| Edge 修改前后严格几何对比 | 16 组通过；正文、卡片及导航排版不变 |
| 类型检查 | 70 文件，0 错误、0 警告、1 条原有剪贴板 API 弃用提示 |
| 单元测试 / 本地 HTTP | 16 / 77 项通过 |
| 两次构建 | 355 个文件哈希一致 |
| 内容与资源校验 | 26 个规范页面、879 个本地引用、4 个公式、3 条 RSS、26 条 Sitemap URL、21 条重定向通过 |
| 原始工程完整性 | 652 个文件哈希及两个原仓库 Git 状态未变 |

最终浏览器检查以冻结构建后的完整运行报告为准，首轮失败与原始搜索重复检查单独保存，不计为最终通过。

本轮已实际启动 Edge 和 Playwright WebKit 渲染并检查截图；WebKit 不等同于真实 Safari。Firefox 因此前的 Windows 启动依赖问题未验证；没有真机测试或新 Lighthouse 测量。评论继续按配置关闭，相关套件仅运行现有模拟适配器。未修改生产服务器、DNS、原始站点或 Yelee-Next。
