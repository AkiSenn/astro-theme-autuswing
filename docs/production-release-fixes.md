# 生产构建门禁与 PWA 修复报告

日期：2026-10-18。范围：审计确认的四项问题、必要的本地回归与交付手册。未部署、上传或修改生产 DNS、服务器、ESA/Workers 配置。

**状态：四项代码修复及生产构建门禁已完成；全量发布验收尚未全绿。** WebKit 一项原生页面转场事件计数测试间歇失败，在旧审计产物上也可复现，原因尚未确定。本轮不修改无关动效，也不放宽或删除该断言。不得把 READY 或下面通过的构建项目当作可以直接上线的结论。

## 四项问题与修复

| 问题 | 根因 | 修复及主要文件 |
| --- | --- | --- |
| 新文章无法通过发布检查 | `verify-output.ts` 把 RSS/搜索固定为 3 篇、Sitemap 固定为 26 个 URL，并只接受历史文章成员 | [动态验证](../scripts/verify-output.ts)对照源 Markdown、实际 Content Collections 私有快照、路由及最终文件；RSS/Atom/搜索/Sitemap 按发布、索引、开关和 Feed limit 计算。历史 URL、日期、锚点、公式与资源保护仍是必须满足的子集，没有变成全站数量限制 |
| 预览产物可能误用于正式发布 | 环境变量与 Nginx 模式靠人工分别设置；没有绑定校验对象和交付文件 | [生产入口](../scripts/release.mjs)、[完整性检查](../scripts/release-integrity.mjs)、[模式校验](../src/lib/build-mode.mjs)统一 production、正式 URL、输入摘要、文件 SHA256 与 READY；生成新的独立候选，失败退出非零且没有 READY。HTTP 进一步比对实际响应字节，阻断旧 CDN 正文 |
| 已安装 PWA 继续显示旧离线页 | 固定的 shell-v2 名称，离线页仅在 install 写入；HTML 变化不改变 Worker 文件 | [Worker 生成器](../src/lib/service-worker.mjs)根据最终离线 HTML 的 SHA256 生成版本；下载壳后核对哈希，混版时拒绝安装并保留旧版；激活只清自己及明确历史壳命名空间。客户端[更新检查](../src/scripts/pwa.ts)使用 updateViaCache none，并在联网/可见/历史恢复时节流更新，不重载现有文档 |
| 安装清单触发原始大头像下载 | manifest 的 icon 直接引用 317,783 字节原 PNG，与已优化的侧栏头像是两条独立请求 | [图标生成](../src/lib/pwa-icons.mjs)复用 Astro 自带 Sharp 服务，用同一原图生成 192/512 WebP 与 512 maskable，按内容哈希命名；[manifest](../src/pages/manifest.webmanifest.ts)只引用这些文件。原头像、favicon 和 Apple 图标保留 |

没有引入新依赖，锁文件未变化；没有修改 CSS、组件/布局、字体、配色、动画、文章 Markdown、永久链接、原 SEO 生成规则或评论配置。仅开发模式下停止写生产构建快照，避免写作预览与生产构建竞争同一记录。

## 生产流程

```powershell
npm ci
npm run release:build
# publish:check 是相同生产门禁入口；都不执行部署。
npm run verify:release -- <命令输出的候选目录>
```

8 道门禁依次是：依赖安装一致性、类型检查、原稿检查、单元测试、历史导入完整性、生产构建、最终资源/链接检查、生产内容/SEO/产物检查。构建只执行一次，并针对该目录完成后续校验；构建前后输入变化会失败。

候选 `site/` 是可公开文件；`release.json`、`READY` 和 `audit/` 保持私有。私有 Collections 快照含草稿排除记录，不得整个目录上传到公网。READY 覆盖元数据哈希；元数据绑定全部站点文件哈希、输入摘要、模式、正式 URL 和成功门禁。校验发现增删改文件或元数据变化会失败。它是完整性机制，不是数字签名或上线授权。

