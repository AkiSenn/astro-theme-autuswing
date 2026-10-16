# 文章目录入口统一

2026-10-17（Asia/Singapore）。工程 `E:/autuswing-astro`，仅修改目录入口和状态协调，不修改文章、路由、正文宽度、字体、配色或部署。

## 定位与实现

原来的 `ArticleContents`、`TabletSidebar` 和 `BaseLayout` 分别提供顶部、迷你栏及悬浮目录按钮；`responsive.ts` 初始化时将全部按钮解除隐藏，`reading.ts` 滚动后又显示悬浮工具容器，因此入口会重叠。

移除文章顶部的 JavaScript 目录按钮，保留关闭 JavaScript 时的原生 details 降级目录。条目数量移入现有停靠面板和弹层标题，没有增加按钮或目录组件。沿用现有 `TableOfContents`、章节高亮、H2/H3 层级和滚动定位。

`responsive.ts` 的 `syncContents()` 统一管理所有目录按钮的 `hidden`、`aria-controls`、`aria-haspopup` 和 `aria-expanded`。通过实际可见的迷你侧栏选择入口，继续用现有 1280/1440px 停靠布局规则决定目录面板状态，不判断设备名称或横竖屏。

| 当前实际布局与状态 | 唯一目录操作 |
| --- | --- |
| 无固定迷你栏，目录关闭（当前 <720px） | 右下角悬浮按钮；页面顶部也可直接使用 |
| 有迷你栏，目录关闭（当前 ≥720px） | 左侧迷你栏目录按钮 |
| 停靠目录已展开 | 目录面板标题旁的收起按钮；隐藏迷你栏和悬浮入口 |
| 原生目录弹层已打开 | 弹层标题旁关闭按钮；隐藏背景目录入口 |

展开、关闭及跨断点切换统一发出 `reading-contents-change`，让 `reading.ts` 同步浮动工具容器并将当前章节保持在目录自身的可视区域。关闭后恢复到当下可见的入口；切换布局会关闭原生模态弹层，释放焦点限制。

## CSS 与修改边界

- 删除 `.contents-access > button` 的旧顶部按钮样式，以及 `<1000px` 下常态显示 `.contents-access`、强制 `#main` 顶部内边距为零的旧规则，避免移除按钮后残留空白条。
- `.contents-access` 默认继续 `display: none`；仅在无 JavaScript 且宽度不足 1280px 时显示原生 details，并使用原有降级排版。
- `.contents-count` 沿用现有 11px、弱化文字颜色与分隔线样式，放在标题旁。
- 正文 `max-width: 860px`、默认实际宽度 810px、桌面 18px/1.8、导航宽度 72px、目录宽度 260px 均不修改。
- 搜索、外观、返回顶部、复制链接及其他悬浮功能的节点和处理器保留；返回顶部仍按原来的 250px 滚动阈值显示。手机目录按钮不再依赖该阈值。

## 验证范围

新增 `tests/browser/contents-controls.spec.ts`，检查 21 组视口：320×740、390×844、430×932、719/720/721×900、768×1024、820×1180、999/1000×900、1024×768、1180×820、1279/1280/1281×900、1366×768、1439/1440/1441×900、1920×1080、2560×1440。每组检查关闭及打开状态始终只有一个目录操作按钮、标题计数、焦点恢复和横向溢出；另覆盖双向断点切换、手机顶部/滚动后使用、返回顶部与搜索。

另有滚动回归覆盖 390、719、720、768、1024、1279、1280、1366、1439、1440、1920px：将正文滚动 1200px，确认返回顶部已出现后，目录仍只有一个操作入口，并再次切换打开/关闭状态。两种浏览器各运行一次，补充在完整套件之外单独执行的新增用例。

原有响应式测试改为点击当前可见的唯一入口。修改前捕获的 16 组几何基线保存在 [before.json](evidence/contents-controls/before.json)。移除顶部按钮会使紧凑布局正文向上移动，回归检查保留正文宽度、字号、行高、正文高度及导航尺寸的严格比较，首页仍比较完整几何。

