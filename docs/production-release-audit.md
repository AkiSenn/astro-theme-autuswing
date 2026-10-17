# Autuswing 生产发布审计

审计日期：2026-10-17（UTC+8）。对象：`E:\autuswing-astro`，分支 `codex/astro-migration`，提交 `22ac4b16bba1d56aff1ee44f1ed072c7d7ab4d36`。

## 结论

**本地生产模式的主要交付检查通过；建议暂缓正式切换，先修复发布校验、补齐生产构建门禁，再验收真实服务器与 CDN 的发布和回滚。**

当前布局可以继续保持。优先投入发布可靠性、PWA 更新和资源传输优化。本次确认了两个可复现的问题：新增第 4 篇公开文章被固定数量校验拒绝；离线页单独更新时，已安装的 Service Worker 沿用旧离线缓存。

本次仅新增报告和审计证据。业务源码、CSS、站点配置、文章内容、URL、生产服务器、DNS、Cloudflare/ESA 配置均未修改，没有上传或正式部署。独立本地 Nginx 仅监听 `127.0.0.1:8789`，审计结束后已关闭；原有预览未被替换。

完整证据入口：[审计结论 JSON](evidence/release-audit/2026-10-17/verdict.json)。

## 1. 工作区与保护范围

- 审计开始时，已跟踪文件没有未提交修改。`content/posts/` 中有上轮创建的 3 篇未跟踪演示草稿，已保留，并校验其审计前后字节哈希一致。
- `astro-style-baseline` 仍指向 `92887a219a165c0e6cc221f142c331722d3d3fc3`。274 张批准截图与 274 份布局指标逐一校验哈希，全部未变。
- 已检查 307 个迁移文件、6 个可选资源及原博客的 365 个来源文件，哈希匹配。迁移记录中的本地备份目录仍存在；本次没有验证当前线上文件及服务器配置的完整备份。
- 所有构建、临时文章发布和离线页变更复现均在 `.local-tools/release-audit-20261017/workspace/` 隔离副本内完成。临时第 4 篇文章已删除，离线页已恢复，副本最终保留正常生产模式产物。
- 复用了现有锁定版本的依赖安装，没有执行新的 `npm ci`。本次不能作为干净环境安装或 Linux 构建通过的证据。

## 2. 发布前处理项

### R1 · P1 · 发布校验仍把整个站点固定为 3 篇文章

位置：`scripts/verify-output.ts:70–71、91、117–118`；调用入口 `package.json:32` 的 `publish:check`。

目前直接断言 RSS/Atom 各 3 篇、Sitemap 26 个 URL、搜索 3 篇，并要求搜索结果全部属于历史文章清单。新写的正常文章会违反这些断言。

**实际复现：**只在隔离副本添加合法公开文章 `/releaseaudit1/`，生产构建成功，正文/资源检查成功，但 `verify-output.ts:70` 报 `4 !== 3`。因此日常 `publish:check` 会在最终验证阶段失败。当前 3 篇历史文章的验证成功不能覆盖新增文章的正常发布。

建议：保留历史文章地址、日期、锚点等必须不变的检查；整体数量与成员集合则从本次可发布文章及路由计算，遵守 `draft/published/noindex/search/feed` 和 Feed limit。补充“新增一篇公开文章后整条发布检查成功”的回归测试。

证据：[新增文章构建](evidence/release-audit/2026-10-17/fourth-post-build.log)、[内容检查](evidence/release-audit/2026-10-17/fourth-post-content-output.log)、[固定数量断言失败](evidence/release-audit/2026-10-17/fourth-post-verify-output.log)。未修改真实文章。

### R2 · P1 · 生产候选产物缺少统一构建与索引门禁

位置：`src/site.config.ts:51–52`、`package.json:32`、`deployment/README.md:34`。

默认预览策略正确地使用 noindex。现有 `publish:check` 没有自行设置 `SITE_ENV=production`；Nginx 的 `--mode production` 又是另一个独立参数。两者没有绑定，也没有统一检查保证最终交付的 HTML、robots 和响应头采用一致的生产策略。按日常写作命令检查成功后直接上传 `dist`，可能上传预览产物。

