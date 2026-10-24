# Autuswing Motion 1.0

后续样式整理将 Motion Tokens 集中到 `src/styles/tokens.css`，转场与减少动画策略继续位于 `src/styles/motion.css`，参数与交互保持不变。下面的旧文件名是本阶段的历史审计记录；当前结构见[样式架构报告](styles-architecture.md)。

## 审计（修改前）

审计入口为 `BaseLayout.astro` 的四份样式和 `main.ts`，沿组件类名、配置字段和脚本导入逐项核对。旧布局样式仍有用途，本次只移除已确认的历史动效，不整份删除 legacy.css。

| 分类     | 调用链与旧实现                                                                            | 决定                                                          |
| -------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| 删除     | DesktopSidebar → avatar-enter → autuswing-avatar-in，0.3 倍缩放、延迟入场                 | 删除类名、keyframes 与配置                                    |
| 删除     | main → avatar.js → pointerenter/click → avatar-shake；offsetWidth 强制重排与 500ms 定时器 | 删除摇晃；保留首页品牌入口回到顶部                            |
| 删除     | main → animations.js → Element.animate；卡片、文章标题逐项 translateY(6px)                | 删除模块、导入和独立入场开关                                  |
| 冲突     | PostCard → card-lift；legacy.css -4px、visual.css -2px 两次覆盖                           | 统一为边框反馈，不移动卡片                                    |
| 未调用   | legacy.css 小屏 .sidebar translateX(-100%)，当前移动端是顶部导航，没有旧抽屉控制器        | 删除滑入及其覆盖规则                                          |
| 重复     | legacy.css、visual.css 的 reduced-motion/card-lift/data-animate 覆盖                      | 集中到 motion.css                                             |
| 未调用   | 四个可选脚本的统一历史导入及 helpers.css 动态样式加载器；全项目无实际调用                 | 删除闲置导入、变量与加载函数；保留真实使用的 idle/script 工具 |
| 重写     | 导航背景过渡、头像阴影、toast 的 all-property transition                                  | 明确属性，使用统一 token                                      |
| 增强     | dialogs.ts → 搜索、目录、图片原生 dialog                                                  | 保留 showModal、焦点与 inert；统一短距离淡入淡出              |
| 保留     | responsive.ts 断点与目录按钮、独立停靠目录                                                | 保留布局和单入口状态，不动画宽度/高度                         |
| 保留     | reading.ts 的 passive scroll+RAF、IntersectionObserver、高亮与目录内部定位                | 功能性更新，不做逐段入场                                      |
| 保留     | 代码复制、toast 提示计时、搜索 120ms 防抖、评论延迟加载、运行时间计时                     | 功能机制，不当作历史动画清理                                  |
| 保留     | appearance-init.js 首屏模式初始化、appearance.ts；prefetch.js speculationrules            | 保留防闪烁和预取，不是路由器                                  |
| 无需迁移 | 手机直接导航、页面加载遮罩、旧 PJAX 事件                                                  | 当前没有这些旧动画/路由调用，不创建兼容层                     |

## 实施方案

1. 统一配置为 `theme.motion.enable` 和 `theme.motion.page`，移除已经失去用途的 `animations.avatar/articles` 和重复总开关 `appearance.animate`。配置文件是本项目当前配置，没有兼容空壳。
2. `tokens.css` 管理 fast=150ms、normal=180ms、page=360ms、exit=160ms、page-fallback=280ms、rise=14px，以及统一 ease-out。`motion.css` 只过渡颜色、背景、边框、opacity、transform。
3. Astro 静态页面在 head 按配置用 `@view-transition { navigation: auto }` 选择同源跨文档转场，仅在 no-preference 下启用。只命名主内容，关闭 root 截图，不动画侧栏或主内容容器几何尺寸。
4. 不使用 ClientRouter、不拦截普通链接、不模拟 history、不设置 scrollRestoration；每份文档按现有入口初始化一次，后退缓存恢复不重复初始化。
5. 原生 dialog 保留焦点和单弹窗语义；关闭期间继续保持 open，动画完成再 close，避免目录入口提前出现。替换弹窗、断点切换时立即关闭；减少动画直接关闭。
6. 删除旧装饰实现后验证内容始终可见、配置禁用、减少动画、原生转场/正常导航降级、历史滚动、连续切换、弹窗重入和原有功能。对布局做修改前后的几何比对与实际截图。

