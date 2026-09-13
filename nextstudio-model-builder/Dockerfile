FROM python:3.10-slim@sha256:49c049dcc8ccfaadffc10c85c2b0e6df298c4adfa3328ce78ad4b2eefabec4bc

# Ensure deterministic builds
ENV PYTHONHASHSEED=0
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV CUDA_VISIBLE_DEVICES=""
ENV OMP_NUM_THREADS=1
ENV NEXTSTUDIO_MODEL_PYTHON=python3
ENV NEXTSTUDIO_TFJS_CONVERTER=tensorflowjs_converter

WORKDIR /builder

# Install Node.js for TFJS validation
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.lock /builder/
RUN pip install --no-cache-dir -r requirements.lock

COPY package.json package-lock.json /builder/
RUN npm ci --omit=dev

# Source and scripts mounted at runtime
CMD ["bash", "scripts/build.sh"]
