#!/usr/bin/env python3
"""
Stop hook: reads .claude/story-session.json to find the active story and phase,
then finds the most recent session metadata to extract token counts and duration,
and writes them into the story file's Session Metrics section.

Usage: python3 .claude/scripts/save-story-metrics.py [--dry-run] [--commit]
         [--project-root <path>]

Environment:
  STORY_METRICS_PROJECT_ROOT  override repo root (takes precedence over --project-root)
"""
import argparse
import json
import logging
import os
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

logging.basicConfig(format="[story-metrics] %(levelname)s: %(message)s", level=logging.INFO)
log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Repo-root detection
# ---------------------------------------------------------------------------

def detect_project_root(cli_override: str | None) -> Path:
    """Return repo root: env var > CLI arg > git rev-parse > script location."""
    env_val = os.environ.get("STORY_METRICS_PROJECT_ROOT")
    if env_val:
        return Path(env_val).resolve()
    if cli_override:
        return Path(cli_override).resolve()
    try:
        out = subprocess.check_output(
            ["git", "rev-parse", "--show-toplevel"],
            stderr=subprocess.DEVNULL,
            text=True,
        ).strip()
        if out:
            return Path(out)
    except (subprocess.CalledProcessError, FileNotFoundError):
        pass
    # Fall back to two levels above this script (.claude/scripts/save-story-metrics.py)
    return Path(__file__).resolve().parent.parent.parent


# ---------------------------------------------------------------------------
# Session-meta discovery with polling
# ---------------------------------------------------------------------------

META_DIR = Path.home() / ".claude/usage-data/session-meta"
POLL_INTERVAL = 0.5   # seconds
POLL_TIMEOUT  = 15    # seconds


def find_latest_session(project_root: Path) -> dict | None:
    """Poll until a session-meta file for this project appears, then return it."""
    project_str = str(project_root)
    deadline = time.monotonic() + POLL_TIMEOUT
    best: dict | None = None

    while time.monotonic() < deadline:
        candidates = []
        for f in META_DIR.glob("*.json"):
            try:
                d = json.loads(f.read_text())
            except Exception:
                continue
            if d.get("project_path") == project_str:
                candidates.append((f.stat().st_mtime, d))
        if candidates:
            candidates.sort(reverse=True)
            best = candidates[0][1]
            break
        time.sleep(POLL_INTERVAL)

    if best is None:
        log.warning("No session-meta found for project %s after %ss", project_str, POLL_TIMEOUT)
    return best


def validate_meta(meta: dict) -> tuple[str, str]:
    """Extract token_str and duration_str with graceful fallbacks."""
    def fmt(n: object) -> str:
        return f"{n:,}" if isinstance(n, int) else "—"

    input_tok  = meta.get("input_tokens")
    output_tok = meta.get("output_tokens")
    duration   = meta.get("duration_minutes")

    if not isinstance(input_tok, int) or not isinstance(output_tok, int):
        log.warning(
            "Unexpected token fields in session-meta (got input=%r, output=%r); "
            "check that the schema hasn't changed",
            input_tok, output_tok,
        )
        token_str = "—"
    else:
        total = input_tok + output_tok
        token_str = f"{fmt(total)} (in: {fmt(input_tok)} / out: {fmt(output_tok)})"

    if not isinstance(duration, (int, float)):
        log.warning("Missing or non-numeric duration_minutes in session-meta (got %r)", duration)
        duration_str = "—"
    else:
        duration_str = f"{duration} min"

    return token_str, duration_str


# ---------------------------------------------------------------------------
# Line-based section updater (replaces fragile regex)
# ---------------------------------------------------------------------------

SECTION_HEADERS = {
    "dev":    "### Development",
    "review": "### Code Review",
}

FIELD_KEYS = {
    "dev": {
        "duration": "- Duration:",
        "tokens":   "- Tokens (dev):",
    },
    "review": {
        "duration": "- Duration:",
        "tokens":   "- Tokens:",
    },
}


