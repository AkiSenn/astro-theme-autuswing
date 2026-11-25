# 部署环境配置

`src/config/site.yml` 维护站点身份与内容设置，`theme.yml` 保留外观和功能开关。部署域名及挂载路径由 `src/config/environments.yml` 管理。

```yaml
development:
  origin: "http://127.0.0.1:4322"
  basePath: "/"
preview:
  origin: "https://preview.example"
  basePath: "/"
production:
  origin: "https://blog.example"
  basePath: "/"
```

顶层键同时是环境标识与模式，沿用 `SITE_ENV`。默认开发服务为 Development，静态构建为 Preview；`npm run build:preview` 强制选 Preview。Development 仅允许环回地址。Preview 和 Production 必须使用各自的 HTTPS DNS 域名，不含凭据、路径、查询或片段。默认的 `.example` 预览地址是占位；Starter 没有默认生产域名。禁止用 Astro `--site` 覆盖已解析域名。

`basePath` 缺省为 `/`，允许安全 ASCII 路径段，如 `/blog`，统一为尾斜杠形式。拒绝遍历、重复斜杠、反斜线和百分号编码。构建在 Astro 配置阶段解析一次；同一值供 Astro `site/base`、页面 URL、索引模式、Markdown 域名识别与缓存使用。构建记录附模式、域名、挂载路径和产物 SHA256。

旧身份配置的 `url` 迁移到 `production.origin`，旧 `root` 按实际挂载位置迁移为 `basePath`。旧 `release-policy.json.productionUrl` 已移除，文件仍负责 noindex 例外。没有到身份 URL 或预览域名的生产回退。

`npm run dev` 启动开发服务；`npm run build:preview` 生成带 noindex 的预览产物。PowerShell 生产构建：

```powershell
$env:SITE_ENV = 'production'
npm run build
Remove-Item Env:SITE_ENV
```

子路径构建包含站内导航、分页、搜索、静态资源、RSS/Atom 与 PWA。**生产发布封存和验包仍拒绝子路径。** 本地验证不等同于任意托管平台的路由、缓存和 HTTPS 配置已经验收。

## PWA

同一个挂载路径下发布完整构建；不要混放不同构建的 Worker 与离线页。以 `/blog/` 为例：

- HTML 发现 `/blog/manifest.webmanifest`，图标位于 `/blog/pwa/`。应用起始地址、scope 和 ID 均为 `/blog/`；根路径继续使用原有隐式 ID。
- Worker 位于 `/blog/sw.js`，注册范围为 `/blog/`，无需放宽 `Service-Worker-Allowed`。根站和其他挂载仍可独立注册。同一个浏览器 Origin 下的同一个 scope 只有一份活动注册；若在该地址切换环境，浏览器会更新该注册，环境缓存仍各自保留。
- 缓存名称由环境、配置 Origin、挂载路径、构建版本及离线页字节的摘要组成。激活只清除本实例的旧版本；历史未分命名空间的旧根站缓存只由根站迁移。不同 Origin 的 Cache Storage 也由浏览器本身隔离。
- Worker 对当前站点已声明的页面和历史入口使用网络优先；未知路径以及其他挂载不使用本实例的离线提示。离线时首页与文章均回退到独立离线页，页内返回链接指向本实例首页。它不保存文章 HTML、搜索索引或任意资源，安装需联网。
- 更新先重新下载离线页并核对 SHA256。断网或字节不符时保持当前 Worker；重新联网后可重试。回滚应提供同一旧版本的 Worker、离线页及全部构建资源。旧版未做子路径隔离的根 Worker 在升级前不具备新的路由保护。

可运行 `node tests/deployment-pwa-matrix.integration.mjs` 生成隔离构建与 HTTP 证据，将输出目录设为 `PWA_MATRIX_DIR`，并把其 Preview 根产物设为 `PWA_ARTIFACT_ROOT` 后运行 `npm run test:pwa`。iOS 真机需另外验证。
