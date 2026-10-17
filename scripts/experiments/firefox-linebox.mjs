import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { connectMarionette } from './marionette.mjs';
import { sha256 } from '../release-integrity.mjs';
import { load } from 'cheerio';

const executable = path.resolve(
  process.env.FIREFOX_EXECUTABLE_PATH ||
    '.local-tools/firefox-recheck-20261018/browsers/firefox-1555/firefox/firefox.exe',
);
const output = path.resolve(process.argv[2] || `.local-tools/linebox-${Date.now()}`);
fs.mkdirSync(output, { recursive: false });
const html = fs.readFileSync(
  process.env.LINEBOX_FIXTURE || new URL('./linebox.html', import.meta.url),
);
fs.writeFileSync(path.join(output, 'fixture.html'), html);
const fontFile = process.env.LINEBOX_FONT_FILE || 'C:/Windows/Fonts/CascadiaCode.ttf';
// Optional reduction: only historical code spans, no article/layout/assets/scripts.
const oldArticle = fs.readFileSync(
  '.local-tools/releases/autuswing-20261018-r4/site/post/55b0541c/index.html',
  'utf8',
);
const $ = load(oldArticle),
  historicalLines = $('pre code .line')
    .toArray()
    .map((node) => $.html(node))
    .join('\n');
