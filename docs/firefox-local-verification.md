# Firefox 本地补验

日期：2026-10-18。补验前次因浏览器启动失败而未执行的 Firefox 检查。未修改站点代码、测试断言、Markdown、部署配置或冻结视觉基准。

后续处理见[Firefox 验收分类与测试修正](firefox-acceptance.md)：本页保留第一次补验记录；后续已建立能力降级和真实连接故障测试，并明确保留两项不可重复的几何参考阻断。

## 浏览器已能运行

原默认缓存 `C:/Users/AutumnThousand/AppData/Local/ms-playwright/firefox-1555` 仍报 `spawn UNKNOWN`，Windows 日志记录 mozglue 从属程序集激活失败。重新从 Playwright 官方 CDN 下载同版本到项目的独立测试目录后，Firefox 157.0 成功启动。

不能简单归因于旧文件损坏：新旧目录顶层文件名和内容哈希相同，尚未定位原路径的 Windows 加载问题。没有修改系统注册表或覆盖原浏览器目录。当前可用的是独立 Playwright 运行环境，不是对系统 Firefox 安装的验收。

复用本轮运行环境：

```powershell
Set-Location E:\autuswing-astro
$env:PLAYWRIGHT_BROWSERS_PATH='E:\autuswing-astro\.local-tools\firefox-recheck-20261018\browsers'
$env:VISUAL_EVIDENCE_DIR='.local-tools/firefox-recheck-20261018/screenshots'
$env:PLAYWRIGHT_REPORT_FILE='.local-tools/firefox-recheck-20261018/browser.json'
npm run test:browser:cross -- --project firefox
```

## 实际结果

| 检查 | 结果 |
| --- | --- |
| 原有 Firefox 跨浏览器套件 | 78/85 通过、7 失败、0 跳过；保留原始失败，不称全绿 |
| 现有 PWA 专项移至 Firefox 执行 | 1/3 通过，2 项在离线模拟步骤失败 |
| 独立连接失败诊断 | 5/5 检查通过，使用封存 r4 候选和现有 Worker 生成器 |
| 生产候选完整性 | 359 个文件及源输入清单保持一致 |
| 冻结基准保护 | 274 张 PNG、274 份布局记录均保持原哈希 |

通过项涵盖普通及智能返回、历史滚动恢复、目录、搜索、复制、图片预览、数学公式、Markdown 样本、无 JavaScript 降级、键盘和触控、外观切换、可访问性、社交图标及多尺寸响应式布局。评论是现有受控适配器测试，未开通真实服务。四种桌面阅读视口为 1366×768、1440×900、1920×1080、2560×1440。

## 失败分类

### 4 项原生跨文档转场断言

`back.spec.ts:194`、`motion.spec.ts:75/138/357` 要求 `pagereveal.viewTransition` 或实际跨文档动画帧。本轮 Firefox 暴露 `document.startViewTransition` 和相关 CSS，但 `PageRevealEvent` 为 undefined，测试没有收到所需跨文档转场记录。

普通多页面导航、前进后退、滚动恢复、快速导航、无原生转场时的降级和减少动画测试通过。不能以同文档 API 存在就断言跨文档转场可用，也不能把这些原生动画失败记为通过。后续应按实际能力区分原生转场验收和降级验收，本轮不改测试或引入路由器。

### 2 项误用 Edge 的布局基准

`motion.spec.ts:434` 与 `sidebar-bottom.spec.ts:172` 当前用 `browserName === 'webkit' ? 'webkit' : 'edge'` 选择基准，因此 Firefox 被拿来与 Edge 比较。首次差异是同一无边框的计算样式字符串：Firefox 为 `0px rgb(...)`，Edge 为 `0px none rgb(...)`。

当前没有获批准的 Firefox 冻结基准。本轮没有为取得通过而更新基准、移除属性或放宽断言；保留失败，另有现成的跨引擎桌面尺寸与响应式功能检查通过。不能据首次字符串差异就断言所有后续尺寸都已精确匹配。

### 离线模拟与实际连接失败

原套件 `state.spec.ts:84` 及 PWA 专项 2 项使用 `context.setOffline(true)`。Firefox 的 Worker 在该模拟下仍能请求测试服务器，所以未知 URL 得到服务器的 404，而非离线壳。

独立诊断记录了模拟离线后服务器仍收到 1 次请求并返回 `Network is reachable`，随后改用测试服务器主动断开连接，验证 Worker 的真实 fetch 失败路径：

1. 在线更新成功，两个标签页及未保存文本保持原状。
2. 新标签页在连接失败时获得新版离线壳。
3. 恢复服务后能够访问在线文章。
4. Worker 与离线 HTML 混版时，保留前一可用壳。
5. 字节恢复一致后更新成功，并在连接失败时使用第三版壳。

以上 5 项通过支持现有 Worker 失败回退正常，但不替代原失败记录，也不等于实际设备断网、浏览器安装 UI 或所有 Firefox PWA 行为均已验收。后续应把连接故障方式纳入跨引擎测试设施。

## 截图与结论

实际查看了 [1920px 桌面](evidence/firefox-recheck-20261018/screenshots/reading-default-1920x1080.png)、[820px 平板](evidence/firefox-recheck-20261018/screenshots/article-back-820.png)和 [390px 手机](evidence/firefox-recheck-20261018/screenshots/article-back-390.png)截图。这些是补验证据，不是新的冻结基准。

Firefox 已可执行自动化，不再单纯处于“无法启动、未执行”的状态；其完整验收仍不是全绿。前次 WebKit 转场计数问题未在本轮解决。正式发布仍需完成跨浏览器验收、实际宝塔/ESA 配置核对和人工授权。

原始 [汇总](evidence/firefox-recheck-20261018/summary.json)、[85 项报告](evidence/firefox-recheck-20261018/browser.json)、[PWA 报告](evidence/firefox-recheck-20261018/pwa.json)与[连接失败诊断](evidence/firefox-recheck-20261018/network-probe.json)均已保存；执行的临时诊断源码另存为同目录 `.executed.txt`，复现时需恢复到其原 `.local-tools/firefox-recheck-20261018` 路径并从项目根目录运行。