**本次正式模式实测通过：**显式使用 `SITE_ENV=production` 构建，Nginx 使用 production 模式后，26 个公开页面没有禁止索引标签，robots 允许抓取，响应头没有 X-Robots-Tag；canonical 均为正式域名。这说明问题在于发布流程缺少门禁。

建议增加一个只生成候选包、不上传的发布入口，统一设置环境、执行检查，再断言公开页面索引策略、canonical、草稿隔离、路由、重定向和资源完整性。输出构建提交、模式、文件 SHA256 清单及检查结果，避免人工混用不同构建的文件。

### R3 · 发布操作验收待完成 · 宝塔 Nginx 与 ESA 必须同时核对

用户已确认正式站源站采用宝塔 Nginx。本次对公开站只执行只读 GET：主页、robots、Sitemap、RSS、Service Worker 均返回 200，响应头包含 `Server: ESA`、`Cache-Control: max-age=60` 与 HSTS。结合已有信息，推定公网前还有 ESA 层；其具体缓存规则仍需通过实际配置确认。

线上 Sitemap 的 26 个 URL 与 Astro 候选路由逐项比较，**缺失 0，额外 0**。当前线上 Service Worker 内容与原 Hexo 版本一致，尚未被本次审计替换。

切换前还需验收：

1. 获取并备份当前源站目录、宝塔站点/重写/SSL 配置以及实际 ESA 缓存规则，建立可执行回滚步骤。
2. 在独立测试目录验证 Linux 文件权限、真实 MIME、404 状态、旧 URL 301、HTML 与 SW 的更新策略，并检查公网 ESA 是否改写响应头或继续提供旧 HTML。
3. 交付时保持文件集一致，保留上一版本资源以供旧页面、缓存用户及回滚使用；确认目录切换方式。现有文档没有完整的原子发布及回滚演练记录。
4. 测试旧 Hexo Service Worker 到 Astro 的更新、已有安装用户刷新和回滚后的行为。
5. 完成上述验收并取得用户明确授权后再执行正式切换。

本地 Windows Nginx 验收不能替代这些真实环境检查。当前只读公网请求成功，也不能证明源站配置、缓存规则或回滚已经通过验收。

证据：[公网只读观察](evidence/release-audit/2026-10-17/live-public.json)、[线上路由对照](evidence/release-audit/2026-10-17/inventory-parity.json)。

## 3. 建议继续优化的具体项目

### R4 · P2 · 离线页需要跟随内容版本更新缓存

位置：`src/pages/sw.js.ts:4–8`。缓存名称固定为 `autuswing-astro-shell-v2`，离线页仅在 worker install 时写入。单独修改 `/offline.html` 不会改变 worker 文件。

**浏览器实际复现：**先安装当前 worker，再只修改隔离副本中的离线 HTML，联网 GET 已得到新标题；调用 registration.update() 后断网导航，仍显示旧缓存标题。测试结束后已恢复副本 HTML。

建议用离线壳内容的稳定哈希驱动 worker/cache 版本，或建立明确的离线页更新策略，继续保留缓存清理的归属边界。补充 HTML 单独更新、历史缓存清理、离线导航及回滚测试。该问题影响离线壳更新，联网文章仍采用 network-first。

证据：[离线更新复现](evidence/release-audit/2026-10-17/pwa-update.json)。

### R5 · P2 · PWA 图标产生了可避免的约 318KB 下载

位置：`src/config/theme.json` 的 `pwa.icon`、`src/pages/manifest.webmanifest.ts:13`。

侧栏头像已经是约 4.2KB 的 WebP，但 PWA 清单仍引用 317,783 字节的 `/img/avatar.png`。三次 Lighthouse 测量的网络记录均出现该原图请求；主页这一请求的传输量约占总量的 87%。不是侧栏头像优化失效，而是 manifest 图标另外下载了原图。

