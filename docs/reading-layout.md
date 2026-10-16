# 首页与文章页的 PC 布局分离

后续已统一目录入口：手机使用悬浮按钮，迷你栏布局使用侧栏按钮，停靠面板展开后只显示面板收起按钮。最新行为、验证与截图见[目录入口统一](contents-controls.md)；本文保留本轮布局重构时的验收记录。

2026-10-17（Asia/Singapore）。独立工程 `E:/autuswing-astro`，本地预览 http://127.0.0.1:8788/ 。本次调整布局职责，不修改文章、路由、SEO、搜索、评论或生产部署。

## 原实现与本次修改

原来的 `BaseLayout` 在所有页面渲染完整桌面侧栏，文章目录嵌在 `DesktopSidebar` 的个人信息、菜单和底部工具之间。虽然目录已经使用Flex剩余高度，但仍与这些内容竞争768px等较短视口的空间。`TabletSidebar` 已经共享品牌、导航数组和工具组件，只是CSS限定在720–999px。

本次按文章集合类型选择侧栏，而不是按URL猜测文章类型：

- **首页及普通页面**保留 `DesktopSidebar`，首页只将个人区底部间距设为20px、导航间距设为4px。头像、AkiSenn、记录技术与生活、原有社交入口和配色保留，没有目录面板或目录占位。
- **文章页**直接复用 `TabletSidebar`，通过 `reading` 属性标记阅读导航；CSS提取为同一套迷你栏样式，没有复制导航数据。完整侧栏不再渲染在文章DOM中。
- **ReadingSidebar**为新增的独立目录组件，复用原有 `TableOfContents`。它只负责标题、收起按钮和目录滚动，不包含站点导航。
- **ArticleContents**保留原有的平板/手机目录弹层；1000–1279px的较窄PC也可从迷你栏直接打开该独立弹层，不压窄文章。弹层是用户主动打开的临时模态界面，不是持续覆盖正文的停靠栏。
- **responsive.ts**管理停靠/弹层选择、展开状态、Escape与跨断点焦点恢复。**reading.ts**保留章节高亮，并在独立目录内部跟随当前章节滚动，不用 `scrollIntoView` 移动正文。
- PC文章页的Email、GitHub、RSS等社交入口保留在页脚，避免移除完整侧栏后丢失功能。

## 宽度和状态

| 范围                 | 参数与行为                                                                                                                              |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| PC首页/普通页面      | 完整侧栏272px；主内容最大1120px，维持原有居中方式                                                                                       |
| PC文章导航           | `--layout-sidebar: 72px`；复用48px导航目标、44px工具按钮，原有title tooltip、可访问名称与focus-visible保留                              |
| 独立目录             | `--reading-contents-width: 260px`；`height: 100dvh`；外层Flex且overflow hidden，内部nav为`flex: 1 1 0; min-height: 0; overflow-y: auto` |
| 1440px及以上         | CSS直接默认展开目录，不等待JavaScript改变初始布局                                                                                       |
| 1280–1439px          | 停靠目录默认收起，可由迷你栏目录按钮展开                                                                                                |
| 1000–1279px          | 停靠栏隐藏且不预留其宽度；目录按钮直接打开原生dialog，文章尺寸不变                                                                      |
| 正文                 | 外层`width: 100%; max-width: 860px`；默认卡片内边距各24px、边框各1px，所以可用正文810px；保持18px/1.8                                   |
| 1280px及以上目录空间 | 有目录的文章主区域左外边距为72+260=332px，收起时保留该目录槽位，正文宽度、横向位置和滚动位置保持稳定。首页和无目录文章不预留该槽位      |
| 平板与手机           | 原720/1000断点、72px平板栏、手机顶部直接导航与独立目录入口不变                                                                          |

