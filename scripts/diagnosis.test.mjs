import test from 'node:test';
import assert from 'node:assert/strict';
import { diagnose } from '../hooks/diagnosis.mjs';

test('authoritative success outweighs misleading control markers and diagnostic text', () => {
  assert.equal(diagnose({ command: 'npm test', exitCode: 0, output: '^C command not found in fixture' }).category, 'success');
  assert.equal(diagnose({ command: 'git status', output: '^C' }).category, 'unknown');
  assert.equal(diagnose({ command: 'git status', output: 'Exit code: 0' }).category, 'unknown');
});

test('diagnosis covers running application failures across ecosystems', () => {
  for (const [command, output] of [
    ['dotnet build', '^U MSB3021: Unable to copy file'],
    ['npm test', 'npm ERR! test failed'],
    ['python app.py', 'Traceback (most recent call last)\nModuleNotFoundError: No module named secret'],
    ['docker ps', 'Cannot connect to the Docker daemon'],
    ['git fetch', 'fatal: Authentication failed'],
    ['pnpm test', 'ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL'],
  ]) {
    const actual = diagnose({ command, output, exitCode: 1 });
    assert.equal(actual.category, 'application-failure', command);
    assert.equal(actual.retrySafe, false);
  }
});

test('corruption requires submitted and executed evidence plus a shell failure', () => {
  for (const executedCommand of ['^Unpm test', '\u0015npm test', 'pm test']) {
    const actual = diagnose({ submittedCommand: 'npm test', executedCommand, output: 'command not found' });
    assert.equal(actual.category, 'transport-corruption');
    assert.equal(actual.nextAction, 'use-structured-runner');
    assert.match(actual.message, /run_process MCP tool/);
    assert.match(actual.message, /prior side effects/);
    assert.equal(actual.retrySafe, false);
  }
  assert.equal(diagnose({ command: 'npm test', output: '^Unpm: command not found' }).category, 'suspected-transport-corruption');
  assert.equal(diagnose({ submittedCommand: 'npm test', executedCommand: '^Unpm test' }).category, 'uncertain-completion');
  assert.equal(diagnose({ submittedCommand: 'npm test', executedCommand: 'npm install', output: 'command not found' }).category, 'executable-unavailable');
  assert.equal(diagnose({ command: '^Ugit status' }).category, 'shell-syntax');
});

test('native shell errors naming corrupted clean executables route away from interactive transport', () => {
  for (const [command, output] of [
    ['git status', '^Ugit: command not found'],
    ['git status', '\u0015git: command not found'],
    ['git status', 'it: command not found'],
    ['npm test', 'bash: ^Unpm: command not found'],
    ['python app.py', 'zsh: command not found: ^Upython'],
    ['git status', "^Ugit : The term '^Ugit' is not recognized as the name of a cmdlet"],
    ['docker ps', "'^Udocker' is not recognized as an internal or external command"],
  ]) {
    const actual = diagnose({ command, output });
    assert.equal(actual.category, 'suspected-transport-corruption', output);
    assert.equal(actual.confidence, 'medium');
    assert.equal(actual.nextAction, 'use-structured-runner');
    assert.match(actual.message, /run_process MCP tool/);
    assert.match(actual.message, /not proven/);
    assert.equal(actual.retrySafe, false);
  }
  for (const [command, output] of [
    ['git status', 'echo ^Ugit'],
    ['git status', '^Ugit'],
    ['git status', '^Unpm: command not found'],
    ['git status', "echo '^Ugit: command not found'"],
    ['"git" status', '^Ugit: command not found'],
  ]) assert.notEqual(diagnose({ command, output }).category, 'suspected-transport-corruption', output);
  assert.equal(diagnose({ command: 'git status', output: '^Ugit: command not found', exitCode: 0 }).category, 'success');
  assert.equal(diagnose({ command: 'python app.py', output: '^Upython: command not found\nTraceback (most recent call last):' }).category, 'application-failure');
});

test('workspace selection failures are separated from missing executables', () => {
  for (const output of ['fatal: not a git repository', 'MSB1003: Specify a project or solution file', 'npm error ENOENT open /wrong/package.json', 'cd: /wrong: No such file or directory']) {
    assert.equal(diagnose({ command: 'git status', output, exitCode: 1 }).category, 'wrong-directory', output);
  }
  assert.equal(diagnose({ command: 'python app.py', output: 'python: command not found', exitCode: 127 }).category, 'executable-unavailable');
});

test('PowerShell and Bash parser errors produce shell-specific inspection guidance', () => {
  for (const output of ['ParserError: Unexpected token in expression or statement', "bash: syntax error near unexpected token `('", "The token '&&' is not a valid statement separator"]) {
    assert.equal(diagnose({ command: 'echo test', output }).category, 'shell-syntax');
  }
});

test('timeouts and ambiguous completion never recommend an automatic retry', () => {
  for (const output of ['Command timed out', 'Process interrupted by SIGINT', 'Execution still running', 'Terminal disconnected']) {
    const actual = diagnose({ command: 'git push', output });
    assert.equal(actual.category, 'uncertain-completion');
    assert.equal(actual.retrySafe, false);
  }
  assert.equal(diagnose({ command: 'echo done && missing', output: 'missing: command not found' }).retrySafe, false);
  assert.equal(diagnose({ command: 'missing', output: 'missing: command not found' }).retrySafe, false);
  assert.equal(diagnose({ command: 'node publish.js', output: 'child: command not found' }).retrySafe, false);
});

test('diagnosis does not echo secrets, executes nothing, and bounds inspected evidence', () => {
  const secret = 'SECRET_TOKEN_123';
  const actual = diagnose({ command: `python ${secret}`, output: `ModuleNotFoundError: ${secret}`, cwd: `/secret/${secret}` });
  assert.doesNotMatch(JSON.stringify(actual), /SECRET_TOKEN_123/);
  assert.equal(diagnose({ output: 'x'.repeat(40_000) + ' command not found' }).category, 'unknown');
  assert.equal(diagnose(null).category, 'unknown');
});


test('Python exception punctuation outweighs a cosmetic executed-command mismatch', () => {
  for (const output of [
    'Traceback (most recent call last): SECRET_VALUE',
    'SyntaxError: invalid syntax SECRET_VALUE',
    'ImportError: cannot import name SECRET_VALUE',
  ]) {
    const actual = diagnose({ command: 'python app.py', submittedCommand: 'python app.py', executedCommand: '^Upython app.py', output });
    assert.equal(actual.category, 'application-failure', output);
    assert.equal(actual.confidence, 'high');
    assert.equal(actual.retrySafe, false);
    assert.doesNotMatch(JSON.stringify(actual), /SECRET_VALUE/);
  }
});
