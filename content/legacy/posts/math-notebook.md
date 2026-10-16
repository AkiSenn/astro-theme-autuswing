---
title: 数学公式实验室：按需加载与公式排版
tags:
  - 数学公式
  - MathJax
  - 写作
categories:
  - 功能演示
mathjax: true
abbrlink: '4e395565'
date: 2020-10-01 12:00:00
---

数学公式由文章 front matter 按需开启。只有本篇设置了 `mathjax: true`，页面才会加载配置的 MathJax；普通文章不请求公式脚本。

<!-- more -->

## 行内公式

行内表达式可以放在句子里，例如圆的面积 $A = \pi r^2$，或欧拉公式 $e^{i\pi} + 1 = 0$。公式会跟随文章正文的字体和行高显示。

## 独立公式

使用双美元符号包住独立公式：

$$
\int_{-\infty}^{\infty} e^{-x^2}\,dx = \sqrt{\pi}
$$

也可以展示求和：

$$
\sum_{k=1}^{n} k = \frac{n(n+1)}{2}
$$

## 公式配置

站点配置选择 MathJax 作为公式引擎，并提供脚本地址与 TeX 分隔符。文章是否加载脚本由 `math.per_page` 和 front matter 的 `mathjax` 共同决定；这可以避免每篇普通文章都加载数学库。

如果不需要数学公式，可以删掉本篇 front matter 中的 `mathjax: true`。如果站点改用 KaTeX，则按主题配置切换引擎。这里的公式内容同时会进入本地搜索索引，试试搜索“欧拉公式”或“高斯积分”。

## 公式之外仍是普通 Markdown

标题、列表和代码片段仍按常规文章渲染：

```yaml
math:
  enable: true
  per_page: true
  engine: mathjax
```

本页还会显示文章目录、阅读进度、字数、预计阅读时间、分享操作与版权信息。公式只是文章内容的一种形式，不会影响这些通用功能。
