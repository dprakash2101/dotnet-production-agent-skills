import { readdir } from 'node:fs/promises';
import { validateSkills } from '../dist/src/skills/validation.js';

const root = process.argv[2];
try {
  const entries = await readdir(root, { withFileTypes: true });
  const names = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  const errors = await validateSkills(root, names);
  if (errors.length) {
    console.error(`Skill validation failed:\n${errors.map((error) => `- ${error}`).join('\n')}`);
    process.exitCode = 1;
  } else {
    console.log(`Validated ${names.length} skills in ${root}`);
  }
} catch (error) {
  console.error(`Skill validation failed: ${error.message}`);
  process.exitCode = 2;
}
