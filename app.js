// ============================================================================
// SAB WELLS PERSONAL TRAINING — APP LOGIC
// Vanilla JS, single file, backed by Supabase (auth + database + storage +
// realtime). See SETUP.md for how to point this at your own Supabase project.
// ============================================================================

// ---- 1. CONFIG --------------------------------------------------------------
// Replace these two values with your own Supabase project's URL and
// publishable/anon key (Project Settings -> API in the Supabase dashboard).
const SUPABASE_URL = 'https://ybavzvrlaoslzdjhcmfv.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_cgCFeKEOKKG0oMOXQ5nkKQ_W1e0Pgg4';

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const LOGO_IMG = 'logo.webp';

// Swap the placeholder SVG marks in the static HTML for the real logo image,
// and size the hero badge to show it properly.
function applyBrandLogo(){
  document.querySelectorAll('svg.mark').forEach(svg => {
    const img = document.createElement('img');
    img.src = LOGO_IMG;
    img.alt = 'Sab Wells Personal Training';
    img.className = svg.getAttribute('class') || 'mark';
    const w = svg.getAttribute('width');
    const h = svg.getAttribute('height');
    if(w) img.setAttribute('width', w);
    if(h) img.setAttribute('height', h);
    img.style.objectFit = 'contain';
    img.style.borderRadius = 'inherit';
    svg.replaceWith(img);
  });
  const heroDiamond = document.querySelector('.hero-badge-diamond');
  if(heroDiamond){
    heroDiamond.innerHTML = `<img src="${LOGO_IMG}" alt="Sab Wells Personal Training" style="width:100%;height:100%;object-fit:contain;">`;
  }
}
applyBrandLogo();


// ---- 2. GLOBAL STATE ---------------------------------------------------------
const STATE = {
  user: null,           // auth user object
  profile: null,        // profiles row for the logged-in person
  isAdmin: false,
  currentView: 'dashboard',
  exercises: [],         // full library, cached
  clients: [],           // admin only: all client profiles
  adminSelectedClientId: null, // which client the admin is currently viewing/programming
  chatThreadClientId: null,    // which client's thread is open in Chat view
  messagesChannel: null,
  messagesCache: {},     // clientId -> [messages]
  recorder: null,
  recordedChunks: [],
  recordingStream: null,
  pendingAttachment: null, // { file, type } queued for next chat send
};

// ---- 3. ICONS (inline SVG, currentColor) -------------------------------------
const ICON = {
  home: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/></svg>`,
  calendar: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>`,
  dumbbell: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 6.5l11 11M4 9l3-3 3 3-3 3-3-3zM14 19l3-3 3 3-3 3-3-3zM2 12l2-2M20 14l2-2"/></svg>`,
  chat: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.4 8.4 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.4 8.4 0 01-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.4 8.4 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>`,
  settings: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 004.6 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.6a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>`,
  users: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>`,
  inbox: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z"/></svg>`,
  send: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>`,
  paperclip: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>`,
  camera: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>`,
  plus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>`,
  chevronLeft: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>`,
  logout: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>`,
  play: `<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"/></svg>`,
  x: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>`,
  check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>`,
  trash: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z"/></svg>`,
  trending: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 6l-9.5 9.5-5-5L1 18"/><path d="M17 6h6v6"/></svg>`,
  mic: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0014 0M12 19v3"/></svg>`,
  stop: `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="5" width="14" height="14" rx="2"/></svg>`,
  flip: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 2l4 4-4 4"/><path d="M3 11V9a4 4 0 014-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a4 4 0 01-4 4H3"/></svg>`,
  recordDot: `<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="8"/></svg>`,
  key: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>`,
};

// ---- 4. UTILITIES ------------------------------------------------------------
const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

function escapeHtml(str){
  if(str === null || str === undefined) return '';
  return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function initials(name){
  if(!name) return '?';
  return name.trim().split(/\s+/).map(p => p[0]).slice(0,2).join('').toUpperCase();
}

function fmtDate(d){
  if(!d) return '';
  const dt = new Date(d + (String(d).length <= 10 ? 'T00:00:00' : ''));
  return dt.toLocaleDateString('en-AU', { weekday:'short', day:'numeric', month:'short' });
}
function sessionDateLabel(s){
  return s.scheduled_date ? fmtDate(s.scheduled_date) : 'No date set yet';
}
function fmtDateShort(d){
  if(!d) return '';
  const dt = new Date(d + (String(d).length <= 10 ? 'T00:00:00' : ''));
  return dt.toLocaleDateString('en-AU', { day:'numeric', month:'short', year:'numeric' });
}
function timeAgo(iso){
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if(diff < 60) return 'just now';
  if(diff < 3600) return Math.floor(diff/60) + 'm ago';
  if(diff < 86400) return Math.floor(diff/3600) + 'h ago';
  if(diff < 86400*7) return Math.floor(diff/86400) + 'd ago';
  return new Date(iso).toLocaleDateString('en-AU', { day:'numeric', month:'short' });
}
function msgTime(iso){
  return new Date(iso).toLocaleTimeString('en-AU', { hour:'numeric', minute:'2-digit' });
}

function toast(msg, type='default'){
  const stack = $('#toast-stack');
  const el = document.createElement('div');
  el.className = 'toast' + (type !== 'default' ? ' ' + type : '');
  el.innerHTML = `<span>${escapeHtml(msg)}</span>`;
  stack.appendChild(el);
  setTimeout(() => { el.style.opacity='0'; el.style.transition='opacity .3s'; setTimeout(()=>el.remove(), 300); }, 3600);
}

function openModal(innerHtml){
  const root = $('#modal-root');
  root.innerHTML = `<div class="modal-backdrop" id="active-modal-backdrop"><div class="modal">${innerHtml}</div></div>`;
  $('#active-modal-backdrop').addEventListener('click', (e) => {
    if(e.target.id === 'active-modal-backdrop') closeModal();
  });
}
function closeModal(){ $('#modal-root').innerHTML = ''; }

function setLoading(btn, loading, labelWhenDone){
  if(!btn) return;
  if(loading){
    btn.dataset.origLabel = btn.innerHTML;
    btn.innerHTML = `<span class="spinner"></span>`;
    btn.disabled = true;
  } else {
    btn.innerHTML = labelWhenDone || btn.dataset.origLabel || btn.innerHTML;
    btn.disabled = false;
  }
}

function isYoutube(url){ return /youtube\.com|youtu\.be/.test(url || ''); }
function youtubeEmbed(url){
  let id = '';
  const m1 = url.match(/[?&]v=([^&]+)/);
  const m2 = url.match(/youtu\.be\/([^?&]+)/);
  if(m1) id = m1[1]; else if(m2) id = m2[1];
  return `https://www.youtube.com/embed/${id}`;
}

// ============================================================================
// AUTH
// ============================================================================

// Register this immediately (before initAuth runs) so a password-recovery
// link in the URL is never missed — Supabase can fire that event as soon as
// the client processes the page load.
let recoveryInProgress = false;
sb.auth.onAuthStateChange(async (event, session) => {
  if(event === 'PASSWORD_RECOVERY'){
    recoveryInProgress = true;
    STATE.user = session.user;
    const { data: profile } = await sb.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
    STATE.profile = profile;
    STATE.isAdmin = profile && profile.role === 'admin';
    showAuth('set-password');
    $('#global-loader').style.display = 'none';
    return;
  }
  if(event === 'SIGNED_OUT'){
    STATE.user = null; STATE.profile = null;
    showLanding();
  }
});

async function initAuth(){
  try {
    // give a recovery link a moment to be processed first, if there is one
    await new Promise(r => setTimeout(r, 150));
    if(recoveryInProgress) return;
    const { data: { session } } = await sb.auth.getSession();
    if(session && session.user){
      await handleLoggedIn(session.user);
    } else {
      showLanding();
    }
  } catch (err) {
    console.error('Startup error:', err);
    showLanding();
  } finally {
    $('#global-loader').style.display = 'none';
  }
}

// Last-resort safety net: if anything anywhere goes wrong during startup and
// the loader is somehow still showing after 6 seconds, force it away rather
// than leave the person staring at a spinner forever.
setTimeout(() => {
  const loader = document.getElementById('global-loader');
  if(loader && loader.style.display !== 'none'){
    console.warn('Startup took too long — showing the landing page as a fallback.');
    loader.style.display = 'none';
    showLanding();
  }
}, 6000);

async function handleLoggedIn(user){
  STATE.user = user;
  const { data: profile, error } = await sb.from('profiles').select('*').eq('id', user.id).maybeSingle();
  if(error || !profile){
    toast('Could not load your profile. Please contact Sab.', 'error');
    await sb.auth.signOut();
    showLanding();
    return;
  }
  STATE.profile = profile;
  STATE.isAdmin = profile.role === 'admin';

  if(profile.is_active === false){
    await sb.auth.signOut();
    toast('Your access has been paused. Please get in touch with Sab to have it restored.', 'error');
    showLanding();
    return;
  }

  if(profile.must_change_password){
    showAuth('set-password');
    return;
  }
  await enterApp();
}

async function enterApp(){
  document.getElementById('landing-view').style.display = 'none';
  document.getElementById('auth-view').style.display = 'none';
  document.getElementById('app-shell').style.display = 'block';
  buildSidebar();
  buildBottomNav();
  updateProfileWidgets();
  if(STATE.isAdmin){
    await loadClients();
  }
  await loadExercises();
  navigate(STATE.isAdmin ? 'clients' : 'dashboard');
  subscribeMessages();
}

function showLanding(){
  document.getElementById('app-shell').style.display = 'none';
  document.getElementById('auth-view').style.display = 'none';
  document.getElementById('landing-view').style.display = 'block';
}
function showAuth(panel){
  document.getElementById('landing-view').style.display = 'none';
  document.getElementById('app-shell').style.display = 'none';
  const authView = document.getElementById('auth-view');
  authView.style.display = 'flex';
  $('#login-panel').style.display = panel === 'login' ? 'block' : 'none';
  $('#set-password-panel').style.display = panel === 'set-password' ? 'block' : 'none';
}

$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = $('#login-submit-btn');
  const errEl = $('#login-error');
  errEl.style.display = 'none';
  setLoading(btn, true);
  const email = $('#login-email').value.trim();
  const password = $('#login-password').value;
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  setLoading(btn, false, 'Log in');
  if(error){
    console.error('Login error:', error);
    errEl.textContent = error.message === 'Invalid login credentials'
      ? 'That email and password combination doesn\'t match our records. Double check and try again, or use "Forgot your password?" below.'
      : 'Could not log in: ' + error.message;
    errEl.style.display = 'block';
    return;
  }
  await handleLoggedIn(data.user);
});

$('#forgot-password-link').addEventListener('click', async (e) => {
  e.preventDefault();
  const email = ($('#login-email').value || '').trim() || prompt('Enter the email address you log in with:');
  if(!email) return;
  const link = $('#forgot-password-link');
  const original = link.textContent;
  link.textContent = 'Sending...';
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + window.location.pathname });
  link.textContent = original;
  if(error){ toast('Could not send a reset email: ' + error.message, 'error'); return; }
  toast('If that email has an account, a reset link is on its way — check your inbox.', 'success');
});

$('#set-password-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = $('#set-password-submit-btn');
  const errEl = $('#set-password-error');
  errEl.style.display = 'none';
  const p1 = $('#new-password-1').value;
  const p2 = $('#new-password-2').value;
  if(p1.length < 8){ errEl.textContent = 'Password must be at least 8 characters.'; errEl.style.display='block'; return; }
  if(p1 !== p2){ errEl.textContent = 'Passwords don\'t match.'; errEl.style.display='block'; return; }
  setLoading(btn, true);
  const { error: upErr } = await sb.auth.updateUser({ password: p1 });
  if(upErr){ setLoading(btn, false, 'Save password & continue'); errEl.textContent = upErr.message; errEl.style.display='block'; return; }
  const { error: profErr } = await sb.from('profiles').update({ must_change_password: false }).eq('id', STATE.user.id);
  setLoading(btn, false, 'Save password & continue');
  if(profErr){ toast('Password updated but something went wrong finishing setup — try refreshing.', 'error'); }
  STATE.profile.must_change_password = false;
  recoveryInProgress = false;
  toast('Password set. Welcome in!', 'success');
  await enterApp();
});

async function logout(){
  await sb.auth.signOut();
  if(STATE.messagesChannel) sb.removeChannel(STATE.messagesChannel);
  showLanding();
}


// ---- landing / global nav bindings -------------------------------------------
document.addEventListener('click', (e) => {
  const navBtn = e.target.closest('[data-nav]');
  if(navBtn){
    const target = navBtn.dataset.nav;
    if(target === 'login') showAuth('login');
    if(target === 'landing') showLanding();
  }
});
$('#footer-year').textContent = new Date().getFullYear();

