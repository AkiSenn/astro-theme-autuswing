# Firefox 验收分类与测试修正

日期：2026-10-18。范围：上轮 7 项 Firefox 功能失败与 PWA 离线模拟差异。没有修改页面布局、字体、动画设计、文章、SEO 或部署配置；没有连接生产服务器。

## 当前结论

四项转场失败按实际能力执行了导航降级验收；PWA 离线测试使用真正的连接故障，并保留模拟离线差异检查。误用 Edge 基准的分支已移除，但 Firefox 自身的重复几何采集不稳定，**两项布局验收继续阻断，不能宣称全绿**。

本报告中的“连接故障”是本地测试服务器主动断开 TCP 连接，不是声称已经拔网线、关闭系统网卡或验收真实移动设备。

## 1. 原始 7 项失败逐项清单

完整原始日志与错误堆栈保留于[上轮 85 项报告](evidence/firefox-recheck-20261018/browser.json)、[运行日志](evidence/firefox-recheck-20261018/browser.log)和[失败摘要](evidence/firefox-recheck-20261018/summary.json)。下列为原测试名称，当前仍保留这些名称以便追踪。

| 原测试名称 / 文件 | 原预期 | 原实际 | 分类与本轮处理 |
| --- | --- | --- | --- |
| `smart return runs the existing native content transition` / `back.spec.ts` | 返回首页有 1 次 traverse 转场，动画为 page-in/page-out | 收到 0 次转场，5 秒断言失败 | 能力差异；Firefox 验证返回地址、traverse、正文可见、前进恢复、无残留动画；支持引擎保留原断言 |
| `native transitions keep the correct navigation shell across responsive layouts` / `motion.spec.ts` | 每个尺寸进入文章增加 1 次转场 | 0 次转场，首个尺寸失败 | 能力差异；Firefox 对全部 7 个尺寸验证文档确实切换、侧栏类型、目录更新、无溢出及返回；不是提前跳过循环 |
| `native MPA transitions use only the content group and refresh article state` / `motion.spec.ts` | 三次站内导航产生 3 次原生转场，仅 main-content 参与 | 0 次转场；此前页面及目录检查已执行 | 能力差异；Firefox 验证三个文档、最新目录、单一入口及可用搜索，要求没有半透明正文或模态残留 |
| `actual transition frames preserve the live shell and selected appearance` / `motion.spec.ts` | 捕获原生 80ms 动画帧，保留主题和稳定外壳 | `__frozenTransition` 为 false | 能力差异；Firefox 在深浅色下验证即时稳定正文和外壳、正确主题及目录；支持引擎继续验证动画帧与透明度 |
| `responsive layout geometry is unchanged after motion cleanup` / `motion.spec.ts` | 精确匹配其引擎的历史几何 | Firefox 错选 Edge；无边框序列化 `0px rgb(...)` 与 `0px none rgb(...)` 不同 | 测试基准错误已修正；独立 Firefox 参考重复采集仍失败，继续阻断，详见下节 |
| `footer, mini rail, profile, navigation and content remain equal to their own browser baseline` / `sidebar-bottom.spec.ts` | 各组件匹配自身引擎参考 | 同样误选 Edge，在首个隐藏个人资料区域失败 | 同上；没有覆盖 Edge 数据，也没有删去 border 或高度断言来通过 |
| `PWA installs its own shell cache and returns the offline page` / `state.spec.ts` | context 模拟离线后未知路径显示“暂时离线” | Worker 网络请求仍到达服务器，得到 404 | 自动化模拟差异；正式回退断言改用服务端断开连接，同时独立测试保留模拟行为、生命周期及缓存命中检查 |

### 复现步骤

当前代码的单项执行：设置可用的 `FIREFOX_EXECUTABLE_PATH`，然后运行：

```powershell
Set-Location E:\autuswing-astro
$env:FIREFOX_EXECUTABLE_PATH='E:\autuswing-astro\.local-tools\firefox-recheck-20261018\browsers\firefox-1555\firefox\firefox.exe'
$env:VISUAL_EVIDENCE_DIR='.local-tools/firefox-acceptance-repro/screenshots'
$env:PLAYWRIGHT_REPORT_FILE='.local-tools/firefox-acceptance-repro/report.json'
npm run build:preview
npm run test:browser:cross -- --project firefox tests/browser/back.spec.ts --grep "smart return runs"
npm run test:browser:cross -- --project firefox tests/browser/motion.spec.ts --grep "native transitions keep"
npm run test:browser:cross -- --project firefox tests/browser/motion.spec.ts --grep "native MPA transitions"
npm run test:browser:cross -- --project firefox tests/browser/motion.spec.ts --grep "actual transition frames"
npm run test:browser:cross -- --project firefox tests/browser/motion.spec.ts --grep "responsive layout geometry"
npm run test:browser:cross -- --project firefox tests/browser/sidebar-bottom.spec.ts --grep "own browser baseline"
npm run test:browser:cross -- --project firefox tests/browser/state.spec.ts --grep "PWA installs"
```

