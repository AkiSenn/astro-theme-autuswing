export function GET() {
  return new Response(
    '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="robots" content="noindex"><title>暂时离线 · AkiSenn</title><style>body{font:18px/1.8 system-ui;max-width:40em;margin:15vh auto;padding:24px;background:#f5f4f0;color:#244638}a{color:inherit}</style><h1>暂时离线</h1><p>重新连接后刷新页面，即可继续阅读。</p><a href="/">返回首页</a></html>',
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );
}
