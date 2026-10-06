# ComfyUI CI container

This directory builds the backend and browser environment for frontend tests.
It is tooling source, not a pnpm package. Candidate validation does not publish
images or change the image used by existing CI jobs.

## Source and license

The Dockerfile is imported unchanged from
[Comfy-Org/comfyui-ci-container v0.0.27](https://github.com/Comfy-Org/comfyui-ci-container/tree/v0.0.27),
commit [aa8ea6d](https://github.com/Comfy-Org/comfyui-ci-container/commit/aa8ea6d700f2c93915d6572f6e50f822ebf659ef).
The upstream repository did not declare a license. Comfy-Org authorized this
import under the monorepo's [GPL-3.0-only license](../../LICENSE) in the
[migration discussion](https://ampcode.com/threads/T-01a10dc2-f39a-7468-8c86-1c11de4d8070).
Bundled dependencies retain their own licenses.

## Validate a candidate

Use a Linux checkout with dependencies installed through
`pnpm install --frozen-lockfile`, a frontend build in `dist/`, and a running
Docker daemon. The checkout and its dependencies must be readable by the
image's `pwuser`. Allow at least 25 GB of free disk for the image and build
cache. The CI job removes the runner's unused Android and .NET SDKs first.

From the repository root:

```bash
docker build --tag comfyui-ci-container:candidate tools/ci-container
bash tools/ci-container/validate.sh
```

Pass another local image tag as the script's first argument to test it.
The script runs without external network access or a root-user override. It
checks writable runtime directories, Playwright version compatibility, and
the served frontend and devtools files. The existing `setupApiUrl.spec.ts`
then opens the frontend and exercises the real devtools settings endpoint.
The checkout is mounted read-only; test output stays inside the disposable
container. Failed checks print the backend log.

`.github/workflows/ci-container.yaml` builds and validates candidates when
this directory or that workflow changes. Ordinary frontend changes do not
rebuild the image. The workflow has read-only repository access and does not
log in to a registry.

## Runtime contract

The Dockerfile pins ComfyUI and Playwright. It supplies Python 3.12, CPU
PyTorch, Node 26 through fnm, Corepack, fonts, and `wait-for-it`.
ComfyUI lives at `/ComfyUI`, the Python environment at `/opt/venv`, and the
default working directory is `/app`. The image runs as `pwuser`.

Consumers provide the checkout's frontend build through `--front-end-root`
and copy or mount `tools/devtools/` at
`/ComfyUI/custom_nodes/ComfyUI_devtools`. The image does not bake in either.

Some build dependencies float, so rebuilding the same Dockerfile can produce
different output. Validation prints the Python dependency versions and tests
the resulting image. This import does not upgrade the backend or browsers.

Publishing and adoption remain separate work under
[FE-3237](https://linear.app/comfyorg/issue/FE-3237). Existing consumers continue
to use `ghcr.io/comfy-org/comfyui-ci-container:0.0.27`.
