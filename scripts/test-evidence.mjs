import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const stateKey = 'AUTUSWING_TEST_EVIDENCE';
const fail = (message) => {
  throw new Error(`测试证据保护：${message}`);
};
const exists = (file) => {
  try {
    fs.lstatSync(file);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
};
const within = (parent, child) => {
  const relative = path.relative(parent, child);
  return (
    relative !== '' &&
    !relative.startsWith('..' + path.sep) &&
    relative !== '..' &&
    !path.isAbsolute(relative)
  );
};

function absolute(value, label) {
  if (
    typeof value !== 'string' ||
    !path.isAbsolute(value) ||
    value.includes('\0') ||
    (process.platform === 'win32' && !/^[a-z]:[\\/]/i.test(value)) ||
    value.split(/[\\/]/).includes('..')
  )
    fail(`${label} 必须是明确的本地绝对路径`);
  return path.normalize(value);
}

function noLinks(file) {
  for (let current = file; ; current = path.dirname(current)) {
    if (exists(current) && fs.lstatSync(current).isSymbolicLink())
      fail(`路径包含符号链接或目录联接：${current}`);
    if (path.dirname(current) === current) break;
  }
}

export function validateTestArguments(args) {
  // CLI 可以覆盖配置，且缺参可能吞掉下一选项；在配置加载时就拒绝这些覆盖入口。
  for (const arg of args) {
    if (
      /^(--output|--reporter|--add-reporter|--last-failed-file)(=|$)/.test(arg) ||
      /^-o/.test(arg)
    )
      fail('不要通过 CLI 覆盖输出或报告位置；通过绝对路径环境变量选择全新目录');
    if (/^--ui($|[=-])/.test(arg)) fail('UI 重跑会复用报告；请每次启动独立测试进程');
    if (/^--update-snapshots(=|$)/.test(arg) || arg === '-u') fail('普通测试不能更新冻结基准');
  }
}

export function validateTestPaths(plan, { reserved = false } = {}) {
  const root = absolute(plan.root, '工程根目录');
  const output = absolute(plan.output, '临时输出');
  const evidence = absolute(plan.evidence, '长期证据');
  const report = absolute(plan.report, '报告');
  const screenshots = absolute(plan.screenshots, '截图');
  const runs = path.join(root, '.local-tools', 'test-runs');
  const archives = path.join(root, '.local-tools', 'test-evidence');
  const container = path.dirname(output);
  if (path.dirname(container) !== runs || path.basename(output) !== 'artifacts')
    fail('清理范围仅允许 .local-tools/test-runs/<新名称>/artifacts');
  if (path.dirname(evidence) !== archives) fail('证据必须位于 .local-tools/test-evidence/<新名称>');
  if (
    !within(evidence, report) ||
    report === path.join(evidence, 'run.json') ||
    report === path.join(evidence, 'console.log') ||
    report === screenshots ||
    within(screenshots, report)
  )
    fail('报告必须独立保存在本次证据目录内，不能覆盖运行记录或截图');
  if (screenshots !== path.join(evidence, 'screenshots'))
    fail('截图必须位于本次证据目录的 screenshots 子目录');
  for (const file of [root, output, evidence, report, screenshots]) noLinks(file);
  if (!reserved) {
    for (const file of [container, output, evidence, report, screenshots])
      if (exists(file)) fail(`拒绝复用或覆盖已有目录/文件：${file}`);
  }
  return { ...plan, root, output, evidence, report, screenshots };
}

export function planTestEvidence({
  root = projectRoot,
  env = process.env,
  args = process.argv.slice(2),
  id = new Date().toISOString().replace(/[:.]/g, '-') + '-' + randomUUID(),
} = {}) {
  validateTestArguments(args);
  // 这些 Playwright 原生变量优先于 reporter 配置，不能让它们绕过新目录边界。
  for (const key of Object.keys(env))
    if (
      /^PLAYWRIGHT_(JSON|HTML|JUNIT|BLOB)_OUTPUT_(FILE|DIR|NAME)$/.test(key) ||
      ['PW_TEST_REPORTER', 'PLAYWRIGHT_LAST_RUN_OUTPUT_FILE', 'PLAYWRIGHT_HTML_REPORT'].includes(
        key,
      )
    )
      fail(`不能通过 ${key} 绕过证据路径校验`);
  root = absolute(root, '工程根目录');
  const evidence =
    env.AUTUSWING_EVIDENCE_DIR ?? path.join(root, '.local-tools', 'test-evidence', id);
  const report =
    env.PLAYWRIGHT_REPORT_FILE ?? env.STYLE_REPORT ?? path.join(evidence, 'report.json');
  if (
    env.PLAYWRIGHT_REPORT_FILE !== undefined &&
    env.STYLE_REPORT !== undefined &&
    env.PLAYWRIGHT_REPORT_FILE !== env.STYLE_REPORT
  )
    fail('PLAYWRIGHT_REPORT_FILE 与 STYLE_REPORT 不能指向不同报告');
  return validateTestPaths({
    root,
    output:
      env.PLAYWRIGHT_OUTPUT_DIR ?? path.join(root, '.local-tools', 'test-runs', id, 'artifacts'),
    evidence,
    report,
    screenshots: env.VISUAL_EVIDENCE_DIR ?? path.join(evidence, 'screenshots'),
  });
}

export function reserveTestEvidence(plan, { env = process.env } = {}) {
  plan = validateTestPaths(plan);
  // 只创建新目录，不提供清理或复用选项；独占 mkdir 防止两个测试进程抢用同一路径。
  const container = path.dirname(plan.output);
  fs.mkdirSync(path.dirname(container), { recursive: true });
  fs.mkdirSync(path.dirname(plan.evidence), { recursive: true });
  fs.mkdirSync(container);
  fs.mkdirSync(plan.evidence);
  const state = {
    ...plan,
    pid: process.pid,
    nonce: randomUUID(),
    operation: process.argv.includes('--list') ? 'list-only' : 'test',
  };
  fs.writeFileSync(path.join(plan.evidence, 'run.json'), JSON.stringify(state, null, 2) + '\n', {
    flag: 'wx',
  });
  env[stateKey] = JSON.stringify(state);
  env.PLAYWRIGHT_OUTPUT_DIR = plan.output;
  env.PLAYWRIGHT_REPORT_FILE = plan.report;
  env.STYLE_REPORT = plan.report;
  env.VISUAL_EVIDENCE_DIR = plan.screenshots;
  return state;
}

export function prepareTestEvidence() {
  validateTestArguments(process.argv.slice(2));
  if (process.env[stateKey]) {
    const state = JSON.parse(process.env[stateKey]);
    // worker 会再次加载配置；只允许同一进程或 Playwright worker 使用已独占的本次目录。
    if (state.pid !== process.pid && !/^\d+$/.test(process.env.TEST_WORKER_INDEX || ''))
      fail('不能复用上次进程的证据状态');
    validateTestPaths(state, { reserved: true });
    const saved = JSON.parse(fs.readFileSync(path.join(state.evidence, 'run.json'), 'utf8'));
    if (JSON.stringify(saved) !== JSON.stringify(state)) fail('运行记录与目录不匹配');
    return state;
  }
  return reserveTestEvidence(planTestEvidence());
}

export function validateEffectiveOutputs(projects, run) {
  validateTestPaths(run, { reserved: true });
  for (const project of projects) {
    if (absolute(project.outputDir, '实际测试输出') !== run.output)
      fail('实际项目输出与已独占路径不同，禁止执行清理');
  }
  if (exists(run.output) || exists(run.report)) fail('实际输出或报告已经存在，禁止执行清理');
}

export function isTemporaryAttachment(run, file) {
  file = absolute(file, '临时附件');
  if (!within(run.output, file)) return false;
  noLinks(file);
  return true;
}

/** @returns {import('@playwright/test').ReporterDescription[]} */
export function protectedReporters(run) {
  return [
    [fileURLToPath(new URL('./test-evidence-reporter.mjs', import.meta.url))],
    ['list'],
    ['json', { outputFile: run.report }],
  ];
}

export function evidenceDirectory(name) {
  if (!/^[a-z][a-z0-9-]*$/.test(name)) fail('截图分组名称无效');
  const worker = process.env.TEST_WORKER_INDEX;
  // 分组及 worker 分目录，避免不同浏览器或重试写入相同文件名。
  return path.join(
    prepareTestEvidence().screenshots,
    name,
    worker === undefined ? 'collection' : `worker-${worker}`,
  );
}
