# Stage 1: Build Python dependencies with uv (Python 3.12 pinned)
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim AS builder
ENV UV_LINK_MODE=copy UV_PYTHON_DOWNLOADS=0

ARG COMFYUI_VERSION=v0.30.0

# Clone ComfyUI
RUN apt-get update && apt-get install -y git && \
    git clone --depth 1 --branch ${COMFYUI_VERSION} \
    https://github.com/comfy-org/ComfyUI.git /ComfyUI

# Create venv and install all Python dependencies
ENV VIRTUAL_ENV=/opt/venv
RUN uv venv $VIRTUAL_ENV
RUN uv pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu && \
    uv pip install -r /ComfyUI/requirements.txt && \
    uv pip install wait-for-it

RUN rm -rf /ComfyUI/.git && \
    rm /opt/venv/lib/python3.12/site-packages/comfy_kitchen/backends/cuda/_C.abi3.so \
       /opt/venv/lib/python3.12/site-packages/comfy_kitchen/backends/hip/_C.abi3.so && \
    find /opt/venv -name '*.pyc' -delete

# Stage 2: Final image with Playwright
FROM mcr.microsoft.com/playwright:v1.63.0-noble

# Install fonts to match GitHub Actions runner (curl/unzip needed by the fnm installer)
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      ca-certificates curl unzip zstd \
      fonts-dejavu-core fonts-noto-core fonts-noto-cjk fonts-ubuntu && \
    rm -rf /var/lib/apt/lists/*

# Node follows the caller's .nvmrc via fnm (26 pre-installed as the offline
# default; .nvmrc wins at runtime via `fnm use`). Corepack manages pnpm from the
# repo's packageManager field. Node 26 no longer bundles Corepack, so install it.
ENV FNM_DIR=/opt/fnm PATH="/opt/fnm/aliases/default/bin:$PATH"
RUN curl -fsSL https://fnm.vercel.app/install | bash -s -- --install-dir /usr/local/bin --skip-shell \
 && fnm install 26 && fnm default 26 \
 && npm i -g corepack@latest && corepack enable \
 && chmod -R a+w /opt/fnm

# Copy venv and ComfyUI from builder
COPY --from=builder --chown=pwuser:pwuser /opt/venv /opt/venv
COPY --from=builder --chown=pwuser:pwuser /ComfyUI /ComfyUI

# Fix venv Python symlinks to point to system Python (builder used /usr/local/bin/python)
RUN ln -sf /usr/bin/python3 /opt/venv/bin/python && \
    ln -sf python /opt/venv/bin/python3 && \
    ln -sf python /opt/venv/bin/python3.12

# Set up Python paths
ENV PATH="/opt/venv/bin:$PATH"
ENV VIRTUAL_ENV="/opt/venv"

# Create devtools directory (for mounting/copying at runtime)
RUN install -d -o pwuser -g pwuser /ComfyUI/custom_nodes/ComfyUI_devtools

# Set ownership for pwuser (from Playwright base image)
RUN install -d -o pwuser -g pwuser /app

USER pwuser
WORKDIR /app
