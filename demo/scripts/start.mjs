#!/usr/bin/env node
// Demo: builds the agent, then runs the agent (:10002) and the client (:4200) in one terminal.
//
//   npm run demo          stub agent: canned replies, no model, no key
//   npm run demo:live     live agent: Gemini, needs GEMINI_API_KEY in apps/agent/.env
//
// The stage switches (invalid first attempt, leaky replies, ...) are in the browser's demo panel,
// Alt+Shift+D; the STUB_* variables still work here for the starting values. Ctrl+C stops both.
// Plain Node, so it runs the same on macOS, Linux and Windows.

import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const live = process.argv.includes('--live');
const cwd = fileURLToPath(new URL('..', import.meta.url));
const windows = process.platform === 'win32';
const npm = windows ? 'npm.cmd' : 'npm';

const build = spawnSync(npm, ['run', 'build', '-w', 'agent'], {cwd, stdio: 'inherit', shell: windows});
if (build.status !== 0) process.exit(build.status ?? 1);

const children = [];
let stopping = false;

function stopAll(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) if (child.exitCode === null) child.kill();
  process.exitCode = code;
}

function start(label, args, env) {
  const child = spawn(npm, args, {cwd, env: {...process.env, ...env}, stdio: ['ignore', 'pipe', 'pipe'], shell: windows});
  for (const stream of [child.stdout, child.stderr]) {
    let rest = '';
    stream.setEncoding('utf8');
    stream.on('data', chunk => {
      const lines = (rest + chunk).split('\n');
      rest = lines.pop() ?? '';
      for (const line of lines) console.log(`[${label}] ${line}`);
    });
  }
  child.on('exit', code => {
    if (!stopping) {
      console.log(`[${label}] exited (${code ?? 'signal'}); stopping the other one.`);
      stopAll(code ?? 1);
    }
  });
  children.push(child);
}

start('agent', ['run', 'start', '-w', 'agent'], live ? {} : {STUB_LLM: 'true'});
start('client', ['start', '-w', 'client'], {});

process.on('SIGINT', () => stopAll(0));
process.on('SIGTERM', () => stopAll(0));
