# 第三方授权声明

## Tabler Icons

`src/components/Icons.astro` 中以下十二个图标取自 [Tabler Icons](https://github.com/tabler/tabler-icons)，固定提交为 `a4ce1404bc6d24d3c365afe7b258d6bf6f48d62d`。本声明仅涵盖这些图标，不表示其余图标的授权已确认。

| 图标 ID           | 上游文件                                                                                                                                  | 坐标适配（viewBox 单位） |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| `i-chevron-up`    | [chevron-up.svg](https://github.com/tabler/tabler-icons/blob/a4ce1404bc6d24d3c365afe7b258d6bf6f48d62d/icons/outline/chevron-up.svg)       | 无平移                   |
| `i-chevron-down`  | [chevron-down.svg](https://github.com/tabler/tabler-icons/blob/a4ce1404bc6d24d3c365afe7b258d6bf6f48d62d/icons/outline/chevron-down.svg)   | `translate(0 0.5)`       |
| `i-chevron-left`  | [chevron-left.svg](https://github.com/tabler/tabler-icons/blob/a4ce1404bc6d24d3c365afe7b258d6bf6f48d62d/icons/outline/chevron-left.svg)   | `translate(-0.5 0)`      |
| `i-chevron-right` | [chevron-right.svg](https://github.com/tabler/tabler-icons/blob/a4ce1404bc6d24d3c365afe7b258d6bf6f48d62d/icons/outline/chevron-right.svg) | `translate(0.5 0)`       |
| `i-home`          | [home.svg](https://github.com/tabler/tabler-icons/blob/a4ce1404bc6d24d3c365afe7b258d6bf6f48d62d/icons/outline/home.svg)                   | 无平移                   |
| `i-list`          | [list.svg](https://github.com/tabler/tabler-icons/blob/a4ce1404bc6d24d3c365afe7b258d6bf6f48d62d/icons/outline/list.svg)                   | 无平移                   |
| `i-user`          | [user.svg](https://github.com/tabler/tabler-icons/blob/a4ce1404bc6d24d3c365afe7b258d6bf6f48d62d/icons/outline/user.svg)                   | 无平移                   |
| `i-calendar`      | [calendar.svg](https://github.com/tabler/tabler-icons/blob/a4ce1404bc6d24d3c365afe7b258d6bf6f48d62d/icons/outline/calendar.svg)           | 移除日期数字，无平移     |
| `i-clock`         | [clock.svg](https://github.com/tabler/tabler-icons/blob/a4ce1404bc6d24d3c365afe7b258d6bf6f48d62d/icons/outline/clock.svg)                 | 无平移                   |
| `i-search`        | [search.svg](https://github.com/tabler/tabler-icons/blob/a4ce1404bc6d24d3c365afe7b258d6bf6f48d62d/icons/outline/search.svg)               | 无平移                   |
| `i-pencil`        | [pencil.svg](https://github.com/tabler/tabler-icons/blob/a4ce1404bc6d24d3c365afe7b258d6bf6f48d62d/icons/outline/pencil.svg)               | `translate(0.5 -0.5)`    |
| `i-check`         | [check.svg](https://github.com/tabler/tabler-icons/blob/a4ce1404bc6d24d3c365afe7b258d6bf6f48d62d/icons/outline/check.svg)                 | `translate(-0.5 0.25)`   |

路径 `d` 保留上游原文；`calendar` 省略上游最后两条组成日期数字的路径。沿用现有 symbol ID、24×24 viewBox、20×20 引用尺寸与 `currentColor`，描边从上游的 2 适配为现有宽度（`check` 为 1.9，其余为 1.7），保留圆角端点和连接。折角、`pencil` 和 `check` 的平移如表所示，`pencil`、`check` 与已批准的适配预览一致；其余六个图标不移动坐标。这些是对授权作品的适配，不声称独立原创。

以下全文来自该提交的 [LICENSE](https://github.com/tabler/tabler-icons/blob/a4ce1404bc6d24d3c365afe7b258d6bf6f48d62d/LICENSE)：

```text
MIT License

Copyright (c) 2020-2026 Paweł Kuna

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
