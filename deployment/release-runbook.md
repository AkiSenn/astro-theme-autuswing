# 生产候选、宝塔 Nginx 与 ESA 发布手册

本轮仅在本地验证，没有连接或修改服务器、DNS、ESA、Workers。源站为用户确认的宝塔 Nginx；审计观察到公网响应包含 `Server: ESA`。实际目录、Nginx/SSL 配置及 ESA 控制台规则尚未提供，以下方案须与真实配置核对。

## 模式与候选包

| 模式 | 入口 | 行为 |
| --- | --- | --- |
| development | `npm run dev`、`npm run dev:drafts` | 仅本地开发；显式写作模式可看草稿；拒绝 development 静态构建 |
| preview | `npm run build:preview`、`npm run preview` | 生成 `dist/`；HTML noindex、robots 禁止抓取；不能通过生产门禁 |
| production | `npm run release:build` 或 `npm run publish:check` | 强制正式 URL 与 production；新建候选目录；失败退出非零，不生成 READY |

普通 `npm run build` 保留安全的默认 preview。未知 SITE_ENV 报错。不要上传日常预览的 `dist/`。

```powershell
npm ci
npm run release:build
# 命令输出 VERIFIED_RELEASE=...，下文记为 <candidate>。
npm run verify:release -- <candidate>
```

```text
<candidate>/
  site/           唯一可成为公开站点根目录的文件集
  audit/          私有检查日志和结果
  release.json    私有模式、输入摘要、Git/运行环境、检查记录、文件 SHA256
  READY           release.json 的 SHA256，所有门禁通过后才生成
```

快照包含未发布稿件的排除信息；不要将整个候选根目录放进公网。只公开 `site/`。候选不得原地编辑或补文件，需要修改就生成新候选。`verify:release` 拒绝缺失、额外、修改过的站点文件、错误元数据及未完成的检查；它不依赖当前 Markdown，所以旧包在后续增删文章之后仍可验用于回滚。READY 是本地检查标识，不是数字签名、上线授权或线上浏览器验收证明。

生产流水线有构建锁。进程被强制终止后若残留 `.local-tools/releases/.build-lock`，先确认记录的 PID 已退出，再人工清锁，不要在构建期间清理。

## 本地验证同一份候选

```powershell
npm run prepare:nginx -- --release <candidate> --mode production --output .local-tools/nginx-production --listen 127.0.0.1:8789 --mime-types .local-tools/nginx-1.30.6/conf/mime.types
# 用此目录的 nginx.conf 做 nginx -t，再启动独立本地 Nginx。
$env:HTTP_RELEASE_DIR='<candidate>'
$env:HTTP_ASSET_ROOT='<candidate>/site'
npm run verify:http -- http://127.0.0.1:8789 --production
$env:NGINX_BASE_URL='http://127.0.0.1:8789'
$env:PWA_ARTIFACT_ROOT='<candidate>/site'
npm run test:nginx
npm run verify:release -- <candidate>
```

production 配置生成必须传入已验证候选。模板是独立测试站示例，不覆盖宝塔维护的正式 server/SSL 配置。测试时直接服务该 `site/`，不能重建另一份后代替原候选。

## 缓存原则

| 对象 | 源站与 ESA 的目标策略 | 切换要求 |
| --- | --- | --- |
| HTML、根路径、文章/归档/标签目录 | `max-age=0, must-revalidate` 或 no-cache；首次切换建议 ESA 不缓存 HTML | 清旧 HTML，确认没有全站 noindex；禁止一年 immutable |
| `/sw.js` | no-cache，绕过 ESA 缓存与改写 | 及时获取新 Worker，不强制刷新文档 |
| `/offline.html` | 及时重验证，禁用 ESA 内容改写 | 与 Worker 同版；解压后字节哈希必须匹配，旧 CDN 内容会被新 Worker 拒绝 |
| `/manifest.webmanifest` | no-cache | 与新图标地址同步 |
| `/_astro/`、`/pwa/` 的内容哈希文件 | 一年 immutable | 保留旧文件，不全量清缓存 |
| 版本化 vendor 字体/资源 | 一年 immutable，保留字体 CORS | 同一路径不替换内容 |
| `/img/` 原路径图片 | 当前模板一天缓存，缓存键保留版本查询参数 | 保留历史原图；将来改图优先新文件名 |
| 搜索、Feed、Sitemap、robots | 及时重验证，排除迁移时旧缓存 | 检查集合与抓取策略 |
| 404 | 真正 HTTP 404、no-store、页面 noindex | 不使用 SPA 回退伪造 200 |