主要源码修改：`ArticleContents.astro`、`ReadingSidebar.astro`、`BaseLayout.astro`、`responsive.ts`、`reading.ts`、`responsive.css`；沿用 `TabletSidebar` 的原有按钮，不复制导航数据。

### 实际浏览器截图

| 视口 | 目录关闭 | 目录打开 |
| --- | --- | --- |
| 手机 390×844 | [悬浮入口](evidence/contents-controls/edge/contents-closed-390x844.png) | [弹层关闭按钮](evidence/contents-controls/edge/contents-open-390x844.png) |
| 平板竖屏 768×1024 | [侧栏入口](evidence/contents-controls/edge/contents-closed-768x1024.png) | [独立目录弹层](evidence/contents-controls/edge/contents-open-768x1024.png) |
| 平板横屏 1024×768 | [侧栏入口](evidence/contents-controls/edge/contents-closed-1024x768.png) | [独立目录弹层](evidence/contents-controls/edge/contents-open-1024x768.png) |
| PC 1366×768 | [侧栏入口](evidence/contents-controls/edge/contents-closed-1366x768.png) | [面板收起按钮](evidence/contents-controls/edge/contents-open-1366x768.png) |
| PC 1440×900 | [侧栏入口](evidence/contents-controls/edge/contents-closed-1440x900.png) | [面板收起按钮](evidence/contents-controls/edge/contents-open-1440x900.png) |
| PC 1920×1080 | [侧栏入口](evidence/contents-controls/edge/contents-closed-1920x1080.png) | [面板收起按钮](evidence/contents-controls/edge/contents-open-1920x1080.png) |
| PC 2560×1440 | [侧栏入口](evidence/contents-controls/edge/contents-closed-2560x1440.png) | [面板收起按钮](evidence/contents-controls/edge/contents-open-2560x1440.png) |

### 最终验收结果

机器汇总见 [summary.json](evidence/contents-controls/summary.json)，各次浏览器运行的 JSON 报告均保存在同一目录。

| 项目 | 结果 |
| --- | --- |
| Windows Edge 完整套件 + 新增滚动回归 | 53 + 1 项通过 |
| Playwright WebKit 完整套件 + 新增滚动回归 | 45 + 1 项通过 |
| 本地 Nginx 浏览器验收（Edge/WebKit） | 4 项通过 |
| 以上浏览器运行总计 | 104 项通过，无跳过、失败或不稳定重试 |
| Astro 类型检查 | 70 文件，0 错误、0 警告；1 条原有剪贴板 API 弃用提示 |
| 单元测试 / 本地 HTTP 检查 | 16 / 77 项通过 |
| 两次构建 | 355 个文件哈希完全相同 |
| 内容与产物校验 | 26 个规范页面、879 个本地引用、4 个数学公式、3 条 RSS、26 条 Sitemap URL、21 条重定向通过 |
| 原始资料 | 652 个原站备份文件哈希及两个原仓库 Git 状态未变 |

额外在两种浏览器的 1366/1920px 窗口中，各检查文章中段收起目录后清空面板滚动位置并重新展开，共 4 项通过：正文滚动位置不变，当前章节回到目录可视区域，见 [reopen-follow.json](evidence/contents-controls/reopen-follow.json)。

首轮定向检查为 19 项通过、2 项失败，发现无 JavaScript 模式的 details 目录被默认隐藏规则覆盖。将 noscript 显示规则提高为 `body .contents-access` 后重新构建，最终完整套件均通过无 JavaScript 降级检查；首轮失败不计作通过。

Edge 与 Playwright WebKit 的实际浏览器渲染不等同于真实手机、平板或 Safari 真机；Firefox 的现有 Windows 启动依赖故障未在本轮修复，不报告其通过。真实评论按用户要求继续关闭，没有新的 Lighthouse 测量。未修改正式站、DNS、宝塔服务器、原 Hexo 工程或 Yelee-Next。
