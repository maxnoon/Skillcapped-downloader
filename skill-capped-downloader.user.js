// ==UserScript==
// @name        Skill-Capped Video Downloader testyuuu
// @namespace   http://tampermonkey.net/
// @version     11.1
// @description Redesigned player UI: floating mini-player bar, glassmorphic overlay, rich episode sidebar, keyboard shortcuts HUD, quality/speed controls, PiP, bulk download, resume — all in a cohesive dark UI.
// @author      Max
// @match       https://www.skill-capped.com/*
// @require     https://cdn.jsdelivr.net/npm/hls.js@1.5.13/dist/hls.min.js
// @grant       GM_xmlhttpRequest
// @connect     d13z5uuzt1wkbz.cloudfront.net
// @run-at      document-idle
// ==/UserScript==

(function () {
  "use strict";

  /* ─────────────────────────────────────────────
     CONFIG
  ───────────────────────────────────────────── */
  var CDN = "https://d13z5uuzt1wkbz.cloudfront.net";
  var CONCURRENCY = 6;
  var MAX_RETRIES = 2;
  var AUTONEXT_DELAY = 5;
  var SPEEDS = [0.75, 1, 1.25, 1.5, 2];
  var QUALITIES = [
    { res: "2500", label: "1080p" },
    { res: "1500", label: "720p" },
    { res: "1000", label: "480p" },
  ];
  var currentRes = (function () {
    try {
      return localStorage.getItem("sc-quality") || "2500";
    } catch (e) {
      return "2500";
    }
  })();

  /* ─────────────────────────────────────────────
     STYLES
  ───────────────────────────────────────────── */
  function injectStyles() {
    if (document.getElementById("sc-dl-styles")) return;
    var s = document.createElement("style");
    s.id = "sc-dl-styles";
    s.textContent = `
      :root {
        --sc-bg0: #0d0d0f;
        --sc-bg1: #141418;
        --sc-bg2: #1c1c22;
        --sc-bg3: #252530;
        --sc-bg4: #2e2e3a;
        --sc-red: #e03c3c;
        --sc-red-dim: #a82a2a;
        --sc-red-glow: rgba(224,60,60,0.18);
        --sc-gold: #f0a500;
        --sc-green: #3ecf6e;
        --sc-orange: #f08030;
        --sc-text: #e8e8f0;
        --sc-text2: #9898b0;
        --sc-text3: #5a5a72;
        --sc-border: rgba(255,255,255,0.07);
        --sc-border2: rgba(255,255,255,0.12);
        --sc-radius: 10px;
        --sc-radius-sm: 6px;
        --sc-font: 'Inter', 'Segoe UI', system-ui, sans-serif;
      }

      /* ── FLOATING RESUME BAR ── */
      .sc-fab {
        position: fixed;
        top: 14px;
        left: 50px;
        z-index: 2147483647;
        display: flex;
        align-items: center;
        gap: 0;
        background: var(--sc-bg1);
        border: 1px solid var(--sc-border2);
        border-radius: 40px;
        box-shadow: 0 4px 24px rgba(0,0,0,0.55), 0 0 0 1px var(--sc-border);
        overflow: hidden;
        font-family: var(--sc-font);
        transition: box-shadow 0.2s;
      }
      .sc-fab:hover {
        box-shadow: 0 6px 32px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.15);
      }
      .sc-fab-play {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 9px 16px 9px 14px;
        background: var(--sc-red);
        color: #fff;
        border: none;
        cursor: pointer;
        font-family: var(--sc-font);
        font-size: 12px;
        font-weight: 600;
        letter-spacing: 0.02em;
        white-space: nowrap;
        transition: background 0.15s;
      }
      .sc-fab-play:hover { background: #c83030; }
      .sc-fab-play svg { flex-shrink: 0; }
      .sc-fab-meta {
        padding: 0 14px;
        font-size: 11px;
        color: var(--sc-text2);
        font-family: var(--sc-font);
        white-space: nowrap;
        display: flex;
        flex-direction: column;
        gap: 1px;
      }
      .sc-fab-title {
        color: var(--sc-text);
        font-size: 12px;
        font-weight: 500;
        max-width: 200px;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      /* ── OVERLAY ── */
      .sc-overlay {
        position: fixed;
        inset: 0;
        background: rgba(6,6,10,0.88);
        z-index: 2147483646;
        display: flex;
        align-items: center;
        justify-content: center;
        backdrop-filter: blur(4px);
        -webkit-backdrop-filter: blur(4px);
        animation: sc-fadein 0.18s ease;
      }
      @keyframes sc-fadein {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      /* ── PLAYER SHELL ── */
      .sc-player {
        position: relative;
        width: 92vw;
        max-width: 1280px;
        height: 86vh;
        max-height: 800px;
        background: var(--sc-bg0);
        border-radius: 14px;
        border: 1px solid var(--sc-border2);
        box-shadow: 0 32px 80px rgba(0,0,0,0.75);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        animation: sc-slideup 0.2s ease;
      }
      @keyframes sc-slideup {
        from { transform: translateY(16px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }

      /* ── TOPBAR ── */
      .sc-topbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px 14px;
        background: var(--sc-bg1);
        border-bottom: 1px solid var(--sc-border);
        flex-shrink: 0;
        gap: 10px;
      }
      .sc-topbar-left {
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 0;
        flex: 1;
      }
      .sc-logo-mark {
        width: 26px;
        height: 26px;
        background: var(--sc-red);
        border-radius: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      .sc-course-title {
        font-family: var(--sc-font);
        font-size: 12px;
        font-weight: 600;
        color: var(--sc-text2);
        letter-spacing: 0.06em;
        text-transform: uppercase;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .sc-ep-title {
        font-family: var(--sc-font);
        font-size: 13px;
        font-weight: 500;
        color: var(--sc-text);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .sc-sep { color: var(--sc-text3); font-size: 12px; }
      .sc-topbar-right {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-shrink: 0;
      }

      /* ── CONTENT AREA ── */
      .sc-content {
        display: flex;
        flex: 1;
        min-height: 0;
      }

      /* ── VIDEO PANE ── */
      .sc-video-pane {
        flex: 1;
        display: flex;
        flex-direction: column;
        min-width: 0;
        background: #000;
      }
      .sc-video-wrap {
        position: relative;
        flex: 1;
        background: #000;
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 0;
      }
      .sc-video-wrap video {
        width: 100%;
        height: 100%;
        object-fit: contain;
        display: block;
      }
      .sc-loading {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 14px;
        background: #000;
        z-index: 5;
      }
      .sc-spinner {
        width: 36px;
        height: 36px;
        border: 3px solid var(--sc-bg3);
        border-top-color: var(--sc-red);
        border-radius: 50%;
        animation: sc-spin 0.7s linear infinite;
      }
      @keyframes sc-spin { to { transform: rotate(360deg); } }
      .sc-loading-text {
        font-family: var(--sc-font);
        font-size: 13px;
        color: var(--sc-text2);
      }

      /* ── CONTROLS ── */
      .sc-controls {
        background: var(--sc-bg1);
        border-top: 1px solid var(--sc-border);
        padding: 0;
        flex-shrink: 0;
      }
      .sc-progress-wrap {
        position: relative;
        height: 3px;
        background: var(--sc-bg4);
        cursor: pointer;
        transition: height 0.15s;
      }
      .sc-progress-wrap:hover { height: 5px; }
      .sc-progress-fill {
        height: 100%;
        background: var(--sc-red);
        pointer-events: none;
        position: relative;
        transition: width 0.1s linear;
      }
      .sc-progress-fill::after {
        content: '';
        position: absolute;
        right: -4px;
        top: 50%;
        transform: translateY(-50%) scale(0);
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: var(--sc-red);
        transition: transform 0.15s;
      }
      .sc-progress-wrap:hover .sc-progress-fill::after {
        transform: translateY(-50%) scale(1);
      }
      .sc-controls-row {
        display: flex;
        align-items: center;
        padding: 8px 12px;
        gap: 6px;
      }
      .sc-controls-left {
        display: flex;
        align-items: center;
        gap: 6px;
        flex: 1;
      }
      .sc-controls-right {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-shrink: 0;
      }
      .sc-time {
        font-family: var(--sc-font);
        font-size: 12px;
        color: var(--sc-text2);
        white-space: nowrap;
        min-width: 90px;
      }

      /* ── ICON BUTTON ── */
      .sc-icon-btn {
        width: 32px;
        height: 32px;
        border-radius: var(--sc-radius-sm);
        border: none;
        background: transparent;
        color: var(--sc-text2);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.12s, color 0.12s;
        flex-shrink: 0;
      }
      .sc-icon-btn:hover { background: var(--sc-bg3); color: var(--sc-text); }
      .sc-icon-btn.active { color: var(--sc-red); }

      /* ── PILL BUTTON ── */
      .sc-pill {
        height: 28px;
        padding: 0 10px;
        border-radius: 20px;
        border: 1px solid var(--sc-border2);
        background: var(--sc-bg2);
        color: var(--sc-text2);
        font-family: var(--sc-font);
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.12s, color 0.12s, border-color 0.12s;
        white-space: nowrap;
      }
      .sc-pill:hover { background: var(--sc-bg3); color: var(--sc-text); border-color: var(--sc-border2); }
      .sc-pill.active { background: var(--sc-red); color: #fff; border-color: var(--sc-red); }

      /* ── ACTION BUTTON ── */
      .sc-action-btn {
        height: 30px;
        padding: 0 12px;
        border-radius: var(--sc-radius-sm);
        border: 1px solid var(--sc-border2);
        background: var(--sc-bg2);
        color: var(--sc-text);
        font-family: var(--sc-font);
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.12s;
        display: flex;
        align-items: center;
        gap: 5px;
        white-space: nowrap;
        position: relative;
        overflow: hidden;
      }
      .sc-action-btn:hover { background: var(--sc-bg3); }
      .sc-action-btn.red { background: var(--sc-red); border-color: var(--sc-red); }
      .sc-action-btn.red:hover { background: #c83030; }
      .sc-action-btn:disabled { opacity: 0.5; cursor: default; }
      .sc-action-btn .sc-btn-bar {
        position: absolute;
        bottom: 0;
        left: 0;
        height: 2px;
        background: rgba(255,255,255,0.5);
        transition: width 0.2s ease;
      }

      /* ── CLOSE BTN ── */
      .sc-close-btn {
        width: 30px;
        height: 30px;
        border-radius: var(--sc-radius-sm);
        border: 1px solid var(--sc-border);
        background: var(--sc-bg2);
        color: var(--sc-text2);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.12s, color 0.12s;
        flex-shrink: 0;
      }
      .sc-close-btn:hover { background: #3a1a1a; color: var(--sc-red); border-color: var(--sc-red-dim); }

      /* ── VOLUME ── */
      .sc-vol-wrap {
        display: flex;
        align-items: center;
        gap: 5px;
      }
      .sc-vol-slider {
        -webkit-appearance: none;
        appearance: none;
        width: 64px;
        height: 3px;
        border-radius: 3px;
        background: var(--sc-bg4);
        outline: none;
        cursor: pointer;
      }
      .sc-vol-slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: var(--sc-text);
        cursor: pointer;
      }

      /* ── SIDEBAR ── */
      .sc-sidebar {
        width: 300px;
        flex-shrink: 0;
        background: var(--sc-bg1);
        border-left: 1px solid var(--sc-border);
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      .sc-sidebar-header {
        padding: 12px 14px 10px;
        border-bottom: 1px solid var(--sc-border);
        flex-shrink: 0;
      }
      .sc-sidebar-heading {
        font-family: var(--sc-font);
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--sc-text3);
        margin-bottom: 8px;
      }
      .sc-sidebar-search {
        width: 100%;
        background: var(--sc-bg2);
        border: 1px solid var(--sc-border);
        border-radius: var(--sc-radius-sm);
        padding: 6px 10px;
        color: var(--sc-text);
        font-family: var(--sc-font);
        font-size: 12px;
        outline: none;
        box-sizing: border-box;
        transition: border-color 0.15s;
      }
      .sc-sidebar-search::placeholder { color: var(--sc-text3); }
      .sc-sidebar-search:focus { border-color: var(--sc-red-dim); }
      .sc-sidebar-progress {
        font-family: var(--sc-font);
        font-size: 11px;
        color: var(--sc-text3);
        margin-top: 8px;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .sc-sidebar-prog-bar {
        height: 2px;
        background: var(--sc-bg4);
        border-radius: 2px;
        margin-top: 6px;
        overflow: hidden;
      }
      .sc-sidebar-prog-fill {
        height: 100%;
        background: var(--sc-green);
        border-radius: 2px;
        transition: width 0.4s ease;
      }
      .sc-ep-list {
        overflow-y: auto;
        flex: 1;
        padding: 6px 0;
        scrollbar-width: thin;
        scrollbar-color: var(--sc-bg4) transparent;
      }
      .sc-ep-list::-webkit-scrollbar { width: 4px; }
      .sc-ep-list::-webkit-scrollbar-thumb { background: var(--sc-bg4); border-radius: 4px; }

      /* ── EPISODE CARD ── */
      .sc-ep-card {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        padding: 9px 14px;
        cursor: pointer;
        transition: background 0.1s;
        position: relative;
        border-left: 3px solid transparent;
      }
      .sc-ep-card:hover { background: var(--sc-bg2); }
      .sc-ep-card.active {
        background: var(--sc-bg2);
        border-left-color: var(--sc-red);
      }
      .sc-ep-card.active .sc-ep-num { color: var(--sc-red); }
      .sc-ep-num {
        font-family: var(--sc-font);
        font-size: 10px;
        font-weight: 700;
        color: var(--sc-text3);
        min-width: 20px;
        text-align: right;
        padding-top: 1px;
        flex-shrink: 0;
      }
      .sc-ep-body { flex: 1; min-width: 0; }
      .sc-ep-name {
        font-family: var(--sc-font);
        font-size: 12px;
        font-weight: 500;
        color: var(--sc-text);
        line-height: 1.4;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .sc-ep-meta {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-top: 3px;
      }
      .sc-ep-dur {
        font-family: var(--sc-font);
        font-size: 10px;
        color: var(--sc-text3);
      }
      .sc-ep-status {
        font-size: 10px;
        font-weight: 600;
        letter-spacing: 0.04em;
      }
      .sc-ep-status.watched { color: var(--sc-green); }
      .sc-ep-status.progress { color: var(--sc-orange); }
      .sc-ep-mini-bar {
        height: 2px;
        background: var(--sc-bg4);
        border-radius: 2px;
        margin-top: 5px;
        overflow: hidden;
      }
      .sc-ep-mini-fill {
        height: 100%;
        background: var(--sc-orange);
        border-radius: 2px;
      }
      .sc-ep-watched-fill {
        height: 100%;
        background: var(--sc-green);
        border-radius: 2px;
      }
      .sc-ep-play-icon {
        flex-shrink: 0;
        width: 22px;
        height: 22px;
        border-radius: 50%;
        background: var(--sc-bg3);
        border: 1px solid var(--sc-border);
        display: flex;
        align-items: center;
        justify-content: center;
        margin-top: 1px;
        transition: background 0.12s, border-color 0.12s;
      }
      .sc-ep-card:hover .sc-ep-play-icon,
      .sc-ep-card.active .sc-ep-play-icon {
        background: var(--sc-red);
        border-color: var(--sc-red);
      }
      .sc-bulk-row {
        padding: 10px 14px;
        border-top: 1px solid var(--sc-border);
        flex-shrink: 0;
      }
      .sc-bulk-btn {
        width: 100%;
        height: 32px;
        border-radius: var(--sc-radius-sm);
        border: 1px solid var(--sc-border2);
        background: var(--sc-bg2);
        color: var(--sc-text2);
        font-family: var(--sc-font);
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.12s, color 0.12s;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
      }
      .sc-bulk-btn:hover { background: var(--sc-bg3); color: var(--sc-text); }
      .sc-bulk-btn:disabled { opacity: 0.4; cursor: default; }

      /* ── AUTO-NEXT ── */
      .sc-autonext {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        background: var(--sc-bg1);
        border-top: 1px solid var(--sc-border);
        padding: 12px 16px;
        display: flex;
        align-items: center;
        gap: 12px;
        z-index: 20;
        animation: sc-fadein 0.2s ease;
      }
      .sc-autonext-label {
        flex: 1;
        font-family: var(--sc-font);
        font-size: 12px;
        color: var(--sc-text2);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .sc-autonext-label strong { color: var(--sc-text); }
      .sc-autonext-prog {
        position: absolute;
        bottom: 0;
        left: 0;
        height: 2px;
        background: var(--sc-red);
        transition: width 1s linear;
      }

      /* ── TOAST ── */
      .sc-toast {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%,-50%);
        background: rgba(0,0,0,0.75);
        color: #fff;
        padding: 10px 20px;
        border-radius: var(--sc-radius);
        font-family: var(--sc-font);
        font-size: 22px;
        font-weight: 700;
        z-index: 30;
        pointer-events: none;
        animation: sc-toastanim 0.7s ease forwards;
      }
      .sc-toast-sm {
        position: absolute;
        top: 14px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0,0,0,0.7);
        color: #fff;
        padding: 6px 14px;
        border-radius: 20px;
        font-family: var(--sc-font);
        font-size: 12px;
        font-weight: 500;
        z-index: 30;
        pointer-events: none;
        animation: sc-toastanim 1.8s ease forwards;
        white-space: nowrap;
      }
      @keyframes sc-toastanim {
        0% { opacity: 1; }
        60% { opacity: 1; }
        100% { opacity: 0; }
      }

      /* ── SHORTCUTS HUD ── */
      .sc-hud {
        position: absolute;
        inset: 0;
        background: rgba(0,0,0,0.82);
        z-index: 40;
        display: flex;
        align-items: center;
        justify-content: center;
        animation: sc-fadein 0.15s ease;
      }
      .sc-hud-box {
        background: var(--sc-bg1);
        border: 1px solid var(--sc-border2);
        border-radius: 14px;
        padding: 24px 32px;
        min-width: 340px;
      }
      .sc-hud-title {
        font-family: var(--sc-font);
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--sc-text3);
        margin-bottom: 16px;
      }
      .sc-hud-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px 24px;
      }
      .sc-hud-row {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .sc-kbd {
        background: var(--sc-bg3);
        border: 1px solid var(--sc-border2);
        border-radius: 4px;
        padding: 3px 8px;
        font-family: var(--sc-font);
        font-size: 11px;
        font-weight: 600;
        color: var(--sc-text);
        min-width: 32px;
        text-align: center;
        flex-shrink: 0;
      }
      .sc-hud-desc {
        font-family: var(--sc-font);
        font-size: 12px;
        color: var(--sc-text2);
      }

      /* ── DROPDOWN ── */
      .sc-dropdown { position: relative; }
      .sc-dropdown-menu {
        display: none;
        position: absolute;
        bottom: calc(100% + 6px);
        right: 0;
        background: var(--sc-bg2);
        border: 1px solid var(--sc-border2);
        border-radius: var(--sc-radius);
        padding: 4px;
        min-width: 160px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.5);
        z-index: 50;
      }
      .sc-dropdown.open .sc-dropdown-menu { display: block; }
      .sc-dropdown-item {
        display: flex;
        align-items: center;
        gap: 8px;
        width: 100%;
        padding: 8px 10px;
        border-radius: var(--sc-radius-sm);
        border: none;
        background: none;
        color: var(--sc-text2);
        font-family: var(--sc-font);
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        text-align: left;
        transition: background 0.1s, color 0.1s;
        white-space: nowrap;
      }
      .sc-dropdown-item:hover { background: var(--sc-bg3); color: var(--sc-text); }
      .sc-dropdown-sep {
        height: 1px;
        background: var(--sc-border);
        margin: 3px 6px;
      }

      /* ── INLINE WATCH BUTTON (browse page) ── */
      .sc-inline-btn {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        height: 28px;
        padding: 0 12px;
        background: var(--sc-red);
        color: #fff;
        border: none;
        border-radius: 20px;
        font-family: var(--sc-font);
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.12s, transform 0.12s;
        white-space: nowrap;
      }
      .sc-inline-btn:hover { background: #c83030; transform: translateY(-1px); }
      .sc-inline-btn.watched { background: transparent; border: 1px solid var(--sc-border2); color: var(--sc-green); }
      .sc-inline-btn.watched:hover { background: var(--sc-bg2); }
    `;
    document.head.appendChild(s);
  }

  /* ─────────────────────────────────────────────
     UTIL / STORAGE
  ───────────────────────────────────────────── */
  function store(k, v) {
    try {
      if (v == null) localStorage.removeItem(k);
      else localStorage.setItem(k, String(v));
    } catch (e) {}
  }
  function load(k, def) {
    try {
      var v = localStorage.getItem(k);
      return v != null ? v : def;
    } catch (e) {
      return def;
    }
  }
  function loadFloat(k, def) {
    var v = parseFloat(load(k, ""));
    return isNaN(v) ? def : v;
  }

  function savePos(id, t) {
    store("sc-pos-" + id, t);
  }
  function getPos(id) {
    return loadFloat("sc-pos-" + id, 0);
  }
  function clearPos(id) {
    store("sc-pos-" + id, null);
  }
  function markWatched(id) {
    store("sc-done-" + id, "1");
  }
  function isWatched(id) {
    return load("sc-done-" + id, "") === "1";
  }
  function mapTitle(t, id) {
    if (t && id) store("sc-tid-" + sanitize(t), id);
  }
  function idFromTitle(t) {
    return load("sc-tid-" + sanitize(t), null);
  }
  function getSavedSpeed() {
    return loadFloat("sc-speed", 1);
  }
  function saveSpeed(s) {
    store("sc-speed", s);
  }
  function getSavedVol() {
    return loadFloat("sc-vol", 1);
  }
  function saveVol(v) {
    store("sc-vol", v);
  }
  function getAutoNext() {
    return load("sc-autonext", "1") !== "0";
  }
  function saveAutoNext(v) {
    store("sc-autonext", v ? "1" : "0");
  }

  function sanitize(n) {
    return (
      (n || "")
        .replace(/[<>:"/\\|?*\x00-\x1f]/g, "")
        .trim()
        .substring(0, 100) || "video"
    );
  }
  function formatTime(sec) {
    if (!sec || isNaN(sec)) return "0:00";
    var h = Math.floor(sec / 3600),
      m = Math.floor((sec % 3600) / 60),
      s = Math.floor(sec % 60);
    return h > 0
      ? h + ":" + (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s
      : m + ":" + (s < 10 ? "0" : "") + s;
  }
  function formatMB(b) {
    return (b / 1048576).toFixed(1);
  }
  function formatEta(sec) {
    if (sec < 60) return sec + "s";
    return (
      Math.floor(sec / 60) + "m" + (sec % 60 < 10 ? "0" : "") + (sec % 60) + "s"
    );
  }

  /* ─────────────────────────────────────────────
     GM FETCH / HLS
  ───────────────────────────────────────────── */
  function gmFetch(url, type) {
    return new Promise(function (resolve, reject) {
      GM_xmlhttpRequest({
        method: "GET",
        url: url,
        responseType: type || "text",
        onload: function (r) {
          r.status >= 200 && r.status < 300
            ? resolve(r.response)
            : reject(new Error("HTTP " + r.status));
        },
        onerror: function () {
          reject(new Error("Network error"));
        },
        ontimeout: function () {
          reject(new Error("Timeout"));
        },
      });
    });
  }

  function newStats() {
    return {
      aborted: false,
      loaded: 0,
      retry: 0,
      total: 0,
      chunkCount: 0,
      bwEstimate: 0,
      loading: { start: 0, first: 0, end: 0 },
      parsing: { start: 0, end: 0 },
      buffering: { start: 0, first: 0, end: 0 },
    };
  }
  function GMLoader() {
    this._c = null;
    this.stats = newStats();
    this.context = null;
  }
  GMLoader.prototype.destroy = function () {
    this.abort();
  };
  GMLoader.prototype.abort = function () {
    this.stats.aborted = true;
    if (this._c) {
      this._c.abort();
      this._c = null;
    }
  };
  GMLoader.prototype.load = function (ctx, cfg, cb) {
    var self = this,
      url = ctx.url,
      st = self.stats;
    self.context = ctx;
    st.loading.start = performance.now();
    function ok(data) {
      var n = performance.now(),
        len =
          typeof data === "string"
            ? data.length
            : data
              ? data.byteLength || 0
              : 0;
      st.loading.first = st.loading.first || n;
      st.loading.end = n;
      st.loaded = len;
      st.total = len;
      st.parsing.start = n;
      st.parsing.end = n;
      cb.onSuccess({ url: url, data: data }, st, ctx, null);
    }
    function fail(c, t) {
      st.loading.end = performance.now();
      cb.onError({ code: c, text: t }, ctx, null);
    }
    if (url.indexOf("blob:") === 0) {
      var xhr = new XMLHttpRequest();
      xhr.open("GET", url);
      xhr.responseType = ctx.responseType || "";
      xhr.onload = function () {
        ok(xhr.response);
      };
      xhr.onerror = function () {
        fail(0, "XHR error");
      };
      xhr.send();
      self._c = {
        abort: function () {
          xhr.abort();
        },
      };
      return;
    }
    var rt = ctx.responseType === "arraybuffer" ? "arraybuffer" : "text";
    var req = GM_xmlhttpRequest({
      method: "GET",
      url: url,
      responseType: rt,
      onprogress: function (p) {
        st.loaded = p.loaded || 0;
        st.total = p.total || 0;
        if (!st.loading.first) st.loading.first = performance.now();
      },
      onload: function (r) {
        r.status >= 200 && r.status < 300
          ? ok(r.response)
          : fail(r.status, "HTTP " + r.status);
      },
      onerror: function () {
        fail(0, "Network error");
      },
      ontimeout: function () {
        st.loading.end = performance.now();
        cb.onTimeout(st, ctx, null);
      },
    });
    self._c = {
      abort: function () {
        if (req && req.abort) req.abort();
      },
    };
  };

  function getHls() {
    return typeof Hls !== "undefined" ? Hls : null;
  }

  /* ─────────────────────────────────────────────
     PLAYLIST / DOWNLOAD
  ───────────────────────────────────────────── */
  var playlistCache = {};
  function playlistUrl(id, res) {
    return CDN + "/" + id + "/HIDDEN" + (res || currentRes) + ".m3u8";
  }

  function fetchPlaylist(videoId, res) {
    var r = res || currentRes,
      key = videoId + "-" + r;
    if (playlistCache[key]) return Promise.resolve(playlistCache[key]);
    var pu = playlistUrl(videoId, r);
    return gmFetch(pu, "text").then(function (text) {
      var lines = text.split("\n"),
        urls = [],
        dur = 0,
        resolved = [];
      for (var i = 0; i < lines.length; i++) {
        var l = lines[i].trim();
        if (l.indexOf("#EXTINF:") === 0) {
          var d = parseFloat(l.replace("#EXTINF:", "").split(",")[0]);
          if (!isNaN(d)) dur += d;
          resolved.push(l);
        } else if (l && l.charAt(0) !== "#") {
          var abs = new URL(l, pu).href;
          urls.push(abs);
          resolved.push(abs);
        } else resolved.push(l);
      }
      var result = {
        urls: urls,
        duration: dur,
        m3u8Text: resolved.join("\n"),
        res: r,
      };
      playlistCache[key] = result;
      return result;
    });
  }

  function probeQualities(videoId, cb) {
    var available = [],
      pending = QUALITIES.length;
    for (var i = 0; i < QUALITIES.length; i++) {
      (function (q) {
        fetchPlaylist(videoId, q.res)
          .then(function () {
            available.push(q);
          })
          .catch(function () {})
          .then(function () {
            pending--;
            if (pending === 0) {
              available.sort(function (a, b) {
                return parseInt(b.res) - parseInt(a.res);
              });
              cb(available);
            }
          });
      })(QUALITIES[i]);
    }
  }

  function fetchSegment(url, retries) {
    return new Promise(function (resolve) {
      var a = 0;
      function go() {
        gmFetch(url, "arraybuffer")
          .then(resolve)
          .catch(function () {
            if (++a <= retries) setTimeout(go, 300 * a);
            else resolve(null);
          });
      }
      go();
    });
  }

  function downloadSegments(videoId, onProgress) {
    return fetchPlaylist(videoId).then(function (pl) {
      var urls = pl.urls,
        total = urls.length,
        chunks = new Array(total);
      var bytes = 0,
        done = 0,
        t0 = Date.now(),
        idx = 0,
        settled = 0,
        inFlight = 0;
      if (!total) return Promise.resolve([]);
      return new Promise(function (resolve) {
        function next() {
          while (inFlight < CONCURRENCY && idx < total) {
            var i = idx++;
            inFlight++;
            fetchSegment(urls[i], MAX_RETRIES)
              .then(function (buf) {
                if (buf) {
                  chunks[i] = buf;
                  bytes += buf.byteLength;
                  done++;
                }
                settled++;
                inFlight--;
                onProgress(
                  done,
                  total,
                  bytes,
                  bytes / ((Date.now() - t0) / 1000) / 1048576,
                );
                if (settled === total) resolve(chunks.filter(Boolean));
                else next();
              })
              .catch(function () {
                settled++;
                inFlight--;
                if (settled === total) resolve(chunks.filter(Boolean));
                else next();
              });
          }
        }
        next();
      });
    });
  }

  function saveBlob(blob, name) {
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () {
      URL.revokeObjectURL(a.href);
    }, 10000);
  }

  var muxReady = false;
  function loadMux(cb) {
    if (muxReady && typeof unsafeWindow !== "undefined" && unsafeWindow.muxjs)
      return cb(true);
    var s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/mux.js@7.0.3/dist/mux.min.js";
    s.onload = function () {
      muxReady = true;
      cb(true);
    };
    s.onerror = function () {
      cb(false);
    };
    document.head.appendChild(s);
  }
  function getMux() {
    if (typeof unsafeWindow !== "undefined" && unsafeWindow.muxjs)
      return unsafeWindow.muxjs;
    if (typeof muxjs !== "undefined") return muxjs;
    return null;
  }
  function convertToMp4(tsBlob, onStatus) {
    return new Promise(function (resolve, reject) {
      onStatus("Loading converter…");
      loadMux(function (ok) {
        if (!ok) return reject(new Error("mux.js failed to load"));
        var lib = getMux();
        if (!lib || !lib.mp4) return reject(new Error("mux.js not available"));
        onStatus("Reading video data…");
        var reader = new FileReader();
        reader.onload = function () {
          var tsData = new Uint8Array(reader.result);
          onStatus("Remuxing to MP4…");
          var transmuxer = new lib.mp4.Transmuxer(),
            outputChunks = [];
          transmuxer.on("data", function (segment) {
            var combined = new Uint8Array(
              segment.initSegment.byteLength + segment.data.byteLength,
            );
            combined.set(segment.initSegment, 0);
            combined.set(segment.data, segment.initSegment.byteLength);
            outputChunks.push(combined);
          });
          transmuxer.on("done", function () {
            if (!outputChunks.length)
              return reject(new Error("Transmuxer produced no output"));
            resolve(new Blob(outputChunks, { type: "video/mp4" }));
          });
          transmuxer.push(tsData);
          transmuxer.flush();
        };
        reader.onerror = function () {
          reject(new Error("Failed to read TS data"));
        };
        reader.readAsArrayBuffer(tsBlob);
      });
    });
  }

  /* ─────────────────────────────────────────────
     PAGE DETECTION
  ───────────────────────────────────────────── */
  function getVideoIdFromThumbnail() {
    var img = document.querySelector('img[data-name="Video Poster"]');
    if (img) {
      var m = img.src.match(/thumbnails\/([a-z0-9]+)\//i);
      if (m) return m[1];
    }
    return null;
  }
  function getVideoIdFromUrl() {
    var m = window.location.pathname.match(/\/course\/([a-z0-9]+)/i);
    if (m) return m[1];
    m = window.location.pathname.match(/\/video\/([a-z0-9]+)/i);
    return m ? m[1] : null;
  }
  function getVideoTitle() {
    var cc = document.querySelector(".current-video");
    if (cc) {
      var card = cc.closest('[data-name="CourseOverviewVidCard"]');
      if (card) {
        var td = card.querySelector(
          'div[style*="font-weight: bold"][style*="font-size: 16px"]',
        );
        if (td && td.textContent.trim()) return sanitize(td.textContent.trim());
      }
    }
    var ir = document.querySelector('[data-name="Vid Info Row"]');
    if (ir) {
      var fc = ir.querySelector("div > div");
      if (fc) {
        var ww = fc.querySelectorAll("div > div:last-child"),
          words = [];
        for (var i = 0; i < ww.length; i++) {
          var t = ww[i].textContent.trim();
          if (t) words.push(t);
        }
        if (words.length) return sanitize(words.join(" "));
      }
    }
    var ctb = document.querySelector('[data-name="CourseTitleBar"]');
    if (ctb && ctb.textContent.trim()) return sanitize(ctb.textContent.trim());
    return null;
  }
  function getCourseTitle() {
    var el = document.querySelector('[data-name="CourseTitleBar"]');
    return el ? el.textContent.trim() : "";
  }
  function getAdjacentVideo(offset) {
    var cards = document.querySelectorAll(
        '[data-name="CourseOverviewVidCard"]',
      ),
      idx = -1;
    for (var i = 0; i < cards.length; i++) {
      if (cards[i].querySelector(".current-video")) {
        idx = i;
        break;
      }
    }
    var target = idx + offset;
    if (idx < 0 || target < 0 || target >= cards.length) return null;
    var td = cards[target].querySelector(
      'div[style*="font-weight: bold"][style*="font-size: 16px"]',
    );
    return { card: cards[target], title: td ? td.textContent.trim() : "Video" };
  }
  function navigateAndPlay(card) {
    card.click();
    var c = 0,
      iv = setInterval(function () {
        c++;
        var nid = getVideoIdFromThumbnail() || getVideoIdFromUrl();
        if (nid && c > 2) {
          clearInterval(iv);
          setTimeout(function () {
            showPlayer(nid, getVideoTitle() || nid);
          }, 500);
        }
        if (c > 20) clearInterval(iv);
      }, 500);
  }

  /* ─────────────────────────────────────────────
     TOAST
  ───────────────────────────────────────────── */
  function toast(parent, text, small, dur) {
    // remove existing toasts of same type
    var existing = parent.querySelectorAll(
      small ? ".sc-toast-sm" : ".sc-toast",
    );
    existing.forEach(function (e) {
      e.remove();
    });
    var t = document.createElement("div");
    t.className = small ? "sc-toast-sm" : "sc-toast";
    t.textContent = text;
    parent.appendChild(t);
    setTimeout(
      function () {
        if (t.parentNode) t.parentNode.removeChild(t);
      },
      (dur || 700) + 300,
    );
  }

  /* ─────────────────────────────────────────────
     EPISODE SIDEBAR BUILDER
  ───────────────────────────────────────────── */
  function buildSidebar(activeId) {
    var sidebar = document.createElement("div");
    sidebar.className = "sc-sidebar";

    var cards = document.querySelectorAll(
      '[data-name="CourseOverviewVidCard"]',
    );
    var total = cards.length,
      watchedCount = 0;
    var epData = [];
    for (var i = 0; i < cards.length; i++) {
      var td = cards[i].querySelector(
        'div[style*="font-weight: bold"][style*="font-size: 16px"]',
      );
      var title = td ? td.textContent.trim() : "Episode " + (i + 1);
      var vid = idFromTitle(title) || null;
      var watched = vid ? isWatched(vid) : false;
      var pos = vid ? getPos(vid) : 0;
      var dur = vid ? loadFloat("sc-dur-" + vid, 0) : 0;
      if (watched) watchedCount++;
      epData.push({
        idx: i + 1,
        title: title,
        vid: vid,
        watched: watched,
        pos: pos,
        dur: dur,
        card: cards[i],
      });
    }

    var header = document.createElement("div");
    header.className = "sc-sidebar-header";

    var heading = document.createElement("div");
    heading.className = "sc-sidebar-heading";
    heading.textContent = "Up next — " + total + " episodes";

    var search = document.createElement("input");
    search.className = "sc-sidebar-search";
    search.type = "text";
    search.placeholder = "Search episodes…";

    var progRow = document.createElement("div");
    progRow.className = "sc-sidebar-progress";
    var progLabel = document.createElement("span");
    progLabel.textContent = watchedCount + "/" + total + " watched";
    var progPct = document.createElement("span");
    progPct.textContent = total
      ? Math.round((watchedCount / total) * 100) + "%"
      : "0%";
    progRow.appendChild(progLabel);
    progRow.appendChild(progPct);

    var progBarWrap = document.createElement("div");
    progBarWrap.className = "sc-sidebar-prog-bar";
    var progBarFill = document.createElement("div");
    progBarFill.className = "sc-sidebar-prog-fill";
    progBarFill.style.width = (total ? (watchedCount / total) * 100 : 0) + "%";
    progBarWrap.appendChild(progBarFill);

    header.appendChild(heading);
    header.appendChild(search);
    header.appendChild(progRow);
    header.appendChild(progBarWrap);
    sidebar.appendChild(header);

    var list = document.createElement("div");
    list.className = "sc-ep-list";
    sidebar.appendChild(list);

    function renderEps(filter) {
      list.innerHTML = "";
      var shown = epData.filter(function (ep) {
        return (
          !filter || ep.title.toLowerCase().indexOf(filter.toLowerCase()) >= 0
        );
      });
      shown.forEach(function (ep) {
        var card = document.createElement("div");
        card.className =
          "sc-ep-card" + (ep.vid && ep.vid === activeId ? " active" : "");

        var num = document.createElement("div");
        num.className = "sc-ep-num";
        num.textContent = String(ep.idx).padStart(2, "0");

        var body = document.createElement("div");
        body.className = "sc-ep-body";

        var name = document.createElement("div");
        name.className = "sc-ep-name";
        name.title = ep.title;
        name.textContent = ep.title;

        var meta = document.createElement("div");
        meta.className = "sc-ep-meta";

        if (ep.dur > 0) {
          var dur = document.createElement("span");
          dur.className = "sc-ep-dur";
          dur.textContent = formatTime(ep.dur);
          meta.appendChild(dur);
        }

        if (ep.watched) {
          var ws = document.createElement("span");
          ws.className = "sc-ep-status watched";
          ws.textContent = "✓ Watched";
          meta.appendChild(ws);
        } else if (ep.pos > 5) {
          var ps = document.createElement("span");
          ps.className = "sc-ep-status progress";
          ps.textContent = formatTime(ep.pos);
          meta.appendChild(ps);
        }

        body.appendChild(name);
        body.appendChild(meta);

        if (ep.watched) {
          var mb = document.createElement("div");
          mb.className = "sc-ep-mini-bar";
          var mf = document.createElement("div");
          mf.className = "sc-ep-watched-fill";
          mf.style.width = "100%";
          mb.appendChild(mf);
          body.appendChild(mb);
        } else if (ep.pos > 5 && ep.dur > 0) {
          var mb2 = document.createElement("div");
          mb2.className = "sc-ep-mini-bar";
          var mf2 = document.createElement("div");
          mf2.className = "sc-ep-mini-fill";
          mf2.style.width = Math.min(100, (ep.pos / ep.dur) * 100) + "%";
          mb2.appendChild(mf2);
          body.appendChild(mb2);
        }

        var playIcon = document.createElement("div");
        playIcon.className = "sc-ep-play-icon";
        playIcon.innerHTML =
          '<svg width="8" height="9" viewBox="0 0 8 9" fill="none"><path d="M1 1L7 4.5L1 8V1Z" fill="currentColor"/></svg>';

        card.appendChild(num);
        card.appendChild(body);
        card.appendChild(playIcon);

        card.addEventListener("click", function () {
          ep.card.click();
          var c = 0,
            iv = setInterval(function () {
              c++;
              var nid = getVideoIdFromThumbnail() || getVideoIdFromUrl();
              if (nid && c > 2) {
                clearInterval(iv);
                setTimeout(function () {
                  var title = getVideoTitle() || ep.title;
                  showPlayer(nid, title);
                }, 500);
              }
              if (c > 20) clearInterval(iv);
            }, 500);
        });

        list.appendChild(card);
      });

      if (!shown.length) {
        var empty = document.createElement("div");
        empty.style.cssText =
          "padding:24px;text-align:center;font-family:var(--sc-font);font-size:12px;color:var(--sc-text3);";
        empty.textContent = "No episodes match.";
        list.appendChild(empty);
      }
    }

    renderEps("");
    search.addEventListener("input", function () {
      renderEps(search.value);
    });

    // Bulk download row
    if (total >= 2) {
      var bulkRow = document.createElement("div");
      bulkRow.className = "sc-bulk-row";
      var bulkBtn = document.createElement("button");
      bulkBtn.className = "sc-bulk-btn";
      bulkBtn.innerHTML =
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 15V3m0 12l-4-4m4 4l4-4"/><path d="M2 17l.621 2.485A2 2 0 004.561 21h14.878a2 2 0 001.94-1.515L22 17"/></svg> Download all (' +
        total +
        ")";
      bulkBtn.addEventListener("click", function () {
        startBulkDownload(bulkBtn, total);
      });
      bulkRow.appendChild(bulkBtn);
      sidebar.appendChild(bulkRow);
    }

    return sidebar;
  }

  /* ─────────────────────────────────────────────
     MAIN PLAYER
  ───────────────────────────────────────────── */
  function showPlayer(videoId, filename) {
    var existing = document.querySelector(".sc-overlay");
    if (existing) existing.remove();
    mapTitle(filename, videoId);

    /* Shell */
    var overlay = document.createElement("div");
    overlay.className = "sc-overlay";

    var player = document.createElement("div");
    player.className = "sc-player";
    overlay.appendChild(player);
    document.body.appendChild(overlay);

    /* Top bar */
    var topbar = document.createElement("div");
    topbar.className = "sc-topbar";

    var topLeft = document.createElement("div");
    topLeft.className = "sc-topbar-left";

    var logoMark = document.createElement("div");
    logoMark.className = "sc-logo-mark";
    logoMark.innerHTML =
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5"><path d="M5 3l14 9-14 9V3z"/></svg>';

    var courseTitle = document.createElement("div");
    courseTitle.className = "sc-course-title";
    var ct = getCourseTitle() || "Skill Capped";
    courseTitle.textContent = ct;

    var sep = document.createElement("span");
    sep.className = "sc-sep";
    sep.textContent = "/";

    var epTitle = document.createElement("div");
    epTitle.className = "sc-ep-title";
    epTitle.textContent = filename;

    topLeft.appendChild(logoMark);
    topLeft.appendChild(courseTitle);
    topLeft.appendChild(sep);
    topLeft.appendChild(epTitle);

    var topRight = document.createElement("div");
    topRight.className = "sc-topbar-right";

    /* Keyboard shortcuts toggle */
    var shortcutsBtn = document.createElement("button");
    shortcutsBtn.className = "sc-action-btn";
    shortcutsBtn.innerHTML =
      '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8"/></svg> Shortcuts';
    shortcutsBtn.title = "Show keyboard shortcuts (?)";

    var closeBtn = document.createElement("button");
    closeBtn.className = "sc-close-btn";
    closeBtn.innerHTML =
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>';
    closeBtn.title = "Close (Esc)";

    topRight.appendChild(shortcutsBtn);
    topRight.appendChild(closeBtn);
    topbar.appendChild(topLeft);
    topbar.appendChild(topRight);
    player.appendChild(topbar);

    /* Content area */
    var content = document.createElement("div");
    content.className = "sc-content";

    /* Video pane */
    var videoPane = document.createElement("div");
    videoPane.className = "sc-video-pane";

    var videoWrap = document.createElement("div");
    videoWrap.className = "sc-video-wrap";

    var loadingDiv = document.createElement("div");
    loadingDiv.className = "sc-loading";
    loadingDiv.innerHTML =
      '<div class="sc-spinner"></div><div class="sc-loading-text">Loading…</div>';

    var video = document.createElement("video");
    video.autoplay = true;

    videoWrap.appendChild(loadingDiv);
    videoPane.appendChild(videoWrap);

    /* Controls */
    var controls = document.createElement("div");
    controls.className = "sc-controls";

    /* Progress bar */
    var progressWrap = document.createElement("div");
    progressWrap.className = "sc-progress-wrap";
    var progressFill = document.createElement("div");
    progressFill.className = "sc-progress-fill";
    progressFill.style.width = "0%";
    progressWrap.appendChild(progressFill);

    progressWrap.addEventListener("click", function (e) {
      if (!video.duration) return;
      var rect = progressWrap.getBoundingClientRect();
      var pct = (e.clientX - rect.left) / rect.width;
      video.currentTime = pct * video.duration;
    });

    controls.appendChild(progressWrap);

    /* Controls row */
    var controlsRow = document.createElement("div");
    controlsRow.className = "sc-controls-row";

    var leftCtrl = document.createElement("div");
    leftCtrl.className = "sc-controls-left";

    /* Play/Pause */
    var playBtn = document.createElement("button");
    playBtn.className = "sc-icon-btn";
    function updatePlayIcon() {
      playBtn.innerHTML = video.paused
        ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M5 3l14 9-14 9V3z"/></svg>'
        : '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/></svg>';
    }
    updatePlayIcon();
    playBtn.addEventListener("click", function () {
      video.paused ? video.play().catch(function () {}) : video.pause();
    });
    video.addEventListener("play", updatePlayIcon);
    video.addEventListener("pause", updatePlayIcon);

    /* Prev / Next */
    var prevBtn = document.createElement("button");
    prevBtn.className = "sc-icon-btn";
    prevBtn.title = "Previous episode (P)";
    prevBtn.innerHTML =
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 20L9 12l10-8v16z"/><line x1="5" y1="4" x2="5" y2="20"/></svg>';
    prevBtn.addEventListener("click", function () {
      var pv = getAdjacentVideo(-1);
      if (pv) {
        closeBtn.click();
        navigateAndPlay(pv.card);
      }
    });

    var nextBtn = document.createElement("button");
    nextBtn.className = "sc-icon-btn";
    nextBtn.title = "Next episode (N)";
    nextBtn.innerHTML =
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 4l10 8-10 8V4z"/><line x1="19" y1="4" x2="19" y2="20"/></svg>';
    nextBtn.addEventListener("click", function () {
      var nv = getAdjacentVideo(1);
      if (nv) {
        closeBtn.click();
        navigateAndPlay(nv.card);
      }
    });

    /* Volume */
    var volWrap = document.createElement("div");
    volWrap.className = "sc-vol-wrap";
    var volBtn = document.createElement("button");
    volBtn.className = "sc-icon-btn";
    var volSlider = document.createElement("input");
    volSlider.className = "sc-vol-slider";
    volSlider.type = "range";
    volSlider.min = "0";
    volSlider.max = "1";
    volSlider.step = "0.05";
    volSlider.value = getSavedVol();

    function updateVolIcon() {
      var v = video.muted || video.volume === 0;
      volBtn.innerHTML = v
        ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>'
        : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 010 7.07"/><path d="M19.07 4.93a10 10 0 010 14.14"/></svg>';
    }
    updateVolIcon();
    volBtn.addEventListener("click", function () {
      video.muted = !video.muted;
      updateVolIcon();
      toast(videoWrap, video.muted ? "🔇" : "🔊", false, 500);
    });
    volSlider.addEventListener("input", function () {
      video.volume = parseFloat(volSlider.value);
      video.muted = false;
      saveVol(video.volume);
      updateVolIcon();
    });
    video.addEventListener("volumechange", function () {
      volSlider.value = video.volume;
      updateVolIcon();
    });

    volWrap.appendChild(volBtn);
    volWrap.appendChild(volSlider);

    /* Time display */
    var timeDisplay = document.createElement("span");
    timeDisplay.className = "sc-time";
    timeDisplay.textContent = "0:00 / 0:00";
    video.addEventListener("timeupdate", function () {
      if (!video.duration) return;
      progressFill.style.width =
        (video.currentTime / video.duration) * 100 + "%";
      timeDisplay.textContent =
        formatTime(video.currentTime) + " / " + formatTime(video.duration);
    });

    leftCtrl.appendChild(playBtn);
    leftCtrl.appendChild(prevBtn);
    leftCtrl.appendChild(nextBtn);
    leftCtrl.appendChild(volWrap);
    leftCtrl.appendChild(timeDisplay);

    var rightCtrl = document.createElement("div");
    rightCtrl.className = "sc-controls-right";

    /* Speed pills */
    var speedBtns = [];
    var curSpeed = getSavedSpeed();
    SPEEDS.forEach(function (spd) {
      var sb = document.createElement("button");
      sb.className = "sc-pill" + (spd === curSpeed ? " active" : "");
      sb.textContent = spd + "x";
      sb.addEventListener("click", function () {
        video.playbackRate = spd;
        saveSpeed(spd);
        speedBtns.forEach(function (b) {
          b.className = "sc-pill";
        });
        sb.className = "sc-pill active";
        toast(videoWrap, spd + "x", false, 500);
      });
      speedBtns.push(sb);
      rightCtrl.appendChild(sb);
    });

    /* Quality pills — populated after probe */
    var qualBtns = [],
      hlsInstance = null;
    function buildQualBtns(available) {
      qualBtns.forEach(function (b) {
        b.remove();
      });
      qualBtns = [];
      available.forEach(function (q) {
        var qb = document.createElement("button");
        qb.className = "sc-pill" + (q.res === currentRes ? " active" : "");
        qb.textContent = q.label;
        qb.addEventListener("click", function () {
          if (q.res === currentRes) return;
          var pos = video.currentTime || 0,
            wasPaused = video.paused;
          currentRes = q.res;
          try {
            localStorage.setItem("sc-quality", q.res);
          } catch (e) {}
          qualBtns.forEach(function (b) {
            b.className = "sc-pill";
          });
          qb.className = "sc-pill active";
          if (hlsInstance) {
            hlsInstance.destroy();
            hlsInstance = null;
          }
          fetchPlaylist(videoId, q.res).then(function (pl) {
            var blob = new Blob([pl.m3u8Text], {
              type: "application/vnd.apple.mpegurl",
            });
            var url = URL.createObjectURL(blob);
            var H = getHls();
            if (H && H.isSupported()) {
              hlsInstance = new H({ loader: GMLoader });
              hlsInstance.loadSource(url);
              hlsInstance.attachMedia(video);
              hlsInstance.on(H.Events.MANIFEST_PARSED, function () {
                if (pos > 1) video.currentTime = pos;
                video.playbackRate = getSavedSpeed();
                video.volume = getSavedVol();
                if (!wasPaused) video.play().catch(function () {});
                URL.revokeObjectURL(url);
              });
              attachHlsErrors(hlsInstance, H);
            }
          });
        });
        qualBtns.push(qb);
        rightCtrl.insertBefore(qb, rightCtrl.lastChild);
      });
    }
    probeQualities(videoId, function (available) {
      if (available.length > 1) buildQualBtns(available);
    });

    /* Auto-next toggle */
    var autoBtn = document.createElement("button");
    autoBtn.className = "sc-pill" + (getAutoNext() ? " active" : "");
    autoBtn.title = "Toggle auto-next";
    autoBtn.textContent = getAutoNext() ? "Auto ✓" : "Auto";
    autoBtn.addEventListener("click", function () {
      var en = !getAutoNext();
      saveAutoNext(en);
      autoBtn.textContent = en ? "Auto ✓" : "Auto";
      autoBtn.className = "sc-pill" + (en ? " active" : "");
    });
    rightCtrl.appendChild(autoBtn);

    /* PiP */
    if (document.pictureInPictureEnabled) {
      var pipBtn = document.createElement("button");
      pipBtn.className = "sc-icon-btn";
      pipBtn.title = "Picture-in-Picture";
      pipBtn.innerHTML =
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><rect x="12" y="11" width="9" height="7" rx="1"/></svg>';
      pipBtn.addEventListener("click", function () {
        document.pictureInPictureElement
          ? document.exitPictureInPicture().catch(function () {})
          : video.requestPictureInPicture &&
            video.requestPictureInPicture().catch(function () {});
      });
      rightCtrl.appendChild(pipBtn);
    }

    /* Fullscreen */
    var fsBtn = document.createElement("button");
    fsBtn.className = "sc-icon-btn";
    fsBtn.title = "Fullscreen (F)";
    fsBtn.innerHTML =
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3"/></svg>';
    fsBtn.addEventListener("click", function () {
      document.fullscreenElement
        ? document.exitFullscreen().catch(function () {})
        : player.requestFullscreen().catch(function () {});
    });
    rightCtrl.appendChild(fsBtn);

    /* Download dropdown */
    var dlDrop = document.createElement("div");
    dlDrop.className = "sc-dropdown";
    var dlBtn = document.createElement("button");
    dlBtn.className = "sc-action-btn red";
    dlBtn.innerHTML =
      '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 15V3m0 12l-4-4m4 4l4-4"/><path d="M2 17l.621 2.485A2 2 0 004.561 21h14.878a2 2 0 001.94-1.515L22 17"/></svg> Save ▾';
    var dlBar = document.createElement("div");
    dlBar.className = "sc-btn-bar";
    dlBar.style.width = "0%";
    dlBtn.appendChild(dlBar);

    var dlMenu = document.createElement("div");
    dlMenu.className = "sc-dropdown-menu";

    var dlMp4 = document.createElement("button");
    dlMp4.className = "sc-dropdown-item";
    dlMp4.innerHTML =
      '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M10 9l5 3-5 3V9z"/></svg> Download .mp4';

    var dlTs = document.createElement("button");
    dlTs.className = "sc-dropdown-item";
    dlTs.innerHTML =
      '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"/><polyline points="14 2 14 8 20 8"/></svg> Download .ts (fast)';

    var dlM3u8 = document.createElement("button");
    dlM3u8.className = "sc-dropdown-item";
    dlM3u8.innerHTML =
      '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 17H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="12 17 16 21 20 17"/><line x1="16" y1="21" x2="16" y2="3"/></svg> Copy stream URL';

    dlMenu.appendChild(dlMp4);
    dlMenu.appendChild(dlTs);
    dlMenu.appendChild(
      document.createElement("div").setAttribute("class", "sc-dropdown-sep") ||
        document.createElement("div"),
    );
    dlMenu.appendChild(dlM3u8);
    dlDrop.appendChild(dlMenu);
    dlDrop.appendChild(dlBtn);

    dlBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      dlDrop.className =
        dlDrop.className.indexOf("open") >= 0
          ? "sc-dropdown"
          : "sc-dropdown open";
    });
    dlMp4.addEventListener("click", function () {
      dlDrop.className = "sc-dropdown";
      startDownload(videoId, dlBtn, dlBar, "mp4");
    });
    dlTs.addEventListener("click", function () {
      dlDrop.className = "sc-dropdown";
      startDownload(videoId, dlBtn, dlBar, "ts");
    });
    dlM3u8.addEventListener("click", function () {
      dlDrop.className = "sc-dropdown";
      var url = playlistUrl(videoId, currentRes);
      navigator.clipboard.writeText(url).then(function () {
        toast(videoWrap, "URL copied!", true, 1500);
      });
    });
    document.addEventListener("click", function closeDl() {
      dlDrop.className = "sc-dropdown";
      document.removeEventListener("click", closeDl);
    });

    rightCtrl.appendChild(dlDrop);

    controlsRow.appendChild(leftCtrl);
    controlsRow.appendChild(rightCtrl);
    controls.appendChild(controlsRow);
    videoPane.appendChild(controls);
    content.appendChild(videoPane);

    /* Sidebar */
    var sidebar = buildSidebar(videoId);
    content.appendChild(sidebar);

    player.appendChild(content);

    /* Shortcuts HUD */
    shortcutsBtn.addEventListener("click", function () {
      var existing = player.querySelector(".sc-hud");
      if (existing) {
        existing.remove();
        return;
      }
      var hud = document.createElement("div");
      hud.className = "sc-hud";
      hud.innerHTML = `
        <div class="sc-hud-box">
          <div class="sc-hud-title">Keyboard shortcuts</div>
          <div class="sc-hud-grid">
            <div class="sc-hud-row"><span class="sc-kbd">Space</span><span class="sc-hud-desc">Play / pause</span></div>
            <div class="sc-hud-row"><span class="sc-kbd">F</span><span class="sc-hud-desc">Fullscreen</span></div>
            <div class="sc-hud-row"><span class="sc-kbd">←</span><span class="sc-hud-desc">−10 seconds</span></div>
            <div class="sc-hud-row"><span class="sc-kbd">→</span><span class="sc-hud-desc">+10 seconds</span></div>
            <div class="sc-hud-row"><span class="sc-kbd">↑</span><span class="sc-hud-desc">Volume up</span></div>
            <div class="sc-hud-row"><span class="sc-kbd">↓</span><span class="sc-hud-desc">Volume down</span></div>
            <div class="sc-hud-row"><span class="sc-kbd">M</span><span class="sc-hud-desc">Mute</span></div>
            <div class="sc-hud-row"><span class="sc-kbd">N</span><span class="sc-hud-desc">Next episode</span></div>
            <div class="sc-hud-row"><span class="sc-kbd">P</span><span class="sc-hud-desc">Prev episode</span></div>
            <div class="sc-hud-row"><span class="sc-kbd">?</span><span class="sc-hud-desc">Toggle this</span></div>
            <div class="sc-hud-row"><span class="sc-kbd">Esc</span><span class="sc-hud-desc">Close player</span></div>
            <div class="sc-hud-row"><span class="sc-kbd">1–9</span><span class="sc-hud-desc">Jump to % of video</span></div>
          </div>
        </div>
      `;
      hud.addEventListener("click", function (e) {
        if (e.target === hud) hud.remove();
      });
      player.appendChild(hud);
    });

    /* Close */
    var autoNextTimer = null;
    function doClose() {
      if (
        video.currentTime > 5 &&
        video.duration &&
        video.currentTime < video.duration - 5
      )
        savePos(videoId, video.currentTime);
      else if (video.duration) clearPos(videoId);
      if (video.duration > 0) store("sc-dur-" + videoId, video.duration);
      video.pause();
      if (hlsInstance) {
        hlsInstance.destroy();
        hlsInstance = null;
      }
      if (autoNextTimer) {
        clearInterval(autoNextTimer);
        autoNextTimer = null;
      }
      video.removeAttribute("src");
      overlay.remove();
      updateFab();
      updateSidebarDots();
      updateCourseProgressLabel();
      document.removeEventListener("keydown", keyHandler);
    }
    closeBtn.addEventListener("click", doClose);
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) doClose();
    });

    /* HLS Error Recovery */
    function attachHlsErrors(hls, H) {
      hls.on(H.Events.ERROR, function (ev, data) {
        if (!data || !data.fatal) return;
        if (data.type === H.ErrorTypes.NETWORK_ERROR) {
          hls.startLoad();
          return;
        }
        if (data.type === H.ErrorTypes.MEDIA_ERROR) {
          hls.recoverMediaError();
          return;
        }
      });
    }

    /* Keyboard handler */
    function keyHandler(e) {
      if (!document.querySelector(".sc-overlay")) {
        document.removeEventListener("keydown", keyHandler);
        return;
      }
      var tag = (e.target.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea") return;
      if (e.key === "Escape") {
        doClose();
        return;
      }
      if (e.key === "?" || e.key === "/") {
        shortcutsBtn.click();
        return;
      }
      if (e.key === " " || e.code === "Space") {
        e.preventDefault();
        video.paused ? video.play().catch(function () {}) : video.pause();
        toast(videoWrap, video.paused ? "⏸" : "▶", false, 400);
        return;
      }
      if (e.key === "ArrowLeft") {
        video.currentTime = Math.max(0, video.currentTime - 10);
        toast(videoWrap, "−10s", false, 400);
        return;
      }
      if (e.key === "ArrowRight") {
        video.currentTime = Math.min(
          video.duration || 0,
          video.currentTime + 10,
        );
        toast(videoWrap, "+10s", false, 400);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        video.volume = Math.min(1, video.volume + 0.1);
        saveVol(video.volume);
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        video.volume = Math.max(0, video.volume - 0.1);
        saveVol(video.volume);
        return;
      }
      if (e.key === "f" || e.key === "F") {
        document.fullscreenElement
          ? document.exitFullscreen().catch(function () {})
          : player.requestFullscreen().catch(function () {});
        return;
      }
      if (e.key === "m" || e.key === "M") {
        video.muted = !video.muted;
        toast(videoWrap, video.muted ? "🔇" : "🔊", false, 400);
        return;
      }
      if (e.key === "n" || e.key === "N") {
        var nv = getAdjacentVideo(1);
        if (nv) {
          doClose();
          navigateAndPlay(nv.card);
        }
        return;
      }
      if (e.key === "p" || e.key === "P") {
        var pv = getAdjacentVideo(-1);
        if (pv) {
          doClose();
          navigateAndPlay(pv.card);
        }
        return;
      }
      /* 1–9: jump to percentage */
      if (e.key >= "1" && e.key <= "9" && video.duration) {
        video.currentTime = video.duration * (parseInt(e.key) / 10);
        toast(videoWrap, e.key + "0%", false, 400);
      }
    }
    document.addEventListener("keydown", keyHandler);

    /* Load & play */
    var savedPos = getPos(videoId);
    fetchPlaylist(videoId)
      .then(function (pl) {
        if (!pl.urls.length) {
          loadingDiv.querySelector(".sc-loading-text").textContent =
            "No segments found.";
          return;
        }
        if (pl.duration > 0) {
          store("sc-dur-" + videoId, pl.duration);
          epTitle.textContent = filename + " · " + formatTime(pl.duration);
        }
        var m3u8Blob = new Blob([pl.m3u8Text], {
          type: "application/vnd.apple.mpegurl",
        });
        var m3u8Url = URL.createObjectURL(m3u8Blob);

        videoWrap.removeChild(loadingDiv);
        videoWrap.appendChild(video);

        video.volume = getSavedVol();
        video.playbackRate = getSavedSpeed();

        video.addEventListener("dblclick", function () {
          document.fullscreenElement
            ? document.exitFullscreen().catch(function () {})
            : player.requestFullscreen().catch(function () {});
        });

        var lastSave = 0;
        video.addEventListener("timeupdate", function () {
          var now = Date.now();
          if (now - lastSave > 3000 && video.currentTime > 5) {
            lastSave = now;
            savePos(videoId, video.currentTime);
          }
        });

        /* Auto-next on ended */
        video.addEventListener("ended", function () {
          clearPos(videoId);
          markWatched(videoId);
          store("sc-dur-" + videoId, video.duration);
          updateSidebarDots();
          updateCourseProgressLabel();
          if (!getAutoNext()) return;
          var next = getAdjacentVideo(1);
          if (!next) return;
          var anDiv = document.createElement("div");
          anDiv.className = "sc-autonext";
          var anLabel = document.createElement("div");
          anLabel.className = "sc-autonext-label";
          var countdown = AUTONEXT_DELAY;
          anLabel.innerHTML =
            "Up next: <strong>" +
            next.title +
            "</strong> in " +
            countdown +
            "s";
          var anProg = document.createElement("div");
          anProg.className = "sc-autonext-prog";
          anProg.style.width = "0%";
          var anPlay = document.createElement("button");
          anPlay.className = "sc-action-btn red";
          anPlay.textContent = "▶ Play now";
          var anSkip = document.createElement("button");
          anSkip.className = "sc-action-btn";
          anSkip.textContent = "Skip";
          anDiv.appendChild(anProg);
          anDiv.appendChild(anLabel);
          anDiv.appendChild(anPlay);
          anDiv.appendChild(anSkip);
          videoWrap.appendChild(anDiv);
          function goNext() {
            if (autoNextTimer) {
              clearInterval(autoNextTimer);
              autoNextTimer = null;
            }
            doClose();
            navigateAndPlay(next.card);
          }
          anPlay.addEventListener("click", goNext);
          anSkip.addEventListener("click", function () {
            if (autoNextTimer) {
              clearInterval(autoNextTimer);
              autoNextTimer = null;
            }
            anDiv.remove();
          });
          setTimeout(function () {
            anProg.style.width = "100%";
          }, 50);
          autoNextTimer = setInterval(function () {
            countdown--;
            if (countdown <= 0) goNext();
            else
              anLabel.innerHTML =
                "Up next: <strong>" +
                next.title +
                "</strong> in " +
                countdown +
                "s";
          }, 1000);
        });

        var H = getHls();
        if (H && H.isSupported()) {
          hlsInstance = new H({ loader: GMLoader });
          hlsInstance.loadSource(m3u8Url);
          hlsInstance.attachMedia(video);
          hlsInstance.on(H.Events.MANIFEST_PARSED, function () {
            if (savedPos > 5) {
              video.currentTime = savedPos;
              toast(
                videoWrap,
                "Resumed from " + formatTime(savedPos),
                true,
                2000,
              );
            }
            video.play().catch(function () {});
            URL.revokeObjectURL(m3u8Url);
            /* Prefetch next */
            var nextInfo = getAdjacentVideo(1);
            if (nextInfo) {
              var nid = idFromTitle(nextInfo.title);
              if (nid) fetchPlaylist(nid).catch(function () {});
            }
          });
          attachHlsErrors(hlsInstance, H);
        } else if (video.canPlayType("application/vnd.apple.mpegURL")) {
          URL.revokeObjectURL(m3u8Url);
          video.src = playlistUrl(videoId);
          if (savedPos > 5)
            video.addEventListener(
              "loadedmetadata",
              function () {
                video.currentTime = savedPos;
              },
              { once: true },
            );
          video.play().catch(function () {});
        } else {
          URL.revokeObjectURL(m3u8Url);
          videoWrap.appendChild(loadingDiv);
          loadingDiv.querySelector(".sc-loading-text").textContent =
            "HLS not supported.";
          video.remove();
        }
      })
      .catch(function (err) {
        console.error("[SC-DL]", err);
        loadingDiv.querySelector(".sc-loading-text").textContent =
          "Error: " + err.message;
      });
  }

  /* ─────────────────────────────────────────────
     DOWNLOAD
  ───────────────────────────────────────────── */
  function startDownload(videoId, btn, bar, format) {
    var baseName = getVideoTitle() || videoId;
    var filename = baseName + (format === "mp4" ? ".mp4" : ".ts");
    btn.disabled = true;
    bar.style.width = "0%";
    var origHTML = btn.innerHTML;
    var t0 = Date.now();
    function setText(msg) {
      btn.innerHTML = msg;
      btn.appendChild(bar);
    }
    downloadSegments(videoId, function (count, total, bytes, speed) {
      var elapsed = Math.max(0.1, (Date.now() - t0) / 1000);
      var avg = bytes / elapsed / 1048576;
      var eta = "";
      if (avg > 0 && count > 0 && count < total) {
        var secsLeft = Math.round(
          ((total - count) * (bytes / count)) / (avg * 1048576),
        );
        eta = " · ~" + formatEta(secsLeft);
      }
      setText(count + "/" + total + " · " + avg.toFixed(1) + " MB/s" + eta);
      bar.style.width = Math.min(95, (count / total) * 100) + "%";
    })
      .then(function (chunks) {
        if (!chunks.length) {
          setText("⚠ No segments");
          btn.disabled = false;
          bar.style.width = "0%";
          return;
        }
        var tsBlob = new Blob(chunks, { type: "video/mp2t" });
        if (format === "mp4") {
          bar.style.width = "97%";
          convertToMp4(tsBlob, setText)
            .then(function (mp4Blob) {
              bar.style.width = "100%";
              saveBlob(mp4Blob, filename);
              setText("✓ Saved " + formatMB(mp4Blob.size) + " MB");
              setTimeout(function () {
                btn.innerHTML = origHTML;
                btn.appendChild(bar);
                bar.style.width = "0%";
                btn.disabled = false;
              }, 4000);
            })
            .catch(function (err) {
              setText("MP4 failed — saving .ts");
              saveBlob(tsBlob, baseName + ".ts");
              setTimeout(function () {
                btn.innerHTML = origHTML;
                btn.appendChild(bar);
                bar.style.width = "0%";
                btn.disabled = false;
              }, 4000);
            });
        } else {
          bar.style.width = "100%";
          saveBlob(tsBlob, filename);
          setText("✓ Saved " + formatMB(tsBlob.size) + " MB");
          setTimeout(function () {
            btn.innerHTML = origHTML;
            btn.appendChild(bar);
            bar.style.width = "0%";
            btn.disabled = false;
          }, 4000);
        }
      })
      .catch(function (e) {
        console.error("[SC-DL]", e);
        setText("⚠ Error");
        setTimeout(function () {
          btn.innerHTML = origHTML;
          btn.appendChild(bar);
          bar.style.width = "0%";
          btn.disabled = false;
        }, 4000);
      });
  }

  /* ─────────────────────────────────────────────
     BULK DOWNLOAD
  ───────────────────────────────────────────── */
  var bulkRunning = false;
  function startBulkDownload(btn, total) {
    if (bulkRunning) return;
    bulkRunning = true;
    var cards = Array.from(
      document.querySelectorAll('[data-name="CourseOverviewVidCard"]'),
    );
    var current = 0,
      done = 0,
      failed = 0;
    btn.disabled = true;
    function next() {
      if (current >= cards.length) {
        bulkRunning = false;
        btn.textContent =
          "✓ " + done + " saved" + (failed ? ", " + failed + " failed" : "");
        setTimeout(function () {
          btn.innerHTML =
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 15V3m0 12l-4-4m4 4l4-4"/><path d="M2 17l.621 2.485A2 2 0 004.561 21h14.878a2 2 0 001.94-1.515L22 17"/></svg> Download all (' +
            total +
            ")";
          btn.disabled = false;
        }, 5000);
        return;
      }
      btn.textContent = current + 1 + "/" + cards.length + " downloading…";
      cards[current].click();
      var attempts = 0,
        lastId = getVideoIdFromThumbnail() || getVideoIdFromUrl();
      var chk = setInterval(function () {
        attempts++;
        var newId = getVideoIdFromThumbnail() || getVideoIdFromUrl();
        if (
          (newId && newId !== lastId) ||
          (attempts > 3 && newId) ||
          attempts > 8
        ) {
          clearInterval(chk);
          var videoId = getVideoIdFromThumbnail() || getVideoIdFromUrl();
          if (!videoId) {
            failed++;
            current++;
            next();
            return;
          }
          var title = getVideoTitle() || videoId;
          mapTitle(title, videoId);
          downloadSegments(videoId, function (cnt, tot) {
            btn.textContent =
              current +
              1 +
              "/" +
              cards.length +
              " · " +
              cnt +
              "/" +
              tot +
              " seg";
          })
            .then(function (chunks) {
              if (chunks.length) {
                saveBlob(
                  new Blob(chunks, { type: "video/mp2t" }),
                  title + ".ts",
                );
                done++;
              } else failed++;
              current++;
              next();
            })
            .catch(function () {
              failed++;
              current++;
              next();
            });
        }
      }, 500);
    }
    next();
  }

  /* ─────────────────────────────────────────────
     FLOATING ACTION BUTTON (FAB)
  ───────────────────────────────────────────── */
  function updateFab() {
    var old = document.querySelectorAll(".sc-fab");
    old.forEach(function (el) {
      el.remove();
    });
    if (!document.querySelector('[data-name="Video Player Container"]')) return;
    var videoId = getVideoIdFromThumbnail() || getVideoIdFromUrl();
    if (!videoId) return;

    var fab = document.createElement("div");
    fab.className = "sc-fab";

    var playBtn = document.createElement("button");
    playBtn.className = "sc-fab-play";
    var pos = getPos(videoId);
    var watched = isWatched(videoId);
    playBtn.innerHTML = watched
      ? '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M5 3l14 9-14 9V3z"/></svg> Rewatch'
      : pos > 5
        ? '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M5 3l14 9-14 9V3z"/></svg> Resume'
        : '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M5 3l14 9-14 9V3z"/></svg> Watch';
    playBtn.addEventListener("click", function () {
      showPlayer(videoId, getVideoTitle() || videoId);
    });

    var meta = document.createElement("div");
    meta.className = "sc-fab-meta";
    var fabTitle = document.createElement("div");
    fabTitle.className = "sc-fab-title";
    fabTitle.textContent = getVideoTitle() || videoId;
    var fabSub = document.createElement("div");
    fabSub.textContent =
      pos > 5
        ? "at " + formatTime(pos)
        : watched
          ? "Completed"
          : "Ready to watch";
    meta.appendChild(fabTitle);
    meta.appendChild(fabSub);

    fab.appendChild(playBtn);
    fab.appendChild(meta);
    document.body.appendChild(fab);

    /* Prefetch duration for FAB label */
    fetchPlaylist(videoId)
      .then(function (pl) {
        if (pl.duration > 0) {
          store("sc-dur-" + videoId, pl.duration);
          fabSub.textContent =
            pos > 5
              ? "at " + formatTime(pos) + " / " + formatTime(pl.duration)
              : watched
                ? "Completed · " + formatTime(pl.duration)
                : formatTime(pl.duration);
        }
      })
      .catch(function () {});
  }

  /* ─────────────────────────────────────────────
     INLINE BUTTONS (browse/course list)
  ───────────────────────────────────────────── */
  function addInlineButtons() {
    var rows = document.querySelectorAll(
      'div[data-name="BrVid Row Parent Course"]',
    );
    rows.forEach(function (div) {
      if (div.querySelector(".sc-inline-btn")) return;
      var rowEl = div.closest('div[id^="BrVidRow-"]');
      if (!rowEl) return;
      var videoId = rowEl.id.split("-")[1];
      if (!videoId) return;
      var heart = div.querySelector('svg[data-name="Heart Icon"]');
      if (heart && heart.parentNode) heart.parentNode.removeChild(heart);
      var titleEl = div.querySelector(
        'div[style*="font-weight: bold"],div[data-name*="Title"]',
      );
      var rowTitle =
        titleEl && titleEl.textContent.trim()
          ? sanitize(titleEl.textContent.trim())
          : videoId;
      mapTitle(rowTitle, videoId);
      var btn = document.createElement("button");
      var pos = getPos(videoId),
        watched = isWatched(videoId);
      btn.className = "sc-inline-btn" + (watched ? " watched" : "");
      btn.innerHTML = watched
        ? '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Watched'
        : pos > 5
          ? '<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M5 3l14 9-14 9V3z"/></svg> Resume'
          : '<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M5 3l14 9-14 9V3z"/></svg> Watch';
      btn.addEventListener("click", function () {
        showPlayer(videoId, rowTitle);
      });
      var container = div.querySelector(
        '[data-name="BrVid Fav Container Course"]',
      );
      if (container) container.appendChild(btn);
    });
  }

  /* ─────────────────────────────────────────────
     SIDEBAR DOTS (watched/progress indicators)
  ───────────────────────────────────────────── */
  function updateSidebarDots() {
    var cards = document.querySelectorAll(
      '[data-name="CourseOverviewVidCard"]',
    );
    cards.forEach(function (card) {
      var td = card.querySelector(
        'div[style*="font-weight: bold"][style*="font-size: 16px"]',
      );
      if (!td) return;
      var title = td.textContent.trim();
      if (!title) return;
      var vid = idFromTitle(title);
      var ep = card.querySelector(".episode-indicator");
      if (!ep) return;
      var dot = card.querySelector(".sc-dl-sidebar-dot");
      var color = null,
        tip = null;
      if (vid) {
        if (isWatched(vid)) {
          color = "#3ecf6e";
          tip = "Watched";
        } else if (getPos(vid) > 0) {
          color = "#f08030";
          tip = "In progress · " + formatTime(getPos(vid));
        }
      }
      if (!color) {
        if (dot && dot.parentNode) dot.parentNode.removeChild(dot);
        return;
      }
      if (!dot) {
        dot = document.createElement("span");
        dot.className = "sc-dl-sidebar-dot";
        ep.style.position = "relative";
        ep.appendChild(dot);
      }
      dot.style.cssText =
        "background:" +
        color +
        ";position:absolute;top:4px;right:4px;width:8px;height:8px;border-radius:50%;display:inline-block;";
      dot.title = tip;
    });
  }

  function updateCourseProgressLabel() {
    var cards = document.querySelectorAll(
      '[data-name="CourseOverviewVidCard"]',
    );
    if (!cards.length) return;
    var watched = 0,
      known = 0;
    cards.forEach(function (card) {
      var td = card.querySelector(
        'div[style*="font-weight: bold"][style*="font-size: 16px"]',
      );
      if (!td) return;
      var id = idFromTitle(td.textContent.trim());
      if (!id) return;
      known++;
      if (isWatched(id)) watched++;
    });
    var label = document.querySelector(".sc-dl-course-progress");
    if (!label) {
      label = document.createElement("div");
      label.className = "sc-dl-course-progress";
      label.style.cssText =
        "font-family:'Inter','Segoe UI',sans-serif;font-size:11px;color:#888;text-align:center;margin:6px 0;";
      var overview = document.querySelector('[data-name="CourseOverview"]');
      if (overview) {
        var fc = overview.querySelector("div");
        if (fc) fc.insertBefore(label, fc.firstChild);
      }
    }
    if (label)
      label.textContent = known
        ? watched + "/" + cards.length + " watched"
        : "";
  }

  /* ─────────────────────────────────────────────
     INIT & MUTATION OBSERVER
  ───────────────────────────────────────────── */
  function debounce(fn, ms) {
    var t;
    return function () {
      clearTimeout(t);
      t = setTimeout(fn, ms);
    };
  }

  function refresh() {
    updateFab();
    addInlineButtons();
    updateSidebarDots();
    updateCourseProgressLabel();
  }

  function init() {
    injectStyles();
    refresh();
    var lastUrl = location.href;
    var debouncedObs = debounce(function () {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        setTimeout(refresh, 1200);
        setTimeout(refresh, 2500);
      }
      addInlineButtons();
      var pe = !!document.querySelector('[data-name="Video Player Container"]');
      var be = !!document.querySelector(".sc-fab");
      if (pe && !be) updateFab();
      else if (!pe && be) {
        document.querySelectorAll(".sc-fab").forEach(function (el) {
          el.remove();
        });
      }
    }, 200);
    new MutationObserver(debouncedObs).observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", function () {
      setTimeout(init, 800);
    });
  else setTimeout(init, 800);
  window.addEventListener("load", function () {
    setTimeout(refresh, 1500);
  });
})();
