const fs = require('node:fs');
const assert = require('node:assert/strict');
const cp = require('node:child_process');
assert.equal(require('../package.json').version, '3.1.4');
for (const root of ['.', 'skills/550w-ai-mcp-subtitle-watermark-removal']) {
  const text = fs.readFileSync(`${root}/SKILL.md`, 'utf8');
  assert.match(text, /550W Watermark & Text Eraser/);
  assert.match(text, /OAuth/);
  assert.match(text, /API Key/);
  for (const file of ['dist/550w-skill.cjs', 'dist/550w-mcp.cjs', 'scripts/550w-upload.cjs', 'references/oauth-access.md', 'references/openapi-access.md']) assert.ok(fs.existsSync(`${root}/${file}`), file);
  const result = cp.spawnSync(process.execPath, [`${root}/dist/550w-skill.cjs`], {input: JSON.stringify({action:'queryCredits',params:{region:'global'}}), encoding:'utf8', env:{...process.env,SUBTITLE_REMOVER_USER_NO:'',SUBTITLE_REMOVER_API_KEY:''}});
  const response = JSON.parse(result.stdout.trim());
  assert.ok(response, 'Credential-free runtime smoke response');
}
console.log('PASS: standalone and historical Skill paths, dual routes, runtime smoke');
