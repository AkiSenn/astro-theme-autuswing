---
title: AUTUSWING_MARKDOWN_TEST_ONLY
date: '2026-10-17T12:00:00+08:00'
id: markdown-test-only
draft: true
description: 测试专用，绝不加入公开内容集合。
mathjax: true
---

# 正文一级标题兼容

## 长篇中文与混排

技术文章需要稳定而舒适的排版。写作时，我们希望把注意力放在问题本身：说明背景、展示步骤、解释取舍，并给读者留下可复现的结果。阅读时，段落应当自然换行，代码不应该把页面撑宽，图片加载也不应该让刚读到的句子突然跳走。这里使用一段较长的中文文字，检查不同屏幕宽度下的行距、标点、段落留白以及目录定位。文字中包含「引号」、破折号——以及括号（例如说明）、百分比 95% 和温度 23°C。

Autuswing uses Astro Content Collections and TypeScript. 中英文混排应保留清楚的语义：HTTP 200、UTF-8、`const value = 42`，以及 **粗体强调**、*斜体 emphasis*、~~删除内容~~。A longer English paragraph checks wrapping and punctuation without introducing a separate typography system. We prefer reproducible examples, explicit versions, accessible controls, and a reading layout that remains consistent after native document navigation.

### 三级标题

#### 四级标题

##### 五级标题

###### 六级标题

标题锚点应稳定，复制链接不应改变目录的文字。特殊字符：`<>&"'`，©、™、→、←、😀、中文全角标点。

## 代码与文件名

```ts title="src/examples/reading-demo.ts" {2,4-5} add={4} del={5}
const language = 'TypeScript';
const answer: number = 42;
const label = '中文与 English';
console.log(language, answer, label);
console.log('previous implementation');
const longLine = 'long_unbroken_code_segment_long_unbroken_code_segment_long_unbroken_code_segment_long_unbroken_code_segment_long_unbroken_code_segment_long_unbroken_code_segment_long_unbroken_code_segment_long_unbroken_code_segment_long_unbroken_code_segment_long_unbroken_code_segment';
for (let i = 0; i < 10; i++) {
  console.log(i);
}
// line 10
// line 11
// line 12
// line 13
// line 14
// line 15
// line 16
// line 17
// line 18
// line 19
// line 20
```

```sh
echo "Autuswing"
```

```
没有语言标签的普通代码仍可复制。
```

```diff title="example.diff"
- old setting
+ new setting
  unchanged
```

## 图片与说明

![示例占位图](/img/placeholder.svg)

<figure>
  <img src="/img/placeholder.svg" alt="带说明的示例图">
  <figcaption>图一：原生 figure / figcaption，不把说明放进 alt。</figcaption>
</figure>

![第二张示例图](/img/placeholder.svg)

## 长表格与合并单元格

| 项目 | 环境 | 版本 | 输入 | 输出 | 校验 | 说明 | 长列 |
| :--- | :--- | ---: | :--- | :--- | :--- | :--- | :--- |
| 静态构建 | Windows | 22 | Markdown | HTML | 通过 | 保留历史地址 | LongUnbrokenTableCellWithNoConvenientBreakPoint1234567890 |
| 浏览器 | 平板 | 820 | 触控/键盘 | 单列阅读 | 检查 | 表格独立横向滚动 | 不应强制把每列压到几个字符 |
| 浏览器 | 手机 | 320 | 文章 | 同一份内容 | 检查 | 不撑破正文 | UTF-8 / 中文 |

<table>
  <caption>原生 HTML 合并单元格表格</caption>
  <thead><tr><th scope="col">阶段</th><th colspan="2" scope="colgroup">检查结果</th></tr></thead>
  <tbody>
    <tr><th rowspan="2" scope="rowgroup">写作</th><td>Schema</td><td>必填字段清晰</td></tr>
    <tr><td>资源</td><td>路径与替代文本完整</td></tr>
  </tbody>
</table>

## 引用、列表与提示

> 清楚的说明比装饰更重要。
>
> 第二段引用包含 [站内归档](/archives/) 和 `inline_code`。

> [!NOTE]
> 说明块复用引用排版，不新增一整套卡片。

> [!WARNING]
> 生产发布前确认草稿标记和资源路径。

1. 创建文章。
2. 编写正文。
   1. 检查版本。
   2. 保留复现步骤。
3. 发布前检查。

- 无序列表。
  - 嵌套列表。
- [x] 构建时公式渲染。
- [ ] 真实评论服务验收另行进行。

<details><summary>展开额外说明</summary><p>原生 details 可使用键盘操作，不依赖框架。</p></details>

这是带脚注的句子[^note]，脚注往返链接应该正常。第二个脚注[^second]用于检查脚注列表。

[^note]: 脚注内容含有中文、English 和 `code`。
[^second]: 更多说明与 [关于页面](/about/)。

---

## 数学公式

行内公式 $E = mc^2$ 和 \(a^2 + b^2 = c^2\)。金额 $20 与普通文本不应误渲染。

$$
\sum_{k=1}^{n} k = \frac{n(n+1)}{2}
$$

\[
\begin{pmatrix}1 & 2 \\ 3 & 4\end{pmatrix}
\]

## 链接与极长内容

[跳回代码章节](#代码与文件名)，[示例文章](/welcome/)，[外部示例](https://example.com/)。

SupercalifragilisticexpialidociousRepeatedWithoutBreaksSupercalifragilisticexpialidociousRepeatedWithoutBreaksSupercalifragilisticexpialidociousRepeatedWithoutBreaksSupercalifragilisticexpialidociousRepeatedWithoutBreaksSupercalifragilisticexpialidociousRepeatedWithoutBreaksSupercalifragilisticexpialidociousRepeatedWithoutBreaks

长链接：[https://example.com/very-long-path/very-long-path/very-long-path/very-long-path/very-long-path/very-long-path/very-long-path/](https://example.com/)。
