function profileBadgeMarkup(badge,interactive=false){if(!badge||!badge.id)return'';const label=badge.label||'Void badge';const tag=interactive?'button':'span';const attrs=interactive?' type="button" data-profile-badge-info':'';return `<${tag} class="void-creator-badge void-creator-badge-${escapeHtml(badge.id)}" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)} badge"${attrs}><span class="void-badge-core" aria-hidden="true"></span></${tag}>`;}
function profileShareUrl(username){const name=normalizeUsernameInput(username);return `${window.location.origin}/@${encodeURIComponent(name)}`;}
async function copyProfileShareLink(username,statusElement){const cleanName=normalizeUsernameInput(username);const url=profileShareUrl(cleanName);const shareText='Explore this creator profile on THE VOID SPACE, a curated space for immersive dark wallpapers.';try{if(navigator.share){await navigator.share({title:'THE VOID SPACE',text:shareText,url});if(statusElement)statusElement.textContent='Profile shared.';return;}if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(`${shareText} ${url}`);}else{const input=document.createElement('textarea');input.value=`${shareText} ${url}`;input.setAttribute('readonly','');input.style.position='fixed';input.style.opacity='0';document.body.appendChild(input);input.select();document.execCommand('copy');input.remove();}if(statusElement)statusElement.textContent='Profile link copied.';showResponseToast('Profile link copied.');}catch(error){if(error?.name==='AbortError')return;if(statusElement)statusElement.textContent=url;showResponseToast('Profile link ready to share.');}}
function openProfileFromCurrentPath(){const match=window.location.pathname.match(/^\/@([a-z0-9_.-]{3,24})$/i);if(!match)return;window.setTimeout(()=>openProfileModal(decodeURIComponent(match[1])),250);}
function profileEmailFormMarkup(user={}){
  if(!user.canManageEmail)return'';
  const hasEmail=Boolean(user.email);
  return `<form id="profileEmailForm" class="password-form email-link-form">
    <p class="eyebrow">${hasEmail?'Account email':'Email login'}</p>
    <p class="profile-muted">${hasEmail?`Current email: ${escapeHtml(user.email)}`:'Add a verified email to this profile so you can sign in with your email or username.'}</p>
    <label class="field-label">${hasEmail?'New email':'Email'}<input id="profileEmailInput" type="email" maxlength="254" autocomplete="email" placeholder="e.g. creator@gmail.com" /></label>
    <label class="field-label">Current password<input id="profileEmailPassword" type="password" autocomplete="current-password" placeholder="Enter your current password" /></label>
    <button id="profileEmailRequestBtn" class="primary-btn" type="button">Send verification code</button>
    <div id="profileEmailOtpStage" class="profile-email-otp-stage hidden">
      <label class="field-label">Verification code<input id="profileEmailOtpInput" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="6-digit code" /></label>
      <div class="otp-action-row">
        <button id="profileEmailVerifyBtn" class="primary-btn" type="button">Verify email</button>
        <button id="profileEmailChangeBtn" class="ghost-btn" type="button">Change email</button>
      </div>
    </div>
    <p id="profileEmailStatus" class="status-text profile-white-status"></p>
  </form>`;
}
function renderProfileContent(modal,data,ownProfile){const user=data.user||{};const username=user.creatorName||user.username||'void';const badge=user.badge||null;const counts=data.counts||{total:0,approved:0,pending:0,rejected:0};const uploads=Array.isArray(data.uploads)?data.uploads:[];const body=modal.querySelector('#profileBody');const editingUploads=Boolean(data.editingUploads);const visibleUploads=ownProfile?uploads.slice(0,12):uploads.filter((item)=>item.status==='approved').slice(0,12);body.className='profile-body';body.innerHTML=`
    <div class="profile-topline">
      <label class="profile-avatar ${ownProfile ? 'profile-avatar-editable' : ''}" title="${ownProfile ? 'Change profile picture' : `@${escapeHtml(username)}`}">
        ${profileAvatarMarkup(user)}
        ${ownProfile ? '<input id="avatarInput" type="file" accept="image/png,image/jpeg,image/webp" hidden /><span class="profile-avatar-camera" aria-hidden="true">+</span>' : ''}
      </label>
      <div class="profile-identity">
        <p class="eyebrow">Creator Profile</p>
        <h2 id="profileTitle"><span>@${escapeHtml(username)}</span>${profileBadgeMarkup(badge,ownProfile)}</h2>
        <p class="profile-muted profile-joined-date">${formatJoinDate(user.createdAt)}</p>
      </div>
    </div>

    <div id="profileStats" class="profile-stats instagram-stats">
      <span><strong>${counts.approved || 0}</strong>Posts</span>
      <span><strong>${counts.total || 0}</strong>${ownProfile ? 'Uploads' : 'Shared'}</span>
      <span><strong>${counts.pending || 0}</strong>Pending</span>
      <span><strong>${counts.rejected || 0}</strong>Rejected</span>
    </div>

    ${ownProfile ? `<div class="profile-action-row"><button id="profileEditToggle" class="ghost-btn profile-edit-btn" type="button">${editingUploads?'Done':'Edit uploads'}</button><button id="profileShareBtn" class="ghost-btn profile-share-btn" type="button">Share profile</button><p id="avatarStatus" class="status-text profile-white-status">${escapeHtml(data.avatarMessage||'')}</p></div>` : ''}

    <div class="profile-gallery-head">
      <span></span><strong>${ownProfile ? 'Your wallpapers' : 'Wallpaper posts'}</strong><span></span>
    </div>
    <div id="profileUploads" class="profile-post-grid">
      ${visibleUploads.length ? visibleUploads.map((item) => profileUploadCard(item, ownProfile, editingUploads)).join('') : `<p class="profile-muted profile-empty-wide">${ownProfile?'No uploads yet.':'No approved wallpapers yet.'}</p>`}
    </div>

    ${ownProfile ? `${profileEmailFormMarkup(user)}${user.canChangePassword!==false ? `<form id="passwordForm" class="password-form instagram-password-form"><p class="eyebrow">Security</p><label class="field-label">Current password<input id="currentPassword" type="password" autocomplete="current-password" placeholder="Enter your current password" /></label><label class="field-label">New password<input id="newPassword" type="password" minlength="8" autocomplete="new-password" placeholder="At least 8 characters" /></label><button class="primary-btn" type="submit">Change password</button><p id="passwordStatus" class="status-text profile-white-status"></p></form>` : ''}${user.canLinkGoogle ? `<form id="googleLinkForm" class="password-form google-link-form"><p class="eyebrow">Google account</p><p class="profile-muted">Link this legacy profile to Google without changing your uploads or username.</p><button id="linkGoogleBtn" class="primary-btn" type="submit">Link Google account</button><p id="googleLinkStatus" class="status-text profile-white-status"></p></form>` : ''}<form id="deleteProfileForm" class="password-form profile-danger-form"><p class="eyebrow">Delete profile</p>${user.canDeleteWithPassword!==false ? `<label class="field-label">Enter password to delete profile<input id="deleteProfilePassword" type="password" autocomplete="current-password" placeholder="Enter your password" /></label>` : `<label class="field-label">Type your username to delete profile<input id="deleteProfileConfirm" type="text" autocomplete="off" placeholder="${escapeHtml(username)}" /></label>`}<button id="deleteProfileBtn" class="ghost-btn profile-delete-btn" type="submit">Delete profile</button><p id="deleteProfileStatus" class="status-text profile-white-status"></p></form>` : ''}
  `;if(typeof enhancePasswordInputToggles==='function')enhancePasswordInputToggles(body);$$('.profile-post-card[data-preview-id]').forEach((button)=>{button.addEventListener('click',()=>openWallpaperPreview(button.dataset.previewId));});if(ownProfile)attachOwnProfileActions(modal,data);}
