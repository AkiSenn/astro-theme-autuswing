← [项目首页](../README.md) · [文档首页](index.md)

# 源码与贡献者入口

本文对应 `f1d0e65` 的 Astro 实现。项目状态、生产差异与版本语义见[状态说明](repository-state.md)；文件保护和提交规则见[贡献约定](../CONTRIBUTING.md)。

## 目录职责

| 位置 | 职责 |
| --- | --- |
| `astro.config.mjs` | Astro 静态生成、Markdown、Sitemap、资源与构建集成 |
| `src/config/`、`src/site.config.ts` | 站点 / 主题原始设置、派生菜单、语言与构建环境 |
| `src/content.config.ts` | 内容集合加载、元数据校验、草稿与历史兼容入口 |
| `src/pages/` | 首页与路由、搜索、Feed、robots、PWA 等静态端点 |
| `src/components/`、`src/layouts/` | Astro 模板、侧栏、文章、目录、SEO、页脚和弹层 |
| `src/lib/` | 内容、URL、日期、Markdown、数学、Feed、离线和 PWA 图标 |
| `src/scripts/` | 外观、导航、目录、搜索、灯箱、评论及其他原生客户端模块 |
| `src/styles/` | token、布局、导航、卡片、正文、阅读工具、页脚、弹层和动效 |
| `content/legacy/`、`migration/` | 原站文章与身份 / 时间 / 链接证据；不是通用示例内容 |
| `content/posts/`、`templates/` | 新稿与普通 / 教程 / 系列模板 |
| `public/` | 保持公开路径的静态图片与固定版本第三方数学资源 |
| `scripts/`、`tests/` | 检查、候选封存、单元 / 浏览器 / 视觉与受控场景 |
| `docs/`、`deployment/` | 用户说明、历史记录、静态交付与私有运维手册 |

`.astro/`、`dist/`、`.local-tools/`、`test-results/` 等保存缓存、产物或证据；不要编辑生成副本来实现功能，也不要清理其他对话正在使用的目录。

## 构建与内容边界

配置和内容集合进入共享库，再由路由与 Astro 组件生成静态页面；Vite 编译浏览器模块及样式，构建集成输出跳转、地图兼容入口和校验契约。新稿编号只在显式创建时写入，构建只读文章；历史修订使用追加审批链，不覆盖原始清单。

样式通过 BaseLayout 导入，由 Astro 打包。布局或断点改动应参考[样式架构](styles-architecture.md)，不更新冻结截图来掩盖回归。数学由 KaTeX 在构建时渲染；vendor 不作为日常修改入口，资源许可与运行文件分别核对。

<a id="validation"></a>

## 按影响选择验证

| 改动 | 合适的入口 |
| --- | --- |
| 文档和品牌素材 | 相对链接 / 锚点、命令与 package.json、图片与 SVG、明暗和小尺寸渲染、Git Diff |
| 一般源码行为 | `npm run check`、`npm test`，并验证原失败场景 |
| 内容和输出 | `npm run check:content`；构建后用 `npm run verify` 或 `npm run check:content -- --output` |
| 写作功能 | `npm run test:markdown`、`npm run verify:writing` |
| 布局与交互 | `npm run test:browser`，按需要使用 `test:browser:cross` 和 `test:styles` |
| 候选交付门禁 | `npm run test:release`；生产候选流程另见[部署原则](deployment.md) |

`verify:styles` 会顺序检查、构建和视觉比较；`test:styles` 比较已有 dist。fixture、写作检查和候选流程可能重建或临时修改本副本，不与占用相同目录的预览和测试并行。浏览器安装与执行环境按现有 Playwright 配置准备，不能以模拟视口代替真机。

结果必须标注受测提交或输入哈希、环境、实际命令与未验证项。旧报告、局部通过、候选 READY、正式站可访问与公开发行批准各有范围，不能互相替代。

## 原 README 中的维护信息

原首页混合了本机目录、迁移前备份位置、审计路径、阶段报告及本地 Nginx 端口。对用户有价值的运行说明已整理到[开始使用](getting-started.md)，验证入口在本页，阶段与专项记录集中于[文档索引](index.md)。

原始 README 仍可在[固定 Git 历史](https://github.com/AkiSenn/astro-theme-autuswing/blob/f1d0e65206143c2e55b6557fd89f7c667d26acda/README.md)查阅，仅限有权限的维护者。真实备份、文章、草稿、迁移资料和历史报告均保持原位，没有为清理首页而删除或移动。不要把历史备份路径复制为用户安装步骤。
