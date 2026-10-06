import {spawnSync} from 'node:child_process';
import {mkdtempSync, readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const out = mkdtempSync(join(tmpdir(),'editor-auth-builds-'));
for (const name of ['auth0','cognito']) {
  const env = {...process.env, AUTH_PROVIDER: name, COGNITO_USER_POOL_ID:'us-west-2_Test', COGNITO_CLIENT_ID:'browser',
    COGNITO_LOGIN_DOMAIN:'login.example.com', COGNITO_SCOPES:'openid graphs/access',
    COGNITO_REDIRECT_SIGN_IN:'https://editor.example/graph-editor/auth-callback', COGNITO_REDIRECT_SIGN_OUT:'https://editor.example/graph-editor/'};
  const result=spawnSync(process.execPath,['node_modules/vite/bin/vite.js','build','--outDir',join(out,name)],{env,stdio:'inherit'});
  if(result.status!==0) process.exit(result.status || 1);
  const manifest=JSON.parse(readFileSync(join(out,name,'auth-provider.json'),'utf8'));
  if(manifest.provider!==name || !manifest.isolated) throw new Error(`Provider isolation failed for ${name}`);
}
console.log(`Both provider builds verified: ${out}`);