公网曾观察到 `max-age=60`，不能据此认为以上规则已生效。需核对 ESA 优先级、缓存键、是否覆盖源站响应头，以及 HTML/JS 改写；分别验证源站与公网。

## 正式发布前人工步骤

1. 冻结并记录已审核提交、候选路径、READY 与本地验收结果，确认演示稿仍是草稿，评论继续关闭。
2. 备份当前线上完整目录、宝塔 Nginx/重写/SSL 配置和 ESA 规则。保留 Hexo 的旧 `/assets/` 和离线资源。迁移前本地备份不能代替当前线上备份。
3. 确定独立测试位置及服务器 releases 目录，上传到新的空版本目录，避免覆盖同步和删除旧资源。
4. 上传前再次 `verify:release`。上传后按 release.json 的 SHA256 逐一核对服务器文件，并比对完整文件集合。服务器只需要静态服务；没有 Node 时，可在具备 Python3 的部署环境导出 SHA 清单，再使用 `sha256sum -c`，同时额外核对文件集合，防止遗漏多余文件。校验元数据必须放在公网根目录外。
5. 确定并演练旧哈希资源保留机制。建议维护站点根之外、只追加的不可变资源池，通过经验证的 Nginx location/alias 访问，或采用等效机制；回滚后新旧页面引用的资源都要可用。不能事后往已封存的 `site/` 拼文件来保留资源，那会使候选哈希失效。
6. 独立测试环境运行 nginx -t、路由/SEO/HTTP、旧 Hexo Worker 更新、离线/联网恢复和回滚演练。公网测试地址另设访问限制/响应头 noindex，该测试层不能带进正式站；不要修改候选 HTML 后声称验收了同一份产物。
7. 核对 ESA 缓存与改写规则。补验正常浏览器实际安装、手机主屏图标、Firefox/目标设备。Edge 自动化安装条件通过不等于已安装到操作系统。
8. 得到用户明确授权后才切换站点根目录/current 指向，按实际宝塔路径调整配置并运行 nginx -t。只清理 HTML、Worker、清单、索引等可变资源的 ESA 缓存，保留不可变资源。
9. 从源站和公网复核首页、历史 URL、新编号链接、21 条旧 301、404、robots、canonical、Sitemap、评论关闭、压缩、缓存和已有浏览器会话。观察资源失败、404、5xx 与 Worker 更新。

后续 CI 可先执行 `npm ci`、测试与 `release:build`，保存候选作为私有构建产物；部署凭据、宝塔上传及 ESA 操作须依据实际交付方式另行配置。本轮没有新增自动部署或线上操作。

## 回滚

1. 保留上一版完整候选和当前 Hexo/配置备份。回滚前核对旧包哈希及策略，不从当前源码重新构建所谓旧版。
2. 确保新旧两版哈希资源在共享资源池/等效机制中继续可用，避免缓存 HTML 请求不到资源。
3. 把根目录/current 恢复到上一版，或按备份恢复 Hexo 文件集与配置，执行 nginx -t 后应用，保持 DNS 不变。
4. 清 ESA 的 HTML、sw.js、offline、manifest 与索引缓存，保留不可变资源，并复核源站与公网。
5. Astro Worker network-first，不缓存文章 HTML；离线壳回滚同样按哈希更新，不清用户偏好、不强制刷新。回到 Hexo 时需额外验证旧脚本重新注册及资源可用性。本轮未演练真实服务器/ESA 切换。

观察期结束前不要删除旧版本或共享资源。文件哈希验证不能代替 Nginx/ESA 真实配置与回滚验收。
