# Contributing to Autuswing

感谢你对 Autuswing 的关注与贡献！欢迎通过 Issue 和 Pull Request 参与改进。

## 开发环境

- **Node.js**：>= 22.22.0
- 安装依赖并启动本地预览：

```sh
npm ci
npm run dev
```

## 提交前检查

提交代码或文档前，请确保以下检查全部通过：

```sh
npm run check
npm test
npm run build:preview
npm run verify
```

## 编码与文档约定

- 使用 UTF-8、LF 换行和 2 空格缩进。
- 面向用户的配置文件位于 `src/config/*.yml`，新增配置项时请同步更新：
  - `src/config/theme.yml` 或 `src/config/site.yml`（保留中英文注释）
  - `src/lib/config-loader.d.mts` 类型定义与相关校验逻辑
  - [docs/configuration.md](docs/configuration.md) 或 [docs/site-identity.md](docs/site-identity.md)
- 请勿提交任何个人站点的私有配置、密钥、未确认版权的壁纸或第三方图片。
- 第三方资源与图标授权变更须同步更新 [THIRD-PARTY.md](THIRD-PARTY.md) 或 [public/assets/vendor/THIRD-PARTY.md](public/assets/vendor/THIRD-PARTY.md)。
