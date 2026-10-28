import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const guard = fileURLToPath(new URL('../hooks/guard.mjs', import.meta.url));
function decide(command) {
  const result = spawnSync(process.execPath, [guard, 'copilot'], {
    input: JSON.stringify({toolName: 'bash', toolArgs: {command}}), encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout).permissionDecision;
}
test('guard catches common destructive command variants', () => {
  for (const command of ['git -C /repo push --force origin main', 'git reset HEAD --hard', 'rm -fr /', 'rm -rf "$HOME"', 'head .env']) {
    assert.equal(decide(command), 'deny', command);
  }
});
test('guard blocks PowerShell broad paths with reordered flags and quoting', () => {
  for (const target of ['$HOME', '~', '/', '$env:USERPROFILE']) {
    for (const command of [`Remove-Item -Recurse -Force ${target}`, `Remove-Item '${target}' -Force -Recurse`]) {
      assert.equal(decide(command), 'deny', command);
    }
  }
  assert.equal(decide('Remove-Item -Recurse -Force ./build'), 'allow');
});
test('guard permits ordinary commands and example environment files', () => {
  for (const command of ['git -C /repo status', 'dotnet test', 'cat .env.example']) assert.equal(decide(command), 'allow', command);
});
test('guard denies a Ctrl+U prefix and explains how to correct it', () => {
  for (const command of ['^Udotnet test', '\u0015dotnet test', 'echo ok && ^Udotnet build', 'echo ok\n  ^Udotnet test']) {
    assert.equal(decide(command), 'deny', JSON.stringify(command));
  }
  for (const command of ['dotnet test', 'echo "^Udotnet"']) assert.equal(decide(command), 'allow', command);
  const result = spawnSync(process.execPath, [guard, 'copilot'], { input: JSON.stringify({ toolName: 'bash', toolArgs: { command: '^Udotnet test' } }), encoding: 'utf8' });
  const response = JSON.parse(result.stdout);
  assert.match(response.permissionDecisionReason, /safe-terminal/);
  assert.match(response.permissionDecisionReason, /project working directory/);
  assert.match(response.permissionDecisionReason, /installation directory/);
});
test('guard decodes JSON string tool arguments', () => {
  const result = spawnSync(process.execPath, [guard, 'copilot'], {input: JSON.stringify({toolName:'bash', toolArgs: JSON.stringify({command:'git reset --hard'})}), encoding:'utf8'});
  assert.equal(JSON.parse(result.stdout).permissionDecision, 'deny');
});

function invoke(event, args, extra = {}) {
  const result = spawnSync(process.execPath, [guard, 'copilot', event], {
    input: JSON.stringify({ toolName: 'powershell', toolArgs: args, ...extra }), encoding: 'utf8',
  });
  return result;
}
test('guard rejects installation directories without rejecting executable paths', () => {
  for (const directory of ['C:/Program Files/Git', 'C:/Program Files/dotnet', '/usr/share/dotnet', '/usr/bin']) {
    const result = invoke('preToolUse', { command: 'dotnet test', cwd: directory });
    const response = JSON.parse(result.stdout);
    assert.equal(response.permissionDecision, 'deny', directory);
    assert.match(response.permissionDecisionReason, /safe-terminal/);
    assert.match(response.permissionDecisionReason, /installed hook project/);
  }
  for (const command of ['cd "C:/Program Files/Git"; git status', 'Set-Location -Path "C:/Program Files/dotnet"; dotnet test', 'git -C "C:/Program Files/Git" status', 'git --work-tree=/usr/bin status']) {
    assert.equal(JSON.parse(invoke('preToolUse', { command }).stdout).permissionDecision, 'deny', command);
  }
  for (const command of ['& "C:/Program Files/dotnet/dotnet.exe" test', 'dotnet test', 'echo "C:/Program Files/Git"']) {
    assert.equal(JSON.parse(invoke('preToolUse', { command, cwd: '/work/project' }).stdout).permissionDecision, 'allow', command);
  }
  assert.equal(JSON.parse(invoke('preToolUse', { command: 'git status' }, { cwd: 'C:/Program Files/Git' }).stdout).permissionDecision, 'deny');
});
test('Copilot failure hooks provide bounded recovery without copying tool output', () => {
  const failure = invoke('postToolUseFailure', { command: 'dotnet test' }, { error: 'SECRET_VALUE' });
  assert.equal(failure.status, 2);
  assert.match(failure.stdout, /do not repeat it unchanged/);
  assert.match(failure.stdout, /three distinct corrections/);
  assert.doesNotMatch(failure.stdout, /SECRET_VALUE/);
  const shellFailure = invoke('postToolUse', { command: 'dotnet test' }, { toolResult: { textResultForLlm: 'Process exited with code 1: SECRET_VALUE' } });
  assert.equal(shellFailure.status, 0);
  assert.match(JSON.parse(shellFailure.stdout).additionalContext, /safe-terminal/);
  assert.doesNotMatch(shellFailure.stdout, /SECRET_VALUE/);
  assert.deepEqual(JSON.parse(invoke('postToolUse', { command: 'dotnet test' }, { toolResult: { textResultForLlm: 'Passed. Exit code: 0' } }).stdout), {});
  assert.deepEqual(JSON.parse(invoke('postToolUseFailure', {}, { toolName: 'view', error: 'failure' }).stdout), {});
});
