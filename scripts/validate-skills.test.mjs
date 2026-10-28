import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { validateSkills } from '../dist/src/skills/validation.js';

test('CLI and standalone validation agree on YAML and instruction requirements', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'skills-validation-'));
  const skill = path.join(root, 'fixture');
  await mkdir(skill);
  const cases = [
    ['---\nname: fixture\ndescription: >\n  A useful multiline description.\n---\n# Instructions\n', true],
    ['---\nname: fixture\ndescription: first\ndescription: second\n---\n# Instructions\n', false],
    ['---\nname: fixture\ndescription: true\n---\n# Instructions\n', false],
    ['---\nname: fixture\ndescription: valid\n---\n', false],
    ['---\nname: fixture\ndescription: valid\n---\n[Missing](missing.md)\n', false],
    ['---\nname: fixture\ndescription: valid\n---\n[Escape](../outside.md)\n', false],
  ];
  try {
    for (const [content, valid] of cases) {
      await writeFile(path.join(skill, 'SKILL.md'), content);
      assert.equal((await validateSkills(root, ['fixture'])).length === 0, valid);
      const result = spawnSync(process.execPath, ['scripts/validate-skills.mjs', root], { encoding: 'utf8' });
      assert.equal(result.status === 0, valid, result.stderr);
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});
