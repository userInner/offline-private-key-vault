/* Public format and cryptography only. No DOM, storage or network. */
globalThis.Vault = (() => {
  'use strict';
  const MAX = 1048576;
  const enc = new TextEncoder();
  const header = enc.encode('PVLT0001');
  const keyHeader = enc.encode('PKEY0001');
  const marker = /<script id="vault-payload" type="application\/octet-stream">([A-Za-z0-9+/=]*)<\/script>/g;
  function bytes(b) { if (!(b instanceof Uint8Array)) throw new Error('文件数据格式无效。'); return b; }
  function checkKey(k) { if (bytes(k).length !== 32) throw new Error('密钥长度无效。'); return k; }
  function matches(a,b) { return b.every((v,i) => a[i] === v); }
  function join(...parts) { const out = new Uint8Array(parts.reduce((n,p)=>n+p.length,0)); let offset=0; for(const p of parts){out.set(p,offset);offset+=p.length;} return out; }
  function generateKey() { return crypto.getRandomValues(new Uint8Array(32)); }
  function keyFile(k) { return join(keyHeader,checkKey(k)); }
  function parseKey(b) { if(bytes(b).length!==40 || !matches(b,keyHeader)) throw new Error('请选择本工具生成的 .key 密钥文件（40 字节）。'); return b.slice(8); }
  async function importKey(k,usage) { return crypto.subtle.importKey('raw',checkKey(k),'AES-GCM',false,[usage]); }
  async function seal(text,k) {
    if(typeof text!=='string') throw new Error('请输入文本。');
    const plain=enc.encode(text);
    if(!plain.length || plain.length>MAX) throw new Error('请输入 1 字节至 1 MiB 的文本。');
    try {
      const key=await importKey(k,'encrypt');
      const iv=crypto.getRandomValues(new Uint8Array(12));
      const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:header,tagLength:128},key,plain);
      return join(header,iv,new Uint8Array(cipher));
    } finally { plain.fill(0); }
  }
  async function open(b,k) {
    if(bytes(b).length<37 || b.length>MAX+36 || !matches(b,header)) throw new Error('加密文件格式、版本或长度无效。');
    const key=await importKey(k,'decrypt');
    let plain;
    try {
      plain=new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:b.slice(8,20),additionalData:header,tagLength:128},key,b.slice(20)));
      return new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(plain);
    } catch { throw new Error('无法解密：密钥不匹配，或加密内容已损坏、被修改。'); }
    finally { if(plain) plain.fill(0); }
  }
  function toBase64(b) { bytes(b); let s=''; for(let i=0;i<b.length;i+=8192)s+=String.fromCharCode(...b.subarray(i,i+8192)); return btoa(s); }
  function fromBase64(s) {
    if(typeof s!=='string'||s.length>Math.ceil((MAX+36)/3)*4||!s.length||s.length%4||!/^[A-Za-z0-9+/]*={0,2}$/.test(s))throw new Error('加密数据编码无效。');
    let raw; try{raw=atob(s);}catch{throw new Error('加密数据编码无效。');}
    if(btoa(raw)!==s)throw new Error('加密数据编码无效。');
    return Uint8Array.from(raw,c=>c.charCodeAt(0));
  }
  function locate(html) {
    if(typeof html!=='string'||html.length>4*1024*1024)throw new Error('加密网页无效或超过 4 MiB。');
    const all=[...html.matchAll(marker)];
    if(all.length!==1)throw new Error('没有找到唯一的加密数据，请选择本工具导出的 HTML 文件。');
    return all[0];
  }
  function extract(html) {return fromBase64(locate(html)[1]);}
  function embed(template,b) {
    locate(template);
    return template.replace(marker,()=>'<script id="vault-payload" type="application/octet-stream">'+toBase64(b)+'<\/script>');
  }
  async function fingerprint(k) {const hash=new Uint8Array(await crypto.subtle.digest('SHA-256',checkKey(k)));return [...hash.slice(0,8)].map(n=>n.toString(16).padStart(2,'0')).join('').match(/.{4}/g).join('-');}
  return Object.freeze({MAX,generateKey,keyFile,parseKey,seal,open,toBase64,fromBase64,extract,embed,fingerprint});
})();
