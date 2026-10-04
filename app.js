/* Loop is a local-first short-video prototype. See the note in Settings for its demo limits. */
const KEY = 'loop-prototype-state-v2';
const seedPosts = [
  { id:'sunset', user:'maya.moves', name:'Maya Chen', avatar:'☀️', caption:'The city looks a little softer at sunset ✨', tags:['goldenhour','citywalk','littlemoments'], sound:'original sound · maya.moves', likes:1284, comments:36, scene:'city', topic:'Travel', examples:[['sam.jpg','This is such a good vibe ✨'],['nina_days','Adding this to my weekend plans!'],['jules','Love this one 💛']] },
  { id:'ocean', user:'leo.outside', name:'Leo Rivera', avatar:'🌊', caption:'POV: you finally took that weekend trip 🌅', tags:['oceanair','weekendescape','travel'], sound:'Blue Skies · The Coastline', likes:932, comments:18, scene:'ocean', topic:'Travel', examples:[['fern','Need this view right now'],['cam.woods','Where is this? 🌊']] },
  { id:'coffee', user:'littlebrew', name:'Nina Park', avatar:'🍵', caption:'A tiny coffee ritual to start the day right.', tags:['coffee','morningroutine','cozy'], sound:'soft mornings · lo-fi cafe', likes:2107, comments:74, scene:'coffee', topic:'Food', examples:[['jules','That foam looks perfect ☕'],['brewday','Recipe please!']] },
  { id:'dance', user:'kai.moves', name:'Kai Bennett', avatar:'🪩', caption:'Learning this one one step at a time 🕺', tags:['dance','learnwithme','moves'], sound:'Side to Side · Kai', likes:5680, comments:122, scene:'dance', topic:'Dance', examples:[['mari','Okay, footwork!'],['syd.s','Tutorial next?']] },
  { id:'food', user:'table.for.two', name:'Ari Santos', avatar:'🍊', caption:'Crispy chilli noodles in under 15 minutes 🌶️', tags:['quickrecipe','noodles','homecooking'], sound:'original sound · Ari Santos', likes:3410, comments:93, scene:'food', topic:'Food', examples:[['luz','Making this tonight'],['mika','More easy recipes please!']] }
];
const creatorSuggestions = [
  { user:'maya.moves', name:'Maya Chen', avatar:'☀️', detail:'City walks · 42K followers' },
  { user:'leo.outside', name:'Leo Rivera', avatar:'🌊', detail:'Tiny trips · 18K followers' },
  { user:'littlebrew', name:'Nina Park', avatar:'🍵', detail:'Coffee & slow living · 9K followers' },
  { user:'kai.moves', name:'Kai Bennett', avatar:'🪩', detail:'Dance breaks · 31K followers' },
  { user:'table.for.two', name:'Ari Santos', avatar:'🍊', detail:'Easy home cooking · 26K followers' }
];
const conversations = [
  { id:'maya.moves', user:'maya.moves', name:'Maya Chen', avatar:'☀️', preview:'That sunset spot looks lovely!', time:'2m', starter:[['them','That sunset spot looks lovely!'],['you','Thank you! Found it on a walk 🌇']] },
  { id:'leo.outside', user:'leo.outside', name:'Leo Rivera', avatar:'🌊', preview:'Are you free for a day trip?', time:'1h', starter:[['them','Are you free for a day trip?'],['you','Maybe next weekend — where were you thinking?']] },
  { id:'littlebrew', user:'littlebrew', name:'Nina Park', avatar:'🍵', preview:'I shared the recipe in my latest video', time:'1d', starter:[['them','I shared the recipe in my latest video ☕']] }
];
const blankState = {
  profile:{ name:'New creator', handle:'you.loop', bio:'Making little moments worth sharing ✨', avatar:'🪩', avatarData:'' },
  profileReady:false, passwordSalt:'', passwordHash:'',
  following:[], likes:[], saves:[], comments:{}, chats:{}, privateAccount:false, autoplay:true,
  inboxRead:false, blocked:[], reports:[], acceptedTerms:false
};
let state;
try { state = { ...blankState, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; }
catch { state = { ...blankState }; }
state.profile = { ...blankState.profile, ...(state.profile || {}) };
state.following = Array.isArray(state.following) ? state.following : [];
state.likes = Array.isArray(state.likes) ? state.likes : [];
state.saves = Array.isArray(state.saves) ? state.saves : [];
state.comments = state.comments && typeof state.comments === 'object' ? state.comments : {};
state.chats = state.chats && typeof state.chats === 'object' ? state.chats : {};
state.blocked = Array.isArray(state.blocked) ? state.blocked : [];
state.reports = Array.isArray(state.reports) ? state.reports : [];

const app = document.getElementById('app');
const viewRoot = document.getElementById('viewRoot');
const overlay = document.getElementById('overlay');
const toastNode = document.getElementById('toast');
let currentView = 'feed';
let currentFeed = 'For You';
let profileTab = 'Videos';
let activePostId = null;
let activeChatId = null;
let searchQuery = '';
let selectedTopic = '';
let draftFile = null;
let draftUrl = '';
let chosenSound = '';
let draftFilter = 'none';
let toastTimer;
let dbPromise;
let uploadedPosts = [];
let savedDrafts = [];
let activeDraft = null;
let installPrompt = null;
let currentVideoId = '';
let profileUnlocked = false;

function saveState() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); }
  catch { showToast('Could not save more browser data.'); }
}
function escapeHtml(value='') {
  return String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}
function compact(value) { return value >= 1000000 ? `${(value/1000000).toFixed(1).replace(/\.0$/,'')}M` : value >= 1000 ? `${(value/1000).toFixed(1).replace(/\.0$/,'')}K` : String(value); }
function allPosts() { return [...uploadedPosts, ...seedPosts]; }
function findPost(id) { return allPosts().find(post => post.id === id); }
function commentsFor(post) { return state.comments[post.id] || []; }
function commentCount(post) { return post.comments + commentsFor(post).length; }
function isFollowing(user) { return state.following.includes(user); }
function showToast(message) {
  toastNode.textContent = message; toastNode.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => toastNode.classList.remove('show'), 2200);
}
function avatarMarkup(user, avatar, data='', extra='') {
  const picture = data ? `<img src="${escapeHtml(data)}" alt="">` : escapeHtml(avatar || '🙂');
  return `<span class="avatar ${extra}">${picture}</span>`;
}
function escapeTags(tags=[]) { return tags.map(tag => `#${escapeHtml(tag.replace(/^#/,' ' ).trim())}`).join(' '); }
function bytesToHex(bytes) { return [...new Uint8Array(bytes)].map(byte=>byte.toString(16).padStart(2,'0')).join(''); }
function hexToBytes(hex) { return Uint8Array.from(String(hex).match(/.{2}/g)||[],byte=>parseInt(byte,16)); }
async function hashPassword(password, saltHex='') {
  if(!window.crypto?.getRandomValues) throw new Error('Password protection is unavailable in this browser.');
  const salt=saltHex?hexToBytes(saltHex):window.crypto.getRandomValues(new Uint8Array(16));
  const encodedSalt=bytesToHex(salt);
  if(window.LoopNative && typeof window.LoopNative.hashPassword==='function') {
    const hash=window.LoopNative.hashPassword(String(password),encodedSalt);
    if(!hash) throw new Error('Password protection is unavailable on this Android version.');
    return {salt:encodedSalt,hash};
  }
  if(!window.crypto.subtle) throw new Error('Password protection requires a modern browser.');
  const key=await window.crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
  const bits=await window.crypto.subtle.deriveBits({name:'PBKDF2',salt,iterations:180000,hash:'SHA-256'},key,256);
  return {salt:encodedSalt,hash:bytesToHex(bits)};
}
function hasLocalPassword() { return Boolean(state.passwordSalt && state.passwordHash); }
function showSignupMessage(message) { const node=document.getElementById('signupMessage'); if(node)node.textContent=message; else showToast(message); }

