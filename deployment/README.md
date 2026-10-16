# 独立静态交付

第二阶段只在本机运行，没有发布任何 Worker、绑定域名、修改源站或 CDN。

`dist/` 是唯一交付产物，含 `_redirects`、`_headers`、404、RSS/Atom 与地图。`wrangler.preview.jsonc` 仅为后续独立测试站准备，不包含生产 route、account、密钥或正式域名绑定；当前没有添加部署命令或 Cloudflare SSR adapter。

`npm run preview` 使用本机 Node 静态服务读取构建的 `_redirects`，便于检查 HTTP 301 和 404。它不是 Cloudflare/ESA/Nginx 的行为证明。阶段五必须在批准的独立测试环境实测所有规则及缓存/MIME，尤其注意 Workers 的自动 HTML 规范化可能影响未来显式 `.html` permalink；当前历史 `.html` 地址由显式 301 规则统一到 `/post/编号/`。

默认构建是预览策略：HTML noindex、robots 禁止抓取、关闭真实评论/统计。只有显式设置 `SITE_ENV=production` 才生成正式索引策略；这只控制本地产物，不执行部署。

其他静态托管可复用同一 `dist/`，按平台导入重定向和缓存头。没有继承原站 SSH、宝塔发布器或 516700.xyz 配置。

参考：[Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/)、[HTML handling](https://developers.cloudflare.com/workers/static-assets/routing/advanced/html-handling/)。
