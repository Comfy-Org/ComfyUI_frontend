# ComfyUI CI container

This directory builds the backend and browser environment for frontend tests.
It is tooling source, not a pnpm package. Candidate validation does not publish
images or change the image used by existing CI jobs.

## Source and license

The Dockerfile is based on
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
checks writable runtime directories, Node engine and Playwright version
compatibility, CPU quantization, node registration, and served template and
documentation bytes.
Both the checkout frontend and the bundled fallback frontend must work.
Firefox and WebKit open the checkout frontend. The existing
`setupApiUrl.spec.ts` exercises the real devtools settings endpoint in Chromium.
The checkout is mounted read-only; test output stays inside the disposable
container. Failed checks print the backend logs.

`.github/workflows/ci-container.yaml` builds and validates candidates when
this directory or that workflow changes. Ordinary frontend changes do not
rebuild the image. The workflow has read-only repository access and does not
log in to a registry.

## Runtime contract

The Dockerfile pins ComfyUI and Playwright. It supplies Python 3.12, CPU
PyTorch, Node 26.10.0, Corepack, fonts, and `wait-for-it`.
ComfyUI lives at `/ComfyUI`, the Python environment at `/opt/venv`, and the
default working directory is `/app`. The image runs as `pwuser`.

Node installs directly from the official release archive, verified against
committed SHA-256 checksums for amd64 and arm64 before extraction. Update
`NODE_VERSION` and both checksums together using the release's
[SHASUMS256.txt](https://nodejs.org/dist/v26.10.0/SHASUMS256.txt).
The image has no version manager. GitHub jobs use `actions/setup-node` with
`.nvmrc`; offline runs use the image's pinned Node.

CI consumers provide the checkout's frontend build through `--front-end-root`.
The local E2E launcher uses the bundled frontend instead. Consumers copy or
mount `tools/devtools/` at `/ComfyUI/custom_nodes/ComfyUI_devtools`.
The image does not bake in the checkout frontend or devtools.

## Image size and retained dependencies

The optimized image measured 1.93 GB of compressed OCI layers, down from
3.04 GB for the unchanged import. Uncompressed layers fell from 7.87 GB to
4.93 GB. Docker's containerd image store reported 10.91 GB and 6.85 GB
respectively because it stores both representations. These are local Linux
amd64 measurements, not registry download measurements.

| Candidate cut                 | Decision and evidence                                                                                                                                                                                 |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Recursive ownership change    | Use `COPY --chown`; avoids copying 2.45 GB into a second layer. Writable-directory checks pass.                                                                                                       |
| Python bytecode               | Remove before the runtime copy. Saves 260 MB of files; two fresh-container starts took about 22 seconds versus 10–12 seconds with bytecode. Python recreates caches at runtime.                       |
| Kitchen CUDA and HIP binaries | Remove the two `_C.abi3.so` files, totaling 172 MB. CPU quantization and dequantization pass without them. Python fallback modules remain.                                                            |
| Backend `.git`                | Remove before the runtime copy. The backend version and all 827 node definitions match the baseline. Backend self-updating is not supported in this pinned image.                                     |
| Template media                | Keep. Removing even one media bundle makes all `/templates` requests return 404, including workflow JSON.                                                                                             |
| Embedded docs                 | Keep. Removing the package makes `/docs/KSampler/en.md` return 404.                                                                                                                                   |
| Bundled frontend              | Keep. Without it, the local E2E launch command exits with code 255 before serving requests.                                                                                                           |
| WebKit                        | Keep. The `mobile-safari` CI project uses it.                                                                                                                                                         |
| Firefox                       | Keep the official Playwright base intact. Firefox has no current CI project, but deleting inherited files adds a layer without reducing image size. Omitting it requires rebuilding the browser base. |

Pruning happens in the builder so removed files never enter runtime layers.
All 40,549 retained regular files in `/ComfyUI` and `/opt/venv` matched the
baseline byte-for-byte. A model-free `EmptyImage` → `SaveImage` prompt also
produced the expected image dimensions and RGB pixels in both images.

Some build dependencies float, so rebuilding the same Dockerfile can produce
different output. Validation prints the Python dependency versions and tests
the resulting image. This import does not upgrade the backend or browsers.

Publishing and adoption remain separate work under
[FE-3237](https://linear.app/comfyorg/issue/FE-3237). Existing consumers continue
to use `ghcr.io/comfy-org/comfyui-ci-container:0.0.27`.
