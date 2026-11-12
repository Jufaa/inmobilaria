// Reproducible local motion graphic from a repository-owned fictional illustration.
// Run: node scripts/generate-fictional-intro.mjs
import { mkdtempSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = resolve(root, 'public/demo-assets/fictional-rio-cuarto-living.png');
const output = resolve(root, 'public/demo-assets/tours/agency-fictional-intro.mp4');
const poster = resolve(root, 'public/demo-assets/tours/agency-fictional-intro-poster.jpg');
const scratch = mkdtempSync(join(tmpdir(), 'territorio-fictional-intro-'));
console.log(`Scratch retained: ${scratch}`);
const font = spawnSync('fc-match', ['-f', '%{file}', 'sans'], { encoding: 'utf8' }).stdout?.trim();
if (!font || !existsSync(font)) throw new Error('A local sans-serif font and fontconfig are required.');
const title = join(scratch, 'title.txt');
const subtitle = join(scratch, 'subtitle.txt');
const disclosure = join(scratch, 'disclosure.txt');
writeFileSync(title, 'territorio.');
writeFileSync(subtitle, 'UN RECORRIDO IMAGINARIO');
writeFileSync(disclosure, 'Presentación ficticia · Imagen ilustrativa, no es una propiedad real');
const filters = [
  'scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080',
  "zoompan=z='1+0.00035*on':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=300:s=1280x720:fps=30",
  'drawbox=x=0:y=0:w=iw:h=ih:color=black@0.25:t=fill',
  `drawtext=fontfile=${font}:textfile=${title}:fontsize=88:fontcolor=white:x=(w-tw)/2:y=280`,
  `drawtext=fontfile=${font}:textfile=${subtitle}:fontsize=23:fontcolor=white:x=(w-tw)/2:y=398`,
  `drawtext=fontfile=${font}:textfile=${disclosure}:fontsize=17:fontcolor=white:x=(w-tw)/2:y=h-55`,
  'fade=t=in:st=0:d=0.8,fade=t=out:st=9.2:d=0.8,format=yuv420p',
].join(',');
function run(args) {
  const result = spawnSync('/usr/bin/ffmpeg', ['-hide_banner', '-loglevel', 'error', ...args], { stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`ffmpeg failed with exit ${result.status}`);
}
// Only these two explicitly designated generated assets are overwritten on regeneration.
run(['-y', '-i', source, '-vf', filters, '-t', '10', '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '25', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', output]);
run(['-y', '-ss', '2', '-i', output, '-frames:v', '1', '-q:v', '3', poster]);
console.log(`Generated ${output}\nGenerated ${poster}`);
