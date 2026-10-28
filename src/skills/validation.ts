import { readFile, realpath } from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";

const safeName = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function validateSkills(root: string, names: string[]): Promise<string[]> {
  const errors: string[] = [];
  const declared = new Set<string>();
  for (const name of names) {
    if (!safeName.test(name) || name.length > 64) {
      errors.push(`${name}: unsafe skill directory name`);
      continue;
    }
    const directory = path.join(root, name);
    let contents: string;
    try { contents = await readFile(path.join(directory, "SKILL.md"), "utf8"); }
    catch { errors.push(`${name}: missing or unreadable SKILL.md`); continue; }
    const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(contents);
    if (!match) { errors.push(`${name}: invalid frontmatter delimiters`); continue; }
    const document = YAML.parseDocument(match[1]!, { uniqueKeys: true });
    if (document.errors.length) {
      errors.push(`${name}: invalid YAML: ${document.errors[0]!.message}`);
      continue;
    }
    const metadata = document.toJS();
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
      errors.push(`${name}: frontmatter must be a mapping`);
      continue;
    }
    const fields = metadata as Record<string, unknown>;
    if (typeof fields.name !== "string" || fields.name !== name) errors.push(`${name}: frontmatter name does not match directory`);
    if (typeof fields.description !== "string" || !fields.description.trim() || fields.description.length > 1024) errors.push(`${name}: description must be 1-1024 characters`);
    const body = contents.slice(match[0].length);
    if (!body.trim()) errors.push(`${name}: instruction body is empty`);
    if (body.split(/\r?\n/).length - (body.endsWith("\n") ? 1 : 0) > 500) errors.push(`${name}: instruction body exceeds 500 lines`);
    if (typeof fields.name === "string") {
      if (declared.has(fields.name)) errors.push(`${name}: duplicate skill name ${fields.name}`);
      declared.add(fields.name);
    }
    for (const link of body.matchAll(/\]\(([^)#]+)(?:#[^)]*)?\)/g)) {
      const target = link[1]!;
      if (/^[a-z]+:/i.test(target) || target.startsWith("/")) continue;
      const resolved = path.resolve(directory, target);
      if (!resolved.startsWith(`${directory}${path.sep}`)) { errors.push(`${name}: linked file escapes skill directory: ${target}`); continue; }
      try {
        const actualDirectory = await realpath(directory);
        const actual = await realpath(resolved);
        if (!actual.startsWith(`${actualDirectory}${path.sep}`)) errors.push(`${name}: linked file escapes skill directory: ${target}`);
      } catch { errors.push(`${name}: missing linked file: ${target}`); }
    }
  }
  return errors;
}