function profileUploadCard(item,ownProfile,editingUploads=false){const status=item.status||'pending';const title=item.title||'Untitled wallpaper';const cardImageUrl=item.thumbUrl||item.mediaUrl;const hasPreview=Boolean(item.mediaUrl&&status==='approved');if(ownProfile&&editingUploads){const previewMarkup=hasPreview?`<img src="${escapeHtml(cardImageUrl)}" data-full-src="${escapeHtml(item.mediaUrl)}" alt="${escapeHtml(title)}" loading="lazy" decoding="async" />`:`<span>${escapeHtml(status)}</span>`;return `
      <article class="profile-post-card profile-post-edit-card ${hasPreview ? '' : 'profile-post-edit-placeholder'}" data-edit-wallpaper-id="${escapeHtml(item.id)}">
        ${previewMarkup}
        <em>${escapeHtml(status)}</em>
        <div class="profile-post-edit-panel">
          <label class="field-label">Wallpaper name<input data-wallpaper-title-input type="text" maxlength="80" value="${escapeHtml(title)}" /></label>
          <button class="primary-btn" type="button" data-save-wallpaper-title>Save</button>
          <button class="ghost-btn profile-delete-btn" type="button" data-delete-wallpaper>Delete</button>
          <p class="status-text profile-white-status" data-wallpaper-edit-status></p>
        </div>
      </article>
    `;}return `
    <button class="profile-post-card ${hasPreview ? '' : 'profile-post-placeholder'}" type="button" ${hasPreview ? `data-preview-id="${escapeHtml(item.id)}"` : 'disabled'}>
      ${hasPreview ? `<img src="${escapeHtml(cardImageUrl)}" data-full-src="${escapeHtml(item.mediaUrl)}" alt="${escapeHtml(title)}" loading="lazy" decoding="async" />` : `<span>${escapeHtml(status)}</span>`}
      <small>${escapeHtml(title)}</small>
      ${ownProfile ? `<em>${escapeHtml(status)}</em>` : ''}
    </button>
  `;}