function speakToSabsModal(){
  openModal(`
    <div class="modal-head">
      <h3>Speak to Sabs</h3>
      <button class="modal-close" onclick="closeModal()">${ICON.x}</button>
    </div>
    <p class="text-muted" style="font-size:14px;margin-bottom:18px;">Tell Sab a bit about what you're after — he reads every message personally and will follow up directly to get you set up.</p>
    <form id="contact-form">
      <div class="field"><label>Your name</label><input required id="contact-name" /></div>
      <div class="field"><label>Email</label><input type="email" required id="contact-email" /></div>
      <div class="field"><label>Phone (optional)</label><input id="contact-phone" /></div>
      <div class="field">
        <label>What are you training for?</label>
        <select id="contact-goal">
          <option>General fitness</option>
          <option>Weight loss</option>
          <option>Strength / powerlifting</option>
          <option>Muscle gain</option>
          <option>Sport-specific performance</option>
          <option>Returning after injury</option>
          <option>Other</option>
        </select>
      </div>
      <div class="field"><label>Tell Sab a bit more</label><textarea id="contact-message" placeholder="Your training background, schedule, any injuries, what you're hoping to achieve..."></textarea></div>
      <button class="btn btn-gold btn-block" id="contact-submit-btn" type="submit">Send to Sabs</button>
    </form>
  `);
  $('#contact-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('#contact-submit-btn');
    setLoading(btn, true);
    const { error } = await sb.from('contact_requests').insert({
      name: $('#contact-name').value.trim(),
      email: $('#contact-email').value.trim(),
      phone: $('#contact-phone').value.trim(),
      training_goal: $('#contact-goal').value,
      message: $('#contact-message').value.trim(),
    });
    setLoading(btn, false, 'Send to Sabs');
    if(error){ toast('Something went wrong sending that — mind trying again?', 'error'); return; }
    closeModal();
    toast('Message sent — Sab will be in touch soon.', 'success');
  });
}
$('#speak-to-sabs-btn').addEventListener('click', speakToSabsModal);
$('#speak-to-sabs-btn-2').addEventListener('click', speakToSabsModal);

initAuth();

// ============================================================================
// NAVIGATION / SHELL
// ============================================================================

function navConfig(){
  if(STATE.isAdmin){
    return [
      { id:'clients', label:'Clients', icon:ICON.users },
      { id:'library', label:'Library', icon:ICON.dumbbell },
      { id:'chat', label:'Messages', icon:ICON.chat },
      { id:'inbox', label:'Inbox', icon:ICON.inbox },
      { id:'settings', label:'Settings', icon:ICON.settings },
    ];
  }
  return [
    { id:'dashboard', label:'Dashboard', icon:ICON.home },
    { id:'sessions', label:'Sessions', icon:ICON.calendar },
    { id:'library', label:'Library', icon:ICON.dumbbell },
    { id:'chat', label:'Messages', icon:ICON.chat },
    { id:'settings', label:'Settings', icon:ICON.settings },
  ];
}

function buildSidebar(){
  const items = navConfig();
  const sidebar = $('#sidebar');
  sidebar.innerHTML = `
    <div class="sidebar-brand">
      <div class="mark" style="overflow:hidden;background:none;padding:0;"><img src="${LOGO_IMG}" alt="Sab Wells Personal Training" style="width:100%;height:100%;object-fit:cover;"></div>
      <div class="name">Sab Wells<small>Personal Training</small></div>
    </div>
    <div id="sidebar-nav-items"></div>
    <div class="sidebar-footer">
      <div class="mini-profile" id="sidebar-profile-btn"></div>
      <button class="nav-item" id="sidebar-logout-btn" style="margin-top:6px;">${ICON.logout}<span>Log out</span></button>
    </div>
  `;
  renderNavItems($('#sidebar-nav-items'), items, true);
  $('#sidebar-logout-btn').addEventListener('click', logout);
  $('#sidebar-profile-btn').addEventListener('click', () => navigate('settings'));
}

function buildBottomNav(){
  const items = navConfig();
  const nav = $('#bottom-nav');
  nav.innerHTML = '';
  renderNavItems(nav, items, false);
}

function renderNavItems(container, items, withLabelBlock){
  container.innerHTML = items.map(it => `
    <button class="nav-item" data-view="${it.id}">
      ${it.icon}<span>${it.label}</span>
      ${it.id === 'inbox' ? '<span class="dot" id="inbox-dot" style="display:none;"></span>' : ''}
      ${it.id === 'chat' && !STATE.isAdmin ? '<span class="dot" id="chat-dot" style="display:none;"></span>' : ''}
    </button>
  `).join('');
  $$('button[data-view]', container).forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.view));
  });
}

function updateProfileWidgets(){
  const p = STATE.profile;
  const html = `
    <div class="avatar">${p.avatar_url ? `<img src="${p.avatar_url}">` : initials(p.full_name)}</div>
    <div class="who"><div class="n">${escapeHtml(p.full_name)}</div><div class="r">${STATE.isAdmin ? 'Trainer' : 'Client'}</div></div>
  `;
  const sp = $('#sidebar-profile-btn'); if(sp) sp.innerHTML = html;
  const tp = $('#topbar-profile-btn');
  if(tp){
    tp.innerHTML = `<div class="avatar">${p.avatar_url ? `<img src="${p.avatar_url}">` : initials(p.full_name)}</div>`;
    tp.onclick = () => navigate('settings');
  }
}

