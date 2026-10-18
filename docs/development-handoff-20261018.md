# 开发交接：历史修订审批与分页总数

范围：只实现用户批准的两项改进。搜索摘要未实施；评论继续关闭。没有修改实际 Markdown、SEO 生成逻辑、URL 规则、CSS、生产配置或外部环境。

## 1. 历史文章受控修订

提交：`5af1da6`。

根因有两处：`verify-content.mjs` 要求所有历史稿件永远匹配首次迁移哈希；`verify-output.ts` 又要求历史文章的 modified_time 永远等于首次迁移记录。作者正常更新旧教程会被这两道检查拒绝。

现在保留原清单，以 `migration/revisions/<ID>.<六位序号>.json` 追加批准记录。审批须提供旧/新 SHA256、原因及明确的 ID 确认，并要求当前文章已提交 Git；发布检查核对完整哈希链、记录引用的 Git 文件字节及当前文章。原 ID、原始发布日期和 permalink 不能通过审批改变。当前仓库没有给任何真实文章新增审批记录。

修改文件：

- `scripts/legacy-revisions.mjs`：共用记录、Git 内容与身份校验。
- `scripts/approve-legacy-revision.mjs`：只读预览与显式审批命令。
- `scripts/verify-content.mjs`、`scripts/verify-output.ts`：接入批准版本，保留原迁移证据及其他门禁。
- `scripts/revision-fixture-git.mjs`、`scripts/verify-release-fixtures.mjs`：隔离副本只从本地原仓库补齐审批所引用的 Git 对象；不改作者仓库。
- `scripts/verify-legacy-revision-fixtures.mjs`、`tests/legacy-revisions.test.ts`：集成与专项测试。
- `migration/revisions/.gitkeep`、`package.json`、`docs/writing.md`：入口、空记录目录和作者操作说明。

开发侧结果：6/6 专项测试通过；批准旧文的生产流水线集成 7/7 通过，包括新正文/显式 updated 输出、原 URL/发布日期不变、未批准及批准后再改稿被阻断。第一轮入口测试曾暴露 Windows 长路径与 8.3 路径比较问题，已改为 native realpath 并通过回归。

独立验收重点：

1. 在隔离副本修订一篇旧文章，普通发布检查必须先失败，且没有自动写审批文件。
2. 缺确认、哈希不符、未提交 Git、错误记录/缺提交、审批后再改稿，必须失败；原清单哈希和旧记录不能被更新。
3. 批准版本通过完整生产门禁，正文更新且原 ID、canonical、发布日期保持稳定；显式 updated 可更新。
4. 验证连续两次批准、不同文章、已存在审批记录的隔离回归副本。
5. 验证试图改变历史 ID、permalink、原 date 时，即使请求审批也被拒绝。

```sh
node --import tsx --test tests/legacy-revisions.test.ts
npm run test:legacy-revisions
```

操作流程见 [写作说明](writing.md#历史文章受控修订)。构建含审批记录的源码需要相应 Git 历史；封存候选的独立校验与回滚仍不依赖源码 Git。

## 2. 归档、标签、分类分页总数

根因：列表路由只携带当前页 `page.data`，组件以其长度充当整个集合数量。集合有 11 篇时，原来两页显示 10 和 1。

现在 `route.totalItems` 来自 Astro 的 `page.total`，`route.posts.length` 仍是当前页篇数；两者分开。各路由使用自己的筛选集合。没有改变每页数量、排序、分页格式或 URL。

修改文件：`src/lib/listing.ts`、`src/lib/routes.ts`、`src/components/RouteContent.astro`、`tests/listing.test.ts`、`scripts/verify-listing-fixtures.mjs`、`package.json` 及本文。

开发侧结果：

- 使用实际 Astro 分页器的专项测试 7/7 通过，覆盖 0、1、10、11、25 篇、分类隔离和关闭分页。
- 静态 HTML 集成 12/12 通过，检查真实总数、当前页篇数、成员、顺序和前后页 URL；覆盖多个标签、父子分类、其他分类、年月归档及空集合。
- 当前三篇文章生成的 18 个归档/标签/分类列表，其 `.archive-page` HTML 与封存 r4 产物逐字相同。没有据此替代像素验收。

```sh
node --import tsx --test tests/listing.test.ts
npm run test:listings
```

空归档继续生成一页，总数 0；不存在的空标签不人为增加路由。需要测试对话独立检查多标签、同名不同层级分类及分页导航。

## 3. 共同验收边界

最终源码生产候选构建的全部门禁通过，单元测试 51/51，无跳过；包括类型、内容、历史完整性、构建后资源及生产输出检查。它不代表整个站点的浏览器验收或正式发布已经通过。

既有 `npm run test:release` 的 33/33 场景通过，包括重复 ID、无效路径、预览混入生产、错误 canonical、缺失/陈旧内容、产物篡改和输入变化的拒绝检查。日志中的错误属于预期负例，最终进程退出 0。此次报告保存在 `.local-tools/dev-two-improvements-20261018/release-regression.json`，原历史报告已恢复原字节。

保护核对：本轮开始时的 20 个未提交/未跟踪文件全部保留原字节，包括三篇演示草稿及前轮 Firefox 调查资料；274 张 PNG 和 274 份布局 JSON 的 SHA256 全部不变。首次迁移清单和真实文章未修改，没有部署或连接服务器、DNS、ESA。

已有 Firefox 几何及 WebKit 转场未关闭项维持原状态，交由测试对话继续独立处理，不因本次功能门禁通过而放行。
