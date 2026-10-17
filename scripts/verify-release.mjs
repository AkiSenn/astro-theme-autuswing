import path from 'node:path';
import { parseArgs } from 'node:util';
import { verifyRelease } from './release-integrity.mjs';
import policy from '../deployment/release-policy.json' with { type: 'json' };
const { positionals } = parseArgs({ allowPositionals: true, options: {} });
if (positionals.length !== 1) throw new Error('Usage: npm run verify:release -- <candidate-directory>');
const root = path.resolve(positionals[0]);
const release = verifyRelease(root, policy);
console.log({ directory: root, status: release.status, mode: release.build.mode, files: release.build.files.length, source: release.git });