function navigate(view){
  STATE.currentView = view;
  $$('.view').forEach(v => v.classList.remove('active'));
  const target = $('#view-' + view);
  if(target) target.classList.add('active');
  $$('#sidebar [data-view], #bottom-nav [data-view]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });
  const renderers = {
    dashboard: renderDashboard,
    sessions: renderSessions,
    library: renderLibrary,
    chat: renderChat,
    settings: renderSettings,
    clients: renderClients,
    inbox: renderInbox,
  };
  if(renderers[view]) renderers[view]();
}

// ============================================================================
// DATA LOADING
// ============================================================================

async function loadClients(){
  const { data, error } = await sb.from('profiles').select('*').eq('role','client').order('full_name');
  if(error){ toast('Could not load clients.', 'error'); return; }
  STATE.clients = data || [];
  if(!STATE.adminSelectedClientId && STATE.clients.length){
    STATE.adminSelectedClientId = STATE.clients[0].id;
  }
}

async function loadExercises(){
  const { data, error } = await sb.from('exercises').select('*').order('name');
  if(error){ toast('Could not load the exercise library.', 'error'); return; }
  STATE.exercises = data || [];
}

async function fetchClientBundle(clientId){
  const [bodyStats, orms, sessions] = await Promise.all([
    sb.from('body_stats').select('*').eq('client_id', clientId).order('logged_at', { ascending:false }),
    sb.from('one_rep_maxes').select('*').eq('client_id', clientId).order('achieved_on', { ascending:false }),
    sb.from('sessions').select('*, session_exercises(*, exercises(*))').eq('client_id', clientId).order('scheduled_date', { ascending:false, nullsFirst:false }),
  ]);
  return {
    bodyStats: bodyStats.data || [],
    orms: orms.data || [],
    sessions: (sessions.data || []).map(s => ({ ...s, session_exercises: (s.session_exercises||[]).sort((a,b)=>a.order_index-b.order_index) })),
  };
}

async function fetchClientProfile(clientId){
  const { data } = await sb.from('profiles').select('*').eq('id', clientId).maybeSingle();
  return data;
}

// ============================================================================
// DASHBOARD (client)
// ============================================================================

async function renderDashboard(){
  const el = $('#view-dashboard');
  el.innerHTML = `<div class="grid grid-2"><div class="skeleton" style="height:120px;"></div><div class="skeleton" style="height:120px;"></div></div>`;
  const bundle = await fetchClientBundle(STATE.profile.id);
  const upcoming = bundle.sessions.filter(s => s.status === 'upcoming');
  const datedUpcoming = upcoming.filter(s => s.scheduled_date).sort((a,b)=> new Date(a.scheduled_date)-new Date(b.scheduled_date));
  const next = datedUpcoming[0] || upcoming[0];
  const latestWeight = bundle.bodyStats[0];
  const prevWeight = bundle.bodyStats[1];
  const weightDelta = (latestWeight && prevWeight && latestWeight.weight_kg && prevWeight.weight_kg) ? (latestWeight.weight_kg - prevWeight.weight_kg) : null;

  const topLifts = {};
  bundle.orms.forEach(o => { if(!topLifts[o.lift_name] || o.weight_kg > topLifts[o.lift_name].weight_kg) topLifts[o.lift_name] = o; });
  const liftList = Object.values(topLifts).slice(0,3);

  const sparkPoints = bundle.bodyStats.slice(0,8).reverse().filter(b=>b.weight_kg);
  const sparkSvg = sparkline(sparkPoints.map(p=>p.weight_kg));

  el.innerHTML = `
    <div class="page-head">
      <div>
        <div class="eyebrow">Welcome back</div>
        <h1>${escapeHtml(STATE.profile.full_name.split(' ')[0])}'s dashboard</h1>
      </div>
    </div>

    <div class="grid grid-3" style="margin-bottom:22px;">
      <div class="card stat-card">
        <div class="eyebrow">Current weight</div>
        <div class="val">${latestWeight && latestWeight.weight_kg ? latestWeight.weight_kg + ' kg' : '—'}</div>
        <div class="sub">${weightDelta !== null ? (weightDelta <= 0 ? '↓' : '↑') + ' ' + Math.abs(weightDelta).toFixed(1) + ' kg since last check-in' : 'Log a check-in to start tracking'}</div>
        ${sparkSvg}
      </div>
      <div class="card stat-card">
        <div class="eyebrow">Next session</div>
        <div class="val" style="font-size:20px;">${next ? escapeHtml(next.title) : 'Nothing scheduled'}</div>
        <div class="sub">${next ? sessionDateLabel(next) : 'Sab will program your next session soon'}</div>
        ${next ? `<button class="btn btn-outline btn-sm" style="margin-top:14px;" onclick="navigate('sessions')">View session</button>` : ''}
      </div>
      <div class="card stat-card">
        <div class="eyebrow">Sessions completed</div>
        <div class="val">${bundle.sessions.filter(s=>s.status==='completed').length}</div>
        <div class="sub">${upcoming.length} upcoming</div>
      </div>
    </div>

    <div class="grid grid-2">
      <div class="card">
        <h3 style="margin-bottom:16px;font-size:16px;">Best lifts</h3>
        ${liftList.length ? liftList.map((l,i) => `
          <div style="display:flex;justify-content:space-between;padding:10px 0;${i>0?'border-top:1px solid var(--border-soft);':''}">
            <span style="font-size:14.5px;">${escapeHtml(l.lift_name)}</span>
            <span class="mono" style="color:var(--gold);font-weight:600;">${l.weight_kg} kg</span>
          </div>`).join('')
          : `<div class="empty-state" style="padding:24px;"><p>No lifts logged yet — add one from Settings.</p></div>`}
        <button class="btn btn-ghost btn-sm" style="margin-top:12px;padding-left:0;" onclick="navigate('settings')">Log a new lift &rarr;</button>
      </div>
      <div class="card">
        <h3 style="margin-bottom:16px;font-size:16px;">Latest from Sab</h3>
        <div id="dash-chat-preview"><div class="skeleton" style="height:60px;"></div></div>
        <button class="btn btn-ghost btn-sm" style="margin-top:12px;padding-left:0;" onclick="navigate('chat')">Open messages &rarr;</button>
      </div>
    </div>
  `;

  const { data: recentMsgs } = await sb.from('messages').select('*').eq('client_id', STATE.profile.id).order('created_at', { ascending:false }).limit(1);
  const preview = $('#dash-chat-preview');
  if(recentMsgs && recentMsgs.length){
    const m = recentMsgs[0];
    preview.innerHTML = `<p style="font-size:14px;color:var(--text-muted);">${m.sender_id === STATE.profile.id ? 'You: ' : 'Sab: '}${escapeHtml((m.content || (m.attachment_type === 'video' ? 'Sent a video' : 'Sent an attachment')).slice(0,120))}</p><div class="hint">${timeAgo(m.created_at)}</div>`;
  } else {
    preview.innerHTML = `<p style="font-size:14px;color:var(--text-muted);">No messages yet — say hi!</p>`;
  }
}

function sparkline(values){
  if(values.length < 2) return '';
  const w = 220, h = 40, pad = 4;
  const min = Math.min(...values), max = Math.max(...values);
  const range = (max - min) || 1;
  const pts = values.map((v,i) => {
    const x = pad + (i/(values.length-1)) * (w - pad*2);
    const y = h - pad - ((v-min)/range) * (h - pad*2);
    return `${x},${y}`;
  }).join(' ');
  return `<svg viewBox="0 0 ${w} ${h}" style="margin-top:12px;width:100%;height:40px;"><polyline points="${pts}" fill="none" stroke="#e8b93f" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

// ============================================================================
// SESSIONS (client)
// ============================================================================

let sessionsTab = 'upcoming';

async function renderSessions(){
  const el = $('#view-sessions');
  el.innerHTML = `<div class="skeleton" style="height:200px;"></div>`;
  const bundle = await fetchClientBundle(STATE.profile.id);
  el.innerHTML = `
    <div class="page-head"><div><div class="eyebrow">Your program</div><h1>Sessions</h1></div></div>
    <div class="tabs">
      <button class="tab-btn" data-tab="upcoming">Upcoming</button>
      <button class="tab-btn" data-tab="completed">Completed</button>
      <button class="tab-btn" data-tab="missed">Missed</button>
    </div>
    <div id="sessions-list"></div>
  `;
  $$('.tab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === sessionsTab);
    b.addEventListener('click', () => { sessionsTab = b.dataset.tab; renderSessionsList(bundle.sessions); $$('.tab-btn').forEach(x=>x.classList.toggle('active', x.dataset.tab===sessionsTab)); });
  });
  renderSessionsList(bundle.sessions);
}

function renderSessionsList(sessions){
  const list = sessions.filter(s => s.status === sessionsTab).sort((a,b) => {
    if(!a.scheduled_date && !b.scheduled_date) return 0;
    if(!a.scheduled_date) return 1;
    if(!b.scheduled_date) return -1;
    return sessionsTab==='upcoming' ? new Date(a.scheduled_date)-new Date(b.scheduled_date) : new Date(b.scheduled_date)-new Date(a.scheduled_date);
  });
  const container = $('#sessions-list');
  if(!list.length){
    container.innerHTML = `<div class="empty-state"><h3>Nothing here yet</h3><p>${sessionsTab === 'upcoming' ? 'Sab hasn\'t programmed anything new — check back soon.' : 'Sessions will show up here once they\'re ' + sessionsTab + '.'}</p></div>`;
    return;
  }
  container.innerHTML = list.map(s => sessionCardHtml(s)).join('');
  list.forEach(s => bindSessionCard(s));
}

function sessionCardHtml(s){
  const badgeClass = s.status === 'upcoming' ? 'badge-upcoming' : s.status === 'completed' ? 'badge-completed' : 'badge-missed';
  return `
    <div class="card session-card" data-session-id="${s.id}">
      <div class="session-card-head">
        <div>
          <h3 style="font-size:17px;">${escapeHtml(s.title)}</h3>
          <div class="hint">${sessionDateLabel(s)}</div>
        </div>
        <span class="badge ${badgeClass}">${s.status}</span>
      </div>
      ${s.trainer_notes ? `<div style="background:var(--bg-elevated);border-radius:10px;padding:12px 14px;font-size:13.5px;color:var(--text-muted);margin-bottom:10px;"><strong style="color:var(--text);">Sab's notes:</strong> ${escapeHtml(s.trainer_notes)}</div>` : ''}
      <div class="ex-rows">
        ${s.session_exercises.map(se => sessionExerciseRow(se, s.status === 'upcoming')).join('')}
      </div>
      ${s.status === 'upcoming' ? `<button class="btn btn-gold btn-block mark-complete-btn" style="margin-top:14px;">Mark session complete</button>` : ''}
      ${s.status === 'completed' ? `
        <div class="field" style="margin-top:16px;">
          <label>Your feedback on this session</label>
          <textarea class="feedback-input" placeholder="How did it feel?">${escapeHtml(s.client_feedback || '')}</textarea>
        </div>
        <button class="btn btn-outline btn-sm save-feedback-btn">Save feedback</button>
      ` : ''}
    </div>
  `;
}

function sessionExerciseRow(se, editable){
  const ex = se.exercises || {};
  const actuals = se.actual_sets_json && se.actual_sets_json.length ? se.actual_sets_json : [];
  return `
    <div class="session-ex-row" data-se-id="${se.id}">
      <div>
        <div class="session-ex-name">${escapeHtml(ex.name || 'Exercise')}</div>
        <div class="session-ex-prescribed">${se.prescribed_sets ? se.prescribed_sets + ' x ' : ''}${escapeHtml(se.prescribed_reps || '')}${se.prescribed_weight_kg ? ' @ ' + se.prescribed_weight_kg + 'kg' : ''}${se.prescribed_time_seconds ? ' · ' + se.prescribed_time_seconds + 's' : ''}${se.target_rpe ? ' · target RPE ' + se.target_rpe : ''}${se.prescribed_rest_seconds ? ' · ' + se.prescribed_rest_seconds + 's rest' : ''}</div>
        ${se.notes ? `<div class="hint">${escapeHtml(se.notes)}</div>` : ''}
        ${actuals.length ? `<div class="hint mono" style="color:var(--success);margin-top:4px;">Logged: ${actuals.map(a=>`${a.reps?a.reps+' reps':(a.time?a.time+'s':'')}${a.weight?'@'+a.weight+'kg':''}${a.rpe?' RPE'+a.rpe:''}`).join(', ')}</div>` : ''}
      </div>
      ${editable ? `<button class="btn btn-outline btn-sm log-set-btn" data-ex-name="${escapeHtml(ex.name||'')}">Log</button>` : ''}
    </div>
  `;
}

function bindSessionCard(s){
  const card = $(`.session-card[data-session-id="${s.id}"]`);
  if(!card) return;
  const completeBtn = $('.mark-complete-btn', card);
  if(completeBtn) completeBtn.addEventListener('click', async () => {
    setLoading(completeBtn, true);
    const { error } = await sb.from('sessions').update({ status:'completed' }).eq('id', s.id);
    setLoading(completeBtn, false, 'Mark session complete');
    if(error){ toast('Could not update the session.', 'error'); return; }
    toast('Session marked complete — nice work.', 'success');
    renderSessions();
  });
  const feedbackBtn = $('.save-feedback-btn', card);
  if(feedbackBtn) feedbackBtn.addEventListener('click', async () => {
    const val = $('.feedback-input', card).value.trim();
    setLoading(feedbackBtn, true);
    const { error } = await sb.from('sessions').update({ client_feedback: val }).eq('id', s.id);
    setLoading(feedbackBtn, false, 'Save feedback');
    if(error){ toast('Could not save feedback.', 'error'); return; }
    toast('Feedback saved.', 'success');
  });
  $$('.log-set-btn', card).forEach(btn => {
    btn.addEventListener('click', () => {
      const seId = btn.closest('.session-ex-row').dataset.seId;
      openLogSetModal(seId, btn.dataset.exName);
    });
  });
}

function openLogSetModal(seId, exName){
  openModal(`
    <div class="modal-head"><h3>Log ${escapeHtml(exName)}</h3><button class="modal-close" onclick="closeModal()">${ICON.x}</button></div>
    <p class="hint" style="margin-bottom:14px;">Enter reps, or time for a hold/interval — whichever fits this exercise.</p>
    <div class="field"><label>Reps completed (optional)</label><input type="number" id="log-reps" placeholder="e.g. 8"/></div>
    <div class="field"><label>Time completed in seconds (optional)</label><input type="number" id="log-time" placeholder="e.g. 45"/></div>
    <div class="field"><label>Weight used (kg, optional)</label><input type="number" step="0.5" id="log-weight" placeholder="e.g. 40"/></div>
    <div class="field"><label>RPE (effort out of 10, optional)</label><input type="number" step="0.5" min="1" max="10" id="log-rpe" /></div>
    <button class="btn btn-gold btn-block" id="save-log-btn">Add set</button>
  `);
  $('#save-log-btn').addEventListener('click', async () => {
    const reps = parseFloat($('#log-reps').value) || null;
    const time = parseFloat($('#log-time').value) || null;
    const weight = parseFloat($('#log-weight').value) || null;
    const rpe = parseFloat($('#log-rpe').value) || null;
    if(!reps && !time){ toast('Enter either reps or time completed.', 'error'); return; }
    const btn = $('#save-log-btn'); setLoading(btn, true);
    const { data: current } = await sb.from('session_exercises').select('actual_sets_json').eq('id', seId).maybeSingle();
    const sets = (current && current.actual_sets_json) || [];
    sets.push({ reps, time, weight, rpe });
    const { error } = await sb.from('session_exercises').update({ actual_sets_json: sets }).eq('id', seId);
    setLoading(btn, false, 'Add set');
    if(error){ toast('Could not save that set.', 'error'); return; }
    closeModal();
    toast('Set logged.', 'success');
    renderSessions();
  });
}

// ============================================================================
// EXERCISE LIBRARY
// ============================================================================

let libraryFilters = { search:'', category:'', muscle:'' };

async function renderLibrary(){
  const el = $('#view-library');
  if(STATE.exercises.length === 0) await loadExercises();
  const categories = [...new Set(STATE.exercises.map(e=>e.category))].sort();
  const muscles = [...new Set(STATE.exercises.map(e=>e.muscle_group))].sort();

  el.innerHTML = `
    <div class="page-head">
      <div><div class="eyebrow">Reference</div><h1>Exercise library</h1></div>
      ${STATE.isAdmin ? `<button class="btn btn-gold" id="add-exercise-btn">${ICON.plus} Add exercise</button>` : ''}
    </div>
    <div class="filter-bar">
      <input id="lib-search" placeholder="Search exercises..." value="${escapeHtml(libraryFilters.search)}"/>
      <select id="lib-category"><option value="">All categories</option>${categories.map(c=>`<option ${libraryFilters.category===c?'selected':''}>${c}</option>`).join('')}</select>
      <select id="lib-muscle"><option value="">All muscle groups</option>${muscles.map(m=>`<option ${libraryFilters.muscle===m?'selected':''}>${m}</option>`).join('')}</select>
    </div>
    <div class="grid grid-3" id="library-grid"></div>
  `;
  $('#lib-search').addEventListener('input', (e) => { libraryFilters.search = e.target.value; renderLibraryGrid(); });
  $('#lib-category').addEventListener('change', (e) => { libraryFilters.category = e.target.value; renderLibraryGrid(); });
  $('#lib-muscle').addEventListener('change', (e) => { libraryFilters.muscle = e.target.value; renderLibraryGrid(); });
  if(STATE.isAdmin) $('#add-exercise-btn').addEventListener('click', () => openExerciseEditor(null));
  renderLibraryGrid();
}

function renderLibraryGrid(){
  const grid = $('#library-grid');
  const q = libraryFilters.search.toLowerCase();
  const filtered = STATE.exercises.filter(e =>
    (!q || e.name.toLowerCase().includes(q)) &&
    (!libraryFilters.category || e.category === libraryFilters.category) &&
    (!libraryFilters.muscle || e.muscle_group === libraryFilters.muscle)
  );
  if(!filtered.length){
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><h3>No exercises match</h3><p>Try a different search or clear the filters.</p></div>`;
    return;
  }
  grid.innerHTML = filtered.map(e => `
    <div class="card exercise-card" data-ex-id="${e.id}">
      <div class="thumb">${e.thumbnail_url ? `<img src="${e.thumbnail_url}" style="width:100%;height:100%;object-fit:cover;">` : ICON.play}</div>
      <h4>${escapeHtml(e.name)}</h4>
      <div class="tags"><span class="tag">${escapeHtml(e.category)}</span><span class="tag">${escapeHtml(e.muscle_group)}</span><span class="tag">${escapeHtml(e.difficulty)}</span></div>
    </div>
  `).join('');
  $$('.exercise-card', grid).forEach(card => {
    card.addEventListener('click', () => openExerciseDetail(card.dataset.exId));
  });
}

function openExerciseDetail(id){
  const ex = STATE.exercises.find(e => e.id === id);
  if(!ex) return;
  const videoHtml = ex.video_url
    ? (isYoutube(ex.video_url)
        ? `<div style="position:relative;padding-top:56.25%;border-radius:12px;overflow:hidden;margin-bottom:16px;"><iframe src="${youtubeEmbed(ex.video_url)}" style="position:absolute;inset:0;width:100%;height:100%;border:0;" allowfullscreen></iframe></div>`
        : `<video src="${ex.video_url}" controls style="width:100%;border-radius:12px;margin-bottom:16px;background:#000;"></video>`)
    : '';
  openModal(`
    <div class="modal-head"><h3>${escapeHtml(ex.name)}</h3><button class="modal-close" onclick="closeModal()">${ICON.x}</button></div>
    ${videoHtml}
    <div class="tags" style="margin-bottom:16px;"><span class="tag">${escapeHtml(ex.category)}</span><span class="tag">${escapeHtml(ex.muscle_group)}</span><span class="tag">${escapeHtml(ex.difficulty)}</span>${ex.equipment ? `<span class="tag">${escapeHtml(ex.equipment)}</span>` : ''}</div>
    ${ex.description ? `<p style="font-size:14.5px;color:var(--text-muted);line-height:1.6;margin-bottom:12px;">${escapeHtml(ex.description)}</p>` : ''}
    ${ex.coaching_cues ? `<div style="background:var(--bg-elevated);border-radius:10px;padding:14px;"><strong style="font-size:13px;color:var(--gold);">Coaching cues</strong><p style="font-size:13.5px;color:var(--text-muted);margin-top:6px;line-height:1.6;">${escapeHtml(ex.coaching_cues)}</p></div>` : ''}
    ${STATE.isAdmin ? `<div style="display:flex;gap:10px;margin-top:18px;"><button class="btn btn-outline" id="edit-ex-btn">Edit</button><button class="btn btn-danger" id="delete-ex-btn">Delete</button></div>` : ''}
  `);
  if(STATE.isAdmin){
    $('#edit-ex-btn').addEventListener('click', () => openExerciseEditor(ex));
    $('#delete-ex-btn').addEventListener('click', async () => {
      if(!confirm(`Delete "${ex.name}" from the library? This can't be undone.`)) return;
      const { error } = await sb.from('exercises').delete().eq('id', ex.id);
      if(error){ toast('Could not delete this exercise.', 'error'); return; }
      closeModal(); toast('Exercise deleted.', 'success');
      await loadExercises(); renderLibrary();
    });
  }
}

