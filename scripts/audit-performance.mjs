import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';

const origin = new URL(process.argv[2] || 'http://127.0.0.1:8788');
if (!['127.0.0.1', 'localhost'].includes(origin.hostname))
  throw new Error('This audit is local-only');
const dir = path.resolve('docs/evidence/phase5/performance');
fs.mkdirSync(dir, { recursive: true });
const npm =
  process.env.npm_execpath ||
  path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
const runs = [];
for (const [name, pathname] of [
  ['home', '/'],
  ['article', '/post/55b0541c/'],
  ['math', '/post/4e395565/'],
]) {
  for (const profile of ['mobile', 'desktop']) {
    for (let run = 1; run <= (profile === 'mobile' ? 3 : 1); run++) {
      const reportFile = path.join(dir, `${name}-${profile}-${run}.json`);
      const args = [
        'exec',
        '--yes',
        '--package=lighthouse@13.5.0',
        '--',
        'lighthouse',
        new URL(pathname, origin).href,
        '--chrome-flags=--headless=new --no-first-run',
        '--output=json',
        `--output-path=${reportFile}`,
        '--only-categories=performance,accessibility,best-practices,seo',
        '--quiet',
        ...(profile === 'desktop' ? ['--preset=desktop'] : []),
      ];
      execFileSync(process.execPath, [npm, ...args], {
        stdio: 'pipe',
        env: {
          ...process.env,
          CHROME_PATH:
            process.env.CHROME_PATH ||
            'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
        },
      });
      const raw = fs.readFileSync(reportFile),
        report = JSON.parse(raw);
      if (report.runtimeError || report.categories.performance.score === null)
        throw new Error(JSON.stringify(report.runtimeError || report.runWarnings));
      const metric = (id) => report.audits[id]?.numericValue;
      const row = {
        name,
        profile,
        run,
        version: report.lighthouseVersion,
        url: report.finalDisplayedUrl,
        scores: Object.fromEntries(
          Object.entries(report.categories).map(([key, value]) => [key, value.score]),
        ),
        fcpMs: metric('first-contentful-paint'),
        lcpMs: metric('largest-contentful-paint'),
        tbtMs: metric('total-blocking-time'),
        cls: metric('cumulative-layout-shift'),
        transferBytes: metric('total-byte-weight'),
        warnings: report.runWarnings,
        throttling: report.configSettings.throttling,
        formFactor: report.configSettings.formFactor,
        rawReport: path.basename(reportFile) + '.gz',
      };
      runs.push(row);
      fs.writeFileSync(reportFile + '.gz', gzipSync(raw));
      fs.unlinkSync(reportFile);
      fs.writeFileSync(
        path.join(dir, 'summary.json'),
        JSON.stringify(
          {
            checkedAt: new Date().toISOString(),
            origin: origin.href,
            environment:
              'Local Nginx, Edge headless; Lighthouse simulated throttling; no field/Core Web Vitals claim',
            crawlPolicy: process.env.AUDIT_CRAWL_POLICY || 'preview-noindex',
            runs,
          },
          null,
          2,
        ) + '\n',
      );
      console.log(
        `${name} ${profile} run ${run}: ${JSON.stringify(row.scores)}, LCP ${Math.round(row.lcpMs)}ms`,
      );
    }
  }
}
