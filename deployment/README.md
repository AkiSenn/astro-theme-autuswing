# 宝塔 Nginx 静态交付

akisenn.com 的现有部署目标是宝塔中的 Nginx。用户在第五阶段选择先完成本地验收。本工程没有连接宝塔、上传网站目录、变更 DNS/CDN 或执行正式切换；516700.xyz 与 Yelee-Next 保持独立。

## 交付内容

- `dist/`：Astro SSG网站文件，旧文保持 `/post/编号/`，新稿使用 `/编号/`。
- `nginx/site.conf.template`：独立测试站的缓存、gzip、MIME、404与历史301配置。
- `npm run prepare:nginx`：从同一历史路由清单生成 `site.conf` 和21条精确匹配的 `redirects.conf`，不继承生产宝塔配置。

`_redirects`和`_headers`不是Nginx配置，模板禁止公开读取这些交付辅助文件。Nginx使用原生location、`try_files`、真实404和单一Cache-Control定义；版本化字体支持CORS。显式`.html` permalink保持200，新编号目录缺斜杠时301且保留参数。

## 本地复现

先运行 `npm ci` 和 `npm run build`。本轮使用[官方Nginx 1.30.6 Windows包](https://nginx.org/en/download.html)，解压到 `.local-tools/nginx-1.30.6/`，不提交二进制。

```powershell
npm run prepare:nginx -- --mime-types .local-tools/nginx-1.30.6/conf/mime.types
.\.local-tools\nginx-1.30.6\nginx.exe -p E:/autuswing-astro/.local-tools/nginx-1.30.6/ -c E:/autuswing-astro/.local-tools/nginx-config/nginx.conf -t
.\.local-tools\nginx-1.30.6\nginx.exe -p E:/autuswing-astro/.local-tools/nginx-1.30.6/ -c E:/autuswing-astro/.local-tools/nginx-config/nginx.conf
npm run verify:http -- http://127.0.0.1:8788
npm run test:nginx
```

地址为 http://127.0.0.1:8788/ 。路径按自己的独立项目位置调整。启动后同一配置的`-s quit`用于停止，`-s reload`用于重新加载。自动启动工具时本轮使用隐藏窗口。

模板只监听127.0.0.1。`prepare:nginx --root 绝对路径 --output 输出目录 --listen 127.0.0.1:8788 --mode preview`可生成其他本地配置。默认保持HTML noindex、robots禁止抓取和X-Robots-Tag。

## 后续宝塔独立测试站

1. 确认测试域名和独立目录，备份该测试站的Nginx配置；上传完整dist并保留目录结构。
2. 使用生成的301、缓存、MIME与`try_files`规则，核对宝塔已有location、SSL、缓存模块及前方CDN规则。示例不会自动替换面板维护的SSL配置。
3. 运行生产服务器的`nginx -t`，再通过独立测试地址执行HTTP校验。真实服务器需确认Linux权限、TLS、压缩、404、ETag、字体CORS与缓存，不能用本轮Windows结果替代。
4. `SITE_ENV=production`仅切换本地产物抓取策略；配置的`--mode production`须与之匹配。这两个设置都不执行上传或站点切换。
5. 正式切换前补齐Firefox、真机、真实浏览器缩放及需启用的评论服务验收，保存线上发布目录和配置的可回退副本，再取得用户明确授权。

## 其他静态托管

`wrangler.preview.jsonc`是保留的可选Workers示例，不是akisenn.com当前部署配置。第五阶段没有发布Worker或操作516700.xyz。可选`_headers`移除了通用Cache-Control，避免与资源专用规则叠加；将来启用Workers时仍须单独验证其HTML规范化与响应头，不能套用Nginx结果。

参考：[Nginx try_files](https://nginx.org/en/docs/http/ngx_http_core_module.html#try_files)、[响应头继承规则](https://nginx.org/en/docs/http/ngx_http_headers_module.html)、[Windows版本边界](https://nginx.org/en/docs/windows.html)。
