# 非公开 Markdown 样本

`reading.md` 由测试专用请求拦截器，通过与生产相同的 Markdown processor 渲染到真实文章外壳。它不属于 Content Collections，不生成静态路径，不进入搜索、RSS 或 Sitemap。

先运行 `npm run build`，再运行 `npm run test:markdown`。浏览器测试会自动复用或启动本地 Node 静态预览；截图默认写到 `docs/evidence/writing-reading/browser/`。样本 URL `/__test__/markdown/` 只存在于测试浏览器的拦截器中，正常请求应返回 404。

样本截图仅作为诊断证据。既有 `tests/styles/snapshots` 的 274 张图片及指标保持冻结；本样本不会自动更新它们。
