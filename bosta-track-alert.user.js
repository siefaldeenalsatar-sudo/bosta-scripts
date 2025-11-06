// ==UserScript==
// @name         Bosta Track Alerts (auto-update from GitHub)
// @namespace    http://tampermonkey.net/
// @version      1.4
// @description  Alerts for specific track IDs + auto-update check from GitHub every minute
// @match        https://*.bosta.co/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function(){
  'use strict';
  console.log('[BostaTrackAlerts] started');

  // --- CONFIG ---
  const TRACKS = {
    '23666480': '⚠️ اقفل DAMAGE'
  };
  const RAW_URL = 'https://raw.githubusercontent.com/USERNAME/bosta-scripts/main/bosta-track-alert.user.js'; // عدّل ده

  const BANNER_ID = 'bosta-track-alert-banner-v1';

  function showBanner(text){
    removeBanner();
    const box = document.createElement('div');
    box.id = BANNER_ID;
    box.setAttribute('role','alert');
    box.style.cssText = [
      'position:fixed','top:10px','left:50%','transform:translateX(-50%)','z-index:2147483647',
      'background:#d32f2f','color:#fff','padding:12px 18px','border-radius:10px',
      'font-size:18px','font-weight:800','font-family:Cairo, Arial, sans-serif',
      'display:flex','align-items:center','gap:12px','box-shadow:0 10px 30px rgba(0,0,0,0.35)'
    ].join(';');
    const span = document.createElement('span');
    span.textContent = text;
    const hide = document.createElement('button');
    hide.textContent = 'إخفاء';
    hide.style.cssText = 'background:rgba(255,255,255,0.12);border:none;color:#fff;padding:6px 10px;border-radius:8px;cursor:pointer;font-weight:700';
    hide.addEventListener('click', ()=> box.remove());
    box.appendChild(span);
    box.appendChild(hide);
    document.body.appendChild(box);
  }

  function removeBanner(){
    const el = document.getElementById(BANNER_ID);
    if(el) el.remove();
  }

  function urlContainsTrackId(id){
    const url = location.href || '';
    return (url.includes('/fulfillment/returns/ro/') && url.includes('/' + id)) || url.includes(id);
  }

  function bodyContainsTrackId(id){
    try {
      const bodyText = document.body?.innerText || '';
      return bodyText.includes(id);
    } catch { return false; }
  }

  function findMatchingTrack(){
    for(const id of Object.keys(TRACKS)){
      if(urlContainsTrackId(id) || bodyContainsTrackId(id)) return id;
    }
    return null;
  }

  let lastMatched = null;
  function runCheck(){
    const matched = findMatchingTrack();
    if(matched && matched !== lastMatched){
      showBanner(TRACKS[matched]);
      lastMatched = matched;
    } else if(!matched && lastMatched){
      removeBanner();
      lastMatched = null;
    }
  }

  const mo = new MutationObserver(runCheck);
  mo.observe(document.documentElement, { childList:true, subtree:true, characterData:true });

  (function(history){
    const push = history.pushState;
    history.pushState = function(){
      const res = push.apply(this, arguments);
      setTimeout(runCheck, 150);
      return res;
    };
  })(window.history);
  window.addEventListener('popstate', ()=> setTimeout(runCheck, 150));
  setTimeout(runCheck, 300);
  setInterval(runCheck, 2000);

  // === Auto-Update Checker ===
  let lastHash = null;
  async function checkUpdate(){
    try {
      const text = await (await fetch(RAW_URL + '?t=' + Date.now())).text();
      const newHash = btoa(text);
      if (lastHash && newHash !== lastHash) {
        console.warn('[BostaTrackAlerts] Update detected!');
        alert('📢 تم اكتشاف تحديث جديد — أعد تحميل الصفحة لتفعيل النسخة الجديدة!');
      }
      lastHash = newHash;
    } catch(e){ console.error('[BostaTrackAlerts] update check failed', e); }
  }
  checkUpdate();
  setInterval(checkUpdate, 60000); // كل دقيقة

  window._BostaTrackAlerts = { runCheck, checkUpdate, TRACKS };
})();
