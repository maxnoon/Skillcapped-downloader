# Skill-Capped HLS Video Player & Downloader

A Violentmonkey/Tampermonkey userscript that improves the Skill-Capped League of Legends video-course interface with a custom HLS player, resume support, quality controls, keyboard shortcuts, progress tracking, and optional video downloads.

## What is Skill-Capped?

Skill-Capped, also written as Skill Capped or SkillCapped, is an online game-learning platform focused on helping players improve through structured educational video content.

Its League of Legends section includes course-style lessons, champion guides, VOD-style reviews, smurf commentaries, role-specific training, macro explanations, laning concepts, mechanics breakdowns, and ranked-improvement content.

This userscript is designed for Skill-Capped's League of Legends video-course pages. It adds a faster and more practical viewing workflow for users who want better playback controls, resume support, easier course navigation, and local video download options.

## Main Features

### Streaming Player

* Custom HLS video player powered by hls.js
* Reliable playlist and segment loading through the userscript manager
* Playback speed controls:

  * 1x
  * 1.25x
  * 1.5x
  * 2x
* Speed setting remembered across sessions
* Quality selector:

  * 1080p
  * 720p
  * 480p
* Available qualities are detected automatically
* Picture-in-Picture support
* Fullscreen support via keyboard shortcut or double-click
* Volume level remembered across sessions
* HLS fatal-error recovery for network and media errors

### Keyboard Shortcuts

* `Space` — play/pause
* `←` / `→` — seek backward/forward 10 seconds
* `F` — fullscreen
* `M` — mute/unmute
* `N` — next episode
* `P` — previous episode
* `Esc` — close player

### Download Options

* Download the current video as `.mp4` or `.ts`
* `.mp4` conversion powered by mux.js
* `.ts` option saves the original transport stream
* Parallel segment downloading
* Download progress bar
* Download speed display
* Estimated time remaining
* Retry logic for failed segments
* Bulk course download for the current course/chapter
* Downloads use the selected quality setting

### Watch History

* Resume playback from where you left off
* Playback position saved every 3 seconds
* Saved position restored automatically when reopening a video
* Auto-next episode with countdown after a video ends
* Auto-next can be toggled on/off
* Sidebar progress dots:

  * Green = watched
  * Orange = in progress
* Watch button shows saved progress and duration when available

Example:

```text
▶ Resume 1:23 · 3:56
```

### Course Navigation

* Adds Watch/Resume buttons to course cards on browse pages
* Adds a floating Watch/Resume button on video/syllabus pages
* Adds a bulk download button on course pages
* Adds a course progress counter, for example:

```text
3/10 watched
```

* Supports next/previous episode navigation from the custom player

### Performance

* Playlist results cached to avoid duplicate network requests
* Single MutationObserver with debouncing covers all DOM update logic
* mux.js loaded lazily only when MP4 download is used
* hls.js loaded via `@require` for reliable userscript sandbox loading
* Downloads run separately from playback
* HLS.js demuxing runs on the main thread (`enableWorker: false` required — custom loader uses `GM_xmlhttpRequest`, unavailable in workers)
* Sliding-window segment fetcher keeps all download slots filled at all times
* Progress UI updates throttled to 4/second to avoid DOM thrashing during downloads
* Playlist cache capped at 50 entries with LRU eviction

## Search Keywords

Skill-Capped, Skill Capped, SkillCapped, League of Legends, LoL, LoL guides, Challenger guides, champion guides, champion courses, VOD review, smurf commentary, course player, video player, HLS player, HLS downloader, MP4 downloader, TS downloader, course downloader, Skill-Capped downloader, Skill-Capped player, Tampermonkey, Violentmonkey, userscript.

## How It Works

The script detects Skill-Capped course video pages and adds custom controls to the existing interface.

It loads the HLS playlist for the current video, resolves the video segments, and uses hls.js for in-browser playback. Network requests are handled through the userscript manager API so the custom player can load video resources reliably from inside the browser extension sandbox.

Downloads are handled separately from playback. The script can save the original `.ts` stream or convert the result to fragmented `.mp4` using mux.js.

## Install

