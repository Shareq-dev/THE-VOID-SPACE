const http=require('http');
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const os=require('os');
let createClient=null;
try{
  ({createClient}=require('@supabase/supabase-js'));
}
catch{
}
let sharp=null;
try{
  sharp=require('sharp');
}
catch{
}
const PORT=Number(process.env.PORT||4173);
const HOST=process.env.HOST||'0.0.0.0';
const ROOT=__dirname;
const PUBLIC_DIR=fs.existsSync(path.join(ROOT, 'public'))?path.join(ROOT, 'public'):ROOT;
const BUNDLED_DATA_DIR=path.join(ROOT, 'data');
const BUNDLED_UPLOAD_DIR=path.join(BUNDLED_DATA_DIR, 'uploads');
const BUNDLED_DB_FILE=path.join(BUNDLED_DATA_DIR, 'wallpapers.json');
const MAX_UPLOAD_BYTES=12*1024*1024;
const PROFILE_PIC_MAX_BYTES=5*1024*1024;
const ENHANCED_WALLPAPER_MAX_BYTES=48*1024*1024;
const MAX_UPLOAD_BODY_BYTES=Math.ceil(MAX_UPLOAD_BYTES*1.4)+ 1024*1024;
const PROFILE_PIC_BODY_BYTES=Math.ceil(PROFILE_PIC_MAX_BYTES*1.4)+ 512*1024;
const SESSION_TTL_MS=positiveNumberEnv('THE_VOID_SESSION_TTL_MS', 30*24*60*60*1000, 60*1000);
const ACTIVE_SESSION_IDLE_MS=positiveNumberEnv('THE_VOID_ACTIVE_SESSION_IDLE_MS', 30*24*60*60*1000, 60*1000);
const ADMIN_LOGIN_MAX_FAILED_ATTEMPTS=positiveNumberEnv('THE_VOID_ADMIN_LOGIN_MAX_FAILED_ATTEMPTS', 2, 1);
const ADMIN_LOGIN_LOCK_MS=positiveNumberEnv('THE_VOID_ADMIN_LOGIN_LOCK_MS', 3*60*60*1000, 60*1000);
const USER_LOGIN_MAX_FAILED_ATTEMPTS=positiveNumberEnv('THE_VOID_USER_LOGIN_MAX_FAILED_ATTEMPTS', 4, 1);
const USER_LOGIN_LOCK_MS=positiveNumberEnv('THE_VOID_USER_LOGIN_LOCK_MS', 30*60*1000, 60*1000);
const WALLPAPER_UPLOAD_LIMIT_PER_WINDOW=positiveNumberEnv('THE_VOID_UPLOAD_LIMIT_PER_24H', 4, 1);
const WALLPAPER_UPLOAD_WINDOW_MS=24*60*60*1000;
const ACTIVE_USER_SESSIONS_SETTING_KEY='active_user_sessions';
const ADMIN_LOGIN_PROTECTION_SETTING_KEY='admin_login_protection';
const USER_LOGIN_PROTECTION_SETTING_KEY='user_login_protection';
const UPLOAD_LIMIT_EXEMPTIONS_SETTING_KEY='upload_limit_exemptions';
const BADGE_OVERRIDES_SETTING_KEY='creator_badge_overrides';
const AI_ENHANCE_USAGE_SETTING_KEY='ai_enhance_usage';
const SYSTEM_NOTIFICATIONS_SETTING_KEY='system_notifications';
const USER_FEEDBACK_SETTING_KEY='user_feedback';
const USER_LEGAL_CONSENT_SETTING_KEY='user_legal_consents';
const DEFAULT_SOCIAL_IMAGE_MIME='image/png';
const ONE_DEVICE_LOGIN_MESSAGE='This profile is already logged in on another device. Logout from the other device to login here.';
const USER_SESSION_COOKIE='the_void_user_session';
const ADMIN_SESSION_COOKIE='the_void_session';
const PASSWORD_MIN_LENGTH=8;
const USERNAME_PATTERN=/^[a-z0-9][a-z0-9_.-]{2,23}$/;
const SUPABASE_URL=String(process.env.SUPABASE_URL||process.env.THE_VOID_SUPABASE_URL||'').trim().replace(/\/+$/, '');
const SUPABASE_SERVICE_ROLE_KEY=String(process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.THE_VOID_SUPABASE_SERVICE_ROLE_KEY||'').trim();
const SUPABASE_ANON_KEY=String(process.env.SUPABASE_ANON_KEY||process.env.THE_VOID_SUPABASE_ANON_KEY||'').trim();
const ENABLE_GOOGLE_AUTH=/^true$/i.test(String(process.env.THE_VOID_ENABLE_GOOGLE_AUTH||process.env.ENABLE_GOOGLE_AUTH||'false').trim());
const DEFAULT_ALLOWED_EMAIL_DOMAINS=['gmail.com','googlemail.com','outlook.com','hotmail.com','live.com','msn.com','yahoo.com','ymail.com','icloud.com','me.com','mac.com','proton.me','protonmail.com','aol.com','zoho.com','zohomail.com','rediffmail.com'];
const ALLOWED_EMAIL_DOMAINS=new Set(String(process.env.THE_VOID_ALLOWED_EMAIL_DOMAINS||DEFAULT_ALLOWED_EMAIL_DOMAINS.join(',')).split(',').map((item)=>String(item||'').trim().toLowerCase().replace(/^\.+|\.+$/g,'')).filter(Boolean));
const EMAIL_OTP_ENABLED=/^true$/i.test(String(process.env.THE_VOID_EMAIL_OTP_ENABLED||'false').trim());
const BREVO_API_KEY=String(process.env.BREVO_API_KEY||process.env.THE_VOID_BREVO_API_KEY||'').trim();
const BREVO_SENDER_EMAIL=String(process.env.BREVO_SENDER_EMAIL||process.env.THE_VOID_BREVO_SENDER_EMAIL||'').trim();
const BREVO_SENDER_NAME=String(process.env.BREVO_SENDER_NAME||process.env.THE_VOID_BREVO_SENDER_NAME||'THE VOID SPACE').trim()||'THE VOID SPACE';
const ADMIN_EMAIL_NOTIFICATIONS_ENABLED=!/^false$/i.test(String(process.env.THE_VOID_ADMIN_EMAIL_NOTIFICATIONS||'true').trim());
const ADMIN_NOTIFY_EMAIL=String(process.env.THE_VOID_ADMIN_NOTIFY_EMAIL||process.env.THE_VOID_NOTIFICATION_EMAIL||'thevoid.support4u@gmail.com').trim();
const OTP_TTL_MS=positiveNumberEnv('THE_VOID_OTP_TTL_MS', 10*60*1000, 60*1000);
const OTP_RESEND_MS=positiveNumberEnv('THE_VOID_OTP_RESEND_MS', 60*1000, 10*1000);
const OTP_MAX_ATTEMPTS=Math.floor(positiveNumberEnv('THE_VOID_OTP_MAX_ATTEMPTS', 5, 1));
const OTP_MAX_PENDING=Math.floor(positiveNumberEnv('THE_VOID_OTP_MAX_PENDING', 1000, 10));
const OTP_RATE_WINDOW_MS=positiveNumberEnv('THE_VOID_OTP_RATE_WINDOW_MS', 60*60*1000, 60*1000);
const OTP_MAX_SENDS_PER_WINDOW=Math.floor(positiveNumberEnv('THE_VOID_OTP_MAX_SENDS_PER_HOUR', 5, 1));
const SUPABASE_BUCKET=String(process.env.SUPABASE_BUCKET||process.env.THE_VOID_SUPABASE_BUCKET||'wallpapers').trim()||'wallpapers';
const SUPABASE_PROFILE_BUCKET=String(process.env.SUPABASE_PROFILE_BUCKET||process.env.THE_VOID_PROFILE_BUCKET||'profile-pics').trim()||'profile-pics';
const FORCE_BUNDLE_SEED=/^true$/i.test(String(process.env.THE_VOID_FORCE_BUNDLE_SEED||'').trim());
const AUTO_SYNC_STORAGE=!/^false$/i.test(String(process.env.THE_VOID_AUTO_SYNC_STORAGE||'true').trim());
const IP_HASH_SECRET=String(process.env.THE_VOID_IP_HASH_SECRET||SUPABASE_SERVICE_ROLE_KEY||process.env.THE_VOID_ADMIN_PASSWORD||'the-void-dev-secret').trim();
const USER_SELECT_COLUMNS='creator_id,creator_name,auth_type,email,password_hash,password_salt,auth_user_id,google_email,google_avatar_url,google_linked_at,signup_ip_hash,browser_key_hash,profile_pic_path,profile_pic_url,created_at,updated_at,last_login_at';
const CONFIGURED_AI_ENHANCE_PROVIDER=String(process.env.THE_VOID_AI_ENHANCE_PROVIDER||process.env.AI_ENHANCE_PROVIDER||'cloudinary').trim().toLowerCase();
const AI_ENHANCE_PROVIDER=CONFIGURED_AI_ENHANCE_PROVIDER==='local'?'local':'cloudinary';
const CLOUDINARY_URL=String(process.env.CLOUDINARY_URL||process.env.THE_VOID_CLOUDINARY_URL||'').trim();
const AI_ENHANCE_LIMIT_PER_PROFILE=Math.floor(positiveNumberEnv('THE_VOID_AI_ENHANCE_LIMIT_PER_PROFILE', 3, 0));
const AI_ENHANCE_WINDOW_MS=24*60*60*1000;
const ENHANCED_DOWNLOAD_TTL_MS=positiveNumberEnv('THE_VOID_ENHANCE_DOWNLOAD_TTL_MS', 2*60*1000, 60*1000);
const ENHANCED_DOWNLOAD_CACHE_LIMIT=Math.floor(positiveNumberEnv('THE_VOID_ENHANCE_DOWNLOAD_CACHE_LIMIT', 2, 1));
const ENHANCE_CONCURRENCY=Math.floor(positiveNumberEnv('THE_VOID_ENHANCE_CONCURRENCY', 1, 1));
const ENHANCE_QUEUE_LIMIT=Math.floor(positiveNumberEnv('THE_VOID_ENHANCE_QUEUE_LIMIT', 2, 0));
const SYSTEM_NOTIFICATION_LIMIT=80;
const USER_FEEDBACK_LIMIT=300;
const USER_FEEDBACK_REVIEWED_TTL_MS=7*24*60*60*1000;
const USER_FEEDBACK_LIMIT_PER_24H=2;
const USER_FEEDBACK_LIMIT_WINDOW_MS=24*60*60*1000;
const SHARP_CACHE_MEMORY_MB=Math.floor(positiveNumberEnv('THE_VOID_SHARP_CACHE_MEMORY_MB', 32, 0));
const SHARP_CACHE_ITEMS=Math.floor(positiveNumberEnv('THE_VOID_SHARP_CACHE_ITEMS', 64, 0));
const SHARP_CONCURRENCY=Math.floor(positiveNumberEnv('THE_VOID_SHARP_CONCURRENCY', 1, 1));
const CLOUDINARY_AI_UPSCALE_MAX_SCALE=4;
const CLOUDINARY_AI_RETRY_STATUSES=new Set([408, 420, 423, 429, 500, 502, 503, 504]);
const CLOUDINARY_AI_UPLOAD_RETRY_DELAYS_MS=[1200, 2500, 5000];
const CLOUDINARY_AI_TRANSFORM_RETRY_DELAYS_MS=[2000, 4000, 7000, 10000, 14000];
const USE_SUPABASE=Boolean(SUPABASE_URL&&SUPABASE_SERVICE_ROLE_KEY);
const LOCAL_DATA_DIR=resolveLocalDataDir();
const LOCAL_UPLOAD_DIR=path.join(LOCAL_DATA_DIR, 'uploads');
const LOCAL_PROFILE_PIC_DIR=path.join(LOCAL_DATA_DIR, 'profile-pics');
const LOCAL_VARIANT_DIR=path.join(LOCAL_UPLOAD_DIR, 'variants');
const BUNDLED_VARIANT_DIR=path.join(BUNDLED_UPLOAD_DIR, 'variants');
const WALLPAPER_THUMB_SIZE={
  width:360, height:640
};
const WALLPAPER_PREVIEW_SIZE={
  width:720, height:1280
};
const WEBP_LOSSLESS_OPTIONS={
  lossless:true, effort:6
};
const ENHANCE_MODE_SETTINGS={
  natural:{id:'natural', label:'True Tone Restore', portraitLongEdge:3200, landscapeLongEdge:2560, maxScale:2.25, quality:97, restore:{denoise:.2, deblur:.28, detail:.18, maxDelta:9, aiDetail:.42, aiMaxDelta:10}},
  detail:{id:'detail', label:'True Tone Detail Restore', portraitLongEdge:3840, landscapeLongEdge:3200, maxScale:3, quality:98, restore:{denoise:.24, deblur:.36, detail:.24, maxDelta:11, aiDetail:.5, aiMaxDelta:12}},
  ultra:{id:'ultra', label:'True Tone Detail Restore', portraitLongEdge:4096, landscapeLongEdge:4096, maxScale:4, quality:98, restore:{denoise:.28, deblur:.42, detail:.3, maxDelta:12, aiDetail:.56, aiMaxDelta:13}},
};
const LOCAL_DB_FILE=path.join(LOCAL_DATA_DIR, 'wallpapers.json');
const LOCAL_USERS_FILE=path.join(LOCAL_DATA_DIR, 'users.json');
const runtimePassword=process.env.THE_VOID_ADMIN_PASSWORD||crypto.randomBytes(8).toString('base64url');
const configuredHash=process.env.THE_VOID_ADMIN_PASSWORD_HASH||sha256(runtimePassword);
const sessions=new Map();
const userSessions=new Map();
const localAppSettings=new Map();
let localDbMutationQueue=Promise.resolve();
let localUserMutationQueue=Promise.resolve();
let supabase=null;
let setupError='';
let bootstrapPromise=null;
let supabaseStartupMaintenancePromise=null;
let approvedWallpapersCache=null;
let approvedWallpapersCacheAt=0;
const enhancedDownloads=new Map();
const pendingEmailOtps=new Map();
const otpSendRateLimits=new Map();
const enhanceJobQueue=[];
let activeEnhanceJobs=0;
const APPROVED_WALLPAPER_CACHE_MS=positiveNumberEnv('THE_VOID_WALLPAPER_CACHE_MS', 10000, 1000);
configureSharpForMemory();
if(!process.env.THE_VOID_ADMIN_PASSWORD&&!process.env.THE_VOID_ADMIN_PASSWORD_HASH){
  console.log('\nTHE VOID SPACE admin password for this server run:');
  console.log(`  ${runtimePassword}`);
  console.log('Set THE_VOID_ADMIN_PASSWORD for a permanent password.\n');
}
if(USE_SUPABASE){
  if(!createClient){
    setupError='Supabase dependency missing. Run npm install so @supabase/supabase-js is installed.';
  }
  else{
    supabase=createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {auth:{persistSession:false, autoRefreshToken:false}, global:{headers:{'X-Client-Info':'the-void-render-free'}}, });
    bootstrapPromise=bootstrapSupabase().catch((error)=>{setupError=friendlySupabaseError(error); console.error('Supabase setup failed:', setupError); });
  }
}
else if(isRender()){
  setupError='Supabase is not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Render environment variables.';
}
else{
  prepareLocalStorage();
}
function isRender(){
  return Boolean(process.env.RENDER||process.env.RENDER_SERVICE_ID||process.env.RENDER_EXTERNAL_URL);
}
function positiveNumberEnv(name, fallback, minimum=0){
  const raw=String(process.env[name]||'').trim();
  if(!raw)return fallback;
  const value=Number(raw);
  return Number.isFinite(value)?Math.max(minimum, value):fallback;
}
function configureSharpForMemory(){
  if(!sharp)return;
  try{
    sharp.cache({memory:SHARP_CACHE_MEMORY_MB, files:0, items:SHARP_CACHE_ITEMS});
    sharp.concurrency(SHARP_CONCURRENCY);
  }
  catch{
  }
}
function releaseSharpMemory(){
  if(!sharp)return;
  try{
    sharp.cache(false);
    configureSharpForMemory();
  }
  catch{
  }
}
function jsonClone(value){
  if(value===undefined||value===null)return{
  };
  try{
    return JSON.parse(JSON.stringify(value));
  }
  catch{
    return{
    };
  }
}
async function readAppSettingValue(key){
  const safeKey=String(key||'').trim();
  if(!safeKey)return{
  };
  if(USE_SUPABASE){
    if(bootstrapPromise)await bootstrapPromise.catch(()=>{});
    if(!setupError&&supabase){
      const result=await supabase .from('app_settings').select('value').eq('key', safeKey).maybeSingle();
      if(result.error)throw result.error;
      return result.data?.value&&typeof result.data.value==='object'?result.data.value:{
      };
    }
  }
  return jsonClone(localAppSettings.get(safeKey)||{});
}
async function writeAppSettingValue(key, value){
  const safeKey=String(key||'').trim();
  if(!safeKey)return;
  const safeValue=value&&typeof value==='object'&&!Array.isArray(value)?value:{
  };
  if(USE_SUPABASE){
    if(bootstrapPromise)await bootstrapPromise.catch(()=>{});
    if(!setupError&&supabase){
      const now=new Date().toISOString();
      const result=await supabase.from('app_settings').upsert({key:safeKey, value:safeValue, updated_at:now, }, {onConflict:'key'});
      if(result.error)throw result.error;
      return;
    }
  }
  localAppSettings.set(safeKey, jsonClone(safeValue));
}
async function readUploadLimitExemptions(){
  const value=await readAppSettingValue(UPLOAD_LIMIT_EXEMPTIONS_SETTING_KEY);
  const source=value.users&&typeof value.users==='object'&&!Array.isArray(value.users)?value.users:value;
  const users={
  };
  for(const[creatorId, enabled]of Object.entries(source||{})){
    const id=String(creatorId||'').trim();
    if(id&&enabled)users[id]=true;
  }
  return users;
}
async function writeUploadLimitExemptions(users){
  const cleaned={
  };
  for(const[creatorId, enabled]of Object.entries(users||{})){
    const id=String(creatorId||'').trim();
    if(id&&enabled)cleaned[id]=true;
  }
  await writeAppSettingValue(UPLOAD_LIMIT_EXEMPTIONS_SETTING_KEY, {users:cleaned, updatedAt:new Date().toISOString(), });
}
async function userHasUnlimitedUploads(creatorId){
  const id=String(creatorId||'').trim();
  if(!id)return false;
  if(!USE_SUPABASE){
    const localUser=normalizeUserRow(readLocalUsers().find((user)=>user.creatorId===id)||null);
    if(localUser?.unlimitedUploads)return true;
  }
  const users=await readUploadLimitExemptions();
  return Boolean(users[id]);
}
async function readAiEnhanceUsage(){
  const value=await readAppSettingValue(AI_ENHANCE_USAGE_SETTING_KEY);
  const source=value.users&&typeof value.users==='object'&&!Array.isArray(value.users)?value.users:value;
  const users={};
  const cutoff=Date.now()-AI_ENHANCE_WINDOW_MS;
  for(const[creatorId, entries]of Object.entries(source||{})){
    const id=String(creatorId||'').trim();
    if(!id||!Array.isArray(entries))continue;
    const timestamps=entries
      .map((entry)=>typeof entry==='number'?entry:Date.parse(String(entry||'')))
      .filter((time)=>Number.isFinite(time)&&time>=cutoff&&time<=Date.now()+60*1000)
      .sort((a, b)=>a-b);
    if(timestamps.length)users[id]=timestamps;
  }
  return users;
}
async function writeAiEnhanceUsage(users){
  const cleaned={};
  const cutoff=Date.now()-AI_ENHANCE_WINDOW_MS;
  for(const[creatorId, entries]of Object.entries(users||{})){
    const id=String(creatorId||'').trim();
    const timestamps=Array.isArray(entries)?entries
      .map((entry)=>typeof entry==='number'?entry:Date.parse(String(entry||'')))
      .filter((time)=>Number.isFinite(time)&&time>=cutoff&&time<=Date.now()+60*1000)
      .sort((a, b)=>a-b):[];
    if(id&&timestamps.length)cleaned[id]=timestamps.map((time)=>new Date(time).toISOString());
  }
  await writeAppSettingValue(AI_ENHANCE_USAGE_SETTING_KEY, {users:cleaned, limit:AI_ENHANCE_LIMIT_PER_PROFILE, windowHours:24, updatedAt:new Date().toISOString(), });
}
async function getAiEnhanceUsageState(creatorId){
  const id=String(creatorId||'').trim();
  const users=await readAiEnhanceUsage();
  const timestamps=id&&Array.isArray(users[id])?users[id]:[];
  const used=timestamps.length;
  const limit=Math.max(0, AI_ENHANCE_LIMIT_PER_PROFILE);
  const resetAt=used>=limit&&timestamps[0]?timestamps[0]+AI_ENHANCE_WINDOW_MS:0;
  return{used, limit, remaining:Math.max(0, limit-used), resetAt, windowMs:AI_ENHANCE_WINDOW_MS, users};
}
async function recordAiEnhanceUse(creatorId, usageState=null){
  const id=String(creatorId||'').trim();
  if(!id)return getAiEnhanceUsageState(id);
  const state=usageState?.users?usageState:await getAiEnhanceUsageState(id);
  const users={...state.users};
  const current=Array.isArray(users[id])?users[id].slice():[];
  current.push(Date.now());
  users[id]=current;
  await writeAiEnhanceUsage(users);
  return getAiEnhanceUsageState(id);
}
const CREATOR_BADGES={
  starter:{id:'starter', label:'Void Spark', shortLabel:'Spark', rank:1, threshold:'1+ approved wallpapers'},
  curator:{id:'curator', label:'Rift Shaper', shortLabel:'Shaper', rank:2, threshold:'15+ approved wallpapers'},
  void_creator:{id:'void_creator', label:'THE VOID SPACE Architect', shortLabel:'Architect', rank:3, threshold:'30+ approved wallpapers'},
};
function normalizeBadgeOverride(value){
  const badge=String(value||'auto').trim().toLowerCase();
  if(['auto', 'none', 'starter', 'curator', 'void_creator'].includes(badge))return badge;
  return 'auto';
}
async function readBadgeOverrides(){
  const value=await readAppSettingValue(BADGE_OVERRIDES_SETTING_KEY);
  const source=value.users&&typeof value.users==='object'&&!Array.isArray(value.users)?value.users:value;
  const users={};
  for(const[creatorId, badge]of Object.entries(source||{})){
    const id=String(creatorId||'').trim();
    const normalized=normalizeBadgeOverride(badge);
    if(id&&normalized!=='auto')users[id]=normalized;
  }
  return users;
}
async function writeBadgeOverrides(users){
  const cleaned={};
  for(const[creatorId, badge]of Object.entries(users||{})){
    const id=String(creatorId||'').trim();
    const normalized=normalizeBadgeOverride(badge);
    if(id&&normalized!=='auto')cleaned[id]=normalized;
  }
  await writeAppSettingValue(BADGE_OVERRIDES_SETTING_KEY, {users:cleaned, updatedAt:new Date().toISOString(), });
}
async function clearBadgeOverrideForCreator(creatorId){
  const id=String(creatorId||'').trim();
  if(!id)return;
  const overrides=await readBadgeOverrides();
  if(overrides[id]){
    delete overrides[id];
    await writeBadgeOverrides(overrides);
  }
}
function automaticCreatorBadgeId(approvedWallpaperCount){
  const count=Number(approvedWallpaperCount||0);
  if(count>=30)return 'void_creator';
  if(count>=15)return 'curator';
  if(count>=1)return 'starter';
  return '';
}
function creatorBadgeForCount(approvedWallpaperCount, override='auto'){
  const normalized=normalizeBadgeOverride(override);
  const badgeId=normalized==='auto'?automaticCreatorBadgeId(approvedWallpaperCount):normalized==='none'?'':normalized;
  const badge=CREATOR_BADGES[badgeId];
  if(!badge)return null;
  return{...badge, source:normalized==='auto'?'auto':'manual'};
}
function retryAfterSecondsUntil(lockedUntilMs){
  return Math.max(1, Math.ceil((Number(lockedUntilMs||0)- Date.now())/ 1000));
}
function formatMinutes(seconds){
  const value=Math.max(1, Math.ceil(Number(seconds||0)/ 60));
  return `${value} minute${value === 1 ? '' : 's'}`;
}
function formatHours(seconds){
  const value=Math.max(1, Math.ceil(Number(seconds||0)/ 3600));
  return `${value} hour${value === 1 ? '' : 's'}`;
}
function lockoutPayload(message, lockedUntilMs){
  const retryAfterSeconds=retryAfterSecondsUntil(lockedUntilMs);
  return{
    error:message, locked:true, lockedUntil:new Date(Number(lockedUntilMs||0)).toISOString(), retryAfterSeconds,
  };
}
function adminLoginDeviceHash(req, browserKey=''){
  const key=String(browserKey||'').trim().slice(0, 128);
  if(key)return hashScoped(key, 'admin-login-browser-key');
  return hashScoped(getRequestIp(req), 'admin-login-ip');
}
async function readAdminLoginProtection(){
  const value=await readAppSettingValue(ADMIN_LOGIN_PROTECTION_SETTING_KEY);
  const source=value.devices&&typeof value.devices==='object'&&!Array.isArray(value.devices)?value.devices:{
  };
  const devices={
  };
  const cutoff=Date.now()- 24*60*60*1000;
  for(const[deviceHash, entry]of Object.entries(source)){
    if(!deviceHash||!entry||typeof entry!=='object')continue;
    const lockedUntilMs=Date.parse(entry.lockedUntil||'');
    const updatedAtMs=Date.parse(entry.updatedAt||'');
    const isLocked=Number.isFinite(lockedUntilMs)&&lockedUntilMs>Date.now();
    const isRecent=Number.isFinite(updatedAtMs)&&updatedAtMs>=cutoff;
    if(!isLocked&&!isRecent)continue;
    const parsedLockedUntilMs=Number.isFinite(lockedUntilMs)?lockedUntilMs:0;
    devices[deviceHash]={
      failedAttempts:parsedLockedUntilMs&&parsedLockedUntilMs<=Date.now()?0:Math.max(0, Number(entry.failedAttempts||0)||0), lockedUntilMs:parsedLockedUntilMs&&parsedLockedUntilMs>Date.now()?parsedLockedUntilMs:0, updatedAt:entry.updatedAt||new Date().toISOString(),
    };
  }
  return devices;
}
async function writeAdminLoginProtection(devices){
  const cleaned={
  };
  const cutoff=Date.now()- 24*60*60*1000;
  for(const[deviceHash, entry]of Object.entries(devices||{})){
    const lockedUntilMs=Number(entry?.lockedUntilMs||0);
    const updatedAtMs=Date.parse(entry?.updatedAt||'');
    const isLocked=lockedUntilMs>Date.now();
    const isRecent=Number.isFinite(updatedAtMs)&&updatedAtMs>=cutoff;
    if(!isLocked&&!isRecent)continue;
    cleaned[deviceHash]={
      failedAttempts:Math.max(0, Number(entry?.failedAttempts||0)||0), lockedUntil:isLocked?new Date(lockedUntilMs).toISOString():'', updatedAt:entry?.updatedAt||new Date().toISOString(),
    };
  }
  await writeAppSettingValue(ADMIN_LOGIN_PROTECTION_SETTING_KEY, {devices:cleaned, updatedAt:new Date().toISOString(), });
}
async function getAdminLoginLock(deviceHash){
  const devices=await readAdminLoginProtection();
  const entry=devices[deviceHash];
  if(entry?.lockedUntilMs>Date.now())return entry;
  return null;
}
async function recordAdminLoginFailure(deviceHash){
  const devices=await readAdminLoginProtection();
  const current=devices[deviceHash]||{
    failedAttempts:0, lockedUntilMs:0
  };
  const failedAttempts=Number(current.failedAttempts||0)+ 1;
  const now=new Date().toISOString();
  if(failedAttempts>=ADMIN_LOGIN_MAX_FAILED_ATTEMPTS){
    const lockedUntilMs=Date.now()+ ADMIN_LOGIN_LOCK_MS;
    devices[deviceHash]={
      failedAttempts, lockedUntilMs, updatedAt:now
    };
    await writeAdminLoginProtection(devices);
    return{
      locked:true, failedAttempts, lockedUntilMs, remainingAttempts:0
    };
  }
  devices[deviceHash]={
    failedAttempts, lockedUntilMs:0, updatedAt:now
  };
  await writeAdminLoginProtection(devices);
  return{
    locked:false, failedAttempts, lockedUntilMs:0, remainingAttempts:Math.max(0, ADMIN_LOGIN_MAX_FAILED_ATTEMPTS - failedAttempts),
  };
}
async function clearAdminLoginFailure(deviceHash){
  const devices=await readAdminLoginProtection();
  if(devices[deviceHash]){
    delete devices[deviceHash];
    await writeAdminLoginProtection(devices);
  }
}
function userLoginDeviceHash(req, browserKey=''){
  const key=String(browserKey||'').trim().slice(0, 128);
  if(key)return hashScoped(key, 'login-browser-key');
  return hashScoped(getRequestIp(req), 'login-ip');
}
async function readUserLoginProtection(){
  const value=await readAppSettingValue(USER_LOGIN_PROTECTION_SETTING_KEY);
  const source=value.devices&&typeof value.devices==='object'&&!Array.isArray(value.devices)?value.devices:{
  };
  const devices={
  };
  const cutoff=Date.now()- 24*60*60*1000;
  for(const[deviceHash, entry]of Object.entries(source)){
    if(!deviceHash||!entry||typeof entry!=='object')continue;
    const lockedUntilMs=Date.parse(entry.lockedUntil||'');
    const updatedAtMs=Date.parse(entry.updatedAt||'');
    const isLocked=Number.isFinite(lockedUntilMs)&&lockedUntilMs>Date.now();
    const isRecent=Number.isFinite(updatedAtMs)&&updatedAtMs>=cutoff;
    if(!isLocked&&!isRecent)continue;
    const parsedLockedUntilMs=Number.isFinite(lockedUntilMs)?lockedUntilMs:0;
    devices[deviceHash]={
      failedAttempts:parsedLockedUntilMs&&parsedLockedUntilMs<=Date.now()?0:Math.max(0, Number(entry.failedAttempts||0)||0), lockedUntilMs:parsedLockedUntilMs&&parsedLockedUntilMs>Date.now()?parsedLockedUntilMs:0, updatedAt:entry.updatedAt||new Date().toISOString(),
    };
  }
  return devices;
}
async function writeUserLoginProtection(devices){
  const cleaned={
  };
  const cutoff=Date.now()- 24*60*60*1000;
  for(const[deviceHash, entry]of Object.entries(devices||{})){
    const lockedUntilMs=Number(entry?.lockedUntilMs||0);
    const updatedAtMs=Date.parse(entry?.updatedAt||'');
    const isLocked=lockedUntilMs>Date.now();
    const isRecent=Number.isFinite(updatedAtMs)&&updatedAtMs>=cutoff;
    if(!isLocked&&!isRecent)continue;
    cleaned[deviceHash]={
      failedAttempts:Math.max(0, Number(entry?.failedAttempts||0)||0), lockedUntil:isLocked?new Date(lockedUntilMs).toISOString():'', updatedAt:entry?.updatedAt||new Date().toISOString(),
    };
  }
  await writeAppSettingValue(USER_LOGIN_PROTECTION_SETTING_KEY, {devices:cleaned, updatedAt:new Date().toISOString(), });
}
async function getUserLoginLock(deviceHash){
  const devices=await readUserLoginProtection();
  const entry=devices[deviceHash];
  if(entry?.lockedUntilMs>Date.now())return entry;
  return null;
}
async function recordUserLoginFailure(deviceHash){
  const devices=await readUserLoginProtection();
  const current=devices[deviceHash]||{
    failedAttempts:0, lockedUntilMs:0
  };
  const failedAttempts=Number(current.failedAttempts||0)+ 1;
  const now=new Date().toISOString();
  if(failedAttempts>=USER_LOGIN_MAX_FAILED_ATTEMPTS){
    const lockedUntilMs=Date.now()+ USER_LOGIN_LOCK_MS;
    devices[deviceHash]={
      failedAttempts, lockedUntilMs, updatedAt:now
    };
    await writeUserLoginProtection(devices);
    return{
      locked:true, failedAttempts, lockedUntilMs, remainingAttempts:0
    };
  }
  devices[deviceHash]={
    failedAttempts, lockedUntilMs:0, updatedAt:now
  };
  await writeUserLoginProtection(devices);
  return{
    locked:false, failedAttempts, lockedUntilMs:0, remainingAttempts:Math.max(0, USER_LOGIN_MAX_FAILED_ATTEMPTS - failedAttempts),
  };
}
async function clearUserLoginFailure(deviceHash){
  const devices=await readUserLoginProtection();
  if(devices[deviceHash]){
    delete devices[deviceHash];
    await writeUserLoginProtection(devices);
  }
}
function securityHeaders(){
  return{
    'X-Content-Type-Options':'nosniff', 'X-Frame-Options':'DENY', 'Referrer-Policy':'strict-origin-when-cross-origin', 'Permissions-Policy':'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()', 'Strict-Transport-Security':'max-age=31536000; includeSubDomains', 'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https:; media-src 'self' data: blob: https:; connect-src 'self' https:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
  };
}
function applySecurityHeaders(res){
  for(const[key, value]of Object.entries(securityHeaders())){
    res.setHeader(key, value);
  }
}
function requestOrigin(req){
  const raw=req.headers.origin||'';
  return Array.isArray(raw)?raw[0]:String(raw||'').trim();
}
function requestRefererOrigin(req){
  const raw=req.headers.referer||'';
  const ref=Array.isArray(raw)?raw[0]:String(raw||'').trim();
  if(!ref)return '';
  try{
    return new URL(ref).origin;
  }
  catch{
    return '';
  }
}
function expectedOrigins(req){
  const hostHeader=req.headers['x-forwarded-host']||req.headers.host||'';
  const hosts=String(Array.isArray(hostHeader)?hostHeader[0]:hostHeader).split(',').map((item)=>item.trim()).filter(Boolean);
  const protoHeader=req.headers['x-forwarded-proto']||(req.socket.encrypted?'https':'http');
  const proto=String(Array.isArray(protoHeader)?protoHeader[0]:protoHeader).split(',')[0].trim()||'http';
  const origins=new Set(hosts.map((host)=>`${proto}://${host}`));
  if(process.env.RENDER_EXTERNAL_URL)origins.add(String(process.env.RENDER_EXTERNAL_URL).trim().replace(/\/+$/, ''));
  for(const item of String(process.env.THE_VOID_ALLOWED_ORIGINS||'').split(',')){
    const origin=item.trim().replace(/\/+$/, '');
    if(origin)origins.add(origin);
  }
  return origins;
}
function sameOrigin(req, origin){
  if(!origin)return false;
  let parsed;
  try{
    parsed=new URL(origin);
  }
  catch{
    return false;
  }
  for(const expected of expectedOrigins(req)){
    try{
      const allowed=new URL(expected);
      if(parsed.protocol===allowed.protocol&&parsed.host===allowed.host)return true;
    }
    catch{
    }
  }
  return false;
}
function isStateChangingMethod(method){
  return['POST', 'PUT', 'PATCH', 'DELETE'].includes(String(method||'').toUpperCase());
}
function passesOriginCsrfCheck(req){
  const origin=requestOrigin(req)||requestRefererOrigin(req);
  return sameOrigin(req, origin);
}
function resolveLocalDataDir(){
  const configured=String(process.env.THE_VOID_DATA_DIR||'').trim();
  if(configured)return path.resolve(configured);
  if(process.platform==='win32'&&process.env.LOCALAPPDATA){
    return path.join(process.env.LOCALAPPDATA, 'THE-VOID', 'data');
  }
  if(process.env.XDG_DATA_HOME){
    return path.join(process.env.XDG_DATA_HOME, 'the-void', 'data');
  }
  return path.join(os.homedir(), '.the-void', 'data');
}
function sha256(value){
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}
function sha1(value){
  return crypto.createHash('sha1').update(String(value)).digest('hex');
}
function friendlySupabaseError(error){
  const message=String(error?.message||error?.details||error||'Supabase setup failed.');
  if(/relation .*wallpapers.*does not exist|relation .*app_settings.*does not exist|relation .*users.*does not exist|schema cache/i.test(message)){
    return 'Supabase tables are missing. Run supabase/schema.sql in Supabase SQL Editor, then redeploy/restart.';
  }
  if(/bucket not found|not found/i.test(message)&&/bucket|storage/i.test(message)){
    return `Supabase Storage bucket was not found. Create public buckets named ${SUPABASE_BUCKET} and ${SUPABASE_PROFILE_BUCKET}.`;
  }
  if(/duplicate key value|unique constraint/i.test(message)){
    if(/users_creator_name_key_unique|creator_name|username/i.test(message))return 'USERNAME_TAKEN';
    if(/users_email_key_unique|email/i.test(message))return 'EMAIL_TAKEN';
    if(/users_auth_user_id_unique|auth_user_id/i.test(message))return 'Google account is already linked to another profile.';
  }
  if(/invalid api key|JWT|authorization|apikey/i.test(message)){
    return 'Supabase key is invalid. Use the service_role key on the backend, not the anon key.';
  }
  return message;
}
async function bootstrapSupabase(){
  if(!supabase)return;
  const settingsCheck=await supabase.from('app_settings').select('key').limit(1);
  if(settingsCheck.error)throw settingsCheck.error;
  const wallpaperCheck=await supabase.from('wallpapers').select('id').limit(1);
  if(wallpaperCheck.error)throw wallpaperCheck.error;
  const usersCheck=await supabase.from('users').select(USER_SELECT_COLUMNS).limit(1);
  if(usersCheck.error)throw usersCheck.error;
  runSupabaseStartupMaintenance();
}
function runSupabaseStartupMaintenance(){
  if(!supabase||supabaseStartupMaintenancePromise)return supabaseStartupMaintenancePromise;
  supabaseStartupMaintenancePromise=(async()=>{await seedBundledWallpapersOnce(); await syncExistingStorageObjectsToDb(); await backfillSupabaseWallpaperVariants(); })().catch((error)=>{console.warn('Supabase startup maintenance skipped:', friendlySupabaseError(error)||error.message||error); }).finally(()=>{supabaseStartupMaintenancePromise=null; });
  return supabaseStartupMaintenancePromise;
}
function clearApprovedWallpapersCache(){
  approvedWallpapersCache=null;
  approvedWallpapersCacheAt=0;
}
async function seedBundledWallpapersOnce(){
  if(!fs.existsSync(BUNDLED_DB_FILE))return;
  const settingKey='bundled_seed_done';
  if(!FORCE_BUNDLE_SEED){
    const existing=await supabase .from('app_settings').select('key').eq('key', settingKey).maybeSingle();
    if(existing.error)throw existing.error;
    if(existing.data)return;
  }
  const bundledDb=readDbFile(BUNDLED_DB_FILE);
  const rows=[];
  const now=new Date().toISOString();
  for(const item of bundledDb.wallpapers){
    const id=String(item.id||'').trim();
    const filename=path.basename(String(item.filename||''));
    if(!id||!filename)continue;
    const sourcePath=path.join(BUNDLED_UPLOAD_DIR, filename);
    if(!fs.existsSync(sourcePath))continue;
    const ext=path.extname(filename).replace(/^\./, '').toLowerCase()||'jpg';
    const mime=item.mime||mimeForExt(path.extname(filename))||`image/${ext === 'jpg' ? 'jpeg' : ext}`;
    const storagePath=`seed/${filename}`;
    const buffer=fs.readFileSync(sourcePath);
    const upload=await supabase.storage .from(SUPABASE_BUCKET).upload(storagePath, buffer, {contentType:mime, cacheControl:'31536000', upsert:true, });
    if(upload.error)throw upload.error;
    const status=['pending', 'approved', 'rejected'].includes(item.status)?item.status:'approved';
    if(status==='approved')await uploadSupabaseWallpaperVariants(id, buffer, true);
    const publicUrlResult=supabase.storage.from(SUPABASE_BUCKET).getPublicUrl(storagePath);
    const publicUrl=publicUrlResult?.data?.publicUrl;
    if(!publicUrl)throw new Error(`Could not create public URL for ${storagePath}.`);
    rows.push({id, title:String(item.title||'Untitled wallpaper').trim().slice(0, 80)||'Untitled wallpaper', creator:String(item.creator||'The Void').trim().slice(0, 60)||'The Void', storage_path:storagePath, public_url:publicUrl, mime, status, created_at:item.createdAt||now, approved_at:item.approvedAt||null, updated_at:item.updatedAt||item.approvedAt||item.createdAt||now, });
  }
  if(rows.length){
    const upsert=await supabase.from('wallpapers').upsert(rows, {onConflict:'id'});
    if(upsert.error)throw upsert.error;
  }
  const marker=await supabase.from('app_settings').upsert({key:settingKey, value:{seededAt:now, count:rows.length, forced:FORCE_BUNDLE_SEED}, updated_at:now, }, {onConflict:'key'});
  if(marker.error)throw marker.error;
  console.log(`Seeded ${rows.length} bundled wallpapers into Supabase Storage/DB.`);
}
function isImageStoragePath(storagePath, item={}){
  const ext=path.extname(String(storagePath||'')).toLowerCase();
  const mime=String(item?.metadata?.mimetype||item?.metadata?.mimeType||item?.metadata?.contentType||'').toLowerCase();
  return['.jpg', '.jpeg', '.png', '.webp'].includes(ext)||/^image\/(jpeg|png|webp)$/.test(mime);
}
async function listStorageImageObjects(prefix='', depth=0){
  const images=[];
  if(!supabase||depth>5)return images;
  for(let offset=0; offset<10000; offset +=1000){
    const listed=await supabase.storage.from(SUPABASE_BUCKET).list(prefix, {limit:1000, offset, sortBy:{column:'created_at', order:'desc'}, });
    if(listed.error)throw listed.error;
    const entries=listed.data||[];
    for(const entry of entries){
      if(!entry?.name||entry.name==='.emptyFolderPlaceholder')continue;
      const storagePath=prefix?`${prefix}/${entry.name}`:entry.name;
      if(isImageStoragePath(storagePath, entry)){
        images.push({...entry, storagePath});
        continue;
      }
      if(!path.extname(entry.name)&&depth<5){
        const nested=await listStorageImageObjects(storagePath, depth + 1);
        images.push(...nested);
      }
    }
    if(entries.length<1000)break;
  }
  return images;
}
function titleFromStoragePath(storagePath){
  const name=path.basename(String(storagePath||''), path.extname(String(storagePath||'')));
  const cleaned=name .replace(/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i, 'Wallpaper').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
  return(cleaned||'Recovered wallpaper').slice(0, 80);
}
async function syncExistingStorageObjectsToDb(){
  if(!AUTO_SYNC_STORAGE||!supabase)return;
  const files=await listStorageImageObjects('');
  if(!files.length)return;
  const existingPaths=new Set();
  for(let offset=0; offset<10000; offset +=1000){
    const result=await supabase .from('wallpapers').select('storage_path').range(offset, offset + 999);
    if(result.error)throw result.error;
    for(const row of result.data||[]){
      if(row.storage_path)existingPaths.add(row.storage_path);
    }
    if((result.data||[]).length<1000)break;
  }
  const now=new Date().toISOString();
  const rows=[];
  for(const file of files){
    if(!file.storagePath||isWallpaperVariantStoragePath(file.storagePath)||existingPaths.has(file.storagePath))continue;
    const mime=String(file?.metadata?.mimetype||file?.metadata?.mimeType||file?.metadata?.contentType||mimeForExt(path.extname(file.storagePath))||'image/jpeg');
    const publicUrlResult=supabase.storage.from(SUPABASE_BUCKET).getPublicUrl(file.storagePath);
    const publicUrl=publicUrlResult?.data?.publicUrl;
    if(!publicUrl)continue;
    const createdAt=file.created_at||file.updated_at||now;
    rows.push({id:crypto.randomUUID(), title:titleFromStoragePath(file.storagePath), creator:'The Void', creator_id:null, auth_type:'password', storage_path:file.storagePath, public_url:publicUrl, mime, status:'approved', created_at:createdAt, approved_at:createdAt, updated_at:file.updated_at||createdAt, });
  }
  if(!rows.length)return;
  for(let index=0; index<rows.length; index +=100){
    const batch=rows.slice(index, index + 100);
    const insert=await supabase.from('wallpapers').insert(batch);
    if(insert.error)throw insert.error;
  }
  console.log(`Recovered ${rows.length} existing Supabase Storage image(s) into the wallpapers table.`);
}
async function supabaseStorageObjectExists(storagePath){
  if(!supabase||!storagePath)return false;
  const result=await supabase.storage.from(SUPABASE_BUCKET).download(storagePath);
  return !result.error&&Boolean(result.data);
}
async function uploadSingleSupabaseWallpaperVariant(id, buffer, variantName){
  const size=variantName==='preview'?WALLPAPER_PREVIEW_SIZE:WALLPAPER_THUMB_SIZE;
  const quality=variantName==='preview'?78:72;
  const out=await makeWallpaperVariantBuffer(buffer, size, quality);
  if(!out)return false;
  const upload=await supabase.storage.from(SUPABASE_BUCKET).upload(wallpaperVariantStoragePath(id, variantName), out, {contentType:'image/webp', cacheControl:'31536000', upsert:true});
  if(upload.error)throw upload.error;
  return true;
}
async function backfillSupabaseWallpaperVariants(){
  if(!supabase||!sharp)return;
  let checked=0;
  let generated=0;
  let failed=0;
  for(let offset=0; offset<10000; offset +=1000){
    const result=await supabase.from('wallpapers').select('id,storage_path,status').range(offset, offset + 999);
    if(result.error){
      console.warn('Supabase wallpaper variant backfill skipped:', friendlySupabaseError(result.error)||result.error.message||result.error);
      return;
    }
    const rows=result.data||[];
    for(const row of rows){
      if(!row?.id||!row?.storage_path||isWallpaperVariantStoragePath(row.storage_path))continue;
      checked +=1;
      try{
        if(row.status!=='approved'){
          await removeStorageObjects(SUPABASE_BUCKET, [wallpaperVariantStoragePath(row.id, 'thumb'), wallpaperVariantStoragePath(row.id, 'preview')]);
          continue;
        }
        const missing=[];
        for(const variantName of ['thumb', 'preview']){
          const exists=await supabaseStorageObjectExists(wallpaperVariantStoragePath(row.id, variantName));
          if(!exists)missing.push(variantName);
        }
        if(!missing.length)continue;
        const source=await supabase.storage.from(SUPABASE_BUCKET).download(row.storage_path);
        if(source.error)throw source.error;
        const buffer=Buffer.from(await source.data.arrayBuffer());
        for(const variantName of missing){
          if(await uploadSingleSupabaseWallpaperVariant(row.id, buffer, variantName))generated +=1;
        }
      }
      catch(error){
        failed +=1;
        console.warn('Could not backfill wallpaper variants for', row.id, friendlySupabaseError(error)||error.message||error);
      }
    }
    if(rows.length<1000)break;
  }
  if(generated){
    console.log(`Backfilled ${generated} missing Supabase wallpaper variant(s) for ${checked} wallpaper(s).`);
  }
  if(failed){
    console.warn(`Wallpaper variant refresh skipped ${failed} failed wallpaper(s).`);
  }
}
async function ensureBackendReady(res){
  if(bootstrapPromise)await bootstrapPromise;
  if(setupError){
    sendJson(res, 500, {error:setupError, setupRequired:true, requiredEnv:['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_BUCKET', 'THE_VOID_ADMIN_PASSWORD'], });
    return false;
  }
  return true;
}
function prepareLocalStorage(){
  fs.mkdirSync(LOCAL_DATA_DIR, {recursive:true});
  fs.mkdirSync(LOCAL_UPLOAD_DIR, {recursive:true});
  fs.mkdirSync(LOCAL_PROFILE_PIC_DIR, {recursive:true});
  fs.mkdirSync(LOCAL_VARIANT_DIR, {recursive:true});
  fs.mkdirSync(path.join(LOCAL_VARIANT_DIR, 'thumbs'), {recursive:true});
  fs.mkdirSync(path.join(LOCAL_VARIANT_DIR, 'previews'), {recursive:true});
  if(!fs.existsSync(LOCAL_DB_FILE)){
    if(fs.existsSync(BUNDLED_DB_FILE)){
      fs.copyFileSync(BUNDLED_DB_FILE, LOCAL_DB_FILE);
    }
    else{
      writeFileAtomic(LOCAL_DB_FILE, JSON.stringify({wallpapers:[]}, null, 2));
    }
  }
  if(!fs.existsSync(LOCAL_USERS_FILE)){
    writeFileAtomic(LOCAL_USERS_FILE, JSON.stringify([], null, 2));
  }
  copyMissingBundledUploadsToLocal();
  ensureLocalWallpaperVariants().catch((error)=>console.warn('Wallpaper variant generation skipped:', error.message||error));
}
function copyMissingBundledUploadsToLocal(){
  if(!fs.existsSync(BUNDLED_UPLOAD_DIR))return;
  const db=readDbFile(LOCAL_DB_FILE);
  const referencedFiles=new Set(db.wallpapers.map((item)=>path.basename(String(item.filename||''))).filter(Boolean));
  for(const filename of referencedFiles){
    const source=path.join(BUNDLED_UPLOAD_DIR, filename);
    const target=path.join(LOCAL_UPLOAD_DIR, filename);
    if(fs.existsSync(source)&&!fs.existsSync(target))fs.copyFileSync(source, target);
  }
  copyMissingBundledVariantsToLocal();
}
function readDbFile(filePath){
  try{
    const parsed=JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return{
      wallpapers:Array.isArray(parsed.wallpapers)?parsed.wallpapers:[]
    };
  }
  catch{
    return{
      wallpapers:[]
    };
  }
}
function readLocalDb(){
  return readDbFile(LOCAL_DB_FILE);
}
function readUsersFile(filePath){
  try{
    const parsed=JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return Array.isArray(parsed)?parsed:[];
  }
  catch{
    return[];
  }
}
function readLocalUsers(){
  return readUsersFile(LOCAL_USERS_FILE);
}
function writeLocalUsers(users){
  const safeUsers=Array.isArray(users)?users:[];
  writeFileAtomic(LOCAL_USERS_FILE, JSON.stringify(safeUsers, null, 2));
}
function sanitizeDb(db){
  return{
    wallpapers:Array.isArray(db.wallpapers)?db.wallpapers:[]
  };
}
function writeFileAtomic(filePath, contents){
  fs.mkdirSync(path.dirname(filePath), {recursive:true});
  const tempFile=`${filePath}.${process.pid}.${Date.now()}.tmp`;
  const fd=fs.openSync(tempFile, 'w');
  try{
    fs.writeFileSync(fd, contents);
    fs.fsyncSync(fd);
  }
  finally{
    fs.closeSync(fd);
  }
  fs.renameSync(tempFile, filePath);
}
function writeLocalDb(db){
  writeFileAtomic(LOCAL_DB_FILE, JSON.stringify(sanitizeDb(db), null, 2));
}
function mutateLocalDb(mutator){
  const run=localDbMutationQueue.then(async()=>{const db=readLocalDb(); const result=await mutator(db); writeLocalDb(db); return result; });
  localDbMutationQueue=run.catch(()=>{});
  return run;
}
function safeCompare(a, b){
  const ab=Buffer.from(String(a));
  const bb=Buffer.from(String(b));
  if(ab.length!==bb.length)return false;
  return crypto.timingSafeEqual(ab, bb);
}
function sendJson(res, status, payload, extraHeaders={}){
  const body=JSON.stringify(payload);
  res.writeHead(status, {'Content-Type':'application/json; charset=utf-8', 'Content-Length':Buffer.byteLength(body), 'Cache-Control':'no-store', ...extraHeaders, });
  res.end(body);
}
function readBody(req, limit=1024*1024){
  return new Promise((resolve, reject)=>{let size=0; const chunks=[]; req.on('data', (chunk)=>{size +=chunk.length; if(size>limit){reject(new Error('Request body is too large.')); req.destroy(); return; }chunks.push(chunk); }); req.on('end', ()=>resolve(Buffer.concat(chunks).toString('utf8'))); req.on('error', reject); });
}
function parseCookies(req){
  const header=req.headers.cookie||'';
  const cookies={
  };
  for(const part of header.split(';')){
    const[rawKey, ...rawValue]=part.trim().split('=');
    if(!rawKey)continue;
    cookies[decodeURIComponent(rawKey)]=decodeURIComponent(rawValue.join('='));
  }
  return cookies;
}
function isAdmin(req){
  const token=parseCookies(req)[ADMIN_SESSION_COOKIE];
  if(!token)return false;
  const session=sessions.get(token);
  if(!session||session.expiresAt<Date.now()){
    sessions.delete(token);
    return false;
  }
  session.expiresAt=Date.now()+ SESSION_TTL_MS;
  return true;
}
function extForMime(mime){
  if(mime==='image/jpeg')return 'jpg';
  if(mime==='image/png')return 'png';
  if(mime==='image/webp')return 'webp';
  return null;
}
function normalizeImageFormat(value){
  const format=String(value||'').toLowerCase().replace(/^image\//, '').replace(/^\./, '');
  if(format==='jpg'||format==='jpeg')return 'jpeg';
  if(format==='png')return 'png';
  if(format==='webp')return 'webp';
  return '';
}
function mimeForImageFormat(format){
  const normalized=normalizeImageFormat(format);
  return normalized==='jpeg'?'image/jpeg':normalized==='png'?'image/png':normalized==='webp'?'image/webp':'application/octet-stream';
}
function extForImageFormat(format){
  const normalized=normalizeImageFormat(format);
  return normalized==='jpeg'?'jpg':normalized||'jpg';
}
function mimeForExt(ext){
  return{
    '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.json':'application/json; charset=utf-8', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.webp':'image/webp', '.ico':'image/x-icon',
  }
  [ext]||'application/octet-stream';
}
function parseImageDataUrl(dataUrl, maxBytes, label='image'){
  const match=String(dataUrl||'').match(/^data:(image\/(png|jpeg|webp));base64,([A-Za-z0-9+/=\r\n]+)$/);
  if(!match){
    const error=new Error(`Upload a PNG, JPG, or WEBP ${label}.`);
    error.status=400;
    throw error;
  }
  const sourceMime=match[1];
  const buffer=Buffer.from(match[3], 'base64');
  if(!buffer.length||buffer.length>maxBytes){
    const error=new Error(`${label.charAt(0).toUpperCase()}${label.slice(1)} must be under ${Math.floor(maxBytes / (1024 * 1024))} MB.`);
    error.status=400;
    throw error;
  }
  return{
    sourceMime, buffer
  };
}
async function cleanImageBuffer(buffer, options={}){
  if(!sharp){
    const error=new Error('Image validation dependency is missing. Run npm install before deploying.');
    error.status=500;
    throw error;
  }
  const label=options.label||'image';
  const maxBytes=options.maxBytes||MAX_UPLOAD_BYTES;
  const maxPixels=options.maxPixels||50_000_000;
  const resize=options.resize||null;
  let image=sharp(buffer, {failOn:'warning', limitInputPixels:maxPixels, animated:false}).rotate();
  let metadata;
  try{
    metadata=await image.metadata();
  }
  catch{
    const error=new Error(`The uploaded ${label} is not a valid clean image file.`);
    error.status=400;
    throw error;
  }
  const format=String(metadata?.format||'').toLowerCase();
  if(!['jpeg', 'png', 'webp'].includes(format)){
    const error=new Error(`Upload a PNG, JPG, or WEBP ${label}.`);
    error.status=400;
    throw error;
  }
  if(!metadata.width||!metadata.height){
    const error=new Error(`The uploaded ${label} has invalid image dimensions.`);
    error.status=400;
    throw error;
  }
  if(metadata.width>12000||metadata.height>12000||metadata.width*metadata.height>maxPixels){
    const error=new Error(`The uploaded ${label} is too large in resolution.`);
    error.status=400;
    throw error;
  }
  const preserveOriginal=Boolean(options.preserveOriginal)&&!resize;
  const outputFormat=options.preserveOriginal||options.preserveFormat?format:'webp';
  if(resize){
    image=image.resize(resize);
  }
  let cleanBuffer;
  try{
    if(preserveOriginal){
      cleanBuffer=Buffer.from(buffer);
    }
    else{
      cleanBuffer=await encodeSharpImage(image, outputFormat, {lossless:Boolean(options.lossless), quality:options.quality||90, effort:4});
    }
  }
  catch{
    const error=new Error(`The uploaded ${label} could not be safely cleaned.`);
    error.status=400;
    throw error;
  }
  if(!cleanBuffer.length||cleanBuffer.length>maxBytes){
    const error=new Error(`Cleaned ${label} must be under ${Math.floor(maxBytes / (1024 * 1024))} MB.`);
    error.status=400;
    throw error;
  }
  return{
    mime:mimeForImageFormat(outputFormat), ext:extForImageFormat(outputFormat), buffer:cleanBuffer, width:metadata.width, height:metadata.height, sourceFormat:format,
  };
}
function serveStatic(_req, res, pathname){
  let filePath=pathname==='/'?'/index.html':pathname;
  if(filePath==='/admin')filePath='/admin.html';
  const resolved=path.normalize(path.join(PUBLIC_DIR, filePath));
  const publicRoot=path.resolve(PUBLIC_DIR);
  if(resolved!==publicRoot&&!resolved.startsWith(publicRoot + path.sep)){
    res.writeHead(403, {'Content-Type':'text/plain; charset=utf-8'});
    res.end('Forbidden');
    return;
  }
  fs.readFile(resolved, (err, data)=>{if(err){res.writeHead(404, {'Content-Type':'text/plain; charset=utf-8'}); res.end('Not found'); return; }res.writeHead(200, {'Content-Type':mimeForExt(path.extname(resolved)), 'Cache-Control':'no-store', }); res.end(data); });
}
function serveSupabaseClient(res){
  const resolved=path.join(ROOT, 'node_modules', '@supabase', 'supabase-js', 'dist', 'umd', 'supabase.js');
  fs.readFile(resolved, (err, data)=>{
    if(err){
      res.writeHead(404, {'Content-Type':'text/plain; charset=utf-8'});
      res.end('Supabase client not found. Run npm install.');
      return;
    }
    res.writeHead(200, {'Content-Type':'text/javascript; charset=utf-8', 'Cache-Control':'public, max-age=86400'});
    res.end(data);
  });
}
function rowToItem(row){
  return{
    id:row.id, title:row.title, creator:row.creator||'The Void', creatorId:row.creator_id||'', authType:row.auth_type||'', storagePath:row.storage_path, publicUrl:row.public_url, mime:row.mime, status:row.status, createdAt:row.created_at, approvedAt:row.approved_at, updatedAt:row.updated_at,
  };
}
function mediaUrlForItem(item){
  return item?.id?`/media/${encodeURIComponent(item.id)}`:'';
}
function thumbUrlForItem(item){
  return wallpaperVariantUrlForItem(item, 'thumb');
}
function previewUrlForItem(item){
  return wallpaperVariantUrlForItem(item, 'preview');
}
function downloadUrlForItem(item){
  if(!item?.id)return'';
  if(USE_SUPABASE&&item?.publicUrl){
    try{
      const responseMime=item.mime||mimeForExt(path.extname(item.storagePath||''));
      const filename=`${safeDownloadName(item.title)}.${extForMime(responseMime)||path.extname(item.storagePath||'').replace(/^./,'')||'jpg'}`;
      const url=new URL(item.publicUrl);
      url.searchParams.set('download', filename);
      return url.toString();
    }catch{}
  }
  return `/api/download/${encodeURIComponent(item.id)}`;
}
function publicWallpaperDto(item){
  return{
    id:item.id, title:item.title, creator:item.creator||'The Void', creatorId:item.creatorId||'', createdAt:item.createdAt, approvedAt:item.approvedAt, mime:item.mime||'', mediaUrl:mediaUrlForItem(item), thumbUrl:thumbUrlForItem(item), previewUrl:previewUrlForItem(item), downloadUrl:downloadUrlForItem(item),
  };
}
function profileWallpaperDto(item){
  const approved=item?.status==='approved';
  return{
    id:item.id, title:item.title, creator:item.creator||'The Void', status:item.status, createdAt:item.createdAt, approvedAt:item.approvedAt, mime:item.mime||'', mediaUrl:approved?mediaUrlForItem(item):null, thumbUrl:approved?thumbUrlForItem(item):null, previewUrl:approved?previewUrlForItem(item):null, downloadUrl:approved?downloadUrlForItem(item):'',
  };
}
function readClientUserHeaders(req){
  return{
    creatorId:String(req.headers['x-creator-id']||'').trim(), creatorName:String(req.headers['x-creator-name']||'').trim(),
  };
}
function normalizeCreatorName(value){
  return String(value||'').trim().replace(/\s+/g, ' ').slice(0, 60);
}
function normalizeUsername(value){
  return String(value||'').normalize('NFKC').trim().toLowerCase().replace(/^@+/, '').replace(/\s+/g, '_').replace(/[^a-z0-9_.-]+/g, '_').replace(/_+/g, '_').replace(/^[._-]+|[._-]+$/g, '').slice(0, 24);
}
function validateUsername(username){
  if(!username||username.length<3){
    return 'Username must be at least 3 characters.';
  }
  if(!USERNAME_PATTERN.test(username)){
    return 'Username can use letters, numbers, underscore, dot, or dash.';
  }
  return '';
}
function validatePassword(password){
  const value=String(password||'');
  if(value.length<PASSWORD_MIN_LENGTH){
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  if(!/[a-z]/.test(value))return 'Password must include a lowercase letter.';
  if(!/[A-Z]/.test(value))return 'Password must include an uppercase letter.';
  if(!/[0-9]/.test(value))return 'Password must include a number.';
  if(!/[^A-Za-z0-9]/.test(value))return 'Password must include a symbol.';
  return '';
}
function normalizeEmail(email){
  return String(email||'').normalize('NFKC').trim().toLowerCase();
}
function emailDomain(email){
  const value=normalizeEmail(email);
  const at=value.lastIndexOf('@');
  return at>=0?value.slice(at+1).replace(/^\.+|\.+$/g,''):'';
}
function isAllowedEmailDomain(email){
  const domain=emailDomain(email);
  return Boolean(domain&&(!ALLOWED_EMAIL_DOMAINS.size||ALLOWED_EMAIL_DOMAINS.has(domain)));
}
function validateEmail(email){
  const value=normalizeEmail(email);
  if(!value)return 'Email is required.';
  if(value.length>254)return 'Email is too long.';
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value))return 'Enter a valid email address.';
  if(!isAllowedEmailDomain(value))return 'EMAIL_DOMAIN_NOT_ALLOWED';
  return '';
}
function httpError(message, status=400){
  const error=new Error(message);
  error.status=status;
  return error;
}
function signupFieldsFromPayload(payload={}){
  const username=normalizeUsername(payload.username||payload.creatorName);
  const email=normalizeEmail(payload.email);
  const password=String(payload.password||'');
  const browserKey=String(payload.browserKey||'').trim().slice(0, 128);
  const legalConsent=legalConsentFromPayload(payload);
  const usernameError=validateUsername(username);
  if(usernameError)throw httpError(usernameError, 400);
  const emailError=validateEmail(email);
  if(emailError)throw httpError(emailError, 400);
  const passwordError=validatePassword(password);
  if(passwordError)throw httpError(passwordError, 400);
  return{
    username, email, password, browserKey, browserKeyHash:browserKey?hashScoped(browserKey, 'browser-key'):'', legalConsent,
  };
}
async function ensureSignupIsNew(username, email){
  if(await findUserByUsername(username))throw httpError('USERNAME_TAKEN', 409);
  if(await findUserByEmail(email))throw httpError('EMAIL_TAKEN', 409);
}
function brevoOtpConfigured(){
  if(typeof fetch!=='function')return false;
  if(!BREVO_API_KEY||!BREVO_SENDER_EMAIL)return false;
  if(/your-api-key|replace|placeholder/i.test(BREVO_API_KEY))return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(BREVO_SENDER_EMAIL);
}
function legalConsentFromPayload(payload={}){
  const accepted=payload.legalAccepted===true||payload.legalAgree===true||(payload.termsAccepted===true&&payload.privacyAccepted===true);
  if(!accepted)throw httpError('LEGAL_AGREEMENT_REQUIRED', 400);
  return{
    accepted:true,
    termsVersion:cleanSystemText(payload.termsVersion||'June 2026', 40)||'June 2026',
    privacyVersion:cleanSystemText(payload.privacyVersion||'June 2026', 40)||'June 2026',
  };
}
async function recordUserLegalConsent(req, creatorId, consent={}){
  const id=String(creatorId||'').trim();
  if(!id)return;
  const value=await readAppSettingValue(USER_LEGAL_CONSENT_SETTING_KEY);
  const users=value.users&&typeof value.users==='object'&&!Array.isArray(value.users)?value.users:{};
  users[id]={
    accepted:true,
    acceptedAt:new Date().toISOString(),
    termsVersion:cleanSystemText(consent.termsVersion||'June 2026', 40)||'June 2026',
    privacyVersion:cleanSystemText(consent.privacyVersion||'June 2026', 40)||'June 2026',
    ipHash:hashScoped(getRequestIp(req), 'legal-consent-ip'),
  };
  await writeAppSettingValue(USER_LEGAL_CONSENT_SETTING_KEY, {users, updatedAt:new Date().toISOString()});
}
function escapeHtmlText(value){
  return String(value||'').replace(/[&<>"']/g, (char)=>({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char]));
}
function emailAddressLooksValid(email){
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(email||'').trim());
}
function adminNotificationEmailConfigured(){
  return Boolean(ADMIN_EMAIL_NOTIFICATIONS_ENABLED&&brevoOtpConfigured()&&emailAddressLooksValid(ADMIN_NOTIFY_EMAIL));
}
function requestBaseUrl(req){
  const origin=requestOrigin(req)||requestRefererOrigin(req);
  if(origin&&sameOrigin(req, origin))return origin.replace(/\/+$/, '');
  const hostHeader=req?.headers?.['x-forwarded-host']||req?.headers?.host||'';
  const host=String(Array.isArray(hostHeader)?hostHeader[0]:hostHeader).split(',')[0].trim();
  if(!host)return '';
  const protoHeader=req?.headers?.['x-forwarded-proto']||(req?.socket?.encrypted?'https':'http');
  const proto=String(Array.isArray(protoHeader)?protoHeader[0]:protoHeader).split(',')[0].trim()||'http';
  return `${proto}://${host}`.replace(/\/+$/, '');
}
function adminEmailRowsToHtml(rows=[]){
  return rows.map(([label, value])=>`<p style="margin:0 0 10px"><strong>${escapeHtmlText(label)}:</strong> ${escapeHtmlText(value)}</p>`).join('');
}
function adminEmailRowsToText(rows=[]){
  return rows.map(([label, value])=>`${label}: ${String(value||'')}`).join('\n');
}
async function sendBrevoAdminNotificationEmail(subject, rows=[]){
  const safeSubject=String(subject||'THE VOID SPACE admin notification').replace(/[\r\n]+/g, ' ').trim().slice(0, 140)||'THE VOID SPACE admin notification';
  const htmlContent=`<div style="font-family:Arial,sans-serif;line-height:1.5;color:#111"><h2 style="margin:0 0 14px">${escapeHtmlText(safeSubject)}</h2>${adminEmailRowsToHtml(rows)}</div>`;
  const textContent=`${safeSubject}\n\n${adminEmailRowsToText(rows)}`;
  const response=await fetch('https://api.brevo.com/v3/smtp/email', {
    method:'POST',
    headers:{'Accept':'application/json', 'Content-Type':'application/json', 'api-key':BREVO_API_KEY},
    body:JSON.stringify({
      sender:{name:BREVO_SENDER_NAME||'THE VOID SPACE', email:BREVO_SENDER_EMAIL},
      to:[{email:ADMIN_NOTIFY_EMAIL}],
      subject:safeSubject,
      htmlContent,
      textContent,
    }),
  });
  const body=await response.text().catch(()=>'');
  if(!response.ok)throw new Error(body.slice(0, 500)||`Brevo returned ${response.status}`);
}
function queueAdminNotificationEmail(req, subject, rows=[]){
  if(!ADMIN_EMAIL_NOTIFICATIONS_ENABLED)return;
  if(!adminNotificationEmailConfigured()){
    console.warn('Admin email notification skipped: Brevo or THE_VOID_ADMIN_NOTIFY_EMAIL is not configured.');
    return;
  }
  const baseUrl=requestBaseUrl(req);
  const fullRows=baseUrl?[...rows, ['Admin page', `${baseUrl}/admin`]]:rows;
  sendBrevoAdminNotificationEmail(subject, fullRows).catch((error)=>{
    console.warn('Admin email notification failed:', error?.message||error);
  });
}
function queueNewUserAdminEmail(req, user){
  if(!user)return;
  queueAdminNotificationEmail(req, 'New THE VOID SPACE user registered', [
    ['Username', `@${user.creatorName||user.username||'unknown'}`],
    ['Email', user.email||user.googleEmail||'Not provided'],
    ['Auth type', user.authType||'unknown'],
    ['Creator ID', user.creatorId||''],
    ['Created at', user.createdAt||new Date().toISOString()],
  ]);
}
function queuePendingWallpaperAdminEmail(req, item){
  if(!item)return;
  queueAdminNotificationEmail(req, 'New wallpaper waiting for approval', [
    ['Wallpaper title', item.title||'Untitled wallpaper'],
    ['Creator', `@${item.creator||'unknown'}`],
    ['Creator ID', item.creatorId||''],
    ['Wallpaper ID', item.id||''],
    ['MIME type', item.mime||''],
    ['Submitted at', item.createdAt||new Date().toISOString()],
  ]);
}
function queueFeedbackAdminEmail(req, item){
  if(!item)return;
  queueAdminNotificationEmail(req, 'New user feedback received', [
    ['Type', item.type==='bug'?'Bug report':'Feedback'],
    ['From', `@${item.username||'unknown'}`],
    ['Email', item.email||'Not provided'],
    ['Creator ID', item.creatorId||''],
    ['Submitted at', item.createdAt||new Date().toISOString()],
    ['Message', item.message||''],
  ]);
}
function generateOtpCode(){
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}
function pendingEmailOtpKey(email){
  return normalizeEmail(email);
}
function pendingProfileEmailOtpKey(creatorId, email){
  return `profile-email:${String(creatorId||'').trim()}:${normalizeEmail(email)}`;
}
function pendingPasswordResetOtpKey(creatorId){
  return `password-reset:${String(creatorId||'').trim()}`;
}
function hashEmailOtp(email, code){
  return hashScoped(`${normalizeEmail(email)}:${String(code||'').trim()}`, 'email-otp');
}
function hashProfileEmailOtp(creatorId, email, code){
  return hashScoped(`${String(creatorId||'').trim()}:${normalizeEmail(email)}:${String(code||'').trim()}`, 'profile-email-otp');
}
function hashPasswordResetOtp(creatorId, email, code){
  return hashScoped(`${String(creatorId||'').trim()}:${normalizeEmail(email)}:${String(code||'').trim()}`, 'password-reset-otp');
}
function maskEmail(email){
  const value=normalizeEmail(email);
  const at=value.indexOf('@');
  if(at<=0)return value;
  const local=value.slice(0, at);
  const domain=value.slice(at + 1);
  if(local.length<=2)return `${local.slice(0, 1)}***@${domain}`;
  const prefix=local.slice(0, Math.min(2, local.length));
  const suffix=local.length>4?local.slice(-2):local.slice(-1);
  const hidden=Math.max(3, Math.min(8, local.length-prefix.length-suffix.length));
  return `${prefix}${'*'.repeat(hidden)}${suffix}@${domain}`;
}
function cleanupExpiredEmailOtps(now=Date.now()){
  for(const[key, entry]of pendingEmailOtps.entries()){
    if(!entry?.expiresAtMs||entry.expiresAtMs<=now)pendingEmailOtps.delete(key);
  }
}
function trimPendingEmailOtps(now=Date.now()){
  cleanupExpiredEmailOtps(now);
  if(pendingEmailOtps.size<OTP_MAX_PENDING)return;
  const ordered=[...pendingEmailOtps.entries()].sort((a, b)=>(a[1]?.createdAtMs||0)-(b[1]?.createdAtMs||0));
  for(const[key]of ordered){
    if(pendingEmailOtps.size<OTP_MAX_PENDING)break;
    pendingEmailOtps.delete(key);
  }
}
function otpSecondsUntil(timestampMs, now=Date.now()){
  return Math.max(0, Math.ceil((Number(timestampMs||0)-now)/1000));
}
function signupOtpPublicPayload(email, entry, message='Verification code sent.'){
  const now=Date.now();
  return{
    ok:true,
    otpRequired:true,
    emailMasked:maskEmail(email),
    expiresInSeconds:otpSecondsUntil(entry.expiresAtMs, now),
    resendAfterSeconds:otpSecondsUntil(entry.resendAfterMs, now),
    message,
  };
}
function cleanupOtpSendRateLimits(now=Date.now()){
  for(const[key, entry]of otpSendRateLimits.entries()){
    if(!entry?.resetAtMs||entry.resetAtMs<=now)otpSendRateLimits.delete(key);
  }
}
function normalizeOtpRateEntry(entry, now=Date.now()){
  const resetAtMs=Number(entry?.resetAtMs||0);
  if(!resetAtMs||resetAtMs<=now)return{count:0, resetAtMs:now + OTP_RATE_WINDOW_MS};
  return{count:Math.max(0, Number(entry?.count||0)), resetAtMs};
}
function otpRateLimitKeys(req, browserKey=''){
  const keys=[`ip:${hashScoped(getRequestIp(req), 'email-otp-ip')}`];
  const key=String(browserKey||'').trim().slice(0, 128);
  if(key)keys.push(`browser:${hashScoped(key, 'email-otp-browser-key')}`);
  return keys;
}
function reserveOtpSendSlot(req, browserKey=''){
  const now=Date.now();
  cleanupOtpSendRateLimits(now);
  const keys=otpRateLimitKeys(req, browserKey);
  let retryAfterSeconds=0;
  for(const key of keys){
    const entry=normalizeOtpRateEntry(otpSendRateLimits.get(key), now);
    if(entry.count>=OTP_MAX_SENDS_PER_WINDOW){
      retryAfterSeconds=Math.max(retryAfterSeconds, otpSecondsUntil(entry.resetAtMs, now));
    }
  }
  if(retryAfterSeconds>0)return{limited:true, retryAfterSeconds, keys};
  for(const key of keys){
    const entry=normalizeOtpRateEntry(otpSendRateLimits.get(key), now);
    entry.count +=1;
    otpSendRateLimits.set(key, entry);
  }
  return{limited:false, retryAfterSeconds:0, keys};
}
function releaseOtpSendSlot(keys=[]){
  const now=Date.now();
  for(const key of keys){
    const entry=normalizeOtpRateEntry(otpSendRateLimits.get(key), now);
    if(entry.count<=1)otpSendRateLimits.delete(key);
    else{
      entry.count -=1;
      otpSendRateLimits.set(key, entry);
    }
  }
}
async function sendBrevoOtpEmail(email, code, actionText='finish creating your THE VOID SPACE account'){
  if(!brevoOtpConfigured())throw httpError('EMAIL_OTP_NOT_CONFIGURED', 503);
  const minutes=Math.max(1, Math.ceil(OTP_TTL_MS/60000));
  const safeSenderName=BREVO_SENDER_NAME||'THE VOID SPACE';
  const safeCode=escapeHtmlText(code);
  const safeAction=escapeHtmlText(actionText);
  const htmlContent=`<div style="font-family:Arial,sans-serif;line-height:1.5;color:#111"><h2 style="margin:0 0 12px">THE VOID SPACE verification code</h2><p>Use this code to ${safeAction}.</p><p style="font-size:28px;font-weight:700;letter-spacing:6px;margin:18px 0">${safeCode}</p><p>This code expires in ${minutes} minute${minutes===1?'':'s'}.</p><p>If you did not request this code, you can ignore this email.</p></div>`;
  const plainTextContent=`Your THE VOID SPACE verification code is ${code}. Use it to ${actionText}. It expires in ${minutes} minute${minutes===1?'':'s'}. If you did not request this code, you can ignore this email.`;
  let response;
  try{
    response=await fetch('https://api.brevo.com/v3/smtp/email', {
      method:'POST',
      headers:{'Accept':'application/json', 'Content-Type':'application/json', 'api-key':BREVO_API_KEY},
      body:JSON.stringify({
        sender:{name:safeSenderName, email:BREVO_SENDER_EMAIL},
        to:[{email}],
        subject:'Your THE VOID SPACE verification code',
        htmlContent,
        textContent:plainTextContent,
      }),
    });
  }
  catch(error){
    const sendError=httpError('EMAIL_OTP_SEND_FAILED', 502);
    sendError.details=error?.message||String(error);
    throw sendError;
  }
  const body=await response.text().catch(()=>'');
  if(!response.ok){
    const sendError=httpError('EMAIL_OTP_SEND_FAILED', 502);
    sendError.details=body.slice(0, 500);
    throw sendError;
  }
}
function usernameSuggestionFromProfile(profile={}){
  const source=profile.name||profile.email||'creator';
  return normalizeUsername(String(source).split('@')[0]||'creator')||`creator_${crypto.randomBytes(2).toString('hex')}`;
}
function getRequestIp(req){
  const header=req.headers['cf-connecting-ip']||req.headers['x-real-ip']||req.headers['x-forwarded-for']||'';
  const first=Array.isArray(header)?header[0]:String(header).split(',')[0];
  const raw=String(first||req.socket.remoteAddress||'').trim();
  return raw.replace(/^::ffff:/, '')||'unknown';
}
function hashScoped(value, scope){
  return sha256(`${IP_HASH_SECRET}:${scope}:${String(value || '').trim()}`);
}
function passwordRecord(password){
  const salt=crypto.randomBytes(16).toString('hex');
  const hash=crypto.scryptSync(String(password), salt, 64).toString('hex');
  return{
    salt, hash
  };
}
function verifyPassword(password, salt, expectedHash){
  if(!salt||!expectedHash)return false;
  const hash=crypto.scryptSync(String(password||''), String(salt), 64).toString('hex');
  return safeCompare(hash, expectedHash);
}
function userCookieOptions(req, maxAgeSeconds=Math.floor(SESSION_TTL_MS / 1000)){
  const secureCookie=req.headers['x-forwarded-proto']==='https'||req.socket.encrypted?'; Secure':'';
  return `HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAgeSeconds}${secureCookie}`;
}
function setUserSessionCookie(req, token){
  return `${USER_SESSION_COOKIE}=${encodeURIComponent(token)}; ${userCookieOptions(req)}`;
}
function clearUserSessionCookie(){
  return `${USER_SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`;
}
function sessionHash(token){
  return sha256(`user-session:${String(token || '')}`);
}
function activeSessionExpiresAtMs(active){
  const expiresAtMs=Date.parse(active?.expiresAt||'');
  return Number.isFinite(expiresAtMs)?expiresAtMs:0;
}
function activeSessionLastSeenAtMs(active){
  const lastSeenAtMs=Date.parse(active?.updatedAt||active?.lastSeenAt||'');
  return Number.isFinite(lastSeenAtMs)?lastSeenAtMs:0;
}
function activeSessionIsFresh(active){
  return Boolean(active?.tokenHash&&activeSessionExpiresAtMs(active)>Date.now());
}
function activeSessionCanBlockNewLogin(active){
  if(!activeSessionIsFresh(active))return false;
  const lastSeenAtMs=activeSessionLastSeenAtMs(active);
  if(!lastSeenAtMs)return false;
  return Date.now()- lastSeenAtMs<=ACTIVE_SESSION_IDLE_MS;
}
function normalizeActiveSessionsValue(value){
  const source=value&&typeof value==='object'&&!Array.isArray(value)?value:{
  };
  const sessions=source.sessions&&typeof source.sessions==='object'&&!Array.isArray(source.sessions)?source.sessions:source;
  const normalized={
  };
  for(const[creatorId, active]of Object.entries(sessions||{})){
    if(!creatorId||!activeSessionIsFresh(active))continue;
    normalized[creatorId]={
      tokenHash:String(active.tokenHash||''), browserKeyHash:String(active.browserKeyHash||active.deviceKeyHash||''), expiresAt:String(active.expiresAt||''), updatedAt:String(active.updatedAt||active.lastSeenAt||active.createdAt||''),
    };
  }
  return normalized;
}
async function readActiveUserSessions(){
  if(USE_SUPABASE){
    const result=await supabase .from('app_settings').select('value').eq('key', ACTIVE_USER_SESSIONS_SETTING_KEY).maybeSingle();
    if(result.error)throw result.error;
    return normalizeActiveSessionsValue(result.data?.value||{});
  }
  const sessionsByCreator={
  };
  for(const user of readLocalUsers()){
    const active={
      tokenHash:user.activeSessionHash, browserKeyHash:user.activeSessionBrowserKeyHash, expiresAt:user.activeSessionExpiresAt, updatedAt:user.activeSessionUpdatedAt,
    };
    if(user.creatorId&&activeSessionIsFresh(active))sessionsByCreator[user.creatorId]=active;
  }
  return sessionsByCreator;
}
async function writeActiveUserSessions(sessionsByCreator){
  const cleaned=normalizeActiveSessionsValue({sessions:sessionsByCreator});
  if(USE_SUPABASE){
    const now=new Date().toISOString();
    const result=await supabase.from('app_settings').upsert({key:ACTIVE_USER_SESSIONS_SETTING_KEY, value:{sessions:cleaned}, updated_at:now, }, {onConflict:'key'});
    if(result.error)throw result.error;
    return;
  }
  await mutateLocalUsers((users)=>{for(const item of users){const active=cleaned[item.creatorId]; item.activeSessionHash=active?.tokenHash||''; item.activeSessionBrowserKeyHash=active?.browserKeyHash||''; item.activeSessionExpiresAt=active?.expiresAt||''; item.activeSessionUpdatedAt=active?.updatedAt||''; }});
}
async function getActiveUserSession(creatorId){
  if(!creatorId)return null;
  const sessionsByCreator=await readActiveUserSessions();
  const active=sessionsByCreator[creatorId];
  return activeSessionIsFresh(active)?active:null;
}
async function findActiveUserSessionByTokenHash(tokenHash){
  if(!tokenHash)return null;
  const sessionsByCreator=await readActiveUserSessions();
  for(const[creatorId, active]of Object.entries(sessionsByCreator)){
    if(activeSessionIsFresh(active)&&active?.tokenHash===tokenHash){
      return{
        creatorId, ...active
      };
    }
  }
  return null;
}
async function setActiveUserSession(creatorId, tokenHash, expiresAt, browserKeyHash=''){
  const sessionsByCreator=await readActiveUserSessions();
  sessionsByCreator[creatorId]={
    tokenHash, browserKeyHash:String(browserKeyHash||''), expiresAt, updatedAt:new Date().toISOString(),
  };
  await writeActiveUserSessions(sessionsByCreator);
}
async function clearActiveUserSession({creatorId='', tokenHash=''}={}){
  const sessionsByCreator=await readActiveUserSessions();
  let changed=false;
  for(const[id, active]of Object.entries(sessionsByCreator)){
    if((creatorId&&id===creatorId)||(tokenHash&&active?.tokenHash===tokenHash)){
      delete sessionsByCreator[id];
      changed=true;
    }
  }
  if(changed)await writeActiveUserSessions(sessionsByCreator);
}
function clearInMemoryUserSessionsForCreator(creatorId){
  const id=String(creatorId||'').trim();
  if(!id)return;
  for(const[token, session]of userSessions.entries()){
    if(session?.creatorId===id)userSessions.delete(token);
  }
}
async function rejectLoginIfAnotherDevice(req, res, user, browserKeyHash=''){
  const existingToken=parseCookies(req)[USER_SESSION_COOKIE];
  const existingHash=existingToken?sessionHash(existingToken):'';
  const active=await getActiveUserSession(user.creatorId);
  if(active&&active.tokenHash!==existingHash){
    const sameKnownBrowser=Boolean(browserKeyHash&&(browserKeyHash===active.browserKeyHash||browserKeyHash===user.browserKeyHash));
    const activeLockStillInUse=activeSessionCanBlockNewLogin(active);
    if(!sameKnownBrowser&&activeLockStillInUse){
      sendJson(res, 409, {error:ONE_DEVICE_LOGIN_MESSAGE, code:'ACTIVE_SESSION_EXISTS'});
      return true;
    }
  }
  return false;
}
function publicUserDto(user, badge=null){
  const options=arguments[2]&&typeof arguments[2]==='object'?arguments[2]:{};
  const hasPassword=Boolean(user.passwordHash&&user.passwordSalt);
  const hasGoogle=Boolean(user.authUserId);
  const hasEmail=Boolean(user.email);
  const payload={
    creatorId:user.creatorId, username:user.creatorName, creatorName:user.creatorName, authType:user.authType||'password', profilePicUrl:user.profilePicUrl||'', avatarUrl:user.profilePicUrl||'', createdAt:user.createdAt||null, lastLoginAt:user.lastLoginAt||null, badge:badge||null,
  };
  if(options.private){
    payload.email=user.email||'';
    payload.hasGoogle=hasGoogle;
    payload.googleEmail=user.googleEmail||'';
    payload.canChangePassword=hasPassword;
    payload.canDeleteWithPassword=hasPassword;
    payload.canLinkGoogle=canLinkGoogleUser(user);
    payload.canManageEmail=hasPassword;
    payload.canLinkEmail=hasPassword&&!hasEmail;
    payload.canChangeEmail=hasPassword&&hasEmail;
  }
  return payload;
}
function privateUserDto(user, badge=null){
  return publicUserDto(user, badge, {private:true});
}
function canLinkGoogleUser(user){
  return Boolean(googleAuthConfigured()&&user&&user.authType==='password'&&!user.authUserId);
}
function legacyPublicUserDto(user, badge=null){
  return{
    creatorId:user.creatorId, username:user.creatorName, creatorName:user.creatorName, authType:user.authType||'password', profilePicUrl:user.profilePicUrl||'', avatarUrl:user.profilePicUrl||'', createdAt:user.createdAt||null, lastLoginAt:user.lastLoginAt||null, badge:badge||null,
  };
}
function adminUserDto(user, counts={}, unlimitedUploads=false, badgeOverride='auto'){
  unlimitedUploads=Boolean(unlimitedUploads||user.unlimitedUploads);
  const normalizedBadgeOverride=normalizeBadgeOverride(badgeOverride);
  const approvedCount=Number(counts.approved||0);
  const activeBadge=creatorBadgeForCount(approvedCount, normalizedBadgeOverride);
  return{
    creatorId:user.creatorId, username:user.creatorName, creatorName:user.creatorName, authType:user.authType||'password', email:user.email||'', hasGoogle:Boolean(user.authUserId), googleEmail:user.googleEmail||'', profilePicUrl:user.profilePicUrl||'', createdAt:user.createdAt||null, lastLoginAt:user.lastLoginAt||null, wallpaperCount:Number(counts.total||0), approvedCount, pendingCount:Number(counts.pending||0), rejectedCount:Number(counts.rejected||0), hasSignupIpLock:Boolean(user.signupIpHash), hasBrowserLock:Boolean(user.browserKeyHash), unlimitedUploads:Boolean(unlimitedUploads), uploadLimitText:unlimitedUploads?'Unlimited uploads':`${WALLPAPER_UPLOAD_LIMIT_PER_WINDOW} uploads / 24h`, badge:activeBadge, badgeOverride:normalizedBadgeOverride, automaticBadge:creatorBadgeForCount(approvedCount, 'auto'),
  };
}
async function createUserSession(req, res, user, status=200, extraPayload={}, browserKeyHash=''){
  if(await rejectLoginIfAnotherDevice(req, res, user, browserKeyHash))return;
  const token=crypto.randomBytes(32).toString('base64url');
  const hash=sessionHash(token);
  const expiresAt=Date.now()+ SESSION_TTL_MS;
  userSessions.set(token, {creatorId:user.creatorId, username:user.creatorName, tokenHash:hash, browserKeyHash, expiresAt, });
  await setActiveUserSession(user.creatorId, hash, new Date(expiresAt).toISOString(), browserKeyHash);
  sendJson(res, status, {ok:true, user:privateUserDto(user), ...extraPayload}, {'Set-Cookie':setUserSessionCookie(req, token), });
}
async function getUserSession(req){
  const token=parseCookies(req)[USER_SESSION_COOKIE];
  if(!token)return null;
  const tokenHash=sessionHash(token);
  let session=userSessions.get(token);
  if(session&&session.expiresAt>=Date.now()){
    session.expiresAt=Date.now()+ SESSION_TTL_MS;
    session.tokenHash=session.tokenHash||tokenHash;
    session.browserKeyHash=session.browserKeyHash||'';
    session.token=token;
    return session;
  }
  if(session)userSessions.delete(token);
  const active=await findActiveUserSessionByTokenHash(tokenHash);
  if(!active)return null;
  const user=await findUserById(active.creatorId);
  if(!user)return null;
  session={
    creatorId:active.creatorId, username:user.creatorName, tokenHash, browserKeyHash:active.browserKeyHash||'', expiresAt:Date.now()+ SESSION_TTL_MS, token,
  };
  userSessions.set(token, session);
  return session;
}
function normalizeUserRow(row){
  if(!row)return null;
  return{
    creatorId:row.creator_id||row.creatorId, creatorName:row.creator_name||row.creatorName, authType:row.auth_type||row.authType||'password', email:row.email||null, passwordHash:row.password_hash||row.passwordHash||'', passwordSalt:row.password_salt||row.passwordSalt||'', authUserId:row.auth_user_id||row.authUserId||'', googleEmail:row.google_email||row.googleEmail||'', googleAvatarUrl:row.google_avatar_url||row.googleAvatarUrl||'', googleLinkedAt:row.google_linked_at||row.googleLinkedAt||null, signupIpHash:row.signup_ip_hash||row.signupIpHash||'', browserKeyHash:row.browser_key_hash||row.browserKeyHash||'', profilePicPath:row.profile_pic_path||row.profilePicPath||'', profilePicUrl:row.profile_pic_url||row.profilePicUrl||'', createdAt:row.created_at||row.createdAt||null, updatedAt:row.updated_at||row.updatedAt||null, lastLoginAt:row.last_login_at||row.lastLoginAt||null, unlimitedUploads:Boolean(row.unlimited_uploads||row.unlimitedUploads),
  };
}
function isActiveSignupLockUser(row){
  const user=normalizeUserRow(row);
  if(!user?.creatorId||!user?.creatorName)return false;
  if(user.authType==='password'&&(!user.passwordHash||!user.passwordSalt))return false;
  return true;
}
function mutateLocalUsers(mutator){
  const run=localUserMutationQueue.then(async()=>{const users=readLocalUsers(); const result=await mutator(users); writeLocalUsers(users); return result; });
  localUserMutationQueue=run.catch(()=>{});
  return run;
}
async function checkUsername(req, res){
  if(!(await ensureBackendReady(res)))return;
  try{
    const raw=await readBody(req, 32*1024);
    const payload=JSON.parse(raw||'{}');
    const username=normalizeUsername(payload.username||payload.creatorName);
    if(!username)return sendJson(res, 200, {exists:false});
    if(USE_SUPABASE){
      const result=await supabase .from('users').select('creator_id').eq('creator_name_key', username).limit(1);
      if(result.error)throw result.error;
      return sendJson(res, 200, {exists:Boolean((result.data||[]).length)});
    }
    const exists=readLocalUsers().some((user)=>normalizeUsername(user.creatorName)===username);
    return sendJson(res, 200, {exists});
  }
  catch(error){
    sendJson(res, 400, {error:friendlySupabaseError(error)||'Could not check username.'});
  }
}
async function createUser(req, res){
  return signupUser(req, res);
}
async function findUserByUsername(username){
  const normalized=normalizeUsername(username);
  if(!normalized)return null;
  if(USE_SUPABASE){
    const result=await supabase .from('users').select(USER_SELECT_COLUMNS).eq('creator_name_key', normalized).maybeSingle();
    if(result.error)throw result.error;
    return normalizeUserRow(result.data);
  }
  const found=readLocalUsers().find((user)=>normalizeUsername(user.creatorName)===normalized);
  return normalizeUserRow(found);
}
async function findUserByEmail(email){
  const normalized=normalizeEmail(email);
  if(!normalized)return null;
  if(USE_SUPABASE){
    const result=await supabase .from('users').select(USER_SELECT_COLUMNS).eq('email', normalized).maybeSingle();
    if(result.error)throw result.error;
    return normalizeUserRow(result.data);
  }
  const found=readLocalUsers().find((user)=>normalizeEmail(user.email)===normalized);
  return normalizeUserRow(found);
}
async function findUserByLogin(loginValue){
  const value=String(loginValue||'').trim();
  if(!value)return null;
  if(value.includes('@')){
    const byEmail=await findUserByEmail(value);
    if(byEmail)return byEmail;
  }
  return findUserByUsername(value);
}
async function findUserByAuthUserId(authUserId){
  const id=String(authUserId||'').trim();
  if(!id)return null;
  if(USE_SUPABASE){
    const result=await supabase .from('users').select(USER_SELECT_COLUMNS).eq('auth_user_id', id).maybeSingle();
    if(result.error)throw result.error;
    return normalizeUserRow(result.data);
  }
  const found=readLocalUsers().find((user)=>String(user.authUserId||user.auth_user_id||'')===id);
  return normalizeUserRow(found);
}
async function createEmailUserFromPreparedSignup(req, res, signup, status=201, extraPayload={}){
  const username=normalizeUsername(signup.username);
  const email=normalizeEmail(signup.email);
  const hash=String(signup.passwordHash||'');
  const salt=String(signup.passwordSalt||'');
  const browserKeyHash=String(signup.browserKeyHash||'');
  if(!username||!email||!hash||!salt)throw httpError('Signup information is incomplete.', 400);
  const now=new Date().toISOString();
  const creatorId=crypto.randomUUID();
  if(USE_SUPABASE){
    const insertPayload={
      creator_id:creatorId, creator_name:username, auth_type:'email', email, password_hash:hash, password_salt:salt, auth_user_id:null, google_email:null, google_avatar_url:null, google_linked_at:null, signup_ip_hash:null, browser_key_hash:null, profile_pic_path:null, profile_pic_url:null, last_login_at:now, created_at:now, updated_at:now,
    };
    const insert=await supabase.from('users').insert(insertPayload).select(USER_SELECT_COLUMNS).maybeSingle();
    if(insert.error){
      const msg=String(insert.error.message||'');
      if(/creator_name|username/i.test(msg))throw httpError('USERNAME_TAKEN', 409);
      if(/email/i.test(msg))throw httpError('EMAIL_TAKEN', 409);
      throw insert.error;
    }
    const createdUser=normalizeUserRow(insert.data);
    await recordUserLegalConsent(req, createdUser.creatorId, signup.legalConsent);
    queueNewUserAdminEmail(req, createdUser);
    return await createUserSession(req, res, createdUser, status, extraPayload, browserKeyHash);
  }
  const createdUser=await mutateLocalUsers((users)=>{
    if(users.some((user)=>normalizeUsername(user.creatorName)===username))throw httpError('USERNAME_TAKEN', 409);
    if(users.some((user)=>normalizeEmail(user.email)===email))throw httpError('EMAIL_TAKEN', 409);
    const user={creatorId, creatorName:username, authType:'email', email, passwordHash:hash, passwordSalt:salt, authUserId:'', googleEmail:'', googleAvatarUrl:'', googleLinkedAt:null, signupIpHash:'', browserKeyHash:'', profilePicPath:'', profilePicUrl:'', unlimitedUploads:false, createdAt:now, updatedAt:now, lastLoginAt:now, };
    users.push(user);
    return user;
  });
  await recordUserLegalConsent(req, createdUser.creatorId, signup.legalConsent);
  queueNewUserAdminEmail(req, createdUser);
  return await createUserSession(req, res, createdUser, status, extraPayload, browserKeyHash);
}
async function updateUserLastLogin(user){
  const now=new Date().toISOString();
  user.lastLoginAt=now;
  if(USE_SUPABASE){
    const update=await supabase.from('users').update({last_login_at:now}).eq('creator_id', user.creatorId);
    if(update.error)throw update.error;
  }
  else{
    await mutateLocalUsers((users)=>{const item=users.find((entry)=>entry.creatorId===user.creatorId); if(item)item.lastLoginAt=now; });
  }
}
async function updateProfileEmailForUser(user, email){
  const normalizedEmail=normalizeEmail(email);
  const now=new Date().toISOString();
  if(USE_SUPABASE){
    const result=await supabase.from('users').update({email:normalizedEmail, updated_at:now}).eq('creator_id', user.creatorId).select(USER_SELECT_COLUMNS).maybeSingle();
    if(result.error)throw result.error;
    return normalizeUserRow(result.data);
  }
  return mutateLocalUsers((users)=>{
    const item=users.find((entry)=>entry.creatorId===user.creatorId);
    if(!item)throw httpError('Profile not found.', 404);
    if(users.some((entry)=>entry.creatorId!==user.creatorId&&normalizeEmail(entry.email)===normalizedEmail))throw httpError('EMAIL_TAKEN', 409);
    item.email=normalizedEmail;
    item.updatedAt=now;
    return normalizeUserRow(item);
  });
}
async function updatePasswordForUser(user, newPassword){
  const id=String(user?.creatorId||'').trim();
  if(!id)throw httpError('Profile not found.', 404);
  const now=new Date().toISOString();
  const{
    salt, hash
  }
  =passwordRecord(newPassword);
  if(USE_SUPABASE){
    const result=await supabase.from('users').update({password_hash:hash, password_salt:salt, updated_at:now}).eq('creator_id', id);
    if(result.error)throw result.error;
    return;
  }
  await mutateLocalUsers((users)=>{const item=users.find((entry)=>entry.creatorId===id); if(!item)throw httpError('Profile not found.', 404); item.passwordHash=hash; item.passwordSalt=salt; item.updatedAt=now; });
}
async function requestSignupOtp(req, res){
  if(!(await ensureBackendReady(res)))return;
  try{
    if(!EMAIL_OTP_ENABLED)return sendJson(res, 200, {ok:true, otpRequired:false});
    const raw=await readBody(req, 32*1024);
    const payload=JSON.parse(raw||'{}');
    const signup=signupFieldsFromPayload(payload);
    await ensureSignupIsNew(signup.username, signup.email);
    if(!brevoOtpConfigured())return sendJson(res, 503, {error:'EMAIL_OTP_NOT_CONFIGURED'});
    const now=Date.now();
    cleanupExpiredEmailOtps(now);
    const key=pendingEmailOtpKey(signup.email);
    const existing=pendingEmailOtps.get(key);
    if(existing?.resendAfterMs>now){
      return sendJson(res, 429, {error:'EMAIL_OTP_RATE_LIMITED', resendAfterSeconds:otpSecondsUntil(existing.resendAfterMs, now), emailMasked:maskEmail(signup.email)});
    }
    const rateReservation=reserveOtpSendSlot(req, signup.browserKey);
    if(rateReservation.limited){
      return sendJson(res, 429, {error:'EMAIL_OTP_RATE_LIMITED', retryAfterSeconds:rateReservation.retryAfterSeconds});
    }
    trimPendingEmailOtps(now);
    const code=generateOtpCode();
    const record=passwordRecord(signup.password);
    const pending={
      username:signup.username,
      email:signup.email,
      passwordHash:record.hash,
      passwordSalt:record.salt,
      browserKeyHash:signup.browserKeyHash,
      legalConsent:signup.legalConsent,
      codeHash:hashEmailOtp(signup.email, code),
      attempts:0,
      createdAtMs:now,
      expiresAtMs:now + OTP_TTL_MS,
      resendAfterMs:now + OTP_RESEND_MS,
    };
    try{
      await sendBrevoOtpEmail(signup.email, code);
    }
    catch(error){
      releaseOtpSendSlot(rateReservation.keys);
      console.error('Signup OTP email failed:', error.details||error.message||error);
      throw error;
    }
    pendingEmailOtps.set(key, pending);
    return sendJson(res, 200, signupOtpPublicPayload(signup.email, pending));
  }
  catch(error){
    const message=friendlySupabaseError(error)||error.message||'Could not send verification code.';
    sendJson(res, error.status||400, {error:message});
  }
}
async function verifySignupOtp(req, res){
  if(!(await ensureBackendReady(res)))return;
  try{
    if(!EMAIL_OTP_ENABLED)return sendJson(res, 428, {error:'EMAIL_OTP_REQUIRED', otpRequired:true});
    const raw=await readBody(req, 16*1024);
    const payload=JSON.parse(raw||'{}');
    const email=normalizeEmail(payload.email);
    const emailError=validateEmail(email);
    if(emailError)return sendJson(res, 400, {error:emailError});
    const code=String(payload.otp||payload.code||'').replace(/\s+/g, '');
    if(!/^\d{6}$/.test(code))return sendJson(res, 400, {error:'EMAIL_OTP_INVALID'});
    const now=Date.now();
    cleanupExpiredEmailOtps(now);
    const key=pendingEmailOtpKey(email);
    const pending=pendingEmailOtps.get(key);
    if(!pending)return sendJson(res, 400, {error:'EMAIL_OTP_EXPIRED'});
    if(pending.expiresAtMs<=now){
      pendingEmailOtps.delete(key);
      return sendJson(res, 400, {error:'EMAIL_OTP_EXPIRED'});
    }
    if(pending.attempts>=OTP_MAX_ATTEMPTS){
      pendingEmailOtps.delete(key);
      return sendJson(res, 429, {error:'EMAIL_OTP_TOO_MANY_ATTEMPTS'});
    }
    const valid=safeCompare(hashEmailOtp(email, code), pending.codeHash);
    if(!valid){
      pending.attempts +=1;
      if(pending.attempts>=OTP_MAX_ATTEMPTS){
        pendingEmailOtps.delete(key);
        return sendJson(res, 429, {error:'EMAIL_OTP_TOO_MANY_ATTEMPTS'});
      }
      return sendJson(res, 401, {error:'EMAIL_OTP_INVALID', remainingAttempts:Math.max(0, OTP_MAX_ATTEMPTS - pending.attempts)});
    }
    await ensureSignupIsNew(pending.username, pending.email);
    pendingEmailOtps.delete(key);
    return await createEmailUserFromPreparedSignup(req, res, pending, 201, {message:'Email verified. Account created.'});
  }
  catch(error){
    const message=friendlySupabaseError(error)||error.message||'Could not verify code.';
    sendJson(res, error.status||400, {error:message});
  }
}
function passwordResetLoginFromPayload(payload={}){
  return String(payload.login||payload.email||payload.username||payload.creatorName||'').normalize('NFKC').trim().slice(0, 254);
}
async function requestPasswordResetOtp(req, res){
  if(!(await ensureBackendReady(res)))return;
  try{
    if(!brevoOtpConfigured())return sendJson(res, 503, {error:'EMAIL_OTP_NOT_CONFIGURED'});
    const raw=await readBody(req, 16*1024);
    const payload=JSON.parse(raw||'{}');
    const loginValue=passwordResetLoginFromPayload(payload);
    const browserKey=String(payload.browserKey||'').trim().slice(0, 128);
    if(!loginValue||loginValue.length<3)return sendJson(res, 400, {error:'Enter the email or username for your account.'});
    const user=await findUserByLogin(loginValue);
    if(!user?.email||!user?.passwordHash||!user?.passwordSalt){
      return sendJson(res, 404, {error:'No email/password account found for that email or username.'});
    }
    const now=Date.now();
    cleanupExpiredEmailOtps(now);
    const key=pendingPasswordResetOtpKey(user.creatorId);
    const existing=pendingEmailOtps.get(key);
    if(existing?.resendAfterMs>now){
      return sendJson(res, 429, {error:'EMAIL_OTP_RATE_LIMITED', resendAfterSeconds:otpSecondsUntil(existing.resendAfterMs, now), emailMasked:maskEmail(user.email)});
    }
    const rateReservation=reserveOtpSendSlot(req, browserKey);
    if(rateReservation.limited){
      return sendJson(res, 429, {error:'EMAIL_OTP_RATE_LIMITED', retryAfterSeconds:rateReservation.retryAfterSeconds});
    }
    trimPendingEmailOtps(now);
    const code=generateOtpCode();
    const pending={
      purpose:'password-reset',
      creatorId:user.creatorId,
      email:user.email,
      login:loginValue,
      browserKeyHash:browserKey?hashScoped(browserKey, 'browser-key'):'',
      codeHash:hashPasswordResetOtp(user.creatorId, user.email, code),
      attempts:0,
      createdAtMs:now,
      expiresAtMs:now + OTP_TTL_MS,
      resendAfterMs:now + OTP_RESEND_MS,
    };
    try{
      await sendBrevoOtpEmail(user.email, code, 'reset your THE VOID SPACE password');
    }
    catch(error){
      releaseOtpSendSlot(rateReservation.keys);
      console.error('Password reset OTP email failed:', error.details||error.message||error);
      throw error;
    }
    pendingEmailOtps.set(key, pending);
    return sendJson(res, 200, signupOtpPublicPayload(user.email, pending, 'Password reset code sent.'));
  }
  catch(error){
    const message=friendlySupabaseError(error)||error.message||'Could not send password reset code.';
    sendJson(res, error.status||400, {error:message});
  }
}
async function verifyPasswordResetOtp(req, res){
  if(!(await ensureBackendReady(res)))return;
  try{
    const raw=await readBody(req, 32*1024);
    const payload=JSON.parse(raw||'{}');
    const loginValue=passwordResetLoginFromPayload(payload);
    const code=String(payload.otp||payload.code||'').replace(/\s+/g, '');
    const newPassword=String(payload.newPassword||payload.password||'');
    if(!loginValue||loginValue.length<3)return sendJson(res, 400, {error:'Enter the email or username for your account.'});
    if(!/^\d{6}$/.test(code))return sendJson(res, 400, {error:'EMAIL_OTP_INVALID'});
    const passwordError=validatePassword(newPassword);
    if(passwordError)return sendJson(res, 400, {error:passwordError});
    const user=await findUserByLogin(loginValue);
    if(!user?.email||!user?.passwordHash||!user?.passwordSalt){
      return sendJson(res, 404, {error:'No email/password account found for that email or username.'});
    }
    const now=Date.now();
    cleanupExpiredEmailOtps(now);
    const key=pendingPasswordResetOtpKey(user.creatorId);
    const pending=pendingEmailOtps.get(key);
    if(!pending||pending.purpose!=='password-reset'||pending.creatorId!==user.creatorId)return sendJson(res, 400, {error:'EMAIL_OTP_EXPIRED'});
    if(pending.expiresAtMs<=now){
      pendingEmailOtps.delete(key);
      return sendJson(res, 400, {error:'EMAIL_OTP_EXPIRED'});
    }
    if(pending.attempts>=OTP_MAX_ATTEMPTS){
      pendingEmailOtps.delete(key);
      return sendJson(res, 429, {error:'EMAIL_OTP_TOO_MANY_ATTEMPTS'});
    }
    const valid=safeCompare(hashPasswordResetOtp(user.creatorId, pending.email||user.email, code), pending.codeHash);
    if(!valid){
      pending.attempts +=1;
      if(pending.attempts>=OTP_MAX_ATTEMPTS){
        pendingEmailOtps.delete(key);
        return sendJson(res, 429, {error:'EMAIL_OTP_TOO_MANY_ATTEMPTS'});
      }
      return sendJson(res, 401, {error:'EMAIL_OTP_INVALID', remainingAttempts:Math.max(0, OTP_MAX_ATTEMPTS - pending.attempts)});
    }
    await updatePasswordForUser(user, newPassword);
    pendingEmailOtps.delete(key);
    clearInMemoryUserSessionsForCreator(user.creatorId);
    await clearActiveUserSession({creatorId:user.creatorId});
    return sendJson(res, 200, {ok:true, message:'Password reset. Log in with your new password.'});
  }
  catch(error){
    const message=friendlySupabaseError(error)||error.message||'Could not reset password.';
    sendJson(res, error.status||400, {error:message});
  }
}
async function signupUser(req, res){
  if(!(await ensureBackendReady(res)))return;
  try{
    if(EMAIL_OTP_ENABLED)return sendJson(res, 428, {error:'EMAIL_OTP_REQUIRED', otpRequired:true});
    const raw=await readBody(req, 32*1024);
    const payload=JSON.parse(raw||'{}');
    const signup=signupFieldsFromPayload(payload);
    const existingUser=await findUserByUsername(signup.username);
    if(existingUser){
      if(verifyPassword(signup.password, existingUser.passwordSalt, existingUser.passwordHash)){
        await updateUserLastLogin(existingUser);
        return await createUserSession(req, res, existingUser, 200, {alreadyExisted:true, message:'Profile already exists. Logging in.'}, signup.browserKeyHash);
      }
      return sendJson(res, 409, {error:'USERNAME_TAKEN'});
    }
    const existingEmail=await findUserByEmail(signup.email);
    if(existingEmail)return sendJson(res, 409, {error:'EMAIL_TAKEN'});
    const record=passwordRecord(signup.password);
    return await createEmailUserFromPreparedSignup(req, res, {...signup, passwordHash:record.hash, passwordSalt:record.salt}, 201);
  }
  catch(error){
    const message=['USERNAME_TAKEN','EMAIL_TAKEN','EMAIL_OTP_REQUIRED'].includes(error.message)?error.message:(friendlySupabaseError(error)||error.message||'Signup failed.');
    sendJson(res, error.status||400, {error:message});
  }
}
async function loginUser(req, res){
  if(!(await ensureBackendReady(res)))return;
  try{
    const raw=await readBody(req, 32*1024);
    const payload=JSON.parse(raw||'{}');
    const loginValue=String(payload.login||payload.email||payload.username||'').trim();
    const password=String(payload.password||'');
    const browserKey=String(payload.browserKey||'').trim().slice(0, 128);
    const browserKeyHash=browserKey?hashScoped(browserKey, 'browser-key'):'';
    const loginDeviceHash=userLoginDeviceHash(req, browserKey);
    if(!loginValue||!password)return sendJson(res, 400, {error:'Email or username and password are required.'});
    const locked=await getUserLoginLock(loginDeviceHash);
    if(locked){
      const retryAfterSeconds=retryAfterSecondsUntil(locked.lockedUntilMs);
      return sendJson(res, 423, lockoutPayload(`Too many wrong login attempts from this device. Try again in ${formatMinutes(retryAfterSeconds)}.`, locked.lockedUntilMs));
    }
    const user=await findUserByLogin(loginValue);
    if(!user||!user.passwordHash||!user.passwordSalt||!verifyPassword(password, user.passwordSalt, user.passwordHash)){
      const failure=await recordUserLoginFailure(loginDeviceHash);
      if(failure.locked){
        const retryAfterSeconds=retryAfterSecondsUntil(failure.lockedUntilMs);
        return sendJson(res, 423, lockoutPayload(`Too many wrong login attempts from this device. Login is locked for ${formatMinutes(retryAfterSeconds)}.`, failure.lockedUntilMs));
      }
      return sendJson(res, 401, {error:`Invalid username or password, remaining ${failure.remainingAttempts} attempt${failure.remainingAttempts === 1 ? '' : 's'} left.`, remainingAttempts:failure.remainingAttempts, });
    }
    await clearUserLoginFailure(loginDeviceHash);
    await updateUserLastLogin(user);
    return await createUserSession(req, res, user, 200, {}, browserKeyHash);
  }
  catch(error){
    sendJson(res, error.status||400, {error:friendlySupabaseError(error)||error.message||'Login failed.'});
  }
}
async function requestProfileEmailOtp(req, res){
  const user=await requireCreator(req, res);
  if(!user)return;
  try{
    if(!EMAIL_OTP_ENABLED)return sendJson(res, 428, {error:'EMAIL_OTP_REQUIRED', otpRequired:true});
    if(!brevoOtpConfigured())return sendJson(res, 503, {error:'EMAIL_OTP_NOT_CONFIGURED'});
    const raw=await readBody(req, 32*1024);
    const payload=JSON.parse(raw||'{}');
    const email=normalizeEmail(payload.email);
    const emailError=validateEmail(email);
    if(emailError)return sendJson(res, 400, {error:emailError});
    if(normalizeEmail(user.email)===email)return sendJson(res, 400, {error:'This email is already linked to your profile.'});
    if(!user.passwordHash||!user.passwordSalt)return sendJson(res, 400, {error:'Email changes are available only for password profiles.'});
    const currentPassword=String(payload.currentPassword||payload.password||'');
    if(!currentPassword||!verifyPassword(currentPassword, user.passwordSalt, user.passwordHash)){
      return sendJson(res, 401, {error:'Current password is incorrect.'});
    }
    const existingEmailUser=await findUserByEmail(email);
    if(existingEmailUser&&existingEmailUser.creatorId!==user.creatorId)return sendJson(res, 409, {error:'EMAIL_TAKEN'});
    const browserKey=String(payload.browserKey||'').trim().slice(0, 128);
    const now=Date.now();
    cleanupExpiredEmailOtps(now);
    const key=pendingProfileEmailOtpKey(user.creatorId, email);
    const existing=pendingEmailOtps.get(key);
    if(existing?.resendAfterMs>now){
      return sendJson(res, 429, {error:'EMAIL_OTP_RATE_LIMITED', resendAfterSeconds:otpSecondsUntil(existing.resendAfterMs, now), emailMasked:maskEmail(email)});
    }
    const rateReservation=reserveOtpSendSlot(req, browserKey);
    if(rateReservation.limited){
      return sendJson(res, 429, {error:'EMAIL_OTP_RATE_LIMITED', retryAfterSeconds:rateReservation.retryAfterSeconds});
    }
    trimPendingEmailOtps(now);
    const code=generateOtpCode();
    const pending={
      purpose:'profile-email',
      creatorId:user.creatorId,
      email,
      codeHash:hashProfileEmailOtp(user.creatorId, email, code),
      attempts:0,
      createdAtMs:now,
      expiresAtMs:now + OTP_TTL_MS,
      resendAfterMs:now + OTP_RESEND_MS,
    };
    try{
      await sendBrevoOtpEmail(email, code, user.email?'verify your new THE VOID SPACE account email':'add this email to your THE VOID SPACE profile');
    }
    catch(error){
      releaseOtpSendSlot(rateReservation.keys);
      console.error('Profile email OTP failed:', error.details||error.message||error);
      throw error;
    }
    pendingEmailOtps.set(key, pending);
    return sendJson(res, 200, signupOtpPublicPayload(email, pending));
  }
  catch(error){
    const message=friendlySupabaseError(error)||error.message||'Could not send verification code.';
    sendJson(res, error.status||400, {error:message});
  }
}
async function verifyProfileEmailOtp(req, res){
  const user=await requireCreator(req, res);
  if(!user)return;
  try{
    if(!EMAIL_OTP_ENABLED)return sendJson(res, 428, {error:'EMAIL_OTP_REQUIRED', otpRequired:true});
    const raw=await readBody(req, 16*1024);
    const payload=JSON.parse(raw||'{}');
    const email=normalizeEmail(payload.email);
    const emailError=validateEmail(email);
    if(emailError)return sendJson(res, 400, {error:emailError});
    const code=String(payload.otp||payload.code||'').replace(/\s+/g, '');
    if(!/^\d{6}$/.test(code))return sendJson(res, 400, {error:'EMAIL_OTP_INVALID'});
    const now=Date.now();
    cleanupExpiredEmailOtps(now);
    const key=pendingProfileEmailOtpKey(user.creatorId, email);
    const pending=pendingEmailOtps.get(key);
    if(!pending)return sendJson(res, 400, {error:'EMAIL_OTP_EXPIRED'});
    if(pending.expiresAtMs<=now){
      pendingEmailOtps.delete(key);
      return sendJson(res, 400, {error:'EMAIL_OTP_EXPIRED'});
    }
    if(pending.attempts>=OTP_MAX_ATTEMPTS){
      pendingEmailOtps.delete(key);
      return sendJson(res, 429, {error:'EMAIL_OTP_TOO_MANY_ATTEMPTS'});
    }
    const valid=safeCompare(hashProfileEmailOtp(user.creatorId, email, code), pending.codeHash);
    if(!valid){
      pending.attempts +=1;
      if(pending.attempts>=OTP_MAX_ATTEMPTS){
        pendingEmailOtps.delete(key);
        return sendJson(res, 429, {error:'EMAIL_OTP_TOO_MANY_ATTEMPTS'});
      }
      return sendJson(res, 401, {error:'EMAIL_OTP_INVALID', remainingAttempts:Math.max(0, OTP_MAX_ATTEMPTS - pending.attempts)});
    }
    const existingEmailUser=await findUserByEmail(email);
    if(existingEmailUser&&existingEmailUser.creatorId!==user.creatorId)return sendJson(res, 409, {error:'EMAIL_TAKEN'});
    const updated=await updateProfileEmailForUser(user, email);
    pendingEmailOtps.delete(key);
    return sendJson(res, 200, {ok:true, message:user.email?'Email updated.':'Email linked to your profile.', user:privateUserDto(updated)});
  }
  catch(error){
    const message=['EMAIL_TAKEN'].includes(error.message)?error.message:(friendlySupabaseError(error)||error.message||'Could not verify code.');
    sendJson(res, error.status||400, {error:message});
  }
}
async function logoutUser(req, res){
  const token=parseCookies(req)[USER_SESSION_COOKIE];
  if(token){
    const session=userSessions.get(token);
    userSessions.delete(token);
    try{
      await clearActiveUserSession({creatorId:session?.creatorId||'', tokenHash:session?.tokenHash||sessionHash(token), });
    }
    catch(error){
      console.error('Could not clear active user session:', error.message||error);
    }
  }
  sendJson(res, 200, {ok:true}, {'Set-Cookie':clearUserSessionCookie()});
}
function googleAuthConfigured(){
  return Boolean(ENABLE_GOOGLE_AUTH&&USE_SUPABASE&&SUPABASE_URL&&SUPABASE_ANON_KEY);
}
function authConfig(_req, res){
  sendJson(res, 200, {
    ok:true,
    googleEnabled:googleAuthConfigured(),
    emailOtpEnabled:EMAIL_OTP_ENABLED,
    supabaseUrl:googleAuthConfigured()?SUPABASE_URL:'',
    supabaseAnonKey:googleAuthConfigured()?SUPABASE_ANON_KEY:'',
  });
}
async function verifyGoogleAccessToken(accessToken){
  if(!googleAuthConfigured()){
    const error=new Error('Google sign-in is not configured yet.');
    error.status=503;
    throw error;
  }
  const token=String(accessToken||'').trim();
  if(!token){
    const error=new Error('Google session is missing.');
    error.status=400;
    throw error;
  }
  const result=await supabase.auth.getUser(token);
  if(result.error||!result.data?.user){
    const error=new Error('Google session could not be verified.');
    error.status=401;
    throw error;
  }
  const authUser=result.data.user;
  const providers=[
    authUser.app_metadata?.provider,
    ...((authUser.identities||[]).map((identity)=>identity?.provider)),
  ].filter(Boolean).map((item)=>String(item).toLowerCase());
  if(!providers.includes('google')){
    const error=new Error('Use a Google account for this action.');
    error.status=400;
    throw error;
  }
  return authUser;
}
function googleProfileFromAuthUser(authUser){
  const metadata=authUser.user_metadata||{};
  const email=normalizeEmail(authUser.email||metadata.email||'');
  return{
    authUserId:String(authUser.id||'').trim(),
    email,
    name:String(metadata.full_name||metadata.name||email.split('@')[0]||'').trim(),
    avatarUrl:String(metadata.avatar_url||metadata.picture||'').trim(),
  };
}
async function updateGoogleLinkForUser(user, profile){
  const now=new Date().toISOString();
  if(USE_SUPABASE){
    const updatePayload={
      auth_user_id:profile.authUserId,
      google_email:profile.email||null,
      google_avatar_url:profile.avatarUrl||null,
      google_linked_at:now,
      updated_at:now,
    };
    if(!user.email&&profile.email)updatePayload.email=profile.email;
    if(!user.profilePicUrl&&profile.avatarUrl)updatePayload.profile_pic_url=profile.avatarUrl;
    const result=await supabase.from('users').update(updatePayload).eq('creator_id', user.creatorId).select(USER_SELECT_COLUMNS).maybeSingle();
    if(result.error)throw result.error;
    return normalizeUserRow(result.data);
  }
  return mutateLocalUsers((users)=>{
    const item=users.find((entry)=>entry.creatorId===user.creatorId);
    if(!item){
      const error=new Error('Profile not found.');
      error.status=404;
      throw error;
    }
    item.authUserId=profile.authUserId;
    item.googleEmail=profile.email||'';
    item.googleAvatarUrl=profile.avatarUrl||'';
    item.googleLinkedAt=now;
    if(!item.email&&profile.email)item.email=profile.email;
    if(!item.profilePicUrl&&profile.avatarUrl)item.profilePicUrl=profile.avatarUrl;
    item.updatedAt=now;
    return normalizeUserRow(item);
  });
}
async function createGoogleProfile(req, res, profile, username, browserKeyHash, legalConsent){
  const normalizedUsername=normalizeUsername(username);
  const usernameError=validateUsername(normalizedUsername);
  if(usernameError)return sendJson(res, 400, {error:usernameError});
  if(await findUserByUsername(normalizedUsername)){
    return sendJson(res, 409, {error:'USERNAME_TAKEN'});
  }
  const emailError=validateEmail(profile.email);
  if(emailError)return sendJson(res, 400, {error:emailError});
  if(profile.email&&await findUserByEmail(profile.email)){
    return sendJson(res, 409, {error:'This email is already used. Log in with email/password and link Google from Profile.'});
  }
  const now=new Date().toISOString();
  const creatorId=crypto.randomUUID();
  if(USE_SUPABASE){
    const insertPayload={
      creator_id:creatorId,
      creator_name:normalizedUsername,
      auth_type:'google',
      email:profile.email||null,
      password_hash:null,
      password_salt:null,
      auth_user_id:profile.authUserId,
      google_email:profile.email||null,
      google_avatar_url:profile.avatarUrl||null,
      google_linked_at:now,
      signup_ip_hash:null,
      browser_key_hash:null,
      profile_pic_path:null,
      profile_pic_url:profile.avatarUrl||null,
      last_login_at:now,
      created_at:now,
      updated_at:now,
    };
    const insert=await supabase.from('users').insert(insertPayload).select(USER_SELECT_COLUMNS).maybeSingle();
    if(insert.error)throw insert.error;
    const createdUser=normalizeUserRow(insert.data);
    await recordUserLegalConsent(req, createdUser.creatorId, legalConsent);
    queueNewUserAdminEmail(req, createdUser);
    return createUserSession(req, res, createdUser, 201, {message:'Google account connected.'}, browserKeyHash);
  }
  const createdUser=await mutateLocalUsers((users)=>{
    if(users.some((user)=>normalizeUsername(user.creatorName)===normalizedUsername)){
      const error=new Error('USERNAME_TAKEN');
      error.status=409;
      throw error;
    }
    if(profile.email&&users.some((user)=>normalizeEmail(user.email)===profile.email)){
      const error=new Error('This email is already used. Log in with email/password and link Google from Profile.');
      error.status=409;
      throw error;
    }
    const user={creatorId, creatorName:normalizedUsername, authType:'google', email:profile.email||'', passwordHash:'', passwordSalt:'', authUserId:profile.authUserId, googleEmail:profile.email||'', googleAvatarUrl:profile.avatarUrl||'', googleLinkedAt:now, signupIpHash:'', browserKeyHash:'', profilePicPath:'', profilePicUrl:profile.avatarUrl||'', unlimitedUploads:false, createdAt:now, updatedAt:now, lastLoginAt:now};
    users.push(user);
    return user;
  });
  const normalizedCreatedUser=normalizeUserRow(createdUser);
  await recordUserLegalConsent(req, normalizedCreatedUser.creatorId, legalConsent);
  queueNewUserAdminEmail(req, normalizedCreatedUser);
  return createUserSession(req, res, normalizedCreatedUser, 201, {message:'Google account connected.'}, browserKeyHash);
}
async function handleGoogleAuth(req, res){
  if(!(await ensureBackendReady(res)))return;
  try{
    const raw=await readBody(req, 64*1024);
    const payload=JSON.parse(raw||'{}');
    const browserKey=String(payload.browserKey||'').trim().slice(0, 128);
    const browserKeyHash=browserKey?hashScoped(browserKey, 'browser-key'):'';
    const authUser=await verifyGoogleAccessToken(payload.accessToken);
    const profile=googleProfileFromAuthUser(authUser);
    if(!profile.authUserId){
      return sendJson(res, 400, {error:'Google account ID is missing.'});
    }
    if(payload.link){
      const currentUser=await requireCreator(req, res);
      if(!currentUser)return;
      const fullUser=await findUserById(currentUser.creatorId);
      if(!canLinkGoogleUser(fullUser)){
        return sendJson(res, 400, {error:'Only legacy username/password profiles can link Google from Profile.'});
      }
      const linkedUser=await findUserByAuthUserId(profile.authUserId);
      if(linkedUser&&linkedUser.creatorId!==fullUser.creatorId){
        return sendJson(res, 409, {error:'Google account is already linked to another profile.'});
      }
      const emailUser=profile.email?await findUserByEmail(profile.email):null;
      if(emailUser&&emailUser.creatorId!==fullUser.creatorId){
        return sendJson(res, 409, {error:'This Google email is already used by another profile.'});
      }
      const updated=await updateGoogleLinkForUser(fullUser, profile);
      await updateUserLastLogin(updated);
      return sendJson(res, 200, {ok:true, linked:true, message:'Google account linked.', user:privateUserDto(updated)});
    }
    const existingLinkedUser=await findUserByAuthUserId(profile.authUserId);
    if(existingLinkedUser){
      const updated=await updateGoogleLinkForUser(existingLinkedUser, profile);
      await updateUserLastLogin(updated);
      return createUserSession(req, res, updated, 200, {message:'Logged in with Google.'}, browserKeyHash);
    }
    if(profile.email){
      const existingEmailUser=await findUserByEmail(profile.email);
      if(existingEmailUser){
        return sendJson(res, 409, {error:'This email is already used. Log in with email/password and link Google from Profile.'});
      }
    }
    const username=normalizeUsername(payload.username);
    if(!username){
      return sendJson(res, 200, {ok:true, needsUsername:true, googleProfile:{email:profile.email, name:profile.name, avatarUrl:profile.avatarUrl, suggestedUsername:usernameSuggestionFromProfile(profile)}});
    }
    return createGoogleProfile(req, res, profile, username, browserKeyHash, legalConsentFromPayload(payload));
  }
  catch(error){
    const message=friendlySupabaseError(error)||error.message||'Google sign-in failed.';
    sendJson(res, error.status||400, {error:message});
  }
}
async function clearUserSessionsForCreator(creatorId){
  for(const[token, session]of userSessions.entries()){
    if(session?.creatorId===creatorId)userSessions.delete(token);
  }
  try{
    await clearActiveUserSession({creatorId});
  }
  catch{
  }
}
async function removeStorageObjects(bucket, paths){
  if(!supabase||!bucket)return[];
  const uniquePaths=[...new Set((paths||[]).map((item)=>String(item||'').trim()).filter(Boolean))];
  const errors=[];
  for(let index=0; index<uniquePaths.length; index +=100){
    const batch=uniquePaths.slice(index, index + 100);
    if(!batch.length)continue;
    try{
      const result=await supabase.storage.from(bucket).remove(batch);
      if(result.error)errors.push(result.error.message||String(result.error));
    }
    catch(error){
      errors.push(error.message||String(error));
    }
  }
  return errors;
}
function supabaseWallpaperStoragePaths(item={}){
  const id=String(item.id||'').trim();
  const paths=[];
  if(item.storagePath||item.storage_path)paths.push(String(item.storagePath||item.storage_path));
  if(id){
    paths.push(wallpaperVariantStoragePath(id, 'thumb'));
    paths.push(wallpaperVariantStoragePath(id, 'preview'));
  }
  return paths;
}
async function removeSupabaseWallpaperObjects(items){
  const list=Array.isArray(items)?items:[items];
  return removeStorageObjects(SUPABASE_BUCKET, list.flatMap(supabaseWallpaperStoragePaths));
}
async function getProfile(req, res){
  const user=await requireCreator(req, res);
  if(!user)return;
  try{
    const badgeOverrides=await readBadgeOverrides();
    if(USE_SUPABASE){
      const result=await supabase .from('wallpapers').select('id,title,creator,creator_id,status,public_url,storage_path,mime,created_at,approved_at').eq('creator_id', user.creatorId).order('created_at', {ascending:false});
      if(result.error)throw result.error;
      const uploads=(result.data||[]).map(rowToItem).map(profileWallpaperDto);
      const counts=uploadCounts(uploads);
      return sendJson(res, 200, {ok:true, user:privateUserDto(user, creatorBadgeForCount(counts.approved, badgeOverrides[user.creatorId]||'auto')), uploads, counts});
    }
    const uploads=readLocalDb().wallpapers .filter((item)=>item.creatorId===user.creatorId).sort((a, b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||''))).map(profileWallpaperDto);
    const counts=uploadCounts(uploads);
    return sendJson(res, 200, {ok:true, user:privateUserDto(user, creatorBadgeForCount(counts.approved, badgeOverrides[user.creatorId]||'auto')), uploads, counts});
  }
  catch(error){
    sendJson(res, 400, {error:friendlySupabaseError(error)||error.message||'Could not load profile.'});
  }
}
async function deleteProfile(req, res){
  const user=await requireCreator(req, res);
  if(!user)return;
  try{
    const raw=await readBody(req, 32*1024);
    const payload=JSON.parse(raw||'{}');
    const password=String(payload.password||'');
    const fullUser=await findUserById(user.creatorId);
    if(!fullUser)return sendJson(res, 404, {error:'Profile not found.'});
    if(fullUser.passwordHash&&fullUser.passwordSalt){
      if(!password)return sendJson(res, 400, {error:'Enter your password to delete profile.'});
      if(!verifyPassword(password, fullUser.passwordSalt, fullUser.passwordHash)){
        return sendJson(res, 401, {error:'Password is incorrect.'});
      }
    }
    else{
      const confirmUsername=normalizeUsername(payload.confirmUsername);
      if(confirmUsername!==normalizeUsername(fullUser.creatorName)){
        return sendJson(res, 400, {error:'Type your username to confirm profile deletion.'});
      }
    }
    if(USE_SUPABASE){
      const wallpaperResult=await supabase .from('wallpapers').select('id,storage_path').eq('creator_id', user.creatorId);
      if(wallpaperResult.error)throw wallpaperResult.error;
      const wallpapers=wallpaperResult.data||[];
      const wallpaperPaths=wallpapers.flatMap(supabaseWallpaperStoragePaths);
      const deleteWallpapers=await supabase .from('wallpapers').delete().eq('creator_id', user.creatorId);
      if(deleteWallpapers.error)throw deleteWallpapers.error;
      const deleteUser=await supabase .from('users').delete().eq('creator_id', user.creatorId);
      if(deleteUser.error)throw deleteUser.error;
      const storageErrors=[];
      storageErrors.push(...await removeStorageObjects(SUPABASE_BUCKET, wallpaperPaths));
      if(fullUser.profilePicPath){
        storageErrors.push(...await removeStorageObjects(SUPABASE_PROFILE_BUCKET, [fullUser.profilePicPath]));
      }
      await clearUserSessionsForCreator(user.creatorId);
      await clearBadgeOverrideForCreator(user.creatorId);
      const payload={
        ok:true, message:'Profile deleted.', deletedWallpapers:wallpapers.length,
      };
      if(storageErrors.length){
        payload.warning='Profile deleted, but some Storage files may need manual cleanup.';
      }
      return sendJson(res, 200, payload, {'Set-Cookie':clearUserSessionCookie()});
    }
    const removedWallpapers=await mutateLocalDb((db)=>{const removed=db.wallpapers.filter((item)=>item.creatorId===user.creatorId); db.wallpapers=db.wallpapers.filter((item)=>item.creatorId!==user.creatorId); const stillReferenced=new Set(db.wallpapers.map((item)=>path.basename(String(item.filename||''))).filter(Boolean)); return{files:removed.map((item)=>path.basename(String(item.filename||''))).filter((filename)=>filename&&!stillReferenced.has(filename)), ids:removed.map((item)=>item.id).filter(Boolean)}; });
    const removedUser=await mutateLocalUsers((users)=>{const index=users.findIndex((entry)=>entry.creatorId===user.creatorId); if(index<0){const error=new Error('Profile not found.'); error.status=404; throw error; }const[removed]=users.splice(index, 1); return removed; });
    for(const filename of removedWallpapers.files){
      const filePath=path.join(LOCAL_UPLOAD_DIR, path.basename(filename));
      if(fs.existsSync(filePath)){
        try{
          fs.unlinkSync(filePath);
        }
        catch{
        }
      }
    }
    for(const wallpaperId of removedWallpapers.ids)removeLocalWallpaperVariants(wallpaperId);
    if(removedUser?.profilePicPath){
      const avatarPath=path.join(LOCAL_PROFILE_PIC_DIR, path.basename(removedUser.profilePicPath));
      if(fs.existsSync(avatarPath)){
        try{
          fs.unlinkSync(avatarPath);
        }
        catch{
        }
      }
    }
    await clearUserSessionsForCreator(user.creatorId);
    await clearBadgeOverrideForCreator(user.creatorId);
    return sendJson(res, 200, {ok:true, message:'Profile deleted.', deletedWallpapers:removedWallpapers.ids.length, }, {'Set-Cookie':clearUserSessionCookie()});
  }
  catch(error){
    sendJson(res, error.status||400, {error:friendlySupabaseError(error)||error.message||'Could not delete profile.'});
  }
}
async function parseProfilePicPayload(raw){
  const payload=JSON.parse(raw||'{}');
  const{
    buffer
  }
  =parseImageDataUrl(payload.dataUrl, PROFILE_PIC_MAX_BYTES, 'profile picture');
  return cleanImageBuffer(buffer, {label:'profile picture', maxBytes:PROFILE_PIC_MAX_BYTES, maxPixels:20_000_000, resize:{width:1600, height:1600, fit:'inside', withoutEnlargement:true}, quality:88, });
}
async function updateProfilePicture(req, res){
  const user=await requireCreator(req, res);
  if(!user)return;
  let storagePath='';
  let savedFilePath='';
  try{
    const raw=await readBody(req, PROFILE_PIC_BODY_BYTES);
    const{
      mime, ext, buffer
    }
    =await parseProfilePicPayload(raw);
    const currentUser=await findUserById(user.creatorId);
    const id=crypto.randomUUID();
    if(USE_SUPABASE){
      storagePath=`${user.creatorId}/${id}.${ext}`;
      const upload=await supabase.storage.from(SUPABASE_PROFILE_BUCKET).upload(storagePath, buffer, {contentType:mime, cacheControl:'31536000', upsert:false, });
      if(upload.error)throw upload.error;
      const publicUrlResult=supabase.storage.from(SUPABASE_PROFILE_BUCKET).getPublicUrl(storagePath);
      const publicUrl=publicUrlResult?.data?.publicUrl;
      if(!publicUrl)throw new Error('Could not create public URL for profile picture.');
      const update=await supabase .from('users').update({profile_pic_path:storagePath, profile_pic_url:publicUrl}).eq('creator_id', user.creatorId).select(USER_SELECT_COLUMNS).maybeSingle();
      if(update.error)throw update.error;
      if(currentUser?.profilePicPath&&currentUser.profilePicPath!==storagePath){
        try{
          await supabase.storage.from(SUPABASE_PROFILE_BUCKET).remove([currentUser.profilePicPath]);
        }
        catch{
        }
      }
      return sendJson(res, 200, {ok:true, message:'Profile picture updated.', user:privateUserDto(normalizeUserRow(update.data))});
    }
    const filename=`${user.creatorId}-${id}.${ext}`;
    savedFilePath=path.join(LOCAL_PROFILE_PIC_DIR, filename);
    writeFileAtomic(savedFilePath, buffer);
    const profilePicUrl=`/profile-pics/${filename}`;
    const profilePicPath=filename;
    const updatedUser=await mutateLocalUsers((users)=>{const item=users.find((entry)=>entry.creatorId===user.creatorId); if(!item){const error=new Error('Login required.'); error.status=401; throw error; }const oldPath=item.profilePicPath||''; item.profilePicPath=profilePicPath; item.profilePicUrl=profilePicUrl; item.updatedAt=new Date().toISOString(); if(oldPath&&oldPath!==profilePicPath){const oldFile=path.join(LOCAL_PROFILE_PIC_DIR, path.basename(oldPath)); if(fs.existsSync(oldFile)){try{fs.unlinkSync(oldFile); }catch{}}}return item; });
    return sendJson(res, 200, {ok:true, message:'Profile picture updated.', user:privateUserDto(normalizeUserRow(updatedUser))});
  }
  catch(error){
    if(storagePath){
      try{
        await supabase.storage.from(SUPABASE_PROFILE_BUCKET).remove([storagePath]);
      }
      catch{
      }
    }
    if(savedFilePath&&fs.existsSync(savedFilePath)){
      try{
        fs.unlinkSync(savedFilePath);
      }
      catch{
      }
    }
    sendJson(res, error.status||400, {error:friendlySupabaseError(error)||error.message||'Could not update profile picture.'});
  }
}
async function searchUsers(req, res){
  if(!(await ensureBackendReady(res)))return;
  try{
    const url=new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const query=normalizeUsername(url.searchParams.get('q')||'');
    if(!query)return sendJson(res, 200, {users:[]});
    if(USE_SUPABASE){
      const result=await supabase .from('users').select('creator_id,creator_name,profile_pic_url,created_at').ilike('creator_name_key', `${query}%`).order('creator_name', {ascending:true}).limit(8);
      if(result.error)throw result.error;
      return sendJson(res, 200, {users:(result.data||[]).map((row)=>publicUserDto(normalizeUserRow(row)))});
    }
    const users=readLocalUsers().map(normalizeUserRow).filter((user)=>normalizeUsername(user.creatorName).startsWith(query)).sort((a, b)=>String(a.creatorName).localeCompare(String(b.creatorName))).slice(0, 8).map(publicUserDto);
    return sendJson(res, 200, {users});
  }
  catch(error){
    sendJson(res, 400, {error:friendlySupabaseError(error)||error.message||'Could not search users.'});
  }
}
async function getPublicUserProfile(req, res, username){
  if(!(await ensureBackendReady(res)))return;
  try{
    const preview=await buildPublicProfilePreview(username);
    if(!preview)return sendJson(res, 404, {error:'User not found.'});
    return sendJson(res, 200, publicProfilePayload(preview));
  }
  catch(error){
    sendJson(res, 400, {error:friendlySupabaseError(error)||error.message||'Could not load user profile.'});
  }
}
async function buildPublicProfilePreview(username){
  const normalized=normalizeUsername(username);
  if(!normalized)return null;
  const user=await findUserByUsername(normalized);
  if(!user)return null;
  const badgeOverrides=await readBadgeOverrides();
  let allUploads=[];
  if(USE_SUPABASE){
    const result=await supabase .from('wallpapers').select('id,title,creator,creator_id,status,public_url,storage_path,mime,created_at,approved_at').eq('creator_id', user.creatorId).order('created_at', {ascending:false});
    if(result.error)throw result.error;
    allUploads=(result.data||[]).map(rowToItem).map(profileWallpaperDto);
  }
  else{
    allUploads=readLocalDb().wallpapers .filter((item)=>item.creatorId===user.creatorId).sort((a, b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||''))).map(profileWallpaperDto);
  }
  const publicUploads=allUploads .filter((item)=>item.status==='approved').sort((a, b)=>String(b.approvedAt||b.createdAt||'').localeCompare(String(a.approvedAt||a.createdAt||'')));
  const counts=uploadCounts(allUploads);
  const badge=creatorBadgeForCount(counts.approved, badgeOverrides[user.creatorId]||'auto');
  return{user, publicUploads, counts, badge};
}
function publicProfilePayload(preview){
  return{
    ok:true, user:publicUserDto(preview.user, preview.badge), uploads:preview.publicUploads, counts:preview.counts, publicProfile:true,
  };
}
function absoluteProfileAssetUrl(req, url){
  const value=String(url||'').trim();
  if(!value)return '';
  if(/^https?:\/\//i.test(value))return value;
  const baseUrl=requestBaseUrl(req);
  return baseUrl?`${baseUrl}${value.startsWith('/')?'':'/'}${value}`:value;
}
function profileMetaForPreview(req, username, preview){
  const baseUrl=requestBaseUrl(req);
  const normalized=normalizeUsername(username||preview?.user?.creatorName);
  const profileUrl=baseUrl&&normalized?`${baseUrl}/@${encodeURIComponent(normalized)}`:'';
  const safeUsername=preview?.user?.creatorName||normalized||'creator';
  const badgeLabel=preview?.badge?.label||'Creator';
  const uploadCount=Number(preview?.counts?.total||0);
  const uploadText=`${uploadCount} upload${uploadCount===1?'':'s'}`;
  const imageVersion=[preview?.user?.updatedAt||'', preview?.counts?.total||0, preview?.counts?.approved||0, preview?.badge?.id||'creator'].join('-')||'1';
  const imageUrl=baseUrl&&normalized?`${baseUrl}/og/profile/${encodeURIComponent(normalized)}.png?v=${encodeURIComponent(imageVersion)}`:'';
  return{
    title:`@${safeUsername} on THE VOID SPACE`,
    description:`${badgeLabel} on THE VOID SPACE with ${uploadText}.`,
    url:profileUrl,
    imageUrl,
    avatarUrl:absoluteProfileAssetUrl(req, preview?.user?.profilePicUrl||preview?.user?.avatarUrl||''),
    username:safeUsername,
    badgeLabel,
    uploadText,
    uploadCount,
  };
}
function socialMetaTags(meta){
  const tags=[
    ['meta', {property:'og:type', content:'profile'}],
    ['meta', {property:'og:site_name', content:'THE VOID SPACE'}],
    ['meta', {property:'og:title', content:meta.title}],
    ['meta', {property:'og:description', content:meta.description}],
    ['meta', {property:'og:url', content:meta.url}],
    ['meta', {property:'og:image', content:meta.imageUrl}],
    ['meta', {property:'og:image:secure_url', content:meta.imageUrl}],
    ['meta', {property:'og:image:type', content:DEFAULT_SOCIAL_IMAGE_MIME}],
    ['meta', {property:'og:image:width', content:'1200'}],
    ['meta', {property:'og:image:height', content:'630'}],
    ['meta', {property:'og:image:alt', content:`THE VOID SPACE profile banner for @${meta.username}`}],
    ['meta', {property:'profile:username', content:meta.username}],
    ['meta', {name:'twitter:card', content:'summary_large_image'}],
    ['meta', {name:'twitter:title', content:meta.title}],
    ['meta', {name:'twitter:description', content:meta.description}],
    ['meta', {name:'twitter:image', content:meta.imageUrl}],
  ];
  const rendered=tags.filter(([, attrs])=>Object.values(attrs).every(Boolean)).map(([tag, attrs])=>{
    const renderedAttrs=Object.entries(attrs).map(([key, value])=>`${key}="${escapeHtmlText(value)}"`).join(' ');
    return `  <${tag} ${renderedAttrs}>`;
  });
  return rendered.join('\n');
}
async function servePublicProfilePage(req, res, username){
  if(!(await ensureBackendReady(res)))return;
  try{
    const preview=await buildPublicProfilePreview(username);
    if(!preview)return serveStatic(req, res, '/');
    const indexPath=path.join(PUBLIC_DIR, 'index.html');
    fs.readFile(indexPath, 'utf8', (err, html)=>{
      if(err){
        res.writeHead(404, {'Content-Type':'text/plain; charset=utf-8'});
        res.end('Not found');
        return;
      }
      const meta=profileMetaForPreview(req, username, preview);
      const socialMeta=socialMetaTags(meta);
      let output=html.replace(/<title>.*?<\/title>/i, `<title>${escapeHtmlText(meta.title)}</title>`);
      output=output.replace('</head>', `${socialMeta}\n</head>`);
      res.writeHead(200, {'Content-Type':'text/html; charset=utf-8', 'Cache-Control':'no-store'});
      res.end(output);
    });
  }
  catch(error){
    console.warn('Profile page metadata failed:', friendlySupabaseError(error)||error.message||error);
    serveStatic(req, res, '/');
  }
}
function socialSvgEscape(value){
  return escapeHtmlText(String(value||'')).replace(/\r?\n/g, ' ');
}
async function avatarDataUrlForProfile(req, preview){
  const url=absoluteProfileAssetUrl(req, preview?.user?.profilePicUrl||preview?.user?.avatarUrl||'');
  if(!url||typeof fetch!=='function')return '';
  try{
    const controller=typeof AbortController==='function'?new AbortController():null;
    const timeout=controller?setTimeout(()=>controller.abort(), 2500):null;
    const response=await fetch(url, {signal:controller?.signal});
    if(timeout)clearTimeout(timeout);
    if(!response.ok)return '';
    const contentType=String(response.headers.get('content-type')||'').split(';')[0].trim().toLowerCase();
    if(!/^image\/(png|jpe?g|webp|gif)$/.test(contentType))return '';
    const arrayBuffer=await response.arrayBuffer();
    const buffer=Buffer.from(arrayBuffer);
    if(!buffer.length||buffer.length>2*1024*1024)return '';
    return `data:${contentType};base64,${buffer.toString('base64')}`;
  }
  catch{
    return '';
  }
}
function profileSocialBannerSvg(meta, avatarDataUrl=''){
  const username=socialSvgEscape(`@${meta.username}`);
  const badge=socialSvgEscape(meta.badgeLabel);
  const uploadText=socialSvgEscape(meta.uploadText);
  const initial=socialSvgEscape(String(meta.username||'T').slice(0, 1).toUpperCase()||'T');
  const avatarMarkup=avatarDataUrl
    ?`<clipPath id="avatarClip"><circle cx="214" cy="286" r="92"/></clipPath><image href="${avatarDataUrl}" x="122" y="194" width="184" height="184" preserveAspectRatio="xMidYMid slice" clip-path="url(#avatarClip)"/><circle cx="214" cy="286" r="92" fill="none" stroke="rgba(255,255,255,.72)" stroke-width="5"/>`
    :`<circle cx="214" cy="286" r="92" fill="rgba(255,255,255,.10)" stroke="rgba(255,255,255,.72)" stroke-width="5"/><text x="214" y="318" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="84" font-weight="800" fill="#fff">${initial}</text>`;
  return`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="#111"/>
      <stop offset=".48" stop-color="#020202"/>
      <stop offset="1" stop-color="#191919"/>
    </linearGradient>
    <radialGradient id="glow" cx="76%" cy="18%" r="62%">
      <stop offset="0" stop-color="#fff" stop-opacity=".16"/>
      <stop offset=".4" stop-color="#fff" stop-opacity=".08"/>
      <stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="630" fill="url(#glow)"/>
  <path d="M780 0 H1200 V630 H702 C826 520 892 398 918 274 C944 150 980 58 1076 0 Z" fill="rgba(255,255,255,.035)"/>
  <path d="M838 0 H1200 V630 H772 C888 510 954 380 970 250 C986 122 1038 44 1132 0 Z" fill="rgba(0,0,0,.22)"/>
  <path d="M824 72 C900 42 1024 38 1128 82" fill="none" stroke="rgba(255,255,255,.055)" stroke-width="2"/>
  <path d="M836 136 C940 104 1048 112 1158 166" fill="none" stroke="rgba(255,255,255,.04)" stroke-width="1.5"/>
  <path d="M0 506 C216 444 350 554 558 498 C765 442 898 368 1200 424 L1200 630 L0 630 Z" fill="rgba(255,255,255,.045)"/>
  <text x="112" y="116" font-family="Inter, Arial, sans-serif" font-size="34" font-weight="800" fill="rgba(255,255,255,.78)" letter-spacing="3">THE VOID SPACE</text>
  ${avatarMarkup}
  <text x="352" y="258" font-family="Inter, Arial, sans-serif" font-size="74" font-weight="900" fill="#fff">${username}</text>
  <rect x="356" y="306" width="${Math.max(300, Math.min(650, badge.length*20 + 160))}" height="58" rx="29" fill="rgba(255,255,255,.12)" stroke="rgba(255,255,255,.26)"/>
  <text x="390" y="344" font-family="Inter, Arial, sans-serif" font-size="25" font-weight="800" fill="rgba(255,255,255,.90)" letter-spacing="1">${badge}</text>
  <text x="356" y="430" font-family="Inter, Arial, sans-serif" font-size="34" font-weight="760" fill="rgba(255,255,255,.84)">${uploadText}</text>
  <text x="356" y="478" font-family="Inter, Arial, sans-serif" font-size="24" font-weight="650" fill="rgba(255,255,255,.58)">Creator profile on THE VOID SPACE</text>
</svg>`;
}
async function serveProfileOgImage(req, res, username){
  if(!(await ensureBackendReady(res)))return;
  try{
    const preview=await buildPublicProfilePreview(username);
    if(!preview){
      res.writeHead(404, {'Content-Type':'text/plain; charset=utf-8'});
      res.end('Not found');
      return;
    }
    const meta=profileMetaForPreview(req, username, preview);
    const svg=profileSocialBannerSvg(meta, await avatarDataUrlForProfile(req, preview));
    if(sharp){
      const png=await sharp(Buffer.from(svg)).png({quality:92}).toBuffer();
      res.writeHead(200, {'Content-Type':'image/png', 'Content-Length':png.length, 'Cache-Control':'public, max-age=300'});
      res.end(png);
      return;
    }
    const buffer=Buffer.from(svg);
    res.writeHead(200, {'Content-Type':'image/svg+xml; charset=utf-8', 'Content-Length':buffer.length, 'Cache-Control':'public, max-age=300'});
    res.end(buffer);
  }
  catch(error){
    console.warn('Profile OG image failed:', friendlySupabaseError(error)||error.message||error);
    res.writeHead(500, {'Content-Type':'text/plain; charset=utf-8'});
    res.end('Could not generate profile image.');
  }
}
function serveLocalProfilePic(req, res, filename){
  const safeName=path.basename(String(filename||''));
  if(!safeName){
    res.writeHead(404, {'Content-Type':'text/plain; charset=utf-8'});
    res.end('Not found');
    return;
  }
  const filePath=path.join(LOCAL_PROFILE_PIC_DIR, safeName);
  if(!fs.existsSync(filePath)){
    res.writeHead(404, {'Content-Type':'text/plain; charset=utf-8'});
    res.end('Not found');
    return;
  }
  res.writeHead(200, {'Content-Type':mimeForExt(path.extname(filePath)), 'Cache-Control':'public, max-age=86400', });
  fs.createReadStream(filePath).pipe(res);
}
function uploadCounts(uploads){
  return uploads.reduce((counts, item)=>{counts.total +=1; counts[item.status]=(counts[item.status]||0)+ 1; return counts; }, {total:0, pending:0, approved:0, rejected:0});
}
async function changePassword(req, res){
  const user=await requireCreator(req, res);
  if(!user)return;
  try{
    const raw=await readBody(req, 32*1024);
    const payload=JSON.parse(raw||'{}');
    const currentPassword=String(payload.currentPassword||'');
    const newPassword=String(payload.newPassword||'');
    const passwordError=validatePassword(newPassword);
    if(passwordError)return sendJson(res, 400, {error:passwordError});
    const fullUser=await findUserById(user.creatorId);
    if(!fullUser?.passwordHash||!fullUser?.passwordSalt){
      return sendJson(res, 400, {error:'Password changes are available only for email/password profiles.'});
    }
    if(!fullUser||!verifyPassword(currentPassword, fullUser.passwordSalt, fullUser.passwordHash)){
      return sendJson(res, 401, {error:'Current password is incorrect.'});
    }
    const{
      salt, hash
    }
    =passwordRecord(newPassword);
    if(USE_SUPABASE){
      const result=await supabase.from('users').update({password_hash:hash, password_salt:salt}).eq('creator_id', user.creatorId);
      if(result.error)throw result.error;
    }
    else{
      await mutateLocalUsers((users)=>{const item=users.find((entry)=>entry.creatorId===user.creatorId); if(item){item.passwordHash=hash; item.passwordSalt=salt; item.updatedAt=new Date().toISOString(); }});
    }
    return sendJson(res, 200, {ok:true, message:'Password updated.'});
  }
  catch(error){
    sendJson(res, error.status||400, {error:friendlySupabaseError(error)||error.message||'Could not update password.'});
  }
}
async function findUserById(creatorId){
  if(!creatorId)return null;
  if(USE_SUPABASE){
    const result=await supabase .from('users').select(USER_SELECT_COLUMNS).eq('creator_id', creatorId).maybeSingle();
    if(result.error)throw result.error;
    return normalizeUserRow(result.data);
  }
  return normalizeUserRow(readLocalUsers().find((user)=>user.creatorId===creatorId)||null);
}
async function countRecentWallpaperUploads(creatorId){
  const cutoffIso=new Date(Date.now()- WALLPAPER_UPLOAD_WINDOW_MS).toISOString();
  if(USE_SUPABASE){
    const result=await supabase .from('wallpapers').select('id', {count:'exact', head:true}).eq('creator_id', creatorId).gte('created_at', cutoffIso);
    if(result.error)throw result.error;
    return Number(result.count||0);
  }
  return readLocalDb().wallpapers.filter((item)=>{if(item.creatorId!==creatorId)return false; const createdAt=Date.parse(item.createdAt||item.created_at||''); return Number.isFinite(createdAt)&&createdAt>=Date.now()- WALLPAPER_UPLOAD_WINDOW_MS; }).length;
}
async function getCreatorApprovedWallpaperCount(creatorId){
  const id=String(creatorId||'').trim();
  if(!id)return 0;
  if(USE_SUPABASE){
    const result=await supabase .from('wallpapers').select('id', {count:'exact', head:true}).eq('creator_id', id).eq('status', 'approved');
    if(result.error)throw result.error;
    return Number(result.count||0);
  }
  return readLocalDb().wallpapers.filter((item)=>item.creatorId===id&&item.status==='approved').length;
}
async function enforceWallpaperUploadLimit(res, creatorId){
  if(await userHasUnlimitedUploads(creatorId))return true;
  const count=await countRecentWallpaperUploads(creatorId);
  if(count<WALLPAPER_UPLOAD_LIMIT_PER_WINDOW)return true;
  sendJson(res, 429, {error:`Upload limit reached. Each profile can upload only ${WALLPAPER_UPLOAD_LIMIT_PER_WINDOW} images in 24 hours. Try again later.`, code:'UPLOAD_LIMIT_REACHED', });
  return false;
}
async function requireCreator(req, res){
  if(bootstrapPromise)await bootstrapPromise;
  if(setupError){
    sendJson(res, 500, {error:setupError, setupRequired:true});
    return null;
  }
  const session=await getUserSession(req);
  if(!session?.creatorId){
    sendJson(res, 401, {error:'Login required.'});
    return null;
  }
  const active=await getActiveUserSession(session.creatorId);
  if(active&&active.tokenHash!==session.tokenHash){
    if(session.token)userSessions.delete(session.token);
    sendJson(res, 401, {error:ONE_DEVICE_LOGIN_MESSAGE, code:'ACTIVE_SESSION_REPLACED'}, {'Set-Cookie':clearUserSessionCookie(), });
    return null;
  }
  try{
    await setActiveUserSession(session.creatorId, session.tokenHash, new Date(session.expiresAt).toISOString(), session.browserKeyHash||'');
  }
  catch(error){
    console.error('Could not refresh active user session:', error.message||error);
  }
  const user=await findUserById(session.creatorId);
  if(!user){
    sendJson(res, 401, {error:'Login required.'});
    return null;
  }
  return user;
}
async function handleUpload(req, res){
  const user=await requireCreator(req, res);
  if(!user)return;
  try{
    if(!(await enforceWallpaperUploadLimit(res, user.creatorId)))return;
  }
  catch(error){
    return sendJson(res, 400, {error:friendlySupabaseError(error)||error.message||'Could not verify upload limit.'});
  }
  if(USE_SUPABASE)return handleSupabaseUpload(req, res, user);
  return handleLocalUpload(req, res, user);
}
async function parseImagePayload(raw){
  const payload=JSON.parse(raw||'{}');
  const title=String(payload.title||'Untitled wallpaper').trim().slice(0, 80)||'Untitled wallpaper';
  const creator=normalizeCreatorName(payload.creator)||'The Void';
  const creatorId=String(payload.creatorId||'').trim();
  const authType=['password', 'email', 'guest', 'google'].includes(String(payload.authType||'').trim())?String(payload.authType).trim():'password';
  const{
    buffer
  }
  =parseImageDataUrl(payload.dataUrl, MAX_UPLOAD_BYTES, 'image');
  const clean=await cleanImageBuffer(buffer, {label:'image', maxBytes:MAX_UPLOAD_BYTES, maxPixels:50_000_000, preserveOriginal:true, });
  return{
    title, creator, creatorId, authType, ...clean
  };
}
function wallpaperEnhanceResize(width, height, settings){
  const sourceWidth=Number(width||0);
  const sourceHeight=Number(height||0);
  if(!sourceWidth||!sourceHeight)return null;
  const longest=Math.max(sourceWidth, sourceHeight);
  const targetLongest=sourceHeight>=sourceWidth?settings.portraitLongEdge:settings.landscapeLongEdge;
  let scale=targetLongest / longest;
  if(scale>1)scale=Math.min(scale, settings.maxScale||2);
  if(Math.abs(scale-1)<=0.02)return null;
  return{
    width:Math.max(1, Math.round(sourceWidth*scale)),
    height:Math.max(1, Math.round(sourceHeight*scale)),
    fit:'fill',
    kernel:'lanczos3',
    withoutEnlargement:false,
  };
}
function clampByte(value){
  if(value<=0)return 0;
  if(value>=255)return 255;
  return Math.round(value);
}
function boxBlurLuminance(source, width, height, radius){
  const safeRadius=Math.max(1, Math.floor(Number(radius)||1));
  const windowSize=safeRadius*2+1;
  const temp=new Uint8Array(source.length);
  const output=new Uint8Array(source.length);
  for(let y=0; y<height; y++){
    const row=y*width;
    let sum=0;
    for(let offset=-safeRadius; offset<=safeRadius; offset++){
      const x=Math.max(0, Math.min(width-1, offset));
      sum +=source[row+x];
    }
    for(let x=0; x<width; x++){
      temp[row+x]=Math.round(sum/windowSize);
      const removeX=Math.max(0, x-safeRadius);
      const addX=Math.min(width-1, x+safeRadius+1);
      sum +=source[row+addX]-source[row+removeX];
    }
  }
  for(let x=0; x<width; x++){
    let sum=0;
    for(let offset=-safeRadius; offset<=safeRadius; offset++){
      const y=Math.max(0, Math.min(height-1, offset));
      sum +=temp[(y*width)+x];
    }
    for(let y=0; y<height; y++){
      output[(y*width)+x]=Math.round(sum/windowSize);
      const removeY=Math.max(0, y-safeRadius);
      const addY=Math.min(height-1, y+safeRadius+1);
      sum +=temp[(addY*width)+x]-temp[(removeY*width)+x];
    }
  }
  return output;
}
function luminanceStats(values){
  let sum=0;
  let squareSum=0;
  const total=values.length||1;
  for(const value of values){
    sum +=value;
    squareSum +=value*value;
  }
  const mean=sum/total;
  const variance=Math.max(0, (squareSum/total)-(mean*mean));
  return{mean, std:Math.sqrt(variance)};
}
function applyNaturalRestorePixels(data, info, settings){
  const width=Number(info?.width||0);
  const height=Number(info?.height||0);
  const channels=Number(info?.channels||4);
  const pixels=width*height;
  if(!width||!height||channels<3||!pixels)return;
  const luma=new Uint8Array(pixels);
  for(let pixel=0, offset=0; pixel<pixels; pixel++, offset +=channels){
    const y=(data[offset]*54+data[offset+1]*183+data[offset+2]*19)>>8;
    luma[pixel]=y;
  }
  const originalStats=luminanceStats(luma);
  const fine=boxBlurLuminance(luma, width, height, 1);
  const medium=boxBlurLuminance(luma, width, height, Math.max(2, Math.min(5, Math.round(Math.min(width, height)/520))));
  let flatNoiseSum=0;
  let flatNoiseCount=0;
  for(let pixel=0; pixel<pixels; pixel++){
    const fineDiff=Math.abs(luma[pixel]-fine[pixel]);
    const mediumDiff=Math.abs(luma[pixel]-medium[pixel]);
    if(mediumDiff<8){
      flatNoiseSum +=fineDiff;
      flatNoiseCount +=1;
    }
  }
  const estimatedNoise=flatNoiseCount?flatNoiseSum/flatNoiseCount:0;
  const restore=settings.restore||{};
  const denoise=Math.max(.05, Math.min(.34, Number(restore.denoise||.2)+(estimatedNoise-6)/85));
  const deblur=Math.max(.08, Math.min(.44, Number(restore.deblur||.24)));
  const detail=Math.max(.06, Math.min(.32, Number(restore.detail||.16)));
  const maxDelta=Math.max(5, Math.min(14, Number(restore.maxDelta||9)));
  const restoredLuma=new Float32Array(pixels);
  for(let pixel=0; pixel<pixels; pixel++){
    const y=luma[pixel];
    const fineY=fine[pixel];
    const mediumY=medium[pixel];
    const fineDelta=y-fineY;
    const mediumDelta=y-mediumY;
    const mediumEdge=Math.min(1, Math.abs(mediumDelta)/22);
    const microEdge=Math.min(1, Math.abs(fineDelta)/14);
    const structureMask=Math.max(mediumEdge, microEdge*.55);
    const flatMask=Math.max(0, 1-structureMask);
    const highlightGuard=y>224?Math.max(0, (255-y)/31):1;
    const shadowGuard=y<31?Math.max(0, y/31):1;
    const toneGuard=highlightGuard*shadowGuard;
    const noiseBlend=denoise*flatMask*(.62+Math.min(1, estimatedNoise/18)*.38)*toneGuard;
    const lumaDenoiseDelta=(fineY-y)*noiseBlend;
    const detailDelta=mediumDelta*detail*(.24+structureMask*.42)*structureMask*toneGuard;
    const deblurDelta=fineDelta*deblur*(.34+microEdge*.66)*structureMask*toneGuard;
    restoredLuma[pixel]=y+Math.max(-maxDelta, Math.min(maxDelta, lumaDenoiseDelta+detailDelta+deblurDelta));
  }
  const restoredStats=luminanceStats(restoredLuma);
  const contrastRatio=restoredStats.std>0.01?originalStats.std/restoredStats.std:1;
  const safeRatio=Math.max(.58, Math.min(1, contrastRatio));
  for(let pixel=0, offset=0; pixel<pixels; pixel++, offset +=channels){
    const r=data[offset];
    const g=data[offset+1];
    const b=data[offset+2];
    const preservedY=originalStats.mean+(restoredLuma[pixel]-restoredStats.mean)*safeRatio;
    const toneDistance=Math.min(luma[pixel], 255-luma[pixel]);
    const toneLimit=Math.min(maxDelta, Math.max(0, toneDistance*.42));
    const delta=Math.max(-toneLimit, Math.min(toneLimit, preservedY-luma[pixel]));
    data[offset]=clampByte(r+delta);
    data[offset+1]=clampByte(g+delta);
    data[offset+2]=clampByte(b+delta);
  }
}
function applyReferenceToneLockedPixels(enhancedData, enhancedInfo, referenceData, referenceInfo, settings){
  const width=Number(enhancedInfo?.width||0);
  const height=Number(enhancedInfo?.height||0);
  const enhancedChannels=Number(enhancedInfo?.channels||4);
  const referenceChannels=Number(referenceInfo?.channels||4);
  const pixels=width*height;
  if(!width||!height||!pixels||enhancedChannels<3||referenceChannels<3)return;
  if(Number(referenceInfo?.width||0)!==width||Number(referenceInfo?.height||0)!==height)return;
  const enhancedLuma=new Uint8Array(pixels);
  const referenceLuma=new Uint8Array(pixels);
  for(let pixel=0, enhancedOffset=0, referenceOffset=0; pixel<pixels; pixel++, enhancedOffset +=enhancedChannels, referenceOffset +=referenceChannels){
    enhancedLuma[pixel]=(enhancedData[enhancedOffset]*54+enhancedData[enhancedOffset+1]*183+enhancedData[enhancedOffset+2]*19)>>8;
    referenceLuma[pixel]=(referenceData[referenceOffset]*54+referenceData[referenceOffset+1]*183+referenceData[referenceOffset+2]*19)>>8;
  }
  const restore=settings.restore||{};
  const minEdge=Math.min(width, height);
  const baseRadius=Math.max(4, Math.min(32, Math.round(minEdge/96)));
  const enhancedBase=boxBlurLuminance(enhancedLuma, width, height, baseRadius);
  const referenceBase=boxBlurLuminance(referenceLuma, width, height, baseRadius);
  const referenceFine=boxBlurLuminance(referenceLuma, width, height, 1);
  const referenceStats=luminanceStats(referenceLuma);
  const detailStrength=Math.max(.25, Math.min(.7, Number(restore.aiDetail||.5)));
  const denoise=Math.max(.06, Math.min(.32, Number(restore.denoise||.22)));
  const maxDelta=Math.max(6, Math.min(14, Number(restore.aiMaxDelta||restore.maxDelta||11)));
  const restoredLuma=new Float32Array(pixels);
  for(let pixel=0; pixel<pixels; pixel++){
    const sourceY=referenceLuma[pixel];
    const aiDetail=enhancedLuma[pixel]-enhancedBase[pixel];
    const sourceDetail=sourceY-referenceBase[pixel];
    const aiEdge=Math.min(1, Math.abs(aiDetail)/24);
    const sourceEdge=Math.min(1, Math.abs(sourceDetail)/18);
    const structureMask=Math.max(aiEdge, sourceEdge*.7);
    const flatMask=Math.max(0, 1-structureMask);
    const highlightGuard=sourceY>224?Math.max(0, (255-sourceY)/31):1;
    const shadowGuard=sourceY<31?Math.max(0, sourceY/31):1;
    const toneGuard=highlightGuard*shadowGuard;
    const detailDelta=(aiDetail*detailStrength+sourceDetail*.12)*structureMask*toneGuard;
    const denoiseDelta=(referenceFine[pixel]-sourceY)*denoise*flatMask*toneGuard;
    const naturalLimit=maxDelta*(.32+structureMask*.68);
    restoredLuma[pixel]=sourceY+Math.max(-naturalLimit, Math.min(naturalLimit, detailDelta+denoiseDelta));
  }
  const restoredStats=luminanceStats(restoredLuma);
  const contrastRatio=restoredStats.std>0.01?referenceStats.std/restoredStats.std:1;
  const safeRatio=Math.max(.6, Math.min(1, contrastRatio));
  for(let pixel=0, offset=0; pixel<pixels; pixel++, offset +=referenceChannels){
    const sourceY=referenceLuma[pixel];
    const preservedY=referenceStats.mean+(restoredLuma[pixel]-restoredStats.mean)*safeRatio;
    const toneDistance=Math.min(sourceY, 255-sourceY);
    const toneLimit=Math.min(maxDelta, Math.max(0, toneDistance*.42));
    const delta=Math.max(-toneLimit, Math.min(toneLimit, preservedY-sourceY));
    referenceData[offset]=clampByte(referenceData[offset]+delta);
    referenceData[offset+1]=clampByte(referenceData[offset+1]+delta);
    referenceData[offset+2]=clampByte(referenceData[offset+2]+delta);
  }
}
async function renderNaturalRestoreImage(image, outputFormat, settings, options={}){
  const raw=await image.ensureAlpha().raw().toBuffer({resolveWithObject:true});
  applyNaturalRestorePixels(raw.data, raw.info, settings);
  let output=sharp(raw.data, {raw:{width:raw.info.width, height:raw.info.height, channels:raw.info.channels}}).toColorspace('srgb');
  if(normalizeImageFormat(outputFormat)==='jpeg'){
    output=output.flatten({background:'#000'});
  }
  return encodeSharpImage(output, outputFormat, {quality:settings.quality||options.quality||97, lossless:Boolean(options.lossless), resolveWithObject:true});
}
async function renderReferenceToneLockedImage(enhancedImage, referenceBuffer, outputFormat, settings, options={}){
  const enhancedRaw=await enhancedImage.ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const referenceRaw=await sharp(referenceBuffer, {failOn:'warning', limitInputPixels:50_000_000, animated:false})
    .rotate()
    .resize({width:enhancedRaw.info.width, height:enhancedRaw.info.height, fit:'fill', kernel:'lanczos3'})
    .toColorspace('srgb')
    .ensureAlpha()
    .raw()
    .toBuffer({resolveWithObject:true});
  applyReferenceToneLockedPixels(enhancedRaw.data, enhancedRaw.info, referenceRaw.data, referenceRaw.info, settings);
  let output=sharp(referenceRaw.data, {raw:{width:referenceRaw.info.width, height:referenceRaw.info.height, channels:referenceRaw.info.channels}}).toColorspace('srgb');
  if(normalizeImageFormat(outputFormat)==='jpeg'){
    output=output.flatten({background:'#000'});
  }
  return encodeSharpImage(output, outputFormat, {quality:options.quality||settings.quality||98, lossless:Boolean(options.lossless), resolveWithObject:true});
}
function encodeSharpImage(image, format, options={}){
  const normalized=normalizeImageFormat(format)||'jpeg';
  const quality=Math.max(1, Math.min(100, Math.round(Number(options.quality||95))));
  let output=image;
  if(normalized==='png'){
    output=output.png({compressionLevel:9, adaptiveFiltering:true, effort:10});
  }
  else if(normalized==='webp'){
    output=output.webp(options.lossless?WEBP_LOSSLESS_OPTIONS:{quality, effort:options.effort||6, smartSubsample:true});
  }
  else{
    output=output.jpeg({quality, mozjpeg:true});
  }
  return options.resolveWithObject?output.toBuffer({resolveWithObject:true}):output.toBuffer();
}
async function enhanceWallpaperBuffer(buffer, options={}){
  if(!sharp){
    const error=new Error('Image enhancement dependency is missing. Run npm install before deploying.');
    error.status=500;
    throw error;
  }
  const mode='ultra';
  const settings=ENHANCE_MODE_SETTINGS[mode];
  const lossless=Boolean(options.lossless);
  let image=sharp(buffer, {failOn:'warning', limitInputPixels:50_000_000, animated:false}).rotate();
  let metadata;
  try{
    metadata=await image.metadata();
  }
  catch{
    const error=new Error('The selected wallpaper is not a valid clean image file.');
    error.status=400;
    throw error;
  }
  const format=String(metadata?.format||'').toLowerCase();
  if(!['jpeg', 'png', 'webp'].includes(format)){
    const error=new Error('Upload a PNG, JPG, or WEBP wallpaper.');
    error.status=400;
    throw error;
  }
  if(!metadata.width||!metadata.height){
    const error=new Error('The selected wallpaper has invalid image dimensions.');
    error.status=400;
    throw error;
  }
  const outputFormat=normalizeImageFormat(options.sourceMime)||format;
  const resize=wallpaperEnhanceResize(metadata.width, metadata.height, settings);
  if(resize){
    image=image.resize(resize);
  }
  try{
    image=image.toColorspace('srgb');
    const result=await renderNaturalRestoreImage(image, outputFormat, settings, {lossless});
    if(!result.data.length||result.data.length>ENHANCED_WALLPAPER_MAX_BYTES){
      const error=new Error(`Enhanced wallpaper must be under ${Math.floor(ENHANCED_WALLPAPER_MAX_BYTES / (1024 * 1024))} MB.`);
      error.status=400;
      throw error;
    }
    return{
      buffer:result.data,
      width:result.info.width,
      height:result.info.height,
      mime:mimeForImageFormat(outputFormat),
      ext:extForImageFormat(outputFormat),
      mode:'local',
      modeLabel:settings.label||'Natural Detail Restore',
      provider:'local',
      lossless,
    };
  }
  catch(error){
    if(error.status)throw error;
    const wrapped=new Error('The selected wallpaper could not be enhanced.');
    wrapped.status=400;
    throw wrapped;
  }
}
function parseCloudinaryConfig(){
  if(!CLOUDINARY_URL)return null;
  try{
    const parsed=new URL(CLOUDINARY_URL);
    const cloudName=String(parsed.hostname||'').trim();
    const apiKey=decodeURIComponent(String(parsed.username||'')).trim();
    const apiSecret=decodeURIComponent(String(parsed.password||'')).trim();
    if(parsed.protocol!=='cloudinary:'||!cloudName||!apiKey||!apiSecret)return null;
    return{cloudName, apiKey, apiSecret};
  }
  catch{
    return null;
  }
}
function aiEnhanceReady(){
  return AI_ENHANCE_PROVIDER==='cloudinary'&&Boolean(parseCloudinaryConfig())&&AI_ENHANCE_LIMIT_PER_PROFILE>0;
}
function signCloudinaryParams(params, apiSecret){
  const base=Object.entries(params)
    .filter(([, value])=>value!==undefined&&value!==null&&String(value)!=='')
    .sort(([a], [b])=>a.localeCompare(b))
    .map(([key, value])=>`${key}=${value}`)
    .join('&');
  return sha1(`${base}${apiSecret}`);
}
function cloudinaryTransformedUrl(url, transformation){
  const source=String(url||'');
  const marker='/image/upload/';
  const index=source.indexOf(marker);
  if(index===-1)throw new Error('Cloudinary did not return a transformable image URL.');
  return `${source.slice(0, index+marker.length)}${transformation}/${source.slice(index+marker.length)}`;
}
function cloudinaryEnhanceTargetWidth(metadata){
  const width=Number(metadata?.width||0);
  const height=Number(metadata?.height||0);
  if(!width||!height)return null;
  const settings=ENHANCE_MODE_SETTINGS.ultra;
  const targetLongest=height>=width?settings.portraitLongEdge:settings.landscapeLongEdge;
  const longest=Math.max(width, height);
  const scale=longest>=targetLongest?1:Math.min(targetLongest / longest, CLOUDINARY_AI_UPSCALE_MAX_SCALE);
  if(scale<=1.02)return null;
  return Math.max(1, Math.round(width*scale));
}
function cloudinaryEnhanceTransformations(metadata){
  const targetWidth=cloudinaryEnhanceTargetWidth(metadata);
  if(!targetWidth){
    return[{transformation:['e_gen_restore', 'q_100,f_auto'].join('/'), label:'Cloudinary AI Restore'}];
  }
  return[
    {transformation:[`e_upscale,w_${targetWidth}`, 'e_gen_restore', 'q_100,f_auto'].join('/'), label:'Cloudinary AI Upscale + Restore'},
    {transformation:['e_gen_restore', 'q_100,f_auto'].join('/'), label:'Cloudinary AI Restore'},
  ];
}
function cloudinaryRetryDelayMs(response, fallbackMs){
  const retryAfter=Number(response?.headers?.get?.('retry-after')||0);
  if(Number.isFinite(retryAfter)&&retryAfter>0)return Math.min(15000, Math.round(retryAfter*1000));
  return fallbackMs;
}
function cloudinaryRequestError(message, status=503){
  const error=new Error(message);
  error.status=status;
  error.cloudinary=true;
  return error;
}
function delay(ms){
  return new Promise(resolve=>setTimeout(resolve, ms));
}
async function fetchCloudinaryTransformedBuffer(url){
  let response=null;
  let lastError=null;
  for(let attempt=0; attempt<=CLOUDINARY_AI_TRANSFORM_RETRY_DELAYS_MS.length; attempt++){
    try{
      response=await fetch(url);
    }
    catch(error){
      lastError=error;
      if(attempt<CLOUDINARY_AI_TRANSFORM_RETRY_DELAYS_MS.length){
        await delay(CLOUDINARY_AI_TRANSFORM_RETRY_DELAYS_MS[attempt]);
        continue;
      }
      break;
    }
    if(response.ok)return Buffer.from(await response.arrayBuffer());
    const shouldRetry=CLOUDINARY_AI_RETRY_STATUSES.has(response.status)&&attempt<CLOUDINARY_AI_TRANSFORM_RETRY_DELAYS_MS.length;
    if(!shouldRetry)break;
    await response.arrayBuffer().catch(()=>null);
    await delay(cloudinaryRetryDelayMs(response, CLOUDINARY_AI_TRANSFORM_RETRY_DELAYS_MS[attempt]));
  }
  if(response?.status===420||response?.status===423){
    throw cloudinaryRequestError('Cloudinary AI enhancement is still processing. Try Enhance again in a moment. No AI use was spent.', 503);
  }
  const detail=response?.status?`Cloudinary-enhanced image could not be downloaded (${response.status}).`:`Cloudinary-enhanced image could not be downloaded: ${lastError?.message||'network error'}.`;
  throw cloudinaryRequestError(`${detail} No AI use was spent.`, response?.status&&response.status<500&&!CLOUDINARY_AI_RETRY_STATUSES.has(response.status)?400:503);
}
async function uploadToCloudinary(config, uploadParams, buffer, sourceMime, sourceExt){
  let lastError=null;
  for(let attempt=0; attempt<=CLOUDINARY_AI_UPLOAD_RETRY_DELAYS_MS.length; attempt++){
    const form=new FormData();
    const signature=signCloudinaryParams(uploadParams, config.apiSecret);
    for(const[key, value]of Object.entries(uploadParams))form.append(key, String(value));
    form.append('api_key', config.apiKey);
    form.append('signature', signature);
    form.append('file', new Blob([buffer], {type:sourceMime}), `wallpaper.${sourceExt}`);
    let response=null;
    let payload={};
    try{
      response=await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(config.cloudName)}/image/upload`, {method:'POST', body:form});
      payload=await response.json().catch(()=>({}));
    }
    catch(error){
      lastError=error;
      if(attempt<CLOUDINARY_AI_UPLOAD_RETRY_DELAYS_MS.length){
        await delay(CLOUDINARY_AI_UPLOAD_RETRY_DELAYS_MS[attempt]);
        continue;
      }
      break;
    }
    if(response.ok)return payload;
    const retryable=CLOUDINARY_AI_RETRY_STATUSES.has(response.status)&&attempt<CLOUDINARY_AI_UPLOAD_RETRY_DELAYS_MS.length;
    if(retryable){
      await delay(cloudinaryRetryDelayMs(response, CLOUDINARY_AI_UPLOAD_RETRY_DELAYS_MS[attempt]));
      continue;
    }
    const detail=payload?.error?.message||payload?.message||payload?.error||`Cloudinary upload failed with status ${response.status}.`;
    throw cloudinaryRequestError(`${detail} No AI use was spent.`, response.status>=500||CLOUDINARY_AI_RETRY_STATUSES.has(response.status)?503:400);
  }
  throw cloudinaryRequestError(`Cloudinary upload could not be completed: ${lastError?.message||'network error'}. No AI use was spent.`, 503);
}
async function finalizeAiEnhancedBuffer(buffer, options={}){
  if(!sharp){
    const error=new Error('Image enhancement dependency is missing. Run npm install before deploying.');
    error.status=500;
    throw error;
  }
  const outputFormat=normalizeImageFormat(options.format||options.sourceMime)||'jpeg';
  let image=sharp(buffer, {failOn:'warning', limitInputPixels:120_000_000, animated:false})
    .rotate()
    .toColorspace('srgb');
  const metadata=await image.metadata();
  const resize=wallpaperEnhanceResize(metadata.width, metadata.height, ENHANCE_MODE_SETTINGS.ultra);
  if(resize)image=image.resize(resize);
  const result=options.referenceBuffer
    ? await renderReferenceToneLockedImage(image, options.referenceBuffer, outputFormat, ENHANCE_MODE_SETTINGS.ultra, {quality:100})
    : await renderNaturalRestoreImage(image, outputFormat, ENHANCE_MODE_SETTINGS.ultra, {quality:100});
  if(!result.data.length||result.data.length>ENHANCED_WALLPAPER_MAX_BYTES){
    const error=new Error(`Enhanced wallpaper must be under ${Math.floor(ENHANCED_WALLPAPER_MAX_BYTES / (1024 * 1024))} MB.`);
    error.status=400;
    throw error;
  }
  return{
    buffer:result.data,
    width:result.info.width,
    height:result.info.height,
    mime:mimeForImageFormat(outputFormat),
    ext:extForImageFormat(outputFormat),
    mode:'ai',
    modeLabel:options.label?`${options.label} + Natural Restore`:'Natural Restore',
    provider:options.provider||'cloudinary',
    lossless:false,
  };
}
async function enhanceWallpaperWithCloudinary(buffer, options={}){
  if(typeof fetch!=='function'||typeof FormData==='undefined'||typeof Blob==='undefined'){
    throw new Error('AI enhancement needs Node 18+ fetch/FormData support.');
  }
  if(!sharp){
    const error=new Error('Image enhancement dependency is missing. Run npm install before deploying.');
    error.status=500;
    throw error;
  }
  const config=parseCloudinaryConfig();
  if(!config)throw new Error('Cloudinary is not configured.');
  const metadata=await sharp(buffer, {failOn:'warning', limitInputPixels:50_000_000, animated:false}).metadata();
  const format=String(metadata?.format||'').toLowerCase();
  if(!['jpeg', 'png', 'webp'].includes(format)){
    const error=new Error('Upload a PNG, JPG, or WEBP wallpaper.');
    error.status=400;
    throw error;
  }
  const sourceMime=String(options.sourceMime||'image/jpeg');
  const sourceExt=sourceMime==='image/png'?'png':sourceMime==='image/webp'?'webp':'jpg';
  const uploadParams={
    timestamp:Math.floor(Date.now()/1000),
    folder:'readyvoid/enhancements',
    public_id:`enhance-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
    overwrite:'true',
    tags:'readyvoid,enhancement',
  };
  const payload=await uploadToCloudinary(config, uploadParams, buffer, sourceMime, sourceExt);
  const secureUrl=String(payload.secure_url||payload.url||'');
  if(!secureUrl)throw cloudinaryRequestError('Cloudinary did not return an enhanced image URL.', 502);
  const outputFormat=normalizeImageFormat(sourceMime)||format;
  let lastTransformError=null;
  for(const enhancePlan of cloudinaryEnhanceTransformations(metadata)){
    try{
      const transformedUrl=cloudinaryTransformedUrl(secureUrl, enhancePlan.transformation);
      const enhancedBuffer=await fetchCloudinaryTransformedBuffer(transformedUrl);
      return finalizeAiEnhancedBuffer(enhancedBuffer, {label:enhancePlan.label, provider:'cloudinary', format:outputFormat, referenceBuffer:buffer});
    }
    catch(error){
      lastTransformError=error;
      if(error.status!==400)throw error;
    }
  }
  throw lastTransformError||cloudinaryRequestError('Cloudinary AI enhancement failed.', 502);
}
async function enhanceWallpaperBest(buffer, options={}){
  const usage=options.usageState||{used:0, limit:AI_ENHANCE_LIMIT_PER_PROFILE, remaining:0};
  if(aiEnhanceReady()){
    if(usage.remaining<=0){
      return enhanceWallpaperBuffer(buffer, {...options, lossless:false});
    }
    try{
      return await enhanceWallpaperWithCloudinary(buffer, options);
    }
    catch(error){
      console.warn('Cloudinary enhancement failed; using Sharp fallback and AI quota was not consumed:', error.message||error);
      return enhanceWallpaperBuffer(buffer, {...options, lossless:false});
    }
  }
  return enhanceWallpaperBuffer(buffer, {...options, lossless:false});
}
function enhancementQueueError(){
  const error=new Error('Enhancement queue is busy. Try again in a moment.');
  error.status=429;
  error.retryAfterSeconds=15;
  return error;
}
function runEnhancementJob(task){
  if(activeEnhanceJobs>=ENHANCE_CONCURRENCY&&enhanceJobQueue.length>=ENHANCE_QUEUE_LIMIT){
    return Promise.reject(enhancementQueueError());
  }
  return new Promise((resolve, reject)=>{
    enhanceJobQueue.push({task, resolve, reject});
    pumpEnhancementQueue();
  });
}
function pumpEnhancementQueue(){
  while(activeEnhanceJobs<ENHANCE_CONCURRENCY&&enhanceJobQueue.length){
    const job=enhanceJobQueue.shift();
    activeEnhanceJobs +=1;
    Promise.resolve()
      .then(job.task)
      .then(job.resolve, job.reject)
      .finally(()=>{
        activeEnhanceJobs=Math.max(0, activeEnhanceJobs-1);
        releaseSharpMemory();
        pumpEnhancementQueue();
      });
  }
}
function pruneEnhancedDownloads(now=Date.now()){
  let removed=false;
  for(const[token, item]of enhancedDownloads){
    if(!item||item.expiresAt<=now){
      enhancedDownloads.delete(token);
      removed=true;
    }
  }
  while(enhancedDownloads.size>ENHANCED_DOWNLOAD_CACHE_LIMIT){
    const oldest=enhancedDownloads.keys().next().value;
    if(!oldest)break;
    enhancedDownloads.delete(oldest);
    removed=true;
  }
  if(removed)releaseSharpMemory();
}
const enhancedDownloadPruneTimer=setInterval(()=>pruneEnhancedDownloads(), Math.min(ENHANCED_DOWNLOAD_TTL_MS, 60*1000));
if(enhancedDownloadPruneTimer.unref)enhancedDownloadPruneTimer.unref();
function enhancedDownloadReason(enhanced, quotaState, usage){
  if(enhanced.provider==='cloudinary'){
    return usage.remaining>0?`${usage.remaining} AI restore ${usage.remaining===1?'use':'uses'} remaining today`:'today\'s AI restore limit has been reached';
  }
  if(quotaState==='exhausted')return 'daily AI restore limit reached; true-tone detail restore was used';
  if(quotaState==='fallback')return 'true-tone detail restore was used';
  if(quotaState==='unavailable'){
    return AI_ENHANCE_PROVIDER==='local'?'true-tone detail restore is configured':'AI restore is unavailable; true-tone detail restore was used';
  }
  return 'true-tone detail restore was used';
}
function cacheEnhancedDownload(user, enhanced, filename){
  pruneEnhancedDownloads();
  const token=crypto.randomBytes(24).toString('base64url');
  const now=Date.now();
  enhancedDownloads.set(token, {
    creatorId:user.creatorId,
    buffer:enhanced.buffer,
    mime:enhanced.mime||'application/octet-stream',
    filename,
    width:enhanced.width||'',
    height:enhanced.height||'',
    mode:enhanced.mode||'',
    modeLabel:enhanced.modeLabel||'',
    provider:enhanced.provider||'local',
    createdAt:now,
    expiresAt:now+ENHANCED_DOWNLOAD_TTL_MS,
  });
  pruneEnhancedDownloads();
  return `/api/enhance-download/${token}`;
}
function enhancedDownloadHeaders(item){
  const filename=safeDownloadName(item.filename||'wallpaper-ai-enhanced.jpg');
  return{
    'Content-Type':item.mime||'application/octet-stream',
    'Content-Length':item.buffer.length,
    'Cache-Control':'no-store',
    'Content-Disposition':`attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    'X-Enhanced-Width':String(item.width||''),
    'X-Enhanced-Height':String(item.height||''),
    'X-Enhance-Mode':String(item.mode||''),
    'X-Enhance-Mode-Label':String(item.modeLabel||''),
    'X-Enhance-Provider':String(item.provider||'local'),
  };
}
async function downloadEnhancedWallpaper(req, res, token){
  pruneEnhancedDownloads();
  const item=enhancedDownloads.get(String(token||''));
  if(!item)return sendJson(res, 404, {error:'Enhanced download expired. Enhance the image again.'});
  const user=await requireCreator(req, res);
  if(!user)return;
  if(user.creatorId!==item.creatorId)return sendJson(res, 404, {error:'Enhanced download not found.'});
  res.writeHead(200, enhancedDownloadHeaders(item));
  res.end(item.buffer);
}
async function releaseEnhancedWallpaper(req, res, token){
  pruneEnhancedDownloads();
  const key=String(token||'');
  const item=enhancedDownloads.get(key);
  if(!item)return sendJson(res, 200, {ok:true, released:false});
  const user=await requireCreator(req, res);
  if(!user)return;
  if(user.creatorId!==item.creatorId)return sendJson(res, 200, {ok:true, released:false});
  enhancedDownloads.delete(key);
  releaseSharpMemory();
  sendJson(res, 200, {ok:true, released:true});
}
async function getEnhanceMethodStatus(req, res){
  const user=await requireCreator(req, res);
  if(!user)return;
  try{
    const usageState=await getAiEnhanceUsageState(user.creatorId);
    const aiReady=aiEnhanceReady();
    const useAi=aiReady&&usageState.remaining>0;
    const quotaState=useAi?'available':!aiReady?'unavailable':usageState.remaining<=0?'exhausted':'fallback';
    sendJson(res, 200, {
      ok:true,
      method:useAi?'ai':'local',
      provider:useAi?'cloudinary':'local',
      modeLabel:useAi?'AI powered enhancer':'Built-in enhancer',
      quotaState,
      limit:usageState.limit,
      used:usageState.used,
      remaining:usageState.remaining,
      resetAt:usageState.resetAt?new Date(usageState.resetAt).toISOString():'',
    });
  }
  catch(error){
    sendJson(res, error.status||400, {error:friendlySupabaseError(error)||error.message||'Could not check enhancement method.'});
  }
}
async function handleEnhanceWallpaper(req, res){
  const user=await requireCreator(req, res);
  if(!user)return;
  try{
    await runEnhancementJob(()=>processEnhanceWallpaper(req, res, user));
  }
  catch(error){
    const headers={};
    if(error.retryAfterSeconds)headers['Retry-After']=String(error.retryAfterSeconds);
    sendJson(res, error.status||400, {error:friendlySupabaseError(error)||error.message||'Detail restore could not be completed.'}, headers);
  }
}
async function processEnhanceWallpaper(req, res, user){
  let raw=null;
  let payload=null;
  let buffer=null;
  let enhanced=null;
  try{
    raw=await readBody(req, MAX_UPLOAD_BODY_BYTES);
    payload=JSON.parse(raw||'{}');
    const{
      sourceMime, buffer:sourceBuffer
    }
    =parseImageDataUrl(payload.dataUrl, MAX_UPLOAD_BYTES, 'wallpaper');
    buffer=sourceBuffer;
    const usageState=await getAiEnhanceUsageState(user.creatorId);
    enhanced=await enhanceWallpaperBest(buffer, {sourceMime, usageState});
    let finalUsage=usageState;
    if(enhanced.provider==='cloudinary'){
      try{
        finalUsage=await recordAiEnhanceUse(user.creatorId, usageState);
      }
      catch(error){
        console.warn('Could not record AI enhancement usage:', error.message||error);
        const used=Math.min(usageState.limit, usageState.used+1);
        finalUsage={...usageState, used, remaining:Math.max(0, usageState.limit-used)};
      }
    }
    const quotaState=enhanced.provider==='cloudinary'?'used':!aiEnhanceReady()?'unavailable':finalUsage.remaining<=0?'exhausted':'fallback';
    const baseName=safeDownloadName(payload.title||payload.filename||'wallpaper');
    const filename=`${baseName}-ai-enhanced.${enhanced.ext}`;
    const downloadUrl=cacheEnhancedDownload(user, enhanced, filename);
    const reason=enhancedDownloadReason(enhanced, quotaState, finalUsage);
    res.writeHead(200, {'Content-Type':enhanced.mime, 'Content-Length':enhanced.buffer.length, 'Cache-Control':'no-store', 'Content-Disposition':`attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`, 'X-Enhanced-Width':String(enhanced.width||''), 'X-Enhanced-Height':String(enhanced.height||''), 'X-Enhance-Mode':enhanced.mode, 'X-Enhance-Mode-Label':enhanced.modeLabel, 'X-Enhance-Provider':enhanced.provider||'local', 'X-Enhance-Download-Url':downloadUrl, 'X-Enhance-Reason':reason, 'X-AI-Enhance-Limit':String(finalUsage.limit), 'X-AI-Enhance-Used':String(finalUsage.used), 'X-AI-Enhance-Remaining':String(finalUsage.remaining), 'X-AI-Enhance-Window-Hours':'24', 'X-AI-Enhance-Reset-At':finalUsage.resetAt?new Date(finalUsage.resetAt).toISOString():'', 'X-AI-Enhance-Quota-State':quotaState, });
    res.end(enhanced.buffer);
  }
  finally{
    raw=null;
    payload=null;
    buffer=null;
    enhanced=null;
    releaseSharpMemory();
  }
}
function cleanSystemText(value, maxLength){
  return String(value||'').normalize('NFKC').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}
function cleanLongSystemText(value, maxLength){
  return String(value||'').normalize('NFKC').replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, maxLength);
}
function normalizeNotificationItem(item={}){
  const id=String(item.id||'').trim();
  const title=cleanSystemText(item.title||'System notification', 80)||'System notification';
  const message=cleanLongSystemText(item.message||'', 600);
  if(!id||!message)return null;
  const createdAt=String(item.createdAt||new Date().toISOString());
  const updatedAt=String(item.updatedAt||createdAt);
  return{id, title, message, active:item.active!==false, silent:Boolean(item.silent), createdAt, updatedAt};
}
async function readSystemNotifications(){
  const value=await readAppSettingValue(SYSTEM_NOTIFICATIONS_SETTING_KEY);
  const source=Array.isArray(value.items)?value.items:[];
  return source.map(normalizeNotificationItem).filter(Boolean).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, SYSTEM_NOTIFICATION_LIMIT);
}
async function writeSystemNotifications(items){
  const cleaned=(Array.isArray(items)?items:[]).map(normalizeNotificationItem).filter(Boolean).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, SYSTEM_NOTIFICATION_LIMIT);
  await writeAppSettingValue(SYSTEM_NOTIFICATIONS_SETTING_KEY, {items:cleaned, updatedAt:new Date().toISOString()});
  return cleaned;
}
function publicNotificationDto(item){
  return{id:item.id, title:item.title, message:item.message, silent:Boolean(item.silent), createdAt:item.createdAt};
}
async function listSystemNotifications(_req, res){
  try{
    const items=(await readSystemNotifications()).filter((item)=>item.active!==false);
    sendJson(res, 200, {ok:true, notifications:items.map(publicNotificationDto)});
  }
  catch(error){
    sendJson(res, error.status||400, {error:friendlySupabaseError(error)||error.message||'Could not load notifications.'});
  }
}
async function listAdminNotifications(req, res){
  if(!requireAdmin(req, res))return;
  try{
    sendJson(res, 200, {ok:true, notifications:await readSystemNotifications()});
  }
  catch(error){
    sendJson(res, error.status||400, {error:friendlySupabaseError(error)||error.message||'Could not load notifications.'});
  }
}
async function createAdminNotification(req, res){
  if(!requireAdmin(req, res))return;
  try{
    const raw=await readBody(req, 32*1024);
    const payload=JSON.parse(raw||'{}');
    const title=cleanSystemText(payload.title||'System notification', 80)||'System notification';
    const message=cleanLongSystemText(payload.message||'', 600);
    if(!message)return sendJson(res, 400, {error:'Notification message is required.'});
    const now=new Date().toISOString();
    const items=await readSystemNotifications();
    const created={id:crypto.randomUUID(), title, message, active:payload.active!==false, silent:Boolean(payload.silent), createdAt:now, updatedAt:now};
    const notifications=await writeSystemNotifications([created, ...items]);
    sendJson(res, 201, {ok:true, notification:created, notifications});
  }
  catch(error){
    sendJson(res, error.status||400, {error:friendlySupabaseError(error)||error.message||'Could not create notification.'});
  }
}
async function updateAdminNotification(req, res, id){
  if(!requireAdmin(req, res))return;
  try{
    const raw=await readBody(req, 32*1024);
    const payload=JSON.parse(raw||'{}');
    const items=await readSystemNotifications();
    const index=items.findIndex((item)=>item.id===id);
    if(index===-1)return sendJson(res, 404, {error:'Notification not found.'});
    const title=cleanSystemText(payload.title||items[index].title, 80)||items[index].title;
    const message=cleanLongSystemText(payload.message||items[index].message, 600);
    if(!message)return sendJson(res, 400, {error:'Notification message is required.'});
    items[index]={...items[index], title, message, active:payload.active!==false, silent:Boolean(payload.silent), updatedAt:new Date().toISOString()};
    const notifications=await writeSystemNotifications(items);
    sendJson(res, 200, {ok:true, notification:items[index], notifications});
  }
  catch(error){
    sendJson(res, error.status||400, {error:friendlySupabaseError(error)||error.message||'Could not update notification.'});
  }
}
async function deleteAdminNotification(req, res, id){
  if(!requireAdmin(req, res))return;
  try{
    const items=await readSystemNotifications();
    const next=items.filter((item)=>item.id!==id);
    if(next.length===items.length)return sendJson(res, 404, {error:'Notification not found.'});
    const notifications=await writeSystemNotifications(next);
    sendJson(res, 200, {ok:true, notifications});
  }
  catch(error){
    sendJson(res, error.status||400, {error:friendlySupabaseError(error)||error.message||'Could not delete notification.'});
  }
}
function normalizeFeedbackItem(item={}){
  const id=String(item.id||'').trim();
  const message=cleanLongSystemText(item.message||'', 1200);
  if(!id||!message)return null;
  const rawType=String(item.type||'').toLowerCase();
  const type=rawType==='bug'||rawType==='issue'?'bug':'feedback';
  const createdAt=String(item.createdAt||new Date().toISOString());
  const reply=cleanLongSystemText(item.reply||item.adminReply||'', 1200);
  return{
    id,
    type,
    message,
    creatorId:String(item.creatorId||'').trim(),
    username:cleanSystemText(item.username||'Unknown creator', 80)||'Unknown creator',
    email:cleanSystemText(item.email||'', 254),
    status:item.status==='reviewed'?'reviewed':'new',
    createdAt,
    reviewedAt:String(item.reviewedAt||''),
    reply,
    adminReply:reply,
    repliedAt:String(item.repliedAt||item.replyAt||''),
  };
}
function feedbackReviewedExpired(item, now=Date.now()){
  if(item?.status!=='reviewed')return false;
  const reviewedAt=Date.parse(String(item.reviewedAt||''));
  return Number.isFinite(reviewedAt)&&now-reviewedAt>=USER_FEEDBACK_REVIEWED_TTL_MS;
}
function cleanUserFeedbackItems(items, options={}){
  const now=Date.now();
  return (Array.isArray(items)?items:[])
    .map(normalizeFeedbackItem)
    .filter(Boolean)
    .filter((item)=>!(options.dropExpired&&feedbackReviewedExpired(item, now)))
    .sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, USER_FEEDBACK_LIMIT);
}
async function readUserFeedback(){
  const value=await readAppSettingValue(USER_FEEDBACK_SETTING_KEY);
  const source=Array.isArray(value.items)?value.items:[];
  const normalized=source.map(normalizeFeedbackItem).filter(Boolean);
  const cleaned=cleanUserFeedbackItems(normalized, {dropExpired:true});
  if(cleaned.length!==normalized.length){
    await writeAppSettingValue(USER_FEEDBACK_SETTING_KEY, {items:cleaned, updatedAt:new Date().toISOString()});
  }
  return cleaned;
}
async function writeUserFeedback(items){
  const cleaned=cleanUserFeedbackItems(items, {dropExpired:true});
  await writeAppSettingValue(USER_FEEDBACK_SETTING_KEY, {items:cleaned, updatedAt:new Date().toISOString()});
  return cleaned;
}
const userFeedbackPruneTimer=setInterval(()=>{
  readUserFeedback().catch((error)=>console.warn('Feedback cleanup skipped:', friendlySupabaseError(error)||error.message||error));
}, Math.min(USER_FEEDBACK_REVIEWED_TTL_MS, 60*60*1000));
if(userFeedbackPruneTimer.unref)userFeedbackPruneTimer.unref();
function publicFeedbackDto(item){
  return{id:item.id, type:item.type, message:item.message, status:item.status, createdAt:item.createdAt, reviewedAt:item.reviewedAt||'', reply:item.reply||'', adminReply:item.reply||'', repliedAt:item.repliedAt||''};
}
async function readUserFeedbackForCreator(creatorId){
  const id=String(creatorId||'').trim();
  if(!id)return[];
  return (await readUserFeedback()).filter((item)=>item.creatorId===id).map(publicFeedbackDto);
}
function countRecentUserFeedback(items, creatorId, now=Date.now()){
  const id=String(creatorId||'').trim();
  if(!id)return 0;
  const cutoff=now-USER_FEEDBACK_LIMIT_WINDOW_MS;
  return (Array.isArray(items)?items:[]).filter((item)=>{
    if(item.creatorId!==id)return false;
    const createdAt=Date.parse(String(item.createdAt||''));
    return Number.isFinite(createdAt)&&createdAt>=cutoff&&createdAt<=now+60*1000;
  }).length;
}
async function listUserFeedback(req, res){
  const user=await requireCreator(req, res);
  if(!user)return;
  try{
    sendJson(res, 200, {ok:true, feedback:await readUserFeedbackForCreator(user.creatorId)});
  }
  catch(error){
    sendJson(res, error.status||400, {error:friendlySupabaseError(error)||error.message||'Could not load feedback.'});
  }
}
async function submitUserFeedback(req, res){
  const user=await requireCreator(req, res);
  if(!user)return;
  try{
    const raw=await readBody(req, 32*1024);
    const payload=JSON.parse(raw||'{}');
    const type=String(payload.type||'').toLowerCase()==='bug'?'bug':'feedback';
    const message=cleanLongSystemText(payload.message||'', 1200);
    if(message.length<10)return sendJson(res, 400, {error:'Feedback must be at least 10 characters.'});
    const now=new Date().toISOString();
    const items=await readUserFeedback();
    const recentCount=countRecentUserFeedback(items, user.creatorId);
    if(recentCount>=USER_FEEDBACK_LIMIT_PER_24H){
      return sendJson(res, 429, {error:`Feedback limit reached. Each profile can send ${USER_FEEDBACK_LIMIT_PER_24H} feedback messages in 24 hours. Try again later.`, code:'FEEDBACK_LIMIT_REACHED'});
    }
    const item={id:crypto.randomUUID(), type, message, creatorId:user.creatorId, username:user.creatorName||user.username||'Unknown creator', email:user.email||'', status:'new', createdAt:now, reviewedAt:'', reply:'', repliedAt:''};
    await writeUserFeedback([item, ...items]);
    queueFeedbackAdminEmail(req, item);
    sendJson(res, 201, {ok:true, message:'Feedback sent. Thank you for helping improve THE VOID SPACE.'});
  }
  catch(error){
    sendJson(res, error.status||400, {error:friendlySupabaseError(error)||error.message||'Could not send feedback.'});
  }
}
async function listAdminFeedback(req, res){
  if(!requireAdmin(req, res))return;
  try{
    sendJson(res, 200, {ok:true, feedback:await readUserFeedback()});
  }
  catch(error){
    sendJson(res, error.status||400, {error:friendlySupabaseError(error)||error.message||'Could not load feedback.'});
  }
}
async function reviewAdminFeedback(req, res, id){
  if(!requireAdmin(req, res))return;
  try{
    const items=await readUserFeedback();
    const index=items.findIndex((item)=>item.id===id);
    if(index===-1)return sendJson(res, 404, {error:'Feedback not found.'});
    items[index]={...items[index], status:'reviewed', reviewedAt:new Date().toISOString()};
    const feedback=await writeUserFeedback(items);
    sendJson(res, 200, {ok:true, feedback});
  }
  catch(error){
    sendJson(res, error.status||400, {error:friendlySupabaseError(error)||error.message||'Could not update feedback.'});
  }
}
async function replyAdminFeedback(req, res, id){
  if(!requireAdmin(req, res))return;
  try{
    const raw=await readBody(req, 32*1024);
    const payload=JSON.parse(raw||'{}');
    const reply=cleanLongSystemText(payload.reply||payload.message||'', 1200);
    if(reply.length<2)return sendJson(res, 400, {error:'Reply must be at least 2 characters.'});
    const items=await readUserFeedback();
    const index=items.findIndex((item)=>item.id===id);
    if(index===-1)return sendJson(res, 404, {error:'Feedback not found.'});
    const now=new Date().toISOString();
    items[index]={...items[index], reply, adminReply:reply, repliedAt:now, status:'reviewed', reviewedAt:now};
    const feedback=await writeUserFeedback(items);
    sendJson(res, 200, {ok:true, feedback, item:items[index]});
  }
  catch(error){
    sendJson(res, error.status||400, {error:friendlySupabaseError(error)||error.message||'Could not reply to feedback.'});
  }
}
async function handleSupabaseUpload(req, res, user){
  let storagePath='';
  try{
    const raw=await readBody(req, MAX_UPLOAD_BODY_BYTES);
    const{
      title, creator, creatorId, authType, mime, ext, buffer
    }
    =await parseImagePayload(raw);
    if(creatorId&&creatorId!==user.creatorId){
      const mismatch=new Error('Login required.');
      mismatch.status=401;
      throw mismatch;
    }
    const ownerId=user.creatorId;
    const ownerName=user.creatorName||creator||'The Void';
    const ownerAuthType=user.authType||'password';
    const id=crypto.randomUUID();
    storagePath=`uploads/${id}.${ext}`;
    const upload=await supabase.storage.from(SUPABASE_BUCKET).upload(storagePath, buffer, {contentType:mime, cacheControl:'31536000', upsert:false, });
    if(upload.error)throw upload.error;
    const publicUrlResult=supabase.storage.from(SUPABASE_BUCKET).getPublicUrl(storagePath);
    const publicUrl=publicUrlResult?.data?.publicUrl;
    if(!publicUrl)throw new Error('Could not create public URL for uploaded wallpaper.');
    const now=new Date().toISOString();
    const insert=await supabase.from('wallpapers').insert({id, title, creator:ownerName, creator_id:ownerId, auth_type:ownerAuthType, storage_path:storagePath, public_url:publicUrl, mime, status:'pending', created_at:now, approved_at:null, updated_at:now, });
    if(insert.error)throw insert.error;
    clearApprovedWallpapersCache();
    queuePendingWallpaperAdminEmail(req, {id, title, creator:ownerName, creatorId:ownerId, mime, createdAt:now});
    sendJson(res, 201, {ok:true, message:'Wallpaper submitted for approval.'});
  }
  catch(error){
    if(storagePath){
      try{
        await supabase.storage.from(SUPABASE_BUCKET).remove([storagePath]);
      }
      catch{
      }
    }
    sendJson(res, error.status||400, {error:friendlySupabaseError(error)||'Upload failed.'});
  }
}
async function handleLocalUpload(req, res, user){
  let savedFilePath='';
  try{
    const raw=await readBody(req, MAX_UPLOAD_BODY_BYTES);
    const{
      title, creator, creatorId, authType, mime, ext, buffer
    }
    =await parseImagePayload(raw);
    if(creatorId&&creatorId!==user.creatorId){
      const mismatch=new Error('Login required.');
      mismatch.status=401;
      throw mismatch;
    }
    const ownerId=user.creatorId;
    const ownerName=user.creatorName||creator||'The Void';
    const ownerAuthType=user.authType||'password';
    const id=crypto.randomUUID();
    const filename=`${id}.${ext}`;
    savedFilePath=path.join(LOCAL_UPLOAD_DIR, filename);
    writeFileAtomic(savedFilePath, buffer);
    const now=new Date().toISOString();
    await mutateLocalDb((db)=>{db.wallpapers.unshift({id, title, creator:ownerName, creatorId:ownerId, authType:ownerAuthType, filename, mime, status:'pending', createdAt:now, approvedAt:null, updatedAt:now, }); });
    queuePendingWallpaperAdminEmail(req, {id, title, creator:ownerName, creatorId:ownerId, mime, createdAt:now});
    sendJson(res, 201, {ok:true, message:'Wallpaper submitted for approval.'});
  }
  catch(error){
    if(savedFilePath&&fs.existsSync(savedFilePath)){
      try{
        fs.unlinkSync(savedFilePath);
      }
      catch{
      }
    }
    sendJson(res, error.status||400, {error:error.message||'Upload failed.'});
  }
}
async function listApproved(req, res){
  if(USE_SUPABASE){
    if(setupError)return sendJson(res, 500, {error:setupError, setupRequired:true, requiredEnv:['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_BUCKET', 'THE_VOID_ADMIN_PASSWORD']});
    return listSupabaseApproved(res);
  }
  if(!(await ensureBackendReady(res)))return;
  return listLocalApproved(res);
}
async function listSupabaseApproved(res){
  try{
    const now=Date.now();
    if(approvedWallpapersCache&&now-approvedWallpapersCacheAt<APPROVED_WALLPAPER_CACHE_MS){
      return sendJson(res, 200, {wallpapers:approvedWallpapersCache}, {'Cache-Control':'public, max-age=10, stale-while-revalidate=60'});
    }
    const result=await supabase .from('wallpapers').select('id,title,creator,creator_id,auth_type,storage_path,public_url,mime,status,created_at,approved_at,updated_at').eq('status', 'approved').order('created_at', {ascending:false});
    if(result.error)throw result.error;
    const wallpapers=(result.data||[]).map(rowToItem).map(publicWallpaperDto);
    approvedWallpapersCache=wallpapers;
    approvedWallpapersCacheAt=now;
    sendJson(res, 200, {wallpapers}, {'Cache-Control':'public, max-age=10, stale-while-revalidate=60'});
  }
  catch(error){
    if(approvedWallpapersCache){
      return sendJson(res, 200, {wallpapers:approvedWallpapersCache, stale:true}, {'Cache-Control':'public, max-age=5'});
    }
    sendJson(res, 500, {error:friendlySupabaseError(error)||'Could not load wallpapers.'});
  }
}
function listLocalApproved(res){
  const db=readLocalDb();
  const wallpapers=db.wallpapers .filter((item)=>item.status==='approved').map((item)=>publicWallpaperDto({id:item.id, title:item.title, creator:item.creator, creatorId:item.creatorId, mime:item.mime, createdAt:item.createdAt, approvedAt:item.approvedAt, }));
  sendJson(res, 200, {wallpapers});
}
async function serveMedia(req, res, id){
  if(!(await ensureBackendReady(res)))return;
  if(USE_SUPABASE)return serveSupabaseMedia(req, res, id);
  return serveLocalMedia(req, res, id);
}
async function serveSupabaseMedia(req, res, id, asDownload=false){
  try{
    const result=await supabase .from('wallpapers').select('id,title,creator,creator_id,auth_type,storage_path,public_url,mime,status').eq('id', id).maybeSingle();
    if(result.error)throw result.error;
    const item=result.data?rowToItem(result.data):null;
    if(!item||(item.status!=='approved'&&!isAdmin(req))){
      res.writeHead(404, {'Content-Type':'text/plain; charset=utf-8'});
      res.end('Not found');
      return;
    }
    const variant=asDownload?'original':wallpaperVariantFromRequest(req);
    const storagePath=variant==='thumb'?wallpaperVariantStoragePath(item.id, 'thumb'):variant==='preview'?wallpaperVariantStoragePath(item.id, 'preview'):item.storagePath;
    let file=await supabase.storage.from(SUPABASE_BUCKET).download(storagePath);
    let responseMime=variant==='original'?item.mime:'image/webp';
    if(file.error&&variant!=='original'){
      file=await supabase.storage.from(SUPABASE_BUCKET).download(item.storagePath);
      responseMime=item.mime;
    }
    if(file.error)throw file.error;
    const arrayBuffer=await file.data.arrayBuffer();
    const buffer=Buffer.from(arrayBuffer);
    if(asDownload){
      return sendOriginalWallpaperDownload(res, item, buffer, responseMime||item.mime);
    }
    res.writeHead(200, {'Content-Type':responseMime||'application/octet-stream', 'Content-Length':buffer.length, 'Cache-Control':item.status==='approved'?'public, max-age=86400':'no-store', 'Content-Disposition':`inline; filename="${safeDownloadName(item.title)}.${extForMime(responseMime||item.mime) || 'jpg'}"`, });
    res.end(buffer);
  }
  catch(error){
    res.writeHead(404, {'Content-Type':'text/plain; charset=utf-8'});
    res.end(friendlySupabaseError(error)||'Not found');
  }
}
function redirectSupabaseOriginalDownload(res, item){
  if(!item?.storagePath)return false;
  const publicUrl=item.publicUrl||supabase.storage.from(SUPABASE_BUCKET).getPublicUrl(item.storagePath)?.data?.publicUrl||'';
  if(!publicUrl)return false;
  try{
    const responseMime=item.mime||mimeForExt(path.extname(item.storagePath));
    const filename=`${safeDownloadName(item.title)}.${extForMime(responseMime) || path.extname(item.storagePath).replace(/^./, '') || 'jpg'}`;
    const url=new URL(publicUrl);
    url.searchParams.set('download', filename);
    url.searchParams.set('t', String(Date.now()));
    res.writeHead(302, {'Location':url.toString(), 'Cache-Control':'no-store, max-age=0', 'Pragma':'no-cache'});
    res.end();
    return true;
  }
  catch{
    return false;
  }
}
function getLocalMediaFilePath(item){
  const filename=path.basename(String(item.filename||''));
  if(!filename)return '';
  const persisted=path.join(LOCAL_UPLOAD_DIR, filename);
  if(fs.existsSync(persisted))return persisted;
  const bundled=path.join(BUNDLED_UPLOAD_DIR, filename);
  if(fs.existsSync(bundled))return bundled;
  return persisted;
}
async function ensureLocalWallpaperVariants(overwrite=false){
  if(!sharp)return;
  fs.mkdirSync(path.join(LOCAL_VARIANT_DIR, 'thumbs'), {recursive:true});
  fs.mkdirSync(path.join(LOCAL_VARIANT_DIR, 'previews'), {recursive:true});
  const db=readLocalDb();
  for(const item of db.wallpapers||[]){
    if(item.status!=='approved'){
      removeLocalWallpaperVariants(item.id);
      continue;
    }
    const source=getLocalMediaFilePath(item);
    if(!item.id||!source||!fs.existsSync(source))continue;
    try{
      await generateLocalWallpaperVariants(item.id, fs.readFileSync(source), overwrite);
    }
    catch(error){
      console.warn('Could not generate variants for', item.id, error.message||error);
    }
  }
}
function copyMissingBundledVariantsToLocal(){
  if(!fs.existsSync(BUNDLED_VARIANT_DIR))return;
  for(const variant of ['thumbs', 'previews']){
    const sourceDir=path.join(BUNDLED_VARIANT_DIR, variant);
    const targetDir=path.join(LOCAL_VARIANT_DIR, variant);
    if(!fs.existsSync(sourceDir))continue;
    fs.mkdirSync(targetDir, {recursive:true});
    for(const filename of fs.readdirSync(sourceDir)){
      if(path.extname(filename).toLowerCase()!=='.webp')continue;
      const source=path.join(sourceDir, filename);
      const target=path.join(targetDir, filename);
      if(!fs.existsSync(target))fs.copyFileSync(source, target);
    }
  }
}
function getLocalVariantFilePath(id, variant){
  const folder=variant==='preview'?'previews':'thumbs';
  return path.join(LOCAL_VARIANT_DIR, folder, String(id)+'.webp');
}
function removeLocalWallpaperVariants(id){
  if(!id)return;
  for(const variant of ['thumb', 'preview']){
    const filePath=getLocalVariantFilePath(id, variant);
    if(fs.existsSync(filePath)){
      try{
        fs.unlinkSync(filePath);
      }
      catch{
      }
    }
  }
}
function wallpaperVariantFromRequest(req){
  try{
    const url=new URL(req.url, 'http://'+(req.headers.host||'localhost'));
    const value=String(url.searchParams.get('variant')||'').toLowerCase();
    return value==='preview'||value==='thumb'?value:'original';
  }
  catch{
    return 'original';
  }
}
function wallpaperVariantStoragePath(id, variant){
  const folder=variant==='preview'?'previews':'thumbs';
  return folder+'/'+String(id)+'.webp';
}
function isWallpaperVariantStoragePath(storagePath){
  return /^(thumbs|previews)\//.test(String(storagePath||''));
}
function wallpaperVariantUrlForItem(item, variant){
  if(!item?.id)return mediaUrlForItem(item);
  return '/media/'+encodeURIComponent(item.id)+'?variant='+(variant==='preview'?'preview':'thumb');
}
async function makeWallpaperVariantBuffer(buffer, size, quality){
  if(!sharp)return null;
  return sharp(buffer, {failOn:'none'}).rotate().resize({width:size.width, height:size.height, fit:'cover', position:'center'}).webp({quality, effort:4}).toBuffer();
}
function sendOriginalWallpaperDownload(res, item, buffer, mime=''){
  const responseMime=mime||item.mime||'application/octet-stream';
  res.writeHead(200, originalWallpaperDownloadHeaders(item, buffer.length, responseMime));
  res.end(buffer);
}
function originalWallpaperDownloadHeaders(item, contentLength, mime='', fallbackExt='jpg'){
  const originalMime=mime||item?.mime||'';
  const ext=extForMime(originalMime)||fallbackExt||'jpg';
  const filename=`${safeDownloadName(item?.title)}.${ext}`;
  return{
    'Content-Type':'application/octet-stream',
    'Content-Length':contentLength,
    'Cache-Control':'no-store, no-cache, max-age=0',
    'Pragma':'no-cache',
    'X-Content-Type-Options':'nosniff',
    'X-Original-Content-Type':originalMime||'application/octet-stream',
    'Content-Disposition':`attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
  };
}
async function generateLocalWallpaperVariants(id, buffer, overwrite=false){
  if(!sharp||!id||!buffer)return;
  fs.mkdirSync(path.join(LOCAL_VARIANT_DIR, 'thumbs'), {recursive:true});
  fs.mkdirSync(path.join(LOCAL_VARIANT_DIR, 'previews'), {recursive:true});
  const thumbPath=getLocalVariantFilePath(id, 'thumb');
  const previewPath=getLocalVariantFilePath(id, 'preview');
  if(overwrite||!fs.existsSync(thumbPath)){
    const thumb=await makeWallpaperVariantBuffer(buffer, WALLPAPER_THUMB_SIZE, 72);
    if(thumb)writeFileAtomic(thumbPath, thumb);
  }
  if(overwrite||!fs.existsSync(previewPath)){
    const preview=await makeWallpaperVariantBuffer(buffer, WALLPAPER_PREVIEW_SIZE, 78);
    if(preview)writeFileAtomic(previewPath, preview);
  }
}
async function uploadSupabaseWallpaperVariants(id, buffer, upsert=false){
  if(!sharp||!supabase||!id||!buffer)return;
  const variants=[{name:'thumb', size:WALLPAPER_THUMB_SIZE, quality:72}, {name:'preview', size:WALLPAPER_PREVIEW_SIZE, quality:78}];
  for(const variant of variants){
    const out=await makeWallpaperVariantBuffer(buffer, variant.size, variant.quality);
    if(!out)continue;
    const upload=await supabase.storage.from(SUPABASE_BUCKET).upload(wallpaperVariantStoragePath(id, variant.name), out, {contentType:'image/webp', cacheControl:'31536000', upsert});
    if(upload.error)throw upload.error;
  }
}
async function serveLocalMedia(req, res, id, asDownload=false){
  const db=readLocalDb();
  const item=db.wallpapers.find((entry)=>entry.id===id);
  if(!item||(item.status!=='approved'&&!isAdmin(req))){
    res.writeHead(404, {'Content-Type':'text/plain; charset=utf-8'});
    res.end('Not found');
    return;
  }
  const variant=asDownload?'original':wallpaperVariantFromRequest(req);
  const originalPath=getLocalMediaFilePath(item);
  const variantPath=variant==='thumb'?getLocalVariantFilePath(item.id, 'thumb'):variant==='preview'?getLocalVariantFilePath(item.id, 'preview'):'';
  const filePath=variantPath&&fs.existsSync(variantPath)?variantPath:originalPath;
  if(!filePath||!fs.existsSync(filePath)){
    res.writeHead(404, {'Content-Type':'text/plain; charset=utf-8'});
    res.end('Not found');
    return;
  }
  const responseMime=variantPath&&filePath===variantPath?'image/webp':item.mime||mimeForExt(path.extname(filePath));
  if(asDownload){
    const stat=fs.statSync(filePath);
    res.writeHead(200, originalWallpaperDownloadHeaders(item, stat.size, responseMime, path.extname(filePath).replace(/^./, '')||'jpg'));
    return fs.createReadStream(filePath).pipe(res);
  }
  res.writeHead(200, {'Content-Type':responseMime, 'Cache-Control':item.status==='approved'?'public, max-age=86400':'no-store', 'Content-Disposition':`inline; filename="${safeDownloadName(item.title)}.${extForMime(responseMime) || path.extname(filePath).replace(/^./, '') || 'jpg'}"`, });
  fs.createReadStream(filePath).pipe(res);
}
function safeDownloadName(value){
  return String(value||'wallpaper').trim().replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 80)||'wallpaper';
}
async function downloadWallpaper(req, res, id){
  const user=await requireCreator(req, res);
  if(!user)return;
  if(USE_SUPABASE)return serveSupabaseMedia(req, res, id, true);
  return serveLocalMedia(req, res, id, true);
}
async function adminDownloadWallpaper(req, res, id){
  if(!requireAdmin(req, res))return;
  if(USE_SUPABASE)return serveSupabaseMedia(req, res, id, true);
  return serveLocalMedia(req, res, id, true);
}
async function login(req, res){
  try{
    const raw=await readBody(req, 16*1024);
    const{
      password, browserKey
    }
    =JSON.parse(raw||'{}');
    const adminDeviceHash=adminLoginDeviceHash(req, browserKey);
    const locked=await getAdminLoginLock(adminDeviceHash);
    if(locked){
      const retryAfterSeconds=retryAfterSecondsUntil(locked.lockedUntilMs);
      return sendJson(res, 423, lockoutPayload(`Too many wrong admin login attempts from this device. Try again in ${formatHours(retryAfterSeconds)}.`, locked.lockedUntilMs));
    }
    const ok=safeCompare(sha256(password||''), configuredHash);
    if(!ok){
      const failure=await recordAdminLoginFailure(adminDeviceHash);
      if(failure.locked){
        const retryAfterSeconds=retryAfterSecondsUntil(failure.lockedUntilMs);
        return sendJson(res, 423, lockoutPayload(`Wrong admin password entered too many times. Admin login is locked on this device for ${formatHours(retryAfterSeconds)}.`, failure.lockedUntilMs));
      }
      return sendJson(res, 401, {error:`Invalid password. ${failure.remainingAttempts} attempt left before admin login locks on this device for 3 hours.`, remainingAttempts:failure.remainingAttempts, });
    }
    await clearAdminLoginFailure(adminDeviceHash);
    const token=crypto.randomBytes(32).toString('base64url');
    sessions.set(token, {expiresAt:Date.now()+ SESSION_TTL_MS});
    const secureCookie=req.headers['x-forwarded-proto']==='https'||req.socket.encrypted?'; Secure':'';
    sendJson(res, 200, {ok:true}, {'Set-Cookie':`${ADMIN_SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}${secureCookie}`, });
  }
  catch(error){
    sendJson(res, error.status||400, {error:friendlySupabaseError(error)||error.message||'Login failed.'});
  }
}
function logout(_req, res){
  sendJson(res, 200, {ok:true}, {'Set-Cookie':`${ADMIN_SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`, });
}
function requireAdmin(req, res){
  if(!isAdmin(req)){
    sendJson(res, 401, {error:'Admin login required.'});
    return false;
  }
  return true;
}
async function listPending(req, res){
  if(!requireAdmin(req, res))return;
  if(!(await ensureBackendReady(res)))return;
  if(USE_SUPABASE)return listSupabasePending(res);
  return listLocalPending(res);
}
async function listSupabasePending(res){
  try{
    const result=await supabase .from('wallpapers').select('id,title,creator,creator_id,auth_type,storage_path,public_url,mime,status,created_at,approved_at,updated_at').eq('status', 'pending').order('created_at', {ascending:false});
    if(result.error)throw result.error;
    const pending=(result.data||[]).map(rowToItem).map((item)=>({id:item.id, title:item.title, creator:item.creator||'The Void', createdAt:item.createdAt, mediaUrl:mediaUrlForItem(item), thumbUrl:thumbUrlForItem(item), previewUrl:previewUrlForItem(item), }));
    sendJson(res, 200, {pending});
  }
  catch(error){
    sendJson(res, 500, {error:friendlySupabaseError(error)||'Could not load pending wallpapers.'});
  }
}
function listLocalPending(res){
  const db=readLocalDb();
  const pending=db.wallpapers .filter((item)=>item.status==='pending').map((item)=>({id:item.id, title:item.title, creator:item.creator||'The Void', createdAt:item.createdAt, mediaUrl:`/media/${item.id}`, thumbUrl:`/media/${item.id}?variant=thumb`, previewUrl:`/media/${item.id}?variant=preview`, }));
  sendJson(res, 200, {pending});
}
async function storageStatus(req, res){
  if(!requireAdmin(req, res))return;
  await ensureBackendReady({writeHead(){}, end(){}}).catch(()=>{});
  sendJson(res, 200, {mode:USE_SUPABASE?'supabase':'local', ready:!setupError, error:setupError||null, renderDetected:isRender(), supabaseUrlConfigured:Boolean(SUPABASE_URL), serviceRoleKeyConfigured:Boolean(SUPABASE_SERVICE_ROLE_KEY), anonKeyConfigured:Boolean(SUPABASE_ANON_KEY), googleAuthEnabled:googleAuthConfigured(), bucket:SUPABASE_BUCKET, profileBucket:SUPABASE_PROFILE_BUCKET, autoSyncStorage:AUTO_SYNC_STORAGE, enforceOneAccountPerIp:false, localDataDir:USE_SUPABASE?null:LOCAL_DATA_DIR, });
}
async function listAdminUsers(req, res){
  if(!requireAdmin(req, res))return;
  if(!(await ensureBackendReady(res)))return;
  if(USE_SUPABASE)return listSupabaseAdminUsers(req, res);
  return listLocalAdminUsers(req, res);
}
function countWallpapersByCreator(rows){
  const counts=new Map();
  for(const row of rows||[]){
    const creatorId=row.creator_id||row.creatorId||'';
    if(!creatorId)continue;
    const status=row.status||'unknown';
    const current=counts.get(creatorId)||{
      total:0, approved:0, pending:0, rejected:0
    };
    current.total +=1;
    if(status==='approved')current.approved +=1;
    if(status==='pending')current.pending +=1;
    if(status==='rejected')current.rejected +=1;
    counts.set(creatorId, current);
  }
  return counts;
}
async function listSupabaseAdminUsers(req, res){
  try{
    const url=new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const query=normalizeUsername(url.searchParams.get('q')||'');
    let request=supabase .from('users').select(USER_SELECT_COLUMNS).limit(50);
    if(query){
      request=request.ilike('creator_name_key', `${query}%`).order('creator_name', {ascending:true});
    }
    else{
      request=request.order('created_at', {ascending:false});
    }
    const result=await request;
    if(result.error)throw result.error;
    const users=(result.data||[]).map(normalizeUserRow).filter(Boolean);
    const ids=users.map((user)=>user.creatorId).filter(Boolean);
    let counts=new Map();
    if(ids.length){
      const wallpaperResult=await supabase .from('wallpapers').select('creator_id,status').in('creator_id', ids);
      if(wallpaperResult.error)throw wallpaperResult.error;
      counts=countWallpapersByCreator(wallpaperResult.data||[]);
    }
    const uploadLimitExemptions=await readUploadLimitExemptions();
    const badgeOverrides=await readBadgeOverrides();
    sendJson(res, 200, {users:users.map((user)=>adminUserDto(user, counts.get(user.creatorId), uploadLimitExemptions[user.creatorId], badgeOverrides[user.creatorId]||'auto'))});
  }
  catch(error){
    sendJson(res, 400, {error:friendlySupabaseError(error)||error.message||'Could not load users.'});
  }
}
async function listLocalAdminUsers(req, res){
  try{
    const url=new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const query=normalizeUsername(url.searchParams.get('q')||'');
    const localUsers=readLocalUsers().map(normalizeUserRow).filter(Boolean);
    const db=readLocalDb();
    const counts=countWallpapersByCreator(db.wallpapers||[]);
    const filteredUsers=localUsers .filter((user)=>!query||normalizeUsername(user.creatorName).startsWith(query)).sort((a, b)=>{if(query)return String(a.creatorName||'').localeCompare(String(b.creatorName||'')); return String(b.createdAt||'').localeCompare(String(a.createdAt||'')); }).slice(0, 50);
    const uploadLimitExemptions=await readUploadLimitExemptions();
    const badgeOverrides=await readBadgeOverrides();
    const users=filteredUsers.map((user)=>adminUserDto(user, counts.get(user.creatorId), user.unlimitedUploads||uploadLimitExemptions[user.creatorId], badgeOverrides[user.creatorId]||'auto'));
    sendJson(res, 200, {users});
  }
  catch(error){
    sendJson(res, error.status||400, {error:error.message||'Could not load users.'});
  }
}
async function updateAdminUserUploadLimit(req, res, creatorId){
  if(!requireAdmin(req, res))return;
  if(!(await ensureBackendReady(res)))return;
  const id=String(creatorId||'').trim();
  if(!id)return sendJson(res, 400, {error:'User ID is required.'});
  try{
    const raw=await readBody(req, 32*1024);
    const payload=JSON.parse(raw||'{}');
    const unlimited=Boolean(payload.unlimited);
    const user=await findUserById(id);
    if(!user)return sendJson(res, 404, {error:'User not found.'});
    const exemptions=await readUploadLimitExemptions();
    if(unlimited)exemptions[id]=true;
    else delete exemptions[id];
    if(!USE_SUPABASE){
      await mutateLocalUsers((users)=>{const item=users.find((entry)=>entry.creatorId===id); if(item){item.unlimitedUploads=unlimited; item.updatedAt=new Date().toISOString(); }});
    }
    await writeUploadLimitExemptions(exemptions);
    sendJson(res, 200, {ok:true, creatorId:id, unlimitedUploads:unlimited, uploadLimitText:unlimited?'Unlimited uploads':`${WALLPAPER_UPLOAD_LIMIT_PER_WINDOW} uploads / 24h`, message:unlimited?`@${user.creatorName} can now upload without the 24h limit.`:`@${user.creatorName} is back to the normal upload limit.`, });
  }
  catch(error){
    sendJson(res, error.status||400, {error:friendlySupabaseError(error)||error.message||'Could not update upload limit.'});
  }
}
async function updateAdminUserBadge(req, res, creatorId){
  if(!requireAdmin(req, res))return;
  if(!(await ensureBackendReady(res)))return;
  const id=String(creatorId||'').trim();
  if(!id)return sendJson(res, 400, {error:'User ID is required.'});
  try{
    const raw=await readBody(req, 32*1024);
    const payload=JSON.parse(raw||'{}');
    const badgeOverride=normalizeBadgeOverride(payload.badge||payload.badgeOverride);
    const user=await findUserById(id);
    if(!user)return sendJson(res, 404, {error:'User not found.'});
    const overrides=await readBadgeOverrides();
    if(badgeOverride==='auto')delete overrides[id];
    else overrides[id]=badgeOverride;
    await writeBadgeOverrides(overrides);
    const approvedCount=await getCreatorApprovedWallpaperCount(id);
    const activeBadge=creatorBadgeForCount(approvedCount, badgeOverride);
    sendJson(res, 200, {ok:true, creatorId:id, badge:activeBadge, badgeOverride, automaticBadge:creatorBadgeForCount(approvedCount, 'auto'), message:`@${user.creatorName} badge set to ${badgeOverride==='auto'?'automatic':badgeOverride==='none'?'none':activeBadge?.label||'manual'}.`, });
  }
  catch(error){
    sendJson(res, error.status||400, {error:friendlySupabaseError(error)||error.message||'Could not update badge.'});
  }
}
async function deleteAdminUser(req, res, creatorId){
  if(!requireAdmin(req, res))return;
  if(!(await ensureBackendReady(res)))return;
  const id=String(creatorId||'').trim();
  if(!id)return sendJson(res, 400, {error:'User ID is required.'});
  if(USE_SUPABASE)return deleteSupabaseAdminUser(res, id);
  return deleteLocalAdminUser(res, id);
}
async function deleteSupabaseAdminUser(res, creatorId){
  try{
    const userResult=await supabase .from('users').select(USER_SELECT_COLUMNS).eq('creator_id', creatorId).maybeSingle();
    if(userResult.error)throw userResult.error;
    const user=normalizeUserRow(userResult.data);
    if(!user)return sendJson(res, 404, {error:'User not found.'});
    const wallpaperResult=await supabase .from('wallpapers').select('id,storage_path,status').eq('creator_id', creatorId);
    if(wallpaperResult.error)throw wallpaperResult.error;
    const wallpapers=wallpaperResult.data||[];
    const wallpaperPaths=wallpapers.flatMap(supabaseWallpaperStoragePaths);
    const deleteWallpapers=await supabase .from('wallpapers').delete().eq('creator_id', creatorId);
    if(deleteWallpapers.error)throw deleteWallpapers.error;
    const deleteUser=await supabase .from('users').delete().eq('creator_id', creatorId);
    if(deleteUser.error)throw deleteUser.error;
    const storageErrors=[];
    storageErrors.push(...await removeStorageObjects(SUPABASE_BUCKET, wallpaperPaths));
    if(user.profilePicPath){
      storageErrors.push(...await removeStorageObjects(SUPABASE_PROFILE_BUCKET, [user.profilePicPath]));
    }
    await clearUserSessionsForCreator(creatorId);
    await clearBadgeOverrideForCreator(creatorId);
    const payload={
      ok:true, message:`Deleted @${user.creatorName} completely. Their username, profile, and wallpapers were removed.`, deletedUser:adminUserDto(user, countWallpapersByCreator(wallpapers).get(creatorId)), deletedWallpapers:wallpapers.length, clearedSignupLock:Boolean(user.signupIpHash||user.browserKeyHash),
    };
    if(storageErrors.length){
      payload.warning='User was deleted, but some Storage files may need manual cleanup.';
      payload.storageErrors=storageErrors;
    }
    sendJson(res, 200, payload);
  }
  catch(error){
    sendJson(res, error.status||400, {error:friendlySupabaseError(error)||error.message||'Could not delete user.'});
  }
}
async function deleteLocalAdminUser(res, creatorId){
  try{
    let removedUser=null;
    const removedWallpapers=await mutateLocalDb((db)=>{const removed=db.wallpapers.filter((item)=>item.creatorId===creatorId); db.wallpapers=db.wallpapers.filter((item)=>item.creatorId!==creatorId); const stillReferenced=new Set(db.wallpapers.map((item)=>path.basename(String(item.filename||''))).filter(Boolean)); return{files:removed.map((item)=>path.basename(String(item.filename||''))).filter((filename)=>filename&&!stillReferenced.has(filename)), ids:removed.map((item)=>item.id).filter(Boolean)}; });
    removedUser=await mutateLocalUsers((users)=>{const index=users.findIndex((entry)=>entry.creatorId===creatorId); if(index<0){const error=new Error('User not found.'); error.status=404; throw error; }const[removed]=users.splice(index, 1); return normalizeUserRow(removed); });
    for(const filename of removedWallpapers.files){
      const filePath=path.join(LOCAL_UPLOAD_DIR, path.basename(filename));
      if(fs.existsSync(filePath)){
        try{
          fs.unlinkSync(filePath);
        }
        catch{
        }
      }
    }
    for(const wallpaperId of removedWallpapers.ids)removeLocalWallpaperVariants(wallpaperId);
    if(removedUser?.profilePicPath){
      const avatarPath=path.join(LOCAL_PROFILE_PIC_DIR, path.basename(removedUser.profilePicPath));
      if(fs.existsSync(avatarPath)){
        try{
          fs.unlinkSync(avatarPath);
        }
        catch{
        }
      }
    }
    await clearUserSessionsForCreator(creatorId);
    await clearBadgeOverrideForCreator(creatorId);
    sendJson(res, 200, {ok:true, message:`Deleted @${removedUser.creatorName} completely. Their username, profile, and wallpapers were removed.`, deletedUser:adminUserDto(removedUser, {total:removedWallpapers.ids.length}), deletedWallpapers:removedWallpapers.ids.length, clearedSignupLock:Boolean(removedUser.signupIpHash||removedUser.browserKeyHash), });
  }
  catch(error){
    sendJson(res, error.status||400, {error:error.message||'Could not delete user.'});
  }
}
async function cleanupAdminUserLocks(req, res){
  if(!requireAdmin(req, res))return;
  if(!(await ensureBackendReady(res)))return;
  if(USE_SUPABASE)return cleanupSupabaseAdminUserLocks(res);
  return cleanupLocalAdminUserLocks(res);
}
async function cleanupSupabaseAdminUserLocks(res){
  try{
    const usersResult=await supabase .from('users').select('creator_id,creator_name,auth_type,password_hash,password_salt,signup_ip_hash,browser_key_hash');
    if(usersResult.error)throw usersResult.error;
    const rows=usersResult.data||[];
    const validCreatorIds=new Set(rows.map((row)=>row.creator_id).filter(Boolean));
    const staleRows=rows.filter((row)=>!isActiveSignupLockUser(row)&&(row.signup_ip_hash||row.browser_key_hash));
    let clearedRows=0;
    for(const row of staleRows){
      const result=await supabase .from('users').update({signup_ip_hash:null, browser_key_hash:null}).eq('creator_id', row.creator_id);
      if(result.error)throw result.error;
      clearedRows +=1;
    }
    const sessionsByCreator=await readActiveUserSessions();
    let removedSessions=0;
    for(const creatorId of Object.keys(sessionsByCreator)){
      if(!validCreatorIds.has(creatorId)){
        delete sessionsByCreator[creatorId];
        removedSessions +=1;
      }
    }
    if(removedSessions)await writeActiveUserSessions(sessionsByCreator);
    sendJson(res, 200, {ok:true, message:'Cleaned stale legacy signup/session locks.', clearedMalformedSignupRows:clearedRows, clearedOrphanedActiveSessions:removedSessions, });
  }
  catch(error){
    sendJson(res, error.status||400, {error:friendlySupabaseError(error)||error.message||'Could not clean stale locks.'});
  }
}
async function cleanupLocalAdminUserLocks(res){
  try{
    let clearedRows=0;
    const validCreatorIds=new Set();
    await mutateLocalUsers((users)=>{for(const user of users){if(user.creatorId)validCreatorIds.add(user.creatorId); if(!isActiveSignupLockUser(user)&&(user.signupIpHash||user.browserKeyHash)){user.signupIpHash=''; user.browserKeyHash=''; clearedRows +=1; }}});
    const sessionsByCreator=await readActiveUserSessions();
    let removedSessions=0;
    for(const creatorId of Object.keys(sessionsByCreator)){
      if(!validCreatorIds.has(creatorId)){
        delete sessionsByCreator[creatorId];
        removedSessions +=1;
      }
    }
    if(removedSessions)await writeActiveUserSessions(sessionsByCreator);
    sendJson(res, 200, {ok:true, message:'Cleaned stale legacy signup/session locks.', clearedMalformedSignupRows:clearedRows, clearedOrphanedActiveSessions:removedSessions, });
  }
  catch(error){
    sendJson(res, error.status||400, {error:error.message||'Could not clean stale locks.'});
  }
}
async function updateWallpaperDetails(req, res, id){
  if(!requireAdmin(req, res))return;
  if(!(await ensureBackendReady(res)))return;
  if(USE_SUPABASE)return updateSupabaseWallpaperDetails(req, res, id);
  return updateLocalWallpaperDetails(req, res, id);
}
async function parseDetailsPayload(req){
  const raw=await readBody(req, 32*1024);
  const payload=JSON.parse(raw||'{}');
  const title=String(payload.title||'').trim().slice(0, 80);
  const creator=String(payload.creator||'').trim().slice(0, 60);
  if(!title){
    const error=new Error('Wallpaper name is required.');
    error.status=400;
    throw error;
  }
  if(!creator){
    const error=new Error('Username is required.');
    error.status=400;
    throw error;
  }
  return{
    title, creator
  };
}
async function parseOwnerWallpaperPayload(req){
  const raw=await readBody(req, 32*1024);
  const payload=JSON.parse(raw||'{}');
  const title=String(payload.title||'').trim().slice(0, 80);
  if(!title){
    const error=new Error('Wallpaper name is required.');
    error.status=400;
    throw error;
  }
  return{
    title
  };
}
async function updateOwnWallpaperDetails(req, res, id){
  const user=await requireCreator(req, res);
  if(!user)return;
  if(!(await ensureBackendReady(res)))return;
  if(USE_SUPABASE)return updateOwnSupabaseWallpaperDetails(req, res, id, user);
  return updateOwnLocalWallpaperDetails(req, res, id, user);
}
async function updateOwnSupabaseWallpaperDetails(req, res, id, user){
  try{
    const{
      title
    }
    =await parseOwnerWallpaperPayload(req);
    const result=await supabase .from('wallpapers').update({title, updated_at:new Date().toISOString()}).eq('id', id).eq('creator_id', user.creatorId).select('id,title,creator,status').maybeSingle();
    if(result.error)throw result.error;
    if(!result.data)return sendJson(res, 404, {error:'Wallpaper not found.'});
    clearApprovedWallpapersCache();
    sendJson(res, 200, {ok:true, message:'Wallpaper updated.', wallpaper:result.data});
  }
  catch(error){
    sendJson(res, error.status||400, {error:friendlySupabaseError(error)||'Could not update wallpaper.'});
  }
}
async function updateOwnLocalWallpaperDetails(req, res, id, user){
  try{
    const{
      title
    }
    =await parseOwnerWallpaperPayload(req);
    const updated=await mutateLocalDb((db)=>{const item=db.wallpapers.find((entry)=>entry.id===id&&entry.creatorId===user.creatorId); if(!item){const error=new Error('Wallpaper not found.'); error.status=404; throw error; }item.title=title; item.updatedAt=new Date().toISOString(); return{id:item.id, title:item.title, creator:item.creator, status:item.status}; });
    sendJson(res, 200, {ok:true, message:'Wallpaper updated.', wallpaper:updated});
  }
  catch(error){
    sendJson(res, error.status||400, {error:error.message||'Could not update wallpaper.'});
  }
}
async function updateSupabaseWallpaperDetails(req, res, id){
  try{
    const{
      title, creator
    }
    =await parseDetailsPayload(req);
    const result=await supabase .from('wallpapers').update({title, creator, updated_at:new Date().toISOString()}).eq('id', id).select('id,title,creator').maybeSingle();
    if(result.error)throw result.error;
    if(!result.data)return sendJson(res, 404, {error:'Wallpaper not found.'});
    clearApprovedWallpapersCache();
    sendJson(res, 200, {ok:true, wallpaper:result.data});
  }
  catch(error){
    sendJson(res, error.status||400, {error:friendlySupabaseError(error)||'Could not update wallpaper details.'});
  }
}
async function updateLocalWallpaperDetails(req, res, id){
  try{
    const{
      title, creator
    }
    =await parseDetailsPayload(req);
    const updated=await mutateLocalDb((db)=>{const item=db.wallpapers.find((entry)=>entry.id===id); if(!item){const error=new Error('Wallpaper not found.'); error.status=404; throw error; }item.title=title; item.creator=creator; item.updatedAt=new Date().toISOString(); return{id:item.id, title:item.title, creator:item.creator}; });
    sendJson(res, 200, {ok:true, wallpaper:updated});
  }
  catch(error){
    sendJson(res, error.status||400, {error:error.message||'Could not update wallpaper details.'});
  }
}
async function moderate(req, res, id, status){
  if(!requireAdmin(req, res))return;
  if(!(await ensureBackendReady(res)))return;
  if(USE_SUPABASE)return moderateSupabase(req, res, id, status);
  return moderateLocal(req, res, id, status);
}
async function moderateSupabase(_req, res, id, status){
  try{
    if(!['approved', 'rejected'].includes(status))return sendJson(res, 400, {error:'Invalid status.'});
    const current=await supabase .from('wallpapers').select('id,storage_path,status').eq('id', id).maybeSingle();
    if(current.error)throw current.error;
    if(!current.data)return sendJson(res, 404, {error:'Wallpaper not found.'});
    if(status==='approved'&&current.data.storage_path){
      const source=await supabase.storage.from(SUPABASE_BUCKET).download(current.data.storage_path);
      if(source.error)throw source.error;
      const buffer=Buffer.from(await source.data.arrayBuffer());
      await uploadSupabaseWallpaperVariants(id, buffer, true);
    }
    const now=new Date().toISOString();
    const patch={
      status, approved_at:status==='approved'?now:null, updated_at:now,
    };
    const result=await supabase .from('wallpapers').update(patch).eq('id', id).select('id,storage_path,status').maybeSingle();
    if(result.error)throw result.error;
    if(status==='rejected'&&result.data.storage_path){
      await removeSupabaseWallpaperObjects(result.data);
    }
    clearApprovedWallpapersCache();
    sendJson(res, 200, {ok:true, status});
  }
  catch(error){
    sendJson(res, 400, {error:friendlySupabaseError(error)||'Moderation failed.'});
  }
}
async function moderateLocal(_req, res, id, status){
  try{
    if(!['approved', 'rejected'].includes(status))return sendJson(res, 400, {error:'Invalid status.'});
    const current=readLocalDb().wallpapers.find((entry)=>entry.id===id);
    if(!current){
      const error=new Error('Wallpaper not found.');
      error.status=404;
      throw error;
    }
    if(status==='approved'){
      const source=getLocalMediaFilePath(current);
      if(source&&fs.existsSync(source)){
        await generateLocalWallpaperVariants(id, fs.readFileSync(source), true);
      }
    }
    if(status==='rejected'){
      removeLocalWallpaperVariants(id);
    }
    await mutateLocalDb((db)=>{const item=db.wallpapers.find((entry)=>entry.id===id); if(!item){const error=new Error('Wallpaper not found.'); error.status=404; throw error; }item.status=status; item.approvedAt=status==='approved'?new Date().toISOString():null; item.updatedAt=new Date().toISOString(); });
    clearApprovedWallpapersCache();
    sendJson(res, 200, {ok:true, status});
  }
  catch(error){
    sendJson(res, error.status||400, {error:error.message||'Moderation failed.'});
  }
}
async function deleteWallpaper(req, res, id){
  if(!requireAdmin(req, res))return;
  if(!(await ensureBackendReady(res)))return;
  if(USE_SUPABASE)return deleteSupabaseWallpaper(res, id);
  return deleteLocalWallpaper(res, id);
}
async function deleteOwnWallpaper(req, res, id){
  const user=await requireCreator(req, res);
  if(!user)return;
  if(!(await ensureBackendReady(res)))return;
  if(USE_SUPABASE)return deleteOwnSupabaseWallpaper(res, id, user);
  return deleteOwnLocalWallpaper(res, id, user);
}
async function deleteOwnSupabaseWallpaper(res, id, user){
  try{
    const find=await supabase .from('wallpapers').select('id,storage_path,status').eq('id', id).eq('creator_id', user.creatorId).maybeSingle();
    if(find.error)throw find.error;
    if(!find.data)return sendJson(res, 404, {error:'Wallpaper not found.'});
    const removeRow=await supabase .from('wallpapers').delete().eq('id', id).eq('creator_id', user.creatorId);
    if(removeRow.error)throw removeRow.error;
    const storageErrors=await removeSupabaseWallpaperObjects(find.data);
    const payload={
      ok:true, message:'Wallpaper deleted.'
    };
    if(storageErrors.length)payload.warning='Wallpaper deleted, but the Storage file may need manual cleanup.';
    clearApprovedWallpapersCache();
    sendJson(res, 200, payload);
  }
  catch(error){
    sendJson(res, 400, {error:friendlySupabaseError(error)||'Could not delete wallpaper.'});
  }
}
async function deleteOwnLocalWallpaper(res, id, user){
  try{
    const removed=await mutateLocalDb((db)=>{const index=db.wallpapers.findIndex((entry)=>entry.id===id&&entry.creatorId===user.creatorId); if(index===-1){const error=new Error('Wallpaper not found.'); error.status=404; throw error; }const[item]=db.wallpapers.splice(index, 1); const stillReferenced=db.wallpapers.some((entry)=>entry.filename===item.filename); return{item, stillReferenced}; });
    const filename=path.basename(String(removed.item.filename||''));
    if(filename&&!removed.stillReferenced){
      const filePath=path.join(LOCAL_UPLOAD_DIR, filename);
      if(fs.existsSync(filePath)){
        try{
          fs.unlinkSync(filePath);
        }
        catch{
        }
      }
    }
    removeLocalWallpaperVariants(removed.item.id);
    clearApprovedWallpapersCache();
    sendJson(res, 200, {ok:true, message:'Wallpaper deleted.'});
  }
  catch(error){
    sendJson(res, error.status||400, {error:error.message||'Could not delete wallpaper.'});
  }
}
async function deleteSupabaseWallpaper(res, id){
  try{
    const find=await supabase .from('wallpapers').select('id,storage_path,status').eq('id', id).maybeSingle();
    if(find.error)throw find.error;
    if(!find.data)return sendJson(res, 404, {error:'Wallpaper not found.'});
    const now=new Date().toISOString();
    const markRejected=await supabase .from('wallpapers').update({status:'rejected', approved_at:null, updated_at:now}).eq('id', id);
    if(markRejected.error)throw markRejected.error;
    if(find.data.storage_path){
      try{
        await removeSupabaseWallpaperObjects(find.data);
      }
      catch{
      }
    }
    clearApprovedWallpapersCache();
    sendJson(res, 200, {ok:true, status:'rejected', message:'Wallpaper deleted from the app and moved to Rejected.'});
  }
  catch(error){
    sendJson(res, 400, {error:friendlySupabaseError(error)||'Delete failed.'});
  }
}
async function deleteLocalWallpaper(res, id){
  try{
    const removed=await mutateLocalDb((db)=>{const item=db.wallpapers.find((entry)=>entry.id===id); if(!item){const error=new Error('Wallpaper not found.'); error.status=404; throw error; }const previousFilename=item.filename; item.status='rejected'; item.approvedAt=null; item.updatedAt=new Date().toISOString(); const stillReferenced=db.wallpapers.some((entry)=>entry.id!==id&&entry.filename===previousFilename); return{item:{...item, filename:previousFilename}, stillReferenced}; });
    const filename=path.basename(String(removed.item.filename||''));
    if(filename&&!removed.stillReferenced){
      const filePath=path.join(LOCAL_UPLOAD_DIR, filename);
      if(fs.existsSync(filePath)){
        try{
          fs.unlinkSync(filePath);
        }
        catch{
        }
      }
    }
    removeLocalWallpaperVariants(removed.item.id);
    clearApprovedWallpapersCache();
    sendJson(res, 200, {ok:true, status:'rejected', message:'Wallpaper deleted from the app and moved to Rejected.'});
  }
  catch(error){
    sendJson(res, error.status||400, {error:error.message||'Delete failed.'});
  }
}
const server=http.createServer(async(req, res)=>{
  applySecurityHeaders(res);
  try{
    const url=new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname=decodeURIComponent(url.pathname);
    if(isStateChangingMethod(req.method)&&pathname.startsWith('/api/')&&!passesOriginCsrfCheck(req)){
      return sendJson(res, 403, {error:'Security check failed. Refresh the page and try again.'});
    }
    if(req.method==='POST'&&pathname==='/api/check-username')return checkUsername(req, res);
    if(req.method==='POST'&&pathname==='/api/create-user')return createUser(req, res);
    if(req.method==='POST'&&pathname==='/api/auth/signup')return signupUser(req, res);
    if(req.method==='POST'&&pathname==='/api/auth/signup/request-otp')return requestSignupOtp(req, res);
    if(req.method==='POST'&&pathname==='/api/auth/signup/resend-otp')return requestSignupOtp(req, res);
    if(req.method==='POST'&&pathname==='/api/auth/signup/verify-otp')return verifySignupOtp(req, res);
    if(req.method==='POST'&&pathname==='/api/auth/password-reset/request-otp')return requestPasswordResetOtp(req, res);
    if(req.method==='POST'&&pathname==='/api/auth/password-reset/verify-otp')return verifyPasswordResetOtp(req, res);
    if(req.method==='POST'&&pathname==='/api/auth/login')return loginUser(req, res);
    if(req.method==='GET'&&pathname==='/api/auth/config')return authConfig(req, res);
    if(req.method==='POST'&&pathname==='/api/auth/google')return handleGoogleAuth(req, res);
    if(req.method==='POST'&&pathname==='/api/auth/email/request-otp')return requestProfileEmailOtp(req, res);
    if(req.method==='POST'&&pathname==='/api/auth/email/verify-otp')return verifyProfileEmailOtp(req, res);
    if(req.method==='POST'&&pathname==='/api/auth/logout')return logoutUser(req, res);
    if(req.method==='POST'&&pathname==='/api/auth/change-password')return changePassword(req, res);
    if(req.method==='GET'&&pathname==='/api/profile')return getProfile(req, res);
    if(req.method==='POST'&&pathname==='/api/profile/avatar')return updateProfilePicture(req, res);
    if(req.method==='POST'&&pathname==='/api/profile/delete')return deleteProfile(req, res);
    if(req.method==='GET'&&pathname==='/api/notifications')return listSystemNotifications(req, res);
    if(req.method==='GET'&&pathname==='/api/feedback')return listUserFeedback(req, res);
    if(req.method==='POST'&&pathname==='/api/feedback')return submitUserFeedback(req, res);
    if(req.method==='GET'&&pathname==='/api/users/search')return searchUsers(req, res);
    const publicUserMatch=pathname.match(/^\/api\/users\/([^/]+)$/);
    if(req.method==='GET'&&publicUserMatch)return getPublicUserProfile(req, res, publicUserMatch[1]);
    const profileWallpaperUpdateMatch=pathname.match(/^\/api\/profile\/wallpapers\/([a-f0-9-]+)\/update$/);
    if(req.method==='POST'&&profileWallpaperUpdateMatch)return updateOwnWallpaperDetails(req, res, profileWallpaperUpdateMatch[1]);
    const profileWallpaperDeleteMatch=pathname.match(/^\/api\/profile\/wallpapers\/([a-f0-9-]+)\/delete$/);
    if(req.method==='POST'&&profileWallpaperDeleteMatch)return deleteOwnWallpaper(req, res, profileWallpaperDeleteMatch[1]);
    if(req.method==='POST'&&pathname==='/api/upload')return handleUpload(req, res);
    if(req.method==='GET'&&pathname==='/api/enhance-method')return getEnhanceMethodStatus(req, res);
    if(req.method==='POST'&&pathname==='/api/enhance-wallpaper')return handleEnhanceWallpaper(req, res);
    const enhanceReleaseMatch=pathname.match(/^\/api\/enhance-download\/([^/]+)\/release$/);
    if(req.method==='POST'&&enhanceReleaseMatch)return releaseEnhancedWallpaper(req, res, enhanceReleaseMatch[1]);
    const enhanceDownloadMatch=pathname.match(/^\/api\/enhance-download\/([^/]+)$/);
    if(req.method==='GET'&&enhanceDownloadMatch)return downloadEnhancedWallpaper(req, res, enhanceDownloadMatch[1]);
    if(req.method==='GET'&&pathname==='/api/wallpapers')return listApproved(req, res);
    if(req.method==='POST'&&pathname==='/api/admin/login')return login(req, res);
    if(req.method==='POST'&&pathname==='/api/admin/logout')return logout(req, res);
    if(req.method==='GET'&&pathname==='/api/admin/pending')return listPending(req, res);
    if(req.method==='GET'&&pathname==='/api/admin/storage')return storageStatus(req, res);
    if(req.method==='GET'&&pathname==='/api/admin/notifications')return listAdminNotifications(req, res);
    if(req.method==='POST'&&pathname==='/api/admin/notifications')return createAdminNotification(req, res);
    const adminNotificationUpdateMatch=pathname.match(/^\/api\/admin\/notifications\/([^/]+)\/update$/);
    if(req.method==='POST'&&adminNotificationUpdateMatch)return updateAdminNotification(req, res, adminNotificationUpdateMatch[1]);
    const adminNotificationDeleteMatch=pathname.match(/^\/api\/admin\/notifications\/([^/]+)\/delete$/);
    if(req.method==='POST'&&adminNotificationDeleteMatch)return deleteAdminNotification(req, res, adminNotificationDeleteMatch[1]);
    if(req.method==='GET'&&pathname==='/api/admin/feedback')return listAdminFeedback(req, res);
    const adminFeedbackReviewMatch=pathname.match(/^\/api\/admin\/feedback\/([^/]+)\/review$/);
    if(req.method==='POST'&&adminFeedbackReviewMatch)return reviewAdminFeedback(req, res, adminFeedbackReviewMatch[1]);
    const adminFeedbackReplyMatch=pathname.match(/^\/api\/admin\/feedback\/([^/]+)\/reply$/);
    if(req.method==='POST'&&adminFeedbackReplyMatch)return replyAdminFeedback(req, res, adminFeedbackReplyMatch[1]);
    if(req.method==='GET'&&pathname==='/api/admin/users')return listAdminUsers(req, res);
    if(req.method==='POST'&&pathname==='/api/admin/users/cleanup-stale-locks')return cleanupAdminUserLocks(req, res);
    const adminUserUploadLimitMatch=pathname.match(/^\/api\/admin\/users\/([^/]+)\/upload-limit$/);
    if(req.method==='POST'&&adminUserUploadLimitMatch)return updateAdminUserUploadLimit(req, res, adminUserUploadLimitMatch[1]);
    const adminUserBadgeMatch=pathname.match(/^\/api\/admin\/users\/([^/]+)\/badge$/);
    if(req.method==='POST'&&adminUserBadgeMatch)return updateAdminUserBadge(req, res, adminUserBadgeMatch[1]);
    const adminUserDeleteMatch=pathname.match(/^\/api\/admin\/users\/([^/]+)\/delete$/);
    if(req.method==='POST'&&adminUserDeleteMatch)return deleteAdminUser(req, res, adminUserDeleteMatch[1]);
    const updateMatch=pathname.match(/^\/api\/admin\/wallpapers\/([a-f0-9-]+)\/update$/);
    if(req.method==='POST'&&updateMatch)return updateWallpaperDetails(req, res, updateMatch[1]);
    const moderationMatch=pathname.match(/^\/api\/admin\/wallpapers\/([a-f0-9-]+)\/(approve|reject)$/);
    if(req.method==='POST'&&moderationMatch){
      return moderate(req, res, moderationMatch[1], moderationMatch[2]==='approve'?'approved':'rejected');
    }
    const deleteMatch=pathname.match(/^\/api\/admin\/wallpapers\/([a-f0-9-]+)\/delete$/);
    if(req.method==='POST'&&deleteMatch)return deleteWallpaper(req, res, deleteMatch[1]);
    const adminDownloadMatch=pathname.match(/^\/api\/admin\/download\/([a-f0-9-]+)$/);
    if(req.method==='GET'&&adminDownloadMatch)return adminDownloadWallpaper(req, res, adminDownloadMatch[1]);
    const downloadMatch=pathname.match(/^\/api\/download\/([a-f0-9-]+)$/);
    if(req.method==='GET'&&downloadMatch)return downloadWallpaper(req, res, downloadMatch[1]);
    const mediaMatch=pathname.match(/^\/media\/([a-f0-9-]+)$/);
    if(req.method==='GET'&&mediaMatch)return serveMedia(req, res, mediaMatch[1]);
    const profilePicMatch=pathname.match(/^\/profile-pics\/([^/]+)$/);
    if(req.method==='GET'&&profilePicMatch)return serveLocalProfilePic(req, res, profilePicMatch[1]);
    const profileOgImageMatch=pathname.match(/^\/og\/profile\/([a-z0-9_.-]{3,24})\.png$/i);
    if(req.method==='GET'&&profileOgImageMatch)return serveProfileOgImage(req, res, profileOgImageMatch[1]);
    if(req.method==='GET'&&pathname==='/vendor/supabase.js')return serveSupabaseClient(res);
    const publicProfilePageMatch=pathname.match(/^\/@([a-z0-9_.-]{3,24})$/i);
    if(req.method==='GET'&&publicProfilePageMatch)return servePublicProfilePage(req, res, publicProfilePageMatch[1]);
    if(req.method==='GET')return serveStatic(req, res, pathname);
    sendJson(res, 405, {error:'Method not allowed.'});
  }
  catch(error){
    sendJson(res, 500, {error:error.message||'Server error.'});
  }
});
function getLanUrls(){
  const interfaces=os.networkInterfaces();
  const urls=[];
  for(const values of Object.values(interfaces)){
    for(const item of values||[]){
      if(item.family==='IPv4'&&!item.internal)urls.push(`http://${item.address}:${PORT}`);
    }
  }
  return urls;
}
server.listen(PORT, HOST, ()=>{console.log(`THE VOID SPACE is running at http://localhost:${PORT}`); console.log(`Admin page: http://localhost:${PORT}/admin`); console.log(`Public directory: ${PUBLIC_DIR}`); console.log(`Storage mode: ${USE_SUPABASE ? 'Supabase Storage + Supabase DB' : 'local development fallback'}`); if(USE_SUPABASE){console.log(`Supabase bucket: ${SUPABASE_BUCKET}`); }else if(setupError){console.log(`Setup required: ${setupError}`); }else{console.log(`Local wallpaper data directory: ${LOCAL_DATA_DIR}`); }const lanUrls=getLanUrls(); if(lanUrls.length){console.log('\nOpen one of these on your phone while connected to the same Wi-Fi:'); for(const url of lanUrls)console.log(`  ${url}`); console.log(''); }});
