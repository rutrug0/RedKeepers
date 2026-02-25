# Client Cross-Platform Strategy

RedKeepers will be web-first, then packaged for Steam and Android.

## Initial Direction

- Primary client: web application (desktop-first with responsive mobile support)
- Steam early path: desktop wrapper around web app
- Android early path: WebView/Capacitor wrapper around web app

This preserves fast iteration while deferring native optimization.

## M1 Packaging Decision Note (RK-M1-0002)

This note documents early packaging options, constraints, and default recommendations for the web-first client.

## Steam Path (Early)

### Options Considered

- Tauri desktop wrapper hosting the web client
- Electron desktop wrapper hosting the web client
- Native game client rewrite (deferred; out of M1 scope)

### Constraints

- Steam build pipeline expects installable desktop binaries (Windows minimum; Linux/macOS optional by release plan)
- Steam-specific features (achievements, rich presence, cloud saves, overlay behavior) may require wrapper-side Steamworks integration later
- Desktop shell must handle windowing, file paths, logs/crash reporting, and basic local storage consistently
- Web-only assumptions can break in packaged mode (CORS, `file://` vs local server hosting, deep links, patch/update flow)
- Installer size and memory overhead matter for low-friction early adoption

### Tradeoffs

- Tauri: smaller runtime and lower memory footprint; stronger fit for a web-first shell, but some integrations may require Rust-side work
- Electron: mature ecosystem and broad plugin examples; faster for some desktop integrations, but heavier runtime/package size
- Native rewrite: best long-term platform control/performance, but slowest iteration and highest staffing cost now

### Recommended Default (Steam)

- Default to `Tauri` wrapper for M1/M2 desktop packaging.
- Keep Steam-specific integrations optional behind a wrapper adapter so the web app remains runnable in browsers.
- Use Electron only if a required desktop or Steam integration proves impractical in Tauri during prototype validation.

## Android Path (Early)

### Options Considered

- Capacitor wrapper (embedded WebView + native bridge)
- Minimal Android WebView shell (custom wrapper without Capacitor)
- Trusted Web Activity (PWA-first Android shell)
- Native Android client rewrite (deferred; out of M1 scope)

### Constraints

- Touch-first UX requirements: safe areas, virtual keyboard behavior, orientation handling, and back-button navigation
- WebView API support varies by Android version/vendor; device testing is required for input/audio/performance edge cases
- Store distribution may require native hooks over time (notifications, intents, analytics, crash reporting, file access)
- Packaging strategy must support a clear update path (store updates for shell, web deploys for content/UI)
- Performance budgets are tighter on low-end devices; wrapper overhead and asset-loading patterns matter

### Tradeoffs

- Capacitor: fastest path to packaged Android app with a standard plugin bridge and future native extensibility
- Custom WebView shell: smallest dependency surface, but higher maintenance cost for lifecycle/navigation/plugin plumbing
- TWA: simplest for a pure PWA, but weaker fit when native hooks or tighter runtime control are needed
- Native rewrite: best device-level control, but incompatible with current fast-iteration goals

### Recommended Default (Android)

- Default to `Capacitor` for the first Android package.
- Ship the same responsive web client inside the wrapper and isolate native calls behind a small bridge layer.
- Revisit native Android only after usage data shows WebView performance or platform integration limits are blocking.

## Cross-Platform Default Summary

- Web app remains the primary product and source of truth for UI/game client behavior.
- Steam default: `Tauri` desktop wrapper.
- Android default: `Capacitor` wrapper.
- Defer native rewrites until measurable requirements justify the cost.