建议生成专用且经过压缩的 PWA 图标，保持现有头像、侧栏及配色不变，并验证安装图标的尺寸、格式与清晰度。这项优化可直接减少流量；本次没有进行因果对照实验，不能宣称它单独解释或解决 LCP。

### R6 · P2 · 先改善真实加载路径，再考虑拆 CSS

本地生产 Nginx，Edge headless，Lighthouse 13.5.0，移动端模拟网络/CPU，每页单次冷启动：

| 页面 | 性能 | 可访问性 | 最佳实践 | SEO | LCP | CLS | TBT |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 首页 | 96 | 100 | 100 | 100 | 2.85s | 0 | 0ms |
| 技术文章 | 89 | 100 | 100 | 100 | 3.75s | 0 | 1ms |
| 公式文章 | 93 | 100 | 100 | 100 | 3.23s | 0 | 0ms |

这是本地模拟数据，不是线上真实用户 Core Web Vitals，也不是多次运行的中位数。后续优化前应重复测量建立稳定区间。

LCP 元素为标题或正文段落。Lighthouse 也提示公共 CSS 阻塞、历史正文 PNG 尺寸过大和缺少尺寸属性。当前公共 CSS 原始约 53KB，JS 约 22KB，离线 gzip 估算分别约 11KB、7.6KB；仅凭 unused CSS 提示，没有理由再次大改已经稳定的 12 个样式模块。

建议顺序：优化上述 PWA 图标 → 检查首屏资源优先级与正文图片传输 → 复测文本 LCP → 再决定是否需要按页面拆少量样式。历史图片路径、原文件和批准视觉基准需要继续保护；涉及历史图片尺寸或视觉变化时单独评审。本次冒烟测试把 6 张历史正文图片逐张滚入视口，均正常加载，没有把 Lighthouse 对未加载懒加载图片的诊断快照当作坏图证据。

证据：[性能汇总及运行设置](evidence/release-audit/2026-10-17/performance/summary.json)，同目录保留 3 份压缩原始报告。

### R7 · P3 · 评估可选公式运行时的发布清单

静态产物共 356 个文件、13,389,700 字节。MathJax 和 NewCM 共 9,525,944 字节，约占 71%。当前页面采用 KaTeX 构建渲染，这些 MathJax 运行时没有在测量页面中加载，因此主要增加交付包和发布维护成本，不能把它们算作首屏下载。

建议在确认历史资源兼容与回滚保留要求后，再评估把未启用的运行时作为可选交付资源。不要直接删除迁移原件、历史静态 URL 或第三方授权文件，也不要为压缩目录体积提前改动文章。

## 4. 本次实际验证结果

