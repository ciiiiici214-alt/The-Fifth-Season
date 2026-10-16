import {mkdir,copyFile} from 'node:fs/promises';
await mkdir('dist',{recursive:true});
for(const file of ['index.html','style.css','game.js','PALMETTOV0.4TEST-REGULAR.OTF'])await copyFile(file,`dist/${file}`);
console.log('Built static game in dist/');
