← [项目首页](../README.md) · [文档首页](index.md)

# 源码基线与生产对应关系

核对日期：2026-10-27。本文供当前 Private 仓库审阅，区分文档依据、生产交付和未来发行，不授予部署或公开权限。

## 四份状态分别看待

| 对象 | 核实状态 | 本轮用途 |
| --- | --- | --- |
| `main`，`f111e47c7380d1eba145f35b964542b051e9411e` | 较早开发状态，包 0.2.0 / MIT；README 尚有本地验收表述 | 历史对照，不作为当前完整功能介绍依据 |
| `codex/astro-migration`，`f1d0e65206143c2e55b6557fd89f7c667d26acda` | 领先 main 49 个提交；有写作、候选门禁、样式及维护文档 | 独立文档工作分支的 Git 基线 |
| 最新字体声明快照，`612ee24560c7ec8b60cb9c0bc42017ec0519e656` | 独立根历史；中性示例、配置及测试子集；UNLICENSED，根 LICENSE 未携带 | 仅参考通用化 / 字体记录，不合并、不冒充生产 |
| `autuswing-20261026-79e9ddc-footer-configurable` | 经输入 / 产物哈希封存；release.json 的 Git commit 为 null | 正式站外观与生产差异的核对依据 |

[分支列表](https://github.com/AkiSenn/astro-theme-autuswing/branches) · [main 与迁移分支比较](https://github.com/AkiSenn/astro-theme-autuswing/compare/f111e47c7380d1eba145f35b964542b051e9411e...f1d0e65206143c2e55b6557fd89f7c667d26acda) · [筛选快照说明](https://github.com/AkiSenn/astro-theme-autuswing/blob/612ee24560c7ec8b60cb9c0bc42017ec0519e656/README.md)。

本地原开发工作区另有两个领先提交及未提交 / 未跟踪文件。本轮没有将其带入文档基线，未覆盖或清理它们，也未纳入测试站阅读联动原型。所有新修改只在独立文档工作区进行。

## 生产封存核对

封存来源记录注明基于本地 `79e9ddc9136ac18ce371df7272ad4cd54019580b`，再叠加获批的 `src/components/Footer.astro` 和 `src/styles/footer.css`。该提交不是完整生产源码的身份；封存件没有 Git checkout，不能为它补造提交对应关系。

本次只读重算并核对：

- 封存的 1,089 项构建输入哈希一致。
- 候选 `site/` 的 359 个文件全部匹配清单，未发现额外文件。
- 来源清单及 release.json 的 SHA256 匹配来源记录。
- 归档 SHA256 为 `35876749fe748c169391436dd21d451925bd80b3a1017dc83cc4a93b100a000d`，与封存记录一致。
- `inputDigest` 为 `9ecf75aa1bdaff29121462504413e27bc83a9d6e36a48d4f021db88fdbb5552f`。

这证明已检查本地封存件与相应清单的一致性，不是本轮重新执行生产验收或在线文件全量比对。站点维护者确认 2026-10-26 已切换并通过生产 / 真机验收；旧准备记录中的 WAITING 状态保留历史语境，不倒推当前尚未上线。

## 与文档 Git 基线的差异

在封存的构建输入范围内，`f1d0e65` 与生产候选有以下 7 个文件不同：

| 文件 | 差异范围 |
| --- | --- |
| `src/styles/cards.css`、`pages.css`、`tokens.css` | 后续次要文字配色与日期小字号调整 |
| `src/styles/overlays.css`、`tests/browser/floating-tools.spec.ts` | 后续窄屏目录按钮位置与相关测试 |
| `src/components/Footer.astro`、`src/styles/footer.css` | 生产批准的页脚归属链接、布局与年份表达 |

其余 1,082 项封存输入一致，其中包含文章和公共资源。该比较只针对封存输入，不表示所有 Git 文件、内部文档或测试目录都相同。本轮只描述共同实现，将生产差异明确列出，不修改运行代码来追平生产。

最新筛选快照另有站点身份、内容装配和资源处理差异，并裁去了大量检查脚本、内部文档与证据；不能因为它较新、内容较干净就用它代表完整验收。字体补充记录可[单独查阅](https://github.com/AkiSenn/astro-theme-autuswing/blob/612ee24560c7ec8b60cb9c0bc42017ec0519e656/public/assets/vendor/THIRD-PARTY.md)，不向本分支 vendor 拷贝或修改第三方发行文件。

## 版本语义

包 `0.2.0` 是开发元数据；仓库 Private 与 package.json 的 private 是不同设置，当前均保留。核对时没有 GitHub Release、正式版本标签或 Actions 运行记录，所有分支当前文件树均无 .github 配置，因此不展示 CI 通过或 Release 下载徽章。

未来版本台账应分别记录完整 Git SHA（不可确认时为 null）、候选编号、输入摘要、产物哈希、测试报告及运维发布记录。合并、正式标签、Release 和可见性变更仍须维护者 / 用户明确批准。

<a id="open-source"></a>

## 尚待完成的开源准备

- 闭合实际继承代码片段的来源和许可，解释 main / 迁移分支 MIT 与筛选快照 UNLICENSED 的边界；不通过本轮文档替项目重新授权。
- 核实头像、背景、品牌专属图形、Tabler 适配和数学字体的具体分发范围；字体补充声明仍记录未关闭来源事项。
- 决定公开文件白名单，排除私人文章、配置、内部证据、备份路径及其他不宜公开信息；保留私有原件，并审查所有拟公开的 Git 历史。
- 完成跨站配置、内容初始化和必要验收，避免把站主迁移工程当成通用 Starter。
- 建立依赖更新、安全报告、PR / CI 门禁及版本与 Release 流程；不把尚未读取的安全告警当作不存在。
- 对新 Logo 矢量稿及截图的使用范围作最终审阅；文档品牌素材不自动改动网站图标。

Private 阶段可以先完成项目展示。这些待办不阻止文档审阅，也不构成当前开源放行。
