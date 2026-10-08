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

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      ca-certificates curl zstd \
      fonts-dejavu-core fonts-noto-core fonts-noto-cjk fonts-ubuntu && \
    rm -rf /var/lib/apt/lists/*

ARG NODE_VERSION=26.10.0
RUN case "$(dpkg --print-architecture)" in \
      amd64) arch=x64; sha256=cb5c9ce9c80d7b8821e3a258543c71b939138cf17c74d5cc44bbe85d6dbc5ad8 ;; \
      arm64) arch=arm64; sha256=423a41bff8e2a2fa15e702fefe2919ef95823b2378744daccb8439302534b44f ;; \
      *) echo 'Unsupported Node architecture' >&2; exit 1 ;; \
    esac && \
    curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-${arch}.tar.gz" \
      -o /tmp/node.tar.gz && \
    echo "${sha256}  /tmp/node.tar.gz" > /tmp/node.sha256 && \
    sha256sum --check --strict /tmp/node.sha256 && \
    tar -xzf /tmp/node.tar.gz -C /usr/local --strip-components=1 --no-same-owner && \
    rm /tmp/node.tar.gz /tmp/node.sha256 && \
    npm i -g corepack@latest && corepack enable

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