1. Install a userscript manager:

   * [Violentmonkey](https://violentmonkey.github.io/) recommended
   * Tampermonkey also supported
2. Install this userscript from Greasy Fork
3. Open a Skill-Capped League of Legends course page
4. Click **▶ Watch** to open the custom player
5. Use **⬇ Download ▾** to save the current video
6. Use **⬇ Download All** to download videos from the current course/chapter

## Compatibility

Tested with:

* Violentmonkey
* Tampermonkey
* Chrome / Chromium-based browsers

The script is written in ES5-style JavaScript for broad userscript-manager compatibility.

## Notes

This script is focused on improving the Skill-Capped League of Legends course video interface.

Because Skill-Capped may update its website layout, some selectors, buttons, sidebar detection, or title extraction logic may occasionally break. If that happens, update to the latest version of the script.

---

# Changelog

## v1.5 — Initial Release

Sequential segment downloader. Probes `.ts` segments one by one, merges them into a single file, then triggers a browser download.

Inline buttons added on browse pages.

Approximately 50 lines. No playback, no progress indicator, no retry logic.

---

## v2.0 — Parallel Downloads

* Parallel batch downloading with 6 concurrent segments
* Progress feedback:

  * Segment count
  * MB downloaded
  * Download speed
* Retry logic:

  * 2 retries per segment
  * Exponential backoff
* Fixed floating **▶ Download** button on video player pages
* Experimental FFmpeg.wasm TS-to-MP4 conversion

---

## v2.1 — Selector Fixes

* Fixed title extraction
* Site splits titles into individual word `<div>` elements
* MutationObserver now watches for Video Player Container appearing/disappearing
* Fixed `catch {}` to `catch(_) {}` for Tampermonkey linter compatibility

---

## v3.0 — Violentmonkey Migration

Migrated the script to Violentmonkey-compatible userscript APIs and rewrote the main logic in ES5-style JavaScript for broader compatibility.

* Stripped FFmpeg.wasm
* FFmpeg.wasm required `SharedArrayBuffer`, which the site does not enable
* Rewrote the full script in ES5 for maximum userscript-manager compatibility
* Added floating preview player with blob URL playback

---

## v3.1 — Chrome Playback Fix

Chrome cannot play `.ts` blobs natively in `<video>`.

Added hls.js as a fallback transmuxer for browser playback.

---

## v4.0 — Real Playlist Parsing

Stopped guessing segment URLs.

The script now fetches the real `.m3u8` playlist, parses `#EXTINF` durations, and resolves relative segment URLs to absolute URLs.

Buttons changed from **Download** to **Watch**. The player opens first, and download is now a separate action.

---

## v4.1 — Custom Loader Attempt

Attempted a custom `PlainFetchLoader` for hls.js using regular `fetch()`.

This still failed in some cases because page-context requests remain subject to normal browser restrictions.

---

## v5.0 — GM_xmlhttpRequest Network Layer

All video playlist and segment requests now use `GM_xmlhttpRequest`.

* Added `@grant GM_xmlhttpRequest`
* Added `@connect d13z5uuzt1wkbz.cloudfront.net`
* Segments downloaded via `GM_xmlhttpRequest`
* Segments merged into blob data
* Blob playlist passed to hls.js playback
* Script runs in the userscript sandbox
* Page globals accessed through userscript-safe handling

---

## v6.0 — Resume, Auto-Next, Duration Preview

Added three features for longer watching sessions:

* **Resume watching**

  * Position saved every 3 seconds
  * Player seeks to saved position on reopen
  * Toast notification shown when resuming
* **Auto-next episode**

  * 5-second countdown after video ends
  * Includes Play Now / Cancel buttons
* **Duration preview**

  * Duration parsed from `#EXTINF` playlist entries
  * Duration shown on Watch button

---

## v6.1 — Smurf Commentary Fix

Fixed video ID extraction for VOD reviews and smurf commentaries.

The URL pattern is:

```text
/course/{videoId}/{courseId}
```

The regex was capturing the last segment, which represented the course container, instead of the first segment, which represented the video ID.

Regular course videos were unaffected because thumbnail extraction already provided the correct ID.

Confirmed through course dump JSON:

* `data.videos` UUIDs resolve correctly
* `data.courses` UUIDs are course containers, not video IDs

---

## v7.0 — True Streaming

Major architecture change.

Pre-downloading all segments before playback was too slow for long VOD reviews.

Added a custom `GMLoader` class for hls.js. It routes segment requests through `GM_xmlhttpRequest` while handling blob URLs through regular XHR.

Playback now starts in a few seconds regardless of video length.

Download remains a separate action and does not block playback.

---

## v7.1 — hls.js Stats Fix: Parsing

Fixed crash:

```text
can't access property 'start', e.parsing is undefined
```

hls.js's playlist loader expects `stats.parsing.start` in the success callback.

Added:

* `loading`
* `parsing`
* `buffering`

stats objects with timestamps.

---

## v7.2 — hls.js Stats Fix: Loader Instance

Fixed crash:

```text
can't access property 'loading', o is undefined
```

hls.js reads `loader.stats` directly from the loader instance, not only from callbacks.

Added:

* `this.stats`
* `this.context`

to the `GMLoader` constructor.

Stats are now updated throughout the request lifecycle.

---

## v8.0 — Speed, PiP, Shortcuts, Bulk Download, Progress Dots

Added five major features:

* **Speed controls**

  * 1x
  * 1.25x
  * 1.5x
  * 2x
  * Speed saved across sessions
* **Picture-in-Picture**

  * Pop video out of the overlay
* **Keyboard shortcuts**

  * Space
  * Left/right arrows
  * F
  * Esc
* **Bulk course download**

  * Clicks through sidebar cards
  * Downloads all episodes
* **Sidebar progress dots**

  * Green = watched
  * Orange = in progress

---

## v8.1 — Bulk Download Sidebar Fix

The **Download All** button was not appearing on video pages.

It was looking for `BrVidRow` elements, which only exist on browse pages.

Now it detects sidebar `CourseOverviewVidCard` elements and clicks through them sequentially.

---

## v8.2 — Sidebar Dots Title Mapping

Progress dots were not appearing because sidebar cards do not expose video IDs in the DOM.

Added title-to-videoId mapping in localStorage.

Dots populate as you watch videos or run bulk download.

---

## v9.0 — Inline Player Attempt

Tried injecting the video directly into the site's own Video Player Container instead of using a popup overlay.

This did not work reliably because site CSS and JavaScript interfered.

Reverted in v9.1.

---

## v9.1 — Overlay Restored

Reverted to popup overlay player.

All features from v8.x and v9.0 were retained.

---

## v9.2 — Performance & Quality of Life

* Playlist caching
* Button duration preview reused when opening player
* Debounced observers
* 200ms debounce on both MutationObservers
* Volume memory
* Double-click fullscreen
* Download ETA display

---

## v9.3 — Quality Selector

* Probes 1080p / 720p / 480p in parallel
* Shows buttons for available qualities
* Quality switch restarts hls.js at the current position
* Quality preference saved to localStorage
* Downloads use selected quality
* Bulk download guard prevents double-click queueing

---

## v9.4 — Download Format Dropdown

Download button replaced with a dropdown:

* `.mp4 (Converted)`
* `.ts (Original)`

Initial MP4 conversion used FFmpeg.wasm single-threaded build.

This was blocked by the site's CSP because the worker chunk was rejected.

Fixed in v9.5.

---

## v9.5 — mux.js MP4 Fix

Replaced FFmpeg.wasm with mux.js for MP4 conversion.

Benefits:

* Pure JavaScript
* No WASM
* No Web Workers
* No CSP issues
* Small dependency size
* Produces fragmented MP4 output

The resulting MP4 files play in most modern players and browsers.

---

## v10.0 — Code Review Polish

Applied 10 improvements from structured code review.

### New Features

* HLS fatal-error recovery
* Auto-retries network and media errors
* `N` / `P` keyboard shortcuts for next/previous episode
* `M` key to mute/unmute
* Auto-next toggle button
* Auto-next preference persisted
* Session progress counter in sidebar
* Example: `3/10 watched`
* Speed change toast
* Next episode playlist prefetch

### Bug Fixes

* Fixed download ETA calculation
* Previous logic mixed `Date.now()` with `performance.now()`
* Fixed leaked document click listeners on repeated player opens
* Quality switch now preserves play/pause state
* Sidebar dots update in-place instead of skipping existing dots
* Inline button titles are now extracted from the row element instead of the page title

---

## v10.1 — @require hls.js

Adopted `@require` for hls.js loading.

Credit: valuecoding

hls.js now loads into the userscript sandbox at install time instead of through dynamic `<script>` tag injection.

### Benefits

* Eliminates CSP concerns for hls.js
* No race conditions
* hls.js is available before the script runs
* Simplified `loadHls()` to a no-op
* Simplified `getHls()` to a `typeof` check
* Dropped `@connect cdn.jsdelivr.net`
* Dropped `hlsReady` state tracking

---

## v10.2 — Batch Concurrent Downloading

* Replaced sequential segment downloading with parallel batch fetching
* Added configurable concurrency (`CONCURRENCY = 6`): up to 6 segments fetched simultaneously per batch
* Batches waited for all slots to finish before starting the next group
* Set `enableWorker: false` on HLS.js instances — required because the custom `GMLoader` uses `GM_xmlhttpRequest`, which is only available in the Tampermonkey main thread and not accessible inside a Web Worker

The batch download approach was superseded by the sliding-window fetcher in v10.3. The `enableWorker: false` flag is kept permanently.

---

## v10.3 — Performance Optimizations

### Download Engine

* **Sliding-window segment fetcher** — replaced the v10.2 batch-wait model with a work queue that keeps exactly `CONCURRENCY` (6) slots filled at all times; a new request is dispatched the moment any slot finishes instead of waiting for the slowest segment in a batch
* Fixed a `var` closure bug in the new fetcher that would have silently corrupted segment ordering when requests completed out of order

### Player

* `enableWorker: false` kept — the custom `GMLoader` relies on `GM_xmlhttpRequest`, which is only available in the Tampermonkey main thread and cannot run inside a Web Worker
* Fixed blob URL leak — `URL.createObjectURL` result was not revoked in the native HLS fallback path or the unsupported-browser path; both now revoke immediately

### DOM

* **Single MutationObserver** — merged two observers (both watching `document.body` with `childList + subtree`) into one, halving the number of callbacks fired per DOM mutation

---

## v11.0 — Memory & UI Responsiveness

### Downloads

* **Throttled progress updates** — download progress UI now updates at most every 250ms (≈4 times/second) instead of on every segment completion; with 300–500 segments per video and `CONCURRENCY = 6`, this eliminates DOM thrashing and layout jank during active downloads; the final segment always forces an immediate update
* **Faster blob URL revocation** — `URL.revokeObjectURL` in `saveBlob` now fires after 100ms instead of 10 seconds; the browser queues the download synchronously on `a.click()` so the object URL is no longer needed after a few hundred milliseconds; for large video files (100MB+) this frees memory nearly 10 seconds sooner per download

### Memory

* **Playlist cache eviction** — `playlistCache` previously grew without bound; now capped at 50 entries using insertion-order eviction (oldest entry removed when the limit is exceeded); a session browsing 20 videos at 3 qualities each previously retained up to ~9MB of parsed playlist strings indefinitely

---

## v11.1 — Bug Fixes

* Fixed floating action button position overlapping the site's back button

---

## v11.2 — In-Place Video Swap

* Episode navigation no longer tears down and rebuilds the player overlay — when moving to the next or previous episode the video source is swapped in-place, keeping the overlay, controls, and state intact
* Eliminates the visible flash and layout shift that occurred when the overlay was destroyed and recreated on each episode change

---

## v12.0 — Site Redesign Compatibility

Skill-Capped replaced its `data-name`-attribute markup with hashed CSS-in-JS classes and a new syllabus/course-card layout. All DOM selectors were rewritten against the new structure:

* **Player detection** — `[data-name="Video Player Container"]` → `[data-player-object="true"]`
* **Video id extraction** — thumbnail URLs moved from `.../thumbnails/{id}/...` to two new shapes (`.../posters/{migration-folder}/{id}.jpg` and `.../videos/{id}/thumbnails/...`); both are now handled
* **Episode sidebar** — `[data-name="CourseOverviewVidCard"]` → `button[data-syllabus-lesson-row]`; `.current-video` → `[aria-current="step"]`; title/duration parsed from the row's `aria-label` instead of a bold/16px styled `<div>`
* **Bulk download simplified** — lesson rows now expose their real video id directly via the thumbnail, so bulk download fetches each episode by id instead of clicking through cards and polling for URL changes (faster and less fragile)
* **Browse page** — the old flat per-video row list (`BrVid Row Parent Course`, `BrVidRow-{id}`) no longer exists; browsing now goes straight from a course-level card to the first lesson. Inline Watch/Resume buttons now attach to `a[href*="/browse/course/"]` course cards instead
* Multi-lesson VOD review / smurf commentary *courses* reuse the same syllabus component as regular courses, so no separate handling was needed there
* Standalone commentary videos (`/lol/commentaries/{id}` — a single VOD review with no episode list) are a distinct, simpler page: added `/commentaries/{id}` to video-id-from-URL detection and an `isVideoPage()` check that recognizes this URL pattern even without the `[data-player-object]` DOM marker, plus a `document.title` fallback for title extraction since there's no syllabus heading on this page
* **Modal auto-dismiss** — the redesign introduced a `[data-name="Modal Background"]` popup that can appear over the page; it's now removed on refresh and force-closed (via its Close button, or removed directly) as soon as a `MutationObserver` sees it appear
* **Syllabus click hijacking** — lesson rows are now full-page-navigation links in the new markup, so clicking one no longer opens the custom overlay on its own; a capture-phase click listener on each `button[data-syllabus-lesson-row]` intercepts the click before React's own handler runs and opens the custom player instead (falls back to the site's own navigation if a video id can't be resolved). Guarded with `e.isTrusted` so the script's own synthetic `.click()` calls (used to sync the site's background state during in-overlay navigation) pass through instead of re-triggering the overlay
* CDN/stream URLs are unchanged (`d13z5uuzt1wkbz.cloudfront.net`) — only the surrounding page markup changed

### Fixed after code review

* Fixed a recursive overlay rebuild: `loadVideo()`'s background `cards[ci].click()` (to sync the site's own state) was re-entering the new syllabus-hijack handler, tearing down and rebuilding the just-updated overlay and leaving an orphaned HLS/video instance running. Fixed with the `e.isTrusted` guard above
* Removed a second, undebounced `MutationObserver` added for modal dismissal; merged into the existing single debounced observer (kept since v10.3) and consolidated with `dismissModal()`, which now tries the modal's own Close button before falling back to removing it directly
* Duration parsing in `parseLessonRow()` now matches `H:MM:SS` as well as `MM:SS`
* Bulk download no longer recurses synchronously when skipping an episode with no resolvable id

---

## v12.1 — Quality Switch Fix

* Fixed the quality selector fetching the playlist for the video id captured when the player first opened (`videoId`) instead of the currently-playing video (`currentVideoId`); switching quality after navigating to another episode in the same overlay was loading the wrong video's playlist

---

## v12.2 — FAB & Inline Button Positioning

* Moved the floating Watch/Resume button from `left: 50px` to `left: 280px` — it was overlapping the site's own back button
* Inline Watch/Resume buttons on browse-page course cards are now positioned `absolute` in the card's bottom-right corner instead of being appended next to the title, which had made them shift around with title length and wrap awkwardly on some cards

---

## v12.3 — Syllabus Title & Button Overlap Fixes

* **Wrong download filenames** — `parseLessonRow()` fell back to a lesson row's raw `textContent` whenever its `aria-label` didn't match the expected pattern; that text includes the row's aria-hidden episode-number badge with no separator, producing filenames like `The ADC Problem01.mp4` instead of `The ADC Problem.mp4`. The fallback now clones the row and strips all `[aria-hidden="true"]` elements (badge numbers, checkmarks) before reading the title
* **Overlapping Watch buttons on syllabus pages** — inline Watch/Resume buttons target any `a[href*="/browse/course/"]`, which is also the href pattern used by the small course-number nav tabs above a multi-course syllabus (e.g. `01 02 03 04`); attaching a button to each tab piled overlapping "Watch" pills on top of each other. Inline buttons are now skipped entirely on video/syllabus pages — the floating action button already provides a single Watch/Resume/Rewatch pill there
