# PC 完整侧栏底部分区

2026-10-17（Asia/Singapore），独立工程 `E:/autuswing-astro`。仅修改 `src/styles/responsive.css` 中 ≥1000px 的 `.desktop-sidebar .sidebar-bottom` 及后代；复用既有 `SiteTools`、`SocialLinks`，没有改组件模板、脚本、配置、图标或依赖。

## 调整内容

| 区域 | CSS 与行为 |
| --- | --- |
| 整个底部 | `display: flex; flex-direction: column; gap: 12px`；沿用 `margin-top: auto`、原有外层底部内边距及 `overflow: visible`；取消容器旧 `border-top` |
| 功能区 | 搜索与外观按钮 `justify-content: center; gap: 12px`，各 42×42px、内边距 0、圆角 10px，颜色为 `--text` |
| 按钮背景 | `color-mix(in srgb, var(--green-soft) 35%, transparent)`；悬停和键盘焦点时使用既有 `--green-soft`，保留全站 focus-visible 描边 |
| 唯一分隔线 | 移到社交区 `border-top: 1px solid var(--line)`，线上方 12px、线下方 `padding-top: 12px` |
| 社交区 | 原有四个品牌图标继续居中、等间距，20px SVG、44px 点击区域；清除旧 8px 上外边距，颜色为较弱的 `--muted` |
| 社交链接反馈 | 默认、悬停均为透明背景；悬停仅提升到 `--text`，键盘保留原焦点描边、title、aria-label 和自然顺序 |

没有使用绝对定位或 top/bottom 坐标。底部仍参与完整侧栏的 Flex 排布，较短窗口的外观规则与侧栏滚动能力保留。规则不匹配文章页迷你侧栏、平板栏、手机顶部工具或页脚。

## 验证与截图

新增 `tests/browser/sidebar-bottom.spec.ts`，检查：

- 深、浅色分别覆盖 1366×768、1920×1080、1440×900、1366×640、1000×640，共 10 组布局状态。
- 两个功能按钮尺寸、居中与弱背景；四个社交图标居中、透明背景；唯一分隔线、12px 间距、Flex 流布局。
- 导航与底部不重叠，无底部遮挡或内层滚动条；以点击目标中心实际命中测试排除覆盖。
- 搜索打开、正确搜索结果、Escape 返回、外观模式循环、功能与社交链接的 Tab 顺序、悬停及键盘焦点。
- 改动前分别捕获 Edge 和 WebKit 各 16 组页面/视口基线，逐项对比头像个人区、导航、卡片、正文、完整页脚、平板与手机工具的坐标、尺寸、字体、颜色、背景、边距与边框；避免混用不同浏览器的像素基线。

证据放在 [evidence/sidebar-bottom](evidence/sidebar-bottom/)。

| 视口 | 暗色侧栏 | 浅色侧栏 |
| --- | --- | --- |
| 1366×768 | [截图](evidence/sidebar-bottom/edge/sidebar-dark-1366x768.png) | [截图](evidence/sidebar-bottom/edge/sidebar-light-1366x768.png) |
| 1920×1080 | [截图](evidence/sidebar-bottom/edge/sidebar-dark-1920x1080.png) | [截图](evidence/sidebar-bottom/edge/sidebar-light-1920x1080.png) |
| 1366×640 | [小高度](evidence/sidebar-bottom/edge/sidebar-dark-1366x640.png) | [小高度](evidence/sidebar-bottom/edge/sidebar-light-1366x640.png) |

同时保存上述两个主要视口的完整页面截图，及同样规则下的 WebKit 截图。原有手机、平板社交链接测试继续覆盖每种浏览器 46 组页面/视口组合。

## 最终结果

机器汇总见 [summary.json](evidence/sidebar-bottom/summary.json)。

- Edge 14 项、WebKit 7 项定向浏览器测试通过，无失败、跳过或不稳定重试。覆盖原有桌面阅读、搜索/外观、社交区及本次新增检查；本次未重跑上一轮完整浏览器套件。
- 两种浏览器合计 20 组底部分区状态、32 组改动前后区域对比、92 组社交页面/视口组合通过。
- Astro 构建、类型检查通过；0 错误、0 警告，保留原有 1 条剪贴板 API 弃用提示。
- 16 项单元测试、77 项本地 Nginx HTTP 检查通过；26 个规范页面、879 个本地引用、4 个公式、3 条 RSS、26 条 Sitemap URL、21 条重定向验证通过。
- 原站 652 个文件哈希及原始 Hexo、Yelee-Next 的 Git 状态未变。

已实际检查 Edge 和 WebKit 渲染截图；WebKit 不等同于实际 Safari，Firefox 和手机/平板真机未验证。没有改动生产服务器、DNS 或部署配置。PC 文章页仍为迷你栏，要查看本次改动请打开[本地首页](http://127.0.0.1:8788/)并使用桌面宽度。