要复现修改前的预期与错误，使用提交 `634a21e` 的独立副本，并执行相同七条测试命令；不要在当前工作区撤销修改。示例：`git worktree add --detach E:\autuswing-firefox-repro 634a21e`，在新目录 `npm ci`、`npm run build:preview`，再设置浏览器路径和运行测试。浏览器路径可指向本机已有独立运行环境；不要将 Windows 原安装的 `spawn UNKNOWN` 与站点测试失败混为一谈。

## 2. 跨文档与同文档能力

[MDN 对 startViewTransition 的定义](https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API)明确其为同文档转场。跨文档需要 `@view-transition` 和相关导航生命周期。[MDN 的 PageRevealEvent 数据](https://raw.githubusercontent.com/mdn/browser-compat-data/main/api/PageRevealEvent.json)及 [@view-transition 数据](https://raw.githubusercontent.com/mdn/browser-compat-data/main/css/at-rules/view-transition.json)在本次查询时均将 Firefox 标为未支持。

本机 Firefox 157.0 的观测也表现为：同文档 API 存在，跨文档事件/规则未提供。不能因 `startViewTransition` 存在就要求跨文档动画事件，也不把这个结论无限推广到未来所有 Firefox 版本。

新增 `capabilities.spec.ts` 使用独立、同源、明确 opt-in 的两个 HTML 页面进行导航探测，防止把本站 CSS 失效误判为浏览器不支持。`transition-contract.ts` 同时核对 PageRevealEvent、PageSwapEvent、CSSViewTransitionRule 与 navigation:auto 的解析；与已知运行环境不符或出现部分支持时失败，要求重新审查。不会“没有收到事件就自动跳过”。

Edge/WebKit 的原生事件数量、320/120ms 时长、14px 位移、main-content 分组与帧透明度断言保留。Firefox 的四条测试仍实际执行各自的页面序列、文档更新、内容/外壳和可交互性检查，附加 fallback 模式证据；没有新增 skip、ignore、重试或超时扩容。

## 3. Firefox 参考与尚未解决的几何问题

`layout-reference.ts` 为 Firefox 选择单独目录，Edge/WebKit 继续读取原文件。新参考只从封存 r4 候选采集，记录原提交、READY、产物摘要、浏览器版本和文件哈希；不会用当前待测输出自动接受自身变化。它不是获批准的新像素基准。

进一步检查发现，即使原候选源码完全不变，在 320px 阅读页的两次采集间也会出现约 16px 的累计高度差。元素级记录显示，部分代码 `.line` 行框为 23.5px 或约 23.4px，而 CSS 声明行高未变；文章与页脚的累计位置随之变化。

已分别尝试等待字体、解码所有图片、两次 rAF、完整绘制/滚动以及独立固定视口 Context。图片加载确实影响完整页面高度，但**并不能消除代码行框差异**；独立 Context 的重复采集检查也拒绝了参考。最后再对每个尺寸完成整页截图后采集，同样在重复的 320px 阅读页出现 25520.150390625 / 25504.150390625 两种高度，严格校验失败。不能确认这是 Firefox 渲染器、Windows 字体解析还是其他环境因素，更不能仅凭旧 Bugzilla 的相似问题断定根因。

因此参考元数据明确为 `provisional-renderer-metrics-unstable`，普通测试读取时必须失败。只有采集器的同尺寸重复测量完全一致，才能产生 `validated-repeatable` 标志；采集器拒绝覆盖已有目录。既不取“碰巧通过”的那次数据，也不以宽松容差、删字段或修改页面字体来掩盖问题。

这两项是**未完成的精确布局验收**，不是已经修好的 Firefox 冻结基准。现有跨引擎响应式、正文宽度、导航/触控及溢出测试另有覆盖，不能替代这两项的验收标准。正式发布仍应阻断，直至定位差异并建立可重复、经审查的 Firefox 参考。

复现采集：

```powershell
# 输出必须是不存在的新目录；失败记录应保留。
npx tsx scripts/capture-firefox-reference.ts --release .local-tools/releases/autuswing-20261018-r4 --output .local-tools/new-firefox-reference
```

## 4. PWA：模拟、生命周期与实际故障

[Playwright setOffline](https://playwright.dev/docs/api/class-browsercontext#browser-context-set-offline)属于浏览器上下文的网络模拟。本轮同时验证页面 fetch、Worker 导航 fetch 和服务器请求记录，而不是把 navigator.onLine 当作断网证明。

- Firefox 模拟离线时，普通页面 fetch 失败，但 Worker 导航请求仍到达服务器，因此出现真实的在线 404。Edge/WebKit 的已测后端行为不同。测试明确记录这一差异；后端行为改变时要求重新审查。
- 真实连接故障由测试专用 loopback 服务器主动断开 socket。所有引擎都必须展示已缓存离线页，断言真实失败请求已发生，且缓存 HTML 字节与预期一致。
- 故障发生前确认 Worker 已 activated 且当前页面已有 controller。未安装时的首次访问必须失败，不能假装能离线首次访问；安装后的新标签页必须能够离线启动。
- 在线更新保留两个现有文档与未保存文本；已知旧壳缓存被删，搜索功能缓存保留。
- Worker 与离线 HTML 哈希不一致时，安装失败且旧壳仍可使用；恢复一致后新壳生效。
- 主动删除离线缓存后，受控页面的连接故障必须返回明确 503；恢复服务后正常显示文章。

`pwa-network.spec.ts` 附带服务器请求顺序、故障开关及缓存/Worker 状态记录。测试不需要 Nginx，统一通过 `npm run test:pwa` 执行三引擎。原功能测试和更新测试也使用同一故障设施，避免另写三套产品 Worker。

首轮新增测试暴露 Chromium 内部错误页在 goto 拒绝后仍会提交，打断随后的在线导航。已关闭失败的未安装页面，再以同一 Context 的新页面验证安装流程，消除测试自身导航竞争；未更改 Worker 或增加等待时间。首轮日志和修正后的日志均保留。

## 5. 修改范围与防误报

- 修改现有四项转场测试、两项参考选择和一项 PWA 功能测试；新增独立能力探测与 PWA 差异/冷启动/缓存丢失测试。
- 增加失败关闭的参考验证单元测试，拒绝错误引擎、字节变更、部分转场支持及未验收参考。
- 增加显式 Firefox 可执行路径和独立 PWA 测试入口；生产输入清单同时纳入新增 PWA 测试配置。
- 未修改产品 CSS、组件、脚本、Worker、文章、URL、SEO 或部署配置。Edge/WebKit 冻结图片、JSON 和视觉配置保持原样。

| 主要文件 | 职责 |
| --- | --- |
| [transition-contract.ts](../tests/support/transition-contract.ts)、[capabilities.spec.ts](../tests/browser/capabilities.spec.ts) | 实际能力分类、独立 MPA 探测、异常能力变化阻断 |
| [back.spec.ts](../tests/browser/back.spec.ts)、[motion.spec.ts](../tests/browser/motion.spec.ts) | 保留原生断言，加入完整 Firefox 降级序列 |
| [layout-reference.ts](../tests/support/layout-reference.ts)、[采集器](../scripts/capture-firefox-reference.ts)、[参考元数据](../tests/fixtures/firefox-layout/reference.json) | 独立引擎参考、来源与哈希、重复性门禁；当前仍拒绝接受 Firefox 参考 |
| [pwa-server.ts](../tests/support/pwa-server.ts)、[pwa-network.spec.ts](../tests/deployment/pwa-network.spec.ts) | 专用连接故障、模拟差异与生命周期证据 |
| [pwa-updates.spec.ts](../tests/deployment/pwa-updates.spec.ts)、[state.spec.ts](../tests/browser/state.spec.ts) | 多标签页更新、旧缓存、离线回退与恢复 |
| [playwright.pwa.config.ts](../playwright.pwa.config.ts)、[跨浏览器配置](../playwright.cross.config.ts) | 三引擎 PWA 入口与显式 Firefox 可执行路径 |
| [browser-contracts.test.ts](../tests/browser-contracts.test.ts)、[release-integrity.mjs](../scripts/release-integrity.mjs)、[发布回归](../scripts/verify-release-fixtures.mjs) | 拒绝不合格参考；新测试配置纳入构建输入与隔离副本 |

## 6. 本轮执行结果

浏览器/PWA 测试代码提交：`5c3c97a64bfd648f45c4221d6510db4fccf1accb`。随后隔离单元测试修复为 `f34a8e3`，未改动浏览器测试、产品源码或视觉基准。

| 验证 | 实际结果 |
| --- | --- |
| Astro 类型检查 | 0 errors、0 warnings；保留既有 execCommand 弃用提示 1 项 |
| 单元测试 | 38/38，包含 3 项新浏览器/参考规则检查 |
| 隔离发布回归 | 33/33，通过新增第 4 篇文章、删除后重建、草稿排除及各类错误阻断；独立副本内单元门禁也通过 |
| 预览构建与产物检查 | 构建成功；307 个导入文件、6 个可选资源及 879 个本地引用通过，3 篇草稿排除 |
| Firefox 完整套件 | 84/86 通过，2 项参考验收失败；0 跳过、0 重试后通过；进程退出码 1 |
| Edge 相关套件 | 8/8，通过原生事件、帧、原基准与 PWA 功能断言 |
| WebKit 相关套件 | 8/8，本轮原生转场事件与帧断言通过；不据单次通过宣称已排除前次间歇失败 |
| 三引擎 PWA 专项 | 15/15，含 Firefox 5 项；0 跳过、0 重试后通过 |
| Edge/WebKit 冻结视觉回归 | 106/106，通过；106 项完整串行运行，未更新基准或阈值 |

冻结的 274 张 PNG 和 274 份布局记录、原 Edge/WebKit 几何参考、产品源码与 3 篇演示草稿均已核对保持不变。对比原始报告还验证：85 个原有用例全部保留，原用例超时没有增加，所有用例均只有 1 次执行；只新增了 1 项独立能力探测，因此 Firefox 套件由 85 变为 86 项。

原始记录：[最终汇总](evidence/firefox-acceptance/summary.json)、[Firefox 完整报告](evidence/firefox-acceptance/firefox-full.json)、[三引擎 PWA](evidence/firefox-acceptance/pwa-confirmed.json)、[冻结视觉报告](evidence/firefox-acceptance/styles-final.json)、[发布回归](evidence/firefox-acceptance/release-fixtures.json)、[用例与超时保护](evidence/firefox-acceptance/assertion-protection.json)、[代码行框差异](evidence/firefox-acceptance/linebox-difference.json)。原始绘制/重复采集失败、初始隔离单元失败及 PWA 错误页竞争日志也在该目录保留。

已实际查看 [Firefox 暗色降级页面](evidence/firefox-acceptance/screenshots/fallback-frame-dark.png)和[浅色降级页面](evidence/firefox-acceptance/screenshots/fallback-frame-light.png)截图，正文与固定外壳保持可见。这些截图是补验证据，不能替代未通过的 Firefox 精确几何验收。

首轮新增 PWA 测试为 14/15，修正错误页导航竞争后完整重跑 15/15；两份记录均保留。Firefox 首轮定点复测的 2 项原始高度差，以及随后拒绝不稳定参考的失败也全部保留，没有用最终报告替换早期错误。

隔离发布回归另发现一项测试设施问题：新增 Node 单元测试读取了 `docs/evidence` 的 Edge 历史文件，而发布回归的独立副本只复制构建及测试输入，导致 ENOENT。单元测试改为读取自身 Firefox fixture，并保留错误引擎/字节改动/未验收状态的纯函数拒绝测试；浏览器中的 Edge 几何验证没有删除。修复后重新运行单元及完整发布回归。此问题不属于站点功能缺陷，原始隔离失败日志保留。

## 7. 发布判定

本轮已确认的转场能力降级和离线模拟差异不要求修改产品设计。没有确认需要修改产品代码的功能缺陷。

两项 Firefox 几何参考仍不具备重复性，是明确未关闭的验收风险；前次 WebKit 原生转场计数问题也不能因 Firefox 降级通过而被消除。另需实际设备、安装 UI、宝塔/ESA 配置及回滚验收。构建成功、READY 或部分功能通过都不是正式发布授权，本轮没有部署。

`npm run test:browser:cross -- --project firefox` 当前返回 1，应阻断后续发布验收。既有 READY 仍只覆盖构建/内容门禁，本轮没有把它重新定义为浏览器验收通过，也没有配置自动部署。后续 CI 应保留这些测试的退出码；不能忽略 Firefox 失败后继续正式切换。
