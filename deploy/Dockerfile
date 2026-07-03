FROM node:20-alpine AS client-build
WORKDIR /src
ARG VITE_BASE_PATH=/
ARG VITE_API_BASE=/api
ENV VITE_BASE_PATH=$VITE_BASE_PATH
ENV VITE_API_BASE=$VITE_API_BASE
COPY client/package*.json ./client/
RUN cd client && npm ci
COPY client ./client
COPY server ./server
RUN cd client && npm run build

FROM python:3.11-slim AS runtime
WORKDIR /app/server

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libsdl2-2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY server/requirements.txt /tmp/requirements.txt
RUN python -m pip install --upgrade pip && pip install -r /tmp/requirements.txt

COPY --from=client-build /src/server /app/server

ARG ROOT_PATH=
RUN python -c "import os; root = os.environ.get('ROOT_PATH', ''); open('/app/server/_build_config.py', 'w').write(f'ROOT_PATH = \"{root}\"\nAPI_PREFIX = \"{root}/api\"\n')"

ENV PYTHONUNBUFFERED=1
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
