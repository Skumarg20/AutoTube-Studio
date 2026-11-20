# Deploying AutoTube Studio on a Windows VM

The studio runs on ONE machine. That machine writes the plans, makes the videos and uploads them.
Once the VM is live, stop the studio on the laptop (step 9), or every video is made and uploaded twice.

## Quick path: one package + one script (used for the VMMB server, 2026-11-14)
1. On the laptop: `powershell -ExecutionPolicy Bypass -File deploy\make-package.ps1`. It builds `Desktop\AutoTube-deploy\` with:
   - the studio with your data and unfinished videos
   - the library without its .venv, node_modules or the example films' media
   - `setup-server.ps1`
2. Copy that folder to the server's Desktop through Remote Desktop.
3. On the server, open PowerShell with **Run as administrator**, then:
   `cd $HOME\Desktop\AutoTube-deploy; powershell -ExecutionPolicy Bypass -File .\setup-server.ps1`
   It does everything below by itself:
   - sets the time zone and turns off sleep
   - installs VC++, Node, Git, Python 3.12, FFmpeg and Claude Code
   - unpacks the studio and the library, then installs npm, Chromium and the Python tools
   - asks you to sign in to Claude and to choose a dashboard password
   - runs the doctor check, installs auto-start, and opens the public link
4. Public link: a free Cloudflare link (`https://<words>.trycloudflare.com`). It is new on every restart. The current one is:
   - on the server desktop as **AutoTube Studio link**
   - in `data\public-url.txt`
   - in the log
   - at `/healthz` when opened on the server

   For a fixed domain later, put a Cloudflare tunnel token in `config\.env`.
5. Optional keys and settings live in `config\.env` (see `config\.env.example`): `ANTHROPIC_API_KEY`, `CLAUDE_MODEL`, `ELEVENLABS_API_KEY`, `HS_TUNNEL`, `CLOUDFLARE_TUNNEL_TOKEN`, `HS_PUBLIC_URL`, `PORT`, `HS_LIBRARY`, `PLAYWRIGHT_CHROME`. Leave `ANTHROPIC_API_KEY` empty to use the Claude terminal login.

## What the VM needs

| | Minimum | Recommended |
|---|---|---|
| Windows | 10/11 or Server 2019+ | 11 / Server 2022 |
| CPU / RAM | 4 cores / 8 GB (set `renderSlots` to 1) | 8+ cores / 16+ GB |
| Disk | 60 GB free | 150 GB+ (each long video ~1 GB; work files are cleaned 3 days after publishing) |
| Time zone | India Standard Time (publish times use it) | |

There is no GPU in most VMs. The renderer then draws in software, which is slower. Check the first long video's time.

## 1. Install the software (as the Windows user that will run the studio)
1. **Node.js 20+**: install from nodejs.org.
2. **Git for Windows**: install it to the default `C:\Program Files\Git`. The sound mix uses its bash.
3. **ffmpeg**: run `winget install Gyan.FFmpeg`, then open a new terminal and check that `ffmpeg -version` works.
4. **Python 3.12**: install from python.org.
5. **Claude Code**: install it, run `claude` once in a terminal and sign in with the same Claude account. This must be the same Windows user that runs the studio.

