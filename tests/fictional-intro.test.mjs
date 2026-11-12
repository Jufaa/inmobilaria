import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
test('new fictional intro is a compact ten-second browser-compatible local production', () => {
 const file='public/demo-assets/tours/agency-fictional-intro.mp4';
 const probe=spawnSync('/usr/bin/ffprobe',['-v','error','-show_streams','-show_format','-of','json',file],{encoding:'utf8'});
 assert.equal(probe.status,0,probe.stderr);
 const data=JSON.parse(probe.stdout),video=data.streams.find(s=>s.codec_type==='video');
 assert.equal(video.codec_name,'h264');assert.equal(video.pix_fmt,'yuv420p');assert.equal(video.width,1280);assert.equal(video.height,720);
 assert.ok(+data.format.duration>=8 && +data.format.duration<=12);assert.ok(statSync(file).size<5*1024*1024);
 const bytes=readFileSync(file);assert.ok(bytes.indexOf(Buffer.from('moov'))<bytes.indexOf(Buffer.from('mdat')),'faststart metadata precedes video data');
 const poster=spawnSync('/usr/bin/ffprobe',['-v','error','-show_streams','-of','json','public/demo-assets/tours/agency-fictional-intro-poster.jpg'],{encoding:'utf8'});
 assert.equal(poster.status,0);assert.equal(JSON.parse(poster.stdout).streams[0].width,1280);
 const generator=readFileSync('scripts/generate-fictional-intro.mjs','utf8');
 assert.ok(generator.includes('fictional-rio-cuarto-living.png'));assert.ok(generator.includes('ilustrativa'));assert.ok(!generator.includes('https://'));
});
