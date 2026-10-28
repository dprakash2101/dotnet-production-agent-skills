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
test('guard permits ordinary commands and example environment files', () => {
  for (const command of ['git -C /repo status', 'dotnet test', 'cat .env.example']) assert.equal(decide(command), 'allow', command);
});
test('guard decodes JSON string tool arguments', () => {
  const result = spawnSync(process.execPath, [guard, 'copilot'], {input: JSON.stringify({toolName:'bash', toolArgs: JSON.stringify({command:'git reset --hard'})}), encoding:'utf8'});
  assert.equal(JSON.parse(result.stdout).permissionDecision, 'deny');
});
