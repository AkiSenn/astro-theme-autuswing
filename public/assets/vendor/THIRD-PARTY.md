# Bundled formula distributions

The following upstream browser files are distributed unmodified. Versions and SHA256 hashes are recorded in `manifest.json`.

| Distribution | Version | Upstream license |
| --- | --- | --- |
| MathJax | 4.1.3 | Apache-2.0 |
| @mathjax/mathjax-newcm-font | 4.1.3 | Apache-2.0 as declared by its npm package |
| KaTeX | 0.19.0 | MIT |

Each distribution directory retains its package metadata and a license copy. These components retain their upstream copyright and licensing; Autuswing's MIT license applies to its own code. Browser bundles, required dynamic components and fonts are included; development sources, source maps and unused complete bundles are excluded.

Sources: https://www.npmjs.com/package/mathjax · https://www.npmjs.com/package/@mathjax/mathjax-newcm-font · https://www.npmjs.com/package/katex

Maintainers can temporarily install the pinned packages with `npm install --no-save --package-lock=false --ignore-scripts mathjax@4.1.3 @mathjax/mathjax-newcm-font@4.1.3 katex@0.19.0`, then run `node tools/vendor-math.mjs` and restore development dependencies with `npm ci`. This maintenance step is not needed to install or build the theme.
