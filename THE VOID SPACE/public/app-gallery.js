function wallpaperCardMarkup(item,index=0){
  const creator=item.creator||'The Void';
  const creatorUsername=normalizeUsernameInput(creator);
  const title=escapeHtml(item.title||'Untitled wallpaper');
  const id=escapeHtml(item.id);
  const creatorMarkup=creatorUsername?`<button class="wallpaper-creator-link wallpaper-pill-creator" type="button" data-profile-username="${escapeHtml(creatorUsername)}" aria-label="Open @${escapeHtml(creator)} profile">@${escapeHtml(creator)}</button>`:`<span class="wallpaper-creator-text wallpaper-pill-creator">@${escapeHtml(creator)}</span>`;
  const cardIndex=Math.max(0,Number(index)||0);
  const wallpaperDelay=Math.min(cardIndex,8)*18;
  const eager=cardIndex<4;
  return `
    <article class="wallpaper-card wallpaper-tile-card" style="--wallpaper-index:${cardIndex};--wallpaper-delay:${wallpaperDelay}ms">
      <button class="wallpaper-image-wrap wallpaper-tile-preview" type="button" data-wallpaper-actions-id="${id}" aria-label="Show actions for ${title}" aria-expanded="false">
        <img class="wallpaper-media" src="${escapeHtml(item.thumbUrl || item.mediaUrl)}" data-full-src="${escapeHtml(item.mediaUrl)}" alt="${title}" loading="${eager?'eager':'lazy'}" fetchpriority="${eager?'high':'auto'}" decoding="async" width="360" height="640" />
      </button>
      <div class="wallpaper-tile-actions" aria-label="${title} actions">
        <button class="wallpaper-action wallpaper-tile-action" type="button" data-preview-id="${id}" aria-label="Preview ${title}">
          <span class="wallpaper-action-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M1.5 12s3.8-6.5 10.5-6.5S22.5 12 22.5 12 18.7 18.5 12 18.5 1.5 12 1.5 12Z"></path><circle cx="12" cy="12" r="3.25"></circle></svg>
          </span>
          <span>Preview</span>
        </button>
        <a class="wallpaper-action wallpaper-tile-action" href="${escapeHtml(wallpaperDownloadUrl(item.id,item))}" download="${escapeHtml(wallpaperDownloadFilename(item))}" target="_blank" rel="noopener noreferrer" data-download-id="${id}" aria-label="Download ${title}">
          <span class="wallpaper-action-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5v11"></path><path d="m7.8 10.8 4.2 4.2 4.2-4.2"></path><path d="M4.5 18.5h15"></path></svg>
          </span>
          <span>Download</span>
        </a>
      </div>
      <div class="wallpaper-detail-pill" aria-label="${title} by ${escapeHtml(creator)}">
        <span class="wallpaper-pill-title">${title}</span>
        <span class="wallpaper-pill-row">by ${creatorMarkup}</span>
      </div>
    </article>
  `;}
