# PC文章阅读页：小范围排版调整

2026-10-16，基于第四阶段提交2680984。实现只改现有两个CSS文件，无新组件、依赖、配置项或文章数据改动。

## 生效范围

全部新规则限定为 `@media screen and (min-width: 1000px)` 下的 `.article-page`。首页、独立关于页、归档及平板/手机保持原规则。保留固定左栏、内容区域内居中、原有浅深色和导航数据。

## CSS属性

| 位置                   | 属性与变化                                                                                                                                                                                                       |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| responsive.css，文章页 | `--reading-width: 704px → 754px`；仍由现有文章容器的 `max-width` 消费，卡片额外48px内边距空间不变，`margin-inline: auto`不变                                                                                     |
| visual.css，文章正文   | `font-size: calc(var(--autuswing-base-font, 16px) + 1px) → calc(... + 2px)`，默认17px → 18px；`line-height: 1.9 → 1.8`。当前版本已是17px，因此按“提高一级”采用18px；自定义字号仍生效                             |
| 桌面侧栏               | `padding: 24px → 16px 24px`；保留原有Flex纵向布局、`height: 100dvh`和固定定位；正常桌面高度下 `overflow-y: hidden`，不再同时出现外层与目录两条滚动条                                                             |
| 顶部信息               | 头像框统一64px、图像54px（768px高时原本已使用此尺寸）；`profile padding-bottom: 10px`；姓名 `margin: 8px 0 2px`；站名 `margin-block: 4px; line-height: 1.5`，简介 `line-height: 1.6`                             |
| 导航                   | `gap: 3px → 0`；链接 `min-height: 44px → 40px; padding-block: 6px`，五个核心入口全部保留                                                                                                                         |
| 目录                   | `flex: 1 1 0; min-height: 0; height: auto; max-height: none; margin-top: 12px`，覆盖旧100px最小高度及矮屏180px Flex基准；沿用 `overflow-y: auto`、滚动边界限制与粘性目录标题，仅目录内部滚动，原章节高亮脚本不变 |
| 底部功能               | `margin-top: 10px; padding-top: 8px`；个人说明 `display: block; margin-bottom: 4px; line-height: 1.6`，在768px高窗口也保留；社交区域 `gap: 0 10px; margin-block: 0`，链接最小高32px。搜索和外观按钮保持44px      |

没有目录的文章继续将底部功能推到底部。高度≤650px的极矮桌面窗口使用单一侧栏整体滚动（目录 `overflow-y: visible; flex: 0 0 auto`），保证底部按钮可到达，避免嵌套滚动；三个指定验收视口均使用目录独立滚动。

## 实测与截图

浏览器：本机Microsoft Edge / Chromium，桌面视口模拟。测量对象为真实长文章 `/post/55b0541c/`，没有改文章或插入测试文章。

| 视口      | 正文实际宽度  | 目录区域高度        | 截图                                                                                                     |
| --------- | ------------- | ------------------- | -------------------------------------------------------------------------------------------------------- |
| 1366×768  | 702px → 752px | 147.52px → 244.92px | [前](evidence/desktop-reading/before-1366x768.png) / [后](evidence/desktop-reading/after-1366x768.png)   |
| 1440×900  | 702px → 752px | 198.42px → 370.41px | [前](evidence/desktop-reading/before-1440x900.png) / [后](evidence/desktop-reading/after-1440x900.png)   |
| 1920×1080 | 702px → 752px | 378.42px → 550.41px | [前](evidence/desktop-reading/before-1920x1080.png) / [后](evidence/desktop-reading/after-1920x1080.png) |

正文实际宽度比变量值少2px，来自既有卡片边框盒模型，前后恰好增加50px。正文中心坐标保持一致。[深色1366×768](evidence/desktop-reading/after-dark-1366x768.png)。

新增5项浏览器测试检查三种指定视口、底部按钮是否被遮挡、目录滚动不带动正文、当前章节高亮、短/超长目录的Flex高度、随窗口增高获得剩余空间，以及7组不应受影响的首页/平板/手机布局与修改前的计算样式和几何尺寸完全一致。长目录压力数据仅注入浏览器DOM，不进入构建结果或文章文件。

历史第四阶段截图不覆盖，本次结果在 `evidence/desktop-reading/`，通用回归截图放在其 `regression/` 子目录中。没有执行部署或修改原站/Yelee-Next。

最终检查：Astro检查0错误、0警告，保留旧剪贴板API的1条弃用提示；16项单元测试、45项浏览器测试全部通过，浏览器测试无跳过、失败或不稳定重试。三个指定视口的截图已实际查看；属于本机Edge桌面视口验证，不代表其他浏览器或真机验收。首轮新测试误把外观模式从auto切到light当成dark，修正测试步骤后完整回归通过，未为该测试修改产品的模式循环行为。
