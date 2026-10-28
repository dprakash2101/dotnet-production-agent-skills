#!/usr/bin/env python3
"""Run the same validator used by the package CLI against a skills directory."""
from pathlib import Path
import subprocess
import sys

repository = Path(__file__).resolve().parent.parent
skills = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else repository / 'skills'
if not skills.is_dir():
    print(f'error: skills directory not found: {skills}', file=sys.stderr)
    sys.exit(2)
# Build before importing: this entry point is also used independently of npm test.
result = subprocess.run(['npm', 'run', 'build'], cwd=repository)
if result.returncode:
    sys.exit(result.returncode)
sys.exit(subprocess.run(['node', str(repository / 'scripts' / 'validate-skills.mjs'), str(skills)], cwd=repository).returncode)