| 范围 | 结果 | 证据 |
| --- | --- | --- |
| Astro 类型检查 | 0 error、0 warning；1 个已有 execCommand 弃用 hint | [日志](evidence/release-audit/2026-10-17/typecheck.log) |
| 生产模式静态构建 | 成功；28 个 HTML 文件包含 26 个 canonical 页面、404 与 offline | [构建日志](evidence/release-audit/2026-10-17/production-build.log) |
| 内容及资源检查 | 7 份 Markdown，4 份公开内容含关于页，3 份草稿；错误/警告均 0 | [原稿](evidence/release-audit/2026-10-17/content-with-drafts.log)、[输出](evidence/release-audit/2026-10-17/content-output.log) |
| 草稿隔离 | 演示 hdkzyv、oznmzt、qzvc5r 均未生成公开路由，也未进入 HTML 链接、搜索、Feed、Sitemap；误带草稿预览环境变量仍过滤 | [隔离构建记录](evidence/release-audit/2026-10-17/summary.json) |
| 单元测试 | 27/27，无跳过 | [日志](evidence/release-audit/2026-10-17/unit.log) |
| 迁移完整性 | 307 个导入文件、6 个可选资源、365 个原来源文件匹配 | [日志](evidence/release-audit/2026-10-17/source-integrity.log) |
| 旧链接与 SEO | 26 个 canonical 页面、21 条 301、879 个本地引用及历史锚点验证通过 | [产物检查](evidence/release-audit/2026-10-17/output.log) |
| 本地生产 Nginx | 配置检查通过；77 项 HTTP 检查通过，包括索引、301 查询参数、404、MIME、gzip、ETag/304、缓存、字体 CORS、SW | [HTTP 明细](evidence/release-audit/2026-10-17/nginx-http.json) |
| 交付浏览器测试 | Edge 与 WebKit 共 4/4，无跳过/重试通过；覆盖 390、820、1440 宽度、公式、资源及已有离线功能 | [原始报告](evidence/release-audit/2026-10-17/nginx-browser.json) |
| 生产产物交互冒烟 | Edge 的 390×844、820×1180、1920×1080：首页→文章→智能返回、搜索、代码复制、6 张历史图均通过，无横向溢出、资源失败或 pageerror | [指标](evidence/release-audit/2026-10-17/browser-smoke.json)、[6 张截图](evidence/release-audit/2026-10-17/screenshots/) |
| 可重复构建 | 连续两次生产构建，356 个文件哈希一致 | [记录](evidence/release-audit/2026-10-17/reproducible-build.json) |
| 已批准视觉基准 | 274 PNG + 274 JSON 哈希未变；本次未重跑完整 106 项视觉对比 | [本次保护校验](evidence/release-audit/2026-10-17/summary.json) |
| npm 已知漏洞 | 官方 registry 对锁文件全依赖审计返回 0；默认 npmmirror 不支持审计接口，已只通过 CLI 参数切换查询，没有修改 registry 配置 | [原始 JSON](evidence/release-audit/2026-10-17/npm-audit.json) |
| 凭据特征扫描 | 已跟踪文本文件未命中本次高置信度私钥/GitHub token/AWS key ID 特征；无跟踪的 .env 或私钥扩展文件 | [范围及结果](evidence/release-audit/2026-10-17/source-safety.json) |

漏洞与凭据扫描有各自的检测范围，不是整个项目安全性的保证；npm 审计也不覆盖手动复制的所有 vendor 发行文件。

本地生产候选目录：`E:\autuswing-astro\.local-tools\release-audit-20261017\workspace\dist`。[候选文件 SHA256 清单](evidence/release-audit/2026-10-17/artifact-manifest.json)仅用于审阅和比对，未经正式发布授权。

## 5. 未验证范围

- 当前 Linux/宝塔实际配置、源站 TLS、ESA 控制台策略、独立线上测试目录、正式切换与回滚未验收。
- Firefox 本次未运行；上一阶段启动失败的记录仍有效，不能标为已通过。未使用真实手机或平板。
- 评论按用户决定保持关闭；真实服务未验收。关闭状态已在生产产物中检查。
- 干净安装、Linux CI、发布自动化尚未通过本次审计。现有仓库没有 `.github` 工作流；后续 CI 可先生成并校验静态候选包，部署步骤应依据实际宝塔/ESA 交付方式另行设计。
- 本次新增的 6 张生产模式截图属于审计证据；没有更新已批准基准。完整视觉及功能套件的上一阶段结果见[写作阅读验收报告](writing-reading-report.md)，不计为本次重跑。

## 6. 建议实施顺序

1. **发布检查修复：**移除整个站点的固定数量断言，改为动态集合契约；保留历史内容不变的断言，增加新文章整链路成功测试。
2. **生产候选门禁：**统一构建环境与索引校验、输出提交与文件清单，验证干净安装；先实现自动检查及候选包生成。
3. **PWA 可靠性和资源：**修复离线页版本更新、压缩专用图标，复测既有离线/阅读/安装行为；保持现有视觉基准。
4. **真实环境发布演练：**核对宝塔与 ESA 的现有配置，备份、独立目录验收、旧缓存更新及回滚；经明确授权才切换。
5. **发布后的性能改进：**重复 Lighthouse 测量并结合真实访问数据，按证据优化首屏；可选公式资源体积清理安排在兼容及回滚保留要求确认后。

本轮止于审计，以上修复与正式发布均尚未执行。
