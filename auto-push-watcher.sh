#!/bin/bash
# auto-push-watcher.sh
REPO_DIR="$HOME/Desktop/scale-builder"
DEBOUNCE=4  # seconds to wait after a change before committing
LOG="$REPO_DIR/.watcher.log"

echo "[$(date)] Scale-builder auto-push watcher started." | tee -a "$LOG"

fswatch -o "$REPO_DIR" --exclude="\.git" | while read num_events; do
    sleep $DEBOUNCE
    cd "$REPO_DIR" || continue
    if [[ -n $(git status --porcelain) ]]; then
        git add .
        git commit -m "Auto-save: $(date '+%Y-%m-%d %H:%M:%S')" >> "$LOG" 2>&1
        if git push >> "$LOG" 2>&1; then
            echo "[$(date)] Pushed to GitHub." | tee -a "$LOG"
        else
            echo "[$(date)] Push failed. Will retry on next change." | tee -a "$LOG"
        fi
    fi
done
