function clearUserSearchResults(){const box=getUserSearchResultsBox();if(!box)return;box.classList.add('hidden');box.innerHTML='';}
function getWallpaperSearchResultsBox(){return $('#wallpaperSearchResults');}
function clearSearchWallpaperResults(){const box=getWallpaperSearchResultsBox();if(!box)return;box.classList.add('hidden');box.innerHTML='';}
function renderSearchWallpaperResults(rawValue=activeSearchQuery){const box=getWallpaperSearchResultsBox();if(!box)return;const rawSearch=String(rawValue||'').trim();if(!rawSearch||rawSearch.startsWith('@')){clearSearchWallpaperResults();return;}const query=rawSearch.toLowerCase();const visibleWallpapers=approvedWallpapers.filter((item)=>`${item.title || ''} ${item.creator || ''}`.toLowerCase().includes(query));box.classList.remove('hidden');if(!visibleWallpapers.length){box.innerHTML=`<p class="search-results-empty">No wallpapers match “${escapeHtml(rawSearch)}”.</p>`;return;}box.innerHTML=`
    <div class="search-results-head">
      <p class="eyebrow">Results</p>
      <strong>${visibleWallpapers.length} wallpaper${visibleWallpapers.length === 1 ? '' : 's'} found</strong>
    </div>
    <div class="wallpaper-grid search-wallpaper-grid">
      ${visibleWallpapers.map(wallpaperCardMarkup).join('')}
    </div>
  `;attachWallpaperCardHandlers(box);}
function handleMenuSearchInput(event){const raw=String(event?.target?.value||'').trim();activeSearchQuery=raw;if(raw.startsWith('@')){clearSearchWallpaperResults();window.clearTimeout(userSearchTimer);userSearchTimer=window.setTimeout(()=>searchUsersByName(raw),220);return;}window.clearTimeout(userSearchTimer);clearUserSearchResults();renderSearchWallpaperResults(raw);}
function creatorSearchLoadingMarkup(){
  return `<div class="creator-search-grid search-wallpaper-grid mock-loading-grid" aria-hidden="true">
    ${Array.from({length:4},(_,index)=>`<article class="creator-search-card creator-search-skeleton" style="--skeleton-delay:${index * 70}ms"><span class="creator-search-avatar skeleton-avatar"></span><span class="creator-search-copy"><span class="skeleton-line skeleton-title"></span><span class="skeleton-line skeleton-meta"></span></span></article>`).join('')}
  </div>`;
}
async function searchUsersByName(rawValue){const box=getUserSearchResultsBox();if(!box)return;const username=normalizeUsernameInput(rawValue);if(!username){clearUserSearchResults();return;}box.classList.remove('hidden');box.innerHTML=creatorSearchLoadingMarkup();try{const data=await apiJson(`/api/users/search?q=${encodeURIComponent(username)}`);renderUserSearchResults(data.users||[],username);}catch(error){box.innerHTML=`<p class="user-search-hint">${escapeHtml(error.message || 'Could not search users.')}</p>`;}}
function renderUserSearchResults(users,username){const box=getUserSearchResultsBox();if(!box)return;box.classList.remove('hidden');if(!users.length){box.innerHTML=`<p class="search-results-empty">No creator found for @${escapeHtml(username)}.</p>`;return;}box.innerHTML=`
    <div class="search-results-head">
      <p class="eyebrow">Results</p>
      <strong>${users.length} creator${users.length === 1 ? '' : 's'} found</strong>
    </div>
    <div class="creator-search-grid search-wallpaper-grid">
      ${users.map((user)=>{const displayName=user.creatorName||user.username||'void';return `<button class="creator-search-card" type="button" data-profile-username="${escapeHtml(displayName)}"><span class="creator-search-avatar">${profileAvatarMarkup(user)}</span><span class="creator-search-copy"><strong>@${escapeHtml(displayName)}</strong><small>View profile</small></span></button>`;}).join('')}
    </div>
  `;box.querySelectorAll('.creator-search-card').forEach((button)=>{button.addEventListener('click',()=>{$('#voidMenuPanel')?.classList.add('hidden');$('#voidMenuToggle')?.setAttribute('aria-expanded','false');removeModal(document.querySelector('#searchModal'));openProfileModal(button.dataset.profileUsername||'');});});}
function showSearchModal(){if(document.querySelector('#searchModal'))return;$('#voidMenuPanel')?.classList.add('hidden');$('#voidMenuToggle')?.setAttribute('aria-expanded','false');const modal=document.createElement('div');modal.id='searchModal';modal.className='search-modal fullscreen-modal';modal.innerHTML=`
    <section class="search-screen" role="dialog" aria-modal="true" aria-labelledby="searchTitle">
      <button class="login-close-btn" type="button" aria-label="Close search">&times;</button>
      <div class="fullscreen-section-head">
        <p class="eyebrow">Search</p>
        <h2 id="searchTitle">Find wallpapers or creators</h2>
      </div>
      <label class="field-label search-screen-label" for="wallpaperSearch">
        Wallpaper name or @username
        <input id="wallpaperSearch" type="search" placeholder="e.g. @the_void" autocomplete="off" />
      </label>
      <div id="userSearchResults" class="user-search-results hidden"></div>
      <div id="wallpaperSearchResults" class="search-wallpaper-results hidden"></div>
      <p class="search-screen-hint">Use @ before a username to search creator profiles.</p>
    </section>
  `;document.body.appendChild(modal);lockPageScroll();const input=modal.querySelector('#wallpaperSearch');const close=()=>{closeWallpaperPreview();removeModal(modal);};modal.querySelector('.login-close-btn')?.addEventListener('click',close);modal.addEventListener('click',(event)=>{if(event.target===modal)close();});input.value=activeSearchQuery;input.addEventListener('input',handleMenuSearchInput);input.focus();if(activeSearchQuery.startsWith('@')){clearSearchWallpaperResults();searchUsersByName(activeSearchQuery);}else{clearUserSearchResults();renderSearchWallpaperResults(activeSearchQuery);}}
