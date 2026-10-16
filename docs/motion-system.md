# Autuswing Motion 1.0

## 审计（修改前）

审计入口为 `BaseLayout.astro` 的四份样式和 `main.ts`，沿组件类名、配置字段和脚本导入逐项核对。旧布局样式仍有用途，本次只移除已确认的历史动效，不整份删除 legacy.css。

| 分类     | 调用链与旧实现                                                                            | 决定                                             |
| -------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------ |
| 删除     | DesktopSidebar → avatar-enter → autuswing-avatar-in，0.3 倍缩放、延迟入场                 | 删除类名、keyframes 与配置                       |
| 删除     | main → avatar.js → pointerenter/click → avatar-shake；offsetWidth 强制重排与 500ms 定时器 | 删除摇晃；保留首页品牌入口回到顶部               |
| 删除     | main → animations.js → Element.animate；卡片、文章标题逐项 translateY(6px)                | 删除模块、导入和独立入场开关                     |
| 冲突     | PostCard → card-lift；legacy.css -4px、visual.css -2px 两次覆盖                           | 统一为边框反馈，不移动卡片                       |
| 未调用   | legacy.css 小屏 .sidebar translateX(-100%)，当前移动端是顶部导航，没有旧抽屉控制器        | 删除滑入及其覆盖规则                             |
| 重复     | legacy.css、visual.css 的 reduced-motion/card-lift/data-animate 覆盖                      | 集中到 motion.css                                |
| 重写     | 导航背景过渡、头像阴影、toast 的 all-property transition                                  | 明确属性，使用统一 token                         |
| 增强     | dialogs.ts → 搜索、目录、图片原生 dialog                                                  | 保留 showModal、焦点与 inert；统一短距离淡入淡出 |
| 保留     | responsive.ts 断点与目录按钮、独立停靠目录                                                | 保留布局和单入口状态，不动画宽度/高度            |
| 保留     | reading.ts 的 passive scroll+RAF、IntersectionObserver、高亮与目录内部定位                | 功能性更新，不做逐段入场                         |
| 保留     | 代码复制、toast 提示计时、搜索 120ms 防抖、评论延迟加载、运行时间计时                     | 功能机制，不当作历史动画清理                     |
| 保留     | appearance-init.js 首屏模式初始化、appearance.ts；prefetch.js speculationrules            | 保留防闪烁和预取，不是路由器                     |
| 无需迁移 | 手机直接导航、页面加载遮罩、旧 PJAX 事件                                                  | 当前没有这些旧动画/路由调用，不创建兼容层        |

## 实施方案

1. 统一配置为 `theme.motion.enable` 和 `theme.motion.page`，移除已经失去用途的 `animations.avatar/articles` 和重复总开关 `appearance.animate`。配置文件是本项目当前配置，没有兼容空壳。
2. `motion.css` 管理 fast=150ms、normal=180ms、page=320ms、exit=120ms、rise=14px，以及统一 ease-out。只过渡颜色、背景、边框、opacity、transform。
3. Astro 静态页面在 head 按配置用 `@view-transition { navigation: auto }` 选择同源跨文档转场，仅在 no-preference 下启用。只命名主内容，关闭 root 截图，不动画侧栏或主内容容器几何尺寸。
4. 不使用 ClientRouter、不拦截普通链接、不模拟 history、不设置 scrollRestoration；每份文档按现有入口初始化一次，后退缓存恢复不重复初始化。
5. 原生 dialog 保留焦点和单弹窗语义；关闭期间继续保持 open，动画完成再 close，避免目录入口提前出现。替换弹窗、断点切换时立即关闭；减少动画直接关闭。
6. 删除旧装饰实现后验证内容始终可见、配置禁用、减少动画、原生转场/正常导航降级、历史滚动、连续切换、弹窗重入和原有功能。对布局做修改前后的几何比对与实际截图。

官方依据：[Astro View Transitions](https://docs.astro.build/en/guides/view-transitions/)、[跨文档 View Transitions](https://developer.chrome.com/docs/web-platform/view-transitions/cross-document)。原生跨文档方案保留 MPA 脚本生命周期；本项目无需 ClientRouter 的脚本重执行与持久组件机制。

## 验收

实施后填写实际结果；未验证项目不视为通过。
