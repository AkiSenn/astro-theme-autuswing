← [项目首页](../README.md) · [English overview](../README.en.md)

# Autuswing Astro 文档

从本地预览开始，慢慢把空间整理成自己的样子。这里维护 Astro 版本的说明；Hexo 版另见[旧仓库](https://github.com/AkiSenn/hexo-theme-autuswing)。

当前用于 Private 仓库的开发者协作，尚非通用发行手册。功能说明依据 `f1d0e65`，正式站采用独立封存候选；先读[源码与生产对应说明](repository-state.md)，避免将两个状态混为一谈。

## 开始使用

| 你的目标 | 文档 |
| --- | --- |
| 准备环境、本地运行、理解构建模式 | [开始使用](getting-started.md) |
| 找到站点和主题配置 | [配置入口与迁移边界](configuration.md) |
| 深浅色、背景、卡片与三端布局 | [外观指南](appearance.md) |
| 草稿、日期、图片、代码与永久链接 | [写作指南](writing.md) |
| 数学语法与构建时 KaTeX | [数学公式](math-rendering.md) |
| SEO、搜索索引、订阅与历史地址 | [SEO 与 URL](seo-and-urls.md) |
| 静态产物、缓存、发布边界 | [部署原则](deployment.md) |
| Logo 文件与使用规范 | [品牌说明](branding.md) |
| 正式站深浅色实景 | [主题预览与截图来源](preview.md) |

## 贡献与维护

| 入口 | 用途 |
| --- | --- |
| [源码指南](source-guide.md) | 目录职责、构建流程、按范围选择检查 |
| [贡献约定](../CONTRIBUTING.md) | 文件保护、提交范围、验收和授权边界 |
| [更新记录](../CHANGELOG.md) | 未发布文档变更，不替代 GitHub Release |
| [源码与生产状态](repository-state.md) | 分支差异、生产封存标识及开源待办 |
| [第三方图标记录](../THIRD-PARTY.md) | 图标来源、适配与尚未关闭的品牌使用事项 |
| [数学资源声明](../public/assets/vendor/THIRD-PARTY.md) | 当前基线随包声明；字体补充记录见状态页 |
| [现有根许可](../LICENSE) | 保留原件，不代表来源审查已结束 |

## 开发记录 / 历史迁移资料

下列文档保留原路径与历史语境。其中的验收结果、未完成项和“尚未上线”等描述属于各自记录时间，不覆盖 2026-10-26 的生产切换状态。它们可能含私人路径和内部证据，仍留在私有协作范围，不应随未来公开包直接发布。

| 主题 | 记录 |
| --- | --- |
| 迁移与交付 | [第二阶段](phase-2.md) · [第三阶段](phase-3.md) · [第四阶段](phase-4.md) · [第五阶段](phase-5.md) |
| 开发交接 | [历史修订审批与分页总数](development-handoff-20261018.md) |
| 阅读布局 | [布局分离](reading-layout.md) · [桌面阅读](desktop-reading.md) · [宽屏补充](desktop-reading-wide.md) |
| 导航与侧栏 | [目录控制](contents-controls.md) · [底部分组](sidebar-bottom.md) · [作者区](sidebar-profile.md) · [社交链接](social-links.md) |
| 样式与动效 | [样式架构](styles-architecture.md) · [动效系统](motion-system.md) · [历史返回方案](smart-back.md) |
| 写作改进 | [写作审计](writing-reading-audit.md) · [写作与阅读报告](writing-reading-report.md) |
| 候选与回归 | [生产候选审计](production-release-audit.md) · [修复记录](production-release-fixes.md) · [隔离演练](isolated-release-rehearsal.md) |
| 浏览器调查 | [Firefox 验收](firefox-acceptance.md) · [行盒调查](firefox-linebox-investigation.md) · [本地验证](firefox-local-verification.md) · [引擎专项](firefox-webkit-focused-investigation.md) |
| 旧 Safari | [组件兼容](ios14-component-compatibility.md) · [响应式兼容](legacy-safari-responsive.md) |
| 历史参考 | [Qianling 参考](reference-qianling.md) |
| 运维历史 | [本地 Nginx 交付](../deployment/README.md) · [候选与回滚手册](../deployment/release-runbook.md) |

`migration/` 与 `docs/evidence/` 保持原位，不移动、不重写；检查它们时应核对对应时间、输入和执行范围。历史「智能返回」等方案不能仅凭文档存在就当作当前功能。
