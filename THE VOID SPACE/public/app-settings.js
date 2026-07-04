let voidNotificationsCache=[];
let voidLatestNotificationId='';
let voidLatestActiveNotificationId='';
let voidNotificationPollTimer=null;
const VOID_LOGIN_NOTIFICATION_INTERVAL_MS=6*60*60*1000;

function voidSettingsEscape(value){
  return String(value||'').replace(/[&<>"']/g,(char)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));
}

async function voidSettingsApi(url, options={}){
  const response=await fetch(url, {
    method:options.method||'GET',
    headers:{'Content-Type':'application/json', ...(options.headers||{})},
    body:options.body,
    credentials:'same-origin',
    cache:'no-store',
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(formatAuthError?.(data.error)||data.error||'Request failed.');
  return data;
}

function voidFeedbackTypeLabel(type){
  return String(type||'').toLowerCase()==='bug'?'Bug report':'Feedback';
}

function voidFeedbackStatusLabel(status){
  return String(status||'new')==='reviewed'?'Reviewed':'New';
}

function voidFeedbackTime(value){
  if(!value)return'';
  try{return new Date(value).toLocaleString();}catch{return'';}
}

function voidFeedbackThreadSkeletonMarkup(){
  return `<article class="void-feedback-chat-group void-feedback-chat-skeleton" aria-hidden="true">
      <div class="void-feedback-bubble void-feedback-bubble-user">
        <span class="void-feedback-skeleton-line void-feedback-skeleton-title"></span>
        <span class="void-feedback-skeleton-line"></span>
        <span class="void-feedback-skeleton-line short"></span>
      </div>
      <div class="void-feedback-bubble void-feedback-bubble-admin">
        <span class="void-feedback-skeleton-line void-feedback-skeleton-title"></span>
        <span class="void-feedback-skeleton-line"></span>
        <span class="void-feedback-skeleton-line medium"></span>
      </div>
    </article>
    <article class="void-feedback-chat-group void-feedback-chat-skeleton" aria-hidden="true">
      <div class="void-feedback-bubble void-feedback-bubble-user">
        <span class="void-feedback-skeleton-line void-feedback-skeleton-title"></span>
        <span class="void-feedback-skeleton-line medium"></span>
        <span class="void-feedback-skeleton-line short"></span>
      </div>
    </article>`;
}

function renderVoidFeedbackThread(feedback=[]){
  const thread=document.querySelector('#voidFeedbackThread');
  if(!thread)return;
  const items=(Array.isArray(feedback)?feedback:[]).slice().sort((a,b)=>String(a.createdAt||'').localeCompare(String(b.createdAt||'')));
  if(!items.length){
    thread.innerHTML='<p class="void-feedback-empty">No feedback sent yet.</p>';
    return;
  }
  thread.innerHTML=items.map((item)=>{
    const reply=String(item.reply||item.adminReply||'').trim();
    return `<article class="void-feedback-chat-group">
      <div class="void-feedback-bubble void-feedback-bubble-user">
        <div class="void-feedback-bubble-head">
          <strong>${voidSettingsEscape(voidFeedbackTypeLabel(item.type))}</strong>
          <span>${voidSettingsEscape(voidFeedbackStatusLabel(item.status))}</span>
        </div>
        <p>${voidSettingsEscape(item.message||'')}</p>
        <small>${voidSettingsEscape(voidFeedbackTime(item.createdAt))}</small>
      </div>
      ${reply?`<div class="void-feedback-bubble void-feedback-bubble-admin">
        <div class="void-feedback-bubble-head">
          <strong>THE VOID SPACE</strong>
          <span>Reply</span>
        </div>
        <p>${voidSettingsEscape(reply)}</p>
        <small>${voidSettingsEscape(voidFeedbackTime(item.repliedAt||item.reviewedAt))}</small>
      </div>`:''}
    </article>`;
  }).join('');
  thread.scrollTop=thread.scrollHeight;
}

async function loadVoidFeedbackThread(){
  const thread=document.querySelector('#voidFeedbackThread');
  if(thread&&!thread.dataset.loaded)thread.innerHTML=voidFeedbackThreadSkeletonMarkup();
  const data=await voidSettingsApi('/api/feedback');
  renderVoidFeedbackThread(data.feedback||[]);
  if(thread)thread.dataset.loaded='1';
  return data.feedback||[];
}

function showVoidNotificationToast(notification){
  if(!notification?.message)return;
  let toast=document.querySelector('#voidNotificationToast');
  if(!toast){
    toast=document.createElement('article');
    toast.id='voidNotificationToast';
    toast.className='void-notification-toast hidden';
    toast.setAttribute('role','button');
    toast.tabIndex=0;
    toast.setAttribute('aria-label','Open notifications');
    document.body.appendChild(toast);
  }
  if(!toast.dataset.openNotificationsBound){
    const open=()=>openVoidNotificationsFromToast();
    toast.addEventListener('click',open);
    toast.addEventListener('keydown',(event)=>{
      if(event.key==='Enter'||event.key===' '){
        event.preventDefault();
        open();
      }
    });
    toast.dataset.openNotificationsBound='1';
  }
  toast.innerHTML=`<strong>${voidSettingsEscape(notification.title||'Notification')}</strong><span class="void-notification-toast-message">${voidSettingsEscape(notification.message)}</span><em class="void-notification-toast-more">Show more</em>`;
  toast.classList.remove('hidden');
  window.clearTimeout(showVoidNotificationToast.timer);
  showVoidNotificationToast.timer=window.setTimeout(()=>toast.classList.add('hidden'),5200);
}

function openVoidNotificationsFromToast(){
  const toast=document.querySelector('#voidNotificationToast');
  if(toast)toast.classList.add('hidden');
  showNotificationsModal();
}

function latestPopupNotification(notifications=[]){
  const latest=notifications[0]||null;
  return latest&&!latest.silent?latest:null;
}

function voidLoginNotificationKey(){
  const user=typeof getUser==='function'?getUser():null;
  return `void.lastNotificationPopup.${user?.creatorId||user?.creatorName||'guest'}`;
}

function voidNotificationSeenKey(){
  const user=typeof getUser==='function'?getUser():null;
  return `void.lastSeenNotification.${user?.creatorId||user?.creatorName||'guest'}`;
}

function setVoidNotificationBadge(visible){
  const button=document.querySelector('#menuNotificationsBtn');
  const badge=document.querySelector('#menuNotificationsBadge');
  button?.classList.toggle('void-menu-has-notifications', Boolean(visible));
  if(badge){
    badge.classList.toggle('hidden', !visible);
    badge.setAttribute('aria-hidden', String(!visible));
  }
}

function updateVoidNotificationBadge(){
  const latestId=voidLatestActiveNotificationId||voidNotificationsCache[0]?.id||'';
  if(!latestId){
    setVoidNotificationBadge(false);
    return;
  }
  let seen='';
  try{seen=localStorage.getItem(voidNotificationSeenKey())||'';}catch{}
  setVoidNotificationBadge(seen!==latestId);
}

function markVoidNotificationsSeen(){
  const latestId=voidLatestActiveNotificationId||voidNotificationsCache[0]?.id||'';
  if(latestId){
    try{localStorage.setItem(voidNotificationSeenKey(), latestId);}catch{}
  }
  updateVoidNotificationBadge();
}

function canShowLoginNotification(){
  try{
    const last=Number(localStorage.getItem(voidLoginNotificationKey())||0);
    return !last||Date.now()-last>=VOID_LOGIN_NOTIFICATION_INTERVAL_MS;
  }catch{
    return true;
  }
}

function markLoginNotificationShown(){
  try{localStorage.setItem(voidLoginNotificationKey(), String(Date.now()));}catch{}
}

function renderVoidNotificationsList(){
  const list=document.querySelector('#voidNotificationsList');
  if(!list)return;
  if(!voidNotificationsCache.length){
    list.innerHTML='<p class="empty-text">No notifications yet.</p>';
    return;
  }
  list.innerHTML=voidNotificationsCache.map((item)=>`
    <article class="settings-list-item">
      <strong>${voidSettingsEscape(item.title||'Notification')}</strong>
      <p>${voidSettingsEscape(item.message)}</p>
      <small>${item.createdAt?new Date(item.createdAt).toLocaleString():''}</small>
    </article>
  `).join('');
}

async function loadVoidNotifications(options={}){
  const data=await voidSettingsApi('/api/notifications').catch(()=>({notifications:[]}));
  const notifications=Array.isArray(data.notifications)?data.notifications:[];
  voidNotificationsCache=notifications;
  voidLatestActiveNotificationId=notifications[0]?.id||'';
  renderVoidNotificationsList();
  if(document.querySelector('#voidNotificationsModal'))markVoidNotificationsSeen();
  else updateVoidNotificationBadge();
  const latest=latestPopupNotification(notifications);
  if(latest&&options.announceLogin&&canShowLoginNotification()){
    showVoidNotificationToast(latest);
    markLoginNotificationShown();
  }else if(latest&&options.announceNew&&latest.id!==voidLatestNotificationId){
    showVoidNotificationToast(latest);
  }
  if(latest)voidLatestNotificationId=latest.id;
}

function closeVoidSettingsModal(modal){
  removeModal(modal);
}

function showNotificationsModal(){
  $('#voidMenuPanel')?.classList.add('hidden');
  $('#voidMenuToggle')?.setAttribute('aria-expanded','false');
  const existing=document.querySelector('#voidNotificationsModal');
  if(existing)return;
  const modal=document.createElement('div');
  modal.id='voidNotificationsModal';
  modal.className='settings-modal fullscreen-modal';
  modal.innerHTML=`
    <section class="settings-screen" role="dialog" aria-modal="true" aria-labelledby="voidNotificationsTitle">
      <button class="login-close-btn" type="button" aria-label="Close notifications">&times;</button>
      <div class="fullscreen-section-head">
        <p class="eyebrow">System</p>
        <h2 id="voidNotificationsTitle">Notifications</h2>
      </div>
      <div id="voidNotificationsList" class="settings-list"><p class="empty-text">Loading notifications...</p></div>
    </section>
  `;
  document.body.appendChild(modal);
  lockPageScroll();
  modal.querySelector('.login-close-btn')?.addEventListener('click',()=>closeVoidSettingsModal(modal));
  modal.addEventListener('click',(event)=>{if(event.target===modal)closeVoidSettingsModal(modal);});
  renderVoidNotificationsList();
  markVoidNotificationsSeen();
  loadVoidNotifications().catch(()=>{});
}

function showFeedbackModal(){
  $('#voidMenuPanel')?.classList.add('hidden');
  $('#voidMenuToggle')?.setAttribute('aria-expanded','false');
  const existing=document.querySelector('#voidFeedbackModal');
  if(existing)return;
  const modal=document.createElement('div');
  modal.id='voidFeedbackModal';
  modal.className='settings-modal fullscreen-modal';
  modal.innerHTML=`
    <section class="settings-screen" role="dialog" aria-modal="true" aria-labelledby="voidFeedbackTitle">
      <button class="login-close-btn" type="button" aria-label="Close feedback">&times;</button>
      <div class="fullscreen-section-head">
        <p class="eyebrow">Support</p>
        <h2 id="voidFeedbackTitle">Feedback</h2>
      </div>
      <div id="voidFeedbackThread" class="void-feedback-thread" aria-live="polite">${voidFeedbackThreadSkeletonMarkup()}</div>
      <form id="voidFeedbackForm" class="settings-form void-feedback-composer">
        <label class="field-label settings-select-label">Type<select id="voidFeedbackType" class="settings-select"><option value="feedback">Feedback</option><option value="bug">Bug report</option></select></label>
        <label class="field-label">Message<textarea id="voidFeedbackMessage" maxlength="1200" rows="4" placeholder="Write your message..."></textarea></label>
        <button class="primary-btn" type="submit">Send</button>
        <p id="voidFeedbackStatus" class="status-text"></p>
      </form>
    </section>
  `;
  document.body.appendChild(modal);
  lockPageScroll();
  const close=()=>closeVoidSettingsModal(modal);
  modal.querySelector('.login-close-btn')?.addEventListener('click',close);
  modal.addEventListener('click',(event)=>{if(event.target===modal)close();});
  loadVoidFeedbackThread().catch((error)=>{
    const thread=modal.querySelector('#voidFeedbackThread');
    if(thread)thread.innerHTML=`<p class="void-feedback-empty">${voidSettingsEscape(error.message||'Could not load feedback.')}</p>`;
  });
  modal.querySelector('#voidFeedbackForm')?.addEventListener('submit',async(event)=>{
    event.preventDefault();
    const status=modal.querySelector('#voidFeedbackStatus');
    const button=modal.querySelector('button[type="submit"]');
    const type=modal.querySelector('#voidFeedbackType')?.value||'feedback';
    const message=modal.querySelector('#voidFeedbackMessage')?.value.trim()||'';
    if(status)status.textContent='Sending feedback...';
    if(button)button.disabled=true;
    try{
      const data=await voidSettingsApi('/api/feedback', {method:'POST', body:JSON.stringify({type,message})});
      if(status){status.textContent=data.message||'Feedback sent.';if(typeof applyResponseMessageType==='function')applyResponseMessageType(status,status.textContent);}
      showResponseToast(data.message||'Feedback sent.',{type:'success'});
      const textarea=modal.querySelector('#voidFeedbackMessage');
      if(textarea)textarea.value='';
      await loadVoidFeedbackThread();
    }catch(error){
      if(status){status.textContent=error.message||'Could not send feedback.';if(typeof applyResponseMessageType==='function')applyResponseMessageType(status,status.textContent);}
    }finally{
      if(button)button.disabled=false;
    }
  });
}

function startVoidNotificationPolling(){
  if(voidNotificationPollTimer)return;
  loadVoidNotifications().catch(()=>{});
  voidNotificationPollTimer=window.setInterval(()=>loadVoidNotifications({announceNew:Boolean(getUser?.())}).catch(()=>{}),30000);
}

function attachVoidSettingsMenu(){
  $('#menuNotificationsBtn')?.addEventListener('click',showNotificationsModal);
  $('#menuFeedbackBtn')?.addEventListener('click',()=>requireUser('feedback',showFeedbackModal));
  window.addEventListener('void:user-login',()=>loadVoidNotifications({announceLogin:true}).catch(()=>{}));
  if(typeof window.setUser==='function'&&!window.__voidSettingsSetUserWrapped){
    const originalSetUser=window.setUser;
    window.setUser=function(...args){
      const result=originalSetUser.apply(this,args);
      window.dispatchEvent(new Event('void:user-login'));
      return result;
    };
    window.__voidSettingsSetUserWrapped=true;
  }
  startVoidNotificationPolling();
}

attachVoidSettingsMenu();
