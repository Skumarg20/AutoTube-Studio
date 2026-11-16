// Set (or remove) the dashboard password that lets you open AutoTube Studio from other devices.
//   node tools/set-password.mjs          set / change it (asks twice, typing is hidden)
//   node tools/set-password.mjs --off    remove it: the dashboard works only on this machine again
// Restart the studio afterwards. Changing the password signs every device out.
import readline from 'readline';
import { setPassword, clearPassword } from '../lib/ops.mjs';

if (process.argv.includes('--off')) { clearPassword(); console.log('Password removed. After a restart the dashboard opens only on this machine.'); process.exit(0); }

function ask(q) {
  return new Promise(res => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = s => { if (s.startsWith(q)) rl.output.write(q); else if (s.includes('\n') || s.includes('\r')) rl.output.write('\n'); };
    rl.question(q, a => { rl.close(); res(a); });
  });
}
const a = await ask('New dashboard password (min 10 characters): ');
const b = await ask('Type it again: ');
if (a !== b) { console.log('The two passwords are different. Nothing changed.'); process.exit(1); }
try { setPassword(a); } catch (e) { console.log('Not saved: ' + e.message); process.exit(1); }
console.log('Saved (only a scrypt hash is stored in config/settings.json). Restart the studio, then open http://<this-machine>:4747 from another device and sign in.');
