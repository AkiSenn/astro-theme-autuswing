# iOS 14.8 组件兼容修复与真机交接

2026-10-18。范围为本地开发和验证；没有修改或部署任何站点、服务器、DNS、ESA。iOS 16 已恢复手机布局，本次不再把问题归为整站桌面断点。

## 四张截图的结论

附件顺序与用户描述编号不同，以文件名和内容对应：

| 文件 / 内容               | 源码与实验确认                                                                                                                                                                      | 处理与尚需真机确认                                                                                                                                                                                |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `IMG_0057.png` / 代码块   | `.code-block` 负责圆角裁边，内部 `pre` 为 `overflow-x:auto`，长行没有从内容中删除。缺能力模型中能滚动到最右侧，文本保持完整，文档没有被撑宽。单张静态截图无法判断触摸滚动是否失效。 | 不改正文、代码或代码块设计；新增横向滚动专项。须在真机滑动长行到末端，确认没有只能看、不能滚的问题。                                                                                              |
| `IMG_0056.png` / 目录     | 原组件依赖原生 `<dialog>`、`showModal()`、UA 定位、`::backdrop`，无兼容回退；未知元素缺少默认隐藏/模态定位。目录 `dvh` 限高也没有旧单位回退。                                       | 增加缺 API 时的共享模态回退，恢复视口内底部目录面板、遮罩、关闭、焦点与内部滚动；保留现代原生路径。                                                                                               |
| `IMG_0055.png` / 搜索     | 同一原生能力缺失。对旧封存包剥离相应能力后，搜索以 inline 普通内容出现在页脚后一像素，点击报 `showModal is not a function`；文章页目录也提前进入文档流。                            | 增加显式关闭态隐藏及共享回退；搜索输入、结果键盘选择、关闭、返回位置均纳入验证。不是仅给普通内容添加背景。                                                                                        |
| `IMG_0054.png` / 首页间距 | 卡片列表的 `display:grid`、20px 间距依赖 `:has()`，缺能力实验中确认间距变为 0。相同实验的主容器左 padding 仍为 16px，**没有重现截图中全部左右留白消失**。                           | 用构建时数据属性替代这两处 `:has()`，相同选择器权重；主容器等值改为物理左右 padding。后者是兼容性简化，不能据此宣称已经证明该设备拒绝 logical padding。完整留白现象需真机计算样式与视口数据确认。 |

