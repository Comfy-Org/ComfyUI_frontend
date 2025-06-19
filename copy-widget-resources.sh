#!/bin/bash

# Script to copy vue-widget-conversion folder and .claude/commands/create-widget.md 
# to another local copy of the same repository

# Check if destination directory was provided
if [ $# -eq 0 ]; then
    echo "Usage: $0 <destination-repo-path>"
    echo "Example: $0 /home/c_byrne/projects/comfyui-frontend-testing/ComfyUI_frontend-clone-8"
    exit 1
fi

# Get the destination directory from first argument
DEST_DIR="$1"

# Source files/directories (relative to script location)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_WIDGET_DIR="$SCRIPT_DIR/vue-widget-conversion"
SOURCE_COMMAND_FILE="$SCRIPT_DIR/.claude/commands/create-widget.md"

# Destination paths
DEST_WIDGET_DIR="$DEST_DIR/vue-widget-conversion"
DEST_COMMAND_DIR="$DEST_DIR/.claude/commands"
DEST_COMMAND_FILE="$DEST_COMMAND_DIR/create-widget.md"

# Check if destination directory exists
if [ ! -d "$DEST_DIR" ]; then
    echo "Error: Destination directory does not exist: $DEST_DIR"
    exit 1
fi

# Check if source vue-widget-conversion directory exists
if [ ! -d "$SOURCE_WIDGET_DIR" ]; then
    echo "Error: Source vue-widget-conversion directory not found: $SOURCE_WIDGET_DIR"
    exit 1
fi

# Check if source command file exists
if [ ! -f "$SOURCE_COMMAND_FILE" ]; then
    echo "Error: Source command file not found: $SOURCE_COMMAND_FILE"
    exit 1
fi

echo "Copying widget resources to: $DEST_DIR"

# Copy vue-widget-conversion directory
echo "Copying vue-widget-conversion directory..."
if [ -d "$DEST_WIDGET_DIR" ]; then
    echo "  Warning: Destination vue-widget-conversion already exists. Overwriting..."
    rm -rf "$DEST_WIDGET_DIR"
fi
cp -r "$SOURCE_WIDGET_DIR" "$DEST_WIDGET_DIR"
echo "  ✓ Copied vue-widget-conversion directory"

# Create .claude/commands directory if it doesn't exist
echo "Creating .claude/commands directory structure..."
mkdir -p "$DEST_COMMAND_DIR"
echo "  ✓ Created .claude/commands directory"

# Copy create-widget.md command
echo "Copying create-widget.md command..."
cp "$SOURCE_COMMAND_FILE" "$DEST_COMMAND_FILE"
echo "  ✓ Copied create-widget.md command"

# Verify the copy was successful
echo ""
echo "Verification:"
if [ -d "$DEST_WIDGET_DIR" ] && [ -f "$DEST_WIDGET_DIR/vue-widget-guide.md" ] && [ -f "$DEST_WIDGET_DIR/primevue-components.md" ]; then
    echo "  ✓ vue-widget-conversion directory copied successfully"
    echo "    - vue-widget-guide.md exists"
    echo "    - primevue-components.md exists"
    if [ -f "$DEST_WIDGET_DIR/primevue-components.json" ]; then
        echo "    - primevue-components.json exists"
    fi
else
    echo "  ✗ Error: vue-widget-conversion directory copy may have failed"
fi

if [ -f "$DEST_COMMAND_FILE" ]; then
    echo "  ✓ create-widget.md command copied successfully"
else
    echo "  ✗ Error: create-widget.md command copy may have failed"
fi

echo ""
echo "Copy complete! Widget resources are now available in: $DEST_DIR"
echo ""
echo "You can now use the widget creation command in the destination repo:"
echo "  /project:create-widget <widget specification>"