let enhanceSelectedFile=null;
let enhanceSelectedObjectUrl='';
let enhanceResultObjectUrl='';
let enhanceResultFilename='';
let enhanceDownloadItem=null;
let enhanceButtonMode='enhance';
let enhanceSelectedMeta=null;
let enhanceSelectedDataUrl='';
let enhanceDownloadDelegated=false;
let enhanceProgressToken=0;
let enhanceProgressTimers=[];
let enhanceProgressDonePromise=Promise.resolve();
let enhanceProgressResolve=null;
let enhanceSelectionToken=0;
let enhanceRequestToken=0;
let enhanceActiveRequestController=null;
let enhanceResultExpiryTimer=null;
const ENHANCE_PROGRESS_STEP_MS=6000;
const ENHANCE_RESULT_MEMORY_MS=2*60*1000;
const ENHANCE_FETCH_RETRY_MS=1200;

function setEnhanceStatus(message='', options={}){
  const status=$('#enhanceStatus');
  if(!status)return;
  const thinking=Boolean(options.thinking&&message);
  status.classList.toggle('enhance-thinking', thinking);
  status.textContent='';
  if(thinking){
    if(typeof applyResponseMessageType==='function')applyResponseMessageType(status,'');
    const copy=document.createElement('span');
    copy.className='enhance-status-copy';
    copy.dataset.text=message;
    copy.textContent=message;
    status.appendChild(copy);
    return;
  }
  status.textContent=message;
  if(typeof applyResponseMessageType==='function')applyResponseMessageType(status,message);
}

function stopEnhanceProgressMessages(){
  enhanceProgressToken +=1;
  enhanceProgressTimers.forEach((timer)=>window.clearTimeout(timer));
  enhanceProgressTimers=[];
  if(enhanceProgressResolve){
    enhanceProgressResolve();
    enhanceProgressResolve=null;
  }
  enhanceProgressDonePromise=Promise.resolve();
}

function cancelActiveEnhanceRequest(){
  if(enhanceActiveRequestController){
    try{enhanceActiveRequestController.abort();}catch{}
    enhanceActiveRequestController=null;
  }
  enhanceRequestToken +=1;
}

function beginEnhanceSelection(){
  enhanceSelectionToken +=1;
  cancelActiveEnhanceRequest();
  return enhanceSelectionToken;
}

function beginEnhanceRequest(){
  cancelActiveEnhanceRequest();
  enhanceActiveRequestController=new AbortController();
  return{requestToken:enhanceRequestToken, controller:enhanceActiveRequestController};
}

function isCurrentEnhanceRun(selectionToken, requestToken, file){
  return selectionToken===enhanceSelectionToken
    && requestToken===enhanceRequestToken
    && file===enhanceSelectedFile;
}

function clearEnhanceResultExpiryTimer(){
  if(enhanceResultExpiryTimer){
    window.clearTimeout(enhanceResultExpiryTimer);
    enhanceResultExpiryTimer=null;
  }
}

function enhanceWait(ms){
  return new Promise((resolve)=>window.setTimeout(resolve, ms));
}

function isTransientEnhanceFetchError(error){
  const message=String(error?.message||'').toLowerCase();
  return error?.name==='TypeError'&&(
    message.includes('failed to fetch')
    || message.includes('networkerror')
    || message.includes('load failed')
  );
}

function friendlyEnhanceError(error){
  if(isTransientEnhanceFetchError(error)){
    return 'Connection was interrupted while enhancing. Keep this screen open and try again.';
  }
  return error?.message||'Detail restore could not be completed. Please try again.';
}

function enhanceProgressDelay(ms){
  return new Promise((resolve)=>{
    const timer=window.setTimeout(resolve, ms);
    enhanceProgressTimers.push(timer);
  });
}

function enhanceProgressMethodMessage(status={}){
  return status.provider==='cloudinary'||status.method==='ai'
    ? 'Using AI powered enhancer...'
    : 'Using built-in enhancer...';
}

