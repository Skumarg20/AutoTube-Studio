# Connecting YouTube, Instagram and Facebook

> **Easiest way (new):** open the dashboard, go to **Settings > Accounts** (or a channel's **Edit > Uploads** for its own accounts).
> Add your Google OAuth client JSON and press **Connect YouTube**; add your Meta App ID + secret and press **Connect with Facebook**
> (this connects your Facebook Page and its linked Instagram account). Then use the **Test upload** buttons.
> Redirects used: Google `http://127.0.0.1:4747` (Desktop client, nothing to register), Meta `http://localhost:4747/oauth/meta`.
> The steps below explain how to make the Google client and Meta app, and the old command-line route.

You do this once. It takes about 30-45 minutes in total. All you need is a
browser, your Google account (the one that owns your YouTube channel) and your
Instagram + Facebook login.

Commands below are run from the `autotube-studio` folder in PowerShell or Git Bash.

---

## Part A - YouTube

### 1. Create a Google Cloud project
1. Open https://console.cloud.google.com/ and sign in with the Google account that owns your YouTube channel.
2. Top bar -> project picker -> **New Project**. Name it e.g. `autotube-studio`. Click **Create**, then make sure it is selected.
   (No billing / credit card is needed for the YouTube API.)

### 2. Turn on the YouTube Data API v3
1. Left menu -> **APIs & Services** -> **Library**.
2. Search **YouTube Data API v3**, open it, click **Enable**.

### 3. Set up the OAuth consent screen
1. **APIs & Services** -> **OAuth consent screen** (newer consoles call it **Google Auth Platform** -> **Branding / Audience**).
2. User type: **External**. App name: `AutoTube Studio`. Support email and developer email: your own email. Save.
3. Scopes: you can skip this page (the script asks for the scopes itself).
4. **Test users / Audience**: click **Add users** and add **your own Gmail address**. Save.
   Leave the app in **Testing** mode.

### 4. Create the Desktop OAuth client
1. **APIs & Services** -> **Credentials** -> **Create credentials** -> **OAuth client ID**.
2. Application type: **Desktop app**. Name: `autotube-studio-desktop`. Click **Create**.
3. Click **Download JSON**.
4. Save that file as `config/youtube_client.json` inside the `autotube-studio` folder
   (rename it - Google calls it `client_secret_....json`). Compare with `config/youtube_client.example.json` if unsure.
   Keep this file private; do not share or upload it anywhere.

### 5. Connect your channel
```
node uploaders/youtube.mjs auth
```
A browser tab opens (if not, copy the long link printed in the terminal).
Choose your channel's Google account. You will see **"Google hasn't verified this app"** -
this is normal for your own private app: click **Continue** (or **Advanced -> Go to AutoTube Studio**),
tick both permissions and allow. The tab then says "YouTube connected" and the token is saved
to `data/youtube_token.json` (also private).

Check it worked:
```
node uploaders/youtube.mjs status
```
It should print `"connected":true` and your channel name.

### Things to know (honestly)
- **Daily limit:** Google gives each project 10,000 "quota units" per day for free. One video upload
  costs about 1,600 units, so you can upload **about 6 videos per day** - which fits the plan of
  2 long videos + 4 Shorts. Setting a thumbnail costs ~50 units more. The quota resets at midnight
  US Pacific time (about 12:30-1:30 pm India time). If you need more, you can request a quota
  increase in Google Cloud (it requires a review).
- **Videos may be locked to Private:** Google's policy is that videos uploaded through an API project
  that has **not passed Google's compliance audit** are restricted to **private** viewing, even if
  you ask for public. If that happens, YouTube Studio will show the video as private/"locked".
  The fix is to apply for the audit ("YouTube API Services - Audit and Quota Extension Form").
  Until then, plan to check each upload in YouTube Studio; scheduling/public may not take effect.
- **Login expires every 7 days in Testing mode:** while the consent screen is in "Testing", Google
  expires the saved login after 7 days. When uploads start failing with "Refresh token rejected",
  just run `node uploaders/youtube.mjs auth` again. (Publishing the app to "In production" removes
  the 7-day limit but Google may then ask for verification.)
- **Custom thumbnails** need a verified channel (phone verification at https://www.youtube.com/verify).
  If not verified, the upload still succeeds; only the thumbnail is skipped with a warning.

---

## Part B - Instagram (Reels)

Instagram only allows API posting from a **Professional** account (Business or Creator) that is
**linked to a Facebook Page**.

### 1. Make your Instagram account Professional
Instagram app -> Profile -> menu (three lines) -> **Settings and privacy** -> **Account type and tools**
-> **Switch to professional account** -> choose **Creator** or **Business** (category: e.g. "Education").

### 2. Link a Facebook Page
1. If you do not have a Facebook Page, create one at https://www.facebook.com/pages/create (any name, e.g. your channel name).
2. Link it: on the Page (as admin) -> **Settings** -> **Linked accounts** -> **Instagram** -> **Connect**,
   or from Instagram: **Edit profile** -> **Page** -> connect the Page.

### 3. Create a Meta developer app
1. Go to https://developers.facebook.com/ and log in with the Facebook account that manages the Page.
   Register as a developer if asked (needs phone verification).
2. **My Apps** -> **Create app**. Use case: choose the Instagram / "Manage messaging & content on Instagram"
   option, or **Other** -> app type **Business**. Name it `AutoTube Studio`.
3. Leave the app in **Development** mode. In development mode, publishing works for accounts that have
   a role on the app (you, as the admin) - you do not need Meta's App Review for your own account.

### 4. Get a token and your Instagram user id
1. Open the **Graph API Explorer**: https://developers.facebook.com/tools/explorer/
2. Top right: select your app. **User or Page**: "Get User Access Token".
3. Add these permissions: `instagram_basic`, `instagram_content_publish`, `pages_read_engagement`,
   `pages_show_list` (and `business_management` if it is offered). Click **Generate Access Token**,
   log in and allow access to your Page and Instagram account.
4. In the Explorer's query box run: `me/accounts?fields=name,instagram_business_account`
   The number shown under `instagram_business_account` -> `id` (usually starts with `1784...`) is your
   **igUserId**.
5. Make the token long-lived: open https://developers.facebook.com/tools/debug/accesstoken/ ,
   paste the token, click **Debug**, then **Extend Access Token** at the bottom. Copy the new token.
   A long-lived user token lasts about **60 days**; repeat this step when it expires
   (`node uploaders/instagram.mjs status` will show `"connected":false`).

### 5. Fill in the config
Copy `config/instagram.example.json` to `config/instagram.json` and fill it in:
```json
{
  "igUserId": "17841400000000000",
  "accessToken": "EAAG...the long-lived token...",
  "graphVersion": "v21.0"
}
```
Keep this file private. Check it:
```
node uploaders/instagram.mjs status
```
It should print `"connected":true` and your Instagram username.

### Things to know
- Reels must be vertical **9:16**, between **3 seconds and 15 minutes**, MP4 (H.264 video, AAC audio).
- Instagram allows about **50 API posts per 24 hours** per account - far more than you need.
- Captions are limited to 2,200 characters and 30 hashtags; the uploader trims automatically.
- The uploader sends the video file directly to Meta (resumable upload), so no public web hosting is needed.

---

## Command reference
```
node uploaders/youtube.mjs auth
node uploaders/youtube.mjs status
node uploaders/youtube.mjs upload <video.mp4> <meta.json>
node uploaders/instagram.mjs status
node uploaders/instagram.mjs upload <video.mp4> <meta.json>
```
Each command prints one JSON line at the end, e.g. `{"ok":true,"platform":"youtube","id":"...","url":"https://youtu.be/..."}`
or `{"ok":false,...,"error":"..."}`. Set `HS_DEBUG=1` to see full error details on stderr.
