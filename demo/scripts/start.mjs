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

// Colours, so the agent's log stands out on stage: agent lines cyan, the beats the talk points at
// (negotiation, policy, validation, retries) bold, failures red, client lines dimmed.
// Off when the output isn't a terminal or NO_COLOR is set.
const color = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (codes, text) => (color ? `\x1b[${codes}m${text}\x1b[0m` : text);
const FAILURE = /fail|error|exhausted|reject|VALIDATION_FAILED|503/i;
const BEAT = /^---|policy|capabilities|Attempt \d|Retrying/;

function format(label, line) {
  if (label === 'client') return paint('2', `[client] ${line}`);
  if (FAILURE.test(line)) return paint('1;31', `[agent] ${line}`);
  if (BEAT.test(line)) return paint('1;36', `[agent] ${line}`);
  return paint('36', `[agent] ${line}`);
}

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
      for (const line of lines) console.log(format(label, line));
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
