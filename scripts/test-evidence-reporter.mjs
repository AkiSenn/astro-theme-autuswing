import fs from 'node:fs';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import {
  prepareTestEvidence,
  validateEffectiveOutputs,
  isTemporaryAttachment,
} from './test-evidence.mjs';

export default class EvidenceReporter {
  // 当前固定版本的 v2 hook 早于输出清理；v1 的 onBegin 已经太晚。
  version() {
    return 'v2';
  }
  constructor() {
    const run = prepareTestEvidence();
    this.run = run;
    this.log = fs.openSync(path.join(run.evidence, 'console.log'), 'wx');
    this.attachments = fs.openSync(path.join(run.evidence, 'attachments.jsonl'), 'wx');
    console.log(`临时测试产物：${run.output}\n本次证据（不会自动清理）：${run.evidence}`);
  }
  onConfigure(config) {
    try {
      validateEffectiveOutputs(config.projects, this.run);
    } catch (error) {
      // Playwright 会吞掉 reporter 抛错；这里必须在清理任务前直接停止进程。
      console.error(error.message);
      fs.writeSync(this.log, error.message + '\n');
      fs.closeSync(this.log);
      fs.closeSync(this.attachments);
      process.exit(1);
    }
  }
  onStdOut(chunk) {
    fs.writeSync(this.log, chunk);
  }
  onStdErr(chunk) {
    fs.writeSync(this.log, chunk);
  }
  onError(error) {
    fs.writeSync(this.log, (error.stack || error.message || String(error)) + '\n');
  }
  onTestEnd(test, result) {
    try {
      for (const attachment of result.attachments) {
        if (!attachment.path) continue; // 内存附件已由 JSON reporter 保存。
        if (!isTemporaryAttachment(this.run, attachment.path)) continue;
        const dir = path.join(this.run.evidence, 'attachments');
        fs.mkdirSync(dir, { recursive: true });
        const target = path.join(dir, randomUUID() + '-' + path.basename(attachment.path));
        const bytes = fs.readFileSync(attachment.path);
        fs.writeFileSync(target, bytes, { flag: 'wx' });
        fs.writeSync(
          this.attachments,
          JSON.stringify({
            test: test.id,
            retry: result.retry,
            name: attachment.name,
            original: attachment.path,
            saved: target,
            sha256: createHash('sha256').update(bytes).digest('hex'),
          }) + '\n',
        );
      }
    } catch (error) {
      this.archiveError = true;
      fs.writeSync(this.log, `附件保存失败：${error.message}\n`);
    }
  }
  onEnd(result) {
    fs.writeSync(this.log, `\n测试结果：${result.status}\n`);
    fs.closeSync(this.log);
    fs.closeSync(this.attachments);
    // 保存失败不能被一组产品断言通过掩盖。
    if (this.archiveError) return { status: 'failed' };
  }
}
