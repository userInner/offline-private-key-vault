(() => {
  'use strict';
  // Capture the static document before any user input or state can enter the DOM.
  // Only the inert Base64 payload is replaced when exporting; never serialize live UI.
  const TEMPLATE='<!DOCTYPE html>\n'+document.documentElement.outerHTML;
  const $=id=>document.getElementById(id);
  const V=globalThis.Vault;
  let encryptKey=null,decryptKey=null,cipher=null,pendingCipher=null,expectedFingerprint=null;
  let pendingHTML=null,textRevision=0,pendingRevision=-1;
  let plaintext=null,showing=false,busy=false,epoch=0,lastActivity=Date.now(),embedded=false;
  const urls=new Set();
  function notify(message,type=''){ $('status').textContent=message;$('status').className='notice'+(type?' '+type:''); }
  function hide(){showing=false;$('plain-output').value='';$('plain-output').hidden=true;$('result-placeholder').hidden=false;$('reveal').textContent='显示原文';$('reveal').setAttribute('aria-expanded','false');}
  function clearResult(){plaintext=null;hide();$('reveal').disabled=true;$('result-placeholder').textContent='成功解密后，点击「显示原文」查看。';}
  function wipeKey(which){if(which==='encrypt'){if(encryptKey)encryptKey.fill(0);encryptKey=null;}else{if(decryptKey)decryptKey.fill(0);decryptKey=null;}}
  function sync(){
    document.querySelectorAll('[data-lock]').forEach(el=>el.disabled=busy);
    $('encrypt').disabled=busy||!encryptKey||!$('encrypt-text').value;
    $('decrypt').disabled=busy||!decryptKey||!cipher;
    $('reveal').disabled=busy||plaintext===null;
    $('tab-encrypt').disabled=busy;$('tab-decrypt').disabled=busy;
  }
  async function run(action){
    if(busy)return;
    busy=true;sync();const current=epoch;const valid=()=>epoch===current;
    try{await action(valid);}catch(error){if(valid())notify(error instanceof Error?error.message:'操作失败，请重试。','error');}
    finally{if(valid()){busy=false;sync();}}
  }
  function selectTab(name){hide();$('encrypt-panel').hidden=name!=='encrypt';$('decrypt-panel').hidden=name!=='decrypt';$('tab-encrypt').setAttribute('aria-pressed',String(name==='encrypt'));$('tab-decrypt').setAttribute('aria-pressed',String(name==='decrypt'));}
  function updateCount(){const n=new TextEncoder().encode($('encrypt-text').value).length;$('byte-count').textContent=(n<1024?n+' B':(n/1024).toFixed(1)+' KiB')+' / 1 MiB';}
  function clear(silent=false){
    epoch++;textRevision++;busy=false;wipeKey('encrypt');wipeKey('decrypt');expectedFingerprint=null;pendingCipher=null;pendingHTML=null;pendingRevision=-1;clearResult();
    $('encrypt-text').value='';updateCount();
    for(const id of ['encrypt-key','decrypt-key','verify-file'])$(id).value='';
    $('encrypt-key-info').textContent='重新选择下载好的密钥后，才能导出加密网页。';
    $('decrypt-key-info').textContent='密钥只用于当前页面，不会被上传。';
    $('verify-box').hidden=true;
    for(const url of urls)URL.revokeObjectURL(url);urls.clear();
    if(!silent)notify('已清除当前文本和密钥。磁盘上的文件未删除。');sync();
  }
  function download(data,name,type){
    const url=URL.createObjectURL(new Blob([data],{type}));urls.add(url);
    const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();
    setTimeout(()=>{URL.revokeObjectURL(url);urls.delete(url);},60000);
  }
  function stamp(){return new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d+Z$/,'Z');}
  async function readKey(input){const file=input.files[0];if(!file)throw new Error('请先选择密钥文件。');if(file.size!==40)throw new Error('密钥文件必须是本工具生成的 40 字节 .key 文件。');const b=new Uint8Array(await file.arrayBuffer());try{return V.parseKey(b);}finally{b.fill(0);}}
  async function readHTML(input){const file=input.files[0];if(!file)throw new Error('请选择加密网页。');if(file.size>4*1024*1024)throw new Error('加密网页超过 4 MiB 上限。');return file.text();}
  async function readCipher(input){return V.extract(await readHTML(input));}
  function describeCipher(){ $('cipher-title').textContent='加密内容已载入';$('cipher-info').textContent='密文 '+(cipher.length/1024).toFixed(1)+' KiB · 需要对应密钥才能打开';}
  $('tab-encrypt').addEventListener('click',()=>selectTab('encrypt'));
  $('tab-decrypt').addEventListener('click',()=>selectTab('decrypt'));
  $('clear').addEventListener('click',()=>clear());
  $('encrypt-text').addEventListener('input',()=>{textRevision++;updateCount();sync();});
  $('generate-key').addEventListener('click',()=>run(async valid=>{
    wipeKey('encrypt');expectedFingerprint=null;$('encrypt-key').value='';
    const k=V.generateKey();
    try{const fp=await V.fingerprint(k);if(!valid())return;expectedFingerprint=fp;download(V.keyFile(k),'保险箱密钥-'+fp+'.key','application/octet-stream');$('encrypt-key-info').textContent='新密钥编号 '+fp+'。请在下方重新选择刚下载的密钥。';notify('已发起密钥下载。保存好后，重新选择同一份密钥文件。');}
    finally{k.fill(0);}
  }));
  $('encrypt-key').addEventListener('change',()=>{
    wipeKey('encrypt');$('encrypt-key-info').textContent='正在读取密钥…';
    run(async valid=>{let k;try{k=await readKey($('encrypt-key'));const fp=await V.fingerprint(k);if(!valid())return;if(expectedFingerprint&&fp!==expectedFingerprint)throw new Error('这不是刚生成的密钥。请选择刚下载的文件，或点击「清除当前内容」后使用其他密钥。');encryptKey=k;k=null;$('encrypt-key-info').textContent='已读取保存的密钥 · '+fp;notify('密钥已读取，可以加密文本。');}finally{if(k)k.fill(0);if(valid()&&!encryptKey)$('encrypt-key-info').textContent='密钥尚未通过校验，请重新选择。';}});
  });
  $('encrypt').addEventListener('click',()=>run(async valid=>{
    const k=encryptKey.slice();let e;
    try{e=await V.seal($('encrypt-text').value,k);const restored=await V.open(e,k);if(!valid())return;if(restored!==$('encrypt-text').value)throw new Error('加密校验未通过或文本在处理期间发生变化，请重试。');const html=V.embed(TEMPLATE,e);pendingCipher=e;pendingHTML=html;pendingRevision=textRevision;download(html,'加密保险箱-'+stamp()+'.html','text/html;charset=utf-8');$('verify-file').value='';$('verify-box').hidden=false;notify('已发起加密网页下载。请完成下方保存校验；密钥需要单独保管。');}
    finally{k.fill(0);}
  }));
  $('verify-file').addEventListener('change',()=>run(async valid=>{
    if(!pendingCipher||!encryptKey)throw new Error('请先加密并下载网页。');
    const expected=pendingCipher,html=await readHTML($('verify-file'));
    if(!valid())return;
    if(html!==pendingHTML)throw new Error('保存的网页与刚导出的完整文件不一致，可能不完整或已被修改，请重新选择。');
    const actual=V.extract(html);
    if(actual.length!==expected.length||actual.some((n,i)=>n!==expected[i]))throw new Error('选择的文件与刚导出的密文不一致，请重新选择。');
    const k=encryptKey.slice();try{await V.open(actual,k);}finally{k.fill(0);}
    if(!valid())return;
    if(textRevision===pendingRevision){clear(true);notify('保存校验通过。当前文本和密钥已清除；请将密钥与加密网页分开备份。','success');}
    else{pendingCipher=null;pendingHTML=null;pendingRevision=-1;$('verify-box').hidden=true;notify('保存校验通过。你后来修改的文本已保留，尚未加密；请继续加密或手动清除。','success');}
  }));
  $('encrypted-file').addEventListener('change',()=>{cipher=null;clearResult();$('cipher-title').textContent='等待校验加密文件';run(async valid=>{const b=await readCipher($('encrypted-file'));if(!valid())return;cipher=b;describeCipher();notify('加密文件已读取，请选择对应密钥。');});});
  $('decrypt-key').addEventListener('change',()=>{wipeKey('decrypt');clearResult();$('decrypt-key-info').textContent='正在读取密钥…';run(async valid=>{let k;try{k=await readKey($('decrypt-key'));const fp=await V.fingerprint(k);if(!valid())return;decryptKey=k;k=null;$('decrypt-key-info').textContent='已读取密钥 · '+fp;notify('密钥已读取，点击「使用密钥解密」继续。');}finally{if(k)k.fill(0);if(valid()&&!decryptKey)$('decrypt-key-info').textContent='密钥无效，请重新选择。';}});});
  $('decrypt').addEventListener('click',()=>run(async valid=>{
    clearResult();const k=decryptKey.slice();const data=cipher;
    try{const text=await V.open(data,k);if(!valid())return;plaintext=text;$('result-placeholder').textContent='已解密并通过完整性校验。原文保持隐藏。';notify('解密成功。点击「显示原文」查看。','success');}
    finally{k.fill(0);}
  }));
  $('reveal').addEventListener('click',()=>{
    if(plaintext===null)return;
    if(showing){hide();return;}
    showing=true;$('plain-output').value=plaintext;$('plain-output').hidden=false;$('result-placeholder').hidden=true;$('reveal').textContent='隐藏原文';$('reveal').setAttribute('aria-expanded','true');
  });
  window.addEventListener('blur',hide);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)hide();});
  for(const event of ['pointerdown','keydown','input','change'])document.addEventListener(event,()=>{lastActivity=Date.now();},{passive:true});
  setInterval(()=>{if(Date.now()-lastActivity>=300000&&(encryptKey||decryptKey||plaintext!==null||$('encrypt-text').value||expectedFingerprint)){clear(true);notify('已因 5 分钟无操作清除当前文本和密钥。');}},1000);
  window.addEventListener('pagehide',()=>clear(true));
  function init(){
    if(!globalThis.crypto?.subtle||!globalThis.crypto?.getRandomValues){notify('当前浏览器不支持本地加密。请用支持 Web Crypto 的现代浏览器直接打开此文件。','error');document.querySelectorAll('button,input,textarea').forEach(el=>{if(el.id!=='clear')el.disabled=true;});return;}
    const payload=$('vault-payload').textContent;
    if(payload){embedded=true;document.body.classList.add('is-sealed');$('tabs').hidden=true;$('file-picker').hidden=true;$('mode-label').textContent='加密文件 / VERSION 1';$('page-title').textContent='用你的密钥，打开秘密。';$('page-description').textContent='这个文件自带解密功能。选择密钥即可在本地查看，无需联网。';selectTab('decrypt');try{cipher=V.fromBase64(payload);describeCipher();notify('加密文件已就绪。请选择对应的密钥文件。');}catch(e){notify(e.message,'error');}}
    sync();
  }
  init();
})();
