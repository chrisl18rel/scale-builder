#!/bin/bash
# auto-push-watcher.sh
REPO_DIR="$HOME/Desktop/scale-builder"
DEBOUNCE=5
LOG="$REPO_DIR/.watcher.log"

echo "[$(date)] Scale-builder auto-push watcher started." >> "$LOG"

# Exclude .git dir, log file, and any lock files from triggering
fswatch -o "$REPO_DIR" \
  --exclude="\.git" \
  --exclude="\.watcher\.log" \
  --exclude="index\.lock" \
  | while read num_events; do
    sleep $DEBOUNCE
    cd "$REPO_DIR" || continue

    # Skip if a git lock file exists (another git process is running)
    if [[ -f "$REPO_DIR/.git/index.lock" ]]; then
        continue
    fi

    if [[ -n $(git status --porcelain 2>/dev/null) ]]; then
        git add . 2>/dev/null
        git commit -m "Auto-save: $(date '+%Y-%m-%d %H:%M:%S')" >> "$LOG" 2>&1
        if git push >> "$LOG" 2>&1; then
            echo "[$(date)] Pushed to GitHub." >> "$LOG"
        else
            echo "[$(date)] Push failed. Will retry on next change." >> "$LOG"
        fi
    fi
done
