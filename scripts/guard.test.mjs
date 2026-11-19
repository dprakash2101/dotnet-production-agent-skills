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
test('guard decodes JSON string tool arguments', () => {
  const result = spawnSync(process.execPath, [guard, 'copilot'], {input: JSON.stringify({toolName:'bash', toolArgs: JSON.stringify({command:'git reset --hard'})}), encoding:'utf8'});
  assert.equal(JSON.parse(result.stdout).permissionDecision, 'deny');
});

test('Claude guard rejects co-author attribution in commit and PR commands', () => {
  for (const command of [
    'git commit -m "Fix\n\nCo-Authored-By: Claude <noreply@anthropic.com>"',
    'git -C "/work/repo" commit --trailer "co-authored-by: Claude <noreply@anthropic.com>"',
    "git commit -F - <<'EOF'\nFix\n\nCO-AUTHORED-BY: Claude <noreply@anthropic.com>\nEOF",
    'gh pr create --body "Fix\n\nCo-Authored-By: Claude <noreply@anthropic.com>"',
    'gh pr edit 1 --body "Co-authored-by: Claude <noreply@anthropic.com>"',
  ]) {
    const result = spawnSync(process.execPath, [guard, 'claude'], {
      input: JSON.stringify({tool_name: 'Bash', tool_input: {command}}), encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
    const output = JSON.parse(result.stdout).hookSpecificOutput;
    assert.equal(output.permissionDecision, 'deny', command);
    assert.match(output.permissionDecisionReason, /Remove the co-author trailer/);
  }
  for (const command of ['git commit -m "Fix"', 'gh pr create --body "Fix"', 'rg "Co-authored-by:" .', 'git log --grep="Co-authored-by:"']) {
    assert.equal(decide(command), 'allow', command);
  }
});