function openDatabase() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve,reject) => {
    if (!('indexedDB' in window)) return reject(new Error('IndexedDB unavailable'));
    const request = indexedDB.open('loop-local-media',2);
    request.onupgradeneeded = () => {
      const db=request.result;
      if(!db.objectStoreNames.contains('videos'))db.createObjectStore('videos',{keyPath:'id'});
      if(!db.objectStoreNames.contains('drafts'))db.createObjectStore('drafts',{keyPath:'id'});
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Database unavailable'));
  });
  return dbPromise;
}
async function getSavedVideos() {
  const db = await openDatabase();
  return new Promise((resolve,reject) => {
    const request = db.transaction('videos','readonly').objectStore('videos').getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error || new Error('Could not read videos'));
  });
}
async function saveVideoRecord(record) {
  const db = await openDatabase();
  return new Promise((resolve,reject) => {
    const tx = db.transaction('videos','readwrite');
    tx.objectStore('videos').put(record);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error || new Error('Could not save video'));
  });
}
async function deleteVideoRecord(id) {
  const db = await openDatabase();
  return new Promise((resolve,reject) => {
    const tx = db.transaction('videos','readwrite');
    tx.objectStore('videos').delete(id);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error || new Error('Could not delete video'));
  });
}
async function getSavedDrafts() {
  const db=await openDatabase();
  return new Promise((resolve,reject)=>{
    const request=db.transaction('drafts','readonly').objectStore('drafts').getAll();
    request.onsuccess=()=>resolve(request.result||[]);
    request.onerror=()=>reject(request.error||new Error('Could not read drafts'));
  });
}
async function saveDraftRecord(record) {
  const db=await openDatabase();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('drafts','readwrite');tx.objectStore('drafts').put(record);
    tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error||new Error('Could not save draft'));
  });
}
async function deleteDraftRecord(id) {
  const db=await openDatabase();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('drafts','readwrite');tx.objectStore('drafts').delete(id);
    tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error||new Error('Could not remove draft'));
  });
}

function renderPost(post) {
  const liked = state.likes.includes(post.id);
  const saved = state.saves.includes(post.id);
  const own = post.isOwn || post.user === state.profile.handle;
  const displayUser = own ? state.profile.handle : post.user;
  const video = post.mediaUrl ? `<video data-video-id="${escapeHtml(post.id)}" src="${escapeHtml(post.mediaUrl)}" style="filter:${filterCss(post.filter)}" playsinline loop muted preload="metadata"></video>` : '';
  const sceneText = post.mediaUrl ? '' : `<span class="scene-label">${escapeHtml(post.sceneLabel || post.topic || 'A little loop')}</span>`;
  const avatar = avatarMarkup(displayUser,own ? state.profile.avatar : post.avatar,own ? state.profile.avatarData : '');
  const followButton = own ? '' : `<button class="follow ${isFollowing(post.user)?'following':''}" data-action="follow" data-user="${escapeHtml(post.user)}">${isFollowing(post.user)?'Following':'Follow +'}</button>`;
  const tags = (post.tags || []).map(tag => `<button class="tag-link" data-action="tag" data-tag="${escapeHtml(tag)}">#${escapeHtml(tag)}</button>`).join(' ');
  return `<article class="post" data-post-id="${escapeHtml(post.id)}">
    <div class="scene ${post.mediaUrl?'video-scene':escapeHtml(post.scene || 'city')}">${video}${sceneText}</div><div class="post-shade"></div>
    <div class="post-copy"><div class="creator">${avatar}<span class="creator-name">@${escapeHtml(displayUser)}</span>${followButton}</div>
      <p class="description">${escapeHtml(post.caption)}</p><div class="tags">${tags}</div>
      <button class="music" data-action="use-sound" data-post-id="${escapeHtml(post.id)}"><span>♫</span><span>${escapeHtml(post.sound || `original sound · ${displayUser}`)}</span><b>Use</b></button>
    </div>
    <div class="actions">
      <button class="action like ${liked?'liked':''}" data-action="like" data-post-id="${escapeHtml(post.id)}" aria-label="Like"><span class="glyph">${liked?'♥':'♡'}</span><span class="count">${compact(post.likes + (liked?1:0))}</span></button>
      <button class="action" data-action="comments" data-post-id="${escapeHtml(post.id)}" aria-label="Comments"><span class="glyph">▱</span><span class="count">${compact(commentCount(post))}</span></button>
      <button class="action ${saved?'liked':''}" data-action="save" data-post-id="${escapeHtml(post.id)}" aria-label="Save"><span class="glyph">${saved?'✓':'♧'}</span><span class="count">${saved?'Saved':'Save'}</span></button>
      <button class="action" data-action="share" data-post-id="${escapeHtml(post.id)}" aria-label="Share"><span class="glyph">↗</span><span class="count">Share</span></button>
      ${post.mediaUrl?`<button class="action" data-action="toggle-sound" data-post-id="${escapeHtml(post.id)}" aria-label="Toggle video sound"><span class="glyph">${currentVideoId===post.id?'♫':'♪'}</span><span class="count">${currentVideoId===post.id?'Sound on':'Sound'}</span></button>`:''}
      <button class="action more-action" data-action="more" data-post-id="${escapeHtml(post.id)}" aria-label="More options"><span class="glyph">···</span><span class="count">More</span></button>
    </div></article>`;
}
function renderFeed() {
  const tabs = ['For You','Following','Friends','LIVE'];
  let posts = allPosts().filter(post=>!state.blocked.includes(post.user));
  if (currentFeed === 'Following' || currentFeed === 'Friends') posts = posts.filter(post => isFollowing(post.user) || post.user === state.profile.handle);
  if (selectedTopic) posts = posts.filter(post => post.topic === selectedTopic || (post.tags || []).includes(selectedTopic));
  const empty = (currentFeed === 'Following' || currentFeed === 'Friends') && !posts.length;
  viewRoot.innerHTML = `<section class="feed-page"><div class="feed-scroller" id="feedScroller">${empty ? `<div class="empty-feed"><span class="empty-icon">⌁</span><h2>Your circle starts here</h2><p>Follow a few creators to fill this feed with the things you love.</p><button class="pill-button primary" data-view="discover">Find creators</button></div>` : posts.map(renderPost).join('')}</div>
      <div class="feed-tabs">${tabs.map(tab => `<button data-feed-tab="${tab}" class="${tab===currentFeed?'active':''}">${tab}</button>`).join('')}</div>
    </section>`;
  updateNav(); observeVideos();
}
function updateNav() {
  document.querySelectorAll('.nav-button[data-view]').forEach(button => button.classList.toggle('selected',button.dataset.view===currentView || (currentView==='studio' && button.dataset.view==='profile')));
}
function showView(view) {
  if (!state.profileReady) { renderSignup(); return; }
  if (!profileUnlocked) { renderPasswordGate(); return; }
  currentView = view; activeChatId = null;
  overlay.classList.remove('open'); overlay.innerHTML = '';
  if (view === 'feed') renderFeed();
  else if (view === 'discover') renderDiscover();
  else if (view === 'inbox') renderInbox();
  else if (view === 'profile') renderProfile();
  else if (view === 'studio') renderStudio();
  else if (view === 'notifications') renderNotifications();
  else if (view === 'settings') renderSettings();
  else if (view === 'live') renderLive();
  updateNav();
}
function renderSignup() {
  app.classList.add('signup-mode');
  viewRoot.innerHTML = `<section class="signup-screen"><div class="signup-card"><div class="signup-brand"><span class="brand-mark">∞</span><span>loop</span></div><div class="signup-art" aria-hidden="true"><span class="signup-orbit orbit-one">☀️</span><span class="signup-orbit orbit-two">🌊</span><span class="signup-orbit orbit-three">🪩</span><span class="signup-center">∞</span></div><div class="eyebrow">Your next little moment starts here</div><h1>Create your Loop profile</h1><p class="signup-intro">Pick a name, username, and password to personalise your space.</p><form data-form="signup" class="signup-form"><label class="form-label" for="signupName">Display name</label><input class="form-input" id="signupName" name="name" type="text" maxlength="40" autocomplete="name" placeholder="Your name" required><label class="form-label" for="signupHandle">Username</label><div class="signup-handle"><span>@</span><input class="form-input" id="signupHandle" name="handle" type="text" minlength="3" maxlength="24" pattern="[A-Za-z0-9._]{3,24}" autocapitalize="none" autocomplete="username" spellcheck="false" placeholder="yourname" required></div><small class="signup-hint">3–24 letters, numbers, dots, or underscores</small><label class="form-label" for="signupPassword">Password</label><input class="form-input" id="signupPassword" name="password" type="password" minlength="8" maxlength="128" autocomplete="new-password" placeholder="At least 8 characters" required><small class="signup-hint">Use a demo password you don't use elsewhere.</small><label class="form-label" for="signupPasswordConfirm">Confirm password</label><input class="form-input" id="signupPasswordConfirm" name="passwordConfirm" type="password" minlength="8" maxlength="128" autocomplete="new-password" placeholder="Type it again" required><button class="pill-button primary signup-submit" type="submit">Create profile <span>→</span></button><p class="signup-message" id="signupMessage" role="status" aria-live="polite"></p></form><button class="auth-switch" type="button" data-action="show-login">Already have a profile? <span>Log in</span></button><p class="signup-local-note">Your password hash stays on this device. This preview does not create or sync online accounts.</p></div></section>`;
  document.getElementById('signupName')?.focus();
}
function renderLogin({locked=false}={}) {
  app.classList.add('signup-mode');
  const hasAccount=state.profileReady && hasLocalPassword();
  const loginCopy=hasAccount
    ? `This profile is saved on this device. Enter its username and password to continue.`
    : `Log in to a profile saved on this device. This preview cannot look up accounts created on another device.`;
  viewRoot.innerHTML = `<section class="signup-screen"><div class="signup-card"><div class="signup-brand"><span class="brand-mark">∞</span><span>loop</span></div><div class="signup-art" aria-hidden="true"><span class="signup-orbit orbit-one">☀️</span><span class="signup-orbit orbit-two">🌊</span><span class="signup-orbit orbit-three">🪩</span><span class="signup-center">∞</span></div><div class="eyebrow">Welcome back</div><h1 class="login-title">Log in to Loop</h1><p class="signup-intro">${loginCopy}</p><form data-form="local-login" class="signup-form"><label class="form-label" for="loginHandle">Username</label><div class="signup-handle"><span>@</span><input class="form-input" id="loginHandle" name="handle" type="text" minlength="3" maxlength="24" pattern="[A-Za-z0-9._]{3,24}" autocapitalize="none" autocomplete="username" spellcheck="false" placeholder="yourname" value="${hasAccount?escapeHtml(state.profile.handle):''}" required></div><label class="form-label" for="loginPassword">Password</label><input class="form-input" id="loginPassword" name="password" type="password" maxlength="128" autocomplete="current-password" placeholder="Your password" required><button class="pill-button primary signup-submit" type="submit">${locked?'Unlock Loop':'Log in'} <span>→</span></button><p class="signup-message" id="signupMessage" role="status" aria-live="polite"></p></form>${locked?'<p class="signup-local-note">Forgot your password? Resetting this local demo profile erases its saved videos and activity.</p><button class="reset-local-profile" type="button" data-action="reset-demo">Reset local profile</button>':'<button class="auth-switch" type="button" data-action="show-signup">New to Loop? <span>Create an account</span></button><p class="signup-local-note">Your password hash stays on this device. This preview has no online account service, so profiles do not sync between devices.</p>'}</div></section>`;
  document.getElementById('loginHandle')?.focus();
}
function renderPasswordGate() { renderLogin({locked:true}); }
function observeVideos() {
  const videos = [...viewRoot.querySelectorAll('video[data-video-id]')];
  if (!videos.length) return;
  if (!('IntersectionObserver' in window)) { videos.forEach(video => { if (state.autoplay) video.play().catch(()=>{}); }); return; }
  const observer = new IntersectionObserver(entries => entries.forEach(entry => {
    const video = entry.target;
    if (entry.isIntersecting && entry.intersectionRatio > .65 && state.autoplay) video.play().catch(()=>{});
    else video.pause();
  }),{root:document.getElementById('feedScroller'),threshold:[0,.65,1]});
  videos.forEach(video => observer.observe(video));
}