function openExerciseEditor(ex){
  const isEdit = !!ex;
  openModal(`
    <div class="modal-head"><h3>${isEdit ? 'Edit exercise' : 'Add exercise'}</h3><button class="modal-close" onclick="closeModal()">${ICON.x}</button></div>
    <form id="exercise-form">
      <div class="field"><label>Name</label><input id="ex-name" required value="${isEdit ? escapeHtml(ex.name) : ''}"/></div>
      <div class="grid grid-2">
        <div class="field"><label>Category</label>
          <select id="ex-category">${['Strength','Cardio','Mobility','Core','Olympic','Plyometric'].map(c=>`<option ${isEdit && ex.category===c?'selected':''}>${c}</option>`).join('')}</select>
        </div>
        <div class="field"><label>Muscle group</label>
          <select id="ex-muscle">${['Chest','Back','Legs','Shoulders','Arms','Core','Full Body','Hips'].map(m=>`<option ${isEdit && ex.muscle_group===m?'selected':''}>${m}</option>`).join('')}</select>
        </div>
      </div>
      <div class="grid grid-2">
        <div class="field"><label>Equipment</label><input id="ex-equipment" value="${isEdit ? escapeHtml(ex.equipment||'') : ''}"/></div>
        <div class="field"><label>Difficulty</label>
          <select id="ex-difficulty">${['Beginner','Intermediate','Advanced'].map(d=>`<option ${isEdit && ex.difficulty===d?'selected':''}>${d}</option>`).join('')}</select>
        </div>
      </div>
      <div class="field"><label>Description</label><textarea id="ex-description">${isEdit ? escapeHtml(ex.description||'') : ''}</textarea></div>
      <div class="field"><label>Coaching cues</label><textarea id="ex-cues">${isEdit ? escapeHtml(ex.coaching_cues||'') : ''}</textarea></div>
      <div class="field"><label>Demo video (YouTube link, or upload a file)</label><input id="ex-video-url" placeholder="https://youtube.com/watch?v=..." value="${isEdit ? escapeHtml(ex.video_url||'') : ''}"/></div>
      <div class="field"><label>...or upload a video file</label><input type="file" id="ex-video-file" accept="video/*"/></div>
      <div id="ex-form-error" class="error-text" style="display:none;"></div>
      <button class="btn btn-gold btn-block" id="save-exercise-btn" type="submit">${isEdit ? 'Save changes' : 'Add to library'}</button>
    </form>
  `);
  $('#exercise-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('#save-exercise-btn');
    setLoading(btn, true);
    let video_url = $('#ex-video-url').value.trim();
    const file = $('#ex-video-file').files[0];
    if(file){
      const path = `library/${Date.now()}-${file.name}`;
      const { data: uploadData, error: uploadErr } = await sb.storage.from('exercise-media').upload(path, file);
      if(uploadErr){ setLoading(btn,false,isEdit?'Save changes':'Add to library'); $('#ex-form-error').textContent = 'Video upload failed: ' + uploadErr.message; $('#ex-form-error').style.display='block'; return; }
      const { data: pub } = sb.storage.from('exercise-media').getPublicUrl(uploadData.path);
      video_url = pub.publicUrl;
    }
    const payload = {
      name: $('#ex-name').value.trim(),
      category: $('#ex-category').value,
      muscle_group: $('#ex-muscle').value,
      equipment: $('#ex-equipment').value.trim(),
      difficulty: $('#ex-difficulty').value,
      description: $('#ex-description').value.trim(),
      coaching_cues: $('#ex-cues').value.trim(),
      video_url,
    };
    let error;
    if(isEdit){
      ({ error } = await sb.from('exercises').update(payload).eq('id', ex.id));
    } else {
      payload.created_by = STATE.profile.id;
      ({ error } = await sb.from('exercises').insert(payload));
    }
    setLoading(btn, false, isEdit ? 'Save changes' : 'Add to library');
    if(error){ $('#ex-form-error').textContent = error.message; $('#ex-form-error').style.display='block'; return; }
    closeModal();
    toast(isEdit ? 'Exercise updated.' : 'Exercise added to the library.', 'success');
    await loadExercises();
    renderLibrary();
  });
}

// ============================================================================
// CHAT — the core feature. Text + file upload + in-browser video recording,
// realtime delivery, one thread per client (client <-> Sab).
// ============================================================================

STATE.unreadThreads = new Set();
STATE.clientHasUnread = false;

function subscribeMessages(){
  if(STATE.messagesChannel) sb.removeChannel(STATE.messagesChannel);
  STATE.messagesChannel = sb.channel('messages-realtime')
    .on('postgres_changes', { event:'INSERT', schema:'public', table:'messages' }, (payload) => {
      const msg = payload.new;
      const relevant = STATE.isAdmin || msg.client_id === STATE.profile.id;
      if(!relevant) return;
      if(!STATE.messagesCache[msg.client_id]) STATE.messagesCache[msg.client_id] = [];
      if(!STATE.messagesCache[msg.client_id].find(m => m.id === msg.id)){
        STATE.messagesCache[msg.client_id].push(msg);
      }
      const isMine = msg.sender_id === STATE.profile.id;
      const threadOpenNow = STATE.currentView === 'chat' && ((STATE.isAdmin && STATE.chatThreadClientId === msg.client_id) || (!STATE.isAdmin));
      if(!isMine && !threadOpenNow){
        if(STATE.isAdmin){ STATE.unreadThreads.add(msg.client_id); updateNavDots(); }
        else { STATE.clientHasUnread = true; updateNavDots(); }
      }
      if(threadOpenNow){
        appendMessageBubble(msg);
        scrollChatToBottom();
      } else if(STATE.isAdmin && STATE.currentView === 'chat'){
        renderChatThreadsList();
      }
    })
    .subscribe();
}

function updateNavDots(){
  const chatDot = $('#chat-dot');
  if(chatDot) chatDot.style.display = STATE.clientHasUnread ? 'block' : 'none';
}

async function renderChat(){
  const el = $('#view-chat');
  if(STATE.isAdmin){
    if(!STATE.clients.length) await loadClients();
    if(!STATE.chatThreadClientId && STATE.clients.length) STATE.chatThreadClientId = STATE.clients[0].id;
    el.innerHTML = `
      <div class="page-head"><div><div class="eyebrow">Client communication</div><h1>Messages</h1></div></div>
      <div class="chat-layout ${STATE.chatThreadClientId ? 'thread-open' : ''}" id="chat-layout">
        <div class="chat-threads" id="chat-threads"></div>
        <div class="chat-main" id="chat-main"></div>
      </div>
    `;
    renderChatThreadsList();
    if(STATE.chatThreadClientId) await openThread(STATE.chatThreadClientId);
  } else {
    STATE.clientHasUnread = false; updateNavDots();
    el.innerHTML = `
      <div class="page-head"><div><div class="eyebrow">Direct line to Sab</div><h1>Messages</h1></div></div>
      <div class="chat-layout thread-open" id="chat-layout" style="grid-template-columns:1fr;">
        <div class="chat-main" id="chat-main"></div>
      </div>
    `;
    await openThread(STATE.profile.id);
  }
}

function renderChatThreadsList(){
  const wrap = $('#chat-threads');
  if(!wrap) return;
  wrap.innerHTML = STATE.clients.map(c => {
    const cache = STATE.messagesCache[c.id];
    const last = cache && cache.length ? cache[cache.length-1] : null;
    const unread = STATE.unreadThreads.has(c.id);
    return `
      <div class="chat-thread-item ${STATE.chatThreadClientId===c.id?'active':''}" data-client-id="${c.id}">
        <div class="avatar">${c.avatar_url ? `<img src="${c.avatar_url}">` : initials(c.full_name)}</div>
        <div style="flex:1;min-width:0;">
          <div class="name">${escapeHtml(c.full_name)}</div>
          <div class="preview">${last ? escapeHtml((last.content || (last.attachment_type==='video'?'Sent a video':'Sent a photo')).slice(0,40)) : 'No messages yet'}</div>
        </div>
        ${unread ? '<span style="width:8px;height:8px;border-radius:50%;background:var(--danger);flex-shrink:0;"></span>' : ''}
      </div>
    `;
  }).join('');
  $$('.chat-thread-item', wrap).forEach(item => {
    item.addEventListener('click', async () => {
      STATE.chatThreadClientId = item.dataset.clientId;
      STATE.unreadThreads.delete(item.dataset.clientId);
      $('#chat-layout').classList.add('thread-open');
      renderChatThreadsList();
      await openThread(STATE.chatThreadClientId);
    });
  });
}

async function openThread(clientId){
  const main = $('#chat-main');
  main.innerHTML = `<div style="padding:20px;"><div class="skeleton" style="height:60px;"></div></div>`;
  const client = STATE.isAdmin ? STATE.clients.find(c => c.id === clientId) : STATE.profile;
  const { data } = await sb.from('messages').select('*').eq('client_id', clientId).order('created_at');
  STATE.messagesCache[clientId] = data || [];

  main.innerHTML = `
    <div class="chat-head">
      ${STATE.isAdmin ? `<button class="icon-btn" id="back-to-threads-btn" style="display:none;">${ICON.chevronLeft}</button>` : ''}
      <div class="avatar">${client && client.avatar_url ? `<img src="${client.avatar_url}">` : initials(client ? client.full_name : '?')}</div>
      <div><div style="font-weight:600;font-size:15px;">${escapeHtml(client ? client.full_name : 'Client')}</div>${STATE.isAdmin ? `<div class="hint">${escapeHtml(client && client.goals ? client.goals.slice(0,60) : 'No goals set yet')}</div>` : ''}</div>
    </div>
    <div class="chat-messages" id="chat-messages"></div>
    <div id="recording-bar-slot"></div>
    <div id="attachment-preview-slot"></div>
    <div class="chat-composer">
      <input type="file" id="chat-file-input" accept="video/*,image/*" style="display:none;"/>
      <button class="icon-btn" id="attach-btn" title="Attach a file">${ICON.paperclip}</button>
      <button class="icon-btn" id="record-btn" title="Record a video">${ICON.camera}</button>
      <textarea id="chat-input" rows="1" placeholder="Message Sab..."></textarea>
      <button class="icon-btn send" id="send-btn" title="Send">${ICON.send}</button>
    </div>
  `;
  await renderMessagesList(clientId);
  scrollChatToBottom();

  if(STATE.isAdmin){
    const backBtn = $('#back-to-threads-btn');
    if(window.innerWidth <= 900) backBtn.style.display = 'flex';
    backBtn.addEventListener('click', () => { $('#chat-layout').classList.remove('thread-open'); });
  }

  $('#chat-input').addEventListener('input', (e) => {
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
  });
  $('#chat-input').addEventListener('keydown', (e) => {
    if(e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); sendMessage(clientId); }
  });
  $('#send-btn').addEventListener('click', () => sendMessage(clientId));
  $('#attach-btn').addEventListener('click', () => $('#chat-file-input').click());
  $('#chat-file-input').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if(!file) return;
    STATE.pendingAttachment = { file, type: file.type.startsWith('video') ? 'video' : 'image' };
    renderAttachmentPreview();
  });
  $('#record-btn').addEventListener('click', () => openCameraCapture());
}

async function renderMessagesList(clientId){
  const messages = STATE.messagesCache[clientId] || [];
  const box = $('#chat-messages');
  if(!messages.length){
    box.innerHTML = `<div class="empty-state"><h3>No messages yet</h3><p>Send a note, a photo of your training log, or a video for form feedback to get things started.</p></div>`;
    return;
  }
  const resolved = await Promise.all(messages.map(m => resolveAttachmentUrl(m)));
  box.innerHTML = resolved.map(m => messageBubbleHtml(m)).join('');
}

