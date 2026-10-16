# PC文章宽屏补充

这是前序宽度调整记录。最新的迷你侧栏与独立目录见[首页与文章布局分离](reading-layout.md)；860px外层上限继续保留，本文中的旧完整侧栏描述不再代表当前文章页。

用户要求文章外层上限860px，保持侧栏、字号、配色和居中方式。仅修改 `src/styles/responsive.css` 中 `@media screen and (min-width: 1000px)` 的文章宽度规则。

## 实际限制与修改

此前 `.article-page` 的 `--reading-width: 754px` 同时限制正文与外层；`.article-layout:has(> .mica-article)` 再加48px，外层实际上限802px。卡片两侧各24px内边距、各1px边框，所以正文实测752px。

本轮将桌面文章页变量改为 `--reading-width: 860px`，并对该页的 `.article-layout:has(> .mica-article)` 设置 `max-width: var(--reading-width)`，取消桌面文章卡片额外加48px的规则。最终外层860px、正文810px，实际内容增加58px，不只是扩大外侧留白。没有卡片时正文可使用外层的可用空间。

保留 `.article-layout { width: 100% }`、原有自动外边距与主内容最大宽度；可用空间不足860px时自然收缩，不设置固定宽度或最小宽度。保留卡片内边距、正文18px/1.8和已有图片max-width、代码/表格内部滚动。未修改首页、平板、手机、配色、字体和侧栏CSS。当前项目默认桌面侧栏实测272px，按“不要修改侧栏”要求保持该现值。

另外按前一条补充要求，欢迎语从桌面侧栏移至关于页；该行为独立于本次宽度CSS，未改原始Markdown。

## 浏览器验证

使用Edge和Playwright WebKit实际打开页面、测量并截图。原始数据见各目录的 `portable-desktop.json`，最后运行统计见[第五阶段验收](phase-5.md)。

| 视口      | 外层  | 正文  | 字号/行高     | 截图                                                                                                        |
| --------- | ----- | ----- | ------------- | ----------------------------------------------------------------------------------------------------------- |
| 1366×768  | 860px | 810px | 18px / 32.4px | [Edge](evidence/phase5/edge/desktop-1366x768.png) / [WebKit](evidence/phase5/webkit/desktop-1366x768.png)   |
| 1440×900  | 860px | 810px | 18px / 32.4px | [Edge](evidence/phase5/edge/desktop-1440x900.png) / [WebKit](evidence/phase5/webkit/desktop-1440x900.png)   |
| 1920×1080 | 860px | 810px | 18px / 32.4px | [Edge](evidence/phase5/edge/desktop-1920x1080.png) / [WebKit](evidence/phase5/webkit/desktop-1920x1080.png) |

检查文章在侧栏以外的主内容区域中心，误差小于1px；侧栏宽度不变、目录可独立滚动、底部按钮可见。原有PC首页和手机/平板几何与字号回归继续执行；13种宽度的页面矩阵检查根容器不横向溢出，正文样张覆盖长代码、宽表、图片。截图不替代真机、实际浏览器缩放或Firefox验收，边界见阶段五报告。