function attachWallpaperCardHandlers(root=document){setupWallpaperDownloadDelegation();setupWallpaperActionOverlayDelegation();root.querySelectorAll('[data-wallpaper-actions-id]').forEach((button)=>{if(button.dataset.voidActionsBound)return;button.dataset.voidActionsBound='1';button.addEventListener('click',()=>toggleWallpaperTileActions(button));});root.querySelectorAll('[data-preview-id]').forEach((button)=>{if(button.dataset.voidPreviewBound)return;button.dataset.voidPreviewBound='1';button.addEventListener('click',()=>{closeWallpaperTileActions();const openedFromSearch=Boolean(button.closest('#searchModal')||button.closest('#wallpaperSearchResults'));openWallpaperPreview(button.dataset.previewId,{openedFromSearch});});});root.querySelectorAll('.wallpaper-creator-link').forEach((button)=>{if(button.dataset.voidProfileBound)return;button.dataset.voidProfileBound='1';button.addEventListener('click',()=>openProfileModal(button.dataset.profileUsername||''));});}
let wallpaperDownloadDelegated=false;
let wallpaperActionOverlayDelegated=false;
let pendingWallpaperDownload=null;
const GUEST_DOWNLOAD_LIMIT_PER_WEEK=2;
const GUEST_DOWNLOAD_QUOTA_KEY='theVoid.guestDownloadQuota.v1';
const GUEST_DOWNLOAD_LIMIT_MESSAGE='You have used your guest downloads for this week. Login to keep downloading.';
function closeWallpaperTileActions(exceptCard=null){
  document.querySelectorAll('.wallpaper-tile-card.actions-open').forEach((card)=>{
    if(exceptCard&&card===exceptCard)return;
    card.classList.remove('actions-open');
    card.querySelector('[data-wallpaper-actions-id]')?.setAttribute('aria-expanded','false');
  });
}
function toggleWallpaperTileActions(button){
  const card=button.closest('.wallpaper-tile-card');
  if(!card)return;
  const open=!card.classList.contains('actions-open');
  closeWallpaperTileActions(open?card:null);
  card.classList.toggle('actions-open',open);
  button.setAttribute('aria-expanded',String(open));
}
function setupWallpaperActionOverlayDelegation(){
  if(wallpaperActionOverlayDelegated)return;
  wallpaperActionOverlayDelegated=true;
  document.addEventListener('click',(event)=>{
    if(event.target?.closest?.('.wallpaper-tile-card'))return;
    closeWallpaperTileActions();
  },true);
  document.addEventListener('keydown',(event)=>{
    if(event.key==='Escape')closeWallpaperTileActions();
  });
}
function setupWallpaperDownloadDelegation(){
  if(wallpaperDownloadDelegated)return;
  wallpaperDownloadDelegated=true;
  document.addEventListener('click',handleWallpaperDownloadClick,true);
}
function handleWallpaperDownloadClick(event){
  const link=event.target?.closest?.('[data-download-id]');
  if(!link||!document.contains(link))return;
  const id=link.dataset.downloadId;
  if(!id)return;
  const item=approvedWallpapers.find((wallpaper)=>wallpaper.id===id);
  prepareWallpaperDownloadLink(link,id,item);
  if(getUser()){
    return;
  }
  if(!reserveLocalGuestDownload()){
    event.preventDefault();
    event.stopPropagation();
    promptWallpaperDownloadLogin(id,item,GUEST_DOWNLOAD_LIMIT_MESSAGE);
  }
}
function currentGuestDownloadWeekKey(date=new Date()){
  const utc=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),date.getUTCDate()));
  const day=utc.getUTCDay()||7;
  utc.setUTCDate(utc.getUTCDate()+4-day);
  const yearStart=new Date(Date.UTC(utc.getUTCFullYear(),0,1));
  const week=Math.ceil((((utc-yearStart)/86400000)+1)/7);
  return `${utc.getUTCFullYear()}-W${String(week).padStart(2,'0')}`;
}
function reserveLocalGuestDownload(){
  try{
    const weekKey=currentGuestDownloadWeekKey();
    const quota=JSON.parse(localStorage.getItem(GUEST_DOWNLOAD_QUOTA_KEY)||'null')||{};
    const used=quota.weekKey===weekKey?Number(quota.used||0):0;
    if(used>=GUEST_DOWNLOAD_LIMIT_PER_WEEK)return false;
    localStorage.setItem(GUEST_DOWNLOAD_QUOTA_KEY,JSON.stringify({weekKey,used:used+1,updatedAt:new Date().toISOString()}));
    return true;
  }catch{
    return true;
  }
}
function resumePendingWallpaperDownload(){
  const pending=pendingWallpaperDownload;
  pendingWallpaperDownload=null;
  if(!pending?.id)return;
  window.setTimeout(()=>startWallpaperDownload(pending.id,pending.item),0);
}
function promptWallpaperDownloadLogin(id,item,message='Login to download wallpapers.'){
  pendingWallpaperDownload={id,item};
  const previewModal=$('#wallpaperPreviewModal');
  if(previewModal&&!previewModal.classList.contains('hidden'))closeWallpaperPreview();
  showLoginModal({intent:'login',onReady:resumePendingWallpaperDownload});
  showResponseToast(message);
}
function prepareWallpaperDownloadLink(link,id,item){
  link.href=wallpaperDownloadUrl(id,item);
  link.download=wallpaperDownloadFilename(item);
  link.target='_blank';
  link.rel='noopener noreferrer';
}
function startWallpaperDownload(id,item){
  const url=wallpaperDownloadUrl(id,item);
  const opened=window.open(url,'_blank');
  if(opened){
    opened.opener=null;
    return;
  }
  window.location.assign(url);
}
function clearWallpaperLoadMoreSentinel(){const sentinel=$('#wallpaperLoadMoreSentinel');if(sentinel)sentinel.remove();}
function renderWallpapers(){const grid=$('#wallpapersGrid');const empty=$('#wallpapersEmpty');if(!grid||!empty)return;clearWallpaperLoadMoreSentinel();grid.innerHTML='';empty.classList.add('hidden');if(!approvedWallpapers.length){empty.classList.remove('hidden');empty.textContent='No wallpapers yet. New uploads appear here after review.';return;}const template=document.createElement('template');template.innerHTML=approvedWallpapers.map((item,index)=>wallpaperCardMarkup(item,index)).join('');attachWallpaperCardHandlers(template.content);grid.appendChild(template.content);}
function wallpaperDownloadExtension(item){
  const mime=String(item?.mime||'').toLowerCase();
  if(mime==='image/jpeg')return'jpg';
  if(mime==='image/png')return'png';
  if(mime==='image/webp')return'webp';
  const source=String(item?.mediaUrl||'').split('?')[0];
  const match=source.match(/\.([a-z0-9]+)$/i);
  const ext=match?match[1].toLowerCase():'jpg';
  return ['jpg','jpeg','png','webp'].includes(ext)?ext:'jpg';
}
function wallpaperDownloadFilename(item){
  return `${safeFileName(item?.title||'wallpaper')}.${wallpaperDownloadExtension(item)}`;
}
function wallpaperDownloadUrl(id,item){
  const source=item?.downloadUrl||item?.mediaUrl||`/api/download/${encodeURIComponent(id)}`;
  try{
    const url=new URL(source, window.location.href);
    if(item?.mediaUrl&&source===item.mediaUrl)url.searchParams.set('download', wallpaperDownloadFilename(item));
    url.searchParams.set('t', String(Date.now()));
    return url.toString();
  }catch{
    return `/api/download/${encodeURIComponent(id)}?t=${Date.now()}`;
  }
}
function safeFileName(value) {
  return String(value || 'wallpaper').trim().replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'wallpaper';
}
const WALLPAPER_PREVIEW_MIN_LOADING_MS = 1300;
let wallpaperPreviewLoadToken = 0;
let wallpaperPreviewLoadingStartedAt = 0;
let wallpaperPreviewLoadingTimer = 0;
let wallpaperPreviewState={id:'',item:null,image:null};
let wallpaperPreviewViewportProbe = null;
function wallpaperPreviewNow() {
  return window.performance?.now ? window.performance.now() : Date.now();
}
function wallpaperPreviewSmallViewportHeight() {
  if (!wallpaperPreviewViewportProbe) {
    wallpaperPreviewViewportProbe = document.createElement('i');
    wallpaperPreviewViewportProbe.setAttribute('aria-hidden', 'true');
    Object.assign(wallpaperPreviewViewportProbe.style, {
      position: 'fixed',
      inset: '0 auto auto 0',
      width: '1px',
      height: '100svh',
      visibility: 'hidden',
      pointerEvents: 'none',
      contain: 'strict',
    });
    document.body.appendChild(wallpaperPreviewViewportProbe);
  }
  return wallpaperPreviewViewportProbe.getBoundingClientRect().height || window.innerHeight || 0;
}
function syncWallpaperPreviewViewportMode() {
  const modal = $('#wallpaperPreviewModal');
  if (!modal) return;
  const dynamicHeight = window.visualViewport?.height || window.innerHeight || document.documentElement.clientHeight || 0;
  const smallHeight = wallpaperPreviewSmallViewportHeight();
  modal.classList.toggle('preview-borderless', dynamicHeight - smallHeight > 24);
}
function setWallpaperPreviewLoading(isLoading) {
  const modal = $('#wallpaperPreviewModal');
  if (!modal) return;
  window.clearTimeout(wallpaperPreviewLoadingTimer);
  wallpaperPreviewLoadingTimer = 0;
  wallpaperPreviewLoadingStartedAt = isLoading ? wallpaperPreviewNow() : 0;
  modal.classList.toggle('preview-loading', Boolean(isLoading));
}
function finishWallpaperPreviewLoading(token) {
  const modal = $('#wallpaperPreviewModal');
  if (!modal || token !== wallpaperPreviewLoadToken || modal.classList.contains('hidden')) return;
  const elapsed = wallpaperPreviewNow() - wallpaperPreviewLoadingStartedAt;
  const remaining = Math.max(0, WALLPAPER_PREVIEW_MIN_LOADING_MS - elapsed);
  window.clearTimeout(wallpaperPreviewLoadingTimer);
  wallpaperPreviewLoadingTimer = window.setTimeout(() => {
    const currentModal = $('#wallpaperPreviewModal');
    if (!currentModal || token !== wallpaperPreviewLoadToken || currentModal.classList.contains('hidden')) return;
    setWallpaperPreviewLoading(false);
  }, remaining);
}
function clearApprovedPreviewCanvases() {
  ['#approvedLockCanvas', '#approvedHomeCanvas'].forEach((selector) => {
    const canvas = $(selector);
    if (!canvas) return;
    canvas.classList.remove('void-media-ready');
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);
  });
}
function renderWallpaperPreviewCanvases(){
  const modal=$('#wallpaperPreviewModal');
  const image=wallpaperPreviewState.image;
  if(!modal||modal.classList.contains('hidden')||!image)return;
  const token=wallpaperPreviewLoadToken;
  const lockCanvas=$('#approvedLockCanvas');
  const homeCanvas=$('#approvedHomeCanvas');
  const readyCanvases=[];
  if(lockCanvas){
    lockCanvas.classList.remove('void-media-ready');
    drawPreviewToCanvas(lockCanvas,lockCanvas.getContext('2d'),image,'lock',{drawGrid:false,adjusted:false});
    readyCanvases.push(lockCanvas);
  }
  if(homeCanvas){
    homeCanvas.classList.remove('void-media-ready');
    drawPreviewToCanvas(homeCanvas,homeCanvas.getContext('2d'),image,'home',{drawGrid:false,adjusted:false});
    readyCanvases.push(homeCanvas);
  }
  requestAnimationFrame(()=>{
    readyCanvases.forEach((canvas)=>canvas.classList.add('void-media-ready'));
    requestAnimationFrame(()=>finishWallpaperPreviewLoading(token));
  });
}
function updateApprovedPreviewDots(){
  const track=$('#approvedPreviewTrack');
  const buttons=$$('.approved-preview-side [data-preview-slide]');
  if(!track)return;
  const items=[...track.querySelectorAll('.approved-preview-item')];
  const targets=items.map((item)=>approvedPreviewTargetLeft(track,item));
  const index=targets.length>1&&Math.abs(track.scrollLeft-targets[1])<Math.abs(track.scrollLeft-targets[0])?1:0;
  buttons.forEach((button)=>button.classList.toggle('active',Number(button.dataset.previewSlide)===index));
}
function approvedPreviewTargetLeft(track,item){
  const max=Math.max(0,track.scrollWidth-track.clientWidth);
  const centered=item.offsetLeft-((track.clientWidth-item.clientWidth)/2);
  return Math.max(0,Math.min(max,centered));
}
function setApprovedPreviewSlide(index,behavior='smooth'){
  const track=$('#approvedPreviewTrack');
  if(!track)return;
  const target=Math.max(0,Math.min(1,Number(index)||0));
  const item=track.querySelectorAll('.approved-preview-item')[target];
  track.scrollTo({left:item?approvedPreviewTargetLeft(track,item):track.clientWidth*target,behavior});
  window.requestAnimationFrame(updateApprovedPreviewDots);
}
function resetApprovedPreviewSwipe(){
  setApprovedPreviewSlide(0,'auto');
}
function setupWallpaperPreviewSwipe(){
  const track=$('#approvedPreviewTrack');
  if(!track||track.dataset.voidSwipeBound)return;
  track.dataset.voidSwipeBound='1';
  track.addEventListener('scroll',()=>window.requestAnimationFrame(updateApprovedPreviewDots),{passive:true});
  $$('.approved-preview-side [data-preview-slide]').forEach((button)=>{
    button.addEventListener('click',()=>setApprovedPreviewSlide(button.dataset.previewSlide));
  });
  window.addEventListener('resize',()=>window.requestAnimationFrame(()=>{syncWallpaperPreviewViewportMode();updateApprovedPreviewDots();}));
  window.visualViewport?.addEventListener('resize',()=>window.requestAnimationFrame(()=>{syncWallpaperPreviewViewportMode();updateApprovedPreviewDots();}));
}
function openWallpaperPreview(id, options = {}) {
  const item = approvedWallpapers.find((wallpaper) => wallpaper.id === id);
  if (!item) return;
  const token = ++wallpaperPreviewLoadToken;
  $('#wallpaperPreviewTitle').textContent = item.title;
  $('#wallpaperPreviewCreator').textContent = `by ${item.creator || 'The Void'}`;
  wallpaperPreviewState={id,item,image:null};
  $$('[data-preview-download]').forEach((downloadLink)=>{
    prepareWallpaperDownloadLink(downloadLink,id,item);
    downloadLink.dataset.downloadId=id;
    downloadLink.setAttribute('aria-label',`Download ${item.title||'wallpaper'}`);
  });
  clearApprovedPreviewCanvases();
  const modal = $('#wallpaperPreviewModal');
  modal.dataset.previewId = id;
  modal.classList.toggle('opened-from-search', Boolean(options.openedFromSearch));
  setWallpaperPreviewLoading(true);
  const wasHidden = modal.classList.contains('hidden');
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
  syncWallpaperPreviewViewportMode();
  if (wasHidden) lockPageScroll();
  resetApprovedPreviewSwipe();

  const image = new Image();
  image.decoding = 'async';
  image.onload = () => {
    if (token !== wallpaperPreviewLoadToken || modal.dataset.previewId !== id || modal.classList.contains('hidden')) return;
    wallpaperPreviewState.image=image;
    renderWallpaperPreviewCanvases();
  };
  image.onerror = () => {
    if (token !== wallpaperPreviewLoadToken) return;
    const fallback = item.mediaUrl;
    const fallbackUrl = fallback ? new URL(fallback, window.location.href).href : '';
    if (fallbackUrl && image.src !== fallbackUrl) {
      image.src = fallbackUrl;
      return;
    }
    setWallpaperPreviewLoading(false);
  };

  image.src = item.previewUrl || item.mediaUrl;
}
function closeWallpaperPreview() {
  const modal = $('#wallpaperPreviewModal');
  if (!modal) return;
  if (modal.classList.contains('hidden')) return;
  wallpaperPreviewLoadToken += 1;
  wallpaperPreviewState={id:'',item:null,image:null};
  clearApprovedPreviewCanvases();
  setWallpaperPreviewLoading(false);
  $$('[data-preview-download]').forEach((downloadLink)=>{
    downloadLink.removeAttribute('data-download-id');
    downloadLink.href='#';
    downloadLink.removeAttribute('download');
    downloadLink.removeAttribute('aria-label');
  });
  modal.classList.add('hidden');
  modal.classList.remove('opened-from-search');
  modal.classList.remove('preview-borderless');
  modal.removeAttribute('data-preview-id');
  modal.setAttribute('aria-hidden', 'true');
  unlockPageScroll();
}
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  }[char]));
}
(function(){
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const lowPowerScroll = reduceMotion;
  const mediaSelector = '.wallpaper-media, .profile-post-card img, .profile-post-edit-card > img, .profile-avatar img';
  const pressSelector = 'a, button, [role="button"], label.dropzone, .preset-card, .wallpaper-card, .profile-post-card, .void-menu-item, .login-tab, .wallpaper-action, .reset-pill';
  const mediaWrapSelector = '.wallpaper-image-wrap, .profile-post-card, .profile-post-edit-card';
  const protectedMediaSelector = '.wallpaper-media, .wallpaper-card img, .wallpaper-image-wrap img, .queue-image, .profile-post-card img, .profile-post-edit-card img, .profile-avatar img, .creator-search-avatar img, .selected-thumb, .enhance-preview img, #enhancePreviewImage, .approved-phone-frame canvas, .phone-frame canvas';
  const protectedMediaPressSelector = `${protectedMediaSelector}, .wallpaper-image-wrap, .wallpaper-tile-card, .profile-post-card, .profile-post-edit-card, .profile-avatar, .creator-search-avatar, .selected-thumb-frame, .enhance-preview, .approved-phone-frame, .phone-frame, .queue-image-link`;

  function collectElements(root, selector) {
    if (!root) return [];
    const elements = [];
    if (root.nodeType === 1 && root.matches && root.matches(selector)) elements.push(root);
    if (root.querySelectorAll) elements.push(...root.querySelectorAll(selector));
    return elements;
  }

  function closestMotionWrap(element) {
    return element.closest('.wallpaper-image-wrap, .profile-post-card, .profile-post-edit-card, .profile-avatar, .approved-phone-frame') || element.parentElement;
  }

  function markMediaReady(element) {
    if (!element) return;
    element.classList.add('void-media-ready');
    closestMotionWrap(element)?.classList.add('void-media-wrap-ready');
  }

  function prepareMedia(root) {
    collectElements(root, mediaSelector).forEach((element) => {
      if (element.dataset.voidMotionMedia) return;
      element.dataset.voidMotionMedia = '1';
      if (lowPowerScroll) {
        markMediaReady(element);
        return;
      }
      if (element.complete && element.naturalWidth) {
        requestAnimationFrame(() => markMediaReady(element));
        return;
      }
      element.addEventListener('load', () => markMediaReady(element), { once: true });
      element.addEventListener('error', () => {
        const fallback = element.dataset.fullSrc;
        if (fallback && element.getAttribute('src') !== fallback) {
          element.setAttribute('src', fallback);
          return;
        }
        markMediaReady(element);
      });
    });
  }

  function prepareCanvasMedia(root) {
    collectElements(root, '.approved-phone-frame canvas').forEach((canvas) => {
      if (canvas.dataset.voidMotionCanvas) return;
      canvas.dataset.voidMotionCanvas = '1';
      if (lowPowerScroll) {
        markMediaReady(canvas);
        return;
      }
      canvas.classList.remove('void-media-ready');
      setTimeout(() => markMediaReady(canvas), 90);
    });
  }

  function prepareMediaWrappers(root) {
    collectElements(root, mediaWrapSelector).forEach((wrap) => {
      if (wrap.querySelector && !wrap.querySelector(mediaSelector)) {
        wrap.classList.add('void-media-wrap-ready');
      }
    });
  }

  function prepareProtectedMedia(root) {
    collectElements(root, protectedMediaSelector).forEach((element) => {
      if (element.dataset.voidMediaProtected) return;
      element.dataset.voidMediaProtected = '1';
      if ('draggable' in element) element.draggable = false;
      element.setAttribute('aria-live', element.getAttribute('aria-live') || 'off');
    });
  }

  function isProtectedMediaTarget(target) {
    return Boolean(target?.closest?.(protectedMediaPressSelector));
  }

  function attachProtectedMediaGuards() {
    document.addEventListener('contextmenu', (event) => {
      if (!isProtectedMediaTarget(event.target)) return;
      event.preventDefault();
    }, true);
    document.addEventListener('dragstart', (event) => {
      if (!isProtectedMediaTarget(event.target)) return;
      event.preventDefault();
    }, true);
    document.addEventListener('selectstart', (event) => {
      if (!isProtectedMediaTarget(event.target)) return;
      event.preventDefault();
    }, true);
  }

  function prepareMotion(root = document) {
    prepareMedia(root);
    prepareCanvasMedia(root);
    prepareMediaWrappers(root);
    prepareProtectedMedia(root);
  }

  function attachPressFeedback() {
    document.addEventListener('pointerdown', (event) => {
      const target = event.target.closest(pressSelector);
      if (!target || target.disabled || target.getAttribute('aria-disabled') === 'true') return;
      target.classList.remove('void-press');
      void target.offsetWidth;
      target.classList.add('void-press');
      window.setTimeout(() => target.classList.remove('void-press'), 320);
    }, { passive: true });
  }

  function watchDom() {
    const pendingNodes = new Set();
    let scheduled = false;
    const flush = () => {
      scheduled = false;
      const nodes = [...pendingNodes];
      pendingNodes.clear();
      nodes.forEach((node) => prepareMotion(node));
    };
    const scheduleFlush = () => {
      if (scheduled) return;
      scheduled = true;
      if ('requestIdleCallback' in window) {
        window.requestIdleCallback(flush, { timeout: 300 });
      } else {
        window.requestAnimationFrame(flush);
      }
    };
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType !== 1) return;
          pendingNodes.add(node);
        });
      });
      if (pendingNodes.size) scheduleFlush();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { prepareMotion(); attachProtectedMediaGuards(); attachPressFeedback(); watchDom(); }, { once: true });
  } else {
    prepareMotion();
    attachProtectedMediaGuards();
    attachPressFeedback();
    watchDom();
  }
})();

function setupHeroPerformanceGuard(){
  const hero=document.querySelector('.app-hero');
  if(!hero || !('IntersectionObserver' in window)) return;
  const root=document.documentElement;
  const observer=new IntersectionObserver((entries)=>{
    const visible=entries.some((entry)=>entry.isIntersecting);
    root.classList.toggle('void-hero-paused', !visible);
  }, {threshold:0});
  observer.observe(hero);
}
