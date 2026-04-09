#!/bin/bash
# setup-zshrc.sh

# Make watcher executable
chmod +x "$HOME/Desktop/scale-builder/auto-push-watcher.sh"

# Add watcher startup to .zshrc (only if not already there)
if ! grep -q "auto-push-watcher" "$HOME/.zshrc"; then
    cat >> "$HOME/.zshrc" <<'ZSHRC'

# Scale-builder auto-push watcher
if ! pgrep -f "auto-push-watcher" > /dev/null 2>&1; then
  nohup ~/Desktop/scale-builder/auto-push-watcher.sh > /dev/null 2>&1 &
fi
ZSHRC
    echo "Added watcher to .zshrc"
else
    echo ".zshrc already configured"
fi

# Start the watcher now
if ! pgrep -f "auto-push-watcher" > /dev/null 2>&1; then
    nohup "$HOME/Desktop/scale-builder/auto-push-watcher.sh" > /dev/null 2>&1 &
    echo "Watcher started! PID: $!"
else
    echo "Watcher already running."
fi
