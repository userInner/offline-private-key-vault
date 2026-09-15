const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {webcrypto,createDecipheriv,createCipheriv}=require('node:crypto');
const context={crypto:webcrypto,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,btoa,atob};
vm.createContext(context);
if(fs.existsSync(__dirname+'/../src/core.js')) vm.runInContext(fs.readFileSync(__dirname+'/../src/core.js','utf8'),context);
const V=context.Vault;
test('crypto API exists',()=>assert.ok(V,'Missing encryption implementation'));
if(V){
 const text='虚构私钥 TEST-ONLY\n🗝️ <script>alert(1)</script>\u0000 保留空格 ';
 test('UTF-8 round trip preserves every character',async()=>{const key=V.generateKey();assert.equal((await V.open(await V.seal(text,key),key)),text);});
 test('leading U+FEFF is preserved as content',async()=>{const k=V.generateKey(),s='\uFEFFsecret';assert.equal(await V.open(await V.seal(s,k),k),s);});
 test('independent Node implementation can decrypt public envelope',async()=>{const key=V.generateKey(),e=await V.seal(text,key);const d=createDecipheriv('aes-256-gcm',key,e.slice(8,20));d.setAAD(Buffer.from('PVLT0001'));d.setAuthTag(e.slice(-16));assert.equal(Buffer.concat([d.update(e.slice(20,-16)),d.final()]).toString('utf8'),text);});
 test('decrypts independent fixed-key fixed-nonce fixture',async()=>{const key=new Uint8Array(32),iv=new Uint8Array(12);const c=createCipheriv('aes-256-gcm',key,iv);c.setAAD(Buffer.from('PVLT0001'));const e=Buffer.concat([Buffer.from('PVLT0001'),iv,c.update(Buffer.from('independent fixture')),c.final(),c.getAuthTag()]);assert.equal(await V.open(e,key),'independent fixture');});
 test('wrong key never yields plaintext',async()=>{await assert.rejects(V.open(await V.seal(text,V.generateKey()),V.generateKey()));});
 test('every altered header, nonce, ciphertext and tag byte is rejected',async()=>{const key=V.generateKey(),e=await V.seal('test',key);for(let i=0;i<e.length;i++){const copy=e.slice();copy[i]^=1;await assert.rejects(V.open(copy,key));}});
 test('truncated, trailing and excessive data is rejected',async()=>{const key=V.generateKey(),e=await V.seal('abc',key);for(let i=0;i<e.length;i++)await assert.rejects(V.open(e.slice(0,i),key));await assert.rejects(V.open(new Uint8Array([...e,0]),key));await assert.rejects(V.open(new Uint8Array(1048613),key));});
 test('encryption rejects empty or oversized text but preserves whitespace',async()=>{const k=V.generateKey();await assert.rejects(V.seal('',k));await assert.rejects(V.seal('界'.repeat(349526),k));assert.equal(await V.open(await V.seal(' ',k),k),' ');});
 test('boundary length is supported',async()=>{const k=V.generateKey(),s='a'.repeat(1048576);assert.equal((await V.open(await V.seal(s,k),k)).length,s.length);});
 test('same plaintext and key yield distinct envelopes',async()=>{const k=V.generateKey();assert.notDeepEqual(await V.seal(text,k),await V.seal(text,k));});
 test('key format is strict and round trips',()=>{const k=V.generateKey();assert.equal(k.length,32);assert.deepEqual(V.parseKey(V.keyFile(k)),k);for(const b of [new Uint8Array(32),new Uint8Array(40),new Uint8Array(41)])assert.throws(()=>V.parseKey(b));});
 test('base64 rejects noncanonical and oversized inputs',()=>{assert.throws(()=>V.fromBase64('!!!!'));assert.throws(()=>V.fromBase64('AB=='));assert.throws(()=>V.fromBase64('A'.repeat(1400001)));assert.deepEqual(V.fromBase64(V.toBase64(new Uint8Array([0,1,255]))),new Uint8Array([0,1,255]));});
 test('export retains template but contains only encoded envelope in payload',async()=>{const template='<!doctype html><script id="vault-payload" type="application/octet-stream"></script><p>fixed UI</p>';const e=await V.seal(text,V.generateKey());const html=V.embed(template,e);assert.deepEqual(V.extract(html),e);assert.ok(!html.includes('虚构私钥'));assert.ok(html.endsWith('<p>fixed UI</p>'));assert.throws(()=>V.extract(html+html));assert.throws(()=>V.extract('<html>invalid</html>'));});
}