async function getEnhanceMethodStatus(){
  try{
    const response=await fetch('/api/enhance-method', {credentials:'same-origin', cache:'no-store'});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.error||'Method check failed.');
    return data;
  }catch{
    return{method:'local', provider:'local'};
  }
}

function startEnhanceProgressMessages(methodStatusPromise=Promise.resolve({method:'local', provider:'local'})){
  stopEnhanceProgressMessages();
  const token=enhanceProgressToken;
  enhanceProgressDonePromise=new Promise((resolve)=>{
    enhanceProgressResolve=resolve;
    const steps=[
      ()=>'Enhancing image...',
      async()=>enhanceProgressMethodMessage(await methodStatusPromise.catch(()=>({method:'local', provider:'local'}))),
      ()=>'Restoring fine image details...',
      ()=>'Preparing the enhanced image...',
    ];
    (async()=>{
      for(const step of steps){
        if(token!==enhanceProgressToken)return;
        const message=await step();
        if(token!==enhanceProgressToken)return;
        setEnhanceStatus(message, {thinking:true});
        await enhanceProgressDelay(ENHANCE_PROGRESS_STEP_MS);
      }
      if(token!==enhanceProgressToken)return;
      enhanceProgressResolve=null;
      resolve();
    })();
  });
  return enhanceProgressDonePromise;
}

