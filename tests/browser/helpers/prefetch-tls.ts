import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash, X509Certificate } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

export function createPrefetchTLS(directory: string) {
  // 只接受尚不存在的绝对目录；保留每次证书与配置，不清理或复用历史证据。
  if (!path.isAbsolute(directory) || fs.existsSync(directory))
    throw new Error('Prefetch TLS requires a new absolute directory');
  for (let parent = path.dirname(directory); ; parent = path.dirname(parent)) {
    if (fs.existsSync(parent) && fs.lstatSync(parent).isSymbolicLink())
      throw new Error('Prefetch TLS directory cannot traverse a link');
    if (path.dirname(parent) === parent) break;
  }
  fs.mkdirSync(directory);
  const openssl =
    process.env.PREFETCH_OPENSSL_BINARY ||
    (process.platform === 'win32'
      ? path.join(process.env.ProgramFiles || 'C:/Program Files', 'Git/usr/bin/openssl.exe')
      : 'openssl');
  const run = (args: string[]) =>
    execFileSync(openssl, args, { cwd: directory, stdio: ['ignore', 'pipe', 'pipe'] });
  const write = (name: string, text: string) =>
    fs.writeFileSync(path.join(directory, name), text, { flag: 'wx' });
  const read = (name: string) => fs.readFileSync(path.join(directory, name));

  // 每轮独立 CA，仅允许 localhost/127.0.0.1，叶证书不能签发其他证书。
  run([
    'req',
    '-x509',
    '-newkey',
    'rsa:2048',
    '-sha256',
    '-nodes',
    '-keyout',
    'ca.key',
    '-out',
    'ca.pem',
    '-days',
    '2',
    '-subj',
    '/CN=Autuswing isolated prefetch test CA',
    '-addext',
    'basicConstraints=critical,CA:TRUE,pathlen:0',
    '-addext',
    'keyUsage=critical,keyCertSign,cRLSign',
    '-addext',
    'nameConstraints=critical,permitted;DNS:localhost,permitted;IP:127.0.0.1/255.255.255.255',
  ]);
  run([
    'req',
    '-new',
    '-newkey',
    'rsa:2048',
    '-sha256',
    '-nodes',
    '-keyout',
    'leaf.key',
    '-out',
    'leaf.csr',
    '-subj',
    '/CN=localhost',
  ]);
  for (const [name, san, serial] of [
    ['leaf', 'DNS:localhost,IP:127.0.0.1', '1'],
    ['wrong-host', 'DNS:localhost', '2'],
  ]) {
    write(
      name + '.ext',
      [
        'basicConstraints=critical,CA:FALSE',
        'keyUsage=critical,digitalSignature,keyEncipherment',
        'extendedKeyUsage=serverAuth',
        'subjectAltName=' + san,
        '',
      ].join('\n'),
    );
    run([
      'x509',
      '-req',
      '-in',
      'leaf.csr',
      '-CA',
      'ca.pem',
      '-CAkey',
      'ca.key',
      '-set_serial',
      serial,
      '-out',
      name + '.pem',
      '-days',
      '2',
      '-sha256',
      '-extfile',
      name + '.ext',
    ]);
  }
  run([
    'req',
    '-x509',
    '-newkey',
    'rsa:2048',
    '-sha256',
    '-nodes',
    '-keyout',
    'untrusted.key',
    '-out',
    'untrusted.pem',
    '-days',
    '2',
    '-subj',
    '/CN=localhost',
    '-addext',
    'basicConstraints=critical,CA:FALSE',
    '-addext',
    'subjectAltName=DNS:localhost,IP:127.0.0.1',
  ]);
  const verified = run([
    'verify',
    '-CAfile',
    'ca.pem',
    '-purpose',
    'sslserver',
    '-verify_ip',
    '127.0.0.1',
    'leaf.pem',
  ]).toString();
  const ca = new X509Certificate(read('ca.pem'));
  const leaf = new X509Certificate(read('leaf.pem'));
  const describe = (cert: X509Certificate) => ({
    subject: cert.subject,
    issuer: cert.issuer,
    validFrom: cert.validFrom,
    validTo: cert.validTo,
    subjectAltName: cert.subjectAltName,
    ca: cert.ca,
    sha256: createHash('sha256').update(cert.raw).digest('hex'),
  });
  write(
    'certificate-audit.json',
    JSON.stringify({ ca: describe(ca), leaf: describe(leaf), verified }, null, 2),
  );

  return {
    directory,
    key: read('leaf.key'),
    cert: read('leaf.pem'),
    wrongHost: { key: read('leaf.key'), cert: read('wrong-host.pem') },
    untrusted: { key: read('untrusted.key'), cert: read('untrusted.pem') },
    createChromiumProfile() {
      const profile = path.join(directory, 'browser-profile');
      fs.mkdirSync(profile);
      fs.mkdirSync(path.join(profile, 'Default'));
      // 仅初始化全新测试 profile 的浏览器信任库；不写 Windows 用户/系统证书库。
      // Chromium ServerCertificate v1，CertificateMetadata.trust.trust_type=3。
      // 格式依据 components/server_certificate_database/server_certificate_database.{cc,proto}。
      // 格式不兼容时必须让原生 TLS 测试失败，禁止回退为忽略证书错误。
      const db = new DatabaseSync(path.join(profile, 'Default', 'ServerCertificate'));
      try {
        db.exec(`
          CREATE TABLE meta(key LONGVARCHAR NOT NULL UNIQUE PRIMARY KEY,value LONGVARCHAR);
          INSERT INTO meta VALUES('version','1'),('last_compatible_version','1');
          CREATE TABLE certificates(sha256hash_hex TEXT PRIMARY KEY,der_cert BLOB NOT NULL,trust_settings BLOB NOT NULL);
        `);
        db.prepare('INSERT INTO certificates VALUES(?,?,?)').run(
          createHash('sha256').update(ca.raw).digest('hex'),
          ca.raw,
          Buffer.from([0x0a, 0x02, 0x08, 0x03]),
        );
      } finally {
        db.close();
      }
      return profile;
    },
  };
}
