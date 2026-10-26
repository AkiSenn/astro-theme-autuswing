← [项目首页](../README.md) · [文档首页](index.md)

# 静态部署与缓存原则

Autuswing Astro 使用静态生成，输出可以交给合适的静态托管或源站。本页说明交付边界，不包含生产服务器地址、账户或配置。本轮文档改版不执行构建发布、上传、Nginx 重载、ESA 操作或 DNS 变更。

## 区分三个对象

| 对象 | 含义 |
| --- | --- |
| 开发包版本 `0.2.0` | 源码 package.json 元数据，不表示 GitHub Release 已发布 |
| 日常预览 `dist/` | 默认带 noindex 的本地构建，不直接替代生产候选 |
| 封存生产候选 | 含输入 / 产物哈希及校验结果的独立交付物，不保证存在完全对应的 Git 提交 |

当前正式候选为 `autuswing-20261026-79e9ddc-footer-configurable`；来源与差异见[状态说明](repository-state.md)。公开 GitHub Release 与站点上线是两套独立审批。

## 本地准备与交付

普通运行使用[开始使用](getting-started.md)中的 dev、check、build、preview 命令。维护者使用 `npm run publish:check` / `npm run release:build` 创建生产候选，`npm run verify:release -- <候选目录>` 复核既有候选；这些命令不部署。

取得实际部署批准后，只交付封存候选内的 `site/`，保留完整原始文件及其相对路径。不上传私有稿件、源码目录、迁移证据、构建报告或部署凭据。候选验证失败时停止交付，不补造 Git 编号或通过重写清单绕过失败。

## 托管端必须核对

- HTML、robots、manifest 与 Service Worker 应及时重新验证；新 HTML 可引用到的指纹资源必须已可获取。
- 只有 URL 或版本目录确实随字节变化、且不会原地覆盖的资源，才适合长期 immutable 缓存。非指纹图片应采用可更新策略。
- `.gz` / `.br` 侧文件仅是预压缩资源；服务器仍需按请求协商编码，保留原始文件，不能固定返回错误的 Content-Encoding。
- `_headers` 和 `_redirects` 是否生效取决于平台。Nginx 不会自动读取这些文本作为配置；需转换并检查 MIME、404、跳转、响应头和缓存。
- 资源跨域时核对实际托管路径、字体 CORS 与资源前缀；不要据此宣称子路径和多平台部署已经全部支持。
- PWA 缓存离线提示，不缓存文章全文。发布时应保证 SW 与离线页一致，不能只单独替换其中一个。

发布前保存上一份可回退产物和相应配置；部署、缓存刷新、线上验证与回滚由运维角色按批准方案执行。浏览器和真机结果由测试角色提供。

私有维护者可查阅[既有候选与回滚手册](../deployment/release-runbook.md)及[历史 Nginx 适配](../deployment/README.md)。它们保留历史上下文，不是通用公开发行附件。
