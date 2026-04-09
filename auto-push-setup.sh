#!/bin/bash
# auto-push-setup.sh
set -e

echo "Setting up scale-builder auto-push watcher..."

# Install Homebrew if needed
if ! command -v brew &>/dev/null; then
    echo "Installing Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi

# Install fswatch if needed
if ! command -v fswatch &>/dev/null; then
    echo "Installing fswatch..."
    brew install fswatch
else
    echo "fswatch already installed."
fi

# Make watcher executable
chmod +x "$HOME/Desktop/scale-builder/auto-push-watcher.sh"

# Create LaunchAgent plist
PLIST="$HOME/Library/LaunchAgents/com.scalebuilder.autopush.plist"

cat > "$PLIST" <<PLIST_EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.scalebuilder.autopush</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>${HOME}/Desktop/scale-builder/auto-push-watcher.sh</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>${HOME}/Desktop/scale-builder/.watcher.log</string>
    <key>StandardErrorPath</key>
    <string>${HOME}/Desktop/scale-builder/.watcher.log</string>
</dict>
</plist>
PLIST_EOF

# Unload existing if running, then load fresh
launchctl unload "$PLIST" 2>/dev/null || true
launchctl load "$PLIST"

echo ""
echo "Done! Auto-push watcher is now running."
echo "Changes to your scale-builder files will automatically commit and push to GitHub."
echo "Log file: ~/Desktop/scale-builder/.watcher.log"
