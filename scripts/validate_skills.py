#!/usr/bin/env python3
"""Validate the portable subset of the Agent Skills specification."""

from __future__ import annotations

import re
import sys
from pathlib import Path


NAME_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
LINK_PATTERN = re.compile(r"\[[^]]+\]\(([^)]+)\)")


def parse_frontmatter(path: Path) -> tuple[dict[str, str], str]:
    text = path.read_text(encoding="utf-8")
    lines = text.splitlines()
    if not lines or lines[0] != "---":
        raise ValueError("missing opening YAML frontmatter delimiter")
    try:
        end = lines.index("---", 1)
    except ValueError as error:
        raise ValueError("missing closing YAML frontmatter delimiter") from error

    metadata: dict[str, str] = {}
    for line in lines[1:end]:
        if not line.strip() or line.startswith((" ", "\t")):
            continue
        key, separator, value = line.partition(":")
        if not separator:
            raise ValueError(f"invalid frontmatter line: {line!r}")
        metadata[key.strip()] = value.strip().strip("'\"")
    return metadata, "\n".join(lines[end + 1 :])


def validate_skill(skill_dir: Path) -> list[str]:
    errors: list[str] = []
    skill_file = skill_dir / "SKILL.md"
    if not skill_file.is_file():
        return [f"{skill_dir}: missing SKILL.md"]

    try:
        metadata, body = parse_frontmatter(skill_file)
    except ValueError as error:
        return [f"{skill_file}: {error}"]

    name = metadata.get("name", "")
    description = metadata.get("description", "")
    if name != skill_dir.name:
        errors.append(f"{skill_file}: name {name!r} must match directory {skill_dir.name!r}")
    if not NAME_PATTERN.fullmatch(name) or len(name) > 64:
        errors.append(f"{skill_file}: invalid name {name!r}")
    if not 1 <= len(description) <= 1024:
        errors.append(f"{skill_file}: description must be 1-1024 characters")
    if not body.strip():
        errors.append(f"{skill_file}: instruction body is empty")
    if len(body.splitlines()) > 500:
        errors.append(f"{skill_file}: instruction body exceeds 500 lines")

    for link in LINK_PATTERN.findall(body):
        if "://" in link or link.startswith("#"):
            continue
        target = (skill_dir / link.split("#", 1)[0]).resolve()
        try:
            target.relative_to(skill_dir.resolve())
        except ValueError:
            errors.append(f"{skill_file}: link escapes skill directory: {link}")
            continue
        if not target.exists():
            errors.append(f"{skill_file}: missing linked resource: {link}")
    return errors


def main() -> int:
    repository = Path(__file__).resolve().parent.parent
    skills_dir = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else repository / "skills"
    if not skills_dir.is_dir():
        print(f"error: skills directory not found: {skills_dir}", file=sys.stderr)
        return 2

    skill_dirs = sorted(path for path in skills_dir.iterdir() if path.is_dir())
    errors = [error for skill_dir in skill_dirs for error in validate_skill(skill_dir)]
    if errors:
        print("Skill validation failed:", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1

    print(f"Validated {len(skill_dirs)} skills in {skills_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
