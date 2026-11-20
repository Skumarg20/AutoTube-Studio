#!/bin/sh
# AutoTube Studio on a Linux server, in Docker. Run from anywhere as the server user (no sudo):
#   sh studio.sh build    build the image (system tools only; once, or after a Dockerfile change)
#   sh studio.sh setup    install Node packages + the Python voice/sound tools into the home folder (once, or after an update)
#   sh studio.sh start    start the studio (restarts by itself after a crash or a reboot)
#   sh studio.sh stop | restart | status | logs | shell | doctor
# Settings: <studio>/config/.env (PORT, HS_TEST_MODE, HS_TUNNEL, keys). Claude: the server user's own `claude` login.
set -e
NAME=${AUTOTUBE_NAME:-autotube-studio}
BASE=${AUTOTUBE_HOME:-$HOME/autotube}
STUDIO=$BASE/studio
LEMO=$BASE/lemo
IMAGE=autotube-studio:latest
PORT=$(grep -E '^PORT=' "$STUDIO/config/.env" 2>/dev/null | tail -1 | cut -d= -f2 | tr -d '\r ')
PORT=${PORT:-4747}
# sites hosted on THIS server (e.g. the company KB behind its Caddy) are reached through the host, not the public IP
LOCAL_HOSTS=$(grep -E '^AUTOTUBE_LOCAL_HOSTS=' "$STUDIO/config/.env" 2>/dev/null | tail -1 | cut -d= -f2 | tr -d '\r')
ADD_HOSTS=$(for h in $LOCAL_HOSTS; do printf -- '--add-host %s:host-gateway ' "$h"; done)

in_box() {   # run a command inside a throw-away container with the same mounts
  docker run --rm -i --user "$(id -u):$(id -g)" -e HOME="$HOME" -e PATH="$HOME/.local/bin:/usr/local/bin:/usr/bin:/bin" \
    -e PLAYWRIGHT_BROWSERS_PATH=/ms-playwright -v "$HOME:$HOME" -w "$1" "$IMAGE" sh -c "$2"
}

case "$1" in
  build)
    docker build --build-arg UID="$(id -u)" --build-arg GID="$(id -g)" --build-arg USERNAME="$(id -un)" -t "$IMAGE" "$STUDIO/deploy/linux" ;;
  setup)
    in_box "$STUDIO" 'npm install --omit=dev --no-audit --no-fund'
    in_box "$LEMO" 'npm install --omit=dev --no-audit --no-fund'
    in_box "$LEMO" 'test -x .venv/bin/python || python3 -m venv .venv; .venv/bin/python -m pip install -q --upgrade pip; .venv/bin/python -m pip install -q -r requirements.txt -r requirements-voice.txt $(test -f requirements-music.txt && echo -r requirements-music.txt)'
    in_box "$LEMO" 'test -f core/tts/kokoro-v1.0.onnx && echo "voice model: ok" || echo "voice model MISSING: copy core/tts/kokoro-v1.0.onnx and voices-v1.0.bin"' ;;
  start)
    docker rm -f "$NAME" >/dev/null 2>&1 || true
    docker run -d --name "$NAME" --restart unless-stopped \
      --user "$(id -u):$(id -g)" -e HOME="$HOME" -e PATH="$HOME/.local/bin:/usr/local/bin:/usr/bin:/bin" \
      -e TZ=Asia/Kolkata -e HS_LIBRARY="$LEMO" -e HS_HOST=0.0.0.0 -e PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
      -v "$HOME:$HOME" -w "$STUDIO" -p "$PORT:$PORT" $ADD_HOSTS \
      --cpus "${AUTOTUBE_CPUS:-10}" --memory "${AUTOTUBE_MEM:-20g}" --shm-size 2g \
      --log-opt max-size=20m --log-opt max-file=3 \
      "$IMAGE" node server.js
    echo "started $NAME on port $PORT" ;;
  stop) docker stop "$NAME" ;;
  restart) docker restart "$NAME" ;;
  status) docker ps -a --filter "name=^$NAME\$" --format '{{.Names}}  {{.Status}}  {{.Ports}}'; curl -s -o /dev/null -w "healthz: %{http_code}\n" "http://127.0.0.1:$PORT/healthz" || true ;;
  logs) docker logs --tail "${2:-80}" -f "$NAME" ;;
  shell) docker exec -it "$NAME" bash ;;
  doctor) docker exec "$NAME" node tools/doctor.js ;;
  *) sed -n '2,8p' "$0"; exit 1 ;;
esac