function profileInitial(name){return String(name||'V').replace(/^@+/,'').trim().charAt(0).toUpperCase()||'V';}
function profileAvatarMarkup(user,size='large'){const username=user?.creatorName||user?.username||'void';const src=user?.profilePicUrl||user?.avatarUrl||'';if(src)return `<img src="${escapeHtml(src)}" alt="@${escapeHtml(username)} profile picture" />`;return `<span class="profile-avatar-initial ${size === 'small' ? 'small' : ''}">${escapeHtml(profileInitial(username))}</span>`;}
function fileToDataUrl(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result||''));reader.onerror=()=>reject(new Error('Could not read selected image.'));reader.readAsDataURL(file);});}
function formatJoinDate(value){if(!value)return 'New creator';const date=new Date(value);if(Number.isNaN(date.getTime()))return 'New creator';return `In space since ${date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}`;}
let profileHydrationPromise=null;
async function hydrateProfile(){if(profileHydrationPromise)return profileHydrationPromise;profileHydrationPromise=(async()=>{try{const response=await fetch('/api/profile',{credentials:'same-origin',cache:'no-store'});const data=await response.json().catch(()=>({}));if(response.ok&&data.user){setUser(data.user);return getUser();}clearUser();return null;}catch{syncAccountMenuState();return getUser();}finally{profileHydrationPromise=null;}})();return profileHydrationPromise;}
async function apiJson(url,options={}){const response=await fetch(url,{method:options.method||'GET',headers:{'Content-Type':'application/json',...(options.headers||{})},body:options.body,});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(formatAuthError(data.error||'Request failed.'));return data;}
function badgeSystemRuleMarkup(id,label,uploads,copy,tier){return `<li class="badge-rule-item badge-rule-item-${id}"><strong>${label}</strong><small>${uploads}</small><span class="badge-rule-shape" aria-hidden="true"><i class="badge-shape badge-shape-${id}"></i></span><em></em><p>${copy}</p><b>${tier}</b></li>`;}
function badgeSystemCardMarkup(){return `
    <section class="badge-system-card" role="dialog" aria-modal="true" aria-labelledby="badgeSystemTitle">
      <button class="badge-system-close" type="button" aria-label="Close badge system">&times;</button>
      <p class="eyebrow">Creator badges</p>
      <h2 id="badgeSystemTitle">Badge system</h2>
      <p class="badge-system-copy">Approved wallpapers unlock higher creator marks. Your top earned badge appears beside your username.</p>
      <ul class="badge-rule-list">
        ${badgeSystemRuleMarkup('starter','VOID SPARK','1+ approved','The first spark emerges in the void.','NEW CREATOR')}
        ${badgeSystemRuleMarkup('curator','RIFT SHAPER','15+ approved','Shaping the rift, building new worlds.','ACTIVE CREATOR')}
        ${badgeSystemRuleMarkup('void_creator','THE VOID SPACE ARCHITECT','30+ approved','Architect of the void. Master of infinite worlds.','ELITE CREATOR')}
      </ul>
      <button class="primary-btn badge-system-done" type="button">Got it</button>
    </section>
  `;}
