const fs = require('node:fs');
const path = require('node:path');
const esbuild = require('esbuild');

const root = path.resolve(__dirname, '..');

(async () => {
  const result = await esbuild.build({
    entryPoints: [path.join(root, 'src/room.js')],
    bundle: true,
    write: false,
    format: 'iife',
    target: 'es2020',
    minify: true,
  });
  const license = fs.readFileSync(path.join(root, 'licenses/three-MIT.txt'), 'utf8');
  const script = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
  const template = fs.readFileSync(path.join(root, 'src/template.html'), 'utf8');
  const html = template.replace('/*ROOM_BUNDLE*/', script + '\n/* Three.js license\n' + license + '*/');
  fs.writeFileSync(path.join(root, 'index.html'), html);
  console.log('Built index.html: ' + Buffer.byteLength(html) + ' bytes');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
