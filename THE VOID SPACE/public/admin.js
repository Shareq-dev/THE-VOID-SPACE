const $=(selector)=>document.querySelector(selector);const adminSections={approval:'#approvalSection',existing:'#existingWallpapersSection',users:'#userIdsSection',notifications:'#notificationsSection',feedback:'#feedbackSection',};function randomId(){if(window.crypto?.randomUUID)return window.crypto.randomUUID();const bytes=new Uint8Array(16);window.crypto?.getRandomValues?.(bytes);return[...bytes].map((byte)=>byte.toString(16).padStart(2,'0')).join('')||`${Date.now()}-${Math.random()}`;}function getAdminBrowserKey(){let key=localStorage.getItem('adminBrowserKey');if(!key){key=randomId();localStorage.setItem('adminBrowserKey',key);}return key;}function showAdminHome(){$('#adminHome')?.classList.remove('hidden');Object.values(adminSections).forEach((selector)=>{$(selector)?.classList.add('hidden');});}function openAdminSection(sectionName){const target=adminSections[sectionName];if(!target)return;$('#adminHome')?.classList.add('hidden');Object.values(adminSections).forEach((selector)=>{$(selector)?.classList.add('hidden');});$(target)?.classList.remove('hidden');if(sectionName==='approval')loadQueue().catch((error)=>showResponseToast(error.message));if(sectionName==='existing')loadExisting().catch((error)=>showResponseToast(error.message));if(sectionName==='users')loadUsers().catch((error)=>showResponseToast(error.message));if(sectionName==='notifications')loadNotifications().catch((error)=>showResponseToast(error.message));if(sectionName==='feedback')loadFeedback().catch((error)=>showResponseToast(error.message));}function showResponseToast(message){const text=String(message||'').trim();if(!text)return;let toast=document.querySelector('#responseToast');if(!toast){toast=document.createElement('p');toast.id='responseToast';toast.className='response-toast hidden';toast.setAttribute('role','status');document.body.appendChild(toast);}toast.textContent=text;toast.classList.remove('response-success','response-warning','response-info');applyResponseMessageType(toast,text);toast.classList.remove('hidden');window.clearTimeout(showResponseToast.timer);showResponseToast.timer=window.setTimeout(()=>{toast.classList.add('hidden');},3200);}async function api(url,options={}){const response=await fetch(url,{headers:{'Content-Type':'application/json',...(options.headers||{})},...options,});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||'Request failed.');return data;}$('#loginBtn').addEventListener('click',login);$('#adminPassword').addEventListener('keydown',(event)=>{if(event.key==='Enter')login();});$('#logoutBtn').addEventListener('click',async()=>{await api('/api/admin/logout',{method:'POST'}).catch(()=>{});showLoggedOut();});$('#refreshExisting')?.addEventListener('click',()=>{if(!$('#queuePanel').classList.contains('hidden'))refreshAll();});$('#refreshUsers')?.addEventListener('click',()=>{if(!$('#queuePanel').classList.contains('hidden'))loadUsers();});$('#refreshNotifications')?.addEventListener('click',()=>loadNotifications());$('#refreshFeedback')?.addEventListener('click',()=>loadFeedback());$('#adminNotificationForm')?.addEventListener('submit',createNotification);$('#searchUsersBtn')?.addEventListener('click',()=>loadUsers());$('#userSearch')?.addEventListener('keydown',(event)=>{if(event.key==='Enter')loadUsers();});$('#cleanupLocksBtn')?.addEventListener('click',cleanupStaleLocks);document.querySelectorAll('[data-admin-section]').forEach((card)=>{card.addEventListener('click',()=>openAdminSection(card.dataset.adminSection));});document.querySelectorAll('[data-back-home]').forEach((button)=>{button.addEventListener('click',showAdminHome);});function showLoggedOut(){$('#queuePanel').classList.add('hidden');$('#loginPanel').classList.remove('hidden');showAdminHome();}function showLoggedIn(){$('#loginPanel').classList.add('hidden');$('#queuePanel').classList.remove('hidden');showAdminHome();}async function login(){const status=$('#loginStatus');status.textContent='Checking...';try{await api('/api/admin/login',{method:'POST',body:JSON.stringify({password:$('#adminPassword').value,browserKey:getAdminBrowserKey()}),});status.textContent='';showLoggedIn();await refreshAll();}catch(error){status.textContent=error.message;}}async function refreshAll(){try{await Promise.all([loadQueue(),loadExisting(),loadUsers()]);}catch(error){showLoggedOut();$('#loginStatus').textContent=error.message;}}async function loadQueue(){const grid=$('#queueGrid');const empty=$('#queueEmpty');grid.innerHTML='';empty.classList.add('hidden');const data=await api('/api/admin/pending');if(!data.pending.length){empty.classList.remove('hidden');return;}grid.innerHTML=data.pending.map((item)=>`
    <article class="queue-item" data-queue-id="${item.id}">
      <a class="queue-image-link" href="${item.mediaUrl}" target="_blank" rel="noopener noreferrer" aria-label="Open full size wallpaper ${escapeHtml(item.title)}"><img class="queue-image" src="${item.thumbUrl || item.previewUrl || item.mediaUrl}" alt="${escapeHtml(item.title)}" /></a>
      <div class="queue-body">
        <div>
          <h3>${escapeHtml(item.title)}</h3>
          <p class="status-text">by ${escapeHtml(item.creator || 'The Void')} - Submitted ${new Date(item.createdAt).toLocaleString()}</p>
        </div>

        <div class="admin-edit-grid">
          <label class="field-label admin-edit-label">
            Username / Creator
            <input class="admin-edit-input" data-edit="creator" data-id="${item.id}" type="text" maxlength="60" value="${escapeAttr(item.creator || 'The Void')}" placeholder="e.g. Shareq" />
          </label>
          <label class="field-label admin-edit-label">
            Wallpaper name
            <input class="admin-edit-input" data-edit="title" data-id="${item.id}" type="text" maxlength="80" value="${escapeAttr(item.title)}" placeholder="e.g. Black Moon" />
          </label>
        </div>

        <div class="queue-actions">
          <button class="save-details-btn" data-action="save" data-id="${item.id}">Save details</button>
          <a class="ghost-btn admin-action-link" href="/api/admin/download/${item.id}" download data-admin-download-url="/api/admin/download/${item.id}" data-admin-download-name="${escapeAttr(adminDownloadFilename(item))}">Download</a>
          <button class="primary-btn" data-action="approve" data-id="${item.id}">Approve</button>
          <button class="reject-btn" data-action="reject" data-id="${item.id}">Reject</button>
        </div>
      </div>
    </article>
  `).join('');grid.querySelectorAll('button[data-action]').forEach((button)=>{button.addEventListener('click',async()=>{button.disabled=true;try{if(button.dataset.action==='save'){await saveWallpaperDetails(button.dataset.id);button.textContent='Saved';setTimeout(()=>{button.textContent='Save details';button.disabled=false;},900);return;}if(button.dataset.action==='approve'){await saveWallpaperDetails(button.dataset.id);}await api(`/api/admin/wallpapers/${button.dataset.id}/${button.dataset.action}`,{method:'POST'});await refreshAll();}catch(error){showResponseToast(error.message);button.disabled=false;}});});}async function loadExisting(){const grid=$('#existingGrid');const empty=$('#existingEmpty');grid.innerHTML='';empty.classList.add('hidden');const data=await api('/api/wallpapers');const wallpapers=Array.isArray(data.wallpapers)?data.wallpapers:[];if(!wallpapers.length){empty.classList.remove('hidden');return;}grid.innerHTML=wallpapers.map((item)=>`
    <article class="queue-item" data-existing-id="${item.id}">
      <a class="queue-image-link" href="${item.mediaUrl}" target="_blank" rel="noopener noreferrer" aria-label="Open full size wallpaper ${escapeHtml(item.title)}"><img class="queue-image" src="${item.thumbUrl || item.previewUrl || item.mediaUrl}" alt="${escapeHtml(item.title)}" /></a>
      <div class="queue-body">
        <div>
          <h3>${escapeHtml(item.title)}</h3>
          <p class="status-text">by ${escapeHtml(item.creator || 'The Void')}</p>
        </div>
        <div class="admin-edit-grid">
          <label class="field-label admin-edit-label">
            Username / Creator
            <input class="admin-edit-input" data-edit="creator" data-id="${item.id}" type="text" maxlength="60" value="${escapeAttr(item.creator || 'The Void')}" placeholder="e.g. Shareq" />
          </label>
          <label class="field-label admin-edit-label">
            Wallpaper name
            <input class="admin-edit-input" data-edit="title" data-id="${item.id}" type="text" maxlength="80" value="${escapeAttr(item.title)}" placeholder="e.g. Black Moon" />
          </label>
        </div>
        <div class="existing-actions">
          <button class="save-details-btn" data-action="save-existing" data-id="${item.id}">Save details</button>
          <a class="ghost-btn admin-action-link" href="/api/admin/download/${item.id}" download data-admin-download-url="/api/admin/download/${item.id}" data-admin-download-name="${escapeAttr(adminDownloadFilename(item))}">Download</a>
          <button class="reject-btn" data-action="delete-existing" data-id="${item.id}">Delete</button>
        </div>
      </div>
    </article>
  `).join('');grid.querySelectorAll('button[data-action="save-existing"]').forEach((button)=>{button.addEventListener('click',async()=>{button.disabled=true;try{await saveWallpaperDetails(button.dataset.id);button.textContent='Saved';setTimeout(()=>{button.textContent='Save details';button.disabled=false;},900);}catch(error){showResponseToast(error.message);button.disabled=false;}});});grid.querySelectorAll('button[data-action="delete-existing"]').forEach((button)=>{button.addEventListener('click',async()=>{const ok=confirm('Delete this wallpaper from the app? It will be counted as Rejected on the creator profile.');if(!ok)return;button.disabled=true;try{await api(`/api/admin/wallpapers/${button.dataset.id}/delete`,{method:'POST'});await refreshAll();}catch(error){showResponseToast(error.message);button.disabled=false;}});});}function adminBadgeOptions(selected='auto'){const labels={auto:'Auto badge',none:'No badge',starter:'Void Spark',curator:'Rift Shaper',void_creator:'THE VOID SPACE Architect'};return Object.entries(labels).map(([value,label])=>`<option value="${value}" ${selected===value?'selected':''}>${label}</option>`).join('');}function adminBadgeText(user){const badge=user.badge;const auto=user.automaticBadge;const manual=user.badgeOverride&&user.badgeOverride!=='auto';if(!badge)return manual?'Badge: none':'Badge: none yet';return `Badge: ${badge.label}${manual?' (manual)':auto&&badge.id===auto.id?' (auto)':''}`;}async function loadUsers(){const grid=$('#userGrid');const empty=$('#userEmpty');const status=$('#userStatus');if(!grid||!empty)return;grid.innerHTML='';empty.classList.add('hidden');if(status)status.textContent='';const query=$('#userSearch')?.value.trim()||'';const data=await api(`/api/admin/users${query ? `?q=${encodeURIComponent(query)}` : ''}`);const users=Array.isArray(data.users)?data.users:[];if(!users.length){empty.classList.remove('hidden');return;}grid.innerHTML=users.map((user)=>`
    <article class="queue-item admin-user-item" data-user-id="${escapeAttr(user.creatorId)}">
      <div class="admin-user-avatar">${user.profilePicUrl ? `<img src="${escapeAttr(user.profilePicUrl)}" alt="@${escapeAttr(user.username)} profile picture" />` : `<span>@</span>`}</div>
      <div class="queue-body">
        <div>
          <h3>@${escapeHtml(user.username || 'unknown')}</h3>
          <p class="status-text">Created ${user.createdAt ? new Date(user.createdAt).toLocaleString() : 'unknown'}${user.lastLoginAt ? ` - Last login ${new Date(user.lastLoginAt).toLocaleString()}` : ''}</p>
          <p class="status-text">Wallpapers: ${Number(user.wallpaperCount || 0)} total - ${Number(user.approvedCount || 0)} approved - ${Number(user.pendingCount || 0)} pending - ${Number(user.rejectedCount || 0)} rejected</p>
          <p class="status-text">${escapeHtml(adminBadgeText(user))}</p>
          <p class="status-text">Upload limit: ${escapeHtml(user.uploadLimitText || (user.unlimitedUploads ? 'Unlimited uploads' : '4 uploads / 24h'))}</p>
          <p class="status-text">Account: ${escapeHtml(user.authType || 'password')}${user.email ? ` - ${escapeHtml(user.email)}` : ''}${user.hasGoogle ? ' - Google linked' : ''}</p>
        </div>
        <div class="existing-actions admin-user-actions">
          <label class="field-label admin-badge-label">Badge control<select class="admin-edit-input" data-action="update-badge" data-id="${escapeAttr(user.creatorId)}" data-username="${escapeAttr(user.username || '')}">${adminBadgeOptions(user.badgeOverride||'auto')}</select></label>
          <button class="${user.unlimitedUploads ? 'ghost-btn' : 'primary-btn'}" data-action="toggle-upload-limit" data-id="${escapeAttr(user.creatorId)}" data-username="${escapeAttr(user.username || '')}" data-unlimited="${user.unlimitedUploads ? 'true' : 'false'}">${user.unlimitedUploads ? 'Use normal upload limit' : 'Remove upload limit'}</button>
          <button class="reject-btn" data-action="delete-user" data-id="${escapeAttr(user.creatorId)}" data-username="${escapeAttr(user.username || '')}">Delete ID completely</button>
        </div>
      </div>
    </article>
  `).join('');grid.querySelectorAll('select[data-action="update-badge"]').forEach((select)=>{select.addEventListener('change',async()=>{select.disabled=true;try{const result=await api(`/api/admin/users/${encodeURIComponent(select.dataset.id)}/badge`,{method:'POST',body:JSON.stringify({badge:select.value}),});showResponseToast(result.message||'Badge updated.');await loadUsers();}catch(error){showResponseToast(error.message);select.disabled=false;}});});grid.querySelectorAll('button[data-action="toggle-upload-limit"]').forEach((button)=>{button.addEventListener('click',async()=>{const username=button.dataset.username||'this user';const makeUnlimited=button.dataset.unlimited!=='true';const ok=confirm(makeUnlimited?`Remove the 24-hour upload limit for @${username}?`:`Put @${username} back on the normal upload limit?`);if(!ok)return;button.disabled=true;try{const result=await api(`/api/admin/users/${encodeURIComponent(button.dataset.id)}/upload-limit`,{method:'POST',body:JSON.stringify({unlimited:makeUnlimited}),});showResponseToast(result.message||'Upload limit updated.');await loadUsers();}catch(error){showResponseToast(error.message);button.disabled=false;}});});grid.querySelectorAll('button[data-action="delete-user"]').forEach((button)=>{button.addEventListener('click',async()=>{const username=button.dataset.username||'this user';const ok=confirm(`Delete @${username} completely? This removes the profile, all their wallpapers, profile picture, and active login session. This cannot be undone.`);if(!ok)return;button.disabled=true;try{const result=await api(`/api/admin/users/${encodeURIComponent(button.dataset.id)}/delete`,{method:'POST'});showResponseToast(result.message||`Deleted @${username}.`);await Promise.all([loadUsers(),loadExisting(),loadQueue()]);}catch(error){showResponseToast(error.message);button.disabled=false;}});});}async function cleanupStaleLocks(){const button=$('#cleanupLocksBtn');const status=$('#userStatus');const ok=confirm('Clean old legacy signup lock data and orphaned sessions? New signups are not limited by IP or device.');if(!ok)return;if(button)button.disabled=true;if(status)status.textContent='Cleaning stale locks...';try{const result=await api('/api/admin/users/cleanup-stale-locks',{method:'POST'});if(status)status.textContent=`${result.message || 'Cleaned stale locks.'} Malformed signup rows cleared: ${result.clearedMalformedSignupRows || 0}. Orphaned active sessions cleared: ${result.clearedOrphanedActiveSessions || 0}.`;await loadUsers();}catch(error){if(status)status.textContent=error.message;else showResponseToast(error.message);}finally{if(button)button.disabled=false;}}async function saveWallpaperDetails(id){const titleInput=document.querySelector(`[data-edit="title"][data-id="${id}"]`);const creatorInput=document.querySelector(`[data-edit="creator"][data-id="${id}"]`);const title=titleInput?.value.trim()||'';const creator=creatorInput?.value.trim()||'';if(!title)throw new Error('Wallpaper name is required.');if(!creator)throw new Error('Username is required.');return api(`/api/admin/wallpapers/${id}/update`,{method:'POST',body:JSON.stringify({title,creator}),});}function escapeAttr(value){return escapeHtml(value).replace(/`/g, '&#096;');
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  }[char]));
}

function adminDownloadFilename(item){
  const title=String(item?.title||'wallpaper').trim().replace(/[^a-z0-9._-]+/gi,'-').replace(/^-+|-+$/g,'').slice(0,80)||'wallpaper';
  const source=String(item?.mediaUrl||'').split('?')[0];
  const extMatch=source.match(/\.([a-z0-9]+)$/i);
  const ext=extMatch&&['jpg','jpeg','png','webp'].includes(extMatch[1].toLowerCase())?extMatch[1].toLowerCase():'jpg';
  return `${title}.${ext}`;
}

function adminSanitizeDownloadFilename(value){
  return String(value||'').trim().replace(/[\\/:*?"<>|]+/g,'-').replace(/^-+|-+$/g,'').slice(0,120)||'wallpaper';
}

async function adminPickSaveHandle(fallbackName){
  const filename=adminSanitizeDownloadFilename(fallbackName||'wallpaper');
  if(window.isSecureContext&&typeof window.showSaveFilePicker==='function'){
    try{
      return await window.showSaveFilePicker({suggestedName:filename, startIn:'downloads'});
    }catch(error){
      if(error?.name==='AbortError')return false;
    }
  }
  return null;
}

async function adminWriteBlobToHandle(blob, handle){
  const writable=await handle.createWritable();
  await writable.write(blob);
  await writable.close();
}

async function adminSaveBlob(blob, fallbackName, handle=null){
  const filename=adminSanitizeDownloadFilename(fallbackName||'wallpaper');
  if(handle){
    await adminWriteBlobToHandle(blob, handle);
    return;
  }
  const picked=await adminPickSaveHandle(filename);
  if(picked===false)return;
  if(picked){
    await adminWriteBlobToHandle(blob, picked);
    return;
  }
  const objectUrl=URL.createObjectURL(blob);
  const link=document.createElement('a');
  link.href=objectUrl;
  link.download=filename;
  link.rel='noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(()=>URL.revokeObjectURL(objectUrl),30000);
}

async function createNotification(event){
  event.preventDefault();
  const status=$('#adminNotificationStatus');
  const button=event.target.querySelector('button[type="submit"]');
  const title=$('#adminNotificationTitle')?.value.trim()||'';
  const message=$('#adminNotificationMessage')?.value.trim()||'';
  const active=$('#adminNotificationActive')?.checked!==false;
  const silent=$('#adminNotificationSilent')?.checked===true;
  if(status)status.textContent='Adding notification...';
  if(button)button.disabled=true;
  try{
    await api('/api/admin/notifications',{method:'POST',body:JSON.stringify({title,message,active,silent})});
    if(status)status.textContent='Notification added.';
    event.target.reset();
    $('#adminNotificationActive').checked=true;
    $('#adminNotificationSilent').checked=false;
    showResponseToast('Notification added.');
    await loadNotifications();
  }catch(error){
    if(status)status.textContent=error.message;
  }finally{
    if(button)button.disabled=false;
  }
}

function cssEscape(value){
  if(window.CSS?.escape)return CSS.escape(value);
  return String(value).replace(/["\\]/g,'\\$&');
}

async function loadNotifications(){
  const grid=$('#adminNotificationsGrid');
  const empty=$('#adminNotificationsEmpty');
  if(!grid||!empty)return;
  grid.innerHTML='';
  empty.classList.add('hidden');
  const data=await api('/api/admin/notifications');
  const notifications=Array.isArray(data.notifications)?data.notifications:[];
  if(!notifications.length){
    empty.classList.remove('hidden');
    return;
  }
  grid.innerHTML=notifications.map((item)=>`<article class="queue-item" data-notification-id="${escapeAttr(item.id)}"><div class="queue-body"><div><h3>${escapeHtml(item.title||'Notification')}</h3><p class="status-text">${item.active===false?'Hidden from users':'Visible to users'}${item.silent?' - Silent':''} - ${item.createdAt?new Date(item.createdAt).toLocaleString():'unknown'}</p></div><div class="admin-edit-grid"><label class="field-label admin-edit-label">Title<input class="admin-edit-input" data-notification-title="${escapeAttr(item.id)}" type="text" maxlength="80" value="${escapeAttr(item.title||'')}" /></label><label class="field-label admin-edit-label">Message<textarea data-notification-message="${escapeAttr(item.id)}" maxlength="600" rows="5">${escapeHtml(item.message||'')}</textarea></label></div><label class="legal-agree-field"><input type="checkbox" data-notification-active="${escapeAttr(item.id)}" ${item.active===false?'':'checked'} /><span>Show to users</span></label><label class="legal-agree-field"><input type="checkbox" data-notification-silent="${escapeAttr(item.id)}" ${item.silent?'checked':''} /><span>Silent notification, do not show popup</span></label><div class="existing-actions"><button class="save-details-btn" data-action="save-notification" data-id="${escapeAttr(item.id)}">Save notification</button><button class="reject-btn" data-action="delete-notification" data-id="${escapeAttr(item.id)}">Delete</button></div></div></article>`).join('');
  grid.querySelectorAll('button[data-action="save-notification"]').forEach((button)=>{button.addEventListener('click',async()=>{button.disabled=true;try{const id=button.dataset.id;const title=document.querySelector(`[data-notification-title="${cssEscape(id)}"]`)?.value.trim()||'';const message=document.querySelector(`[data-notification-message="${cssEscape(id)}"]`)?.value.trim()||'';const active=document.querySelector(`[data-notification-active="${cssEscape(id)}"]`)?.checked!==false;const silent=document.querySelector(`[data-notification-silent="${cssEscape(id)}"]`)?.checked===true;await api(`/api/admin/notifications/${encodeURIComponent(id)}/update`,{method:'POST',body:JSON.stringify({title,message,active,silent})});showResponseToast('Notification updated.');await loadNotifications();}catch(error){showResponseToast(error.message);button.disabled=false;}});});
  grid.querySelectorAll('button[data-action="delete-notification"]').forEach((button)=>{button.addEventListener('click',async()=>{if(!confirm('Delete this notification?'))return;button.disabled=true;try{await api(`/api/admin/notifications/${encodeURIComponent(button.dataset.id)}/delete`,{method:'POST'});showResponseToast('Notification deleted.');await loadNotifications();}catch(error){showResponseToast(error.message);button.disabled=false;}});});
}

async function loadFeedback(){
  const grid=$('#adminFeedbackGrid');
  const empty=$('#adminFeedbackEmpty');
  if(!grid||!empty)return;
  grid.innerHTML='';
  empty.classList.add('hidden');
  const data=await api('/api/admin/feedback');
  const feedback=Array.isArray(data.feedback)?data.feedback:[];
  if(!feedback.length){
    empty.classList.remove('hidden');
    return;
  }
  grid.innerHTML=feedback.map((item)=>{const reply=item.reply||item.adminReply||'';return `<article class="queue-item" data-feedback-id="${escapeAttr(item.id)}"><div class="queue-body"><div><h3>${escapeHtml((item.type||'feedback').toUpperCase())}</h3><p class="status-text">From @${escapeHtml(item.username||'unknown')} ${item.email?`- ${escapeHtml(item.email)}`:''}</p><p class="status-text">Submitted ${item.createdAt?new Date(item.createdAt).toLocaleString():'unknown'}${item.reviewedAt?` - Reviewed ${new Date(item.reviewedAt).toLocaleString()}`:''}</p><span class="admin-feedback-status">${escapeHtml(item.status||'new')}</span></div><p class="admin-feedback-message">${escapeHtml(item.message||'')}</p>${reply?`<div class="admin-feedback-reply"><strong>Current reply</strong><p>${escapeHtml(reply)}</p></div>`:''}<label class="field-label admin-edit-label">Reply<textarea data-feedback-reply="${escapeAttr(item.id)}" maxlength="1200" rows="4" placeholder="Write a reply for this user.">${escapeHtml(reply)}</textarea></label><div class="existing-actions"><button class="primary-btn" data-action="reply-feedback" data-id="${escapeAttr(item.id)}">${reply?'Update reply':'Send reply'}</button><button class="${item.status==='reviewed'?'ghost-btn':'primary-btn'}" data-action="review-feedback" data-id="${escapeAttr(item.id)}" ${item.status==='reviewed'?'disabled':''}>${item.status==='reviewed'?'Reviewed':'Mark reviewed'}</button></div></div></article>`;}).join('');
  grid.querySelectorAll('button[data-action="reply-feedback"]').forEach((button)=>{button.addEventListener('click',async()=>{button.disabled=true;try{const id=button.dataset.id;const reply=document.querySelector(`[data-feedback-reply="${cssEscape(id)}"]`)?.value.trim()||'';await api(`/api/admin/feedback/${encodeURIComponent(id)}/reply`,{method:'POST',body:JSON.stringify({reply})});showResponseToast('Feedback reply saved.');await loadFeedback();}catch(error){showResponseToast(error.message);button.disabled=false;}});});
  grid.querySelectorAll('button[data-action="review-feedback"]').forEach((button)=>{button.addEventListener('click',async()=>{button.disabled=true;try{await api(`/api/admin/feedback/${encodeURIComponent(button.dataset.id)}/review`,{method:'POST'});showResponseToast('Feedback marked reviewed.');await loadFeedback();}catch(error){showResponseToast(error.message);button.disabled=false;}});});
}

document.addEventListener('click',async(event)=>{
  const link=event.target.closest?.('[data-admin-download-url]');
  if(!link)return;
  event.preventDefault();
  if(link.dataset.downloading==='1')return;
  link.dataset.downloading='1';
  try{
    const saveHandle=await adminPickSaveHandle(link.dataset.adminDownloadName||'wallpaper.jpg');
    if(saveHandle===false)return;
    const response=await fetch(link.dataset.adminDownloadUrl,{cache:'no-store'});
    if(!response.ok)throw new Error('Download failed.');
    await adminSaveBlob(await response.blob(),link.dataset.adminDownloadName||'wallpaper.jpg',saveHandle);
  }catch(error){
    showResponseToast(error.message||'Could not download wallpaper.');
  }finally{
    delete link.dataset.downloading;
  }
});

const ADMIN_RESPONSE_STATUS_SELECTOR=['#loginStatus','#userStatus','#adminNotificationStatus','.response-toast'].join(',');
function adminInstallStatusMessageObserver(){
  if(window.__voidAdminStatusMessageObserverInstalled)return;
  window.__voidAdminStatusMessageObserverInstalled=true;
  const sync=(node)=>{
    const element=node?.nodeType===1?node:node?.parentElement;
    if(element?.matches?.(ADMIN_RESPONSE_STATUS_SELECTOR))applyResponseMessageType(element,element.textContent);
  };
  document.querySelectorAll(ADMIN_RESPONSE_STATUS_SELECTOR).forEach(sync);
  const observer=new MutationObserver((mutations)=>{
    mutations.forEach((mutation)=>{
      sync(mutation.target);
      mutation.addedNodes.forEach((node)=>{
        sync(node);
        if(node.querySelectorAll)node.querySelectorAll(ADMIN_RESPONSE_STATUS_SELECTOR).forEach(sync);
      });
    });
  });
  observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true});
}

function responseMessageType(message){
  const text=String(message||'').trim();
  if(!text)return'';
  if(/^https?:\/\//i.test(text))return'info';
  if(/^(saved|sent|submitted|uploaded|updated|deleted|removed|approved|rejected|created|added|verified|signed in|logged in|logged out|profile link copied|profile link ready|password updated|password reset|email verified|email updated|email linked|feedback sent|notification added|notification updated|notification deleted|feedback reply saved|feedback marked reviewed|upload limit updated|badge updated|wallpaper updated|wallpaper deleted|wallpaper submitted|profile deleted|profile picture updated|google account connected|google account linked|image enhanced|cleaned)/i.test(text))return'success';
  if(/\b(success|successful|complete|completed|ready|copied|verified|sent|saved|updated|deleted|approved|submitted|connected|linked)\b/i.test(text)&&!/\b(error|failed|could not|cannot|can't|invalid|wrong|limit reached|locked|expired|try again|required|warning|empty|not found|denied|blocked|incorrect|missing|too many|wait|must|please|choose|enter)\b/i.test(text))return'success';
  if(/\b(code was sent|reset code sent|verification code sent|account created|logging in|can now upload|back to the normal upload limit|badge set|moved to rejected)\b/i.test(text))return'success';
  if(/^(checking|loading|submitting|sending|verifying|saving|updating|deleting|cleaning|adding|opening|reading|preparing|enhancing|restoring|using)\b/i.test(text))return'info';
  if(/\b(showing cached|server wakes up|cleared from memory)\b/i.test(text))return'info';
  return'warning';
}

function applyResponseMessageType(element,message){
  if(!element)return;
  const type=responseMessageType(message);
  element.classList.toggle('response-success',type==='success');
  element.classList.toggle('response-warning',type==='warning');
  element.classList.toggle('response-info',type==='info');
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',adminInstallStatusMessageObserver,{once:true});
else adminInstallStatusMessageObserver();

function showLoggedOut(){
  $('#queuePanel').classList.add('hidden');
  $('#loginPanel').classList.remove('hidden');
  $('#logoutBtn')?.classList.add('hidden');
  showAdminHome();
}

function showLoggedIn(){
  $('#loginPanel').classList.add('hidden');
  $('#queuePanel').classList.remove('hidden');
  $('#logoutBtn')?.classList.remove('hidden');
  showAdminHome();
}

(async () => {
  try {
    await loadQueue();
    showLoggedIn();
    await Promise.all([loadExisting(), loadUsers()]);
  } catch {
    showLoggedOut();
  }
})();
