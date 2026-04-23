# Production Reverse Proxy

Run the FastAPI app on `127.0.0.1:8000`, then place nginx in front of it with
`deploy/nginx.conf`.

Recommended backend command:

```bash
cd server
uvicorn main:app --host 127.0.0.1 --port 8000 --proxy-headers
```

The proxy keeps all SPA routes on the backend, forwards `/api/*`, allows image
uploads up to 16 MB, and disables proxy buffering for MP4 responses so browsers
can use byte-range playback instead of downloading full videos before seeking.

Docker Compose production-like run:

```bash
docker compose up --build -d
```

This starts:
- `api`: FastAPI with built frontend assets served from `server/static`
- `nginx`: reverse proxy on `http://localhost`

Notes:
- `./data` is mounted for persistence.
- `/var/run/docker.sock` is mounted so render sandbox jobs can use Docker from inside the API container.
