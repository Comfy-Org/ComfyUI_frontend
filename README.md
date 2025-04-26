<div align="center">

# ComfyUI_frontend

**Official front-end implementation of [ComfyUI](https://github.com/comfyanonymous/ComfyUI).**

[![Website][website-shield]][website-url]
[![Discord][discord-shield]][discord-url]
[![Matrix][matrix-shield]][matrix-url]
<br>
[![][github-release-shield]][github-release-link]
[![][github-release-date-shield]][github-release-link]
[![][github-downloads-shield]][github-downloads-link]
[![][github-downloads-latest-shield]][github-downloads-link]


[github-release-shield]: https://img.shields.io/github/v/release/Comfy-Org/ComfyUI_frontend?style=flat&sort=semver
[github-release-link]: https://github.com/Comfy-Org/ComfyUI_frontend/releases
[github-release-date-shield]: https://img.shields.io/github/release-date/Comfy-Org/ComfyUI_frontend?style=flat
[github-downloads-shield]: https://img.shields.io/github/downloads/Comfy-Org/ComfyUI_frontend/total?style=flat
[github-downloads-latest-shield]: https://img.shields.io/github/downloads/Comfy-Org/ComfyUI_frontend/latest/total?style=flat&label=downloads%40latest
[github-downloads-link]: https://github.com/Comfy-Org/ComfyUI_frontend/releases
[matrix-shield]: https://img.shields.io/badge/Matrix-000000?style=flat&logo=matrix&logoColor=white
[matrix-url]: https://app.element.io/#/room/%23comfyui_space%3Amatrix.org
[website-shield]: https://img.shields.io/badge/ComfyOrg-4285F4?style=flat
[website-url]: https://www.comfy.org/
[discord-shield]: https://img.shields.io/discord/1218270712402415686?style=flat&logo=discord&logoColor=white&label=Discord
[discord-url]: https://www.comfy.org/discord

</div>

## Release Schedule

The project follows a structured release process for each minor version, consisting of three distinct phases:

1. **Development Phase** - 1 week
   - Active development of new features
   - Code changes merged to the development branch

2. **Feature Freeze** - 1 week
   - No new features accepted
   - Only bug fixes are cherry-picked to the release branch
   - Testing and stabilization of the codebase

3. **Publication**
   - Release is published at the end of the freeze period
   - Version is finalized and made available to all users

### Nightly Releases
Nightly releases are published daily at [https://github.com/Comfy-Org/ComfyUI_frontend/releases](https://github.com/Comfy-Org/ComfyUI_frontend/releases).

To use the latest nightly release, add the following command line argument to your ComfyUI launch script:

```bat
--front-end-version Comfy-Org/ComfyUI_frontend@latest
```

## Overlapping Release Cycles
The development of successive minor versions overlaps. For example, while version 1.1 is in feature freeze, development for version 1.2 begins simultaneously.

### Example Release Cycle

| Week | Date Range | Version 1.1 | Version 1.2 | Version 1.3 | Patch Releases |
|------|------------|-------------|-------------|-------------|----------------|
| 1 | Mar 1-7 | Development | - | - | - |
| 2 | Mar 8-14 | Feature Freeze | Development | - | 1.1.0 through 1.1.6 (daily) |
| 3 | Mar 15-21 | Released | Feature Freeze | Development | 1.1.7 through 1.1.13 (daily)<br>1.2.0 through 1.2.6 (daily) |
| 4 | Mar 22-28 | - | Released | Feature Freeze | 1.2.7 through 1.2.13 (daily)<br>1.3.0 through 1.3.6 (daily) |

## Contributing

We're building this frontend together and would love your help — no matter how you'd like to pitch in! You don't need to write code to make a difference.

Here are some ways to get involved:

- **Pull Requests:** Add features, fix bugs, or improve code health. Browse [issues](https://github.com/Comfy-Org/ComfyUI_frontend/issues) for inspiration.
- **Vote on Features:** Give a 👍 to the feature requests you care about to help us prioritize.
- **Verify Bugs:** Try reproducing reported issues and share your results (even if the bug doesn't occur!).
- **Community Support:** Hop into our [Discord](https://www.comfy.org/discord) to answer questions or get help.
- **Share & Advocate:** Tell your friends, tweet about us, or share tips to support the project.

Have another idea? Drop into Discord or open an issue, and let's chat!

## Development

### Tech Stack

- [Vue 3](https://vuejs.org/) with [TypeScript](https://www.typescriptlang.org/)
- [Pinia](https://pinia.vuejs.org/) for state management
- [PrimeVue](https://primevue.org/) with [TailwindCSS](https://tailwindcss.com/) for UI
- [litegraph.js](https://github.com/Comfy-Org/litegraph.js) for node editor
- [zod](https://zod.dev/) for schema validation
- [vue-i18n](https://github.com/intlify/vue-i18n) for internationalization

### Git pre-commit hooks

Run `npm run prepare` to install Git pre-commit hooks. Currently, the pre-commit
hook is used to auto-format code on commit.

### Dev Server

Note: The dev server will NOT load any extension from the ComfyUI server. Only
core extensions will be loaded.

- Start local ComfyUI backend at `localhost:8188`
- Run `npm run dev` to start the dev server
- Run `npm run dev:electron` to start the dev server with electron API mocked

#### Access dev server on touch devices

Enable remote access to the dev server by setting `VITE_REMOTE_DEV` in `.env` to `true`.

After you start the dev server, you should see following logs:

```
> comfyui-frontend@1.3.42 dev
> vite


  VITE v5.4.6  ready in 488 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: http://172.21.80.1:5173/
  ➜  Network: http://192.168.2.20:5173/
  ➜  press h + enter to show help
```

Make sure your desktop machine and touch device are on the same network. On your touch device,
navigate to `http://<server_ip>:5173` (e.g. `http://192.168.2.20:5173` here), to access the ComfyUI frontend.

### Recommended Code Editor Configuration

This project includes `.vscode/launch.json.default` and `.vscode/settings.json.default` files with recommended launch and workspace settings for editors that use the `.vscode` directory (e.g., VS Code, Cursor, etc.).

We’ve also included a list of recommended extensions in `.vscode/extensions.json`. Your editor should detect this file and show a human friendly list in the Extensions panel, linking each entry to its marketplace page.

### Unit Test

- `npm i` to install all dependencies
- `npm run test:unit` to execute all unit tests.

### Component Test

Component test verifies Vue components in `src/components/`.

- `npm run test:component` to execute all component tests.

### Playwright Test

Playwright test verifies the whole app. See <https://github.com/Comfy-Org/ComfyUI_frontend/blob/main/browser_tests/README.md> for details.

### litegraph.js

This repo is using litegraph package hosted on <https://github.com/Comfy-Org/litegraph.js>. Any changes to litegraph should be submitted in that repo instead.

#### Test litegraph.js changes

- Run `npm link` in the local litegraph repo.
- Run `npm link @comfyorg/litegraph` in this repo.

This will replace the litegraph package in this repo with the local litegraph repo.

### i18n

See [locales/README.md](src/locales/README.md) for details.
