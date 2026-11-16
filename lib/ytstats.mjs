// How a channel's own YouTube videos are doing: views, likes, comments, length and age of every upload, read with the
// channel's connected Google login (youtube.readonly, already granted when YouTube was connected). Saved to
// <channel root>/data/yt_stats.json so title research can make more of what works (lib/ideas.mjs).
import fs from 'fs'; import path from 'path';
import { ROOT } from './store.mjs';
import * as FL from './flows.mjs';

const rj = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
const API = 'https://www.googleapis.com/youtube/v3/';

function rootFor(flowId) {
  const own = flowId && FL.getFlow(flowId) ? FL.flowRoot(flowId) : null;
  if (own && fs.existsSync(path.join(own, 'data', 'youtube_token.json'))) return own;
  return ROOT;
}
async function accessToken(r) {
  const tok = rj(path.join(r, 'data', 'youtube_token.json'));
  const cj = rj(path.join(r, 'config', 'youtube_client.json')) || rj(path.join(ROOT, 'config', 'youtube_client.json'));
  const cl = cj && (cj.installed || cj.web);
  if (!tok || !tok.refresh_token || !cl) throw new Error('This channel has no YouTube account connected. Connect it in Channels > Edit > Uploads.');
  const res = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: cl.client_id, client_secret: cl.client_secret, refresh_token: tok.refresh_token, grant_type: 'refresh_token' }) });
  const t = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error('Google login failed: ' + (t.error_description || t.error || res.status) + '. Connect YouTube again.');
  return t.access_token;
}
async function get(token, what, q) {
  const res = await fetch(API + what + '?' + new URLSearchParams(q), { headers: { Authorization: 'Bearer ' + token } });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error('YouTube said: ' + (j.error?.message || res.status));
  return j;
}
const secs = d => { const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(d || '') || []; return (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0); };

export async function fetchStats(flowId, { max = 500 } = {}) {
  const r = rootFor(flowId), token = await accessToken(r);
  const ch = (await get(token, 'channels', { part: 'snippet,statistics,contentDetails', mine: 'true' })).items?.[0];
  if (!ch) throw new Error('This Google account has no YouTube channel.');
  const ids = []; let page = '';
  do {
    const pl = await get(token, 'playlistItems', { part: 'contentDetails', playlistId: ch.contentDetails.relatedPlaylists.uploads, maxResults: '50', ...(page ? { pageToken: page } : {}) });
    ids.push(...pl.items.map(i => i.contentDetails.videoId)); page = pl.nextPageToken || '';
  } while (page && ids.length < max);
  const now = Date.now(), videos = [];
  for (let i = 0; i < ids.length; i += 50) {
    const v = await get(token, 'videos', { part: 'snippet,statistics,contentDetails,status', id: ids.slice(i, i + 50).join(',') });
    for (const x of v.items) {
      const s = x.statistics || {}, views = +s.viewCount || 0, likes = +s.likeCount || 0, comments = +s.commentCount || 0, len = secs(x.contentDetails.duration);
      const days = Math.max(1, (now - Date.parse(x.snippet.publishedAt)) / 864e5);
      videos.push({ id: x.id, title: x.snippet.title, published: x.snippet.publishedAt, privacy: x.status?.privacyStatus, seconds: len, short: len <= 180,
        views, likes, comments, days: +days.toFixed(1), viewsPerDay: +(views / days).toFixed(1), engagement: views ? +((likes + comments) / views * 100).toFixed(2) : 0 });
    }
  }
  const out = { at: new Date().toISOString(), channel: { id: ch.id, title: ch.snippet.title, subscribers: +ch.statistics.subscriberCount || 0, views: +ch.statistics.viewCount || 0, videos: +ch.statistics.videoCount || 0 }, videos };
  fs.mkdirSync(path.join(r, 'data'), { recursive: true });
  fs.writeFileSync(path.join(r, 'data', 'yt_stats.json'), JSON.stringify(out, null, 1));
  return out;
}
export const savedStats = flowId => rj(path.join(rootFor(flowId), 'data', 'yt_stats.json'));

// a short text for the title-research prompt: what did best and worst on this channel lately and of all time (public videos)
export function statsBrief(st) {
  if (!st || !st.videos?.length) return '';
  const pub = st.videos.filter(v => v.privacy === 'public' && v.days >= 0.8);
  if (pub.length < 4) return '';
  const by = (a, k) => [...a].sort((x, y) => y[k] - x[k]);
  const row = v => `- "${v.title}" (${v.short ? 'Short' : 'long'}, ${v.seconds}s, ${v.views} views in ${v.days < 2 ? v.days + ' day' : Math.round(v.days) + ' days'}, ${v.viewsPerDay}/day, ${v.engagement}% likes+comments)`;
  const recent = pub.filter(v => v.days <= 60), old = pub.filter(v => v.days > 60);
  const rb = by(recent, 'viewsPerDay'), parts = [];
  const NL = '\n';
  if (recent.length >= 3) parts.push('Last 60 days, best by views per day:' + NL + rb.slice(0, 6).map(row).join(NL), 'Last 60 days, weakest:' + NL + rb.slice(-Math.min(4, Math.floor(recent.length / 3) || 1)).map(row).join(NL));
  if (old.length) parts.push('All time, biggest hits:' + NL + by(old, 'views').slice(0, 6).map(row).join(NL));
  const eng = by(pub.filter(v => v.views >= 1000), 'engagement').slice(0, 4);
  if (eng.length) parts.push('Most likes and comments per view (1000+ views): ' + eng.map(v => `"${v.title}" (${v.engagement}%)`).join(', ') + '.');
  return `THIS CHANNEL'S OWN RESULTS (YouTube, ${st.at.slice(0, 10)}; ${st.channel.subscribers} subscribers; new videos are only 1-3 days old, so treat their numbers as early signals):
${parts.join(NL)}
Use this: propose more videos like the best ones (same kind of topic, hook, title pattern, length and format), each with a NEW topic or angle (never a copy), and avoid what the weakest ones have in common. Say in "why" which result an idea builds on.`;
}
