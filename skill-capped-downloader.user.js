// ==UserScript==
// @name        Skill-Capped Video Downloader
// @namespace   http://tampermonkey.net/
// @version     10.2
// @description Adds a better video player and downloader for Skill-Capped / Skill Capped League of Legends courses, with HLS playback, MP4/TS downloads, bulk course download, resume, auto-next, PiP, speed controls, and quality selection.
// @author      Max
// @match       https://www.skill-capped.com/*
// @require     https://cdn.jsdelivr.net/npm/hls.js@1.5.13/dist/hls.min.js
// @grant       GM_xmlhttpRequest
// @connect     d13z5uuzt1wkbz.cloudfront.net
// @run-at      document-idle
// ==/UserScript==

(function () {
  "use strict";

  var CDN = "https://d13z5uuzt1wkbz.cloudfront.net",
    RESOLUTION = "2500",
    CONCURRENCY = 6,
    MAX_RETRIES = 2,
    AUTONEXT_DELAY = 5;
  var SPEEDS = [1, 1.25, 1.5, 2];
  var QUALITIES = [
    { res: "2500", label: "1080p" },
    { res: "1500", label: "720p" },
    { res: "1000", label: "480p" },
  ];
  var currentRes = (function () {
    try {
      var v = localStorage.getItem("sc-quality");
      return v || RESOLUTION;
    } catch (e) {
      return RESOLUTION;
    }
  })();

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

  function injectStyles() {
    if (document.getElementById("sc-dl-styles")) return;
    var s = document.createElement("style");
    s.id = "sc-dl-styles";
    s.textContent =
      '\
            .sc-dl-btn{font-family:"Roboto Condensed",Arial,sans-serif;font-weight:700;font-size:13px;text-transform:uppercase;letter-spacing:.5px;color:#fff;background:linear-gradient(135deg,#d55051,#b33a3b);border:none;border-radius:6px;padding:8px 16px;cursor:pointer;transition:opacity .15s,transform .15s;white-space:nowrap;position:relative;overflow:hidden}\
            .sc-dl-btn:hover:not(:disabled){opacity:.9;transform:translateY(-1px)}\
            .sc-dl-btn:disabled{cursor:default;opacity:.85}\
            .sc-dl-btn--fixed{position:fixed!important;top:12px;left:12px;z-index:2147483647;padding:12px 24px;font-size:14px;box-shadow:0 4px 14px rgba(0,0,0,.45)}\
            .sc-dl-progress{position:absolute;bottom:0;left:0;height:3px;background:rgba(255,255,255,.7);transition:width .2s ease;border-radius:0 0 6px 6px}\
            .sc-dl-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.85);z-index:2147483646;display:flex;align-items:center;justify-content:center}\
            .sc-dl-player{position:relative;width:90vw;max-width:1200px;background:#111;border-radius:10px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,.6)}\
            .sc-dl-player video{width:100%;display:block;max-height:80vh;background:#000}\
            .sc-dl-controls-bar{display:flex;align-items:center;justify-content:space-between;padding:10px 16px;background:#1a1a1a;gap:8px;flex-wrap:wrap;border-radius:0 0 8px 8px}\
            .sc-dl-controls-bar span{color:#ccc;font-family:"Roboto Condensed",Arial,sans-serif;font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-right:auto}\
            .sc-dl-player-actions{display:flex;gap:6px;flex-shrink:0;align-items:center}\
            .sc-dl-player-actions button,.sc-dl-speed-btn{font-family:"Roboto Condensed",Arial,sans-serif;font-weight:700;font-size:11px;text-transform:uppercase;border:none;border-radius:4px;padding:5px 10px;cursor:pointer;transition:opacity .15s,background .15s}\
            .sc-dl-player-actions button:hover,.sc-dl-speed-btn:hover{opacity:.85}\
            .sc-dl-save-btn{background:#d55051;color:#fff;position:relative;overflow:hidden}\
            .sc-dl-close-btn{background:#444;color:#fff}\
            .sc-dl-pip-btn{background:#2a6a9e;color:#fff}\
            .sc-dl-speed-btn{background:#333;color:#aaa;min-width:36px;text-align:center}\
            .sc-dl-speed-btn.active{background:#d55051;color:#fff}\
            .sc-dl-loading{color:#999;text-align:center;padding:80px 20px;font-family:"Roboto Condensed",Arial,sans-serif;font-size:18px}\
            .sc-dl-toast{position:absolute;top:16px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,.8);color:#fff;padding:8px 20px;border-radius:6px;font-family:"Roboto Condensed",Arial,sans-serif;font-size:14px;z-index:10;pointer-events:none;transition:opacity .5s}\
            .sc-dl-keys-toast{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,.7);color:#fff;padding:16px 28px;border-radius:10px;font-size:28px;z-index:10;pointer-events:none;transition:opacity .4s}\
            .sc-dl-autonext-bar{display:flex;align-items:center;justify-content:center;gap:12px;padding:12px 16px;background:#1a1a1a;border-top:1px solid #333;font-family:"Roboto Condensed",Arial,sans-serif;font-size:13px;color:#ccc;border-radius:0 0 8px 8px}\
            .sc-dl-autonext-bar button{font-family:"Roboto Condensed",Arial,sans-serif;font-weight:700;font-size:11px;text-transform:uppercase;border:none;border-radius:4px;padding:5px 12px;cursor:pointer}\
            .sc-dl-bulk-btn{margin:8px auto;display:block;font-size:12px;padding:6px 14px}\
            .sc-dl-sidebar-dot{width:8px;height:8px;border-radius:50%;display:inline-block;flex-shrink:0}\
            .sc-dl-dropdown{position:relative;display:inline-block}\
            .sc-dl-dropdown-menu{display:none;position:absolute;bottom:100%;left:0;background:#222;border-radius:6px;padding:4px;margin-bottom:6px;min-width:140px;box-shadow:0 4px 16px rgba(0,0,0,.5);z-index:10}\
            .sc-dl-dropdown.open .sc-dl-dropdown-menu{display:block}\
            .sc-dl-dropdown-item{display:block;width:100%;text-align:left;background:none;color:#ccc;border:none;padding:8px 12px;font-family:"Roboto Condensed",Arial,sans-serif;font-size:12px;font-weight:600;cursor:pointer;border-radius:4px;white-space:nowrap}\
            .sc-dl-dropdown-item:hover{background:#333;color:#fff}\
            .sc-dl-course-progress{color:#888;font-family:"Roboto Condensed",Arial,sans-serif;font-size:12px;text-align:center;margin:6px 0}\
        ';
    document.head.appendChild(s);
  }

  var playlistCache = {};
  function getPlaylistUrl(id, res) {
    return CDN + "/" + id + "/HIDDEN" + (res || currentRes) + ".m3u8";
  }
  function fetchPlaylist(videoId, res) {
    var r = res || currentRes,
      cacheKey = videoId + "-" + r;
    if (playlistCache[cacheKey])
      return Promise.resolve(playlistCache[cacheKey]);
    var pu = getPlaylistUrl(videoId, r);
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
      playlistCache[cacheKey] = result;
      return result;
    });
  }
  function probeQualities(videoId, callback) {
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
              callback(available);
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
        chunks = [],
        bytes = 0,
        done = 0,
        t0 = Date.now();
      function batch(s) {
        if (s >= total) return Promise.resolve(chunks);
        var e = Math.min(s + CONCURRENCY, total);
        return Promise.all(
          urls.slice(s, e).map(function (u) {
            return fetchSegment(u, MAX_RETRIES);
          }),
        ).then(function (res) {
          for (var j = 0; j < res.length; j++)
            if (res[j]) {
              chunks.push(res[j]);
              bytes += res[j].byteLength;
              done++;
            }
          onProgress(
            done,
            total,
            bytes,
            bytes / ((Date.now() - t0) / 1000) / 1048576,
          );
          return batch(e);
        });
      }
      return batch(0);
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
      onStatus("Loading converter\u2026");
      loadMux(function (ok) {
        if (!ok) return reject(new Error("mux.js failed to load"));
        var lib = getMux();
        if (!lib || !lib.mp4) return reject(new Error("mux.js not available"));
        onStatus("Reading video data\u2026");
        var reader = new FileReader();
        reader.onload = function () {
          var tsData = new Uint8Array(reader.result);
          onStatus("Remuxing to MP4\u2026");
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

  function loadHls(cb) {
    cb();
  }
  function getHls() {
    return typeof Hls !== "undefined" ? Hls : null;
  }

  function attachHlsErrorRecovery(hls, H, titleSpan, filename) {
    hls.on(H.Events.ERROR, function (ev, data) {
      if (!data || !data.fatal) return;
      if (data.type === H.ErrorTypes.NETWORK_ERROR) {
        titleSpan.textContent = filename + " \u00B7 recovering network\u2026";
        hls.startLoad();
        return;
      }
      if (data.type === H.ErrorTypes.MEDIA_ERROR) {
        titleSpan.textContent = filename + " \u00B7 recovering media\u2026";
        hls.recoverMediaError();
        return;
      }
      titleSpan.textContent = filename + " (playback error)";
    });
  }

  // ── GM Loader for hls.js ────────────────────────────────────────────
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

  function savePosition(id, t) {
    try {
      localStorage.setItem("sc-pos-" + id, String(t));
    } catch (e) {}
  }
  function getPosition(id) {
    try {
      var v = localStorage.getItem("sc-pos-" + id);
      return v ? parseFloat(v) : 0;
    } catch (e) {
      return 0;
    }
  }
  function clearPosition(id) {
    try {
      localStorage.removeItem("sc-pos-" + id);
    } catch (e) {}
  }
  function markWatched(id) {
    try {
      localStorage.setItem("sc-done-" + id, "1");
    } catch (e) {}
  }
  function isWatched(id) {
    try {
      return localStorage.getItem("sc-done-" + id) === "1";
    } catch (e) {
      return false;
    }
  }
  function mapTitleToId(t, id) {
    if (t && id)
      try {
        localStorage.setItem("sc-tid-" + sanitize(t), id);
      } catch (e) {}
  }
  function getIdFromTitle(t) {
    try {
      return localStorage.getItem("sc-tid-" + sanitize(t));
    } catch (e) {
      return null;
    }
  }
  function getSavedSpeed() {
    try {
      var v = parseFloat(localStorage.getItem("sc-speed"));
      return v > 0 ? v : 1;
    } catch (e) {
      return 1;
    }
  }
  function saveSpeed(s) {
    try {
      localStorage.setItem("sc-speed", String(s));
    } catch (e) {}
  }
  function getSavedVolume() {
    try {
      var v = parseFloat(localStorage.getItem("sc-vol"));
      return v >= 0 && v <= 1 ? v : 1;
    } catch (e) {
      return 1;
    }
  }
  function saveVolume(v) {
    try {
      localStorage.setItem("sc-vol", String(v));
    } catch (e) {}
  }
  function getAutoNextEnabled() {
    try {
      return localStorage.getItem("sc-autonext") !== "0";
    } catch (e) {
      return true;
    }
  }
  function saveAutoNextEnabled(v) {
    try {
      localStorage.setItem("sc-autonext", v ? "1" : "0");
    } catch (e) {}
  }

  function showToast(parent, text, cls, dur) {
    var t = document.createElement("div");
    t.className = cls || "sc-dl-toast";
    t.textContent = text;
    parent.appendChild(t);
    setTimeout(function () {
      t.style.opacity = "0";
    }, dur || 1500);
    setTimeout(
      function () {
        if (t.parentNode) t.parentNode.removeChild(t);
      },
      (dur || 1500) + 600,
    );
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
  function getNextVideo() {
    return getAdjacentVideo(1);
  }
  function navigateToNextAndPlay(card) {
    card.click();
    var c = 0,
      iv = setInterval(function () {
        c++;
        var nid = getVideoIdFromThumbnail() || getVideoIdFromUrl();
        if (nid && c > 2) {
          clearInterval(iv);
          setTimeout(function () {
            showHlsPlayer(nid, getVideoTitle() || nid);
          }, 500);
        }
        if (c > 20) clearInterval(iv);
      }, 500);
  }
  function sanitize(n) {
    return (
      n
        .replace(/[<>:"/\\|?*\x00-\x1f]/g, "")
        .trim()
        .substring(0, 100) || "video"
    );
  }
  function formatMB(b) {
    return (b / 1048576).toFixed(1);
  }
  function formatTime(sec) {
    if (!sec || isNaN(sec)) return "0:00";
    var h = Math.floor(sec / 3600),
      m = Math.floor((sec % 3600) / 60),
      s = Math.floor(sec % 60),
      ps = s < 10 ? "0" : "";
    return h > 0
      ? h + ":" + (m < 10 ? "0" : "") + m + ":" + ps + s
      : m + ":" + ps + s;
  }

  function formatEta(sec) {
    if (sec < 60) return sec + "s";
    return (
      Math.floor(sec / 60) + "m" + (sec % 60 < 10 ? "0" : "") + (sec % 60) + "s"
    );
  }
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

  function showHlsPlayer(videoId, filename) {
    var existing = document.querySelector(".sc-dl-overlay");
    if (existing) existing.remove();
    mapTitleToId(filename, videoId);

    var overlay = document.createElement("div");
    overlay.className = "sc-dl-overlay";
    var player = document.createElement("div");
    player.className = "sc-dl-player";
    player.style.position = "relative";
    var video = document.createElement("video");
    video.controls = true;
    video.autoplay = true;
    var loadingDiv = document.createElement("div");
    loadingDiv.className = "sc-dl-loading";
    loadingDiv.textContent = "Loading\u2026";

    var bar = document.createElement("div");
    bar.className = "sc-dl-controls-bar";
    var titleSpan = document.createElement("span");
    titleSpan.textContent = filename;

    var speedGroup = document.createElement("div");
    speedGroup.className = "sc-dl-player-actions";
    var speedBtns = [],
      currentSpeed = getSavedSpeed();
    for (var si = 0; si < SPEEDS.length; si++) {
      (function (spd) {
        var sb = document.createElement("button");
        sb.className =
          "sc-dl-speed-btn" + (spd === currentSpeed ? " active" : "");
        sb.textContent = spd === 1 ? "1x" : spd + "x";
        sb.onclick = function () {
          video.playbackRate = spd;
          saveSpeed(spd);
          for (var j = 0; j < speedBtns.length; j++)
            speedBtns[j].className = "sc-dl-speed-btn";
          sb.className = "sc-dl-speed-btn active";
          showToast(player, spd + "x", "sc-dl-keys-toast", 600);
        };
        speedBtns.push(sb);
        speedGroup.appendChild(sb);
      })(SPEEDS[si]);
    }

    var qualGroup = document.createElement("div");
    qualGroup.className = "sc-dl-player-actions";
    var qualBtns = [],
      hlsInstance = null,
      autoNextTimer = null;
    function buildQualityButtons(available) {
      for (var qi = 0; qi < qualBtns.length; qi++) qualBtns[qi].remove();
      qualBtns = [];
      for (var ai = 0; ai < available.length; ai++) {
        (function (q) {
          var qb = document.createElement("button");
          qb.className =
            "sc-dl-speed-btn" + (q.res === currentRes ? " active" : "");
          qb.textContent = q.label;
          qb.onclick = function () {
            if (q.res === currentRes) return;
            // #4 — preserve play/pause state
            var pos = video.currentTime || 0,
              wasPaused = video.paused;
            currentRes = q.res;
            try {
              localStorage.setItem("sc-quality", q.res);
            } catch (e) {}
            for (var j = 0; j < qualBtns.length; j++)
              qualBtns[j].className = "sc-dl-speed-btn";
            qb.className = "sc-dl-speed-btn active";
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
                hlsInstance = new H({ enableWorker: false, loader: GMLoader });
                hlsInstance.loadSource(url);
                hlsInstance.attachMedia(video);
                hlsInstance.on(H.Events.MANIFEST_PARSED, function () {
                  if (pos > 1) video.currentTime = pos;
                  video.playbackRate = getSavedSpeed();
                  video.volume = getSavedVolume();
                  if (!wasPaused) video.play().catch(function () {});
                  URL.revokeObjectURL(url);
                });
                attachHlsErrorRecovery(hlsInstance, H, titleSpan, filename);
              }
            });
          };
          qualBtns.push(qb);
          qualGroup.appendChild(qb);
        })(available[ai]);
      }
    }
    probeQualities(videoId, function (available) {
      if (available.length > 1) buildQualityButtons(available);
    });

    var actions = document.createElement("div");
    actions.className = "sc-dl-player-actions";
    var pipBtn = document.createElement("button");
    pipBtn.className = "sc-dl-pip-btn";
    pipBtn.textContent = "PiP";
    pipBtn.title = "Picture-in-Picture";
    pipBtn.onclick = function () {
      document.pictureInPictureElement
        ? document.exitPictureInPicture().catch(function () {})
        : video.requestPictureInPicture &&
          video.requestPictureInPicture().catch(function () {});
    };

    var autoBtn = document.createElement("button");
    autoBtn.className = "sc-dl-speed-btn";
    autoBtn.textContent = getAutoNextEnabled() ? "Auto \u2713" : "Auto \u2717";
    autoBtn.title = "Toggle auto-next episode";
    autoBtn.onclick = function () {
      var enabled = !getAutoNextEnabled();
      saveAutoNextEnabled(enabled);
      autoBtn.textContent = enabled ? "Auto \u2713" : "Auto \u2717";
    };

    var downloadDrop = document.createElement("div");
    downloadDrop.className = "sc-dl-dropdown";
    var downloadBtn = document.createElement("button");
    downloadBtn.className = "sc-dl-save-btn";
    downloadBtn.textContent = "\u2B07 Download \u25BE";
    downloadBtn.onclick = function (e) {
      e.stopPropagation();
      downloadDrop.className =
        downloadDrop.className.indexOf("open") >= 0
          ? "sc-dl-dropdown"
          : "sc-dl-dropdown open";
    };
    var downloadMenu = document.createElement("div");
    downloadMenu.className = "sc-dl-dropdown-menu";
    var dlMp4 = document.createElement("button");
    dlMp4.className = "sc-dl-dropdown-item";
    dlMp4.textContent = "\u2B07 .mp4 (Converted)";
    dlMp4.onclick = function () {
      downloadDrop.className = "sc-dl-dropdown";
      startDownload(videoId, downloadBtn, "mp4");
    };
    var dlTs = document.createElement("button");
    dlTs.className = "sc-dl-dropdown-item";
    dlTs.textContent = "\u2B07 .ts (Original)";
    dlTs.onclick = function () {
      downloadDrop.className = "sc-dl-dropdown";
      startDownload(videoId, downloadBtn, "ts");
    };
    downloadMenu.appendChild(dlMp4);
    downloadMenu.appendChild(dlTs);
    downloadDrop.appendChild(downloadMenu);
    downloadDrop.appendChild(downloadBtn);

    function closeDropdown() {
      downloadDrop.className = "sc-dl-dropdown";
    }
    document.addEventListener("click", closeDropdown);

    var closeBtn = document.createElement("button");
    closeBtn.className = "sc-dl-close-btn";
    closeBtn.textContent = "\u2715 Close";
    closeBtn.onclick = function () {
      if (
        video.currentTime > 5 &&
        video.duration &&
        video.currentTime < video.duration - 5
      )
        savePosition(videoId, video.currentTime);
      else if (video.duration) clearPosition(videoId);
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
      updateSidebarDots();
      updateCourseProgressLabel();
      document.removeEventListener("keydown", keyHandler);
      document.removeEventListener("click", closeDropdown); // #2
    };

    if (document.pictureInPictureEnabled) actions.appendChild(pipBtn);
    actions.appendChild(autoBtn);
    actions.appendChild(downloadDrop);
    actions.appendChild(closeBtn);
    bar.appendChild(titleSpan);
    bar.appendChild(speedGroup);
    bar.appendChild(qualGroup);
    bar.appendChild(actions);
    player.appendChild(loadingDiv);
    player.appendChild(bar);
    overlay.appendChild(player);
    document.body.appendChild(overlay);

    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) closeBtn.click();
    });

    function keyHandler(e) {
      if (!document.querySelector(".sc-dl-overlay")) {
        document.removeEventListener("keydown", keyHandler);
        return;
      }
      var tag = (e.target.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea") return;
      if (e.key === "Escape") {
        closeBtn.click();
        return;
      }
      if (e.key === " " || e.code === "Space") {
        e.preventDefault();
        video.paused ? video.play().catch(function () {}) : video.pause();
        showToast(
          player,
          video.paused ? "\u23F8" : "\u25B6",
          "sc-dl-keys-toast",
          600,
        );
        return;
      }
      if (e.key === "ArrowLeft") {
        video.currentTime = Math.max(0, video.currentTime - 10);
        showToast(player, "-10s", "sc-dl-keys-toast", 600);
        return;
      }
      if (e.key === "ArrowRight") {
        video.currentTime = Math.min(
          video.duration || 0,
          video.currentTime + 10,
        );
        showToast(player, "+10s", "sc-dl-keys-toast", 600);
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
        showToast(
          player,
          video.muted ? "\uD83D\uDD07" : "\uD83D\uDD0A",
          "sc-dl-keys-toast",
          600,
        );
        return;
      }
      if (e.key === "n" || e.key === "N") {
        var nv = getAdjacentVideo(1);
        if (nv) {
          closeBtn.click();
          navigateToNextAndPlay(nv.card);
        }
        return;
      }
      if (e.key === "p" || e.key === "P") {
        var pv = getAdjacentVideo(-1);
        if (pv) {
          closeBtn.click();
          navigateToNextAndPlay(pv.card);
        }
        return;
      }
    }
    document.addEventListener("keydown", keyHandler);

    var savedPos = getPosition(videoId);
    fetchPlaylist(videoId)
      .then(function (pl) {
        if (!pl.urls.length) {
          loadingDiv.textContent = "No segments found.";
          return;
        }
        if (pl.duration > 0)
          titleSpan.textContent =
            filename + " \u00B7 " + formatTime(pl.duration);
        var m3u8Blob = new Blob([pl.m3u8Text], {
          type: "application/vnd.apple.mpegurl",
        });
        var m3u8Url = URL.createObjectURL(m3u8Blob);
        player.insertBefore(video, loadingDiv);
        player.removeChild(loadingDiv);
        video.playbackRate = currentSpeed;
        video.volume = getSavedVolume();
        video.addEventListener("volumechange", function () {
          saveVolume(video.volume);
        });
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
            savePosition(videoId, video.currentTime);
          }
        });

        video.addEventListener("ended", function () {
          clearPosition(videoId);
          markWatched(videoId);
          updateSidebarDots();
          updateCourseProgressLabel();
          if (!getAutoNextEnabled()) return;
          var next = getNextVideo();
          if (!next) return;
          var anBar = document.createElement("div");
          anBar.className = "sc-dl-autonext-bar";
          var countdown = AUTONEXT_DELAY,
            label = document.createElement("span");
          label.textContent = "Next: " + next.title + " in " + countdown + "s";
          var playNow = document.createElement("button");
          playNow.style.background = "#2a7a2a";
          playNow.style.color = "#fff";
          playNow.textContent = "\u25B6 Play Now";
          var cancel = document.createElement("button");
          cancel.style.background = "#555";
          cancel.style.color = "#fff";
          cancel.textContent = "Cancel";
          anBar.appendChild(label);
          anBar.appendChild(playNow);
          anBar.appendChild(cancel);
          player.appendChild(anBar);
          function goNext() {
            if (autoNextTimer) {
              clearInterval(autoNextTimer);
              autoNextTimer = null;
            }
            closeBtn.click();
            navigateToNextAndPlay(next.card);
          }
          playNow.onclick = goNext;
          cancel.onclick = function () {
            if (autoNextTimer) {
              clearInterval(autoNextTimer);
              autoNextTimer = null;
            }
            if (anBar.parentNode) anBar.parentNode.removeChild(anBar);
          };
          autoNextTimer = setInterval(function () {
            countdown--;
            if (countdown <= 0) goNext();
            else
              label.textContent =
                "Next: " + next.title + " in " + countdown + "s";
          }, 1000);
        });

        loadHls(function () {
          var H = getHls();
          if (H && H.isSupported()) {
            hlsInstance = new H({ enableWorker: false, loader: GMLoader });
            hlsInstance.loadSource(m3u8Url);
            hlsInstance.attachMedia(video);
            hlsInstance.on(H.Events.MANIFEST_PARSED, function () {
              if (savedPos > 5) {
                video.currentTime = savedPos;
                showToast(player, "Resumed from " + formatTime(savedPos));
              }
              video.play().catch(function () {});
              URL.revokeObjectURL(m3u8Url);
              var nextInfo = getNextVideo();
              if (nextInfo) {
                var nextId = getIdFromTitle(nextInfo.title);
                if (nextId) fetchPlaylist(nextId).catch(function () {});
              }
            });
            attachHlsErrorRecovery(hlsInstance, H, titleSpan, filename); // #3
          } else if (video.canPlayType("application/vnd.apple.mpegURL")) {
            video.src = getPlaylistUrl(videoId);
            if (savedPos > 5)
              video.addEventListener(
                "loadedmetadata",
                function () {
                  video.currentTime = savedPos;
                  showToast(player, "Resumed from " + formatTime(savedPos));
                },
                { once: true },
              );
            video.play().catch(function () {});
          } else {
            loadingDiv.textContent = "HLS not supported.";
            player.insertBefore(loadingDiv, video);
            player.removeChild(video);
          }
        });
      })
      .catch(function (err) {
        console.error("[SC-DL]", err);
        loadingDiv.textContent = "Error: " + err.message;
      });
  }

  function startDownload(videoId, btn, format) {
    var baseName = getVideoTitle() || videoId,
      ext = format === "mp4" ? ".mp4" : ".ts",
      filename = baseName + ext;
    btn.disabled = true;
    var bar = btn.querySelector(".sc-dl-progress");
    if (!bar) {
      bar = document.createElement("div");
      bar.className = "sc-dl-progress";
      btn.appendChild(bar);
    }
    bar.style.width = "0%";
    var downloadStart = Date.now();
    function setText(msg) {
      var b = btn.querySelector(".sc-dl-progress");
      btn.textContent = msg;
      if (b) btn.appendChild(b);
    }

    downloadSegments(videoId, function (count, total, bytes, speed) {
      var elapsedSec = Math.max(0.1, (Date.now() - downloadStart) / 1000);
      var avgSpeed = bytes / elapsedSec / 1048576;
      var eta = "";
      if (avgSpeed > 0 && count > 0 && count < total) {
        var avgPerSeg = bytes / count;
        var secsLeft = Math.round(
          ((total - count) * avgPerSeg) / (avgSpeed * 1048576),
        );
        eta = " \u00B7 ~" + formatEta(secsLeft);
      }
      setText(
        count +
          "/" +
          total +
          " \u00B7 " +
          formatMB(bytes) +
          " MB \u00B7 " +
          avgSpeed.toFixed(1) +
          " MB/s" +
          eta,
      );
      bar.style.width = Math.min(95, (count / total) * 100) + "%";
    })
      .then(function (chunks) {
        if (!chunks.length) {
          setText("\u26A0 No segments");
          btn.disabled = false;
          bar.style.width = "0%";
          return;
        }
        var tsBlob = new Blob(chunks, { type: "video/mp2t" }),
          totalMB = formatMB(tsBlob.size);
        if (format === "mp4") {
          bar.style.width = "95%";
          convertToMp4(tsBlob, setText)
            .then(function (mp4Blob) {
              bar.style.width = "100%";
              saveBlob(mp4Blob, filename);
              setText(
                "\u2713 MP4 saved \u2014 " + formatMB(mp4Blob.size) + " MB",
              );
              setTimeout(function () {
                setText("\u2B07 Download \u25BE");
                btn.disabled = false;
                bar.style.width = "0%";
              }, 4000);
            })
            .catch(function (err) {
              console.warn("[SC-DL] MP4 failed, saving .ts:", err);
              setText("MP4 failed \u2014 saving .ts");
              saveBlob(tsBlob, baseName + ".ts");
              setTimeout(function () {
                setText("\u2B07 Download \u25BE");
                btn.disabled = false;
                bar.style.width = "0%";
              }, 4000);
            });
        } else {
          bar.style.width = "100%";
          saveBlob(tsBlob, filename);
          setText("\u2713 Saved \u2014 " + totalMB + " MB");
          setTimeout(function () {
            setText("\u2B07 Download \u25BE");
            btn.disabled = false;
            bar.style.width = "0%";
          }, 4000);
        }
      })
      .catch(function (e) {
        console.error("[SC-DL]", e);
        setText("\u26A0 Error");
        setTimeout(function () {
          setText("\u2B07 Download \u25BE");
          btn.disabled = false;
          bar.style.width = "0%";
        }, 4000);
      });
  }

  var bulkRunning = false;
  function startBulkDownload(btn) {
    if (bulkRunning) return;
    bulkRunning = true;
    var cards = [],
      allCards = document.querySelectorAll(
        '[data-name="CourseOverviewVidCard"]',
      );
    for (var i = 0; i < allCards.length; i++) cards.push(allCards[i]);
    var total = cards.length,
      current = 0,
      done = 0,
      failed = 0;
    btn.disabled = true;
    function downloadNext() {
      if (current >= total) {
        bulkRunning = false;
        btn.textContent =
          "\u2713 " +
          done +
          " saved" +
          (failed ? ", " + failed + " failed" : "");
        setTimeout(function () {
          btn.textContent = "\u2B07 Download All (" + total + ")";
          btn.disabled = false;
        }, 5000);
        return;
      }
      btn.textContent = current + 1 + "/" + total + " downloading\u2026";
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
            downloadNext();
            return;
          }
          var title = getVideoTitle() || videoId;
          mapTitleToId(title, videoId);
          btn.textContent =
            current + 1 + "/" + total + " \u00B7 " + title.substring(0, 30);
          downloadSegments(videoId, function (cnt, tot) {
            btn.textContent =
              current + 1 + "/" + total + " \u00B7 " + cnt + "/" + tot + " seg";
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
              downloadNext();
            })
            .catch(function () {
              failed++;
              current++;
              downloadNext();
            });
        }
      }, 500);
    }
    downloadNext();
  }

  // #7 — sidebar dots: update existing dots instead of skipping
  function updateSidebarDots() {
    var cards = document.querySelectorAll(
      '[data-name="CourseOverviewVidCard"]',
    );
    for (var i = 0; i < cards.length; i++) {
      var td = cards[i].querySelector(
        'div[style*="font-weight: bold"][style*="font-size: 16px"]',
      );
      if (!td) continue;
      var title = td.textContent.trim();
      if (!title) continue;
      var vid = getIdFromTitle(title);
      var ep = cards[i].querySelector(".episode-indicator");
      if (!ep) continue;
      var dot = cards[i].querySelector(".sc-dl-sidebar-dot");
      var color = null,
        tip = null;
      if (vid) {
        if (isWatched(vid)) {
          color = "#4caf50";
          tip = "Watched";
        } else if (getPosition(vid) > 0) {
          color = "#ff9800";
          tip = "In progress \u00B7 " + formatTime(getPosition(vid));
        }
      }
      if (!color) {
        if (dot && dot.parentNode) dot.parentNode.removeChild(dot);
        continue;
      }
      if (!dot) {
        dot = document.createElement("span");
        dot.className = "sc-dl-sidebar-dot";
        ep.style.position = "relative";
        ep.appendChild(dot);
      }
      dot.style.cssText =
        "background:" + color + ";position:absolute;top:4px;right:4px;";
      dot.title = tip;
    }
  }

  function updateCourseProgressLabel() {
    var cards = document.querySelectorAll(
      '[data-name="CourseOverviewVidCard"]',
    );
    if (!cards.length) return;
    var watched = 0,
      known = 0;
    for (var i = 0; i < cards.length; i++) {
      var td = cards[i].querySelector(
        'div[style*="font-weight: bold"][style*="font-size: 16px"]',
      );
      if (!td) continue;
      var id = getIdFromTitle(td.textContent.trim());
      if (!id) continue;
      known++;
      if (isWatched(id)) watched++;
    }
    var label = document.querySelector(".sc-dl-course-progress");
    if (!label) {
      label = document.createElement("div");
      label.className = "sc-dl-course-progress";
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

  function addFixedButton() {
    var old = document.querySelectorAll(".sc-dl-btn--fixed");
    for (var i = 0; i < old.length; i++) old[i].remove();
    if (!document.querySelector('[data-name="Video Player Container"]')) return;
    var videoId = getVideoIdFromThumbnail() || getVideoIdFromUrl();
    if (!videoId) return;
    var pos = getPosition(videoId),
      btn = document.createElement("button");
    btn.className = "sc-dl-btn sc-dl-btn--fixed";
    btn.textContent = pos > 5 ? "\u25B6 Resume" : "\u25B6 Watch";
    btn.title = "Video: " + videoId;
    btn.onclick = function () {
      showHlsPlayer(videoId, getVideoTitle() || videoId);
    };
    document.body.appendChild(btn);
    fetchPlaylist(videoId)
      .then(function (pl) {
        if (pl.duration > 0) {
          var lbl =
            pos > 5 ? "\u25B6 Resume " + formatTime(pos) : "\u25B6 Watch";
          btn.textContent = lbl + " \u00B7 " + formatTime(pl.duration);
        }
      })
      .catch(function () {});
  }

  function addInlineButtons() {
    var rows = document.querySelectorAll(
      'div[data-name="BrVid Row Parent Course"]',
    );
    for (var r = 0; r < rows.length; r++) {
      var div = rows[r];
      if (div.querySelector(".sc-dl-btn")) continue;
      var rowEl = div.closest('div[id^="BrVidRow-"]');
      if (!rowEl) continue;
      var videoId = rowEl.id.split("-")[1];
      if (!videoId) continue;
      var heart = div.querySelector('svg[data-name="Heart Icon"]');
      if (heart && heart.parentNode) heart.parentNode.removeChild(heart);
      var titleEl = div.querySelector(
        'div[style*="font-weight: bold"], div[data-name*="Title"]',
      );
      var rowTitle =
        titleEl && titleEl.textContent.trim()
          ? sanitize(titleEl.textContent.trim())
          : videoId;
      var btn = document.createElement("button");
      btn.className = "sc-dl-btn";
      var pos = getPosition(videoId);
      btn.textContent =
        pos > 5
          ? "\u25B6 Resume"
          : isWatched(videoId)
            ? "\u2713 Rewatch"
            : "\u25B6 Watch";
      (function (vid, title, b) {
        b.onclick = function () {
          showHlsPlayer(vid, title || vid);
        };
      })(videoId, rowTitle, btn);
      var container = div.querySelector(
        '[data-name="BrVid Fav Container Course"]',
      );
      if (container) container.appendChild(btn);
    }
  }

  function addBulkButton() {
    if (document.querySelector(".sc-dl-bulk-btn")) return;
    var cards = document.querySelectorAll(
      '[data-name="CourseOverviewVidCard"]',
    );
    if (cards.length < 2) return;
    var btn = document.createElement("button");
    btn.className = "sc-dl-btn sc-dl-bulk-btn";
    btn.textContent = "\u2B07 Download All (" + cards.length + ")";
    btn.onclick = function () {
      startBulkDownload(btn);
    };
    var overview = document.querySelector('[data-name="CourseOverview"]');
    if (overview) {
      var fc = overview.querySelector("div");
      if (fc) fc.appendChild(btn);
    }
  }

  function debounce(fn, ms) {
    var t;
    return function () {
      clearTimeout(t);
      t = setTimeout(fn, ms);
    };
  }
  function refresh() {
    addFixedButton();
    addInlineButtons();
    addBulkButton();
    updateSidebarDots();
    updateCourseProgressLabel();
  }
  function init() {
    injectStyles();
    refresh();
    var lastUrl = location.href;
    var debouncedRefresh = debounce(function () {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        setTimeout(refresh, 1200);
        setTimeout(refresh, 2500);
      }
    }, 200);
    new MutationObserver(debouncedRefresh).observe(document.body, {
      childList: true,
      subtree: true,
    });
    var debouncedDom = debounce(function () {
      addInlineButtons();
      addBulkButton();
      var pe = !!document.querySelector('[data-name="Video Player Container"]'),
        be = !!document.querySelector(".sc-dl-btn--fixed");
      if (pe && !be) addFixedButton();
      else if (!pe && be) {
        var bb = document.querySelectorAll(".sc-dl-btn--fixed");
        for (var i = 0; i < bb.length; i++) bb[i].remove();
      }
    }, 200);
    new MutationObserver(debouncedDom).observe(document.body, {
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
