import {mkdir,copyFile,cp,readFile,writeFile} from 'node:fs/promises';
const font = await readFile('PALMETTOV0.4TEST-REGULAR.OTF');
await writeFile('font.css', `/* Exact supplied PALMETTOV0.4TEST-REGULAR.OTF, embedded for file:// support. */\n@font-face { font-family: 'Palmetto'; src: url('data:font/otf;base64,${font.toString('base64')}') format('opentype'); font-weight: 400; font-style: normal; font-display: block; }\n`);
await mkdir('dist',{recursive:true});
for(const file of ['index.html','font.css','style.css','level.js','interaction.js','hand-tracker.js','game.js','PALMETTOV0.4TEST-REGULAR.OTF'])await copyFile(file,`dist/${file}`);
await cp('assets', 'dist/assets', {recursive:true});
console.log('Built static game in dist/');