function showBadgeSystemCard({onClose}={}){const existing=document.querySelector('#badgeSystemModal');if(existing)removeModal(existing);const modal=document.createElement('div');modal.id='badgeSystemModal';modal.className='badge-system-modal';modal.innerHTML=badgeSystemCardMarkup();document.body.appendChild(modal);lockPageScroll();let closed=false;const close=()=>{if(closed)return;closed=true;removeModal(modal);if(typeof onClose==='function')onClose();};modal.querySelector('.badge-system-close')?.addEventListener('click',close);modal.querySelector('.badge-system-done')?.addEventListener('click',close);modal.addEventListener('click',(event)=>{if(event.target===modal)close();});}
function profileLoadingSkeletonMarkup(){
  return `<div id="profileBody" class="profile-body-loading profile-skeleton" aria-busy="true" aria-label="Loading profile">
    <div class="profile-skeleton-head">
      <span class="profile-skeleton-avatar"></span>
      <span class="profile-skeleton-copy">
        <span class="skeleton-line profile-skeleton-name"></span>
        <span class="skeleton-line profile-skeleton-meta"></span>
        <span class="skeleton-line profile-skeleton-meta short"></span>
      </span>
    </div>
    <div class="profile-skeleton-actions">
      <span class="skeleton-line"></span>
      <span class="skeleton-line"></span>
    </div>
    <div class="profile-skeleton-grid">
      ${Array.from({length:6},(_,index)=>`<span class="profile-skeleton-tile" style="--skeleton-delay:${index * 60}ms"></span>`).join('')}
    </div>
  </div>`;
}
async function openProfileModal(profileUsername=''){const currentUser=getUser();const requestedUsername=normalizeUsernameInput(profileUsername);const ownProfile=!requestedUsername||(currentUser&&normalizeUsernameInput(currentUser.creatorName)===requestedUsername);if(!currentUser&&ownProfile){showLoginModal({intent:'profile'});return;}removeModal(document.querySelector('#profileModal'));const modal=document.createElement('div');modal.id='profileModal';modal.className='profile-modal';modal.innerHTML=`
    <div class="profile-card instagram-profile-card" role="dialog" aria-modal="true" aria-labelledby="profileTitle">
      <button class="login-close-btn" type="button" aria-label="Close profile">×</button>
      ${profileLoadingSkeletonMarkup()}
    </div>
  `;document.body.appendChild(modal);lockPageScroll();const close=()=>removeModal(modal);modal.querySelector('.login-close-btn').addEventListener('click',close);modal.addEventListener('click',(event)=>{if(event.target===modal)close();});try{const endpoint=ownProfile?'/api/profile':`/api/users/${encodeURIComponent(requestedUsername)}`;const data=await apiJson(endpoint);if(ownProfile)setUser(data.user);renderProfileContent(modal,data,ownProfile);}catch(error){const body=modal.querySelector('#profileBody');body.innerHTML=`
      <p class="eyebrow">Creator Profile</p>
      <h2 id="profileTitle">Profile unavailable</h2>
      <p class="profile-muted">${escapeHtml(error.message || 'Could not load profile.')}</p>
    `;}}