def update_section(content: str, phase: str, duration_str: str, token_str: str) -> str:
    """
    Find the target section header and update the Duration / Tokens lines by
    scanning line by line. Only replaces placeholder values ("—"); existing
    real values are left untouched so re-runs don't clobber prior data.
    """
    header   = SECTION_HEADERS[phase]
    dur_key  = FIELD_KEYS[phase]["duration"]
    tok_key  = FIELD_KEYS[phase]["tokens"]

    lines = content.splitlines(keepends=True)
    in_section = False
    updated_dur = False
    updated_tok = False

    for i, line in enumerate(lines):
        stripped = line.rstrip()

        if stripped == header:
            in_section = True
            continue

        if in_section:
            # Stop if we hit the next section
            if stripped.startswith("###") and stripped != header:
                break

            if not updated_dur and stripped.startswith(dur_key):
                # Replace only if the current value is the placeholder "—"
                after = stripped[len(dur_key):].strip()
                if after == "—":
                    lines[i] = line.replace(f"{dur_key} —", f"{dur_key} {duration_str}", 1)
                updated_dur = True

            if not updated_tok and stripped.startswith(tok_key):
                after = stripped[len(tok_key):].strip()
                if after == "—":
                    lines[i] = line.replace(f"{tok_key} —", f"{tok_key} {token_str}", 1)
                updated_tok = True

        if updated_dur and updated_tok:
            break

    if not updated_dur:
        log.warning("Could not find '%s %s' line under '%s'", dur_key, "—", header)
    if not updated_tok:
        log.warning("Could not find '%s %s' line under '%s'", tok_key, "—", header)

    return "".join(lines)


# ---------------------------------------------------------------------------
# Atomic file write
# ---------------------------------------------------------------------------

def atomic_write(path: Path, content: str) -> None:
    """Write content to a temp file then atomically replace the target."""
    bak = path.with_suffix(path.suffix + ".bak")
    shutil.copy2(path, bak)  # safety backup

    fd, tmp_path = tempfile.mkstemp(dir=path.parent, prefix=".tmp-")
    try:
        with os.fdopen(fd, "w") as fh:
            fh.write(content)
        os.replace(tmp_path, path)
    except Exception:
        os.unlink(tmp_path)
        raise

    bak.unlink(missing_ok=True)  # remove backup only after successful write


# ---------------------------------------------------------------------------
# Optional git commit
# ---------------------------------------------------------------------------

def git_commit(story_file: Path, phase: str) -> None:
    try:
        subprocess.check_call(["git", "add", str(story_file)])
        msg = f"chore: record {phase} session metrics for {story_file.name}"
        subprocess.check_call(["git", "commit", "-m", msg])
        log.info("Committed metrics update: %s", msg)
    except subprocess.CalledProcessError as exc:
        log.warning("git commit failed (exit %s); metrics were written but not committed", exc.returncode)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Save story session metrics on Claude Code Stop.")
    p.add_argument("--dry-run", action="store_true", help="Print what would change without writing")
    p.add_argument("--commit",  action="store_true", help="Stage and commit the updated story file")
    p.add_argument("--project-root", metavar="PATH", help="Override repo root detection")
    return p.parse_args()


def main() -> None:
    args = parse_args()
    project_root = detect_project_root(args.project_root)
    intent_file  = project_root / ".claude" / "story-session.json"

    if not intent_file.exists():
        log.debug("No intent file found at %s; nothing to do", intent_file)
        sys.exit(0)

    try:
        intent = json.loads(intent_file.read_text())
    except Exception as exc:
        log.error("Failed to parse %s: %s", intent_file, exc)
        sys.exit(1)

    story_path = intent.get("story_file", "")
    phase      = intent.get("phase", "")

    if not story_path:
        log.error("Intent file missing 'story_file' key")
        sys.exit(1)

    story_file = Path(story_path)
    if not story_file.is_absolute():
        story_file = project_root / story_file

    if not story_file.exists():
        log.error("Story file not found: %s", story_file)
        sys.exit(1)

    if phase not in ("dev", "review"):
        log.error("Unknown phase %r — expected 'dev' or 'review'", phase)
        sys.exit(1)

    meta = find_latest_session(project_root)
    if not meta:
        log.error("Aborting: no session-meta available")
        sys.exit(1)

    token_str, duration_str = validate_meta(meta)

    original = story_file.read_text()
    updated  = update_section(original, phase, duration_str, token_str)

    if updated == original:
        log.info("No placeholder fields found — story file unchanged")
    elif args.dry_run:
        log.info("DRY-RUN: would update %s (%s): %s, %s", story_file.name, phase, token_str, duration_str)
    else:
        atomic_write(story_file, updated)
        log.info("Updated %s (%s): %s, %s", story_file.name, phase, token_str, duration_str)
        if args.commit:
            git_commit(story_file, phase)

    # Only remove the intent file after a successful (or dry-run) update
    if not args.dry_run:
        try:
            intent_file.unlink(missing_ok=True)
        except Exception as exc:
            log.warning("Could not remove intent file %s: %s", intent_file, exc)


if __name__ == "__main__":
    main()