function recountUploads(uploads){return uploads.reduce((counts,item)=>{const status=item.status||'pending';counts.total +=1;counts[status]=(counts[status]||0)+ 1;return counts;},{total:0,approved:0,pending:0,rejected:0});}
function loadAvatarImageFromFile(file){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onerror=()=>reject(new Error('Could not read selected image.'));
    reader.onload=()=>{
      const image=new Image();
      image.onload=()=>resolve({image,dataUrl:String(reader.result||'')});
      image.onerror=()=>reject(new Error('Could not load selected image.'));
      image.src=String(reader.result||'');
    };
    reader.readAsDataURL(file);
  });
}
function drawAvatarCrop(canvas,image,state){
  const context=canvas.getContext('2d');
  const size=canvas.width;
  context.clearRect(0,0,size,size);
  context.save();
  context.beginPath();
  context.arc(size/2,size/2,size/2,0,Math.PI*2);
  context.clip();
  context.fillStyle='#111';
  context.fillRect(0,0,size,size);
  const minScale=Math.max(size/image.width,size/image.height);
  const scale=minScale*Number(state.zoom||1);
  const drawWidth=image.width*scale;
  const drawHeight=image.height*scale;
  const maxOffsetX=Math.max(0,(drawWidth-size)/2);
  const maxOffsetY=Math.max(0,(drawHeight-size)/2);
  state.offsetX=Math.max(-maxOffsetX,Math.min(maxOffsetX,Number(state.offsetX||0)));
  state.offsetY=Math.max(-maxOffsetY,Math.min(maxOffsetY,Number(state.offsetY||0)));
  const x=(size-drawWidth)/2+state.offsetX;
  const y=(size-drawHeight)/2+state.offsetY;
  context.imageSmoothingQuality='high';
  context.drawImage(image,x,y,drawWidth,drawHeight);
  context.restore();
}
async function openAvatarAdjuster(file){
  const {image}=await loadAvatarImageFromFile(file);
  return new Promise((resolve,reject)=>{
    const modal=document.createElement('div');
    modal.className='avatar-crop-modal';
    modal.innerHTML=`
      <section class="avatar-crop-card" role="dialog" aria-modal="true" aria-labelledby="avatarCropTitle">
        <button class="login-close-btn avatar-crop-close" type="button" aria-label="Close profile picture editor">&times;</button>
        <div class="avatar-crop-head">
          <p class="eyebrow">Profile picture</p>
          <h2 id="avatarCropTitle">Adjust photo</h2>
        </div>
        <div class="avatar-crop-stage">
          <canvas id="avatarCropCanvas" width="720" height="720" aria-label="Profile picture crop preview"></canvas>
        </div>
        <div class="avatar-crop-controls">
          <label class="field-label">Zoom<input id="avatarCropZoom" type="range" min="1" max="3" step="0.01" value="1" /></label>
          <label class="field-label">Horizontal<input id="avatarCropX" type="range" min="-100" max="100" step="1" value="0" /></label>
          <label class="field-label">Vertical<input id="avatarCropY" type="range" min="-100" max="100" step="1" value="0" /></label>
        </div>
        <div class="avatar-crop-actions">
          <button id="avatarCropCancel" class="ghost-btn" type="button">Cancel</button>
          <button id="avatarCropApply" class="primary-btn" type="button">Set photo</button>
        </div>
      </section>
    `;
    document.body.appendChild(modal);
    lockPageScroll();
    const canvas=modal.querySelector('#avatarCropCanvas');
    const zoomInput=modal.querySelector('#avatarCropZoom');
    const xInput=modal.querySelector('#avatarCropX');
    const yInput=modal.querySelector('#avatarCropY');
    const state={zoom:1,offsetX:0,offsetY:0};
    let settled=false;
    const close=(value,asError=false)=>{
      if(settled)return;
      settled=true;
      removeModal(modal);
      if(asError)reject(value);
      else resolve(value);
    };
    const sync=()=>{
      state.zoom=Number(zoomInput.value||1);
      const size=canvas.width;
      const minScale=Math.max(size/image.width,size/image.height);
      const drawWidth=image.width*minScale*state.zoom;
      const drawHeight=image.height*minScale*state.zoom;
      state.offsetX=(Number(xInput.value||0)/100)*Math.max(0,(drawWidth-size)/2);
      state.offsetY=(Number(yInput.value||0)/100)*Math.max(0,(drawHeight-size)/2);
      drawAvatarCrop(canvas,image,state);
    };
    [zoomInput,xInput,yInput].forEach((input)=>input.addEventListener('input',sync));
    modal.querySelector('#avatarCropApply')?.addEventListener('click',()=>{
      try{
        sync();
        close(canvas.toDataURL('image/webp',0.92));
      }catch(error){
        close(error,true);
      }
    });
    modal.querySelector('#avatarCropCancel')?.addEventListener('click',()=>close(''));
    modal.querySelector('.avatar-crop-close')?.addEventListener('click',()=>close(''));
    modal.addEventListener('click',(event)=>{if(event.target===modal)close('');});
    sync();
    zoomInput.focus();
  });
}
function attachOwnProfileActions(modal,profileData){const avatarInput=modal.querySelector('#avatarInput');const avatarStatus=modal.querySelector('#avatarStatus');modal.querySelector('#profileShareBtn')?.addEventListener('click',()=>copyProfileShareLink(profileData.user?.creatorName||profileData.user?.username||'',avatarStatus));modal.querySelector('[data-profile-badge-info]')?.addEventListener('click',()=>showBadgeSystemCard());avatarInput?.addEventListener('change',async()=>{const file=avatarInput.files?.[0];if(!file)return;if(!/^image\/(png|jpeg|webp)$/.test(file.type)){avatarStatus.textContent='Use PNG, JPG, or WEBP.';avatarInput.value='';return;}if(file.size>5*1024*1024){avatarStatus.textContent='Profile picture must be under 5 MB.';avatarInput.value='';return;}avatarStatus.textContent='Uploading profile picture...';try{const dataUrl=await fileToDataUrl(file);const result=await apiJson('/api/profile/avatar',{method:'POST',body:JSON.stringify({dataUrl}),});setUser(result.user);profileData.user=result.user;profileData.avatarMessage=result.message||'Profile picture updated.';renderProfileContent(modal,profileData,true);}catch(error){avatarStatus.textContent=error.message||'Could not update profile picture.';}finally{avatarInput.value='';}});modal.querySelector('#profileEditToggle')?.addEventListener('click',()=>{profileData.editingUploads=!profileData.editingUploads;renderProfileContent(modal,profileData,true);});modal.querySelectorAll('[data-edit-wallpaper-id]').forEach((card)=>{const id=card.dataset.editWallpaperId;const status=card.querySelector('[data-wallpaper-edit-status]');const titleInput=card.querySelector('[data-wallpaper-title-input]');const saveButton=card.querySelector('[data-save-wallpaper-title]');const deleteButton=card.querySelector('[data-delete-wallpaper]');saveButton?.addEventListener('click',async()=>{const title=String(titleInput?.value||'').trim();if(!title){status.textContent='Wallpaper name is required.';return;}saveButton.disabled=true;status.textContent='Saving...';try{const result=await apiJson(`/api/profile/wallpapers/${encodeURIComponent(id)}/update`,{method:'POST',body:JSON.stringify({title}),});const upload=profileData.uploads.find((item)=>item.id===id);if(upload)upload.title=result.wallpaper?.title||title;status.textContent=result.message||'Wallpaper updated.';await loadWallpapers();}catch(error){status.textContent=error.message||'Could not update wallpaper.';}finally{saveButton.disabled=false;}});deleteButton?.addEventListener('click',async()=>{const confirmed=window.confirm('Delete this uploaded wallpaper from your profile? This cannot be undone.');if(!confirmed)return;deleteButton.disabled=true;status.textContent='Deleting...';try{const result=await apiJson(`/api/profile/wallpapers/${encodeURIComponent(id)}/delete`,{method:'POST'});profileData.uploads=profileData.uploads.filter((item)=>item.id!==id);profileData.counts=recountUploads(profileData.uploads);profileData.avatarMessage=result.message||'Wallpaper deleted.';await loadWallpapers();renderProfileContent(modal,profileData,true);}catch(error){status.textContent=error.message||'Could not delete wallpaper.';deleteButton.disabled=false;}});});const form=modal.querySelector('#passwordForm');form?.addEventListener('submit',async(event)=>{event.preventDefault();const status=modal.querySelector('#passwordStatus');status.textContent='Updating...';try{const data=await apiJson('/api/auth/change-password',{method:'POST',body:JSON.stringify({currentPassword:modal.querySelector('#currentPassword').value,newPassword:modal.querySelector('#newPassword').value,}),});status.textContent=data.message||'Password updated.';form.reset();}catch(error){status.textContent=error.message||'Could not update password.';}});const deleteForm=modal.querySelector('#deleteProfileForm');deleteForm?.addEventListener('submit',async(event)=>{event.preventDefault();const status=modal.querySelector('#deleteProfileStatus');const button=modal.querySelector('#deleteProfileBtn');const passwordInput=modal.querySelector('#deleteProfilePassword');const password=passwordInput?.value||'';if(!password){status.textContent='Enter your password to delete profile.';return;}const confirmed=window.confirm('Delete your profile and all wallpapers uploaded by this account? This cannot be undone.');if(!confirmed)return;status.textContent='Deleting profile...';if(button)button.disabled=true;try{const data=await apiJson('/api/profile/delete',{method:'POST',body:JSON.stringify({password}),});clearUser();removeModal(modal);await loadWallpapers();const uploadStatus=$('#uploadStatus');if(uploadStatus)uploadStatus.textContent=data.message||'Profile deleted.';}catch(error){status.textContent=error.message||'Could not delete profile.';if(button)button.disabled=false;}});}
attachOwnProfileActions=function attachOwnProfileActions(modal,profileData){
  const avatarInput=modal.querySelector('#avatarInput');
  const avatarStatus=modal.querySelector('#avatarStatus');
  const user=profileData.user||{};
  modal.querySelector('#profileShareBtn')?.addEventListener('click',()=>copyProfileShareLink(user.creatorName||user.username||'',avatarStatus));
  modal.querySelector('[data-profile-badge-info]')?.addEventListener('click',()=>showBadgeSystemCard());
  avatarInput?.addEventListener('change',async()=>{
    const file=avatarInput.files?.[0];
    if(!file)return;
    if(!/^image\/(png|jpeg|webp)$/.test(file.type)){avatarStatus.textContent='Use PNG, JPG, or WEBP.';avatarInput.value='';return;}
    if(file.size>5*1024*1024){avatarStatus.textContent='Profile picture must be under 5 MB.';avatarInput.value='';return;}
    try{
      avatarStatus.textContent='Adjust profile picture before upload.';
      const dataUrl=await openAvatarAdjuster(file);
      if(!dataUrl){avatarStatus.textContent='';return;}
      avatarStatus.textContent='Uploading profile picture...';
      const result=await apiJson('/api/profile/avatar',{method:'POST',body:JSON.stringify({dataUrl})});
      setUser(result.user);
      profileData.user=result.user;
      profileData.avatarMessage=result.message||'Profile picture updated.';
      renderProfileContent(modal,profileData,true);
    }catch(error){
      avatarStatus.textContent=error.message||'Could not update profile picture.';
    }finally{
      avatarInput.value='';
    }
  });
  modal.querySelector('#profileEditToggle')?.addEventListener('click',()=>{profileData.editingUploads=!profileData.editingUploads;renderProfileContent(modal,profileData,true);});
  const emailForm=modal.querySelector('#profileEmailForm');
  if(emailForm){
    const emailInput=modal.querySelector('#profileEmailInput');
    const passwordInput=modal.querySelector('#profileEmailPassword');
    const requestButton=modal.querySelector('#profileEmailRequestBtn');
    const otpStage=modal.querySelector('#profileEmailOtpStage');
    const otpInput=modal.querySelector('#profileEmailOtpInput');
    const verifyButton=modal.querySelector('#profileEmailVerifyBtn');
    const changeButton=modal.querySelector('#profileEmailChangeBtn');
    const status=modal.querySelector('#profileEmailStatus');
    let pendingEmail='';
    const resetEmailOtp=()=>{
      pendingEmail='';
      otpStage?.classList.add('hidden');
      if(otpInput)otpInput.value='';
      if(emailInput)emailInput.disabled=false;
      if(passwordInput)passwordInput.disabled=false;
      if(requestButton){requestButton.hidden=false;requestButton.disabled=false;requestButton.textContent='Send verification code';}
      if(verifyButton){verifyButton.disabled=false;verifyButton.textContent='Verify email';}
      if(typeof syncPasswordInputToggles==='function')syncPasswordInputToggles(modal);
    };
    const requestEmailOtp=async()=>{
      const email=String(emailInput?.value||'').trim().toLowerCase();
      const currentPassword=String(passwordInput?.value||'');
      if(!email){status.textContent='Enter the email you want to use.';return;}
      if(!currentPassword){status.textContent='Enter your current password first.';return;}
      if(requestButton){requestButton.disabled=true;requestButton.textContent='Sending code...';}
      status.textContent='';
      try{
        const data=await apiJson('/api/auth/email/request-otp',{method:'POST',body:JSON.stringify({email,currentPassword,browserKey:getBrowserKey()})});
        pendingEmail=email;
        if(emailInput)emailInput.disabled=true;
        if(passwordInput)passwordInput.disabled=true;
        if(requestButton)requestButton.hidden=true;
        if(typeof syncPasswordInputToggles==='function')syncPasswordInputToggles(modal);
        otpStage?.classList.remove('hidden');
        status.textContent=`A verification code was sent to ${data.emailMasked||email}. Please check your inbox, including Spam or Promotions, and enter the code to continue.`;
        otpInput?.focus();
      }catch(error){
        status.textContent=error.message||'Could not send verification code.';
        if(requestButton){requestButton.disabled=false;requestButton.textContent='Send verification code';}
      }
    };
    const verifyEmailOtp=async()=>{
      const otp=String(otpInput?.value||'').replace(/\D+/g,'').slice(0,6);
      if(otpInput)otpInput.value=otp;
      if(!pendingEmail){status.textContent='Request a verification code first.';return;}
      if(!/^\d{6}$/.test(otp)){status.textContent='Enter the 6-digit verification code.';return;}
      if(verifyButton){verifyButton.disabled=true;verifyButton.textContent='Verifying...';}
      try{
        const data=await apiJson('/api/auth/email/verify-otp',{method:'POST',body:JSON.stringify({email:pendingEmail,otp,browserKey:getBrowserKey()})});
        setUser(data.user);
        profileData.user=data.user;
        showResponseToast(data.message||'Email verified.');
        renderProfileContent(modal,profileData,true);
      }catch(error){
        status.textContent=error.message||'Could not verify code.';
        if(verifyButton){verifyButton.disabled=false;verifyButton.textContent='Verify email';}
      }
    };
    requestButton?.addEventListener('click',requestEmailOtp);
    verifyButton?.addEventListener('click',verifyEmailOtp);
    changeButton?.addEventListener('click',()=>{resetEmailOtp();status.textContent='';emailInput?.focus();});
    otpInput?.addEventListener('input',()=>{otpInput.value=String(otpInput.value||'').replace(/\D+/g,'').slice(0,6);});
    emailForm.addEventListener('submit',(event)=>{event.preventDefault();if(otpStage&&!otpStage.classList.contains('hidden'))verifyEmailOtp();else requestEmailOtp();});
  }
  modal.querySelectorAll('[data-edit-wallpaper-id]').forEach((card)=>{
    const id=card.dataset.editWallpaperId;
    const status=card.querySelector('[data-wallpaper-edit-status]');
    const titleInput=card.querySelector('[data-wallpaper-title-input]');
    const saveButton=card.querySelector('[data-save-wallpaper-title]');
    const deleteButton=card.querySelector('[data-delete-wallpaper]');
    saveButton?.addEventListener('click',async()=>{
      const title=String(titleInput?.value||'').trim();
      if(!title){status.textContent='Wallpaper name is required.';return;}
      saveButton.disabled=true;
      status.textContent='Saving...';
      try{
        const result=await apiJson(`/api/profile/wallpapers/${encodeURIComponent(id)}/update`,{method:'POST',body:JSON.stringify({title})});
        const upload=profileData.uploads.find((item)=>item.id===id);
        if(upload)upload.title=result.wallpaper?.title||title;
        status.textContent=result.message||'Wallpaper updated.';
        await loadWallpapers();
      }catch(error){
        status.textContent=error.message||'Could not update wallpaper.';
      }finally{
        saveButton.disabled=false;
      }
    });
    deleteButton?.addEventListener('click',async()=>{
      const confirmed=window.confirm('Delete this uploaded wallpaper from your profile? This cannot be undone.');
      if(!confirmed)return;
      deleteButton.disabled=true;
      status.textContent='Deleting...';
      try{
        const result=await apiJson(`/api/profile/wallpapers/${encodeURIComponent(id)}/delete`,{method:'POST'});
        profileData.uploads=profileData.uploads.filter((item)=>item.id!==id);
        profileData.counts=recountUploads(profileData.uploads);
        profileData.avatarMessage=result.message||'Wallpaper deleted.';
        await loadWallpapers();
        renderProfileContent(modal,profileData,true);
      }catch(error){
        status.textContent=error.message||'Could not delete wallpaper.';
        deleteButton.disabled=false;
      }
    });
  });
  modal.querySelector('#passwordForm')?.addEventListener('submit',async(event)=>{
    event.preventDefault();
    const status=modal.querySelector('#passwordStatus');
    status.textContent='Updating...';
    try{
      const data=await apiJson('/api/auth/change-password',{method:'POST',body:JSON.stringify({currentPassword:modal.querySelector('#currentPassword').value,newPassword:modal.querySelector('#newPassword').value})});
      status.textContent=data.message||'Password updated.';
      event.currentTarget.reset();
      if(typeof syncPasswordInputToggles==='function')syncPasswordInputToggles(modal);
    }catch(error){
      status.textContent=error.message||'Could not update password.';
    }
  });
  modal.querySelector('#googleLinkForm')?.addEventListener('submit',async(event)=>{
    event.preventDefault();
    const status=modal.querySelector('#googleLinkStatus');
    const button=modal.querySelector('#linkGoogleBtn');
    status.textContent='Opening Google...';
    if(button)button.disabled=true;
    try{
      await linkGoogleAccount();
    }catch(error){
      status.textContent=error.message||'Could not start Google linking.';
      if(button)button.disabled=false;
    }
  });
  modal.querySelector('#deleteProfileForm')?.addEventListener('submit',async(event)=>{
    event.preventDefault();
    const status=modal.querySelector('#deleteProfileStatus');
    const button=modal.querySelector('#deleteProfileBtn');
    const passwordInput=modal.querySelector('#deleteProfilePassword');
    const confirmInput=modal.querySelector('#deleteProfileConfirm');
    const payload={};
    if(passwordInput){
      const password=passwordInput.value||'';
      if(!password){status.textContent='Enter your password to delete profile.';return;}
      payload.password=password;
    }else{
      const confirmUsername=normalizeUsernameInput(confirmInput?.value||'');
      if(confirmUsername!==normalizeUsernameInput(user.creatorName||user.username||'')){status.textContent='Type your username to confirm profile deletion.';return;}
      payload.confirmUsername=confirmUsername;
    }
    const confirmed=window.confirm('Delete your profile and all wallpapers uploaded by this account? This cannot be undone.');
    if(!confirmed)return;
    status.textContent='Deleting profile...';
    if(button)button.disabled=true;
    try{
      const data=await apiJson('/api/profile/delete',{method:'POST',body:JSON.stringify(payload)});
      clearUser();
      removeModal(modal);
      await loadWallpapers();
      const uploadStatus=$('#uploadStatus');
      if(uploadStatus)uploadStatus.textContent=data.message||'Profile deleted.';
    }catch(error){
      status.textContent=error.message||'Could not delete profile.';
      if(button)button.disabled=false;
    }
  });
};
async function logoutUser(){await fetch('/api/auth/logout',{method:'POST'}).catch(()=>{});if(typeof getSupabaseAuthClient==='function'){try{const client=await getSupabaseAuthClient();await client.auth.signOut();}catch{}}clearUser();}
function init(){setupAccountMenu();Promise.resolve(typeof completeGoogleAuthReturn==='function'?completeGoogleAuthReturn():false).finally(()=>hydrateProfile());renderPresetCards();attachUploadEvents();if(typeof attachEnhanceEvents==='function')attachEnhanceEvents();attachPreviewEvents();attachModalEvents();if(typeof setupHeroPerformanceGuard==='function')setupHeroPerformanceGuard();loadWallpapers();syncPreviewControls();openProfileFromCurrentPath();}
