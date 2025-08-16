# Extension Development Guide

## Understanding Extensions in ComfyUI

### Terminology Clarification

**ComfyUI Extension** - The umbrella term for any 3rd party code that extends ComfyUI functionality. This includes:

1. **Python Custom Nodes** - Backend nodes providing new operations
   - Located in `/custom_nodes/` directories
   - Registered via Python module system
   - Identified by `custom_nodes.<name>` in `python_module` field

2. **JavaScript Extensions** - Frontend functionality that can be:
   - Pure JavaScript extensions (implement `ComfyExtension` interface)
   - JavaScript components of custom nodes (in `/web/` or `/js/` folders)
   - Core extensions (built into frontend at `/src/extensions/core/`)

### How Extensions Load

**Backend (Python):**
- Custom nodes from `/custom_nodes/` folders are loaded by the Python server
- Each custom node can define node types and their properties

**Frontend (JavaScript):**
- Core extensions: Bundled with frontend, always available
- Custom extensions: Loaded dynamically via `/extensions` API endpoint
- The server serves `.js` files from custom node `/web/` directories

## Why Extensions Don't Load in Dev Server

The development server cannot load custom node JavaScript due to architectural constraints from the TypeScript/Vite migration.

### The Technical Challenge

ComfyUI migrated to TypeScript and Vite while maintaining backward compatibility for thousands of existing extensions that rely on the old unbundled module system. This was achieved through a **shim system** that only works in production builds.

### How It Works

**Production Build:**
- A custom Vite plugin binds module exports to `window.comfyAPI`
- Generates shim files that re-export from this global object
- Extensions can import modules without changes

**Development Server:**
- Serves raw source files without bundling
- No shims are generated (would defeat fast dev server purpose)
- Custom node JavaScript cannot resolve imports

## Development Workarounds

### Option 1: Develop as Core Extension (Recommended)

1. Copy your extension to `src/extensions/core/`
2. Update imports to relative paths:
   ```javascript
   import { app } from '../../scripts/app'
   import { api } from '../../scripts/api'
   ```
3. Add to `src/extensions/core/index.ts`
4. Test with hot reload working
5. Move back when complete

### Option 2: Use Production Build

Build the frontend for full functionality:
```bash
npm run build
```
Note: Slower iteration, no hot reload

### Option 3: Test Against Cloud/Staging

For cloud extensions, modify `.env`:
```
DEV_SERVER_COMFYUI_URL=http://stagingcloud.comfy.org/
```