let authConfigPromise=null;
let supabaseAuthClientPromise=null;
async function getAuthConfig(){
  if(!authConfigPromise){
    authConfigPromise=apiJson('/api/auth/config').catch((error)=>{authConfigPromise=null;throw error;});
  }
  return authConfigPromise;
}
async function getSupabaseAuthClient(){
  if(supabaseAuthClientPromise)return supabaseAuthClientPromise;
  supabaseAuthClientPromise=(async()=>{
    const config=await getAuthConfig();
    if(!config.googleEnabled||!config.supabaseUrl||!config.supabaseAnonKey)throw new Error('Google sign-in is not configured yet.');
    if(!window.supabase?.createClient)throw new Error('Supabase client failed to load.');
    return window.supabase.createClient(config.supabaseUrl,config.supabaseAnonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  })().catch((error)=>{supabaseAuthClientPromise=null;throw error;});
  return supabaseAuthClientPromise;
}
function googleRedirectUrl(){const url=new URL(window.location.href);url.searchParams.set('auth','google');url.hash='';return url.toString();}
async function beginGoogleAuth(intent='login'){localStorage.setItem('googleAuthIntent',intent);const client=await getSupabaseAuthClient();const result=await client.auth.signInWithOAuth({provider:'google',options:{redirectTo:googleRedirectUrl()}});if(result.error)throw result.error;}
async function googleAccessToken(){const client=await getSupabaseAuthClient();const result=await client.auth.getSession();const token=result.data?.session?.access_token||'';if(!token)throw new Error('Google sign-in was cancelled or expired.');return token;}
function cleanupGoogleAuthUrl(){const url=new URL(window.location.href);url.searchParams.delete('auth');url.hash='';window.history.replaceState({},document.title,`${url.pathname}${url.search}`);}
const LEGAL_TERMS_VERSION='June 2026';
const LEGAL_PRIVACY_VERSION='June 2026';
function legalConsentPayload(){return{legalAccepted:true,termsAccepted:true,privacyAccepted:true,termsVersion:LEGAL_TERMS_VERSION,privacyVersion:LEGAL_PRIVACY_VERSION};}
async function submitGoogleAccess({accessToken,username='',link=false,legalConsent=null}={}){return apiJson('/api/auth/google',{method:'POST',body:JSON.stringify({accessToken,username,link,browserKey:getBrowserKey(),...(legalConsent||{})})});}
async function completeGoogleAuthReturn(){const url=new URL(window.location.href);if(url.searchParams.get('auth')!=='google')return false;const intent=localStorage.getItem('googleAuthIntent')||'login';try{const accessToken=await googleAccessToken();const data=await submitGoogleAccess({accessToken,link:intent==='link'});if(data.needsUsername){showLoginModal({intent:'google-setup',googleProfile:data.googleProfile,accessToken});return true;}if(data.user)setUser(data.user);cleanupGoogleAuthUrl();localStorage.removeItem('googleAuthIntent');showResponseToast(data.message||'Signed in with Google.');if(intent==='link')openProfileModal();return true;}catch(error){cleanupGoogleAuthUrl();localStorage.removeItem('googleAuthIntent');showResponseToast(error.message||'Google sign-in failed.');return false;}}
async function linkGoogleAccount(){await beginGoogleAuth('link');}
function passwordToggleIcon(visible=false){
  return visible
    ? '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l18 18"></path><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8"></path><path d="M9.4 5.1A10.8 10.8 0 0 1 12 4.8c5.2 0 8.6 4.6 9.6 6.2a2 2 0 0 1 0 2c-.4.6-1.1 1.5-2.1 2.5"></path><path d="M6.7 6.7A15.2 15.2 0 0 0 2.4 11a2 2 0 0 0 0 2C3.4 14.6 6.8 19.2 12 19.2c1.3 0 2.6-.3 3.8-.8"></path></svg>'
    : '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M2.4 11a2 2 0 0 0 0 2C3.4 14.6 6.8 19.2 12 19.2S20.6 14.6 21.6 13a2 2 0 0 0 0-2C20.6 9.4 17.2 4.8 12 4.8S3.4 9.4 2.4 11Z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
}
function syncPasswordInputToggles(root=document){
  root.querySelectorAll?.('.password-input-wrap input[data-password-toggle="1"]').forEach((input)=>{
    const wrapper=input.parentElement;
    const button=wrapper?.querySelector('.password-toggle-btn');
    if(!button)return;
    const hasValue=String(input.value||'').length>0;
    if(!hasValue && input.type==='text')input.type='password';
    const visible=input.type==='text'&&hasValue;
    const disabled=Boolean(input.disabled || input.closest('[hidden]') || !hasValue);
    wrapper.classList.toggle('has-password-value',hasValue);
    wrapper.classList.toggle('password-visible',visible);
    button.classList.toggle('is-password-visible',visible);
    button.hidden=!hasValue;
    button.disabled=disabled;
    button.tabIndex=hasValue?0:-1;
    button.setAttribute('aria-hidden',String(!hasValue));
    button.setAttribute('aria-label',input.type==='text'?'Hide password':'Show password');
    button.setAttribute('aria-pressed',String(visible));
    button.innerHTML=passwordToggleIcon(visible);
  });
}
function enhancePasswordInputToggles(root=document){
  root.querySelectorAll?.('input[type="password"], input[data-password-toggle="1"]').forEach((input)=>{
    if(input.dataset.passwordToggleEnhanced)return;
    input.dataset.passwordToggleEnhanced='1';
    input.dataset.passwordToggle='1';
    const wrapper=document.createElement('span');
    wrapper.className='password-input-wrap';
    input.parentNode.insertBefore(wrapper,input);
    wrapper.appendChild(input);
    const button=document.createElement('button');
    button.type='button';
    button.className='password-toggle-btn';
    button.hidden=true;
    button.tabIndex=-1;
    button.setAttribute('aria-hidden','true');
    button.setAttribute('aria-label','Show password');
    button.setAttribute('aria-pressed','false');
    button.innerHTML=passwordToggleIcon(false);
    button.addEventListener('click',(event)=>{
      event.preventDefault();
      event.stopPropagation();
      if(input.disabled)return;
      if(!String(input.value||'').length){syncPasswordInputToggles(root);return;}
      input.type=input.type==='password'?'text':'password';
      syncPasswordInputToggles(root);
      input.focus({preventScroll:true});
    });
    input.addEventListener('input',()=>syncPasswordInputToggles(root));
    input.addEventListener('change',()=>syncPasswordInputToggles(root));
    wrapper.appendChild(button);
  });
  syncPasswordInputToggles(root);
}
function showLoginModal({intent='upload',onReady,googleProfile=null,accessToken=''}={}){
  if(document.querySelector('#loginModal'))return;
  $('#voidMenuPanel')?.classList.add('hidden');
  $('#voidMenuToggle')?.setAttribute('aria-expanded','false');
  const googleSetup=intent==='google-setup';
  const modal=document.createElement('div');
  modal.id='loginModal';
  modal.innerHTML=`
    <div class="modal-card login-card auth-card" role="dialog" aria-modal="true" aria-label="THE VOID SPACE account access">
      <button class="login-close-btn" type="button" aria-label="Close login">&times;</button>
      ${googleSetup?`<div class="google-profile-summary">${googleProfile?.avatarUrl?`<img src="${escapeHtml(googleProfile.avatarUrl)}" alt="" />`:''}<span>${escapeHtml(googleProfile?.email||'Google account verified')}</span></div>`:''}
      <p class="auth-mode-cue ${googleSetup?'hidden':''}">Account</p>
      <div class="login-tabs ${googleSetup?'hidden':''}" role="tablist" aria-label="Login mode">
        <button id="signupTab" class="login-tab active" type="button">Signup</button>
        <button id="loginTab" class="login-tab" type="button">Login</button>
      </div>
      <div class="login-username auth-form">
        <label id="creatorLabel" class="field-label" for="creatorInput">Username<input id="creatorInput" type="text" maxlength="24" autocomplete="username" placeholder="e.g. the_void" value="${googleSetup?escapeHtml(googleProfile?.suggestedUsername||''):''}" /></label>
        <p id="usernameHelp" class="auth-field-help">Choose carefully. Your username cannot be changed after signup.</p>
        <label id="emailLabel" class="field-label" for="emailInput">Email<input id="emailInput" type="email" maxlength="254" autocomplete="email" placeholder="e.g. creator@gmail.com" /></label>
        <label id="passwordLabel" class="field-label" for="passwordInput">Password<input id="passwordInput" type="password" minlength="8" autocomplete="new-password" placeholder="At least 8 characters" /></label>
        <label id="confirmPasswordLabel" class="field-label" for="confirmPasswordInput">Confirm password<input id="confirmPasswordInput" type="password" minlength="8" autocomplete="new-password" placeholder="Type your password again" /></label>
        <label id="legalAgreeLabel" class="legal-agree-field"><input id="legalAgreeInput" type="checkbox" /><span>I agree to the <a href="terms.html" target="_blank" rel="noopener noreferrer">Terms of service</a> and <a href="privacy.html" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.</span></label>
        <label id="otpLabel" class="field-label" for="otpInput" hidden>Verification code<input id="otpInput" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="6-digit code" /></label>
        <div id="otpActions" class="otp-action-row" hidden>
          <button id="resendOtpBtn" class="ghost-btn" type="button">Resend code</button>
          <button id="editSignupBtn" class="ghost-btn" type="button">Change email</button>
        </div>
        <p id="otpHelp" class="otp-help" hidden></p>
        <p class="login-back-copy" hidden>Welcome back.</p>
        <button id="forgotPasswordBtn" class="auth-text-btn" type="button" hidden>Forgot password?</button>
        <button id="confirmUser" class="primary-btn" type="button">${googleSetup?'Create profile':'Signup'}</button>
        <p class="login-note">Your username appears on your profile.</p>
        <p id="err" class="status-text login-error" role="alert"></p>
      </div>
      <footer class="auth-footer-note" id="authFooterNote"><p id="authSwitchPrompt" class="auth-switch-copy"></p></footer>
    </div>`;
  document.body.appendChild(modal);
  enhancePasswordInputToggles(modal);
  lockPageScroll();
  let mode=googleSetup?'google-setup':'signup';
  let otpStep=false;
  let otpPurpose='';
  let pendingSignup=null;
  let pendingPasswordReset=null;
  let resendTimerId=0;
  const signupTab=modal.querySelector('#signupTab');
  const loginTab=modal.querySelector('#loginTab');
  const creatorLabel=modal.querySelector('#creatorLabel');
  const usernameInput=modal.querySelector('#creatorInput');
  const usernameHelp=modal.querySelector('#usernameHelp');
  const emailLabel=modal.querySelector('#emailLabel');
  const emailInput=modal.querySelector('#emailInput');
  const passwordLabel=modal.querySelector('#passwordLabel');
  const passwordInput=modal.querySelector('#passwordInput');
  const confirmPasswordLabel=modal.querySelector('#confirmPasswordLabel');
  const confirmPasswordInput=modal.querySelector('#confirmPasswordInput');
  const legalAgreeLabel=modal.querySelector('#legalAgreeLabel');
  const legalAgreeInput=modal.querySelector('#legalAgreeInput');
  const otpLabel=modal.querySelector('#otpLabel');
  const otpInput=modal.querySelector('#otpInput');
  const otpActions=modal.querySelector('#otpActions');
  const otpHelp=modal.querySelector('#otpHelp');
  const resendOtpBtn=modal.querySelector('#resendOtpBtn');
  const editSignupBtn=modal.querySelector('#editSignupBtn');
  const loginNote=modal.querySelector('.login-note');
  const loginBackCopy=modal.querySelector('.login-back-copy');
  const forgotPasswordBtn=modal.querySelector('#forgotPasswordBtn');
  const authSwitchPrompt=modal.querySelector('#authSwitchPrompt');
  const err=modal.querySelector('#err');
  const confirmButton=modal.querySelector('#confirmUser');
  const close=()=>{window.clearInterval(resendTimerId);removeModal(modal);};
  modal.querySelector('.login-close-btn').addEventListener('click',close);
  modal.addEventListener('click',(event)=>{if(event.target===modal)close();});
  const resetOtpStep=()=>{
    otpStep=false;
    otpPurpose='';
    pendingSignup=null;
    pendingPasswordReset=null;
    window.clearInterval(resendTimerId);
    otpLabel.firstChild.textContent='Verification code';
    otpLabel.hidden=true;
    otpInput.disabled=true;
    otpInput.value='';
    otpActions.hidden=true;
    otpHelp.hidden=true;
    otpHelp.textContent='';
    resendOtpBtn.disabled=false;
    resendOtpBtn.textContent='Resend code';
    editSignupBtn.textContent='Change email';
    signupTab.disabled=false;
    loginTab.disabled=false;
    [usernameInput,emailInput,passwordInput,confirmPasswordInput,legalAgreeInput].forEach((input)=>{if(input)input.disabled=false;});
    syncPasswordInputToggles(modal);
  };
  const setResendCountdown=(seconds=0)=>{
    window.clearInterval(resendTimerId);
    let remaining=Math.max(0, Number(seconds||0));
    const render=()=>{
      resendOtpBtn.disabled=remaining>0;
      resendOtpBtn.textContent=remaining>0?`Resend in ${remaining}s`:'Resend code';
      remaining-=1;
      if(remaining<0)window.clearInterval(resendTimerId);
    };
    render();
    if(remaining>=0)resendTimerId=window.setInterval(render,1000);
  };
  const currentSignupPayload=()=>{
    const username=normalizeUsernameInput(usernameInput.value);
    usernameInput.value=username;
    return{username,email:String(emailInput.value||'').trim().toLowerCase(),password:passwordInput.value,browserKey:getBrowserKey(),...legalConsentPayload()};
  };
  const currentPasswordResetPayload=()=>{
    return{login:String(usernameInput.value||'').trim(),browserKey:getBrowserKey()};
  };
  const confirmLabelForMode=()=>mode==='google-setup'?'Create profile':mode==='signup'?'Signup':mode==='password-reset-request'?'Send reset code':mode==='password-reset-verify'?'Save new password':'Login';
  const setOtpStep=(data={},payload=null)=>{
    otpStep=true;
    otpPurpose='signup';
    pendingSignup=payload||pendingSignup;
    pendingPasswordReset=null;
    modal.classList.add('auth-otp-screen');
    signupTab.disabled=true;
    loginTab.disabled=true;
    creatorLabel.hidden=true;
    usernameHelp.hidden=true;
    emailLabel.hidden=true;
    passwordLabel.hidden=true;
    confirmPasswordLabel.hidden=true;
    legalAgreeLabel.hidden=true;
    [usernameInput,emailInput,passwordInput,confirmPasswordInput,legalAgreeInput].forEach((input)=>{if(input)input.disabled=true;});
    syncPasswordInputToggles(modal);
    otpLabel.firstChild.textContent='Verification code';
    otpLabel.hidden=false;
    otpInput.disabled=false;
    otpActions.hidden=false;
    otpHelp.hidden=false;
    const target=data.emailMasked||pendingSignup?.email||'your email';
    otpHelp.textContent=`A verification code was sent to ${target}. Please check your inbox, including Spam or Promotions, and enter the code to continue.`;
    confirmButton.textContent='Verify code';
    if(loginNote){
      loginNote.hidden=false;
      loginNote.style.display='';
      loginNote.textContent='Enter the 6-digit code to finish signup.';
    }
    setResendCountdown(data.resendAfterSeconds||0);
    otpInput.focus();
  };
  const setPasswordResetOtpStep=(data={},payload=null)=>{
    otpStep=true;
    otpPurpose='password-reset';
    pendingSignup=null;
    pendingPasswordReset=payload||pendingPasswordReset;
    mode='password-reset-verify';
    signupTab.disabled=true;
    loginTab.disabled=true;
    signupTab?.classList.remove('active');
    loginTab?.classList.add('active');
    usernameInput.disabled=true;
    emailLabel.hidden=true;
    emailInput.disabled=true;
    passwordLabel.firstChild.textContent='New password';
    passwordLabel.hidden=false;
    passwordInput.disabled=false;
    passwordInput.value='';
    passwordInput.autocomplete='new-password';
    passwordInput.placeholder='At least 8 characters';
    confirmPasswordLabel.hidden=false;
    confirmPasswordInput.disabled=false;
    confirmPasswordInput.value='';
    confirmPasswordInput.autocomplete='new-password';
    confirmPasswordInput.placeholder='Type your password again';
    legalAgreeLabel.hidden=true;
    legalAgreeInput.disabled=true;
    legalAgreeInput.checked=false;
    syncPasswordInputToggles(modal);
    otpLabel.firstChild.textContent='Reset code';
    otpLabel.hidden=false;
    otpInput.disabled=false;
    otpInput.value='';
    otpActions.hidden=false;
    editSignupBtn.textContent='Change account';
    otpHelp.hidden=false;
    const target=data.emailMasked||'your email';
    otpHelp.textContent=`Reset code sent to ${target}. Enter it below with your new password.`;
    confirmButton.disabled=false;
    confirmButton.textContent='Save new password';
    forgotPasswordBtn.hidden=true;
    if(loginNote){
      loginNote.hidden=false;
      loginNote.style.display='';
      loginNote.textContent='Enter the 6-digit code before saving.';
    }
    if(loginBackCopy){loginBackCopy.hidden=true;loginBackCopy.style.display='none';}
    setResendCountdown(data.resendAfterSeconds||0);
    otpInput.focus();
  };
  const setMode=(nextMode)=>{
    resetOtpStep();
    mode=nextMode;
    const isSignup=mode==='signup';
    const isLogin=mode==='login';
    const isGoogleSetup=mode==='google-setup';
    const isPasswordResetRequest=mode==='password-reset-request';
    signupTab?.classList.toggle('active',isSignup);
    loginTab?.classList.toggle('active',isLogin||isPasswordResetRequest);
    confirmButton.disabled=false;
    confirmButton.textContent=confirmLabelForMode();
    modal.classList.remove('auth-otp-screen');
    creatorLabel.hidden=false;
    creatorLabel.firstChild.textContent=(isLogin||isPasswordResetRequest)?'Email or username':isGoogleSetup?'Creator username':'Username';
    usernameInput.disabled=false;
    usernameInput.maxLength=(isLogin||isPasswordResetRequest)?254:24;
    usernameInput.autocomplete=(isLogin||isPasswordResetRequest)?'username email':'username';
    usernameInput.placeholder=(isLogin||isPasswordResetRequest)?'e.g. the_void or creator@gmail.com':'e.g. the_void';
    emailInput.placeholder='e.g. creator@gmail.com';
    emailLabel.hidden=!isSignup||isGoogleSetup;
    emailInput.disabled=!isSignup||isGoogleSetup;
    passwordLabel.firstChild.textContent='Password';
    passwordLabel.hidden=isGoogleSetup||isPasswordResetRequest;
    passwordInput.disabled=isGoogleSetup||isPasswordResetRequest;
    passwordInput.autocomplete=isSignup?'new-password':'current-password';
    passwordInput.placeholder=isSignup?'At least 8 characters':'Enter your password';
    confirmPasswordLabel.hidden=!isSignup||isGoogleSetup;
    confirmPasswordInput.disabled=!isSignup||isGoogleSetup;
    confirmPasswordInput.placeholder='Type your password again';
    legalAgreeLabel.hidden=(!isSignup&&!isGoogleSetup)||isPasswordResetRequest;
    legalAgreeInput.disabled=(!isSignup&&!isGoogleSetup)||isPasswordResetRequest;
    if((!isSignup&&!isGoogleSetup)||isPasswordResetRequest)legalAgreeInput.checked=false;
    if(loginNote){
      loginNote.textContent=isPasswordResetRequest?'We will send a reset code to your account email.':'Your username appears on your profile.';
      loginNote.hidden=isLogin;
      loginNote.style.display=isLogin?'none':'';
    }
    if(usernameHelp){
      const showUsernameHelp=isSignup||isGoogleSetup;
      usernameHelp.hidden=!showUsernameHelp;
      usernameHelp.style.display=showUsernameHelp?'':'none';
      usernameHelp.textContent=isGoogleSetup?'Choose carefully. Your creator username cannot be changed after setup.':'Choose carefully. Your username cannot be changed after signup.';
    }
    if(authSwitchPrompt){
      if(isSignup){
        authSwitchPrompt.innerHTML='Already have an account? <button type="button" data-auth-switch="login">Login</button>';
      }else if(isLogin){
        authSwitchPrompt.innerHTML='New to THE VOID SPACE? <button type="button" data-auth-switch="signup">Create an account</button>';
      }else if(isPasswordResetRequest){
        authSwitchPrompt.innerHTML='Remembered your password? <button type="button" data-auth-switch="login">Login</button>';
      }else{
        authSwitchPrompt.textContent='';
      }
    }
    if(loginBackCopy){loginBackCopy.hidden=!isLogin;loginBackCopy.style.display=isLogin?'':'none';}
    forgotPasswordBtn.hidden=!isLogin;
    err.textContent='';
    err.classList.remove('login-success');
    syncPasswordInputToggles(modal);
    usernameInput.focus();
  };
  signupTab?.addEventListener('click',()=>setMode('signup'));
  loginTab?.addEventListener('click',()=>setMode('login'));
  authSwitchPrompt?.addEventListener('click',(event)=>{
    const target=event.target?.closest?.('[data-auth-switch]');
    if(!target)return;
    setMode(target.dataset.authSwitch==='signup'?'signup':'login');
  });
  forgotPasswordBtn?.addEventListener('click',()=>setMode('password-reset-request'));
  editSignupBtn?.addEventListener('click',()=>setMode(otpPurpose==='password-reset'?'password-reset-request':'signup'));
  const finish=(data,created=false)=>{
    setUser(data.user);
    err.classList.add('login-success');
    err.textContent=data.message||(created?'Account created successfully.':'Signed in.');
    window.setTimeout(()=>{removeModal(modal);if(onReady)onReady(getUser());else if(intent==='profile'||googleSetup)openProfileModal();if(created)showBadgeSystemCard();},created?850:350);
  };
  const requestOtp=async(payload)=>{
    const data=await apiJson('/api/auth/signup/request-otp',{method:'POST',body:JSON.stringify(payload)});
    if(data.otpRequired===false){
      return apiJson('/api/auth/signup',{method:'POST',body:JSON.stringify(payload)});
    }
    return data;
  };
  const confirm=async()=>{
    err.textContent='';
    err.classList.remove('login-success');
    const rawLogin=String(usernameInput.value||'').trim();
    const isPasswordResetMode=mode==='password-reset-request'||mode==='password-reset-verify';
    const username=(mode==='login'||isPasswordResetMode)?rawLogin:normalizeUsernameInput(usernameInput.value);
    const email=String(emailInput.value||'').trim().toLowerCase();
    const password=passwordInput.value;
    const confirmPassword=confirmPasswordInput.value;
    if(mode!=='login'&&!isPasswordResetMode)usernameInput.value=username;
    if(!username||username.length<3){err.textContent=(mode==='login'||isPasswordResetMode)?'Enter your email or username.':'Username must be at least 3 characters.';return;}
    if(mode==='signup'&&!email){err.textContent='Email is required.';return;}
    if(mode!=='google-setup'&&mode!=='password-reset-request'&&!password&&!otpStep){err.textContent='Password is required.';return;}
    if(mode==='signup'&&!otpStep){
      const passwordError=validatePasswordStrength(password);
      if(passwordError){err.textContent=passwordError;return;}
      if(password!==confirmPassword){err.textContent='Passwords do not match.';return;}
    }
    if((mode==='signup'||mode==='google-setup')&&!legalAgreeInput.checked){err.textContent='Please agree to the Terms of service and Privacy Policy.';return;}
    if(mode==='signup'&&otpStep){
      const otp=String(otpInput.value||'').replace(/\D+/g,'').slice(0,6);
      otpInput.value=otp;
      if(!/^\d{6}$/.test(otp)){err.textContent='Enter the 6-digit verification code.';return;}
      confirmButton.disabled=true;
      confirmButton.textContent='Verifying...';
      try{
        const data=await apiJson('/api/auth/signup/verify-otp',{method:'POST',body:JSON.stringify({email:pendingSignup?.email||email,otp,browserKey:getBrowserKey()})});
        return finish(data,true);
      }catch(error){
        err.textContent=formatAuthError(error.message||'Verification failed.');
        confirmButton.disabled=false;
        confirmButton.textContent='Verify code';
        return;
      }
    }
    if(mode==='password-reset-verify'){
      const otp=String(otpInput.value||'').replace(/\D+/g,'').slice(0,6);
      const resetLogin=pendingPasswordReset?.login||username;
      otpInput.value=otp;
      if(!/^\d{6}$/.test(otp)){err.textContent='Enter the 6-digit reset code.';return;}
      const passwordError=validatePasswordStrength(password);
      if(passwordError){err.textContent=passwordError;return;}
      if(password!==confirmPassword){err.textContent='Passwords do not match.';return;}
      confirmButton.disabled=true;
      confirmButton.textContent='Saving password...';
      try{
        const data=await apiJson('/api/auth/password-reset/verify-otp',{method:'POST',body:JSON.stringify({login:resetLogin,otp,newPassword:password,browserKey:getBrowserKey()})});
        err.classList.add('login-success');
        err.textContent=data.message||'Password reset. Log in with your new password.';
        passwordInput.value='';
        confirmPasswordInput.value='';
        syncPasswordInputToggles(modal);
        window.setTimeout(()=>setMode('login'),850);
        return;
      }catch(error){
        err.textContent=formatAuthError(error.message||'Could not reset password.');
        confirmButton.disabled=false;
        confirmButton.textContent='Save new password';
        return;
      }
    }
    confirmButton.disabled=true;
    confirmButton.textContent=mode==='google-setup'?'Creating profile...':mode==='signup'?'Sending code...':mode==='password-reset-request'?'Sending code...':'Logging in...';
    try{
      if(mode==='google-setup'){
        const data=await submitGoogleAccess({accessToken,username,legalConsent:legalConsentPayload()});
        cleanupGoogleAuthUrl();
        localStorage.removeItem('googleAuthIntent');
        return finish(data,true);
      }
      if(mode==='signup'){
        const payload=currentSignupPayload();
        const data=await requestOtp(payload);
        if(data.user)return finish(data,!data.alreadyExisted);
        setOtpStep(data,payload);
        err.classList.add('login-success');
        err.textContent=data.message||'Verification code sent.';
        confirmButton.disabled=false;
        confirmButton.textContent='Verify code';
        return;
      }
      if(mode==='password-reset-request'){
        const payload=currentPasswordResetPayload();
        const data=await apiJson('/api/auth/password-reset/request-otp',{method:'POST',body:JSON.stringify(payload)});
        setPasswordResetOtpStep(data,payload);
        err.classList.add('login-success');
        err.textContent=data.message||'Password reset code sent.';
        return;
      }
      const data=await apiJson('/api/auth/login',{method:'POST',body:JSON.stringify({login:username,password,browserKey:getBrowserKey()})});
      finish(data,false);
    }catch(error){
      err.textContent=formatAuthError(error.message||'Access failed.');
      confirmButton.disabled=false;
      confirmButton.textContent=confirmLabelForMode();
    }
  };
  const resendOtp=async()=>{
    const isReset=otpPurpose==='password-reset';
    if(isReset&&!pendingPasswordReset)return;
    if(!isReset&&!pendingSignup)return;
    err.textContent='';
    err.classList.remove('login-success');
    resendOtpBtn.disabled=true;
    resendOtpBtn.textContent='Sending...';
    try{
      const data=await apiJson(isReset?'/api/auth/password-reset/request-otp':'/api/auth/signup/resend-otp',{method:'POST',body:JSON.stringify(isReset?pendingPasswordReset:pendingSignup)});
      otpInput.value='';
      if(isReset)setPasswordResetOtpStep(data,pendingPasswordReset);
      else setOtpStep(data,pendingSignup);
      err.classList.add('login-success');
      err.textContent=data.message||'Verification code sent again.';
    }catch(error){
      err.textContent=formatAuthError(error.message||'Could not resend code.');
      resendOtpBtn.disabled=false;
      resendOtpBtn.textContent='Resend code';
    }
  };
  resendOtpBtn?.addEventListener('click',resendOtp);
  otpInput?.addEventListener('input',()=>{otpInput.value=String(otpInput.value||'').replace(/\D+/g,'').slice(0,6);});
  confirmButton.addEventListener('click',confirm);
  [usernameInput,emailInput,passwordInput,confirmPasswordInput,otpInput].forEach((input)=>input?.addEventListener('keydown',(event)=>{if(event.key==='Enter')confirm();}));
  setMode(googleSetup?'google-setup':intent==='login'?'login':'signup');
}
