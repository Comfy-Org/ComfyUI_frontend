FROM node:lts AS frontend-builder

# Set working directory for frontend build
WORKDIR /app/ComfyUI_frontend

# Copy package files first for better layer caching
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build with increased memory
RUN NODE_OPTIONS="--max-old-space-size=4096" npm run build

FROM python:3.10-slim

# Install system dependencies including OpenMP for PyTorch
RUN apt-get update && apt-get install -y \
    git \
    curl \
    libgomp1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgl1-mesa-glx \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Clone ComfyUI repository
RUN git clone --branch master https://github.com/comfyanonymous/ComfyUI.git

# Clone ComfyUI_devtools
RUN git clone --branch main https://github.com/Comfy-Org/ComfyUI_devtools.git ComfyUI/custom_nodes/ComfyUI_devtools

# Set working directory to ComfyUI
WORKDIR /app/ComfyUI

# Upgrade pip and install Python requirements
RUN python -m pip install --upgrade pip && \
    pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu && \
    pip install -r requirements.txt && \
    pip install wait-for-it

# Copy built frontend from previous stage
COPY --from=frontend-builder /app/ComfyUI_frontend/dist /app/ComfyUI_frontend/dist

# Expose ComfyUI default port
EXPOSE 8188

# Environment variables for configuration
ENV EXTRA_SERVER_PARAMS=""

# Start ComfyUI server
CMD python main.py --cpu --multi-user --listen 0.0.0.0 --front-end-root /app/ComfyUI_frontend/dist ${EXTRA_SERVER_PARAMS}