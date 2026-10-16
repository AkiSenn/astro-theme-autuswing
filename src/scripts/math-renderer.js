import { client, script, css } from './helpers';
const config = client();
const scoped = [...document.querySelectorAll('.prose[data-math-config]')].map((scope) => ({
  scope,
  math: JSON.parse(scope.dataset.mathConfig),
}));
if (config.math) {
  const scope = document.querySelector('.article > .prose,.standalone-page > .prose');
  if (scope) scoped.push({ scope, math: config.math });
}
let mathJaxReady;
async function render(scope, math) {
  if (math.engine === 'katex') {
    css(math.katex.css);
    await script(math.katex.cdn);
    await script(math.katex.auto_render);
    window.renderMathInElement(scope, {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '\\[', right: '\\]', display: true },
        { left: '$', right: '$', display: false },
        { left: '\\(', right: '\\)', display: false },
      ],
      throwOnError: false,
      ...(math.katex.config || {}),
    });
    return;
  }
  if (!mathJaxReady) {
    window.MathJax = {
      tex: {
        inlineMath: [
          ['$', '$'],
          ['\\(', '\\)'],
        ],
        displayMath: [
          ['$$', '$$'],
          ['\\[', '\\]'],
        ],
      },
      options: { skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code'] },
      startup: { typeset: false },
      ...(math.mathjax.config || {}),
    };
    mathJaxReady = script(math.mathjax.cdn).then(() => window.MathJax.startup.promise);
  }
  await mathJaxReady;
  await window.MathJax.typesetPromise([scope]);
}
for (const { scope, math } of scoped)
  render(scope, math).catch(() => {
    const hint = document.createElement('p');
    hint.className = 'feature-status';
    hint.textContent = config.labels.math_failed;
    scope.append(hint);
  });
