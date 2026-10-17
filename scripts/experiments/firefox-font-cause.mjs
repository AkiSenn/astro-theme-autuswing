// Owned profiles + loopback only. All CSS mutations below apply to diagnostic
// documents; the sealed artifact and application source are never written.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { connectMarionette } from './marionette.mjs';
import { verifyRelease, sha256 } from '../release-integrity.mjs';
import policy from '../../deployment/release-policy.json' with { type: 'json' };
const out = path.resolve(process.argv[2]);
fs.mkdirSync(out, { recursive: false });
const release = path.resolve('.local-tools/releases/autuswing-20261018-r4'),
  root = path.join(release, 'site');
verifyRelease(release, policy);
const executable = path.resolve(
  process.env.FONT_CAUSE_FIREFOX ||
    '.local-tools/firefox-recheck-20261018/browsers/firefox-1555/firefox/firefox.exe',
);
const fixture = fs.readFileSync('scripts/experiments/linebox.html');
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.json': 'application/json',
};
const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://localhost');
  res.setHeader('Cache-Control', 'no-store');
  if (u.pathname === '/__frame') {
    res.setHeader('Content-Type', 'text/html');
    res.end(
      `<!doctype html><style>body{margin:0}iframe{border:0;width:${Number(u.searchParams.get('width'))}px;height:640px}</style><iframe src="${u.searchParams.get('target')}"></iframe>`,
    );
    return;
  }
  if (u.pathname === '/__minimal') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(fixture);
    return;
  }
  const target = path.resolve(root, '.' + decodeURIComponent(u.pathname));
  if (!target.startsWith(root + path.sep) && target !== root) {
    res.writeHead(403).end();
    return;
  }
  try {
    const file = fs.statSync(target).isDirectory() ? path.join(target, 'index.html') : target;
    res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
    res.end(fs.readFileSync(file));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;
const records = [];
const snapshot = `
 const rect=n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom};};
 const faces=n=>{try{const r=document.createRange();r.selectNodeContents(n);return [...InspectorUtils.getUsedFontFaces(r,8)].map(f=>({name:f.name,family:f.CSSFamilyName,uri:f.URI,generic:f.CSSGeneric,fromFontGroup:f.fromFontGroup,fromLanguagePrefs:f.fromLanguagePrefs,fromSystemFallback:f.fromSystemFallback,ranges:f.ranges.map(r=>({text:r.toString().slice(0,80),node:r.startContainer.nodeName,parent:r.startContainer.parentNode?.nodeName,start:r.startOffset,end:r.endOffset}))}));}catch(e){return {error:String(e)}}};
 const css=(n,pseudo)=>{const s=getComputedStyle(n,pseudo);return Object.fromEntries(['fontFamily','fontSize','fontWeight','fontStyle','fontSizeAdjust','fontKerning','lineHeight','width','minWidth','height','verticalAlign','display'].map(k=>[k,s[k]]));};
 const lines=[...document.querySelectorAll('pre .line')],code=document.querySelector('pre code');
 const geometryBefore=lines.map((n,i)=>({i:i+1,rect:rect(n)}));
 let anonymous=[];
 if(lines[0])try{anonymous=InspectorUtils.getChildrenForNode(lines[0],true,false).map(n=>({name:n.nodeName,text:n.textContent?.slice(0,80),type:n.nodeType,fonts:faces(n),css:n.nodeType===1?css(n):null}));}catch(e){anonymous=[{error:String(e)}]};
 return {path:location.pathname,viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},fontStatus:document.fonts.status,geometryBefore,blocks:[...document.querySelectorAll('pre code')].map(n=>({rect:rect(n),fonts:faces(n),css:css(n),pre:css(n.parentElement)})),firstLine:lines[0]?{rect:rect(lines[0]),css:css(lines[0]),gutter:css(lines[0],'::before'),fonts:faces(lines[0])}:null,anonymous,article:document.querySelector('.article-layout')?rect(document.querySelector('.article-layout')):null};
`;
try {
  for (let cold = 0; cold < Number(process.env.FONT_CAUSE_RUNS || 12); cold++) {
    const profile = path.join(out, `profile-${cold}`);
    fs.mkdirSync(profile);
    const socket = net.createServer();
    await new Promise((r) => socket.listen(0, '127.0.0.1', r));
    const port = socket.address().port;
    await new Promise((r) => socket.close(r));
    const prefs = {
      'marionette.port': port,
      'marionette.enabled': true,
      'layout.css.devPixelsPerPx': '1',
      'browser.shell.checkDefaultBrowser': false,
      'browser.startup.homepage_override.mstone': 'ignore',
      'dom.serviceWorkers.enabled': false,
      'app.update.auto': false,
      ...JSON.parse(process.env.FONT_CAUSE_PREFS_JSON || '{}'),
    };
    fs.writeFileSync(
      path.join(profile, 'user.js'),
      Object.entries(prefs)
        .map(([k, v]) => `user_pref(${JSON.stringify(k)},${JSON.stringify(v)});`)
        .join('\n'),
    );
    const fd = fs.openSync(path.join(out, `browser-${cold}.log`), 'w');
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
        stdio: ['ignore', fd, fd],
      },
    );
    let m;
    try {
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
      const navigate = async (target, width = 320) => {
        await m.command('WebDriver:Navigate', {
          url: `${origin}/__frame?width=${width}&target=${encodeURIComponent(target)}`,
        });
        await m.command('WebDriver:SwitchToFrame', { id: 0 });
        const failed = (
          await m.command('WebDriver:ExecuteAsyncScript', {
            script: `const done=arguments[arguments.length-1];(async()=>{const imgs=[...document.images].filter(n=>n.getAttribute('src'));imgs.forEach(n=>n.loading='eager');await document.fonts.ready;const failed=await Promise.all(imgs.map(async n=>{try{await n.decode();return null}catch{return n.src}}));await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);done(failed.filter(Boolean));})()`,
            args: [],
            sandbox: 'system',
            newSandbox: true,
          })
        ).value;
        if (failed.length) throw new Error(JSON.stringify(failed));
      };
      const entry = { cold, browser: session.capabilities, samples: [] };
      records.push(entry);
      await navigate('/__minimal');
      entry.samples.push({ stage: 'minimal-initial', data: await exec(snapshot) });
      const canvas = await exec(
        `const c=document.createElement('canvas').getContext('2d');return ['Cascadia Code','Arial','Consolas'].map(f=>{c.font='12px "'+f+'"';const m=c.measureText('0');return {font:f,width:m.width,ascent:m.fontBoundingBoxAscent,descent:m.fontBoundingBoxDescent}});`,
      );
      entry.samples.push({ stage: 'after-canvas', canvas, data: await exec(snapshot) });
      await exec(
        `const s=document.createElement('style');s.textContent='.line::before{min-width:calc(3ch + 0px)}';document.head.append(s);`,
      );
      entry.samples.push({ stage: 'after-same-value-ch-recompute', data: await exec(snapshot) });
      await exec(
        `const s=document.createElement('style');s.textContent='.line::before{font-family:Consolas}';document.head.append(s);`,
      );
      entry.samples.push({ stage: 'explicit-counter-consolas', data: await exec(snapshot) });
      await exec(
        `const s=document.createElement('style');s.textContent='.line::before{font-family:"Cascadia Code",Consolas,monospace}';document.head.append(s);`,
      );
      entry.samples.push({ stage: 'restored-counter-family', data: await exec(snapshot) });
      if (process.env.FONT_CAUSE_EXTRA === '1') {
        await exec(
          `const n=document.createElement('span');n.id='font-twin';n.textContent='1';n.style.cssText='position:fixed;top:-1000px;font-family:"Cascadia Code",Consolas,monospace;font-size:12px;line-height:1.8;min-width:3ch';document.body.append(n);`,
        );
        entry.twin = await exec(
          `const n=document.querySelector('#font-twin'),r=document.createRange();r.selectNodeContents(n);return {css:getComputedStyle(n).fontFamily,minWidth:getComputedStyle(n).minWidth,fonts:[...InspectorUtils.getUsedFontFaces(r,8)].map(f=>({name:f.name,fromFontGroup:f.fromFontGroup}))};`,
        );
        for (const [stage, css] of [
          ['literal-counter', '.line::before{content:"1"}'],
          ['single-family', '.line::before{font-family:"Cascadia Code"}'],
          ['list-no-generic', '.line::before{font-family:"Cascadia Code",Consolas}'],
          [
            'kerning-auto',
            '.line::before{font-family:"Cascadia Code",Consolas,monospace;font-kerning:auto}',
          ],
          ['kerning-none', '.line::before{font-kerning:none}'],
          [
            'restore-exact-group',
            '.line::before{font-family:"Cascadia Code",Consolas,monospace;font-kerning:normal;content:counter(line)}',
          ],
          ['counter-times', '.line::before{font-family:"Times New Roman"}'],
          ['restore-after-times', '.line::before{font-family:"Cascadia Code",Consolas,monospace}'],
        ]) {
          await exec(
            `const s=document.createElement('style');s.textContent=${JSON.stringify(css)};document.head.append(s);`,
          );
          entry.samples.push({ stage, data: await exec(snapshot) });
        }
      }
      entry.fontPreferences = await exec(
        `const p=Components.classes['@mozilla.org/preferences-service;1'].getService(Components.interfaces.nsIPrefBranch);return Object.fromEntries(p.getChildList('gfx.').filter(k=>k.includes('font')).map(k=>{const t=p.getPrefType(k);return [k,t===128?p.getBoolPref(k):t===64?p.getIntPref(k):p.getCharPref(k)]}));`,
      );
      if (process.env.FONT_CAUSE_MATRIX === '1')
        for (const textFont of ['Cascadia Code', 'Consolas', 'Arial', 'Times New Roman'])
          for (const counterFont of ['Cascadia Code', 'Consolas', 'Arial', 'Times New Roman']) {
            const css = `pre{font-family:"${textFont}"}code{font-family:inherit}.line::before{font-family:"${counterFont}";font-kerning:normal;content:counter(line)}`;
            await exec(
              `const s=document.createElement('style');s.textContent=${JSON.stringify(css)};document.head.append(s);`,
            );
            entry.samples.push({
              stage: `matrix-${textFont}-${counterFont}`,
              data: await exec(snapshot),
            });
          }
      if (process.env.FONT_CAUSE_TARGET !== 'minimal')
        for (const width of [320, 820, 320]) {
          await navigate('/', width);
          await navigate('/post/55b0541c/', width);
          entry.samples.push({ stage: `full-article-${width}`, data: await exec(snapshot) });
        }
      fs.writeFileSync(
        path.join(out, 'fonts.json'),
        JSON.stringify(
          {
            origin,
            executable,
            executableSHA256: sha256(fs.readFileSync(executable)),
            fixtureSHA256: sha256(fixture),
            records,
          },
          null,
          2,
        ),
      );
      console.log(
        `Firefox ${cold}: ${entry.samples.map((s) => `${s.stage}:${s.data.firstLine?.rect.height}/${s.data.firstLine?.gutter.minWidth}`).join(' ')}`,
      );
    } finally {
      if (m)
        try {
          await m.command('Marionette:Quit', { flags: ['eForceQuit'] });
        } catch {}
      m?.close();
      proc.kill();
      fs.closeSync(fd);
    }
  }
} finally {
  await new Promise((r) => server.close(r));
  verifyRelease(release, policy);
}
// A reproduction of the unexpected original font is a nonzero result, never a
// successful production acceptance merely because the diagnostic completed.
if (records.some((r) => r.samples[0].data.firstLine.gutter.minWidth !== '21.1px'))
  process.exitCode = 1;