`verify:release` 对旧候选不重新读取当前 Markdown，可在作者后续增删文章之后验证回滚包。production Nginx 配置生成必须使用已通过校验的候选。production HTTP 校验必须指定该候选，核对 canonical、索引、缓存/压缩/MIME/301/404，并比对成功响应的解压字节 SHA256；能发现 canonical 未变但正文仍旧的响应。

## 图标与安装验证

| 类型 | 实际尺寸 | 文件大小 |
| --- | --- | ---: |
| any | 192×192 | 5,812 B |
| any | 512×512 | 17,238 B |
| maskable | 512×512 | 8,700 B |

三张合计 31,750 B；512px any 图标比原图小约 94.6%。保留原 PNG 供既有地址与 SEO 使用，所以不把这项改动说成删除了原资源。maskable 使用原 Logo 与已有品牌色背景，完整画面置于 80% 安全圆内。网站头像与 UI 的显示方式不变。

测试验证尺寸、格式、内容哈希、下载、解码、favicon 与 Apple 图标；Edge 另用全新普通持久配置文件检查 manifest 解析和安装条件，避免匿名上下文自身禁止安装。操作系统实际安装窗口和真实手机主屏体验仍需人工确认。

## 新增与修改的测试

- [发布回归](../scripts/verify-release-fixtures.mjs)：隔离副本内新增第 4 篇文章后跑完整门禁；删除该文章重建；旧包仍可验用于回滚；草稿不出现在产物；重复 ID、非法路由、缺失 Collections 成员/路由、残留草稿 HTML、构建后输入变化、错误正式域名、CLI site 覆盖、未知/开发环境、预览冒充生产均应阻断。
- 同一套回归还验证 noindex、canonical、robots、X-Robots-Tag、Sitemap 成员/lastmod、搜索、RSS 空成员、历史公式被破坏时失败；未封存 Nginx 生产配置被拒绝，旧候选不能覆盖。
- [完整性单元测试](../tests/release-integrity.test.ts)：模式/URL、元数据和文件增删改、旧包校验、同 URL 下的旧 HTTP 正文被拒绝。
- [PWA 单元测试](../tests/pwa.test.ts)：版本稳定性、离线壳更新、归属缓存清理、CDN 混版拒绝安装、关闭 PWA、图标格式/尺寸/预算。
- [实际浏览器 PWA 测试](../tests/deployment/pwa-updates.spec.ts)：多标签页、未保存文本、在线更新、离线启动、恢复联网、CDN 混版失败后恢复、图标与安装条件。[既有 Nginx 测试](../tests/deployment/nginx.spec.ts)改为匹配内容哈希版本，并验证不误删功能缓存。
- 继续运行现有完整 Edge 功能套件、WebKit 阅读/导航/动效补充套件及冻结视觉套件；未改变基准、阈值或超时。

## 实际验证结果

最终候选源码提交为 `83b88e089e0bf312d20c74e5b5fb7f93be352e02`；目录为 `.local-tools/releases/autuswing-20261018-r4`。候选包含 359 个文件、3 篇已发布文章，排除 3 篇演示草稿；26 个 canonical 页面及 Sitemap URL、21 条历史重定向、879 个本地引用与历史公式检查通过。源站 URL 固定为 `https://akisenn.com`。

