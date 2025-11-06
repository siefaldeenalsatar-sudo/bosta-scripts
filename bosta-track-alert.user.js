// ==UserScript==
// @name         Bosta Track Alerts (Auto-update helper)
// @namespace    http://tampermonkey.net/
// @version      1.7
// @description  Alerts for tracks + checks GitHub raw every minute. If updated, opens raw URL (to prompt Tampermonkey) and reloads page.
// @match        https://*.bosta.co/*
// @run-at       document-idle
// @grant        none
// @updateURL    https://raw.githubusercontent.com/siefaldeenalsatar-sudo/bosta-scripts/main/bosta-track-alert.user.js
// @downloadURL  https://raw.githubusercontent.com/siefaldeenalsatar-sudo/bosta-scripts/main/bosta-track-alert.user.js
// ==/UserScript==

(function(){
  'use strict';
  console.log('[BostaTrackAlerts] start v1.5');

  // ====== CONFIG ======
  const TRACKS = {
    '54645466': '⚠️ اقفل DAMAGE'
    // اضف اي تراكات هنا
  };

  // رابط raw للملف في GitHub (تأكد من أنه هو نفس الملف)
  const RAW_URL = 'https://raw.githubusercontent.com/siefaldeenalsatar-sudo/bosta-scripts/main/bosta-track-alert.user.js';

  // كم مرة يفحص (مللي ثانية)
  const CHECK_INTERVAL_MS = 60 * 1000; // كل دقيقة

  // لو true: عندما يُكتشف تحديث، سيفتح تبويب جديد للرابط الخام تلقائياً
  const AUTO_OPEN_RAW = true;

  // لو true: يعيد تحميل الصفحة بعد العد التنازلي تلقائياً (بما في ذلك لو AUTO_OPEN_RAW=false)
  const AUTO_RELOAD_AFTER_OPEN = true;

  // وقت الانتظار قبل إعادة التحميل (بالثواني) — يعطي Tampermonkey وقت لفتح UI التثبيت
  const RELOAD_DELAY_SECONDS = 6;

  // ====== UI (بانر إشعار) ======
  const BANNER_ID = 'bosta-update-banner-v1';
  function showUpdateBanner(remoteVersionHint) {
    if (document.getElementById(BANNER_ID)) return;
    const box = document.createElement('div');
    box.id = BANNER_ID;
    Object.assign(box.style, {
      position: 'fixed',
      top: '10px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 2147483647,
      background: '#ff9800',
      color: '#000',
      padding: '12px 16px',
      borderRadius: '10px',
      fontSize: '15px',
      fontFamily: 'Cairo, Arial, sans-serif',
      boxShadow: '0 8px 30px rgba(0,0,0,0.25)',
      display: 'flex',
      gap: '10px',
      alignItems: 'center'
    });

    const text = document.createElement('div');
    text.innerHTML = `<b>📢 تحديث متاح للسكربت</b>${remoteVersionHint ? ' — ' + escapeHtml(remoteVersionHint) : ''}`;

    const openBtn = document.createElement('button');
    openBtn.textContent = 'فتح التحديث';
    Object.assign(openBtn.style, btnStyle());
    openBtn.onclick = () => { openRawAndMaybeReload(); };

    const reloadBtn = document.createElement('button');
    reloadBtn.textContent = 'تحديث الآن';
    Object.assign(reloadBtn.style, btnStyle());
    reloadBtn.onclick = () => { forceReloadNow(); };

    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'إخفاء';
    Object.assign(closeBtn.style, btnStyle(false));
    closeBtn.onclick = () => { box.remove(); };

    const note = document.createElement('div');
    note.style.fontSize = '12px';
    note.style.opacity = '0.9';
    note.textContent = ' سيُفتح تبويب التثبيت ثم تُعاد الصفحة تلقائياً.';

    box.appendChild(text);
    box.appendChild(openBtn);
    box.appendChild(reloadBtn);
    box.appendChild(closeBtn);
    box.appendChild(note);

    (document.documentElement || document.body).appendChild(box);
  }

  function btnStyle(primary=true) {
    return {
      padding: '6px 10px',
      borderRadius: '6px',
      border: 'none',
      cursor: 'pointer',
      fontWeight: '700',
      background: primary ? '#fff' : 'rgba(0,0,0,0.06)',
      color: primary ? '#000' : '#000'
    };
  }

  function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]); }

  // ====== TRACK DETECTION ======
  function urlContainsTrackId(id){
    try {
      const url = location.href || '';
      return (url.includes('/fulfillment/returns/ro/') && url.includes('/' + id)) || url.includes(id);
    } catch { return false; }
  }
  function bodyContainsTrackId(id){
    try { return (document.body && document.body.innerText || '').includes(id); } catch { return false; }
  }
  function findMatchingTrack(){
    for(const id of Object.keys(TRACKS)){
      if(urlContainsTrackId(id) || bodyContainsTrackId(id)) return id;
    }
    return null;
  }

  const TRACK_BANNER_ID = 'bosta-track-banner';
  function showTrackBanner(txt){
    removeTrackBanner();
    const box = document.createElement('div');
    box.id = TRACK_BANNER_ID;
    Object.assign(box.style, {
      position:'fixed', top:'10px', left:'50%', transform:'translateX(-50%)',
      zIndex:2147483646, background:'#d32f2f', color:'#fff', padding:'10px 14px',
      borderRadius:'10px', fontSize:'16px', fontWeight:'800', fontFamily:'Cairo, Arial, sans-serif',
      boxShadow:'0 8px 30px rgba(0,0,0,0.3)'
    });
    box.textContent = txt;
    const btn = document.createElement('button');
    btn.textContent = 'إخفاء';
    Object.assign(btn.style, { marginLeft:'10px', background:'rgba(255,255,255,0.12)', border:'none', color:'#fff', padding:'6px 8px', borderRadius:'6px', cursor:'pointer' });
    btn.onclick = ()=> box.remove();
    box.appendChild(btn);
    (document.documentElement || document.body).appendChild(box);
  }
  function removeTrackBanner(){ const el=document.getElementById(TRACK_BANNER_ID); if(el) el.remove(); }

  // monitor page for track
  let lastTrack = null;
  function checkTrack(){
    const t = findMatchingTrack();
    if(t && t !== lastTrack){
      showTrackBanner(TRACKS[t]);
      lastTrack = t;
    } else if(!t && lastTrack){
      removeTrackBanner(); lastTrack = null;
    }
  }
  const mo = new MutationObserver(()=> checkTrack());
  try{ mo.observe(document.documentElement, { childList:true, subtree:true, characterData:true }); }catch(e){}
  (function(h){
    const p=h.pushState; h.pushState=function(){ const r=p.apply(this,arguments); setTimeout(checkTrack,150); return r; };
  })(window.history);
  window.addEventListener('popstate', ()=> setTimeout(checkTrack,150));
  setTimeout(checkTrack,300);
  setInterval(checkTrack,2000);

  // ====== AUTO-UPDATE CHECKER ======
  let lastHash = null;
  let checking = false;

  async function fetchRawText(){
    try {
      const r = await fetch(RAW_URL + '?_=' + Date.now(), { cache: 'no-store' });
      if(!r.ok) throw new Error('fetch status ' + r.status);
      return await r.text();
    } catch(e){
      console.warn('[BostaTrackAlerts] fetchRaw failed', e);
      throw e;
    }
  }

  async function checkUpdate(){
    if(checking) return;
    checking = true;
    try {
      const txt = await fetchRawText();
      const hash = await simpleHash(txt);
      if(lastHash && hash !== lastHash){
        console.log('[BostaTrackAlerts] update detected (hash changed)');
        const verMatch = txt.match(/@version\s+([^\s]+)/i);
        const ver = verMatch ? verMatch[1] : null;
        showUpdateBanner(ver ? ('new @version: ' + ver) : null);
        if(AUTO_OPEN_RAW){
          try { window.open(RAW_URL, '_blank'); console.log('[BostaTrackAlerts] opened raw URL to prompt Tampermonkey'); } catch(e){ console.warn(e); }
        }
        if(AUTO_RELOAD_AFTER_OPEN){
          setTimeout(()=> {
            console.log('[BostaTrackAlerts] reloading page to apply update...');
            try { location.reload(); } catch(e){ window.location.href = window.location.href; }
          }, RELOAD_DELAY_SECONDS * 1000);
        }
      }
      lastHash = hash;
    } catch(e){}
    checking = false;
  }

  // simple hash function (using SubtleCrypto if available)
  async function simpleHash(str){
    try {
      if(window.crypto && crypto.subtle && crypto.subtle.digest){
        const enc = new TextEncoder().encode(str);
        const digest = await crypto.subtle.digest('SHA-256', enc);
        return Array.from(new Uint8Array(digest)).map(b=>('00'+b.toString(16)).slice(-2)).join('');
      }
    } catch(e){}
    return btoa(unescape(encodeURIComponent(str))).slice(0,80);
  }

  // first fetch to seed lastHash (avoid immediate trigger)
  (async ()=> {
    try {
      const initTxt = await fetchRawText();
      lastHash = await simpleHash(initTxt);
      console.log('[BostaTrackAlerts] seeded remote hash');
    } catch(e){
      console.warn('[BostaTrackAlerts] initial seed failed');
    }
  })();

  // periodic check
  setInterval(checkUpdate, CHECK_INTERVAL_MS);
  // expose for debug
  window._BostaTrackAlerts = { checkUpdate, RAW_URL, TRACKS };

  // helper actions
  function openRawAndMaybeReload(){
    try { window.open(RAW_URL, '_blank'); } catch(e){ console.warn(e); }
    if(AUTO_RELOAD_AFTER_OPEN){
      setTimeout(()=> { try { location.reload(); } catch(e){ window.location.href = window.location.href; } }, RELOAD_DELAY_SECONDS*1000);
    }
  }
  function forceReloadNow(){ try { location.reload(); } catch(e){ window.location.href = window.location.href; } }

})();
