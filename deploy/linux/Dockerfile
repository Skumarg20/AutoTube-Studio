# AutoTube Studio on a Linux server (Ubuntu + Docker), no sudo needed after Docker itself.
# ffmpeg: a static 7.x build in /usr/local/bin wins over Debian's 5.1, whose aresample->alimiter step in the library's
# mux.sh fails ("Cannot select channel layout"). The image holds only system tools (Node, ffmpeg, Python, Chromium for rendering, fonts, cloudflared).
# The studio, the Lemo Opuscar library, the Python venv, the Claude login and all data live in the user's
# home folder, mounted at the same path (see deploy/linux/studio.sh), so nothing is lost when the image is rebuilt.
FROM node:24-bookworm

ENV DEBIAN_FRONTEND=noninteractive PLAYWRIGHT_BROWSERS_PATH=/ms-playwright TZ=Asia/Kolkata LANG=C.UTF-8 PYTHONIOENCODING=utf-8

RUN apt-get update && apt-get install -y --no-install-recommends \
      ffmpeg python3 python3-venv python3-dev build-essential espeak-ng libsndfile1 \
      fonts-noto-core fonts-noto-ui-core fonts-noto-color-emoji fonts-noto-cjk fonts-dejavu-core fontconfig \
      tzdata curl ca-certificates git tini procps \
 && ln -sf /usr/share/zoneinfo/$TZ /etc/localtime \
 && npx -y playwright-core@1.63.0 install --with-deps chromium \
 && chmod -R a+rX /ms-playwright \
 && curl -fsSL -o /tmp/cf.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb \
 && dpkg -i /tmp/cf.deb && rm /tmp/cf.deb \
 && curl -fsSL -o /tmp/ff.tar.xz https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz \
 && tar xf /tmp/ff.tar.xz -C /tmp && cp /tmp/ffmpeg-*-static/ffmpeg /tmp/ffmpeg-*-static/ffprobe /usr/local/bin/ && rm -rf /tmp/ff* \
 && rm -rf /var/lib/apt/lists/* /root/.npm

# the server user (same uid/gid as on the host, so files in the mounted home keep their owner)
ARG UID=1001
ARG GID=1001
ARG USERNAME=sanjeev_6346
RUN groupadd -g $GID $USERNAME && useradd -u $UID -g $GID -d /home/$USERNAME -M -s /bin/bash $USERNAME

ENTRYPOINT ["/usr/bin/tini", "--"]
