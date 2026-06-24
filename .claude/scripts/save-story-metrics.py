#!/usr/bin/env python3
"""
Stop hook: reads .claude/story-session.json to find the active story and phase,
then finds the most recent session metadata to extract token counts and duration,
and writes them into the story file's Session Metrics section.
"""
import json, re, sys, time
from pathlib import Path

PROJECT = "/Users/vindhyasurampudi/Documents/Workspace/Team/C1Pay"
INTENT_FILE = Path(PROJECT) / ".claude" / "story-session.json"
META_DIR = Path.home() / ".claude/usage-data/session-meta"

def find_latest_session():
    sessions = []
    for f in META_DIR.glob("*.json"):
        try:
            d = json.loads(f.read_text())
            if d.get("project_path") == PROJECT:
                sessions.append((f.stat().st_mtime, d))
        except Exception:
            pass
    sessions.sort(reverse=True)
    return sessions[0][1] if sessions else None

def fmt(n):
    return f"{n:,}" if isinstance(n, int) else "—"

def main():
    if not INTENT_FILE.exists():
        sys.exit(0)

    try:
        intent = json.loads(INTENT_FILE.read_text())
    except Exception:
        sys.exit(0)

    story_file = Path(intent.get("story_file", ""))
    phase = intent.get("phase", "")

    if not story_file.exists() or phase not in ("dev", "review"):
        sys.exit(0)

    # Give Claude Code a moment to finish writing the session metadata
    time.sleep(3)

    meta = find_latest_session()
    if not meta:
        sys.exit(0)

    input_tok = meta.get("input_tokens", "—")
    output_tok = meta.get("output_tokens", "—")
    duration = meta.get("duration_minutes", "—")

    if isinstance(input_tok, int) and isinstance(output_tok, int):
        total = input_tok + output_tok
        token_str = f"{fmt(total)} (in: {fmt(input_tok)} / out: {fmt(output_tok)})"
    else:
        token_str = "—"

    duration_str = f"{duration} min" if isinstance(duration, (int, float)) else "—"

    content = story_file.read_text()

    if phase == "dev":
        content = re.sub(
            r'(### Development\n(?:.*\n)*?- Duration: )—',
            rf'\g<1>{duration_str}',
            content
        )
        content = re.sub(
            r'(### Development\n(?:.*\n)*?- Tokens \(dev\): )—',
            rf'\g<1>{token_str}',
            content
        )
    elif phase == "review":
        content = re.sub(
            r'(### Code Review\n(?:.*\n)*?- Duration: )—',
            rf'\g<1>{duration_str}',
            content
        )
        content = re.sub(
            r'(### Code Review\n(?:.*\n)*?- Tokens: )—',
            rf'\g<1>{token_str}',
            content
        )

    story_file.write_text(content)
    INTENT_FILE.unlink(missing_ok=True)
    print(f"[story-metrics] Updated {story_file.name} ({phase}): {token_str}, {duration_str}")

if __name__ == "__main__":
    main()
