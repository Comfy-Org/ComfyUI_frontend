# Node Definition Translation Collection Script

## Overview

The `collect-i18n-node-defs.ts` script automatically extracts translatable content from ComfyUI node definitions to generate structured JSON files for internationalization (i18n).

## What It Does

- Uses Playwright to load ComfyUI frontend and fetch node definitions via the ComfyUI HTTP API
- Extracts data types, node categories, input/output names, and descriptions
- Discovers runtime widget labels by creating actual node instances
- Normalizes keys for i18n compatibility (replaces dots with underscores)
- Generates `src/locales/en/main.json` (data types & categories) and `src/locales/en/nodeDefs.json`

## How It Works

1. **Browser Setup**: Uses Playwright to load ComfyUI frontend and access the HTTP API
2. **Data Collection**: Fetches node definitions via API and filters out DevTools nodes
3. **Widget Discovery**: Creates LiteGraph node instances to find runtime-generated widgets
4. **Output Generation**: Writes structured translation files

## Key Features

- **Runtime Widget Detection**: Captures dynamically created widgets not in static definitions
- **Data Type Deduplication**: Skips output names that already exist as data types
- **Special Character Handling**: Normalizes keys with dots for i18n compatibility

## Usage

```bash
npm run collect:i18n:nodeDefs
```

## Output Structure

- **main.json**: Updates `dataTypes` and `nodeCategories` sections
- **nodeDefs.json**: Complete node translation structure with inputs, outputs, and metadata