官方依据：[Astro View Transitions](https://docs.astro.build/en/guides/view-transitions/)、[跨文档 View Transitions](https://developer.chrome.com/docs/web-platform/view-transitions/cross-document)。原生跨文档方案保留 MPA 脚本生命周期；本项目无需 ClientRouter 的脚本重执行与持久组件机制。

也扫描了 public 中的 JS/CSS。它们均为公式 vendor，没有另一套 Yelee 动效入口；第三方库内部代码不属于本站动效控制器，未修改 vendor。公式页面仍采用构建时 KaTeX，不额外加载公式脚本。

## 文件与配置

| 文件                                                       | 职责                                                                             |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------- |
| src/styles/motion.css                                      | 唯一的 CSS 动效定义、tokens、主内容转场、微交互和减少动画规则                    |
| src/layouts/BaseLayout.astro                               | 按 motion 配置输出 head 的 CSS 跨文档 opt-in；首屏外观脚本保持提前运行           |
| src/scripts/page-entry-init.js                            | head 同步选择页面入场回退，原生导航、离页和缓存恢复时清理，不拦截导航          |
| src/config/theme.json                                      | motion.enable 为总开关，motion.page 为页面转场开关；没有旧 animations 开关兼容层 |
| src/scripts/dialogs.ts                                     | 统一原生弹窗生命周期、可取消的关闭动效、焦点和弹窗互斥                           |
| src/scripts/helpers.ts                                     | 统一系统偏好和主题总开关；返回顶部与评论定位使用 scrollBehavior                  |
| src/scripts/brand.ts                                       | 保留首页头像点击回到顶部，普通和修饰键点击仍由浏览器导航                         |
| src/scripts/reading.ts、responsive.ts、search.ts、media.ts | 保留功能，弹窗关闭交给统一控制器                                                 |
| scripts/verify-motion.mjs                                  | 实际构建两种禁用配置并逐字节恢复配置，再恢复默认预览构建                         |
| tests/browser/motion.spec.ts                               | 原生动画采样、历史、快速导航、弹窗中断、偏好、降级和几何回归                     |

```json
"motion": { "enable": true, "page": true }
```

`enable=false`：不输出跨文档选择加入和页面回退脚本，关闭同文档主题转场、CSS 装饰过渡、JS 弹窗退出动效和平滑返回顶部。`page=false`：关闭跨文档转场及CSS页面入场，保留同文档主题转场和微交互。时间和原生位移修改 tokens.css 的变量；CSS回退位移在 motion.css 固定为6px。弹窗退出从 normal 变量读取时长及缓动。

原生主内容旧图像淡出160ms、新图像渐现360ms并上浮14px；CSS入场为280ms/6px。两者沿用 `cubic-bezier(0.22, 1, 0.36, 1)` 自然减速曲线，主题切换、停靠目录和通用弹层仍为180ms，目录弹层入场例外见下文。禁用 root 截图以及 main-content group 的几何插值，不给导航、目录面板、背景或浮动工具设置转场名称。没有逐项延迟或内容隐藏等待类。

同文档转场仅接入外观按钮引起的有效色板变化：原生 `document.startViewTransition()` 使用独立的 `appearance-theme` 根截图，新色板淡入180ms，旧色板保持不透明；期间移除 `main-content` 名称并暂停 fast 颜色过渡，避免叠加页面入场。首次加载、同色板模式切换、系统偏好和跨标签同步仍直接更新。缺少 API、减动、关闭总开关或已有导航转场时不启动；连续操作取消旧动画并立即采用最新选择，过期回调不能回写旧状态。出站、离页及中途禁用动效时收尾，恢复原有跨文档名称。`skipTransition()` 仍会执行更新回调，依据见 [W3C View Transitions](https://www.w3.org/TR/css-view-transitions-1/)。没有客户端路由。

CSS页面入场由Autuswing独立实现，仅借鉴淡入上移的设计思路。同步head脚本在绘制前选择280ms/6px回退：有可靠`pagereveal`时读取实际`viewTransition`，没有跨文档能力时提前选择；部分能力无法可靠判断时直接显示。原生对象存在但后续被跳过时不补播CSS，避免晚隐藏。首次访问、刷新及重新加载的历史文档可入场；BFCache恢复、带锚点或后台页面不重播，优先保留缓存画面及浏览器滚动恢复。事件时序依据见[跨文档生命周期](https://developer.chrome.com/docs/web-platform/view-transitions/cross-document)。

回退只动画`#main`的opacity和transform，不改变布局尺寸；不设常驻opacity/visibility/hidden，也不等待页面模块下载。动画结束/取消、离页、减动或主题原生截图启动时移除标记并释放监听。有限CSS动画没有forwards残留；脚本缺失、晚执行或API不完整时内容正常可见。不会在`pageshow`或DOMContentLoaded之后补加淡入状态。

停靠目录进出为180ms / 4px，仅动画 opacity 和 transform，正文预留空间和原有断点不变；收起开始即禁止交互和聚焦，快速反向操作从当前绘制状态继续。目录弹层及其遮罩入场为240ms，退场保持180ms；搜索、灯箱进出仍为180ms，面板位移均为6px。入口 CSS 使用 @starting-style，关闭使用原生 Web Animations 并等待 finished。减少动画、关闭动效总开关或缺少动画 API 时立即切换，遮罩也遵守减动设置；旧Safari的现有视觉降级不另作兼容处理。替换弹窗、切换断点立即收尾。页面离开时清理未完成退出，避免缓存恢复时遗留关闭状态。

HTML 的默认滚动恢复与锚点处理交给浏览器，不全局启用 smooth scroll；只有明确的返回顶部/评论定位操作在允许动效时平滑滚动。目录内部定位仍直接更新自己的 scrollTop，不移动正文。没有新增滚动监听或动画依赖。

## 验收

2026-10-24 收尾：CSS页面入场、页面节奏及移动目录调整已在宝塔测试站获用户综合体验认可。下文保留各原轮的验证记录；WebKit历史测试崩溃仍未关闭，不据综合反馈追加逐项实机结论。

### 2026-10-24：页面节奏微调（原轮验证记录）

- CSS入场改为280ms/6px，原生跨文档入场/退场改为360/160ms，沿用现有减速曲线；180ms局部动画和导航判定脚本未改。用户已确认旧参数版本在iOS14 Safari、PC Firefox和Chromium体验正常，新参数仍待体验。
- 隔离构建27页、类型检查0错误/0警告（5项既有提示）、相关单测32/32。三引擎专项首轮25/33；校正CSS关键帧缓动的采样层级后，定向复核WebKit5/5、Edge2/2、Firefox1/1，未延长超时或增加重试。
- 首轮8项失败中5项为缓动采样错误，另外3项WebKit首次动画事件未采样到，原因未完全确认；相同产品代码定向复验通过，原始失败保留。已检查刷新、导航、历史/滚动恢复、减动、无API回退及局部180ms动画；没有新参数的旧Safari真机结果。

### 2026-10-24：CSS页面入场回退（原轮验证记录）

- 隔离生产门禁8/8、单测135/135；新增回退相关单测9项，连同既有外观测试共25/25，专项测试通过严格TS检查。产品代码从首轮后未修改；后续只修正浏览器采样夹具。
- 浏览器原始56/66、Edge复验21/22、定向10/12、最后定向9/9分别保留，不描述为同次全量通过。失败涉及BFCache不重发load、新夹具重复启动Trace、同页锚点计数、暂停采样和模块阻塞等待环；修正均保留功能断言，未加超时或重试。
- Edge/WebKit普通导航实际使用320/120ms原生跨文档转场，Firefox实际使用200ms CSS入场；三者主题切换继续使用180ms原生同文档转场。Edge专项实际恢复BFCache并验证前进、后退和1200px滚动位置，缓存及锚点不重播CSS。
- WebKit可延后首次渲染及animationstart派发；慢加载检查分别记录流式HTML和模块阻塞状态，再验证实际入场及最终可见性，不要求浏览器在任意下载阶段立即派发事件。旧Safari仅验证无API能力模型，尚无本批真机结果。历史Firefox/WebKit观察项继续保留，冻结视觉基准未变。

### 2026-10-24：原生双转场

- 主题切换新增180ms同文档原生转场；原有跨文档320/120ms保持不变。Firefox已记录同文档原生ready；缺少API时直接更新，减动及主题总开关仍有效。
- 隔离生产门禁8/8、单测126/126；测试站Edge、Firefox、WebKit各10/10专项冒烟通过。用户随后确认Edge、Firefox及旧Safari的主题、导航、目录和搜索体验正常；旧Safari具体版本未在本次反馈中记录。
- 本地原始48/51、定向10/12及夹具修正后6/6分别保留，不表述为同一次全量通过。WebKit失败有旧/新鼠标焦点对照及初始化时机证据；改用键盘和初始化完成后触发，未放宽断言。
- Firefox静态桌面10像素、手机1像素差异仍未归因，几何和功能检查一致，作为非阻断视觉观察项保留；原生中点截图未可靠捕捉混色，不能据截图关闭采样问题。历史Firefox几何和WebKit偶发转场问题继续独立记录，冻结基准不变。

### 2026-10-17：初始跨文档转场

2026-10-17，在本地 Edge 155 / Playwright WebKit 27.2 执行。工程仍为 Astro 7.4.0 静态输出，未增加依赖，也未变更锁文件、文章、URL、SEO 或部署配置。

| 检查                | 实际结果                                                                                                                                                          |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 安装依赖            | 本次未更改依赖，使用现有安装和固定锁文件；没有重新执行 npm ci                                                                                                     |
| Astro check / build | 通过；0 errors、0 warnings，1条原有 execCommand 复制降级提示                                                                                                      |
| 单元测试            | 16通过                                                                                                                                                            |
| Edge                | 全量71通过；最终构建后另补跑11项动效及7项评论适配器，均通过                                                                                                       |
| WebKit              | 全量初轮60通过、2个测试断言失败；修正测试后在本地 Nginx 完整补跑11项动效通过，最终构建的7项评论适配器也通过。62个不同用例均有通过记录，并非同一次全量调用全部通过 |
| 本地 Nginx          | 4项浏览器检查、77项HTTP检查通过；仍为预览 noindex 策略                                                                                                            |
| 几何回归            | 两种引擎各18组首页/文章对照，共36组；位置、尺寸、字体、颜色与修改前一致                                                                                           |
| 实际跨文档转场      | 两种引擎分别验证390×844、768×1024、1024×768、1366×768、1440×900、1920×1080、2560×1440的首页/文章切换及后退                                                        |
| 动画采样            | 首页→文章、文章→文章、文章→关于均记录原生转场；实际 CSS 动画为320ms/14px和120ms，无root动画                                                                       |
| 历史滚动            | 长文1800px后前进/后退正确恢复；首页Edge从308px恢复308px，WebKit从69px恢复69px；未人为滚到顶部                                                                     |
| 目录与交互          | 当前文章目录与标题一致，H2/H3层级、高亮、目录独立滚动、单入口、焦点、复制、搜索、灯箱、外观、阅读进度、PWA均有浏览器检查                                          |
| 中断与偏好          | 快速连续导航、返回中断、弹窗关闭时重新打开/被替换、断点切换、运行中改变减少动画偏好均通过                                                                         |
| 内容与来源          | 3篇旧文、关于页、307个导入文件及6个可选资产验证通过；652个原始文件哈希与两个原仓库状态均未改变                                                                    |

原始报告与逐项汇总在 [evidence/motion-system/summary.json](evidence/motion-system/summary.json)。137是Edge71、WebKit62及Nginx4个不同浏览器用例之和，不重复计算补跑。中间失败报告保留，不将它们改写成通过。

### 测试修正说明

- 评论旧测试直接把未打包模块注入页面。共享 scrollBehavior 后改为加载真正的构建 chunk，验证依赖解析和实际交付路径，服务仍使用受控SDK。
- WebKit 部分动画的 `KeyframeEffect.pseudoElement` 返回 null。测试同时检查实际动画名称、时长、关键帧及根/内容的转场名称，不把 nullable API 视为产品错误。
- 两种引擎 scrollIntoView 的最小滚动量不同。首页采用600px高的桌面窗口，要求真实非零滚动并核对精确恢复，不假设滚动距离必须大于100px。
- 测试等待改为两个渲染帧后等待真实页面动画结束，不用跨 BFCache 保存的临时布尔值，也不依赖被中断页面的 finished 回调才能报告采样。未放宽断言超时。
- 最终WebKit动效专项使用本地Nginx8788，Edge使用4322。两者都是同一份dist；跨引擎回归使用各自的原始基线。

### 截图

已实际查看 Edge 的1366×768首页、1920×1080暗色转场80ms帧，以及WebKit的390×844文章页、1920×1080浅色转场80ms帧。80ms截图是在真实跨文档动画ready后暂停到该时刻采样，随后继续播放；仅测试代码暂停，产品代码没有暂停或延迟。

完整静态布局截图包含320×640、390×844、768×1024、820×1180、1024×768、1366×768、1440×900、1920×1080、2560×1440的首页及文章页，按引擎保存在 evidence/motion-system/edge 和 webkit。其他常规用例还覆盖375/430px及断点邻近宽度。

### 明确未验证

- 本机Firefox再次启动失败（spawn UNKNOWN），没有将其算作通过。不支持原生跨文档转场的真实浏览器尚待补验；当前降级检查通过删除head中的CSS选择加入模拟，确认普通多页面导航与交互正常。
- WebKit自动化不是物理Safari/iPad/iPhone；没有物理设备验收。
- 评论保持关闭；六种适配器与重试是模拟SDK验收，真实服务仍按用户要求待办。
- 本次只有本地验证，没有生产发布、线上预览、DNS/CDN或正式宝塔配置修改。

### 复现

```powershell
npm run check
npm run build
npm test
npm run verify
node scripts/verify-motion.mjs
# 上一步会恢复配置并重新构建，构建期间不要同时跑浏览器套件。
npx playwright test
$env:PLAYWRIGHT_BASE_URL='http://127.0.0.1:8788'
npx playwright test tests/browser/motion.spec.ts --config=playwright.cross.config.ts --project=webkit
```

原生导航无需 ClientRouter 生命周期钩子；以后新增交互仍从main.ts按文档初始化一次，不为pagereveal重复绑定。需要新增弹窗时使用统一openDialog/closeDialog，并保留close事件的焦点恢复。