宽屏收起目录的取舍是保留一块安静的左侧留白，避免重新排版文章造成跳动。1000–1279px不保留这块留白，优先保证阅读宽度。无JS时，停靠宽度下直接展示目录，较窄窗口提供原生details目录；打印时隐藏导航和目录。没有增加正文宽度动画、主题系统或第三方依赖，原有减少动态效果设置继续生效。

## 构建、浏览器及截图

原始证据放在 [evidence/reading-layout](evidence/reading-layout/)。`before.json` 为修改前同一浏览器、减少动态效果条件下捕获的16组页面/视口基线；移动端回归比较主容器、正文、卡片、导航的完整几何和字号。

| 视口      | 首页                                                        | 文章默认                                                               | 文章目录展开                                               |
| --------- | ----------------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------- |
| 1366×768  | [完整侧栏](evidence/reading-layout/edge/home-1366x768.png)  | [默认收起](evidence/reading-layout/edge/reading-default-1366x768.png)  | [展开](evidence/reading-layout/edge/desktop-1366x768.png)  |
| 1440×900  | [完整侧栏](evidence/reading-layout/edge/home-1440x900.png)  | [默认展开](evidence/reading-layout/edge/reading-default-1440x900.png)  | [展开](evidence/reading-layout/edge/desktop-1440x900.png)  |
| 1920×1080 | [完整侧栏](evidence/reading-layout/edge/home-1920x1080.png) | [默认展开](evidence/reading-layout/edge/reading-default-1920x1080.png) | [展开](evidence/reading-layout/edge/desktop-1920x1080.png) |
| 2560×1440 | [完整侧栏](evidence/reading-layout/edge/home-2560x1440.png) | [默认展开](evidence/reading-layout/edge/reading-default-2560x1440.png) | [展开](evidence/reading-layout/edge/desktop-2560x1440.png) |

四种桌面尺寸的文章外层均为860px、正文810px，导航72px、目录260px；目录面板高度等于视口，正文相对主内容区域的居中偏差小于1px。展开/收起前后文章矩形完全相等。长目录使用自身滚动条；较高视口能容纳的目录无需强制滚动，额外长目录fixture继续验证内部滚动。

另在两种浏览器的1366px、1920px窗口中，检查文章中段收起目录、清空目录滚动位置后重新展开；4项检查均确认正文滚动位置不变，当前章节重新进入目录可视区域，见 [reopen-follow.json](evidence/reading-layout/reopen-follow.json)。

最终机器统计见 [summary.json](evidence/reading-layout/summary.json)。检查内容包括：首页/文章往返、目录高亮与H2/H3层级、点击跳转、滚动跟随、键盘焦点、Escape、减少动态效果、深色、基础axe、无JS、打印、窄桌面弹层与移动端104组页面/宽度组合。旧的“文章完整侧栏”精确测量用例已按本次明确变更替换为新布局契约；没有把不适用的旧断言继续当作当前要求。

最终结果：Edge 50项、WebKit 42项、Nginx浏览器4项全部通过，无跳过或不稳定重试；16项单元测试、77项HTTP检查通过。Astro检查70个文件，0错误、0警告，保留1条旧剪贴板API弃用提示。两次构建355个文件哈希相同，26个规范页面、3条feed文章、26条Sitemap URL及21条重定向校验通过；原站652个备份文件和两个原仓库Git状态不变。

首轮移动端几何对比因测试遗漏减少动态效果设置而遇到入场动画位移；统一为修改前相同条件后重新回归。最终结果以本目录完整运行报告为准，不将该次失败计作通过。

本轮使用真实启动的Windows Edge和Playwright WebKit进行浏览器渲染和截图；WebKit不能替代实际Safari真机。Firefox此前存在Windows启动依赖故障，本次未重复进行系统修复或声称Firefox通过。真实手机、平板硬件和浏览器原生缩放未在本次验收，触控模拟与字体放大不等同于真机。

本次没有重新进行Lighthouse测量，阶段五的性能记录保留为当时结果。生产DNS、宝塔、CDN、原Hexo站、Yelee-Next与516700.xyz未修改。
