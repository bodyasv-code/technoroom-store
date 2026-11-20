import {readFile,writeFile} from 'node:fs/promises';
import {projectionFinishSql} from './projection-finish-maintenance.mjs';
const [input,prefix]=process.argv.slice(2);
if(!input||!prefix)throw Error('Usage: node scripts/prepare-reviewed-photo-repair.mjs manifest.json output-prefix');
const manifest=JSON.parse(await readFile(input,'utf8'));
await writeFile(prefix+'.sql',projectionFinishSql(manifest.cards,{photoOperation:manifest.operation}));
await writeFile(prefix+'-restore.sql',projectionFinishSql(manifest.cards,{photoOperation:manifest.operation,restore:true}));
console.log(JSON.stringify({operation:manifest.operation,cards:manifest.cards.length}));
