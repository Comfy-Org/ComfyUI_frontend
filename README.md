# ComfyUI_frontend

Front-end of [ComfyUI](https://github.com/comfyanonymous/ComfyUI) modernized. This repo is fully compatible with the existing extension system.

## Road Map

### What has been done

- Migrate all code to TypeScript with minimal change modification to the original logic.
- Bundle all code with vite's rollup build.
- Added a shim layer to be backward compatible with the existing extension system. https://github.com/huchenlei/ComfyUI_frontend/pull/15
- Front-end dev server.
- Zod schema for input validation on ComfyUI workflow.

### What to be done

- Make litegraph a npm dependency.
- Replace the existing ComfyUI front-end impl.
- Turn on `strict` on `tsconfig.json`.
- Introduce react to start managing part of the UI.
- Introduce a UI library to add more widget types for node developers.
- LLM streaming node.
- Linear mode (Similar to InvokeAI's linear mode).
- Better node search. Sherlock https://github.com/Nuked88/ComfyUI-N-Sidebar.
- Keybinding settings management. Register keybindings API for custom nodes.
- New extensions API for adding UI-related features.

## Development

Note: The dev server will NOT load any extension from the ComfyUI server. Only
core extensions will be loaded.

- Run `npm install` to install the necessary packages
- Start local ComfyUI backend at `localhost:8188`
- Run `npm run dev` to start the dev server

## Test

- `npm i` to install all dependencies
- `npm run test:generate` to fetch `tests-ui/data/object_info.json`
- `npm run test` to execute all unit tests.

## Deploy

Copy everything under `dist/` to `ComfyUI/web/` in your ComfyUI checkout.

## Breaking changes
- api.api_url now adds a prefix `api/` to every url going through the method. If the custom node registers a new api endpoint but does not offer the `api/` prefixed alt endpoint, it will have issue. Luckily there aren't many extensions that do that. We can perform an audit before launching to resolve this issue.
