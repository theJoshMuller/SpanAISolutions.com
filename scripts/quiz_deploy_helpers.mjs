import fs from 'node:fs/promises';
import os from 'node:os';
export async function readEnv(file=`${os.homedir()}/.hermes/.env`) {
 const source=await fs.readFile(file,'utf8');return Object.fromEntries(source.split(/\r?\n/).filter(l=>/^\s*(?:export )?[A-Z_][A-Z_0-9]*=/.test(l)).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).replace(/^\s*export /,'').trim(),l.slice(i+1).trim().replace(/^(['"])(.*)\1$/,'$2')];}));
}
export function twentyRestBase(value) {const u=new URL(value);u.pathname=u.pathname.replace(/\/$/,'').replace(/\/(?:graphql|rest)$/,'')+'/rest';return u.href.replace(/\/$/,'');}
export function apiRequest(base,headers) {return async(method,path,body)=>{
 const r=await fetch(base+path,{method,headers:{...headers,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
 if(!r.ok) throw new Error(`${method} ${path.split('?')[0]} failed (${r.status}); response withheld to protect credentials`);
 return r.status===204?{}:r.json();
};}
export async function readLocalEnv(){try{return await readEnv('.env');}catch(e){if(e.code==='ENOENT')return {};throw e;}}
export async function writeLocalEnv(values){let current='';try{current=await fs.readFile('.env','utf8');}catch(e){if(e.code!=='ENOENT')throw e;}for(const [key,value]of Object.entries(values)){if(!/^[A-Z0-9_]+$/.test(key)||/[\r\n]/.test(value))throw Error('Invalid local environment entry');const line=`${key}=${value}`;const re=new RegExp(`^${key}=.*$`,'m');current=re.test(current)?current.replace(re,line):`${current}${current&&!current.endsWith('\n')?'\n':''}${line}\n`;}await fs.writeFile('.env',current,{mode:0o600});await fs.chmod('.env',0o600);}