const framed = process.env.LINEBOX_IFRAME === '1';
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/fixture-font.ttf') {
    res
      .writeHead(200, { 'Content-Type': 'font/ttf', 'Cache-Control': 'no-store' })
      .end(fs.readFileSync(fontFile));
    return;
  }
  let content =
    url.pathname === '/frame'
      ? `<!doctype html><meta charset="utf-8"><style>body{margin:0}iframe{border:0;width:${Number(url.searchParams.get('width'))}px;height:640px}</style><iframe src="/${url.search}"></iframe>`
      : html;
  if (url.pathname !== '/frame' && url.searchParams.get('text') === 'historical')
    content = html
      .toString()
      .replace(
        '</script>',
        `document.querySelector('code').innerHTML=${JSON.stringify(historicalLines).replaceAll('<', '\\u003c')};</script>`,
      );
  if (url.pathname !== '/frame' && url.searchParams.get('variant') === 'controlled-font')
    content = content
      .toString()
      .replace(
        '</style>',
        `@font-face {font-family:'Cascadia Code';src:url('/fixture-font.ttf') format('truetype');font-weight:100 900;font-style:normal;font-display:block;}\n</style>`,
      );
  res
    .writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' })
    .end(content);
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const measurements = [];
const sampleScript = `
 const code=document.querySelector('code'), pre=document.querySelector('pre');
 const used=node=>{const r=document.createRange();r.selectNodeContents(node);return [...InspectorUtils.getUsedFontFaces(r)].map(f=>({name:f.name,CSSFamilyName:f.CSSFamilyName,URI:f.URI,localName:f.localName,srcIndex:f.srcIndex}));};
 const style=node=>{const s=getComputedStyle(node);return Object.fromEntries(['fontFamily','fontSize','fontWeight','fontStyle','fontKerning','fontFeatureSettings','fontVariationSettings','lineHeight','display','whiteSpace','verticalAlign','textRendering'].map(k=>[k,s[k]]));};
 const rect=node=>{const r=node.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,top:r.top,bottom:r.bottom};};
 const lines=[...code.querySelectorAll('.line')];
 const counter=getComputedStyle(lines[0],'::before');
 return {viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},fontStatus:document.fonts.status,style:style(pre),lineStyle:style(lines[0]),counterStyle:Object.fromEntries(['fontFamily','fontSize','fontWeight','lineHeight','verticalAlign','width','minWidth','height'].map(k=>[k,counter[k]])),pre:rect(pre),code:rect(code),after:rect(document.querySelector('#after')),fonts:used(code),lines:lines.map((n,i)=>{const r=document.createRange();r.selectNodeContents(n);return {index:i+1,rect:rect(n),textRects:[...r.getClientRects()].map(r=>({y:r.y,height:r.height,bottom:r.bottom})),fonts:used(n)};})};
`;
const ready = `const done=arguments[arguments.length-1];document.fonts.ready.then(()=>requestAnimationFrame(()=>requestAnimationFrame(()=>done(true))));`;
try {
  for (const dpr of (process.env.LINEBOX_DPRS || '1,1.25,2').split(',').map(Number))
    for (let cold = 0; cold < Number(process.env.LINEBOX_COLD || 2); cold++) {
      const profile = path.join(output, `profile-${dpr}-${cold}`);
      fs.mkdirSync(profile);
      const portServer = net.createServer();
      await new Promise((r) => portServer.listen(0, '127.0.0.1', r));
      const port = portServer.address().port;
      await new Promise((r) => portServer.close(r));
      const prefs = {
        'marionette.port': port,
        'marionette.enabled': true,
        'layout.css.devPixelsPerPx': String(dpr),
        'browser.shell.checkDefaultBrowser': false,
        'browser.startup.homepage_override.mstone': 'ignore',
        'app.update.auto': false,
      };
      fs.writeFileSync(
        path.join(profile, 'user.js'),
        Object.entries(prefs)
          .map(([k, v]) => `user_pref(${JSON.stringify(k)},${JSON.stringify(v)});`)
          .join('\n'),
      );
      const log = fs.openSync(path.join(output, `browser-${dpr}-${cold}.log`), 'w');
      const proc = spawn(
        executable,
        [
          '-headless',
          '-no-remote',
          '-profile',
          profile,
          '--marionette',
          '--remote-allow-system-access',
        ],
        {
          windowsHide: true,
          env: { ...process.env, MOZ_MARIONETTE: '1' },
          stdio: ['ignore', log, log],
        },
      );
      let m;
      try {
        // Wait for the owned listener, bounded to startup only; this isn't a layout settle timeout.
        const deadline = Date.now() + 10000;
        while (!m) {
          try {
            m = await connectMarionette(port);
          } catch (e) {
            if (Date.now() > deadline) throw e;
            await new Promise((r) => setTimeout(r, 100));
          }
        }
        const session = await m.command('WebDriver:NewSession', {
          capabilities: { alwaysMatch: {} },
        });
        const exec = async (script) =>
          (
            await m.command('WebDriver:ExecuteScript', {
              script,
              args: [],
              sandbox: 'system',
              newSandbox: true,
            })
          ).value;
        const capture = async (label, variant, text, width) => {
          await m.command('WebDriver:SetWindowRect', { width, height: 720 });
          await m.command('WebDriver:Navigate', {
            url: `${origin}/${framed ? 'frame' : ''}?variant=${variant}&text=${text}&width=${width}`,
          });
          if (framed) await m.command('WebDriver:SwitchToFrame', { id: 0 });
          await m.command('WebDriver:ExecuteAsyncScript', {
            script: ready,
            args: [],
            sandbox: 'system',
            newSandbox: true,
          });
          const first = await exec(sampleScript),
            second = await exec(sampleScript);
          measurements.push({
            label,
            variant,
            text,
            cold,
            dpr,
            requestedWidth: width,
            framed,
            browser: session.capabilities,
            first,
            second,
          });
        };
        for (const variant of (
          process.env.LINEBOX_VARIANTS ||
          'original,no-counter,counter-same-size,block-lines,pixel-height,explicit-consolas,explicit-cascadia'
        ).split(',')) {
          for (const text of (process.env.LINEBOX_TEXTS || 'latin,mixed').split(',')) {
            for (const [i, width] of (process.env.LINEBOX_WIDTHS || '320,820,320,1440,320')
              .split(',')
              .map(Number)
              .entries())
              await capture(`resize-${i}`, variant, text, width);
          }
        }
      } finally {
        if (m)
          try {
            await m.command('Marionette:Quit', { flags: ['eForceQuit'] });
          } catch {}
        m?.close();
        proc.kill();
        await Promise.race([
          once(proc, 'exit'),
          new Promise((r) => {
            const t = setTimeout(r, 2000);
            t.unref();
          }),
        ]);
        fs.closeSync(log);
      }
      console.log(`Captured DPR ${dpr}, cold process ${cold}: ${measurements.length} samples`);
    }
} finally {
  await new Promise((r) => server.close(r));
}
fs.writeFileSync(
  path.join(output, 'measurements.json'),
  JSON.stringify(
    {
      createdAt: new Date().toISOString(),
      executable,
      executableSHA256: sha256(fs.readFileSync(executable)),
      fixtureSHA256: sha256(html),
      controlledFont: { file: fontFile, sha256: sha256(fs.readFileSync(fontFile)) },
      historicalSpansSHA256: sha256(historicalLines),
      measurements,
    },
    null,
    2,
  ),
);
console.log(`Evidence: ${output}`);
