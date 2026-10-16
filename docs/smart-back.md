# 文章页智能返回

2026-10-17，仅调整文章页顶部导航及返回搜索结果所需的界面恢复。

## 行为

- 顶部保留原 `.back-link` 样式，文字为「← 返回」（英文为「← Back」）。箭头对读屏隐藏，链接有明确的无障碍名称。
- HTML仍提供真实的 `/archives/` 链接。没有JavaScript、没有可用的Navigation API、直接访问、新标签页或无法确认历史目标时，正常进入归档页。
- 有可靠记录时，用浏览器维护的Navigation API查找最近的站内历史条目，校验同源、URL与历史位置，再按该条目的key执行原生`traverseTo()`。不使用`history.length`或`document.referrer`猜测上一页，不无条件调用`history.back()`。
- 跳过当前文章的锚点历史和重复文章URL。刷新后仍读取真实历史，前进/后退及历史缓存恢复时重新核对目标；不会复制路由栈或添加虚拟历史条目。
- 返回仍是跨文档历史导航，沿用Motion 1.0。没有ClientRouter或导航拦截，没有手动滚到顶部或改动`scrollRestoration`。
- 归档的侧栏/手机导航入口继续保留。Ctrl/Meta等修饰键和新标签页行为沿用普通链接。
- 重复点击只提交一次历史遍历；失效条目或异常回退归档。被后续操作中断的AbortError不触发迟到的归档跳转。

浏览器接口依据：[Navigation条目与智能返回](https://developer.mozilla.org/en-US/docs/Web/API/Navigation/entries)、[按key遍历历史](https://developer.mozilla.org/en-US/docs/Web/API/Navigation/traverseTo)。旧浏览器不能可靠检查条目时采用归档降级。

## 搜索结果恢复

修改前实测Edge和WebKit的冷历史返回都会丢失搜索弹窗、关键词及结果。搜索是弹窗，URL里没有关键词，因此仅回到原页面URL无法完整恢复。

现在点击站内搜索结果时，把关键词、结果列表内部滚动位置和键盘选中项保存在**来源历史条目**的`autuswingSearch`字段中，保留其他现有对象字段。不写sessionStorage/localStorage，不建立全站导航状态，也不改URL。

从历史返回并重新构造文档时，通过`pageshow`恢复查询与结果。若浏览器直接恢复BFCache中的原文档，则沿用已有界面，不重复初始化。用户手动关闭搜索后清除该字段，之后再次返回不会强行重开旧搜索。

## 文件

| 文件                                | 修改                                                                            |
| ----------------------------------- | ------------------------------------------------------------------------------- |
| src/layouts/PostLayout.astro        | 顶部文字、装饰箭头、`data-article-back`挂载点及ARIA名称；保留归档href和原样式类 |
| src/scripts/back.ts                 | 历史条目选择、校验、遍历、异常降级、缓存恢复同步                                |
| src/scripts/main.ts                 | 按原有文档初始化流程调用initBack                                                |
| src/scripts/search.ts               | 搜索历史条目的少量界面状态与冷返回恢复                                          |
| src/config/zh-CN.json、default.json | 新增back文案；保留all_posts及归档导航配置                                       |
| tests/back.test.ts                  | 4项新增纯函数测试                                                               |
| tests/browser/back.spec.ts          | 9项浏览器专项，涵盖多视口及主要来源                                             |

没有修改CSS、依赖、Markdown、固定链接、SEO、评论或部署配置。

## 实际验证

| 项目                | 结果                                                                          |
| ------------------- | ----------------------------------------------------------------------------- |
| Astro check / build | 通过；0错误、0警告、1条原有复制降级提示                                       |
| 单元测试            | 20通过（包含新增4项）                                                         |
| Edge返回专项        | 9通过                                                                         |
| WebKit返回专项      | 9通过                                                                         |
| Edge现有交互回归    | 32通过：baseline、state、responsive、motion四个套件；没有声称重跑全站全部套件 |
| HTTP / 内容校验     | 77项本地Nginx HTTP检查通过；文章、资产、URL校验通过                           |
| 原始仓库            | 652文件哈希与原站、Yelee-Next的Git状态均未改变                                |

两种引擎均检查了直接访问及刷新、外部来源、同源新标签页、首页/归档/标签/分类来源、文章目录锚点、浏览器前进/后退、搜索恢复及手动关闭、缺少Navigation API、禁用JS、遍历失败和重复点击。

两种引擎均截图检查390×844、820×1180、1024×768、1366×768、1920×1080。已实际查看Edge的1920宽屏和WebKit的390手机截图。长文目录跳转后返回首页，Edge恢复308px、WebKit恢复69px；手机首页滚动恢复也有逐项记录。

原生转场采样确认返回首页的导航类型为`traverse`，仍使用`autuswing-page-in/out`，未创建另一套转场。

报告与截图位于[evidence/smart-back/](evidence/smart-back/)，逐项汇总见[summary.json](evidence/smart-back/summary.json)。Edge常规回归使用4322端口，返回专项在本地Nginx8788验证，服务同一份dist。

本轮未验证Firefox和物理设备，WebKit为桌面自动化引擎。没有发布生产或修改正式Nginx、DNS、CDN。

```powershell
npm run check
npm run build
npm test
npm run verify
$env:PLAYWRIGHT_BASE_URL='http://127.0.0.1:8788'
npx playwright test tests/browser/back.spec.ts
npx playwright test tests/browser/back.spec.ts --config=playwright.cross.config.ts --project=webkit
```