function enhanceReleaseUrl(item=enhanceDownloadItem){
  const source=String(item?.downloadUrl||'');
  const match=source.match(/\/api\/enhance-download\/([^/?#]+)/);
  return match?`/api/enhance-download/${encodeURIComponent(match[1])}/release`:'';
}

function releaseEnhanceDownloadItem(item=enhanceDownloadItem, options={}){
  const url=enhanceReleaseUrl(item);
  if(!url)return;
  try{
    if(options.beacon&&navigator.sendBeacon){
      navigator.sendBeacon(url, '');
      return;
    }
  }catch{}
  try{
    fetch(url, {method:'POST', credentials:'same-origin', keepalive:Boolean(options.keepalive)}).catch(()=>{});
  }catch{}
}

function releaseEnhanceResponseDownload(response, options={}){
  const downloadUrl=response?.headers?.get?.('X-Enhance-Download-Url')||'';
  if(downloadUrl)releaseEnhanceDownloadItem({downloadUrl}, options);
}

function expireEnhanceResultFromMemory(itemId=''){
  if(itemId&&enhanceDownloadItem?.id!==itemId)return;
  clearEnhanceResultExpiryTimer();
  if(enhanceDownloadItem)releaseEnhanceDownloadItem(enhanceDownloadItem);
  enhanceDownloadItem=null;
  if(enhanceResultObjectUrl){
    try{URL.revokeObjectURL(enhanceResultObjectUrl);}catch{}
  }
  enhanceResultObjectUrl='';
  enhanceResultFilename='';
  const preview=$('#enhancePreviewImage');
  if(preview)preview.removeAttribute('src');
  $('#enhancePreview')?.classList.add('hidden');
  const link=$('#enhanceDownloadLink');
  if(link){
    link.href='#';
    link.download='wallpaper-ai-enhanced.jpg';
    link.target='_blank';
    link.rel='noopener noreferrer';
    link.dataset.enhanceDownloadId='';
    delete link.dataset.serverDownloadUrl;
  }
  setEnhanceButtonMode('enhance');
  setEnhanceStatus('Enhanced image was cleared from memory after 2 minutes. Enhance again to download.');
}

function scheduleEnhanceResultExpiry(item=enhanceDownloadItem){
  clearEnhanceResultExpiryTimer();
  if(!item?.id)return;
  enhanceResultExpiryTimer=window.setTimeout(()=>expireEnhanceResultFromMemory(item.id), ENHANCE_RESULT_MEMORY_MS);
}

function clearEnhanceDownloadLink(){
  clearEnhanceResultExpiryTimer();
  if(enhanceDownloadItem)releaseEnhanceDownloadItem(enhanceDownloadItem);
  enhanceDownloadItem=null;
  const link=$('#enhanceDownloadLink');
  if(!link)return;
  link.href='#';
  link.download='wallpaper-ai-enhanced.jpg';
  link.target='_blank';
  link.rel='noopener noreferrer';
  link.dataset.enhanceDownloadId='';
  delete link.dataset.serverDownloadUrl;
}

function clearEnhanceObjectUrls(){
  clearEnhanceResultExpiryTimer();
  [enhanceSelectedObjectUrl, enhanceResultObjectUrl].forEach((url)=>{
    if(!url)return;
    try{URL.revokeObjectURL(url);}catch{}
  });
  enhanceSelectedObjectUrl='';
  enhanceResultObjectUrl='';
}

function setEnhanceButtonMode(mode){
  enhanceButtonMode=mode==='download'?'download':'enhance';
  const button=$('#enhanceBtn');
  const link=$('#enhanceDownloadLink');
  if(button){
    button.textContent='Enhance';
    button.disabled=!enhanceSelectedFile;
    button.classList.toggle('hidden', enhanceButtonMode==='download');
  }
  if(link){
    const ready=enhanceButtonMode==='download'&&prepareEnhanceDownloadLink(link);
    link.classList.toggle('hidden', !ready);
  }
}

function clearEnhanceResult(){
  clearEnhanceResultExpiryTimer();
  stopEnhanceProgressMessages();
  if(enhanceResultObjectUrl){
    try{URL.revokeObjectURL(enhanceResultObjectUrl);}catch{}
  }
  enhanceResultObjectUrl='';
  enhanceResultFilename='';
  const preview=$('#enhancePreviewImage');
  if(preview)preview.removeAttribute('src');
  $('#enhancePreview')?.classList.add('hidden');
  clearEnhanceDownloadLink();
  setEnhanceButtonMode('enhance');
}

function resetEnhanceTool(options={}){
  const keepStatus=Boolean(options.keepStatus);
  if(!options.keepSelectionToken){
    enhanceSelectionToken +=1;
    cancelActiveEnhanceRequest();
  }
  stopEnhanceProgressMessages();
  clearEnhanceResultExpiryTimer();
  clearEnhanceDownloadLink();
  clearEnhanceObjectUrls();
  enhanceSelectedFile=null;
  enhanceSelectedMeta=null;
  enhanceSelectedDataUrl='';
  enhanceResultFilename='';
  enhanceButtonMode='enhance';
  const input=$('#enhanceWallpaperFile');
  if(input)input.value='';
  $('#enhanceSelectedInfo')?.classList.add('hidden');
  $('#enhancePreview')?.classList.add('hidden');
  const preview=$('#enhancePreviewImage');
  if(preview)preview.removeAttribute('src');
  setEnhanceButtonMode('enhance');
  $('#enhanceResetBtn')?.classList.add('hidden');
  if(!keepStatus)setEnhanceStatus('');
}

function enhanceFileSupported(file){
  const mime=String(file?.type||'').toLowerCase();
  if(mime)return['image/jpeg','image/png','image/webp'].includes(mime);
  return /\.(png|jpe?g|webp)$/i.test(file?.name||'');
}

function enhanceMimeForFile(file){
  const mime=String(file?.type||'').toLowerCase();
  if(['image/jpeg','image/png','image/webp'].includes(mime))return mime;
  const name=String(file?.name||'').toLowerCase();
  if(/\.png$/.test(name))return'image/png';
  if(/\.webp$/.test(name))return'image/webp';
  return'image/jpeg';
}

function base64FromBytes(bytes){
  let binary='';
  const chunkSize=0x8000;
  for(let index=0;index<bytes.length;index +=chunkSize){
    const chunk=bytes.subarray(index,index + chunkSize);
    binary +=String.fromCharCode.apply(null,chunk);
  }
  return btoa(binary);
}

async function readEnhanceFileAsDataUrl(file){
  if(!file)throw new Error('Please choose an image to restore.');
  if(typeof file.arrayBuffer==='function'){
    try{
      const bytes=new Uint8Array(await file.arrayBuffer());
      return `data:${enhanceMimeForFile(file)};base64,${base64FromBytes(bytes)}`;
    }
    catch{
    }
  }
  try{
    return await readFileAsDataUrl(file);
  }
  catch{
    throw new Error('Image could not be read.');
  }
}

function canvasDataUrlFromImage(image){
  if(!image?.naturalWidth||!image?.naturalHeight)throw new Error('Image could not be prepared.');
  const maxLongEdge=4096;
  const sourceWidth=image.naturalWidth;
  const sourceHeight=image.naturalHeight;
  const longest=Math.max(sourceWidth, sourceHeight);
  const scale=longest>maxLongEdge?maxLongEdge / longest:1;
  const canvas=document.createElement('canvas');
  canvas.width=Math.max(1, Math.round(sourceWidth*scale));
  canvas.height=Math.max(1, Math.round(sourceHeight*scale));
  const context=canvas.getContext('2d', {alpha:false});
  context.fillStyle='#000';
  context.fillRect(0,0,canvas.width,canvas.height);
  context.drawImage(image,0,0,canvas.width,canvas.height);
  return canvas.toDataURL('image/jpeg',0.96);
}

function renderEnhanceSelectedInfo(file, image){
  const info=$('#enhanceSelectedInfo');
  if(!info)return;
  info.classList.remove('hidden');
  info.innerHTML=`
    <div class="selected-info-card">
      <div class="selected-copy">
        <strong>${escapeHtml(file.name)}</strong>
        <span>${image.naturalWidth}x${image.naturalHeight} - ${formatBytes(file.size)}</span>
        <span>Ready to restore fine detail.</span>
        <span>Tone and color will be preserved.</span>
      </div>
      <div class="selected-thumb-frame">
        <img class="selected-thumb" src="${escapeHtml(enhanceSelectedObjectUrl)}" alt="Selected wallpaper preview" />
      </div>
    </div>
  `;
}

async function handleEnhanceFile(file){
  const selectionToken=beginEnhanceSelection();
  setEnhanceStatus('');
  resetEnhanceTool({keepStatus:true, keepSelectionToken:true});
  if(!file)return;
  if(!enhanceFileSupported(file)){
    setEnhanceStatus('Please choose a PNG, JPG, or WEBP image.');
    return;
  }
  if(file.size>12*1024*1024){
    setEnhanceStatus('Please choose an image under 12 MB.');
    return;
  }
  setEnhanceStatus('Reading image...');
  try{
    const loaded=await decodeImageWithFallback(file);
    if(selectionToken!==enhanceSelectionToken){
      if(loaded?.objectUrl){
        try{URL.revokeObjectURL(loaded.objectUrl);}catch{}
      }
      return;
    }
    setEnhanceStatus('Preparing a clean preview...');
    let cachedDataUrl=String(loaded.previewSrc||'').startsWith('data:')?loaded.previewSrc:'';
    if(!cachedDataUrl){
      try{
        cachedDataUrl=await readEnhanceFileAsDataUrl(file);
      }
      catch{
        cachedDataUrl=canvasDataUrlFromImage(loaded.image);
      }
    }
    if(selectionToken!==enhanceSelectionToken){
      if(loaded?.objectUrl){
        try{URL.revokeObjectURL(loaded.objectUrl);}catch{}
      }
      return;
    }
    enhanceSelectedFile=file;
    enhanceSelectedMeta={image:loaded.image};
    enhanceSelectedDataUrl=cachedDataUrl;
    enhanceSelectedObjectUrl=loaded.objectUrl||loaded.previewSrc||'';
    renderEnhanceSelectedInfo(file, loaded.image);
    setEnhanceButtonMode('enhance');
    $('#enhanceResetBtn')?.classList.remove('hidden');
    setEnhanceStatus('');
  }catch(error){
    if(selectionToken!==enhanceSelectionToken)return;
    resetEnhanceTool({keepStatus:true, keepSelectionToken:true});
    setEnhanceStatus(error.message||'We could not read this image. Please try another file.');
  }
}

function createEnhanceDownloadId(){
  if(typeof randomId==='function')return randomId();
  return `enhance-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function enhanceDownloadUrl(item=enhanceDownloadItem){
  const source=item?.downloadUrl||item?.objectUrl||'';
  if(!source)return '';
  try{
    const url=new URL(source, window.location.href);
    url.searchParams.set('t', String(Date.now()));
    return url.toString();
  }catch{
    const separator=source.includes('?')?'&':'?';
    return `${source}${separator}t=${Date.now()}`;
  }
}

function enhanceDownloadFilename(item=enhanceDownloadItem){
  return item?.filename||enhanceResultFilename||'wallpaper-ai-enhanced.jpg';
}

function prepareEnhanceDownloadLink(link=$('#enhanceDownloadLink'), item=enhanceDownloadItem){
  const url=enhanceDownloadUrl(item);
  if(!link||!item||!url)return false;
  link.href=url;
  link.download=enhanceDownloadFilename(item);
  link.target='_blank';
  link.rel='noopener noreferrer';
  link.dataset.enhanceDownload='1';
  link.dataset.enhanceDownloadId=item.id;
  if(item.downloadUrl)link.dataset.serverDownloadUrl=item.downloadUrl;
  else delete link.dataset.serverDownloadUrl;
  return true;
}

function rebuildEnhanceDownloadLink(item=enhanceDownloadItem){
  const current=$('#enhanceDownloadLink');
  if(!current||!item)return current;
  const link=document.createElement('a');
  link.id='enhanceDownloadLink';
  link.className='primary-btn enhance-download-link';
  link.textContent='Download';
  current.replaceWith(link);
  prepareEnhanceDownloadLink(link, item);
  return link;
}

function prepareEnhancedBlob(blob, response){
  if(enhanceDownloadItem){
    releaseEnhanceDownloadItem(enhanceDownloadItem);
    enhanceDownloadItem=null;
  }
  if(enhanceResultObjectUrl){
    try{URL.revokeObjectURL(enhanceResultObjectUrl);}catch{}
  }
  enhanceResultObjectUrl=URL.createObjectURL(blob);
  const preview=$('#enhancePreviewImage');
  if(preview)preview.src=enhanceResultObjectUrl;
  $('#enhancePreview')?.classList.remove('hidden');
  const originalExt=(enhanceSelectedFile?.name?.match(/\.([a-z0-9]+)$/i)?.[1]||'jpg').toLowerCase();
  const fallback=`${voidSanitizeDownloadFilename(enhanceSelectedFile?.name?.replace(/\.[^.]+$/,'')||'wallpaper')}-ai-enhanced.${originalExt}`;
  enhanceResultFilename=voidFilenameFromDisposition(response.headers.get('Content-Disposition'), fallback);
  enhanceDownloadItem={
    id:createEnhanceDownloadId(),
    downloadUrl:response.headers.get('X-Enhance-Download-Url')||'',
    objectUrl:enhanceResultObjectUrl,
    filename:enhanceResultFilename,
  };
  rebuildEnhanceDownloadLink(enhanceDownloadItem);
  setEnhanceButtonMode('download');
  scheduleEnhanceResultExpiry(enhanceDownloadItem);
}

function cleanEnhanceStatusPart(value){
  return String(value||'').trim().replace(/[.]+$/,'');
}

function enhanceReasonFromQuota({provider='',quotaState='',remaining=0}={}){
  if(provider==='cloudinary'){
    return remaining>0?`${remaining} AI restore ${remaining===1?'use':'uses'} remaining today`:'today\'s AI restore limit has been reached';
  }
  if(quotaState==='exhausted')return 'daily AI restore limit reached; local detail restore was used';
  if(quotaState==='fallback')return 'local detail restore was used';
  if(quotaState==='unavailable')return 'AI restore is unavailable; local detail restore was used';
  return 'local detail restore was used';
}

function enhanceReadyStatusText({method='',reason='',provider='',quotaState='',remaining=0}={}){
  return provider==='cloudinary'
    ? 'Image enhanced successfully by using AI powered enhancer.'
    : 'Image enhanced successfully by using built-in enhancer.';
}

function handleEnhanceDownloadClick(event){
  const link=event.target?.closest?.('[data-enhance-download]');
  if(!link||!document.contains(link))return;
  const item=enhanceDownloadItem;
  if(item&&prepareEnhanceDownloadLink(link, item)){
    const url=link.href;
    let opened=null;
    try{
      opened=window.open(url, '_blank', 'noopener,noreferrer');
    }catch{
      opened=null;
    }
    if(opened){
      try{opened.opener=null;}catch{}
      event.preventDefault();
      event.stopPropagation();
    }
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  setEnhanceStatus('Please restore an image before downloading.');
}

function handleEnhanceDownloadPress(event){
  const link=event.target?.closest?.('[data-enhance-download]');
  if(!link||!document.contains(link)||!enhanceDownloadItem)return;
  prepareEnhanceDownloadLink(link, enhanceDownloadItem);
}

function setupEnhanceDownloadDelegation(){
  if(enhanceDownloadDelegated)return;
  enhanceDownloadDelegated=true;
  document.addEventListener('pointerdown', handleEnhanceDownloadPress, true);
  document.addEventListener('touchstart', handleEnhanceDownloadPress, {capture:true, passive:true});
  document.addEventListener('click', handleEnhanceDownloadClick, true);
}

async function fetchEnhanceWallpaperResponse({sourceFile, dataUrl, controller, selectionToken, requestToken}){
  const requestId=createEnhanceDownloadId();
  let lastError=null;
  for(let attempt=0; attempt<2; attempt++){
    try{
      return await fetch('/api/enhance-wallpaper', {
        method:'POST',
        headers:{'Content-Type':'application/json', 'Cache-Control':'no-store'},
        body:JSON.stringify({filename:sourceFile.name, dataUrl, requestId}),
        signal:controller.signal,
      });
    }catch(error){
      lastError=error;
      if(error?.name==='AbortError'||!isCurrentEnhanceRun(selectionToken, requestToken, sourceFile)){
        throw error;
      }
      if(!isTransientEnhanceFetchError(error)||attempt>=1){
        throw error;
      }
      await enhanceWait(ENHANCE_FETCH_RETRY_MS);
      if(!isCurrentEnhanceRun(selectionToken, requestToken, sourceFile))throw error;
    }
  }
  throw lastError||new Error('Detail restore could not be completed. Please try again.');
}

async function enhanceSelectedWallpaper(){
  const button=$('#enhanceBtn');
  if(enhanceButtonMode==='download'){
    return;
  }
  if(!enhanceSelectedFile){
    setEnhanceStatus('Please choose an image to restore.');
    return;
  }
  const sourceFile=enhanceSelectedFile;
  const selectionToken=enhanceSelectionToken;
  clearEnhanceResult();
  if(button)button.disabled=true;
  const methodStatusPromise=getEnhanceMethodStatus();
  startEnhanceProgressMessages(methodStatusPromise);
  const{requestToken, controller}=beginEnhanceRequest();
  try{
    const dataUrl=enhanceSelectedDataUrl||await readEnhanceFileAsDataUrl(sourceFile);
    if(!isCurrentEnhanceRun(selectionToken, requestToken, sourceFile))return;
    enhanceSelectedDataUrl=dataUrl;
    const response=await fetchEnhanceWallpaperResponse({sourceFile, dataUrl, controller, selectionToken, requestToken});
    if(!isCurrentEnhanceRun(selectionToken, requestToken, sourceFile)){
      releaseEnhanceResponseDownload(response, {keepalive:true});
      return;
    }
    if(!response.ok){
      const data=await response.json().catch(()=>({}));
      throw new Error(formatAuthError(data.error||'Detail restore could not be completed.'));
    }
    const blob=await response.blob();
    if(!isCurrentEnhanceRun(selectionToken, requestToken, sourceFile)){
      releaseEnhanceResponseDownload(response, {keepalive:true});
      return;
    }
    prepareEnhancedBlob(blob, response);
    const provider=response.headers.get('X-Enhance-Provider')||'local';
    const method=response.headers.get('X-Enhance-Mode-Label')||'';
    const reason=response.headers.get('X-Enhance-Reason')||'';
    const quotaState=response.headers.get('X-AI-Enhance-Quota-State')||'';
    const remaining=Number(response.headers.get('X-AI-Enhance-Remaining')||0);
    if(!isCurrentEnhanceRun(selectionToken, requestToken, sourceFile))return;
    stopEnhanceProgressMessages();
    setEnhanceStatus(enhanceReadyStatusText({method,reason,provider,quotaState,remaining}));
  }catch(error){
    if(error?.name==='AbortError'||!isCurrentEnhanceRun(selectionToken, requestToken, sourceFile))return;
    stopEnhanceProgressMessages();
    setEnhanceStatus(friendlyEnhanceError(error));
  }finally{
    if(isCurrentEnhanceRun(selectionToken, requestToken, sourceFile)){
      enhanceActiveRequestController=null;
      setEnhanceButtonMode(enhanceButtonMode);
    }
  }
}

function refreshEnhanceSelectedInfo(){
  if(enhanceSelectedFile&&enhanceSelectedMeta?.image){
    renderEnhanceSelectedInfo(enhanceSelectedFile, enhanceSelectedMeta.image);
  }
}

function voidSanitizeDownloadFilename(value){
  return String(value||'').trim().replace(/[\\/:*?"<>|]+/g,'-').replace(/^-+|-+$/g,'').slice(0,120)||'download';
}

function voidFilenameFromDisposition(value, fallback=''){
  const header=String(value||'');
  const encoded=header.match(/filename\*=UTF-8''([^;]+)/i);
  if(encoded){
    try{return voidSanitizeDownloadFilename(decodeURIComponent(encoded[1]));}catch{}
  }
  const plain=header.match(/filename="([^"]+)"|filename=([^;]+)/i);
  return voidSanitizeDownloadFilename(plain?.[1]||plain?.[2]||fallback);
}

function attachEnhanceEvents(){
  const input=$('#enhanceWallpaperFile');
  const dropzone=$('#enhanceDropzone');
  if(!input||!dropzone)return;
  setupEnhanceDownloadDelegation();
  input.addEventListener('change',()=>{
    const file=input.files?.[0];
    if(!file)return;
    requireUser('enhance', ()=>handleEnhanceFile(file));
  });
  ['dragenter', 'dragover'].forEach((eventName)=>{
    dropzone.addEventListener(eventName, (event)=>{
      event.preventDefault();
      dropzone.classList.add('drag-over');
    });
  });
  ['dragleave', 'drop'].forEach((eventName)=>{
    dropzone.addEventListener(eventName, (event)=>{
      event.preventDefault();
      dropzone.classList.remove('drag-over');
    });
  });
  dropzone.addEventListener('drop', (event)=>{
    const file=event.dataTransfer.files?.[0];
    if(!file)return;
    requireUser('enhance', ()=>handleEnhanceFile(file));
  });
  $('#enhanceBtn')?.addEventListener('click',()=>requireUser('enhance', enhanceSelectedWallpaper));
  $('#enhanceResetBtn')?.addEventListener('click',()=>resetEnhanceTool());
  const releaseEnhancePageResources=()=>{
    stopEnhanceProgressMessages();
    cancelActiveEnhanceRequest();
    releaseEnhanceDownloadItem(enhanceDownloadItem, {beacon:true, keepalive:true});
    clearEnhanceObjectUrls();
  };
  window.addEventListener('beforeunload', releaseEnhancePageResources);
  window.addEventListener('pagehide', releaseEnhancePageResources);
}
