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
container. Playwright runs from `/app` so local performance results in the
checkout do not affect teardown. The fallback server uses a separate base
directory and stops before the checkout server starts. Python assertions stay
enabled even if the image sets `PYTHONOPTIMIZE`. Failed checks print the
backend logs.

`.github/workflows/ci-container.yaml` builds and validates candidates when
this directory, that workflow, `package.json`, `pnpm-lock.yaml`,
`pnpm-workspace.yaml`, or `.nvmrc` changes. Dependency changes rebuild the image
to catch Node and Playwright incompatibilities; ordinary frontend source changes
do not. The workflow has read-only repository access and does not log in to a
registry.

## Runtime contract

The Dockerfile verifies the ComfyUI release tag against `COMFYUI_COMMIT` and
pins the Playwright release tag. Update `COMFYUI_VERSION` and `COMFYUI_COMMIT`
together when upgrading the backend. It supplies Python 3.12, CPU PyTorch,
Node 26.10.0, Corepack 0.36.0, fonts, and `wait-for-it`.
The supported release platform is Linux amd64. The Python lock targets that
platform; arm64 builds fail before dependency installation.
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

## Update Python dependencies

`requirements.lock` pins the backend's transitive Python dependencies and CPU
PyTorch wheels with hashes. Installation rejects unlisted wheel bytes and
checks dependency compatibility. The initial lock preserves the validated
candidate's installed versions. Base image tags and apt packages still float,
so this is not a byte-reproducible image build.

Use uv 0.12.9 to regenerate the lock from the Dockerfile's `COMFYUI_COMMIT`:

```bash
bash tools/ci-container/lock.sh
```

The command retains existing pins where compatible. To upgrade one dependency,
pass `--upgrade-package NAME`; use `--upgrade` for a full refresh. Review the
lock diff, then rebuild and run the candidate validator. Backend upgrades must
update the lock in the same PR.

## Activate monorepo publishing

Publishing is disabled until a repository administrator sets
`CI_CONTAINER_PUBLISH_ENABLED=true`. Merging the workflow does not enable it.
The handover requires approval separate from merging this code:

1. In the existing GHCR package's **Manage Actions access**, grant
   `Comfy-Org/ComfyUI_frontend` write access. Preserve its private visibility and
   existing pull access. Linking the package to this repository alone does
   not grant its `GITHUB_TOKEN` permission to publish.
2. Disable `build-and-push.yml` in `Comfy-Org/comfyui-ci-container`. Wait for
   every queued or running publisher to finish. Do not enable both publishers.
3. Verify that `VERSION` is unused in GHCR and greater than its latest release.
   The proposed first version is `0.0.28`; bump it if the old publisher has
   used that version before cutover.
4. Set the opt-in variable. Run **Publish CI container** on `main`.
5. Check the run summary's digest, the `ci-container/v<VERSION>` source tag,
   and authenticated pulls of both the new version and `0.0.27` using existing
   consumer credentials. Confirm the image
   remains Linux amd64 and all six compatibility aliases point to its digest.

Future releases use a reviewed PR that increments `tools/ci-container/VERSION`.
The main push triggers publication. Other frontend changes do not publish an
image. The publisher validates the local image, uploads its version, pulls and
validates its digest, then creates an annotated source tag containing that
digest. It creates no GitHub Release and does not change frontend versions.

## Recover an interrupted release

Run the workflow on `main` with the original release's full commit SHA:

```bash
gh workflow run publish-ci-container.yaml \
  --repo Comfy-Org/ComfyUI_frontend --ref main -f revision=FULL_RELEASE_COMMIT_SHA
```

Recovery uses the current main publisher with the requested commit's image
source and validator, so publisher fixes apply to interrupted releases.
An existing version is pulled by digest and revalidated without rebuilding or
pushing the version again. Its source, revision, and version labels must match.
The source tag must match that commit and digest. Missing alias updates resume
from the same digest; a partial update is safe to repeat. The registry's manifest
endpoint determines version existence; delayed GitHub package metadata cannot
trigger a rebuild. Authentication and registry errors stop the run.

After an uncertain upload result, inspect GHCR before rerunning. If a newer
version exists, recovery refuses to move aliases backwards. If the image or
source tag conflicts, investigate rather than delete or overwrite it; publish
a new version when a rebuild is needed. To pause releases, set
`CI_CONTAINER_PUBLISH_ENABLED=false` and let the active run finish.

Publishing and consumer adoption remain separate stages of
[FE-3237](https://linear.app/comfyorg/issue/FE-3237). Existing consumers still use
`ghcr.io/comfy-org/comfyui-ci-container:0.0.27`. Changing the updater to discover
monorepo source tags, updating consumers, and archiving the old repository
belong to FE-3240. Keep the old package versions available for rollback.
