# Safari 14.8 / 16.0 响应式布局修复

日期：2026-10-18。开发与本地验证；未部署或修改服务器、DNS、ESA。

## 根因与证据

- WebKit 官方 [Safari 16.4 发布说明](https://webkit.org/blog/13966/webkit-features-in-safari-16-4/#css) 明确从 16.4 支持媒体查询范围比较和新增布尔语法。14.8、16.0 无法使用这些查询控制布局。
- 对 `https://astro.akisenn.com/` 的只读请求返回正确 viewport：`width=device-width, initial-scale=1`。CSS 为 `/_astro/BaseLayout.D_M-DZhX.css`，其中有 **52 条范围语法媒体规则**；包括手机页头、侧栏隐藏和正文边距。
- 下载 CSS 的 SHA-256 为 `2107ec2d3d23a57423c818ad9bb4d2d7d21672eecc5a303da6025174ee6f7f65`，与本地不可变 `autuswing-20261018-r4` 产物一致。HTML 和 CSS 均返回 200，响应为 Nginx。因而无须缓存错配即可解释问题；这些请求不能证明所有设备缓存或 ESA 控制面状态。
- 在相同 r4 产物、390px 视口中，仅剔除范围语法规则：首页完整侧栏从隐藏变为 272px 宽；首页及 `/post/55b0541c/` 正文左边距从 0 变为 272px，正文容器从手机宽度被挤压到 55px。保留查询时手机布局正常。这是受控语法故障实验，**不是 iOS 模拟器**。
- 用户真机的 `innerWidth`、页面缩放和“请求桌面网站”开关尚无远程调试数据，不能声称已核实；在正确 390px 视口下已能独立重现同一缺陷，故无需以桌面请求作为前提。

本地原始诊断证据在 `.local-tools/safari-legacy-20261018/`：`remote-css-audit.json`、`remote-home.html`、原始 CSS、`reproduction.json`、`print-query-probe.mjs`。没有读取或改写远端配置。

## 修复方式

1. 所有源码中的范围媒体查询改用传统 MQ3 条件。`width < 720px` 写为 `not all and (min-width: 720px)`；`720px <= width < 1000px` 使用嵌套的两个媒体条件。`screen` 限制仍保留。
2. 使用 [MQ3 的整条查询否定](https://www.w3.org/TR/mediaqueries-3/#syntax)，精确保留严格小于断点的语义，不采用 `719.98px` 等近似。嵌套的是条件分组，不是 CSS 选择器嵌套。
3. Vite `build.cssTarget: 'safari14'` 防止压缩器把传统 min/max 查询重新优化为 MQ4；不改变 JS target。单独对原始范围语法指定此 target 仍可能得到 `not (min-width: …)`，后者也是 MQ4，因此源码也必须使用完整 MQ3 写法。
4. `scripts/css-media-compat.mjs` 在静态构建结束、预压缩和封存之前，检查全部输出 CSS、HTML 内联样式（含 noscript）和 media 属性。使用明确的传统媒体查询语法子集，拒绝范围比较、条件否定和 MQ4 `or` 等写法。任何新增媒体查询超出此子集时，须显式审查，不能静默发布。

改动涉及 `astro.config.mjs`、`BaseLayout.astro` 的 noscript 样式、8 个现有 CSS 模块、构建集成、两份专项测试及直接 PostCSS 开发依赖。源码选择器、声明值和顺序均保持不变；不改文章、URL、SEO、生产配置或冻结基准。

完整文件范围：

- 构建：`astro.config.mjs`、`scripts/static-artifacts.mjs`、新增 `scripts/css-media-compat.mjs`。
- 响应式：`src/layouts/BaseLayout.astro`；`src/styles/` 下的 `cards.css`、`content.css`、`footer.css`、`layout.css`、`navigation.css`、`overlays.css`、`pages.css`、`reading.css`。
- 测试：新增 `tests/css-media-compat.test.ts`、`tests/browser/legacy-safari-media.spec.ts`。
- 依赖与说明：`package.json`、`package-lock.json`、本文。PostCSS 原已作为传递依赖安装，本次声明为直接开发依赖，未更改其版本。

## 其他语法审查与范围

- 没有以 CSS 选择器嵌套承载响应式布局。所有手机主布局规则可独立应用，不在 `@supports` 或 `@container` 中。
- `@container` 只增强平板首页双列卡片；旧浏览器忽略后沿用基本卡片布局。此次保留。
- `@supports` 为背景模糊降级，`@starting-style` 与 View Transitions 为动效增强，不控制手机侧栏切换。
- 既有 `:has()`、`dvh`、`color-mix()` 等并不因此获得完整旧 Safari 支持；本轮没有扩展成全站旧浏览器功能改造。专项故障模型只验证媒体查询语法与基础布局，不能代替这些特性的真机检查。

## 回归与复现

```powershell
npm test
npm run build:preview
npx playwright test tests/browser/legacy-safari-media.spec.ts
# Firefox 路径按本机安装设置；不修改生产配置
$env:FIREFOX_EXECUTABLE_PATH = 'E:/autuswing-astro/.local-tools/firefox-recheck-20261018/browsers/firefox-1555/firefox/firefox.exe'
npx playwright test --config playwright.cross.config.ts tests/browser/legacy-safari-media.spec.ts
npm run test:styles -- --workers 1
$env:RELEASE_FIXTURE_EVIDENCE = '.local-tools/safari-legacy-20261018/release-fixtures.json'
npm run test:release
npm run release:build
```

- 语法单测覆盖传统写法、嵌套分组、范围四种比较、区间表达式、MQ4 布尔否定和构建输出拒绝路径。
- 专项浏览器测试在 Edge / Firefox / Windows Playwright WebKit 上对比新旧查询，覆盖整数与小数临界宽度、screen / print。部分引擎将 iframe 视口取整，因此小数用同一视口内两种谓词的实际结果对比；整数另有独立预期。
- 无 JS 的语法故障模型检查首页、历史文章页在 320 / 375 / 390 / 430 / 719 / 720 / 768 / 820 / 999 / 1000 / 1024 / 1279 / 1280 / 1366 / 1439 / 1440 / 1920 / 2560px 下唯一可见的导航外壳、正文边距、无横向溢出和目录断点。固定产物不应有任何规则需要剔除。
- 原有冻结视觉检查保持原来的截图阈值和精确布局契约，禁止更新基准。专项测试初次暴露的 iframe 小数视口量化及 WebKit 媒体样式异步重算，已通过修正测试预期与同步处理；未据此改动产品样式或放宽验收。

### 本轮实际结果

| 检查                                   | 结果                                                               |
| -------------------------------------- | ------------------------------------------------------------------ |
| 最终生产门禁                           | 8/8，包含 54/54 单元测试                                           |
| 发布场景回归                           | 33/33，全部在隔离副本修改测试数据                                  |
| 三引擎媒体专项                         | 6/6，Edge、Firefox、Windows WebKit 各 2 项                         |
| Edge 现有手机/平板导航、触摸与目录交互 | 2/2                                                                |
| 冻结视觉/精确几何                      | 首轮 104/106；WebKit 320px 明暗两项整体超时，原样独立复测 2/2 通过 |
| 输出媒体语法                           | 全部 30 个 CSS/HTML 文件通过，旧 r4 CSS 被明确拒绝                 |
| 文件保护                               | 64 个原有修改/未跟踪文件、274 PNG、274 布局 JSON 字节均未变        |

视觉回归使用原来的 30 秒用例时限、20 秒截图断言时限、零差异像素预算及精确几何断言。没有放宽任何设置。对首轮两项超时保留日志与 JSON 结果；原封存 r4 在同一套测试中的 320px 明暗对照耗时 21.6s / 13.6s，修复版复测 16.4s / 11.9s，均通过同一冻结基准。该对照没有复现稳定的视觉差异，也不能据此关闭既有 WebKit 转场问题或把首轮改记为一次全绿。

本地最终候选：`.local-tools/releases/autuswing-20261018-safari-mq3-final/`，359 个文件，封存复验通过；尚未部署。新 CSS：`_astro/BaseLayout.Cw9Tuq_l.css`，SHA-256 `507bb9f8a9c17f4ee72901d019776ca1c4ffc190233c680d4ffc36cd2b6ecd83`。

详细日志均在 `.local-tools/safari-legacy-20261018/`：`production-gates.log`、`release-fixtures.json`、`edge-final.json`、`cross-specialist.json`、`styles.json`、`styles.log`、`original-320-styles.json`、`fixed-320-styles.json`、`output-audit.json`、`protection-before.json`、`protection-after.json`。

### 独立测试与真机验收

交接给「Autuswing · 浏览器兼容与测试」：重新运行门禁与专项测试，核对输出 CSS 和 noscript 样式无 MQ4 查询。使用真机 iOS 14.8、16.0 Safari 分别打开首页、历史文章页，记录 `innerWidth` / viewport meta / 页面缩放 / 桌面请求状态，以及 HTML 引用的 CSS 文件名和返回字节哈希；验证手机导航、正文宽度、旋转、滚动及目录入口。对缓存疑虑应比对 HTML 引用和封存产物字节，不能只清缓存后口头判断。

本机没有 iOS 14.8、16.0 设备或相应 Safari 运行环境，**不能宣称真实 iOS 验收通过**。Windows Playwright WebKit 版本更高。待独立测试通过后，由运维对话另行部署新测试站版本；本开发对话没有执行任何部署。此前 Firefox 精确几何和 WebKit 入站转场调查的未关闭状态不因本修复而改变。
