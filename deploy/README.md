# Deploy vibeTouHou on CSIE Workstations

Steps:

1. [Ensure rootless Docker is installed](#ensure-rootless-docker-is-installed)
2. [Build renderer sandbox environment](#build-renderer-sandbox-environment)
3. [Build & start server with Docker Compose](#build--start-server-with-docker-compose)
4. [Configuration in `docker-compose.yml`](#configuration-in-docker-composeyml)

## Ensure system features are enabled

> [!NOTE]
> Make sure this is done on each new workstation that you have not set up Docker.
> **If the `docker.service` systemd service fails to start, this is likely why!**

```bash
# Enable system features
linger-switch enable
subuid-register
```

Doing this does nothing if it is already set up; so feel free to do it, nothing wrong would happen.

## Ensure rootless Docker is installed

After installation, you should be able to run these commands (without `sudo`):

```bash
docker version
docker compose version
```

Installation steps (reference: [NASA Lab](https://nasalab.csie.ntu.edu.tw/workstation/docker_tutorial.html), [Docker Compose Docs](https://docs.docker.com/compose/install/linux/#install-the-plugin-manually)):

```bash
# Enable system features (if you haven't)
linger-switch enable
subuid-register

# Download and start installation automatically (binaries go to $HOME/bin)
curl -fsSL https://get.docker.com/rootless | sh

# Add required environment variables
echo "export PATH=$HOME/bin:\$PATH" >> $HOME/.bashrc
echo "export DOCKER_HOST=unix:///run/user/$UID/docker.sock" >> $HOME/.bashrc

# Use /tmp2 for Docker data (more space available)
mkdir -p $HOME/.config/docker
echo "{ \"data-root\": \"/tmp2/$(whoami)/docker\" }" >> $HOME/.config/docker/daemon.json
systemctl --user daemon-reload
systemctl --user restart docker

# Install Docker Compose
DOCKER_CONFIG=${DOCKER_CONFIG:-$HOME/.docker}
mkdir -p $DOCKER_CONFIG/cli-plugins
curl -SL https://github.com/docker/compose/releases/download/v5.1.2/docker-compose-linux-x86_64 -o $DOCKER_CONFIG/cli-plugins/docker-compose
chmod +x $DOCKER_CONFIG/cli-plugins/docker-compose

# Verify installation
docker version
docker compose version
```

## Build renderer sandbox environment

Go to `vibeTouHou/server/` and run:

```bash
docker build -f Dockerfile.sandbox -t vibetouhou-sandbox .
```

This creates a Docker image tagged `vibetouhou-sandbox`.

## Build & start server with Docker Compose

Go to `vibeTouHou/` and build:

```bash
docker compose build
```

Docker Compose will automatically locate the server Dockerfile. Then, start the stack:

```bash
docker compose up -d
```

> [!NOTE]
> `docker compose up` builds the image automatically if it hasn't been built yet,
> so the explicit `build` step is optional on the first run.
>
> However, if the code changes (e.g. after a `git pull`), you **must** manually rebuild
> the image - otherwise Docker Compose will keep using the stale image with old code.

To view logs:

```bash
docker compose logs
```

And, to stop the stack:

```bash
docker compose down
```

## Configuration in `docker-compose.yml`

### Team / admin tokens

The Python backend reads tokens from the environment, which is set up by Docker using, in our case, the `docker-compose.yml` file.
By default, no value is set and the server will error because of it.

Docker Compose reads the values from the host environment, so you can set the variables in a `.env` file locally along side the compose configuration.

```bash
# .env file - keep secret!
RED_TEAM_TOKEN=red_token_123
BLUE_TEAM_TOKEN=blue_token_456
ADMIN_TOKEN=admin_token_789
```

### Build-time base path

During build time, we can set the `ROOT_PATH` environment variable to make sure Vite has the asset base paths direct to the correct endpoints.
Additionally, the server will also be configured to listen on the path prefix it specifies.

```bash
# beside your TEAM_TOKEN's
ROOT_PATH=/vibetouhou
```

Note that you do need to re-build the Docker image to apply the change:

```sh
docker compose build
docker compose up -d
```
