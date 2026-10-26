← [项目首页](../README.md) · [文档首页](index.md)

# 开始使用 Astro 版本

这份说明面向获得私有仓库访问权限的开发者。主题尚未整理成通用 Starter；原站文章、迁移证据和配置不是新站示例。请在独立副本操作，保留已有未提交文件；不要向个人工作区执行清理或重置。

## 环境与源码

`package.json` 固定 Astro 7.4.0，要求 Node.js ≥ 22.22.0，包开发版本为 0.2.0。本指南以 `codex/astro-migration` 的 `f1d0e65` 为功能依据，后续分支可能变化；默认 `main` 仍较早。需要严格重现时，由维护者提供并核对完整提交，不以开发版本号代替源码标识。

```sh
git clone https://github.com/AkiSenn/astro-theme-autuswing.git
cd astro-theme-autuswing
git switch codex/astro-migration
npm ci
npm run dev
```

浏览 <http://127.0.0.1:4322/>；停止服务用终端的 Ctrl+C。开发服务、静态预览默认使用同一端口，顺序运行。

```sh
npm run check
npm test
npm run build
npm run preview
```

`check` 做 Astro 类型和模板检查，`test` 运行单元测试；`build` 写入本副本的 `.astro/` 和 `dist/`，`preview` 读取已生成的 `dist/`。构建不应写回文章。没有依赖、构建结果或仓库访问权限时，先解决相应问题；没有公开安装包可以替代这些步骤。

## 从哪里改设置

| 位置 | 作用 |
| --- | --- |
| `src/config/site.json` | 站名、作者、语言、时区、站点 URL 与分页 |
| `src/config/theme.json` | 外观、菜单、社交、评论、SEO、页脚与 PWA |
| `src/config/zh-CN.json` / `default.json` | 简体中文 / 英文界面文本，不是作者内容 |
| `content/posts/`、`templates/` | 新文章和新稿模板 |
| `content/legacy/`、`migration/` | 原站迁移与身份保护，不能直接覆盖为自己的内容 |
| `public/` | 按原路径交付的静态资源 |

在独立开发副本调整自己的身份字段前，先读[配置指南](configuration.md)。`root`、时区及生产域名校验仍含迁移契约，更换站点不只是修改 README 示例；本轮没有改变这些约束。

## 预览、候选与上线

普通 `build` 默认是预览，带 noindex 策略，真实评论和分析被隔离。`npm run dev:drafts` 是显式本地草稿预览；普通静态构建仍排除草稿。

`npm run publish:check` / `npm run release:build` 用于本地生产候选门禁，生成独立封存目录，不是 GitHub Release，也不上传站点。准备候选前应阅读[部署原则](deployment.md)与私有维护手册；不要为了试运行而改变生产配置。获准交付时只交付候选的 `site/`，不把源码、稿件和证据作为网站根目录。

## 常见问题

| 现象 | 优先检查 |
| --- | --- |
| 无法克隆 | 账号是否拥有私有仓库访问权限 |
| 脚本或功能与文档不同 | 当前分支与提交；默认 main 和筛选快照不是同一基线 |
| 草稿不出现 | 普通预览排除草稿；使用显式草稿预览，见[写作指南](writing.md) |
| 静态预览启动失败 | 是否先构建、端口是否被开发服务占用 |
| 文章完整性校验失败 | 是否改动旧文章；按受控修订流程处理，不覆盖原哈希 |
| 链接仍指向原站 | 配置、canonical、迁移契约及候选策略尚未完成跨站通用化 |

详细检查入口见[源码指南](source-guide.md)。