function renderDiscover() {
  viewRoot.innerHTML = `<section class="page-scroll" id="discoverPage"><div class="page-heading"><div><div class="eyebrow">Find your next favourite</div><h1>Explore</h1><p>Creators and ideas worth a closer look.</p></div></div>
    <label class="search-box"><span>⌕</span><input id="searchInput" type="search" value="${escapeHtml(searchQuery)}" placeholder="Search videos, people, tags" autocomplete="off"></label>
    <div id="searchResults"></div><div id="discoveryDefault"><div class="section-title"><span>Popular right now</span><button data-action="clear-topic">See all</button></div>
      <div class="trend-list">${[['Travel','#weekendescape','12.4K loops'],['Food','#quickrecipe','8.7K loops'],['Dance','#learnwithme','6.1K loops'],['Travel','#goldenhour','4.9K loops'],['Food','#coffee','3.2K loops']].map((item,i)=>`<button class="trend-row" data-action="topic" data-topic="${item[0]}" data-tag="${item[1].slice(1)}"><span class="trend-rank">0${i+1}</span><span class="trend-name">${item[1]}<small class="trend-meta"> · ${item[0]}</small></span><span class="trend-meta">${item[2]}</span><span>›</span></button>`).join('')}</div>
      <div class="section-title"><span>Creators to meet</span><button data-action="creator-suggestions">More</button></div><div class="creator-list">${creatorSuggestions.filter(person=>!state.blocked.includes(person.user)).slice(0,3).map(renderCreator).join('')}</div>
      <div class="section-title"><span>Fresh loops</span><button data-action="clear-topic">All videos</button></div><div class="grid-videos">${allPosts().filter(post=>!state.blocked.includes(post.user)).slice(0,6).map(renderGridPost).join('')}</div>
    </div></section>`;
  renderSearchResults(); updateNav();
  const input = document.getElementById('searchInput');
  input.addEventListener('input',() => { searchQuery = input.value; renderSearchResults(); });
}
function renderCreator(person) {
  const following = isFollowing(person.user);
  return `<div class="creator-card">${avatarMarkup(person.user,person.avatar)}<div class="creator-details"><strong>@${escapeHtml(person.user)}</strong><span>${escapeHtml(person.detail)}</span></div><button class="pill-button ${following?'':'primary'}" data-action="follow" data-user="${escapeHtml(person.user)}">${following?'Following':'Follow +'}</button></div>`;
}
function renderGridPost(post) {
  return `<button class="grid-video ${escapeHtml(post.scene || 'city')}" data-action="open-post" data-post-id="${escapeHtml(post.id)}"><span>▶ ${compact(post.likes + (state.likes.includes(post.id)?1:0))} · ${escapeHtml(post.topic || 'Your video')}</span></button>`;
}
function renderSearchResults() {
  const output = document.getElementById('searchResults');
  const defaults = document.getElementById('discoveryDefault');
  if (!output || !defaults) return;
  const q = searchQuery.trim().toLowerCase();
  defaults.hidden = Boolean(q);
  if (!q) { output.innerHTML = ''; return; }
  const normalizedQ=q.replace(/^#/,'').replace(/^@/,'');
  const people = creatorSuggestions.filter(person => !state.blocked.includes(person.user) && `${person.user} ${person.name} ${person.detail}`.toLowerCase().includes(normalizedQ));
  const videos = allPosts().filter(post => !state.blocked.includes(post.user) && `${post.user} ${post.caption} ${post.topic} ${(post.tags||[]).join(' ')}`.toLowerCase().includes(normalizedQ));
  output.innerHTML = `<div class="section-title"><span>People</span></div><div class="creator-list">${people.length?people.map(renderCreator).join(''):'<p class="helper-note">No matching creators yet.</p>'}</div><div class="section-title"><span>Videos</span></div><div class="grid-videos">${videos.length?videos.map(renderGridPost).join(''):'<p class="helper-note">No matching videos. Try a tag like coffee, travel, or dance.</p>'}</div>`;
}

function renderProfile() {
  const ownPosts = uploadedPosts.filter(post => post.isOwn || post.user===state.profile.handle);
  let grid = [];
  if (profileTab==='Videos') grid=ownPosts;
  else if (profileTab==='Liked') grid=allPosts().filter(post=>state.likes.includes(post.id));
  else grid=allPosts().filter(post=>state.saves.includes(post.id));
  const followers = state.following.length;
  const avatar = avatarMarkup(state.profile.handle,state.profile.avatar,state.profile.avatarData,'large-avatar');
  viewRoot.innerHTML = `<section class="page-scroll"><div class="page-heading"><div><div class="eyebrow">Your space</div><h1>Profile</h1></div><button class="header-icon" data-view="settings" aria-label="Settings">⚙</button></div>
    <div class="profile-hero"><div class="profile-top">${avatar}<div class="profile-name"><h2>${escapeHtml(state.profile.name)}</h2><div>@${escapeHtml(state.profile.handle)}</div></div></div>
      <p class="profile-bio">${escapeHtml(state.profile.bio)}</p><div class="stats"><div class="stat"><strong>${ownPosts.length}</strong><span>Loops</span></div><div class="stat"><strong>${compact(followers)}</strong><span>Following</span></div><div class="stat"><strong>${compact(state.likes.length)}</strong><span>Likes</span></div></div>
      <div class="profile-actions"><button class="pill-button primary" data-action="edit-profile">Edit profile</button><button class="pill-button" data-view="studio">Studio</button><button class="pill-button" data-action="share-profile">Share</button></div>
    </div><div class="segment-tabs">${['Videos','Liked','Saved'].map(tab=>`<button data-profile-tab="${tab}" class="${profileTab===tab?'active':''}">${tab}</button>`).join('')}</div>
    ${grid.length?`<div class="grid-videos">${grid.map(renderGridPost).join('')}</div>`:`<div class="empty-feed" style="height:250px;min-height:250px;padding:20px;border-radius:16px"><span class="empty-icon">${profileTab==='Videos'?'＋':'♡'}</span><h2>${profileTab==='Videos'?'Your first loop is waiting':'Nothing here yet'}</h2><p>${profileTab==='Videos'?'Create or upload a short video to start your profile.':`Videos you ${profileTab.toLowerCase()} will appear here.`}</p><button class="pill-button primary" data-action="${profileTab==='Videos'?'open-create':'go-feed'}">${profileTab==='Videos'?'Create a video':'Explore videos'}</button></div>`}
    <p class="helper-note">Your profile and activity are saved in this browser on this device.</p></section>`;
  updateNav();
}

function renderStudio() {
  const ownPosts=uploadedPosts.filter(post=>post.isOwn || post.user===state.profile.handle);
  const likes=ownPosts.reduce((sum,post)=>sum+(state.likes.includes(post.id)?1:0),0);
  const comments=ownPosts.reduce((sum,post)=>sum+commentsFor(post).length,0);
  const drafts=[...savedDrafts].sort((a,b)=>b.updatedAt-a.updatedAt);
  const draftRows=drafts.length?drafts.map(draft=>`<div class="draft-row"><span class="draft-thumb">▶</span><span class="draft-info"><strong>${escapeHtml(draft.caption || 'Untitled draft')}</strong><small>${escapeHtml(draft.topic || 'Everyday')} · Saved ${new Date(draft.updatedAt || draft.createdAt).toLocaleDateString()}</small></span><button class="pill-button" data-action="edit-draft" data-draft-id="${escapeHtml(draft.id)}">Edit</button><button class="pill-button danger" data-action="delete-draft" data-draft-id="${escapeHtml(draft.id)}" aria-label="Delete draft">×</button></div>`).join(''):'<p class="helper-note">No drafts yet. Save a video from the create screen and pick it up later.</p>';
  const postRows=ownPosts.length?ownPosts.map(post=>`<div class="draft-row"><span class="draft-thumb">▶</span><span class="draft-info"><strong>${escapeHtml(post.caption)}</strong><small>${compact(state.likes.includes(post.id)?1:0)} local likes · ${commentsFor(post).length} comments · ${escapeHtml(post.topic)}</small></span><button class="pill-button" data-action="open-post" data-post-id="${escapeHtml(post.id)}">View</button><button class="pill-button danger" data-action="delete-post" data-post-id="${escapeHtml(post.id)}" aria-label="Delete loop">×</button></div>`).join(''):'<p class="helper-note">Publish a loop from this browser to see it here.</p>';
  viewRoot.innerHTML=`<section class="page-scroll"><div class="page-heading"><div><div class="eyebrow">Your creator tools</div><h1>Studio</h1><p>Local activity from this device only.</p></div><button class="pill-button primary" data-action="open-create">＋ New loop</button></div>
    <div class="studio-metrics"><div class="studio-metric"><strong>${ownPosts.length}</strong><span>Loops on this device</span></div><div class="studio-metric"><strong>${likes}</strong><span>Likes you gave</span></div><div class="studio-metric"><strong>${comments}</strong><span>Comments you left</span></div></div>
    <div class="section-title"><span>Drafts (${drafts.length})</span><span class="eyebrow">Saved on this device</span></div>${draftRows}
    <div class="section-title"><span>Your loops (${ownPosts.length})</span><span class="eyebrow">Manage posts</span></div>${postRows}
    <div class="section-title"><span>Creator checklist</span></div><div class="setting-group" style="padding:12px"><p class="helper-note">Use videos and sounds you have permission to share. Read the <a href="community-guidelines.html" target="_blank" rel="noopener">community guidelines</a> before posting. This local preview does not distribute your posts to other users.</p></div></section>`;
  updateNav();
}

function renderInbox() {
  if (activeChatId) { renderChat(activeChatId); return; }
  const rows = conversations.filter(item=>!state.blocked.includes(item.user)).map(item => {
    const messages = state.chats[item.id] || item.starter;
    const last = messages[messages.length-1];
    const preview = last ? (Array.isArray(last) ? last[1] : last.text) : item.preview;
    return `<button class="conversation" data-action="open-chat" data-chat-id="${escapeHtml(item.id)}">${avatarMarkup(item.user,item.avatar)}<span class="conversation-content"><strong><span>${escapeHtml(item.name)} <small style="color:var(--muted);font-weight:400">@${escapeHtml(item.user)}</small></span><small>${item.time}</small></strong><small>${escapeHtml(preview)}</small></span>${state.inboxRead?'':'<span class="badge"></span>'}</button>`;
  }).join('');
  viewRoot.innerHTML = `<section class="page-scroll"><div class="page-heading"><div><div class="eyebrow">Say hello</div><h1>Inbox</h1><p>Messages stay on this device in this demo.</p></div></div><div class="inbox-list">${rows}</div><p class="helper-note">Real delivery between people needs an online account and messaging service.</p></section>`;
  state.inboxRead=true; saveState(); updateNav();
}
function renderChat(id) {
  const person = conversations.find(item=>item.id===id) || creatorSuggestions.find(item=>item.user===id);
  if (!person) { activeChatId=null; renderInbox(); return; }
  const messages = state.chats[id] || (person.starter ? person.starter.map(row=>({side:row[0],text:row[1]})) : []);
  viewRoot.innerHTML = `<section class="page-scroll"><div class="message-thread"><div class="page-heading"><div><button class="thread-back" data-action="back-inbox">‹ Inbox</button><h1 style="font-size:19px;margin-top:7px">${escapeHtml(person.name)}</h1><p>@${escapeHtml(person.user)}</p></div>${avatarMarkup(person.user,person.avatar)}</div><div class="thread-messages" id="threadMessages">${messages.map(message=>`<div class="bubble ${message.side==='you'?'mine':''}">${escapeHtml(message.text)}</div>`).join('')}</div><form class="message-form" data-form="message"><input name="message" maxlength="300" placeholder="Write a message…" autocomplete="off"><button class="pill-button primary" type="submit">Send</button></form></div></section>`;
  const thread = document.getElementById('threadMessages'); thread.scrollTop=thread.scrollHeight;
}

function renderNotifications() {
  const items = [
    ['💛','maya.moves','liked your video','12 min'],['➕','leo.outside','started following you','1 hr'],['💬','littlebrew','commented: “Love this recipe!”','3 hr'],['↗','kai.moves','shared a loop with you','Yesterday']
  ];
  viewRoot.innerHTML = `<section class="page-scroll"><div class="page-heading"><div><div class="eyebrow">Your updates</div><h1>Notifications</h1><p>Sample activity for this local demo.</p></div></div><div class="notification-list">${items.map(([emoji,user,text,time])=>`<div class="notification-row">${avatarMarkup(user,emoji)}<p><strong>@${escapeHtml(user)}</strong> ${escapeHtml(text)}<small>${time}</small></p><span style="color:var(--coral)">●</span></div>`).join('')}</div><p class="helper-note">Live notifications from other accounts are not connected in this prototype.</p></section>`;
}
function renderSettings() {
  viewRoot.innerHTML = `<section class="page-scroll"><div class="page-heading"><div><div class="eyebrow">Make it yours</div><h1>Settings</h1><p>Controls for your local Loop profile.</p></div></div>
    <div class="setting-group" style="padding:12px"><div class="eyebrow">Take Loop with you</div><p class="helper-note">Install Loop from your browser for a home-screen icon and an app-style window. Installation is available after this site is hosted securely.</p><button class="pill-button primary" data-action="install-app">Download Loop</button></div>
    <div class="section-title">Privacy</div><div class="setting-group"><div class="setting-row"><span>Private account<small>Demo only — doesn't restrict this local feed.</small></span><button class="toggle ${state.privateAccount?'on':''}" data-action="toggle-private" aria-label="Toggle private account"></button></div><div class="setting-row"><span>Autoplay videos<small>Play uploaded videos when they enter the feed.</small></span><button class="toggle ${state.autoplay?'on':''}" data-action="toggle-autoplay" aria-label="Toggle video autoplay"></button></div></div>
    <div class="section-title">Account and data</div><div class="setting-group"><button class="setting-row" style="width:100%;background:none;border:0;text-align:left" data-action="edit-profile"><span>Edit profile details</span><span>›</span></button><button class="setting-row" style="width:100%;background:none;border:0;text-align:left" data-action="export-data"><span>Export local profile data</span><span>↓</span></button>${hasLocalPassword()?'<button class="setting-row" style="width:100%;background:none;border:0;text-align:left" data-action="logout"><span>Log out<small>Lock Loop on this device. Your profile and videos stay saved.</small></span><span>↪</span></button>':''}<button class="setting-row" style="width:100%;background:none;border:0;text-align:left" data-action="reset-demo"><span>Delete local data and reset</span><span style="color:var(--coral)">Reset</span></button></div>
    <div class="section-title"><span>Blocked creators</span><span class="eyebrow">${state.blocked.length}</span></div><div class="creator-list">${state.blocked.length?state.blocked.map(user=>`<div class="creator-card"><div class="creator-details"><strong>@${escapeHtml(user)}</strong><span>Hidden from your local feed</span></div><button class="pill-button" data-action="unblock" data-user="${escapeHtml(user)}">Unblock</button></div>`).join(''):'<p class="helper-note">No creators blocked.</p>'}</div>
    <div class="section-title">Policies and help</div><div class="setting-group"><a class="setting-row" href="privacy.html" target="_blank" rel="noopener">Privacy summary <span>↗</span></a><a class="setting-row" href="terms.html" target="_blank" rel="noopener">Terms summary <span>↗</span></a><a class="setting-row" href="community-guidelines.html" target="_blank" rel="noopener">Community guidelines <span>↗</span></a></div>
    <div class="section-title">About this build</div><div class="setting-group" style="padding:12px"><div class="eyebrow">Loop · installable web preview</div><p class="helper-note">The app shell can work offline after its first hosted visit. Profiles, follows, comments, messages, reports, and video files stay on this device; they are not sent to a server or visible to other people.</p><p class="helper-note">A real public social service still needs shared accounts and video storage, a moderation and support operation, live messaging/broadcasting infrastructure, music rights, and privacy terms specific to its operator and audience.</p></div></section>`;
  updateNav();
}
function renderLive() {
  viewRoot.innerHTML = `<section class="page-scroll"><div class="page-heading"><div><div class="eyebrow">Meet in real time</div><h1>Live rooms</h1><p>Watch together, learn something, or just say hi.</p></div></div><div class="live-hero"><span class="live-tag">● LIVE DEMO</span><h2>Loop Live Lounge</h2><p>Live rooms are represented here as a preview. Broadcasting video to other people needs a streaming server, accounts, and safety controls.</p><button class="pill-button primary" data-action="join-live">Enter sample room</button></div><div class="section-title"><span>Upcoming rooms</span><button data-action="notify-live">Remind me</button></div><div class="creator-list"><div class="creator-card">${avatarMarkup('table.for.two','🍊')}<div class="creator-details"><strong>15 minute recipe swap</strong><span>with Ari · Today, 18:30</span></div><span class="live-tag">SOON</span></div><div class="creator-card">${avatarMarkup('kai.moves','🪩')}<div class="creator-details"><strong>Beginner dance break</strong><span>with Kai · Tomorrow, 12:00</span></div><span class="live-tag">SOON</span></div></div></section>`;
}

function openSheet(title,body,footer='') {
  overlay.innerHTML = `<section class="sheet"><div class="sheet-head"><span>${title}</span><button data-action="close-sheet" aria-label="Close">×</button></div>${body}${footer}</section>`;
  overlay.classList.add('open');
}
function closeSheet() { overlay.classList.remove('open'); overlay.innerHTML=''; }
function openComments(id) {
  const post = findPost(id); if (!post) return;
  activePostId=id;
  const examples=(post.examples||[]).map(([user,text])=>({user,text}));
  const saved=commentsFor(post);
  const all=[...examples,...saved];
  const body=`<div class="comment-list" id="commentList">${all.length?all.map(item=>`<div class="comment-row"><strong>@${escapeHtml(item.user)}</strong>${escapeHtml(item.text)}<small>Just now · ♡</small></div>`).join(''):'<p class="helper-note">Be the first to leave a kind comment.</p>'}</div><form class="comment-form" data-form="comment"><input name="comment" maxlength="180" placeholder="Add a comment…" aria-label="Add a comment" autocomplete="off"><button type="submit">Post</button></form>`;
  openSheet(`${compact(commentCount(post))} comments`,body);
}
function showCreate(prefillSound='') {
  if (prefillSound) chosenSound=prefillSound;
  if (activeDraft) {
    draftFile=activeDraft.blob;
    if(!draftUrl && draftFile)draftUrl=URL.createObjectURL(draftFile);
    chosenSound=activeDraft.sound || chosenSound;
    draftFilter=activeDraft.filter==='dreamy'?'glow':(activeDraft.filter || 'none');
  }
  const draft=activeDraft || {};
  const filters=[['none','Natural'],['warm','Warm'],['cool','Cool'],['mono','Noir'],['glow','Glow'],['vintage','Vintage']];
  const preview = draftUrl
    ? `<video class="creator-video" src="${escapeHtml(draftUrl)}" controls muted playsinline style="filter:${filterCss(draftFilter)}" aria-label="Video preview"></video><span class="creator-preview-tag">PREVIEW</span>`
    : `<div class="creator-empty-stage"><span class="creator-empty-mark">∞</span><strong>Your next loop starts here</strong><small>Record a clip or upload one from your device.</small></div>`;
  const categories=['Everyday','Travel','Food','Dance','Art','Comedy','Learning'];
  const filterButtons=filters.map(([id,label])=>`<button class="filter-chip ${draftFilter===id?'selected':''}" type="button" data-action="select-filter" data-filter="${id}" aria-pressed="${draftFilter===id}"><span class="filter-swatch swatch-${id}" style="filter:${filterCss(id)}"></span><span>${label}</span></button>`).join('');
  const body = `<form data-form="create"><div class="creator-stage ${draftUrl?'has-video':''}">${preview}</div>
    <div class="creator-source-actions"><button class="creator-source-button" type="button" data-action="record-video"><span>●</span><span>Record with camera</span></button><button class="creator-source-button" type="button" data-action="pick-video"><span>▧</span><span>${draftUrl?'Choose another video':'Upload video'}</span></button></div><p class="creator-camera-hint">On supported phones, Record opens your camera.</p>
    <div class="creator-section-heading"><div><strong>Choose a look</strong><small>Filters preview on your video</small></div><span class="creator-section-icon">✦</span></div><div class="filter-carousel" aria-label="Video filters">${filterButtons}</div><input type="hidden" id="videoFilter" name="filter" value="${escapeHtml(draftFilter)}">
    <div class="creator-section-heading details-heading"><div><strong>Post details</strong><small>Make this loop yours</small></div></div>
    <label class="form-label" for="videoCaption">Caption</label><textarea class="form-area creator-caption" id="videoCaption" name="caption" maxlength="220" placeholder="Write a caption… add a little context or a hashtag">${escapeHtml(draft.caption||'')}</textarea>
    <div class="form-row"><div><label class="form-label" for="videoSound">Sound</label><input class="form-input" id="videoSound" name="sound" value="${escapeHtml(chosenSound || draft.sound || 'original sound · you')}" maxlength="80"></div><div><label class="form-label" for="videoTopic">Category</label><select class="form-select" id="videoTopic" name="topic">${categories.map(category=>`<option ${category===(draft.topic||'Everyday')?'selected':''}>${category}</option>`).join('')}</select></div></div>
    <label class="form-label" for="videoTags">Topics and hashtags</label><input class="form-input" id="videoTags" name="tags" value="${escapeHtml((draft.tags||[]).join(', '))}" placeholder="travel, dance, food">
    <label class="terms-check"><input type="checkbox" name="agree" ${state.acceptedTerms?'checked':''} required><span>I agree to the <a href="terms.html" target="_blank" rel="noopener">Terms summary</a> and <a href="community-guidelines.html" target="_blank" rel="noopener">Community Guidelines</a>. I have permission to share this video.</span></label>
    <p class="helper-note">Your video and post details stay on this device in this preview.</p><div class="sheet-actions creator-submitbar"><button class="pill-button" type="button" data-action="save-draft">Save draft</button><button class="pill-button primary" type="submit">Post loop <span>→</span></button></div></form>`;
  openSheet('Create a loop',body);
  overlay.querySelector('.sheet')?.classList.add('creator-sheet');
}
function filterCss(filter) { return ({warm:'sepia(.22) saturate(1.22) hue-rotate(-5deg)',cool:'saturate(.92) hue-rotate(12deg) brightness(1.04)',mono:'grayscale(1) contrast(1.12)',glow:'saturate(1.28) brightness(1.09) contrast(1.02)',dreamy:'saturate(1.28) brightness(1.09) contrast(1.02)',vintage:'sepia(.28) saturate(.84) contrast(.94) brightness(1.04)'})[filter] || 'none'; }
function openEditProfile() {
  const body=`<form data-form="profile"><label class="form-label">Display name</label><input class="form-input" name="name" maxlength="40" value="${escapeHtml(state.profile.name)}"><label class="form-label">Username</label><input class="form-input" name="handle" maxlength="24" value="${escapeHtml(state.profile.handle)}"><label class="form-label">Bio</label><textarea class="form-area" name="bio" maxlength="90">${escapeHtml(state.profile.bio)}</textarea><div class="sheet-actions"><button class="pill-button" type="button" data-action="pick-avatar">Change profile photo</button><button class="pill-button primary" type="submit">Save profile</button></div></form>`;
  openSheet('Edit your profile',body);
}
function openMore(id) {
  const post=findPost(id); if(!post)return;
  const own=post.isOwn || post.user===state.profile.handle;
  const block=own?'':`<button class="setting-row" style="width:100%;background:none;border:0;text-align:left" data-action="block-user" data-user="${escapeHtml(post.user)}"><span>Hide @${escapeHtml(post.user)} from my feed</span><span>›</span></button>`;
  const report=own?'':`<button class="setting-row" style="width:100%;background:none;border:0;text-align:left" data-action="report" data-post-id="${escapeHtml(id)}"><span style="color:var(--coral)">⚑ Report this loop</span><span>›</span></button><button class="setting-row" style="width:100%;background:none;border:0;text-align:left" data-action="report-user" data-user="${escapeHtml(post.user)}"><span style="color:var(--coral)">⚑ Report @${escapeHtml(post.user)}</span><span>›</span></button>`;
  const remove=own?`<button class="setting-row" style="width:100%;background:none;border:0;text-align:left;color:var(--coral)" data-action="delete-post" data-post-id="${escapeHtml(id)}"><span>Delete my loop from this device</span><span>×</span></button>`:'';
  openSheet('Loop options',`<div class="setting-group"><button class="setting-row" style="width:100%;background:none;border:0;text-align:left" data-action="use-sound" data-post-id="${escapeHtml(id)}"><span>♫ Use this sound</span><span>›</span></button><button class="setting-row" style="width:100%;background:none;border:0;text-align:left" data-action="response" data-post-id="${escapeHtml(id)}"><span>↩ Make a response loop</span><span>›</span></button>${block}${report}${remove}</div>`);
}
function openReport(id='',user='') {
  const subject=user?`@${escapeHtml(user)}`:'this loop';
  openSheet('Report content',`<p class="helper-note">Select a reason for ${subject}. In this preview, the report is saved only on this device and is not sent to a moderation team.</p><form data-form="report" data-post-id="${escapeHtml(id)}" data-user="${escapeHtml(user)}"><label class="form-label">Reason</label><select name="reason" class="form-select"><option>Spam or misleading</option><option>Harassment or bullying</option><option>Unsafe content</option><option>Copyright concern</option><option>Something else</option></select><div class="sheet-actions"><button class="pill-button primary" type="submit">Save local report</button></div></form>`);
}

async function saveCurrentDraft() {
  const form=overlay.querySelector('form[data-form="create"]');
  if(!form || !draftFile) { showToast('Choose a video before saving a draft.'); return; }
  const values=new FormData(form);
  const id=activeDraft?.id || `draft-${Date.now()}`;
  const record={id,blob:draftFile,caption:String(values.get('caption')||'').trim(),tags:String(values.get('tags')||'').split(/[\s,#]+/).filter(Boolean).slice(0,5),sound:String(values.get('sound')||'original sound · you').trim(),topic:String(values.get('topic')||'Everyday'),filter:String(values.get('filter')||'none'),createdAt:activeDraft?.createdAt||Date.now(),updatedAt:Date.now()};
  try {
    await saveDraftRecord(record);
    savedDrafts=[record,...savedDrafts.filter(item=>item.id!==id)];
    activeDraft=null;draftFile=null;
    if(draftUrl)URL.revokeObjectURL(draftUrl);draftUrl='';chosenSound='';draftFilter='none';closeSheet();
    if(currentView==='studio')renderStudio();else showView('studio');
    showToast('Draft saved on this device.');
  } catch { showToast('Could not save a draft in this browser.'); }
}
function editSavedDraft(id) {
  const draft=savedDrafts.find(item=>item.id===id);if(!draft)return;
  if(draftUrl)URL.revokeObjectURL(draftUrl);
  activeDraft=draft;draftFile=draft.blob;draftUrl=URL.createObjectURL(draft.blob);chosenSound=draft.sound||'';draftFilter=draft.filter||'none';showCreate();
}
async function removeSavedDraft(id) {
  if(!window.confirm('Delete this saved draft from this device?'))return;
  try { await deleteDraftRecord(id);savedDrafts=savedDrafts.filter(draft=>draft.id!==id);renderStudio();showToast('Draft deleted.'); }
  catch { showToast('Could not delete the draft.'); }
}
async function removeOwnPost(id) {
  const post=findPost(id);if(!post || !(post.isOwn || post.user===state.profile.handle))return;
  if(!window.confirm('Delete this loop and its local interactions from this device?'))return;
  try { if(post.mediaUrl)URL.revokeObjectURL(post.mediaUrl);await deleteVideoRecord(id); }
  catch { showToast('Could not remove the saved video file.');return; }
  if(currentVideoId===id)currentVideoId='';
  uploadedPosts=uploadedPosts.filter(item=>item.id!==id);state.likes=state.likes.filter(item=>item!==id);state.saves=state.saves.filter(item=>item!==id);delete state.comments[id];saveState();
  closeSheet();if(currentView==='studio')renderStudio();else if(currentView==='profile')renderProfile();else renderFeed();showToast('Loop deleted from this device.');
}
function blockUser(user) {
  if(!user || state.blocked.includes(user))return;
  if(!window.confirm(`Hide @${user} from your feeds on this device?`))return;
  state.blocked.push(user);state.following=state.following.filter(item=>item!==user);saveState();closeSheet();
  if(currentView==='discover')renderDiscover();else renderFeed();showToast(`@${user} is hidden in this browser.`);
}

function followUser(user) {
  const index=state.following.indexOf(user);
  if(index>=0) state.following.splice(index,1); else state.following.push(user);
  saveState();
  if(currentView==='discover') renderDiscover(); else if(currentView==='profile') renderProfile(); else renderFeed();
  showToast(index>=0?`Unfollowed @${user}`:`Following @${user}`);
}
function toggleLike(id) {
  const index=state.likes.indexOf(id);
  if(index>=0)state.likes.splice(index,1);else state.likes.push(id);
  saveState();
  const button=viewRoot.querySelector(`[data-action="like"][data-post-id="${CSS.escape(id)}"]`);
  const post=findPost(id);
  if(button && post) { const liked=state.likes.includes(id); button.classList.toggle('liked',liked); button.querySelector('.glyph').textContent=liked?'♥':'♡'; button.querySelector('.count').textContent=compact(post.likes+(liked?1:0)); }
}
async function sharePost(id) {
  const post=findPost(id); if(!post)return;
  const shareText=`${post.caption} — @${post.user} on Loop`;
  try {
    if(navigator.share) await navigator.share({title:'Loop video',text:shareText,url:location.href});
    else if(navigator.clipboard) { await navigator.clipboard.writeText(`${shareText} ${location.href}#${id}`); showToast('Loop link copied.'); }
    else showToast('Share preview: '+shareText);
  } catch(error) { if(error.name!=='AbortError') showToast('Share this loop with someone you know.'); }
}
function openPostInFeed(id) {
  currentFeed='For You'; selectedTopic=''; showView('feed');
  requestAnimationFrame(()=>{ const node=viewRoot.querySelector(`[data-post-id="${CSS.escape(id)}"]`); if(node)node.scrollIntoView({behavior:'smooth',block:'start'}); });
}
function openTopic(topic,tag='') {
  selectedTopic=topic || '';
  if(tag && !topic) { searchQuery=tag; showView('discover'); requestAnimationFrame(()=>document.getElementById('searchInput')?.focus()); return; }
  currentFeed='For You'; showView('feed');
  if(selectedTopic) showToast(`Showing ${selectedTopic.toLowerCase()} loops`);
}
function openAvatarPicker() { closeSheet(); document.getElementById('avatarPicker').click(); }

app.addEventListener('click', event => {
  const viewButton=event.target.closest('[data-view]');
  if(viewButton) {
    const view=viewButton.dataset.view;
    if(view==='profile' || view==='settings') { if(view==='profile')profileTab='Videos'; }
    if(view==='discover' && currentView!=='discover') searchQuery='';
    showView(view); if(view==='discover') requestAnimationFrame(()=>document.getElementById('searchInput')?.focus()); return;
  }
  const tab=event.target.closest('[data-feed-tab]');
  if(tab) { if(tab.dataset.feedTab==='LIVE') { showView('live'); return; } currentFeed=tab.dataset.feedTab; selectedTopic=''; renderFeed(); return; }
  const profileTabButton=event.target.closest('[data-profile-tab]');
  if(profileTabButton) { profileTab=profileTabButton.dataset.profileTab; renderProfile(); return; }
  const action=event.target.closest('[data-action]'); if(!action)return;
  const {action:doWhat,postId,user,tag,topic}=action.dataset;
  if(doWhat==='show-login')renderLogin();
  else if(doWhat==='show-signup')renderSignup();
  else if(doWhat==='open-create')showCreate();
  else if(doWhat==='record-video') { const picker=document.getElementById('videoPicker');picker.setAttribute('capture','environment');picker.click(); }
  else if(doWhat==='pick-video') { const picker=document.getElementById('videoPicker');picker.removeAttribute('capture');picker.click(); }
  else if(doWhat==='select-filter') {
    draftFilter=action.dataset.filter||'none';
    const input=document.getElementById('videoFilter');if(input)input.value=draftFilter;
    overlay.querySelectorAll('[data-action="select-filter"]').forEach(button=>{const selected=button.dataset.filter===draftFilter;button.classList.toggle('selected',selected);button.setAttribute('aria-pressed',String(selected));});
    const preview=overlay.querySelector('.creator-video');if(preview)preview.style.filter=filterCss(draftFilter);
  }
  else if(doWhat==='pick-avatar')openAvatarPicker();
  else if(doWhat==='close-sheet')closeSheet();
  else if(doWhat==='follow')followUser(user);
  else if(doWhat==='like')toggleLike(postId);
  else if(doWhat==='comments')openComments(postId);
  else if(doWhat==='save') {
    const index=state.saves.indexOf(postId); if(index>=0)state.saves.splice(index,1);else state.saves.push(postId);saveState();
    const button=action; const saved=state.saves.includes(postId);button.classList.toggle('liked',saved);button.querySelector('.glyph').textContent=saved?'✓':'♧';button.querySelector('.count').textContent=saved?'Saved':'Save';showToast(saved?'Saved to your collection':'Removed from saved');
  }
  else if(doWhat==='share')sharePost(postId);
  else if(doWhat==='toggle-sound') {
    const video=viewRoot.querySelector(`video[data-video-id="${CSS.escape(postId)}"]`);
    if(video) {
      const turnOn=video.muted;
      viewRoot.querySelectorAll('video[data-video-id]').forEach(item=>{item.muted=true;});
      if(turnOn) { video.muted=false;video.play().catch(()=>{});currentVideoId=postId; }
      else currentVideoId='';
      const scroller=document.getElementById('feedScroller');
      const savedTop=scroller?.scrollTop || 0;
      renderFeed();
      const refreshed=document.getElementById('feedScroller');
      if(refreshed)refreshed.scrollTop=savedTop;
      if(currentVideoId) { const active=refreshed?.querySelector(`[data-post-id="${CSS.escape(currentVideoId)}"] video`);if(active){active.muted=false;active.play().catch(()=>{});} }
      showToast(turnOn?'Video sound on':'Video sound off');
    }
  }
  else if(doWhat==='more')openMore(postId);
  else if(doWhat==='block-user')blockUser(user);
  else if(doWhat==='unblock') { state.blocked=state.blocked.filter(item=>item!==user);saveState();renderSettings();showToast(`@${user} can appear in your feed again.`); }
  else if(doWhat==='delete-post')removeOwnPost(postId);
  else if(doWhat==='edit-draft')editSavedDraft(action.dataset.draftId);
  else if(doWhat==='delete-draft')removeSavedDraft(action.dataset.draftId);
  else if(doWhat==='use-sound') { const post=findPost(postId); if(post) { chosenSound=post.sound || `original sound · ${post.user}`;showCreate(chosenSound); } }
  else if(doWhat==='response') { const post=findPost(postId); if(post) { chosenSound=post.sound || `original sound · ${post.user}`;closeSheet();showCreate(chosenSound); } }
  else if(doWhat==='report')openReport(postId);
  else if(doWhat==='report-user')openReport('',user);
  else if(doWhat==='tag') { searchQuery=tag;showView('discover');requestAnimationFrame(()=>{const input=document.getElementById('searchInput');if(input){input.value=tag;input.dispatchEvent(new Event('input'));input.focus();}}); }
  else if(doWhat==='topic')openTopic(topic,tag);
  else if(doWhat==='clear-topic') {selectedTopic='';searchQuery='';showView('discover');}
  else if(doWhat==='creator-suggestions') {const list=viewRoot.querySelector('.creator-list');if(list)list.innerHTML=creatorSuggestions.filter(person=>!state.blocked.includes(person.user)).map(renderCreator).join('');action.remove();}
  else if(doWhat==='open-post')openPostInFeed(postId);
  else if(doWhat==='edit-profile')openEditProfile();
  else if(doWhat==='share-profile') {
    const link=`${location.href}#@${state.profile.handle}`;
    if(navigator.clipboard) navigator.clipboard.writeText(link).then(()=>showToast('Profile link copied.')).catch(()=>showToast(`Your handle is @${state.profile.handle}`));
    else showToast(`Your handle is @${state.profile.handle}`);
  }
  else if(doWhat==='open-chat') { activeChatId=action.dataset.chatId;state.inboxRead=true;saveState();renderInbox(); }
  else if(doWhat==='back-inbox') { activeChatId=null;renderInbox(); }
  else if(doWhat==='toggle-private') { state.privateAccount=!state.privateAccount;saveState();renderSettings();showToast('Privacy preference saved on this device.'); }
  else if(doWhat==='toggle-autoplay') { state.autoplay=!state.autoplay;saveState();renderSettings(); }
  else if(doWhat==='go-feed')showView('feed');
  else if(doWhat==='join-live')openSheet('Loop Live Lounge',`<div class="live-hero" style="margin:0"><span class="live-tag">ROOM PREVIEW</span><h2>Welcome to the lounge</h2><p>You are watching a visual demo. No camera or microphone is being broadcast.</p><button class="pill-button primary" data-action="close-sheet">Leave room</button></div>`);
  else if(doWhat==='notify-live')showToast('Reminder saved in this demo.');
  else if(doWhat==='export-data')exportData();
  else if(doWhat==='logout') { profileUnlocked=false;currentView='feed';closeSheet();renderPasswordGate(); }
  else if(doWhat==='save-draft')saveCurrentDraft();
  else if(doWhat==='install-app')installApp();
  else if(doWhat==='reset-demo')resetDemo();
});

app.addEventListener('change', event => {
  if(event.target.id==='videoFilter') {
    draftFilter=event.target.value;
    const video=overlay.querySelector('.upload-preview video'); if(video)video.style.filter=filterCss(draftFilter);
  }
  if(event.target.id==='videoPicker') {
    const file=event.target.files?.[0]; if(!file)return;
    if(!file.type.startsWith('video/')) { showToast('Choose a video file.'); event.target.value=''; return; }
    if(activeDraft)activeDraft={...activeDraft,blob:file};
    draftFile=file; if(draftUrl)URL.revokeObjectURL(draftUrl); draftUrl=URL.createObjectURL(file);showCreate(chosenSound);event.target.value='';
  }
  if(event.target.id==='avatarPicker') {
    const file=event.target.files?.[0];if(!file)return;
    const reader=new FileReader();reader.onload=()=>{state.profile.avatarData=reader.result;saveState();renderProfile();showToast('Profile photo updated.');};reader.readAsDataURL(file);event.target.value='';
  }
});

app.addEventListener('input', event => {
  if(event.target.id==='searchInput') { searchQuery=event.target.value;renderSearchResults(); }
});

app.addEventListener('submit', async event => {
  const form=event.target.closest('form[data-form]'); if(!form)return;
  event.preventDefault(); const values=new FormData(form); const kind=form.dataset.form;
  if(kind==='signup') {
    const name=String(values.get('name')||'').trim();
    const handle=String(values.get('handle')||'').trim().replace(/^@/,'').toLowerCase();
    const password=String(values.get('password')||'');
    const passwordConfirm=String(values.get('passwordConfirm')||'');
    if(name.length<1 || !/^[a-zA-Z0-9._]{3,24}$/.test(handle)) { showSignupMessage('Enter a name and a valid username.'); return; }
    if(password.length<8) { showSignupMessage('Use a password with at least 8 characters.'); return; }
    if(password!==passwordConfirm) { showSignupMessage('Those passwords do not match.'); return; }
    let credential;
    try { credential=await hashPassword(password); } catch(error) { showSignupMessage(error.message || 'Password protection is unavailable.'); return; }
    state.profile.name=name.slice(0,40);state.profile.handle=handle;state.passwordSalt=credential.salt;state.passwordHash=credential.hash;state.profileReady=true;profileUnlocked=true;saveState();
    app.classList.remove('signup-mode');currentView='feed';renderFeed();loadLocalVideos();showToast(`Welcome to Loop, ${state.profile.name}!`);
  } else if(kind==='local-login') {
    const handle=String(values.get('handle')||'').trim().replace(/^@/,'').toLowerCase();
    const password=String(values.get('password')||'');
    if(!state.profileReady || !hasLocalPassword()) {
      showSignupMessage('No account is saved on this device. Create a profile here or log in on the device where you created it.');
      document.getElementById('loginPassword')?.focus();return;
    }
    if(handle!==String(state.profile.handle||'').toLowerCase()) {
      showSignupMessage('We could not find that username and password on this device. Check them and try again.');
      document.getElementById('loginPassword')?.focus();return;
    }
    let credential;
    try { credential=await hashPassword(password,state.passwordSalt); } catch(error) { showSignupMessage(error.message || 'Password protection is unavailable.'); return; }
    if(credential.hash!==state.passwordHash) { showSignupMessage('We could not find that username and password on this device. Check them and try again.'); form.reset();document.getElementById('loginHandle').value=handle;document.getElementById('loginPassword')?.focus();return; }
    profileUnlocked=true;app.classList.remove('signup-mode');currentView='feed';renderFeed();loadLocalVideos();
  } else if(kind==='comment') {
    const text=String(values.get('comment')||'').trim();const post=findPost(activePostId);if(!text||!post)return;
    const next={user:state.profile.handle,text,createdAt:Date.now()};state.comments[post.id]=[...(state.comments[post.id]||[]),next];saveState();closeSheet();
    const button=viewRoot.querySelector(`[data-action="comments"][data-post-id="${CSS.escape(post.id)}"] .count`);if(button)button.textContent=compact(commentCount(post));showToast('Comment added to this device.');
  } else if(kind==='profile') {
    state.profile.name=String(values.get('name')||'').trim()||'New creator';
    state.profile.handle=String(values.get('handle')||'you.loop').trim().replace(/^@/,'').replace(/[^a-zA-Z0-9._]/g,'').slice(0,24)||'you.loop';
    state.profile.bio=String(values.get('bio')||'').trim();saveState();closeSheet();renderProfile();showToast('Profile updated.');
  } else if(kind==='create') {
    if(!draftFile) { showToast('Choose a video first.'); return; }
    state.acceptedTerms=true;
    const id=`your-loop-${Date.now()}`;
    const tags=String(values.get('tags')||'').split(/[\s,#]+/).filter(Boolean).slice(0,5);
    const post={id,user:state.profile.handle,isOwn:true,name:state.profile.name,avatar:state.profile.avatar,caption:String(values.get('caption')||'A new loop').trim()||'A new loop',tags,sound:String(values.get('sound')||'original sound · you').trim(),likes:0,comments:0,scene:'video',topic:String(values.get('topic')||'Everyday'),mediaUrl:URL.createObjectURL(draftFile),filter:String(values.get('filter')||'none'),createdAt:Date.now()};
    try { await saveVideoRecord({id,blob:draftFile,caption:post.caption,tags,sound:post.sound,topic:post.topic,filter:post.filter,createdAt:post.createdAt}); }
    catch { showToast('Browser storage unavailable; this video lasts until this tab closes.'); }
    if(activeDraft) { try { await deleteDraftRecord(activeDraft.id);savedDrafts=savedDrafts.filter(item=>item.id!==activeDraft.id); } catch {} }
    uploadedPosts.unshift(post);state.saves=state.saves.filter(saved=>saved!==id);saveState();
    activeDraft=null;draftFile=null;if(draftUrl)URL.revokeObjectURL(draftUrl);draftUrl='';chosenSound='';draftFilter='none';closeSheet();currentFeed='For You';selectedTopic='';showView('feed');showToast('Your loop was added to this browser.');
    setTimeout(()=>{const scroller=document.getElementById('feedScroller');scroller?.scrollTo({top:0,behavior:'smooth'});},30);
  } else if(kind==='message') {
    const text=String(values.get('message')||'').trim();if(!text||!activeChatId)return;
    const messages=state.chats[activeChatId] || (conversations.find(item=>item.id===activeChatId)?.starter||[]).map(row=>({side:row[0],text:row[1]}));
    messages.push({side:'you',text});state.chats[activeChatId]=messages;saveState();renderChat(activeChatId);
  } else if(kind==='report') {
    state.reports.push({postId:form.dataset.postId||'',user:form.dataset.user||'',reason:String(values.get('reason')||'Something else'),createdAt:Date.now()});saveState();closeSheet();showToast('Report saved on this device; no moderator was notified.');
  }
});

function exportData() {
  const content=JSON.stringify({profile:state.profile,following:state.following,likes:state.likes,saves:state.saves,comments:state.comments,blocked:state.blocked,reports:state.reports,chats:state.chats},null,2);
  const link=document.createElement('a');link.href=URL.createObjectURL(new Blob([content],{type:'application/json'}));link.download='loop-profile-data.json';link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);showToast('Profile data exported.');
}
async function resetDemo() {
  const okay=window.confirm('Delete local profile data, uploaded videos, and saved drafts for this demo?'); if(!okay)return;
  localStorage.removeItem(KEY);state={...blankState,profile:{...blankState.profile},following:[],likes:[],saves:[],comments:{},chats:{},privateAccount:false,autoplay:true,inboxRead:false,blocked:[],reports:[],acceptedTerms:false};uploadedPosts.forEach(post=>{if(post.mediaUrl)URL.revokeObjectURL(post.mediaUrl);});uploadedPosts=[];savedDrafts=[];activeDraft=null;draftFile=null;currentVideoId='';if(draftUrl)URL.revokeObjectURL(draftUrl);draftUrl='';
  try { const db=await openDatabase(); await new Promise(resolve=>{const tx=db.transaction(['videos','drafts'],'readwrite');tx.objectStore('videos').clear();tx.objectStore('drafts').clear();tx.oncomplete=resolve;tx.onerror=resolve;}); } catch {}
  saveState();profileUnlocked=false;profileTab='Videos';showView('feed');showToast('Demo reset.');
}
async function loadLocalVideos() {
  try {
    const [records,drafts]=await Promise.all([getSavedVideos(),getSavedDrafts()]);
    uploadedPosts=records.sort((a,b)=>b.createdAt-a.createdAt).map(record=>({id:record.id,user:state.profile.handle,isOwn:true,name:state.profile.name,avatar:state.profile.avatar,caption:record.caption,tags:record.tags||[],sound:record.sound,likes:0,comments:0,scene:'video',topic:record.topic,mediaUrl:URL.createObjectURL(record.blob),filter:record.filter,createdAt:record.createdAt}));
    savedDrafts=drafts;
  } catch { uploadedPosts=[]; }
  if(currentView==='feed')renderFeed();
  else if(currentView==='studio')renderStudio();
}

async function installApp() {
  const installed=window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone===true;
  if(installed) { showToast('Loop is already installed on this device.');return; }
  if(installPrompt) {
    const promptEvent=installPrompt;installPrompt=null;
    try {
      await promptEvent.prompt();
      const result=await promptEvent.userChoice;
      showToast(result.outcome==='accepted'?'Loop is installing.':'You can install Loop later from your browser menu.');
    } catch { showInstallGuide(); }
    return;
  }
  showInstallGuide();
}
function showInstallGuide() {
  const secure=location.protocol==='https:' || ['localhost','127.0.0.1'].includes(location.hostname);
  const ios=/iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
  let content;
  if(!secure) {
    content=`<div class="live-hero" style="margin:0"><span class="live-tag">WEB APP</span><h2>One more step</h2><p>This preview is opened as a local file. To install Loop, the owner needs to host the project on a secure HTTPS website first. Once it is hosted, return here and tap Download.</p><button class="pill-button" data-action="close-sheet">Got it</button></div>`;
  } else if(ios) {
    content=`<div class="live-hero" style="margin:0"><span class="live-tag">INSTALL LOOP</span><h2>Add Loop to your Home Screen</h2><ol><li>Open this hosted page in Safari.</li><li>Tap the Share button.</li><li>Choose <b>Add to Home Screen</b>, then tap Add.</li></ol><button class="pill-button" data-action="close-sheet">Got it</button></div>`;
  } else {
    content=`<div class="live-hero" style="margin:0"><span class="live-tag">INSTALL LOOP</span><h2>Get the app on this device</h2><p>Open your browser menu and choose <b>Install Loop</b> or <b>Add to Home Screen</b>. The exact wording depends on your browser.</p><button class="pill-button" data-action="close-sheet">Got it</button></div>`;
  }
  openSheet('Download Loop',content);
}

window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;});
window.addEventListener('appinstalled',()=>{installPrompt=null;showToast('Loop has been installed.');});
if('serviceWorker' in navigator && (location.protocol==='https:' || ['localhost','127.0.0.1'].includes(location.hostname))) {
  window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js').catch(()=>showToast('Offline support could not start in this browser.')));
}

if(state.profileReady && hasLocalPassword()) renderPasswordGate();
else if(state.profileReady) { profileUnlocked=true;renderFeed();loadLocalVideos(); }
else renderSignup();