## 2. Copy the files from the laptop
Stop the studio on the laptop first (`deploy\stop-studio.ps1`) so nothing changes while you copy. Then copy:
- `C:\Users\<you>\autotube-studio`: the whole folder. `jobs\` is about 20 GB. You only need the job folders of videos that are not published yet, and you can skip the others.
- `C:\Users\<you>\lemo-opuscar-src\lemo-opuscar-main`: the render library, **without** its `.venv` folder (a copied .venv does not work on another PC).

### Or: a fresh install with no channels
Copy only the code (not `data\`, `config\`, `channels\`, `jobs\`). A fresh install starts empty and makes nothing on its own.
1. Open the dashboard. It shows **Welcome to AutoTube Studio** with an **Add your first channel** button.
2. Create a channel: name, what it is about, channel type (History documentaries or JEE/NEET), language, narrator voice, how many long videos and Shorts a day, and publish times.
3. Connect that channel's YouTube account (do this on the VM, see step 7), and add the ElevenLabs key in Settings if the voice needs it.
4. Make videos in either of two ways:
   - **Ideas**: give a prompt, then approve titles, plans and videos one by one.
   - **"Run on schedule"**: switch it on for the channel, and it plans its own topics every day. You still approve each step unless you change the channel's approvals setting.

Ideas and Make refuse to start until at least one channel exists.

## 3. Set up the render library (in the library folder)
```
npm install
npx playwright install chromium
py -3.12 -m venv .venv
.venv\Scripts\pip install -r requirements.txt -r requirements-voice.txt -r requirements-music.txt
```

## 4. Set up the studio (in the autotube-studio folder)
```
npm install
```
If the Windows username or the folder is different on the VM, set the library path in `config\settings.json`:
`"libraryPath": "C:\\Users\\<vm-user>\\lemo-opuscar-src\\lemo-opuscar-main"`
(or set the environment variable `HS_LIBRARY`).

## 5. Check everything
```
node tools\doctor.js
```
Fix every **FAIL**. Read each WARN.

## 6. Start it with Windows (PowerShell as administrator)
```
powershell -ExecutionPolicy Bypass -File deploy\install-autostart.ps1
```
- It starts at boot, even before anyone signs in, and runs as your user.
- It restarts the studio if it stops.
- It stops the VM from sleeping.

Each start also runs the doctor check, and the output goes into `data\server.log`.
- Stop: `deploy\stop-studio.ps1`
- Start: `Start-ScheduledTask AutoTubeStudio`
- Remove auto-start: `deploy\uninstall-autostart.ps1`

## 7. Sign in to YouTube / Instagram again
Open the dashboard **on the VM** (Remote Desktop → http://localhost:4747) → Settings → Connections, and press **Test** for each channel.

If a connection fails, connect it again there. Google returns to `http://127.0.0.1:4747`, so this sign-in only works in a browser on the VM itself.

**Important:** in Google Cloud Console → OAuth consent screen, the app must be **"In production"**, not "Testing". In Testing mode Google ends the YouTube sign-in every 7 days and uploads stop.

## 8. Opening the dashboard from your laptop or phone
Pick one way:
- **Remote Desktop**: no change needed. The dashboard opens only on the VM itself (the safest choice).
- **Tailscale (recommended for the phone)**:
  1. Install Tailscale on the VM and on your phone and laptop.
  2. On the VM, run `node tools\set-password.js` and restart the studio.
  3. Open `http://<vm-tailscale-name>:4747` and sign in.
- **Public internet**: only behind HTTPS, for example a Cloudflare Tunnel or a reverse proxy with a certificate, and with the password set. Never open port 4747 itself to the internet: plain http sends the password unencrypted.

How the password works:
- Only a scrypt hash of it is stored.
- 5 wrong tries lock that address for 15 minutes.
- A sign-in lasts 30 days.
- `node tools\set-password.js` changes it and signs every device out. Add `--off` to remove it.

## 9. The laptop
- Stop the studio on the laptop. If it started with Windows there, run `deploy\uninstall-autostart.ps1` on the laptop too.
- Optional: the laptop can help the VM render as a worker. On the VM, tick "Let PCs on my network make videos" in Settings and restart the studio, then allow port 4747 in the VM firewall for your network or Tailscale only. On the laptop, run the worker command shown there.

## What runs by itself in production
- **Claude usage limit**: when the 5-hour or weekly limit is hit, videos pause and continue after the reset time ("resets 1am"). They no longer fail. The VM and your own Claude use on the laptop share the same limit.
- **Backups**: once a day, `data\db.json`, `config\`, the channel sign-ins and the YouTube tokens are copied to `data\backups\<date>`. The last 14 days are kept.
- **Disk**: 3 days after a video is published or rejected, its `out\` work folder (~0.7 GB per long video) is deleted. `final.mp4`, the plan, the voices and the images are kept. A warning shows in the activity list when less than 15 GB is free.
- **Crashes**: an error in one step is logged and the studio keeps running. If the process does die, the supervisor restarts it, waiting longer between restarts if it keeps crashing. Videos being made go back in the queue.
- **Health check**: `http://<vm>:4747/healthz` returns `{"ok":true,...}` without signing in, so you can point an uptime monitor at it.
- **Logs**: `data\server.log`, rotated at 20 MB (5 old files kept).

## Windows Update
Set Active hours on the VM (Settings → Windows Update → Advanced). After an update restarts the VM, the studio starts again by itself, and videos that were being made start over.

## Before going live: checklist
- [ ] `node tools\doctor.js` shows 0 FAIL
- [ ] the Test button is green for every channel and platform (on the VM)
- [ ] the Google OAuth app is "In production"
- [ ] one Short made end to end on the VM: check its frames, then approve and upload it
- [ ] one long video made on the VM: note how long it takes
- [ ] the laptop studio is stopped (no double uploads)
- [ ] after a VM restart, http://localhost:4747/healthz answers within 2 minutes without anyone signing in
- [ ] there is a backup folder under `data\backups\` for today