| 验证 | 实际结果 |
| --- | --- |
| 生产流水线 | 8/8 门禁通过，包含类型检查、35/35 单元测试、历史源文件完整性和最终产物验证 |
| 全新依赖安装 | 独立目录执行 npm ci 后重新完成整条生产流水线；输入摘要及 359 个输出文件 SHA256 与主候选完全相同 |
| 发布回归 | 33/33 通过；包含第 4 篇合法文章完整构建、删除后重建、重复 ID、非法路径、预览冒充正式、索引错误、混版和回滚包检查 |
| 本地 Nginx HTTP | 最终候选 82/82 检查通过，其中 44 次响应校验解压字节 SHA256；同时验证缓存、索引、MIME、压缩、重定向与 404 |
| Nginx/PWA 实际浏览器 | Edge、WebKit 合计 10/10 通过，覆盖更新、离线、联网恢复、多标签页、混版失败保护与图标 |
| Edge 既有功能套件 | 94/94 通过 |
| 冻结视觉套件 | 完整串行复测 106/106 通过；274 张 PNG 和 274 份布局记录原哈希保持不变 |
| WebKit 阅读/导航/动效补充 | 37/38 通过，1 项原生 MPA 转场事件计数失败；不是全绿 |
| Firefox | 启动失败 `spawn UNKNOWN`，未执行浏览器验收 |

完整发布回归曾在 Windows `.astro/content-assets.mjs` 临时文件重命名时遭遇 `EPERM` 而中断；保留原日志，完整重新执行后 33/33 通过。没有添加自动忽略、绕过构建或重试后隐藏失败的逻辑。机器汇总和两次执行记录均随报告保存。

WebKit 失败位置为 `tests/browser/motion.spec.ts` 的 “native MPA transitions use only the content group and refresh article state”：期望记录 3 次 `pagereveal.viewTransition`，实际为 2 次。保留原测试后对当前产物重复 3 次，2 通过、1 失败；对改动前审计产物做相同对照也是 2 通过、1 失败。尝试的测试等待诊断没有解决问题，已全部撤销，产品动效代码及该测试保持原状。这个对照说明旧产物也存在现象，不能据此断定根因或将失败忽略。

## 保留范围与发布风险

- 274 张批准 PNG 与 274 份布局 JSON 保持原哈希。3 篇演示草稿保留，导入原文件与原博客来源文件仍有哈希保护。
- 首轮并行视觉执行为 105 通过、1 个 WebKit 页面 load 超时，失败发生在截图比较前。完整串行复测为 106/106；未更新基准或放宽断言。首次失败记录与最终通过记录均保留。
- Firefox 本次仍因 `spawn UNKNOWN` 无法启动，不能记为通过；没有真实手机/平板或操作系统安装 UI 验收。
- WebKit 原生转场事件计数问题尚未解决。正式发布验收前应在目标浏览器重现并定位，保持原测试，不能以构建 READY 代替此项浏览器验收。
- 评论继续关闭，没有真实服务验收。当前站点配色、文章与导航交互没有扩展。
- 实际宝塔目录、SSL/重写配置、ESA 缓存键与改写规则未读取或修改。本地 Windows Nginx 不能替代 Linux 源站与公网验收。
- ESA 如改写离线 HTML，会使 Worker 哈希校验拒绝更新；这是防混版保护，需要按真实配置关闭改写并测试。线上 HTML、Worker、manifest 与索引必须及时更新，哈希资源需保留旧版本供已有页面和回滚使用。
- 本轮验证了保留旧候选的完整性及源码变更后的可验证性，没有执行真实站点切换/回滚。READY 只表示 8 道构建/内容门禁通过，不包含全套浏览器、真机或人工上线验收；正式发布仍需补齐验收及用户明确授权。

## 人工发布前步骤

详见[宝塔与 ESA 发布/回滚手册](../deployment/release-runbook.md)：冻结提交和候选 → 备份线上文件/Nginx/ESA → 独立空目录交付并校验完整文件集 → 验证源站/公网缓存、旧哈希资源保留及旧 Hexo Worker 更新 → 真机与实际安装 → 演练回滚 → 获得明确授权后切换。不要覆盖现有站点、直接修改 DNS，或事后往已封存的 site 目录拼文件。

最终数据与原始记录：[验收汇总](evidence/release-fixes/summary.json)、[发布回归](evidence/release-fixes/fixtures.json)、[候选文件清单](evidence/release-fixes/artifact-manifest.json)。
