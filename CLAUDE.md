# Scale Builder — Project Notes for Claude

## Git Workflow

**Do not run git commands from the sandbox.** The sandbox and the watcher both access the same repo on the user's Mac, and sandbox git commands create `.git/index.lock` files that block the watcher.

Claude's only job is to edit files. Git is handled entirely by the watcher.

### How it works
- A background watcher script (`auto-push-watcher.sh`) runs on Chris's Mac via `~/.zshrc`
- It uses `fswatch` to detect file changes in `~/Desktop/scale-builder`
- When a change is detected, it waits 5 seconds (debounce), then runs `git add . && git commit && git push`
- Pushes go to `git@github.com:chrisl18rel/scale-builder.git` via SSH key authentication
- The watcher log is at `~/Desktop/scale-builder/.watcher.log`

### If the watcher stalls
A stale lock file is usually the cause. Chris can fix it by running:
```
rm -f ~/Desktop/scale-builder/.git/index.lock
```

### If the watcher isn't running
It starts automatically when Terminal opens (added to `~/.zshrc`). To start it manually:
```
nohup ~/Desktop/scale-builder/auto-push-watcher.sh > /dev/null 2>&1 &
```

### Triggering the watcher for pre-existing changes
If files were modified before the watcher started, fswatch won't detect them. Make a small edit to any file to trigger a new detection cycle.