[WebKit Safari 15.4 发布说明](https://webkit.org/blog/12445/new-webkit-features-in-safari-15-4/)确认 dialog、backdrop、`:has()`、动态视口单位及 Array.at 在该版本新增；原 TOC 焦点循环使用的 `.at(-1)` 已替换为下标访问。[MDN 兼容数据](https://github.com/mdn/browser-compat-data/blob/main/api/HTMLElement.json)记录 iOS 对 `focus({preventScroll:true})` 的支持从 15.5 开始，回退不依赖该选项。

## 线上资源与缓存核查

本轮只读请求取得首页、历史文章、CSS 和 SW，均返回 200。首页 SHA-256 `0cbe5e3294f42d13a33a648bd82aa0ff113fbb790ac4edfc30b40e3b81e84436`；引用 `/_astro/BaseLayout.Cw9Tuq_l.css`，CSS SHA-256 `507bb9f8a9c17f4ee72901d019776ca1c4ffc190233c680d4ffc36cd2b6ecd83`，与已部署的 `4bbc770` 不可变包一致，无需旧 CSS 就能解释上述组件故障。

当前 SW SHA-256 `8cc299def6036036efafa40f03ceae1a2da1468828165b9088f4647fd987dbd6`，仅为同源导航提供网络优先、离线页回退；缓存写入目标只有 `/offline.html`，没有 CSS/JS 资源缓存路径。未清缓存、注销 SW 或强制刷新用户页面。**没有访问这台 iPhone 的 CacheStorage、控制它的 SW 或实际 CSS 响应**，不能断言该设备从未加载旧资源。真机复测仍需对照页面 CSS URL 和字节哈希。

原始只读响应、头和哈希见 `.local-tools/safari-components-20261018/remote-audit.json`、`remote-home.html`、`remote-article.html`、`remote.css`、`remote-sw.js`。封存旧包的缺能力对照见 `before-reproduction.json`。

## 实现范围

- `src/scripts/legacy-dialog.ts`：仅在缺少原生 showModal/close 时使用。临时将已有面板移到 body 下的视口遮罩容器，关闭后还原原 DOM 位置；不复制内容。不修改 UA，不识别设备型号。
- `dialogs.ts` 统一打开/关闭，保留原生引擎的 showModal/close 与动效；`responsive.ts` 为回退目录先解锁并恢复原位置，再执行用户选中的 fragment 导航。
- 回退提供 role/dialog、aria-modal、背景 aria-hidden 保存/还原、Tab/Shift+Tab 焦点循环、Escape、关闭按钮和遮罩关闭。允许弹层内部滚动跟随键盘焦点；显式保护文档位置，不依赖 focus.preventScroll 或 inert。打开时固定 body、记录完整原 style 和 scroll，关闭/替换/旋转/pagehide 清理；跟随 VisualViewport 的尺寸与偏移，供虚拟键盘打开时使用。
- `overlays.css`：显式隐藏未打开的 dialog；回退样式只作用于临时容器。滚动锁仅作用于打开的回退模态，不使用全局 overflow-x:hidden。
- `RouteContent.astro` 和 `cards.css`：非空 mica 卡片列表输出 `data-mica-list`，替代两处 `:has(> .mica-card)`。原 class、间距、边框和布局值不变；空列表与关闭卡片表面的配置仍沿用原样式。
- `layout.css`：主容器三个对称 padding-inline 改为同值 padding-left/right；`navigation.css`、`reading.css`、`overlays.css` 在全部 7 处 dvh 声明前加入等价 vh 回退，现代引擎仍取后面的 dvh。
- `scripts/css-media-compat.mjs` 补拒未打包的 `@import`，关闭此前独立测试发现的条件漏检；当前 Vite 将源模块导入打包，输出原本没有 @import。`tests/css-media-compat.test.ts` 增加负例。
- 新测试：`tests/support/legacy-safari.ts`、`tests/browser/legacy-safari-components.spec.ts`。没有新增第三方运行时依赖，没有修改文章、SEO、URL、视觉基准或生产配置。

## CSS 产物专项

最终产物须再次核查：无 `@layer`、未打包 `@import`、媒体查询范围语法或选择器嵌套；7 处新视口单位均有在前的 vh 声明。保留的两个容器查询只增强平板首页双列，在缺能力模型中全部忽略，基本卡片网格和间距仍成立。容器条件压缩后可显示为 `width>=660px`，它们不是手机 @media 规则。其余 `:has()` 用于渐进增强，手机主容器、卡片间距和回退模态不再依赖它。

## 验证方式与边界

缺能力模型在现代 Edge、Firefox、Windows WebKit 中移除 dialog API、open 属性、inert、Array.at，并模拟忽略 focus 选项、`:has()`、容器查询和 dvh；给未知 dialog 设置普通元素的初始样式。**这不是 iOS 14.8 模拟器**，不能验证其渲染器、触摸惯性、VoiceOver、真实软键盘或浏览器栏行为。

专项覆盖关闭态不占文档空间；320/390/430/768/820/1440px 首页间距；搜索三种关闭方式、焦点循环、背景隔离、精确返回滚动位置和原 style；目录面板尺寸、末尾链接可见、锚点与旋转；替换弹层、键盘搜索导航、图片预览；长代码滚动与无文档横溢。原生路径另外跑现有交互与冻结测试，不更新快照或容差。

首次测试发现的测量/实现问题均保留日志：浮点矩形差值不是 CSS gap 值，改为精确检查 computed gap=20px、grid 与实际存在间隔；Playwright 的 Locator.click 会先把 Chromium 的 sticky 页头滚回文档原点，滚动恢复测试改用用户实际可见位置的坐标点击。类名改变引起冻结节点标识变化后，改用数据属性；没有修改基准。发现旧 focus 选项也不支持后补入模型与显式位置保护，不以现代浏览器通过代替旧功能覆盖。

所有构建、测试、首次失败和复测日志放在 `.local-tools/safari-components-20261018/`。

### 最终开发验证结果

| 检查                     | 结果                                                                            |
| ------------------------ | ------------------------------------------------------------------------------- |
| 最终生产门禁             | 8/8，包含 55/55 单元测试                                                        |
| 隔离发布场景             | 33/33                                                                           |
| 三引擎旧组件缺能力模型   | 15/15（每引擎 5 项）                                                            |
| 三引擎原媒体兼容专项     | 6/6                                                                             |
| 三引擎现有原生交互选择集 | 每引擎 5 项均取得通过结果；WebKit 首轮 3 项超时，隔离复测 5/5                   |
| 最终冻结视觉/几何        | 首轮 105/106；WebKit 820px light 为 load 等待超时，原条件隔离复测 1/1 通过      |
| 产物语法                 | 30 个 CSS/HTML 检查通过，0 layer/import/选择器嵌套，7/7 dvh 有 vh 回退          |
| 文件保护                 | 74 个原有修改/未跟踪文件与 548 份冻结文件字节未变，最终候选输入仍与源码逐项一致 |

没有改动用例时限、截图零差异像素预算、精确几何断言或冻结文件，也没有跳过失败项。首次类名差异造成的冻结失败保留在 `styles-before-data-attribute.*`；改用数据属性后完整重跑。最终视觉首轮及原生 WebKit 并行运行期间的超时分别保留在 `styles-final.*` 和 `cross-native.json`，隔离结果为 `style-820-isolated.*`、`webkit-native-isolated.*`。旧封存版原生导航对照通过（19.5s），修复版同例隔离通过（19.4s）。这不能证明并行资源是根因，也不能将首轮改记一次全绿或关闭既有 WebKit 入站转场/调度调查。

其余证据：`production-gates-final.log`、`release-fixtures.json`、`edge-final.json`、`cross-final.json`、`output-audit.json`、`protection-before.json`、`protection-after.json`。本地模型截图为 `model-home.png`、`model-contents.png`、`model-search.png`、`model-code.png`；它们是缺能力实验的桌面引擎截图，**不是 iOS 真机截图**。

本地不可变候选：`.local-tools/releases/autuswing-20261018-safari-components-final/`，359 个公开文件，生产封存复验通过。提交前构建记录保留旧 HEAD 与修改状态，独立测试须从新提交重建；不要改写封存元数据。新 CSS：`/_astro/BaseLayout.Crssfl-Y.css`，SHA-256 `0d8851a51a3bba09d588b1004a8f6618774ba483cf58a21b7112aec80c6d9780`。

可复现命令：

```powershell
npm run release:build
npm run build:preview
npx playwright test tests/browser/legacy-safari-components.spec.ts tests/browser/legacy-safari-media.spec.ts
$env:FIREFOX_EXECUTABLE_PATH = 'E:/autuswing-astro/.local-tools/firefox-recheck-20261018/browsers/firefox-1555/firefox/firefox.exe'
npx playwright test --config playwright.cross.config.ts tests/browser/legacy-safari-components.spec.ts tests/browser/legacy-safari-media.spec.ts
# Windows WebKit 相关套件分开执行，保留首轮超时记录
npm run test:styles -- --workers 1
$env:RELEASE_FIXTURE_EVIDENCE = '.local-tools/safari-components-20261018/release-fixtures.json'
npm run test:release
```

## 独立测试和真机复测

交给「Autuswing · 浏览器兼容与测试」独立副本重建、检查最终 CSS/JS/HTML 与现代冻结视觉。尤其确认禁用 focus 选项后的关闭恢复、目录末项可见、滚动与焦点陷阱、叠层替换及 pagehide 清理。不得以原生现代 WebKit 冒烟替代旧能力回退专项。

独立验收后再交运维部署 **astro.akisenn.com 测试站**。本对话没有部署，未触及正式 akisenn.com。待用户真机复测：四张图对应场景、长代码左右滑动、搜索软键盘、关闭后原位置、目录末项/旋转/锚点、首页两侧留白和卡片间隔。没有真实 iOS 14.8 环境，整体真机验收继续待定。