async function resolveAttachmentUrl(m){
  if(!m.attachment_url || m.attachment_type === 'none') return m;
  if(/^https?:\/\//.test(m.attachment_url)) return m; // already a full url (e.g. exercise-media public bucket, unlikely here)
  const { data, error } = await sb.storage.from('chat-media').createSignedUrl(m.attachment_url, 3600);
  if(error) return m;
  return { ...m, _resolvedUrl: data.signedUrl };
}

function messageBubbleHtml(m){
  const mine = m.sender_id === STATE.profile.id;
  const url = m._resolvedUrl || m.attachment_url;
  let attachmentHtml = '';
  if(m.attachment_type === 'video' && url) attachmentHtml = `<video src="${url}" controls playsinline></video>`;
  if(m.attachment_type === 'image' && url) attachmentHtml = `<img class="att" src="${url}" />`;
  return `
    <div class="msg-row ${mine ? 'mine' : ''}" data-msg-id="${m.id}">
      <div class="msg-bubble">
        ${m.content ? `<div>${escapeHtml(m.content)}</div>` : ''}
        ${attachmentHtml}
        <div class="msg-meta">${msgTime(m.created_at)}</div>
      </div>
    </div>
  `;
}

function appendMessageBubble(m){
  resolveAttachmentUrl(m).then(resolved => {
    const box = $('#chat-messages');
    if(!box) return;
    const empty = $('.empty-state', box);
    if(empty) box.innerHTML = '';
    box.insertAdjacentHTML('beforeend', messageBubbleHtml(resolved));
    scrollChatToBottom();
  });
}

function scrollChatToBottom(){
  const box = $('#chat-messages');
  if(box) box.scrollTop = box.scrollHeight;
}

function renderAttachmentPreview(){
  const slot = $('#attachment-preview-slot');
  if(!slot) return;
  if(!STATE.pendingAttachment){ slot.innerHTML = ''; return; }
  const { file, type } = STATE.pendingAttachment;
  const url = URL.createObjectURL(file);
  slot.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;padding:8px 18px;">
      ${type === 'video' ? `<video src="${url}" style="width:70px;height:44px;border-radius:8px;object-fit:cover;" muted></video>` : `<img src="${url}" style="width:44px;height:44px;border-radius:8px;object-fit:cover;">`}
      <span style="font-size:13px;color:var(--text-muted);flex:1;">${escapeHtml(file.name || 'Recorded video')}</span>
      <button class="icon-btn" style="width:32px;height:32px;" id="remove-attachment-btn">${ICON.x}</button>
    </div>
  `;
  $('#remove-attachment-btn').addEventListener('click', () => { STATE.pendingAttachment = null; renderAttachmentPreview(); });
}

async function sendMessage(clientId){
  const input = $('#chat-input');
  const content = input.value.trim();
  const attachment = STATE.pendingAttachment;
  if(!content && !attachment) return;
  const sendBtn = $('#send-btn');
  setLoading(sendBtn, true);

  let attachment_url = null, attachment_type = 'none';
  if(attachment){
    const ext = (attachment.file.name && attachment.file.name.includes('.')) ? attachment.file.name.split('.').pop() : (attachment.type === 'video' ? 'webm' : 'jpg');
    const path = `${clientId}/${Date.now()}.${ext}`;
    const { data, error } = await sb.storage.from('chat-media').upload(path, attachment.file, { contentType: attachment.file.type || undefined });
    if(error){
      setLoading(sendBtn, false, ICON.send);
      toast('Could not upload the attachment: ' + error.message, 'error');
      return;
    }
    attachment_url = data.path;
    attachment_type = attachment.type;
  }

  const { error } = await sb.from('messages').insert({
    client_id: clientId,
    sender_id: STATE.profile.id,
    content: content || null,
    attachment_url,
    attachment_type,
  });
  setLoading(sendBtn, false, ICON.send);
  if(error){ toast('Message failed to send.', 'error'); return; }
  input.value = ''; input.style.height = 'auto';
  STATE.pendingAttachment = null;
  renderAttachmentPreview();
}

// ---- in-browser camera capture: live preview, front/back switch, photo or video ----
let camStream = null;
let camRecorder = null;
let camChunks = [];
let camFacingMode = 'environment';

async function openCameraCapture(){
  openModal(`
    <div class="modal-head"><h3>Camera</h3><button class="modal-close" id="camera-close-btn">${ICON.x}</button></div>
    <div style="position:relative;background:#000;border-radius:14px;overflow:hidden;min-height:240px;display:flex;align-items:center;justify-content:center;">
      <video id="camera-preview" autoplay playsinline muted style="width:100%;max-height:56vh;object-fit:cover;display:block;"></video>
      <div id="camera-rec-badge" style="display:none;position:absolute;top:12px;left:12px;background:rgba(0,0,0,0.55);color:#f2635c;padding:5px 12px;border-radius:999px;font-size:12px;font-weight:600;align-items:center;gap:6px;">
        <span style="width:8px;height:8px;border-radius:50%;background:#f2635c;display:inline-block;animation:pulse 1s infinite;"></span>REC
      </div>
      <div id="camera-error" class="error-text" style="display:none;position:absolute;inset:0;align-items:center;justify-content:center;padding:20px;text-align:center;background:#000;"></div>
    </div>
    <div style="display:flex;justify-content:center;align-items:center;gap:22px;margin-top:20px;">
      <button class="icon-btn" id="camera-flip-btn" title="Switch camera">${ICON.flip}</button>
      <button class="icon-btn" id="camera-photo-btn" style="width:58px;height:58px;background:#fff;color:#111;border-color:#fff;" title="Take photo">${ICON.camera}</button>
      <button class="icon-btn" id="camera-record-btn" style="width:58px;height:58px;background:var(--danger);color:#fff;border-color:transparent;" title="Record video">${ICON.recordDot}</button>
    </div>
    <p class="hint" style="text-align:center;margin-top:14px;">Tap the white button for a photo, the red button to start/stop a video.</p>
  `);
  // stopping the camera on any close path (X button or tapping the backdrop)
  $('#camera-close-btn').addEventListener('click', closeCameraCapture);
  const backdrop = document.getElementById('active-modal-backdrop');
  if(backdrop) backdrop.addEventListener('click', (e) => { if(e.target.id === 'active-modal-backdrop') stopCamStream(); });
  $('#camera-flip-btn').addEventListener('click', () => {
    camFacingMode = camFacingMode === 'environment' ? 'user' : 'environment';
    startCamStream();
  });
  $('#camera-photo-btn').addEventListener('click', takeCameraPhoto);
  $('#camera-record-btn').addEventListener('click', toggleCamRecording);
  await startCamStream();
}

async function startCamStream(){
  stopCamStream();
  try {
    camStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: camFacingMode }, audio: true });
    const videoEl = $('#camera-preview');
    if(videoEl) videoEl.srcObject = camStream;
    const errEl = $('#camera-error'); if(errEl) errEl.style.display = 'none';
  } catch (err) {
    const errEl = $('#camera-error');
    if(errEl){ errEl.textContent = 'Could not access your camera. Check your browser\'s camera permissions and try again.'; errEl.style.display = 'flex'; }
  }
}

function stopCamStream(){
  if(camStream){ camStream.getTracks().forEach(t => t.stop()); camStream = null; }
}

function closeCameraCapture(){
  if(camRecorder && camRecorder.state === 'recording') camRecorder.stop();
  stopCamStream();
  closeModal();
}

function takeCameraPhoto(){
  const videoEl = $('#camera-preview');
  if(!videoEl || !videoEl.videoWidth) return;
  const canvas = document.createElement('canvas');
  canvas.width = videoEl.videoWidth;
  canvas.height = videoEl.videoHeight;
  canvas.getContext('2d').drawImage(videoEl, 0, 0);
  canvas.toBlob((blob) => {
    if(!blob) return;
    const file = new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' });
    STATE.pendingAttachment = { file, type: 'image' };
    renderAttachmentPreview();
    closeCameraCapture();
  }, 'image/jpeg', 0.9);
}

function toggleCamRecording(){
  if(camRecorder && camRecorder.state === 'recording'){
    camRecorder.stop();
    return;
  }
  if(!camStream) return;
  const mimeCandidates = ['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm','video/mp4'];
  const mimeType = mimeCandidates.find(m => window.MediaRecorder && MediaRecorder.isTypeSupported(m)) || '';
  const recorder = mimeType ? new MediaRecorder(camStream, { mimeType }) : new MediaRecorder(camStream);
  camRecorder = recorder;
  camChunks = [];
  recorder.ondataavailable = (e) => { if(e.data.size > 0) camChunks.push(e.data); };
  recorder.onstop = () => {
    const blob = new Blob(camChunks, { type: recorder.mimeType || 'video/webm' });
    const ext = (recorder.mimeType || '').includes('mp4') ? 'mp4' : 'webm';
    const file = new File([blob], `recording-${Date.now()}.${ext}`, { type: blob.type });
    STATE.pendingAttachment = { file, type: 'video' };
    renderAttachmentPreview();
    closeCameraCapture();
  };
  recorder.start();
  const badge = $('#camera-rec-badge'); if(badge) badge.style.display = 'flex';
  const recBtn = $('#camera-record-btn'); if(recBtn) recBtn.innerHTML = ICON.stop;
}

// ============================================================================
// SETTINGS (profile, password, body stats, one-rep maxes)
// ============================================================================

async function renderSettings(){
  const el = $('#view-settings');
  const p = STATE.profile;
  let bundle = { bodyStats:[], orms:[] };
  if(!STATE.isAdmin) bundle = await fetchClientBundle(p.id);

  el.innerHTML = `
    <div class="page-head"><div><div class="eyebrow">Account</div><h1>Settings</h1></div></div>
    <div class="tabs">
      <button class="tab-btn active" data-stab="profile">Profile</button>
      ${!STATE.isAdmin ? '<button class="tab-btn" data-stab="stats">Body stats</button><button class="tab-btn" data-stab="lifts">One-rep maxes</button>' : ''}
      <button class="tab-btn" data-stab="password">Password</button>
    </div>
    <div id="settings-panel"></div>
    <div style="max-width:520px;margin-top:8px;">
      <button class="btn btn-outline btn-block" id="settings-logout-btn">${ICON.logout} Log out</button>
    </div>
  `;
  $('#settings-logout-btn').addEventListener('click', logout);
  $$('.tab-btn').forEach(b => b.addEventListener('click', () => {
    $$('.tab-btn').forEach(x=>x.classList.remove('active')); b.classList.add('active');
    renderSettingsPanel(b.dataset.stab, bundle);
  }));
  renderSettingsPanel('profile', bundle);
}

function renderSettingsPanel(tab, bundle){
  const panel = $('#settings-panel');
  const p = STATE.profile;
  if(tab === 'profile'){
    panel.innerHTML = `
      <div class="card" style="max-width:520px;">
        <div style="display:flex;align-items:center;gap:16px;margin-bottom:22px;">
          <div class="avatar" style="width:64px;height:64px;font-size:20px;">${p.avatar_url ? `<img src="${p.avatar_url}">` : initials(p.full_name)}</div>
          <div>
            <input type="file" id="avatar-input" accept="image/*" style="display:none;"/>
            <button class="btn btn-outline btn-sm" id="avatar-upload-btn">Change photo</button>
          </div>
        </div>
        <div class="field"><label>Full name</label><input id="settings-name" value="${escapeHtml(p.full_name)}"/></div>
        <div class="field"><label>Phone</label><input id="settings-phone" value="${escapeHtml(p.phone||'')}"/></div>
        ${!STATE.isAdmin ? `<div class="field"><label>Height (cm)</label><input type="number" id="settings-height" value="${p.height_cm||''}"/></div>
        <div class="field"><label>Training goals</label><textarea id="settings-goals">${escapeHtml(p.goals||'')}</textarea></div>` : ''}
        <button class="btn btn-gold" id="save-profile-btn">Save changes</button>
      </div>
    `;
    $('#avatar-upload-btn').addEventListener('click', () => $('#avatar-input').click());
    $('#avatar-input').addEventListener('change', async (e) => {
      const file = e.target.files[0]; if(!file) return;
      const path = `${p.id}/${Date.now()}-${file.name}`;
      const { data, error } = await sb.storage.from('avatars').upload(path, file, { upsert:true });
      if(error){ toast('Photo upload failed.', 'error'); return; }
      const { data: pub } = sb.storage.from('avatars').getPublicUrl(data.path);
      await sb.from('profiles').update({ avatar_url: pub.publicUrl }).eq('id', p.id);
      STATE.profile.avatar_url = pub.publicUrl;
      toast('Photo updated.', 'success');
      updateProfileWidgets(); renderSettings();
    });
    $('#save-profile-btn').addEventListener('click', async () => {
      const btn = $('#save-profile-btn'); setLoading(btn, true);
      const payload = { full_name: $('#settings-name').value.trim(), phone: $('#settings-phone').value.trim() };
      if(!STATE.isAdmin){ payload.height_cm = parseFloat($('#settings-height').value) || null; payload.goals = $('#settings-goals').value.trim(); }
      const { error } = await sb.from('profiles').update(payload).eq('id', p.id);
      setLoading(btn, false, 'Save changes');
      if(error){ toast('Could not save changes.', 'error'); return; }
      Object.assign(STATE.profile, payload);
      updateProfileWidgets();
      toast('Profile updated.', 'success');
    });
  }

  if(tab === 'password'){
    panel.innerHTML = `
      <div class="card" style="max-width:420px;">
        <div class="field"><label>New password</label><input type="password" id="np1" minlength="8"/></div>
        <div class="field"><label>Confirm new password</label><input type="password" id="np2" minlength="8"/></div>
        <div id="pw-error" class="error-text" style="display:none;"></div>
        <button class="btn btn-gold" id="change-password-btn">Update password</button>
      </div>
    `;
    $('#change-password-btn').addEventListener('click', async () => {
      const p1 = $('#np1').value, p2 = $('#np2').value;
      const errEl = $('#pw-error'); errEl.style.display='none';
      if(p1.length < 8){ errEl.textContent='Password must be at least 8 characters.'; errEl.style.display='block'; return; }
      if(p1 !== p2){ errEl.textContent='Passwords don\'t match.'; errEl.style.display='block'; return; }
      const btn = $('#change-password-btn'); setLoading(btn, true);
      const { error } = await sb.auth.updateUser({ password: p1 });
      setLoading(btn, false, 'Update password');
      if(error){ errEl.textContent = error.message; errEl.style.display='block'; return; }
      toast('Password updated.', 'success');
      $('#np1').value=''; $('#np2').value='';
    });
  }

  if(tab === 'stats'){
    panel.innerHTML = `
      <div class="page-head" style="margin-bottom:16px;">
        <div></div>
        <button class="btn btn-gold btn-sm" id="add-stat-btn">${ICON.plus} Log check-in</button>
      </div>
      <div class="card" style="padding:0;overflow:hidden;">
        ${bundle.bodyStats.length ? `<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:13.5px;">
          <thead><tr style="text-align:left;color:var(--text-faint);font-size:11.5px;text-transform:uppercase;letter-spacing:0.05em;">
            <th style="padding:14px 16px;">Date</th><th style="padding:14px;">Weight</th><th style="padding:14px;">Chest</th><th style="padding:14px;">Waist</th><th style="padding:14px;">Hips</th><th style="padding:14px;">Arm</th><th style="padding:14px;">Thigh</th>
          </tr></thead>
          <tbody>
            ${bundle.bodyStats.map(b => `<tr style="border-top:1px solid var(--border-soft);">
              <td style="padding:14px 16px;">${fmtDateShort(b.logged_at)}</td>
              <td style="padding:14px;" class="mono">${b.weight_kg||'—'} kg</td>
              <td style="padding:14px;" class="mono">${b.chest_cm||'—'}</td>
              <td style="padding:14px;" class="mono">${b.waist_cm||'—'}</td>
              <td style="padding:14px;" class="mono">${b.hips_cm||'—'}</td>
              <td style="padding:14px;" class="mono">${b.arm_cm||'—'}</td>
              <td style="padding:14px;" class="mono">${b.thigh_cm||'—'}</td>
            </tr>`).join('')}
          </tbody>
        </table></div>` : `<div class="empty-state"><h3>No check-ins yet</h3><p>Log your weight and measurements to start tracking progress over time.</p></div>`}
      </div>
    `;
    $('#add-stat-btn').addEventListener('click', () => openBodyStatModal());
  }

  if(tab === 'lifts'){
    panel.innerHTML = `
      <div class="page-head" style="margin-bottom:16px;">
        <div></div>
        <button class="btn btn-gold btn-sm" id="add-lift-btn">${ICON.plus} Log a lift</button>
      </div>
      <div class="grid grid-3">
        ${bundle.orms.length ? bundle.orms.map(o => `
          <div class="card">
            <div class="eyebrow">${fmtDateShort(o.achieved_on)}</div>
            <h4 style="margin:8px 0 4px;font-size:15.5px;">${escapeHtml(o.lift_name)}</h4>
            <div style="font-family:var(--font-display);font-size:24px;color:var(--gold);">${o.weight_kg} kg</div>
            ${o.notes ? `<div class="hint" style="margin-top:6px;">${escapeHtml(o.notes)}</div>` : ''}
          </div>
        `).join('') : `<div class="empty-state" style="grid-column:1/-1;"><h3>No lifts logged yet</h3><p>Add your best lifts to track your one-rep maxes over time.</p></div>`}
      </div>
    `;
    $('#add-lift-btn').addEventListener('click', () => openOrmModal());
  }
}

function openBodyStatModal(){
  openModal(`
    <div class="modal-head"><h3>Log a check-in</h3><button class="modal-close" onclick="closeModal()">${ICON.x}</button></div>
    <div class="grid grid-2">
      <div class="field"><label>Date</label><input type="date" id="stat-date" value="${new Date().toISOString().slice(0,10)}"/></div>
      <div class="field"><label>Weight (kg)</label><input type="number" step="0.1" id="stat-weight"/></div>
      <div class="field"><label>Chest (cm)</label><input type="number" step="0.5" id="stat-chest"/></div>
      <div class="field"><label>Waist (cm)</label><input type="number" step="0.5" id="stat-waist"/></div>
      <div class="field"><label>Hips (cm)</label><input type="number" step="0.5" id="stat-hips"/></div>
      <div class="field"><label>Arm (cm)</label><input type="number" step="0.5" id="stat-arm"/></div>
      <div class="field"><label>Thigh (cm)</label><input type="number" step="0.5" id="stat-thigh"/></div>
    </div>
    <div class="field"><label>Notes</label><textarea id="stat-notes"></textarea></div>
    <button class="btn btn-gold btn-block" id="save-stat-btn">Save check-in</button>
  `);
  $('#save-stat-btn').addEventListener('click', async () => {
    const btn = $('#save-stat-btn'); setLoading(btn, true);
    const { error } = await sb.from('body_stats').insert({
      client_id: STATE.profile.id,
      logged_at: $('#stat-date').value,
      weight_kg: parseFloat($('#stat-weight').value) || null,
      chest_cm: parseFloat($('#stat-chest').value) || null,
      waist_cm: parseFloat($('#stat-waist').value) || null,
      hips_cm: parseFloat($('#stat-hips').value) || null,
      arm_cm: parseFloat($('#stat-arm').value) || null,
      thigh_cm: parseFloat($('#stat-thigh').value) || null,
      notes: $('#stat-notes').value.trim(),
    });
    setLoading(btn, false, 'Save check-in');
    if(error){ toast('Could not save this check-in.', 'error'); return; }
    closeModal(); toast('Check-in logged.', 'success');
    renderSettings();
  });
}

function openOrmModal(){
  openModal(`
    <div class="modal-head"><h3>Log a one-rep max</h3><button class="modal-close" onclick="closeModal()">${ICON.x}</button></div>
    <div class="field"><label>Lift</label>
      <select id="orm-lift">
        <option>Barbell Back Squat</option><option>Barbell Bench Press</option><option>Conventional Deadlift</option>
        <option>Overhead Press</option><option>Front Squat</option><option>Sumo Deadlift</option><option>Custom...</option>
      </select>
    </div>
    <div class="field" id="orm-custom-wrap" style="display:none;"><label>Custom lift name</label><input id="orm-custom-name"/></div>
    <div class="field"><label>Weight (kg)</label><input type="number" step="0.5" id="orm-weight"/></div>
    <div class="field"><label>Date achieved</label><input type="date" id="orm-date" value="${new Date().toISOString().slice(0,10)}"/></div>
    <div class="field"><label>Notes</label><textarea id="orm-notes"></textarea></div>
    <button class="btn btn-gold btn-block" id="save-orm-btn">Save lift</button>
  `);
  $('#orm-lift').addEventListener('change', (e) => { $('#orm-custom-wrap').style.display = e.target.value === 'Custom...' ? 'block' : 'none'; });
  $('#save-orm-btn').addEventListener('click', async () => {
    const liftSel = $('#orm-lift').value;
    const liftName = liftSel === 'Custom...' ? $('#orm-custom-name').value.trim() : liftSel;
    const weight = parseFloat($('#orm-weight').value);
    if(!liftName || !weight){ toast('Enter a lift name and weight.', 'error'); return; }
    const btn = $('#save-orm-btn'); setLoading(btn, true);
    const { error } = await sb.from('one_rep_maxes').insert({
      client_id: STATE.profile.id, lift_name: liftName, weight_kg: weight,
      achieved_on: $('#orm-date').value, notes: $('#orm-notes').value.trim(),
    });
    setLoading(btn, false, 'Save lift');
    if(error){ toast('Could not save this lift.', 'error'); return; }
    closeModal(); toast('Lift logged.', 'success');
    renderSettings();
  });
}

// ============================================================================
// CLIENTS (admin) — list, add client, and per-client detail/program view
// ============================================================================

let clientsDetailId = null;
let clientsDetailTab = 'overview';

async function renderClients(){
  await loadClients();
  if(clientsDetailId){
    await renderClientDetail(clientsDetailId);
    return;
  }
  const el = $('#view-clients');
  el.innerHTML = `
    <div class="page-head">
      <div><div class="eyebrow">Your roster</div><h1>Clients</h1></div>
      <button class="btn btn-gold" id="add-client-btn">${ICON.plus} Add client</button>
    </div>
    <input id="client-search" placeholder="Search clients..." style="width:100%;max-width:340px;background:var(--surface);border:1px solid var(--border);color:var(--text);padding:11px 14px;border-radius:10px;margin-bottom:20px;"/>
    <div id="clients-list"></div>
  `;
  $('#add-client-btn').addEventListener('click', openAddClientModal);
  $('#client-search').addEventListener('input', (e) => renderClientsList(e.target.value));
  renderClientsList('');
}

function renderClientsList(query){
  const q = query.toLowerCase();
  const list = STATE.clients.filter(c => c.full_name.toLowerCase().includes(q));
  const wrap = $('#clients-list');
  if(!list.length){
    wrap.innerHTML = `<div class="empty-state"><h3>No clients yet</h3><p>Add your first client to start programming sessions and messaging.</p></div>`;
    return;
  }
  wrap.innerHTML = list.map(c => `
    <div class="card client-row" data-client-id="${c.id}" style="margin-bottom:10px;">
      <div class="avatar" style="width:44px;height:44px;">${c.avatar_url ? `<img src="${c.avatar_url}">` : initials(c.full_name)}</div>
      <div class="flex1">
        <div class="name">${escapeHtml(c.full_name)}</div>
        <div class="goal">${escapeHtml(c.goals || 'No goals set yet')}</div>
      </div>
      ${c.is_active === false ? '<span class="badge badge-missed">Access paused</span>' : (c.must_change_password ? '<span class="badge badge-new">Pending first login</span>' : '')}
    </div>
  `).join('');
  $$('.client-row', wrap).forEach(row => row.addEventListener('click', () => {
    clientsDetailId = row.dataset.clientId; clientsDetailTab = 'overview';
    renderClients();
  }));
}

function openAddClientModal(){
  openModal(`
    <div class="modal-head"><h3>Add a client</h3><button class="modal-close" onclick="closeModal()">${ICON.x}</button></div>
    <p class="text-muted" style="font-size:13.5px;margin-bottom:16px;">This creates their login. Give them the email and temporary password shown afterwards — they'll be asked to choose their own password the first time they log in.</p>
    <div class="field"><label>Full name</label><input id="ac-name" required/></div>
    <div class="field"><label>Email</label><input type="email" id="ac-email" required/></div>
    <div class="field"><label>Phone (optional)</label><input id="ac-phone"/></div>
    <div class="field"><label>Training goals (optional)</label><textarea id="ac-goals"></textarea></div>
    <div id="ac-error" class="error-text" style="display:none;"></div>
    <button class="btn btn-gold btn-block" id="ac-submit-btn">Create client account</button>
  `);
  $('#ac-submit-btn').addEventListener('click', async () => {
    const name = $('#ac-name').value.trim();
    const email = $('#ac-email').value.trim();
    const phone = $('#ac-phone').value.trim();
    const goals = $('#ac-goals').value.trim();
    if(!name || !email){ $('#ac-error').textContent='Name and email are required.'; $('#ac-error').style.display='block'; return; }
    const btn = $('#ac-submit-btn'); setLoading(btn, true);

    // Keep hold of the admin's current session so we can restore it after
    // Supabase Auth automatically signs in as the newly created user.
    const { data: { session: adminSession } } = await sb.auth.getSession();
    const tempPassword = 'Train' + Math.floor(1000 + Math.random()*9000) + '!';

    const { data: signUpData, error: signUpErr } = await sb.auth.signUp({ email, password: tempPassword });
    if(signUpErr){
      setLoading(btn, false, 'Create client account');
      $('#ac-error').textContent = signUpErr.message; $('#ac-error').style.display = 'block';
      return;
    }
    const newUserId = signUpData.user.id;
    const { error: profileErr } = await sb.from('profiles').insert({
      id: newUserId, role: 'client', full_name: name, email, phone, goals, must_change_password: true,
    });

    // restore the admin's session (signUp switched the active session to the new client)
    if(adminSession){
      await sb.auth.setSession({ access_token: adminSession.access_token, refresh_token: adminSession.refresh_token });
    }

    setLoading(btn, false, 'Create client account');
    if(profileErr){
      $('#ac-error').textContent = 'Account created but profile setup failed: ' + profileErr.message;
      $('#ac-error').style.display = 'block';
      return;
    }
    closeModal();
    await loadClients();
    renderClients();
    openModal(`
      <div class="modal-head"><h3>Client account created</h3><button class="modal-close" onclick="closeModal()">${ICON.x}</button></div>
      <p style="font-size:14.5px;color:var(--text-muted);margin-bottom:16px;">Send these details to ${escapeHtml(name)} — they'll set their own password on first login.</p>
      <div class="card mono" style="font-size:14.5px;line-height:2;">
        Email: ${escapeHtml(email)}<br/>
        Temporary password: ${tempPassword}
      </div>
      <button class="btn btn-gold btn-block" style="margin-top:18px;" onclick="closeModal()">Done</button>
    `);
  });
}

async function renderClientDetail(clientId){
  const el = $('#view-clients');
  el.innerHTML = `<div class="skeleton" style="height:200px;"></div>`;
  const client = await fetchClientProfile(clientId);
  if(!client){ clientsDetailId = null; renderClients(); return; }
  const bundle = await fetchClientBundle(clientId);

  el.innerHTML = `
    <button class="btn btn-ghost btn-sm" id="back-to-clients-btn" style="padding-left:0;margin-bottom:12px;">${ICON.chevronLeft} All clients</button>
    <div class="page-head">
      <div style="display:flex;align-items:center;gap:14px;">
        <div class="avatar" style="width:52px;height:52px;font-size:17px;">${client.avatar_url ? `<img src="${client.avatar_url}">` : initials(client.full_name)}</div>
        <div><h1 style="font-size:24px;">${escapeHtml(client.full_name)}</h1><div class="hint">${escapeHtml(client.phone||'No phone on file')}</div></div>
      </div>
      <button class="btn btn-outline" id="message-client-btn">${ICON.chat} Message</button>
    </div>
    <div class="tabs">
      <button class="tab-btn" data-ctab="overview">Overview</button>
      <button class="tab-btn" data-ctab="program">Program</button>
      <button class="tab-btn" data-ctab="stats">Body stats</button>
      <button class="tab-btn" data-ctab="lifts">One-rep maxes</button>
      <button class="tab-btn" data-ctab="edit">Edit profile</button>
    </div>
    <div id="client-detail-panel"></div>
  `;
  $('#back-to-clients-btn').addEventListener('click', () => { clientsDetailId = null; renderClients(); });
  $('#message-client-btn').addEventListener('click', () => { STATE.chatThreadClientId = clientId; navigate('chat'); });
  $$('.tab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.ctab === clientsDetailTab);
    b.addEventListener('click', () => { clientsDetailTab = b.dataset.ctab; $$('.tab-btn').forEach(x=>x.classList.toggle('active', x.dataset.ctab===clientsDetailTab)); renderClientDetailPanel(client, bundle); });
  });
  renderClientDetailPanel(client, bundle);
}

function renderClientDetailPanel(client, bundle){
  const panel = $('#client-detail-panel');
  if(clientsDetailTab === 'overview'){
    const latest = bundle.bodyStats[0];
    const topLifts = {};
    bundle.orms.forEach(o => { if(!topLifts[o.lift_name] || o.weight_kg > topLifts[o.lift_name].weight_kg) topLifts[o.lift_name] = o; });
    panel.innerHTML = `
      <div class="grid grid-3">
        <div class="card stat-card"><div class="eyebrow">Current weight</div><div class="val">${latest && latest.weight_kg ? latest.weight_kg + ' kg' : '—'}</div></div>
        <div class="card stat-card"><div class="eyebrow">Sessions completed</div><div class="val">${bundle.sessions.filter(s=>s.status==='completed').length}</div></div>
        <div class="card stat-card"><div class="eyebrow">Upcoming sessions</div><div class="val">${bundle.sessions.filter(s=>s.status==='upcoming').length}</div></div>
      </div>
      <div class="card" style="margin-top:18px;">
        <h3 style="font-size:16px;margin-bottom:14px;">Goals</h3>
        <p style="color:var(--text-muted);font-size:14.5px;">${escapeHtml(client.goals || 'No goals set yet — add them from Edit profile.')}</p>
      </div>
      <div class="card" style="margin-top:18px;">
        <h3 style="font-size:16px;margin-bottom:14px;">Best lifts</h3>
        ${Object.values(topLifts).length ? Object.values(topLifts).map((l,i) => `<div style="display:flex;justify-content:space-between;padding:9px 0;${i>0?'border-top:1px solid var(--border-soft);':''}"><span>${escapeHtml(l.lift_name)}</span><span class="mono" style="color:var(--gold);">${l.weight_kg} kg</span></div>`).join('') : `<p class="text-muted" style="font-size:14px;">None logged yet.</p>`}
      </div>
    `;
  }
  if(clientsDetailTab === 'program'){
    panel.innerHTML = `
      <div class="page-head" style="margin-bottom:16px;"><div></div><button class="btn btn-gold btn-sm" id="program-session-btn">${ICON.plus} Program a session</button></div>
      <div id="admin-sessions-list"></div>
    `;
    $('#program-session-btn').addEventListener('click', () => openProgramSessionModal(client.id));
    const list = $('#admin-sessions-list');
    if(!bundle.sessions.length){
      list.innerHTML = `<div class="empty-state"><h3>No sessions programmed yet</h3><p>Program the first session for ${escapeHtml(client.full_name)}.</p></div>`;
    } else {
      list.innerHTML = bundle.sessions.map(s => `
        <div class="card session-card">
          <div class="session-card-head">
            <div><h3 style="font-size:16.5px;">${escapeHtml(s.title)}</h3><div class="hint">${sessionDateLabel(s)}</div></div>
            <span class="badge ${s.status==='upcoming'?'badge-upcoming':s.status==='completed'?'badge-completed':'badge-missed'}">${s.status}</span>
          </div>
          ${s.trainer_notes ? `<div class="hint" style="margin-bottom:10px;">${escapeHtml(s.trainer_notes)}</div>` : ''}
          ${s.session_exercises.map(se => `
            <div class="session-ex-row">
              <div>
                <div class="session-ex-name">${escapeHtml(se.exercises ? se.exercises.name : 'Exercise')}</div>
                <div class="session-ex-prescribed">${se.prescribed_sets?se.prescribed_sets+' x ':''}${escapeHtml(se.prescribed_reps||'')}${se.prescribed_weight_kg?' @ '+se.prescribed_weight_kg+'kg':''}${se.prescribed_time_seconds?' · '+se.prescribed_time_seconds+'s':''}${se.target_rpe?' · target RPE '+se.target_rpe:''}</div>
                ${se.actual_sets_json && se.actual_sets_json.length ? `<div class="hint mono" style="color:var(--success);">Logged: ${se.actual_sets_json.map(a=>`${a.reps?a.reps+' reps':(a.time?a.time+'s':'')}${a.weight?'@'+a.weight+'kg':''}${a.rpe?' RPE'+a.rpe:''}`).join(', ')}</div>` : ''}
              </div>
            </div>
          `).join('')}
          ${s.client_feedback ? `<div style="background:var(--bg-elevated);border-radius:10px;padding:12px;margin-top:10px;font-size:13.5px;"><strong style="color:var(--gold);">Client feedback:</strong> ${escapeHtml(s.client_feedback)}</div>` : ''}
        </div>
      `).join('');
    }
  }
  if(clientsDetailTab === 'stats'){
    panel.innerHTML = `
      <div class="card" style="padding:0;overflow:hidden;">
        ${bundle.bodyStats.length ? `<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:13.5px;">
          <thead><tr style="text-align:left;color:var(--text-faint);font-size:11.5px;text-transform:uppercase;"><th style="padding:14px 16px;">Date</th><th style="padding:14px;">Weight</th><th style="padding:14px;">Waist</th><th style="padding:14px;">Notes</th></tr></thead>
          <tbody>${bundle.bodyStats.map(b => `<tr style="border-top:1px solid var(--border-soft);"><td style="padding:14px 16px;">${fmtDateShort(b.logged_at)}</td><td style="padding:14px;" class="mono">${b.weight_kg||'—'} kg</td><td style="padding:14px;" class="mono">${b.waist_cm||'—'}</td><td style="padding:14px;">${escapeHtml(b.notes||'')}</td></tr>`).join('')}</tbody>
        </table></div>` : `<div class="empty-state"><h3>No check-ins logged</h3><p>${escapeHtml(client.full_name)} hasn't logged a check-in yet.</p></div>`}
      </div>
    `;
  }
  if(clientsDetailTab === 'lifts'){
    panel.innerHTML = `<div class="grid grid-3">${bundle.orms.length ? bundle.orms.map(o => `<div class="card"><div class="eyebrow">${fmtDateShort(o.achieved_on)}</div><h4 style="margin:8px 0 4px;">${escapeHtml(o.lift_name)}</h4><div style="font-family:var(--font-display);font-size:22px;color:var(--gold);">${o.weight_kg} kg</div></div>`).join('') : `<div class="empty-state" style="grid-column:1/-1;"><h3>No lifts logged</h3></div>`}</div>`;
  }
  if(clientsDetailTab === 'edit'){
    panel.innerHTML = `
      <div class="card" style="max-width:480px;">
        <div class="field"><label>Email (must match exactly what they log in with)</label><input id="ec-email" value="${escapeHtml(client.email||'')}" placeholder="client@email.com"/>
          <div class="hint">Used to send password reset links. If you're not sure it's correct, check with the client rather than guessing.</div>
        </div>
        <div class="field"><label>Full name</label><input id="ec-name" value="${escapeHtml(client.full_name)}"/></div>
        <div class="field"><label>Phone</label><input id="ec-phone" value="${escapeHtml(client.phone||'')}"/></div>
        <div class="field"><label>Height (cm)</label><input type="number" id="ec-height" value="${client.height_cm||''}"/></div>
        <div class="field"><label>Training goals</label><textarea id="ec-goals">${escapeHtml(client.goals||'')}</textarea></div>
        <button class="btn btn-gold" id="save-client-edit-btn">Save changes</button>
      </div>
      <div class="card" style="max-width:480px;margin-top:18px;">
        <h3 style="font-size:15px;margin-bottom:8px;">${ICON.key} Reset password</h3>
        <p class="text-muted" style="font-size:13.5px;margin-bottom:14px;">Generates a new temporary password for ${escapeHtml(client.full_name)}. They'll be forced to choose their own the next time they log in.</p>
        <button class="btn btn-outline" id="reset-password-btn">Reset password</button>
      </div>
      <div class="card" style="max-width:480px;margin-top:18px;">
        <h3 style="font-size:15px;margin-bottom:8px;">${client.is_active === false ? 'Access is paused' : 'Client access'}</h3>
        <p class="text-muted" style="font-size:13.5px;margin-bottom:14px;">${client.is_active === false
          ? `${escapeHtml(client.full_name)} can't log in right now. Their sessions, messages and history are all kept — re-enable any time.`
          : `Temporarily block ${escapeHtml(client.full_name)} from logging in without deleting anything. Useful for a break, a pause between blocks, or a billing hold.`}</p>
        <button class="btn ${client.is_active === false ? 'btn-gold' : 'btn-outline'}" id="toggle-active-btn">${client.is_active === false ? 'Re-enable access' : 'Disable access'}</button>
      </div>
      <div class="card" style="max-width:480px;margin-top:18px;border-color:var(--danger-soft);">
        <h3 style="font-size:15px;color:var(--danger);margin-bottom:8px;">Delete client</h3>
        <p class="text-muted" style="font-size:13.5px;margin-bottom:14px;">Removes ${escapeHtml(client.full_name)} from your roster along with their sessions, messages, body stats and lifts. This can't be undone.</p>
        <button class="btn btn-danger" id="delete-client-btn">${ICON.trash} Delete ${escapeHtml(client.full_name.split(' ')[0])}</button>
      </div>
    `;
    $('#reset-password-btn').addEventListener('click', () => openResetPasswordModal(client));
    $('#toggle-active-btn').addEventListener('click', () => toggleClientActive(client));
    $('#save-client-edit-btn').addEventListener('click', async () => {
      const btn = $('#save-client-edit-btn'); setLoading(btn, true);
      const { error } = await sb.from('profiles').update({
        full_name: $('#ec-name').value.trim(), phone: $('#ec-phone').value.trim(), email: $('#ec-email').value.trim() || null,
        height_cm: parseFloat($('#ec-height').value) || null, goals: $('#ec-goals').value.trim(),
      }).eq('id', client.id);
      setLoading(btn, false, 'Save changes');
      if(error){ toast('Could not save changes.', 'error'); return; }
      toast('Client profile updated.', 'success');
      await loadClients();
      renderClients();
    });
    $('#delete-client-btn').addEventListener('click', () => confirmDeleteClient(client));
  }
}

function openResetPasswordModal(client){
  if(!client.email){
    openModal(`
      <div class="modal-head"><h3>Email needed</h3><button class="modal-close" onclick="closeModal()">${ICON.x}</button></div>
      <p style="font-size:14px;color:var(--text-muted);line-height:1.6;">${escapeHtml(client.full_name)} doesn't have an email address on file yet, so there's nowhere to send a reset link. Add it under Edit profile first (it must match exactly what they log in with), then try again.</p>
      <button class="btn btn-gold btn-block" style="margin-top:16px;" onclick="closeModal()">Got it</button>
    `);
    return;
  }
  openModal(`
    <div class="modal-head"><h3>Reset ${escapeHtml(client.full_name)}'s password</h3><button class="modal-close" onclick="closeModal()">${ICON.x}</button></div>
    <p style="font-size:14px;color:var(--text-muted);line-height:1.6;margin-bottom:18px;">This sends a password reset link straight to <strong style="color:var(--text);">${escapeHtml(client.email)}</strong>. They'll click it, choose a new password themselves, and be back in.</p>
    <div id="rp-error" class="error-text" style="display:none;margin-bottom:14px;"></div>
    <button class="btn btn-gold btn-block" id="rp-send-btn">Send reset link</button>
  `);
  $('#rp-send-btn').addEventListener('click', async () => {
    const btn = $('#rp-send-btn'); setLoading(btn, true);
    const { error } = await sb.auth.resetPasswordForEmail(client.email, { redirectTo: window.location.origin + window.location.pathname });
    setLoading(btn, false, 'Send reset link');
    if(error){ $('#rp-error').textContent = error.message; $('#rp-error').style.display = 'block'; return; }
    closeModal();
    toast(`Reset link sent to ${client.full_name}.`, 'success');
  });
}

async function toggleClientActive(client){
  const disabling = client.is_active !== false;
  const newValue = !disabling;
  const confirmMsg = disabling
    ? `Pause ${client.full_name}'s access? They won't be able to log in until you re-enable it.`
    : `Re-enable ${client.full_name}'s access? They'll be able to log in again straight away.`;
  if(!confirm(confirmMsg)) return;
  const { error } = await sb.from('profiles').update({ is_active: newValue }).eq('id', client.id);
  if(error){ toast('Could not update access: ' + error.message, 'error'); return; }
  toast(disabling ? `${client.full_name}'s access is paused.` : `${client.full_name}'s access is restored.`, 'success');
  await loadClients();
  renderClients();
}

function confirmDeleteClient(client){
  openModal(`
    <div class="modal-head"><h3>Delete ${escapeHtml(client.full_name)}?</h3><button class="modal-close" onclick="closeModal()">${ICON.x}</button></div>
    <p style="font-size:14.5px;color:var(--text-muted);line-height:1.6;margin-bottom:20px;">This permanently removes their profile, programmed sessions, messages, body stats and one-rep maxes. Their login will stop working. This can't be undone.</p>
    <div style="display:flex;gap:10px;">
      <button class="btn btn-outline btn-block" onclick="closeModal()">Cancel</button>
      <button class="btn btn-danger btn-block" id="confirm-delete-client-btn">Delete permanently</button>
    </div>
  `);
  $('#confirm-delete-client-btn').addEventListener('click', async () => {
    const btn = $('#confirm-delete-client-btn'); setLoading(btn, true);
    const { error } = await sb.from('profiles').delete().eq('id', client.id);
    setLoading(btn, false, 'Delete permanently');
    if(error){ toast('Could not delete this client: ' + error.message, 'error'); return; }
    if(STATE.chatThreadClientId === client.id) STATE.chatThreadClientId = null;
    delete STATE.messagesCache[client.id];
    STATE.unreadThreads.delete(client.id);
    closeModal();
    toast(`${client.full_name} was removed.`, 'success');
    clientsDetailId = null;
    await loadClients();
    renderClients();
  });
}

function openProgramSessionModal(clientId){
  const exOptions = STATE.exercises.map(e => `<option value="${e.id}">${escapeHtml(e.name)}</option>`).join('');
  openModal(`
    <div class="modal-head"><h3>Program a session</h3><button class="modal-close" onclick="closeModal()">${ICON.x}</button></div>
    <div class="field"><label>Session title</label><input id="ps-title" placeholder="e.g. Upper Body Strength"/></div>
    <div class="field"><label>Date (optional — leave blank if you're not locking in a day yet)</label><input type="date" id="ps-date"/></div>
    <div class="field" style="display:flex;align-items:center;gap:10px;">
      <input type="checkbox" id="ps-repeat" style="width:auto;"/>
      <label for="ps-repeat" style="margin:0;">Repeat this session weekly (needs a date set above)</label>
    </div>
    <div class="field" id="ps-repeat-weeks-wrap" style="display:none;">
      <label>Number of weeks (including the first)</label>
      <input type="number" id="ps-repeat-weeks" value="6" min="2" max="26"/>
      <div class="hint">Creates one session per week, same exercises, 7 days apart — handy for a 6-week block.</div>
    </div>
    <div class="field"><label>Notes for the client</label><textarea id="ps-notes"></textarea></div>
    <h4 style="font-size:14px;margin:18px 0 10px;">Exercises</h4>
    <div id="ps-exercise-rows"></div>
    <button class="btn btn-outline btn-sm" id="ps-add-row-btn" type="button">${ICON.plus} Add exercise</button>
    <div id="ps-error" class="error-text" style="display:none;margin-top:14px;"></div>
    <button class="btn btn-gold btn-block" id="ps-save-btn" style="margin-top:18px;">Save program</button>
  `);
  $('#ps-repeat').addEventListener('change', (e) => { $('#ps-repeat-weeks-wrap').style.display = e.target.checked ? 'block' : 'none'; });
  let rowCount = 0;
  function addExerciseRow(){
    rowCount++;
    const id = 'ps-row-' + rowCount;
    $('#ps-exercise-rows').insertAdjacentHTML('beforeend', `
      <div class="card" style="margin-bottom:10px;padding:14px;" id="${id}">
        <div class="grid grid-2" style="margin-bottom:0;">
          <div class="field" style="margin-bottom:10px;grid-column:1/-1;"><label>Exercise</label><select class="ps-ex-select">${exOptions}</select></div>
          <div class="field" style="margin-bottom:10px;"><label>Sets</label><input type="number" class="ps-sets" value="3"/></div>
          <div class="field" style="margin-bottom:10px;"><label>Reps</label><input class="ps-reps" placeholder="e.g. 8-10"/></div>
          <div class="field" style="margin-bottom:10px;"><label>Weight (kg, optional)</label><input type="number" step="0.5" class="ps-weight"/></div>
          <div class="field" style="margin-bottom:10px;"><label>Time (seconds, optional)</label><input type="number" class="ps-time" placeholder="e.g. 45 for a hold/interval"/></div>
          <div class="field" style="margin-bottom:0;grid-column:1/-1;"><label>Target RPE (effort out of 10, optional)</label><input type="number" step="0.5" min="1" max="10" class="ps-rpe"/></div>
        </div>
        <button type="button" class="btn btn-ghost btn-sm ps-remove-row" style="margin-top:8px;padding-left:0;color:var(--danger);">Remove</button>
      </div>
    `);
    $(`#${id} .ps-remove-row`).addEventListener('click', () => $(`#${id}`).remove());
  }
  addExerciseRow();
  $('#ps-add-row-btn').addEventListener('click', addExerciseRow);
  $('#ps-save-btn').addEventListener('click', async () => {
    const title = $('#ps-title').value.trim();
    if(!title){ $('#ps-error').textContent='Give the session a title.'; $('#ps-error').style.display='block'; return; }
    const rows = $$('#ps-exercise-rows > div');
    if(!rows.length){ $('#ps-error').textContent='Add at least one exercise.'; $('#ps-error').style.display='block'; return; }
    const dateVal = $('#ps-date').value || null;
    const repeat = $('#ps-repeat').checked;
    const weeks = repeat ? (parseInt($('#ps-repeat-weeks').value) || 6) : 1;
    if(repeat && !dateVal){ $('#ps-error').textContent='Set a date above to repeat this session weekly.'; $('#ps-error').style.display='block'; return; }
    $('#ps-error').style.display = 'none';

    const btn = $('#ps-save-btn'); setLoading(btn, true);
    const rowData = rows.map((row, i) => ({
      exercise_id: $('.ps-ex-select', row).value,
      order_index: i,
      prescribed_sets: parseInt($('.ps-sets', row).value) || null,
      prescribed_reps: $('.ps-reps', row).value.trim(),
      prescribed_weight_kg: parseFloat($('.ps-weight', row).value) || null,
      prescribed_time_seconds: parseFloat($('.ps-time', row).value) || null,
      target_rpe: parseFloat($('.ps-rpe', row).value) || null,
    }));
    const notes = $('#ps-notes').value.trim();

    let createdCount = 0;
    for(let w = 0; w < weeks; w++){
      let occurrenceDate = null;
      if(dateVal){
        const d = new Date(dateVal + 'T00:00:00');
        d.setDate(d.getDate() + (w * 7));
        occurrenceDate = d.toISOString().slice(0,10);
      }
      const { data: session, error: sessErr } = await sb.from('sessions').insert({
        client_id: clientId, title, scheduled_date: occurrenceDate, trainer_notes: notes,
      }).select().single();
      if(sessErr){ setLoading(btn,false,'Save program'); $('#ps-error').textContent = sessErr.message; $('#ps-error').style.display='block'; return; }
      const exercisePayload = rowData.map(r => ({ ...r, session_id: session.id }));
      const { error: seErr } = await sb.from('session_exercises').insert(exercisePayload);
      if(seErr){ setLoading(btn,false,'Save program'); $('#ps-error').textContent = seErr.message; $('#ps-error').style.display='block'; return; }
      createdCount++;
    }
    setLoading(btn, false, 'Save program');
    closeModal();
    toast(createdCount > 1 ? `${createdCount} weekly sessions programmed.` : 'Session programmed.', 'success');
    renderClients();
  });
}

// ============================================================================
// INBOX (admin) — "Speak to Sabs" contact requests from the landing page
// ============================================================================

async function renderInbox(){
  const el = $('#view-inbox');
  el.innerHTML = `<div class="skeleton" style="height:200px;"></div>`;
  const { data, error } = await sb.from('contact_requests').select('*').order('created_at', { ascending:false });
  if(error){ el.innerHTML = `<div class="empty-state"><h3>Could not load the inbox</h3><p>${escapeHtml(error.message)}</p></div>`; return; }
  const requests = data || [];
  const newCount = requests.filter(r => r.status === 'new').length;
  const dot = $('#inbox-dot'); if(dot) dot.style.display = newCount ? 'block' : 'none';

  el.innerHTML = `
    <div class="page-head"><div><div class="eyebrow">Speak to Sabs</div><h1>Inbox</h1></div></div>
    ${!requests.length ? `<div class="empty-state"><h3>No enquiries yet</h3><p>Messages from the "Speak to Sabs" form on your landing page will land here.</p></div>` : requests.map(r => `
      <div class="card" style="margin-bottom:14px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:10px;">
          <div>
            <div style="font-weight:600;font-size:15.5px;">${escapeHtml(r.name)}</div>
            <div class="hint">${escapeHtml(r.email)}${r.phone ? ' · ' + escapeHtml(r.phone) : ''} · ${timeAgo(r.created_at)}</div>
          </div>
          <span class="badge ${r.status==='new'?'badge-new':r.status==='contacted'?'badge-upcoming':'badge-completed'}">${r.status}</span>
        </div>
        <div class="tag" style="margin-bottom:10px;display:inline-block;">${escapeHtml(r.training_goal||'General enquiry')}</div>
        <p style="font-size:14.5px;color:var(--text-muted);line-height:1.6;margin-bottom:14px;">${escapeHtml(r.message || 'No additional message.')}</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          ${r.status !== 'contacted' ? `<button class="btn btn-outline btn-sm mark-contacted-btn" data-id="${r.id}">Mark contacted</button>` : ''}
          ${r.status !== 'closed' ? `<button class="btn btn-ghost btn-sm mark-closed-btn" data-id="${r.id}">Close</button>` : ''}
          <a class="btn btn-outline btn-sm" href="mailto:${escapeHtml(r.email)}">Reply by email</a>
          <button class="btn btn-danger btn-sm delete-request-btn" data-id="${r.id}">${ICON.trash} Delete</button>
        </div>
      </div>
    `).join('')}
  `;
  $$('.mark-contacted-btn').forEach(b => b.addEventListener('click', () => updateContactStatus(b.dataset.id, 'contacted')));
  $$('.mark-closed-btn').forEach(b => b.addEventListener('click', () => updateContactStatus(b.dataset.id, 'closed')));
  $$('.delete-request-btn').forEach(b => b.addEventListener('click', () => deleteContactRequest(b.dataset.id)));
}

async function deleteContactRequest(id){
  if(!confirm('Delete this enquiry? This can\'t be undone.')) return;
  const { error } = await sb.from('contact_requests').delete().eq('id', id);
  if(error){ toast('Could not delete this enquiry.', 'error'); return; }
  toast('Enquiry deleted.', 'success');
  renderInbox();
}

async function updateContactStatus(id, status){
  const { error } = await sb.from('contact_requests').update({ status }).eq('id', id);
  if(error){ toast('Could not update this request.', 'error'); return; }
  toast('Updated.', 'success');
  renderInbox();
}
