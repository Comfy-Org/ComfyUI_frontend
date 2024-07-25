# ComfyUI_frontend

Front-end of [ComfyUI](https://github.com/comfyanonymous/ComfyUI) modernized. This repo is fully compatible with the existing extension system.

## How To Use

Add command line argument `--front-end-version Comfy-Org/ComfyUI_frontend@latest` to your
ComfyUI launch script.

For Windows stand-alone build users, please edit the `run_cpu.bat` / `run_nvidia_gpu.bat` file as following

```bat
.\python_embeded\python.exe -s ComfyUI\main.py --windows-standalone-build --front-end-version Comfy-Org/ComfyUI_frontend@latest
pause
```

## Road Map

### What has been done

- Migrate all code to TypeScript with minimal change modification to the original logic.
- Bundle all code with vite's rollup build.
- Added a shim layer to be backward compatible with the existing extension system. <https://github.com/huchenlei/ComfyUI_frontend/pull/15>
- Front-end dev server.
- Zod schema for input validation on ComfyUI workflow.
- Make litegraph a npm dependency. <https://github.com/Comfy-Org/ComfyUI_frontend/pull/89>
- Introduce Vue to start managing part of the UI.

  - Starting with node search box revamp ![image](https://github.com/user-attachments/assets/ef6ce019-5194-4e55-9f1e-91440e473920)

- Easy install and version management (<https://github.com/comfyanonymous/ComfyUI/pull/3897>).


### What to be done

- Replace the existing ComfyUI front-end impl
- Remove `@ts-ignore`s.
- Turn on `strict` on `tsconfig.json`.
- Introduce a UI library to add more widget types for node developers.
- LLM streaming node.
- Linear mode (Similar to InvokeAI's linear mode).
- Better node management. Sherlock https://github.com/Nuked88/ComfyUI-N-Sidebar.
- Keybinding settings management. Register keybindings API for custom nodes.
- New extensions API for adding UI-related features.

## Development

### Git pre-commit hooks

Run `npm run prepare` to install Git pre-commit hooks. Currently, the pre-commit
hook is used to auto-format code on commit.

### Dev Server

Note: The dev server will NOT load any extension from the ComfyUI server. Only
core extensions will be loaded.

- Run `npm install` to install the necessary packages
- Start local ComfyUI backend at `localhost:8188`
- Run `npm run dev` to start the dev server

### Test

- `git clone https://github.com/comfyanonymous/ComfyUI_examples.git` to `tests-ui/ComfyUI_examples` or the EXAMPLE_REPO_PATH location specified in .env
- `npm i` to install all dependencies
- `npm run test:generate` to fetch `tests-ui/data/object_info.json`
- `npm run test:generate:examples` to extract the example workflows
- `npm run test` to execute all unit tests.

## Deploy

- Option 1: Set `DEPLOY_COMFYUI_DIR` in `.env` and run `npm run deploy`.
- Option 2: Copy everything under `dist/` to `ComfyUI/web/` in your ComfyUI checkout manually.

## Breaking changes

- api.api_url now adds a prefix `api/` to every url going through the method. If the custom node registers a new api endpoint but does not offer the `api/` prefixed alt endpoint, it will have issue. Luckily there aren't many extensions that do that. We can perform an audit before launching to resolve this issue.
