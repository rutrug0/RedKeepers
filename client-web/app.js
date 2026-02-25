(() => {
  const numberFormatter = new Intl.NumberFormat("en-US");
  const reducedMotionQuery =
    typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-reduced-motion: reduce)")
      : null;
  const placeholderNarrativeSeedTemplates = Object.freeze({
    "civ_intro.cinder_throne_legates":
      "The Cinder Throne Legates hold the frontier by ash, ration, and decree. Their magistrates build roads before monuments, and their branded levies turn every settlement into a hard post that is costly to break.",
    "event.tick.passive_income":
      "{settlement_name} stores rise: +{food_gain} Food, +{wood_gain} Wood, +{stone_gain} Stone, +{iron_gain} Iron.",
    "event.buildings.upgrade_started":
      "{settlement_name}: work begins on {building_label} (Lv.{from_level} -> Lv.{to_level}).",
    "event.build.upgrade_started":
      "{settlement_name}: work begins on {building_label} (Lv.{from_level} -> Lv.{to_level}).",
    "event.units.training_started":
      "{settlement_name}: training begins for {quantity} {unit_label}.",
    "event.train.started":
      "{settlement_name}: training begins for {quantity} {unit_label}.",
    "event.units.upkeep_reduced_garrison":
      "{settlement_name}: garrison ration discipline reduces stationed troop upkeep.",
    "event.scout.dispatched":
      "{settlement_name}: scouts ride out toward {target_tile_label}.",
    "event.world.scout_report_hostile":
      "Scout report from {target_tile_label}: hostile movement sighted ({hostile_force_estimate}).",
    "event.settlement.name_assigned":
      "Surveyors record the new holding as {settlement_name}. The name enters the ledger.",
  });

  const mockClientShellState = {
    panelModes: {
      settlement: "populated",
      worldMap: "loading",
      eventFeed: "populated",
    },
    panels: {
      settlement: {
        title: "Cinderwatch Hold",
        stateOptions: ["loading", "populated", "empty", "error"],
        scenarios: {
          loading: {
            titleSuffix: "(Syncing)",
            resourceSlots: 4,
            queueSlots: 3,
            unitSlots: 4,
          },
          populated: {
            resources: [
              { label: "Timber", value: 1240, fill: 62 },
              { label: "Stone", value: 980, fill: 49 },
              { label: "Iron", value: 715, fill: 36 },
              { label: "Grain", value: 1860, fill: 78 },
            ],
            buildQueue: [
              { icon: "B1", label: "Granary Upgrade (Lv. 6)", progress: 45, eta: "08:14" },
              { icon: "B2", label: "Palisade Repair", progress: 12, eta: "19:30" },
              { icon: "B3", label: "Barracks Expansion (Lv. 4)", progress: 0, eta: "Queued" },
            ],
            garrison: [
              { unit: "Levy Spear", count: 120 },
              { unit: "Road Wardens", count: 48 },
              { unit: "Slingers", count: 64 },
              { unit: "Scout Riders", count: 12 },
            ],
            civIntro: {
              civId: "cinder_throne_legates",
              displayName: "Cinder Throne Legates",
              contentKey: "civ_intro.cinder_throne_legates",
            },
          },
          empty: {
            titleSuffix: "(Idle)",
            emptySummary:
              "No active work orders are in progress. Use placeholder controls to seed resource and queue records.",
            resourceHint: "No resource deltas are currently staged in this mock scenario.",
            queueHint: "No build upgrades queued.",
            garrisonHint: "No stationed unit entries.",
            civIntro: {
              civId: "cinder_throne_legates",
              displayName: "Cinder Throne Legates",
              contentKey: "civ_intro.cinder_throne_legates",
            },
          },
          error: {
            titleSuffix: "(Sync Error)",
            errorCode: "SETTLEMENT_SYNC_TIMEOUT",
            emptySummary:
              "Settlement placeholder payload could not be resolved from local mock transport.",
            resourceHint: "Resource ledger unavailable while sync is in error.",
            queueHint: "Build queue data unavailable while sync is in error.",
            garrisonHint: "Garrison snapshot unavailable while sync is in error.",
          },
        },
      },
      worldMap: {
        title: "Frontier Region Map",
        stateOptions: ["loading", "populated", "empty", "error"],
        scenarios: {
          loading: {
            coords: "-- / --",
            region: "Loading placeholder map...",
            selectedTile: {
              Type: "Syncing",
              Control: "Resolving",
              Travel: "Estimating",
            },
            legend: [
              { kind: "settlement", label: "Your Settlements" },
              { kind: "allied", label: "Friendly / Allied" },
              { kind: "hostile", label: "Hostile / Points of Interest" },
            ],
            actions: [
              "Send Scouts (placeholder)",
              "Plan Route (placeholder)",
              "Set Rally Marker (placeholder)",
            ],
          },
          populated: {
            coords: "412 / 198",
            region: "Black Reed March",
            markers: [
              { className: "settlement", label: "Your Keep", selected: true },
              { className: "allied", label: "Ally Camp", selected: false },
              { className: "hostile", label: "Ruin Site", selected: false },
            ],
            routes: [
              { className: "route-line--one" },
              { className: "route-line--two" },
            ],
            selectedTile: {
              Type: "Neutral Forest",
              Control: "Unclaimed",
              Travel: "14m from Keep",
            },
            legend: [
              { kind: "settlement", label: "Your Settlements" },
              { kind: "allied", label: "Friendly / Allied" },
              { kind: "hostile", label: "Hostile / Points of Interest" },
            ],
            actions: [
              "Send Scouts (placeholder)",
              "Plan Route (placeholder)",
              "Set Rally Marker (placeholder)",
            ],
          },
          empty: {
            coords: "-- / --",
            region: "No discovered frontier tiles",
            selectedTile: {
              Type: "No Selection",
              Control: "N/A",
              Travel: "N/A",
            },
            legend: [
              { kind: "settlement", label: "Your Settlements" },
              { kind: "allied", label: "Friendly / Allied" },
              { kind: "hostile", label: "Hostile / Points of Interest" },
            ],
            actions: [
              "Send Scouts (placeholder)",
              "Queue Survey (placeholder)",
              "Drop Rally Marker (placeholder)",
            ],
            emptySummary:
              "No marker or route placeholders are active in this map scenario.",
            selectedTileHint: "Select a placeholder tile after mock markers are injected.",
          },
          error: {
            coords: "-- / --",
            region: "Map telemetry unavailable",
            selectedTile: {
              Type: "Unavailable",
              Control: "Unknown",
              Travel: "Unavailable",
            },
            legend: [
              { kind: "settlement", label: "Your Settlements" },
              { kind: "allied", label: "Friendly / Allied" },
              { kind: "hostile", label: "Hostile / Points of Interest" },
            ],
            actions: ["Retry Sync (placeholder)", "Open Diagnostics (placeholder)"],
            errorCode: "MAP_STREAM_OFFLINE",
            emptySummary:
              "World map placeholder stream failed to load. Map interactions stay disabled in this mock error state.",
            selectedTileHint: "Tile inspection is suspended while the map stream is offline.",
          },
        },
      },
      eventFeed: {
        title: "Dispatches & Alerts",
        stateOptions: ["loading", "populated", "empty", "error"],
        scenarios: {
          loading: {
            filters: ["All", "Settlement", "Military", "World"],
            selectedFilter: "All",
            eventSlots: 5,
            notificationSlots: 3,
          },
          populated: {
            filters: ["All", "Settlement", "Military", "World"],
            selectedFilter: "All",
            events: [
              {
                contentKey: "event.tick.passive_income",
                tokens: {
                  settlement_name: "Cinderwatch Hold",
                  food_gain: 16,
                  wood_gain: 10,
                  stone_gain: 6,
                  iron_gain: 5,
                },
                meta: "2m ago | Economy | Tick",
                priority: "high",
              },
              {
                contentKey: "event.build.upgrade_started",
                tokens: {
                  settlement_name: "Cinderwatch Hold",
                  building_label: "Granary Upgrade",
                  from_level: 5,
                  to_level: 6,
                },
                meta: "8m ago | Settlement | Build loop",
                priority: "normal",
              },
              {
                contentKey: "event.train.started",
                tokens: {
                  settlement_name: "Cinderwatch Hold",
                  quantity: 12,
                  unit_label: "Road Wardens",
                },
                meta: "16m ago | Military | Train loop",
                priority: "normal",
              },
              {
                contentKey: "event.scout.dispatched",
                tokens: {
                  settlement_name: "Cinderwatch Hold",
                  target_tile_label: "Black Reed March",
                },
                meta: "21m ago | World | Scout loop",
                priority: "normal",
              },
              {
                contentKey: "event.units.upkeep_reduced_garrison",
                tokens: {
                  settlement_name: "Cinderwatch Hold",
                },
                meta: "29m ago | Military | Legacy module key support",
                priority: "normal",
              },
            ],
            queuedNotifications: [
              "Raid warning banner slot",
              "Alliance message drawer slot",
              "Tutorial prompt slot",
            ],
          },
          empty: {
            filters: ["All", "Settlement", "Military", "World"],
            selectedFilter: "All",
            emptySummary:
              "No placeholder dispatches are queued. Trigger settlement/map actions to generate feed rows.",
            notificationSummary: "Notification queue is clear.",
          },
          error: {
            filters: ["All", "Settlement", "Military", "World"],
            selectedFilter: "All",
            errorCode: "FEED_CACHE_READ_FAILED",
            emptySummary:
              "Event feed placeholder records failed to load from local mock cache.",
            notificationSummary:
              "Notification queue unavailable while feed cache is in an error state.",
          },
        },
      },
    },
  };

  const panelRefs = {
    settlement: {
      title: document.getElementById("settlement-title"),
      content: document.getElementById("settlement-panel-content"),
      controls: document.getElementById("settlement-panel-state-controls"),
    },
    worldMap: {
      title: document.getElementById("worldmap-title"),
      content: document.getElementById("worldmap-panel-content"),
      controls: document.getElementById("worldmap-panel-state-controls"),
    },
    eventFeed: {
      title: document.getElementById("event-feed-title"),
      content: document.getElementById("event-feed-panel-content"),
      controls: document.getElementById("event-feed-panel-state-controls"),
    },
  };

  const escapeHtml = (value) =>
    String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const formatNumber = (value) => numberFormatter.format(value);

  const clampPercent = (value) => Math.max(0, Math.min(100, Number(value) || 0));
  const fillTemplateTokens = (template, tokens = {}) =>
    String(template).replace(/\{([a-z0-9_]+)\}/gi, (match, tokenName) =>
      Object.prototype.hasOwnProperty.call(tokens, tokenName) ? String(tokens[tokenName]) : match,
    );
  const getNarrativeTemplateWithFallback = (contentKey) => {
    if (!contentKey) {
      return "";
    }

    const candidates = [];
    const addCandidate = (candidate) => {
      if (candidate && !candidates.includes(candidate)) {
        candidates.push(candidate);
      }
    };

    addCandidate(contentKey);

    if (contentKey.startsWith("event.buildings.")) {
      addCandidate(contentKey.replace("event.buildings.", "event.build."));
    } else if (contentKey.startsWith("event.units.")) {
      addCandidate(contentKey.replace("event.units.", "event.train."));
    } else if (contentKey.startsWith("event.world.scout_")) {
      addCandidate(contentKey.replace("event.world.", "event.scout."));
    }

    if (contentKey.startsWith("event.build.")) {
      addCandidate(contentKey.replace("event.build.", "event.buildings."));
    } else if (contentKey.startsWith("event.train.")) {
      addCandidate(contentKey.replace("event.train.", "event.units."));
    } else if (contentKey.startsWith("event.scout.")) {
      addCandidate(contentKey.replace("event.scout.", "event.world.scout_"));
    }

    return candidates.find((key) => placeholderNarrativeSeedTemplates[key]);
  };
  const getNarrativeText = (contentKey, tokens) => {
    const template = getNarrativeTemplateWithFallback(contentKey);

    if (!template) {
      return contentKey ? `[Missing placeholder template: ${contentKey}]` : "";
    }

    return fillTemplateTokens(template, tokens);
  };

  const getPanelScenario = (panelKey) => {
    const panel = mockClientShellState.panels[panelKey];
    const mode = mockClientShellState.panelModes[panelKey];
    return {
      panel,
      mode,
      scenario: panel.scenarios[mode],
    };
  };

  const renderStateControls = (panelKey) => {
    const panel = mockClientShellState.panels[panelKey];
    const currentMode = mockClientShellState.panelModes[panelKey];
    const target = panelRefs[panelKey].controls;

    if (!target) {
      return;
    }

    const buttons = panel.stateOptions
      .map((mode) => {
        const isActive = mode === currentMode;
        const label = mode.charAt(0).toUpperCase() + mode.slice(1);

        return `
          <button
            type="button"
            class="mock-state-btn${isActive ? " is-active" : ""}"
            data-mock-panel="${panelKey}"
            data-mock-mode="${mode}"
            aria-pressed="${String(isActive)}"
          >${escapeHtml(label)}</button>
        `;
      })
      .join("");

    target.innerHTML = `<span class="mock-state-label">Mock state</span>${buttons}`;
  };

  const renderSettlementPanel = () => {
    const { panel, mode, scenario } = getPanelScenario("settlement");
    const refs = panelRefs.settlement;

    if (!refs.content || !refs.title) {
      return;
    }

    refs.title.textContent = scenario.titleSuffix ? `${panel.title} ${scenario.titleSuffix}` : panel.title;

    if (mode === "loading") {
      const resourceCards = Array.from({ length: scenario.resourceSlots })
        .map(
          () => `
            <article class="skeleton-card" aria-hidden="true">
              <div class="skeleton-line"></div>
              <div class="skeleton-line"></div>
              <div class="wire-bar"><span style="width: 35%"></span></div>
            </article>
          `,
        )
        .join("");

      const queueRows = Array.from({ length: scenario.queueSlots })
        .map(
          () => `
            <li class="skeleton-row" aria-hidden="true">
              <span class="wire-icon"></span>
              <div class="skeleton-row__body">
                <div class="skeleton-line"></div>
                <div class="skeleton-line skeleton-line--sm"></div>
              </div>
              <div class="skeleton-line" style="width: 52px;"></div>
            </li>
          `,
        )
        .join("");

      const unitRows = Array.from({ length: scenario.unitSlots })
        .map(
          () => `
            <div class="unit-row" aria-hidden="true">
              <span class="wire-silhouette"></span>
              <div class="skeleton-line"></div>
              <div class="skeleton-line" style="width: 36px;"></div>
            </div>
          `,
        )
        .join("");

      refs.content.innerHTML = `
        <div class="stack">
          <section class="subpanel">
            <h3>Resource Ledger</h3>
            <p class="loading-copy">Loading placeholder resources from local mock state...</p>
            <div class="resource-grid" aria-label="Loading resource placeholders">${resourceCards}</div>
          </section>
          <section class="subpanel">
            <div class="subpanel__head">
              <h3>Build Queue</h3>
              <button type="button" class="ghost-btn">Manage</button>
            </div>
            <p class="loading-copy">Queue items syncing (mock loading state).</p>
            <ul class="wire-list" aria-label="Loading build queue placeholders">${queueRows}</ul>
          </section>
          <section class="subpanel">
            <div class="subpanel__head">
              <h3>Garrison Snapshot</h3>
              <button type="button" class="ghost-btn">Review</button>
            </div>
            <div class="unit-rows" aria-label="Loading garrison placeholders">${unitRows}</div>
          </section>
          <section class="subpanel compact">
            <h3>Civilization Briefing</h3>
            <p class="loading-copy">Loading placeholder civ intro copy from stable mock content keys...</p>
            <div aria-hidden="true">
              <div class="skeleton-line" style="width: 42%;"></div>
              <div class="skeleton-line"></div>
              <div class="skeleton-line" style="width: 88%;"></div>
            </div>
          </section>
        </div>
      `;

      return;
    }

    if (mode === "empty") {
      const civIntroTitle = scenario.civIntro?.displayName || "Civilization";
      const civIntroText = getNarrativeText(scenario.civIntro?.contentKey, scenario.civIntro?.tokens);

      refs.content.innerHTML = `
        <div class="stack">
          <section class="subpanel compact">
            <h3>Settlement Status</h3>
            <div class="wire-empty">${escapeHtml(scenario.emptySummary || "No active settlement data in this placeholder state.")}</div>
          </section>
          <section class="subpanel">
            <h3>Resource Ledger</h3>
            <div class="wire-empty">${escapeHtml(scenario.resourceHint || "No resources recorded.")}</div>
          </section>
          <section class="subpanel">
            <div class="subpanel__head">
              <h3>Build Queue</h3>
              <button type="button" class="ghost-btn">Manage</button>
            </div>
            <div class="wire-empty">${escapeHtml(scenario.queueHint || "No build queue items.")}</div>
          </section>
          <section class="subpanel">
            <div class="subpanel__head">
              <h3>Garrison Snapshot</h3>
              <button type="button" class="ghost-btn">Review</button>
            </div>
            <div class="wire-empty">${escapeHtml(scenario.garrisonHint || "No unit entries available.")}</div>
          </section>
          <section class="subpanel compact">
            <h3>Civilization Briefing</h3>
            <p><strong>${escapeHtml(civIntroTitle)}</strong></p>
            <p>${escapeHtml(civIntroText)}</p>
          </section>
        </div>
      `;

      return;
    }

    if (mode === "error") {
      refs.content.innerHTML = `
        <div class="stack">
          <section class="subpanel compact">
            <h3>Settlement Status</h3>
            <div class="wire-empty">
              <strong>Placeholder error: ${escapeHtml(scenario.errorCode || "UNKNOWN_SETTLEMENT_ERROR")}</strong><br />
              ${escapeHtml(scenario.emptySummary || "Settlement data could not be loaded.")}
            </div>
          </section>
          <section class="subpanel">
            <h3>Resource Ledger</h3>
            <div class="wire-empty">${escapeHtml(scenario.resourceHint || "Resource ledger unavailable.")}</div>
          </section>
          <section class="subpanel">
            <div class="subpanel__head">
              <h3>Build Queue</h3>
              <button type="button" class="ghost-btn">Manage</button>
            </div>
            <div class="wire-empty">${escapeHtml(scenario.queueHint || "Build queue unavailable.")}</div>
          </section>
          <section class="subpanel">
            <div class="subpanel__head">
              <h3>Garrison Snapshot</h3>
              <button type="button" class="ghost-btn">Review</button>
            </div>
            <div class="wire-empty">${escapeHtml(scenario.garrisonHint || "Garrison data unavailable.")}</div>
          </section>
        </div>
      `;

      return;
    }

    const resources = scenario.resources
      .map(
        (resource) => `
          <article class="resource-card">
            <p class="resource-card__label">${escapeHtml(resource.label)}</p>
            <p class="resource-card__value">${escapeHtml(formatNumber(resource.value))}</p>
            <div class="wire-bar"><span style="width:${clampPercent(resource.fill)}%"></span></div>
          </article>
        `,
      )
      .join("");

    const buildQueue = scenario.buildQueue
      .map(
        (item) => `
          <li>
            <span class="wire-icon" aria-hidden="true">${escapeHtml(item.icon)}</span>
            <div class="wire-list__body">
              <p>${escapeHtml(item.label)}</p>
              <div class="wire-bar"><span style="width:${clampPercent(item.progress)}%"></span></div>
            </div>
            <span class="wire-time">${escapeHtml(item.eta)}</span>
          </li>
        `,
      )
      .join("");

    const garrison = scenario.garrison
      .map(
        (unit) => `
          <div class="unit-row">
            <span class="wire-silhouette" aria-hidden="true"></span>
            <span>${escapeHtml(unit.unit)}</span>
            <span>${escapeHtml(formatNumber(unit.count))}</span>
          </div>
        `,
      )
      .join("");
    const civIntroTitle = scenario.civIntro?.displayName || "Civilization";
    const civIntroText = getNarrativeText(scenario.civIntro?.contentKey, scenario.civIntro?.tokens);

    refs.content.innerHTML = `
      <div class="stack">
        <section class="subpanel">
          <h3>Resource Ledger</h3>
          <div class="resource-grid" aria-label="Mock resource cards">${resources}</div>
        </section>
        <section class="subpanel">
          <div class="subpanel__head">
            <h3>Build Queue</h3>
            <button type="button" class="ghost-btn">Manage</button>
          </div>
          <ul class="wire-list" aria-label="Mock build queue">${buildQueue}</ul>
        </section>
        <section class="subpanel">
          <div class="subpanel__head">
            <h3>Garrison Snapshot</h3>
            <button type="button" class="ghost-btn">Review</button>
          </div>
          <div class="unit-rows" aria-label="Mock unit rows">${garrison}</div>
        </section>
        <section class="subpanel compact">
          <h3>Civilization Briefing</h3>
          <p class="subpanel-note">Placeholder intro copy is keyed to the narrative seed pack.</p>
          <p><strong>${escapeHtml(civIntroTitle)}</strong></p>
          <p>${escapeHtml(civIntroText)}</p>
        </section>
      </div>
    `;
  };

  const renderMapPanel = () => {
    const { panel, mode, scenario } = getPanelScenario("worldMap");
    const refs = panelRefs.worldMap;

    if (!refs.content || !refs.title) {
      return;
    }

    refs.title.textContent = panel.title;

    const selectedFields = Object.entries(scenario.selectedTile || {})
      .map(
        ([label, value]) => `
          <div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>
        `,
      )
      .join("");

    const legendItems = (scenario.legend || [])
      .map(
        (item) => `
          <li><span class="legend-swatch ${escapeHtml(item.kind)}"></span>${escapeHtml(item.label)}</li>
        `,
      )
      .join("");

    const actionItems = (scenario.actions || [])
      .map((label) => `<button type="button" class="action-btn">${escapeHtml(label)}</button>`)
      .join("");

    if (mode === "loading") {
      refs.content.innerHTML = `
        <div class="map-layout">
          <div class="map-stage is-loading" role="group" aria-label="Loading placeholder world map viewport">
            <div class="map-overlay map-overlay--top-left">
              <span class="chip chip--small">Coords: ${escapeHtml(scenario.coords)}</span>
              <span class="chip chip--small">Region: ${escapeHtml(scenario.region)}</span>
            </div>
            <div class="map-grid" aria-hidden="true"></div>
            <div class="map-loading-overlay" aria-hidden="true">
              <div class="map-loading-card">
                <div class="skeleton-line skeleton-line--chip"></div>
                <div class="skeleton-line"></div>
                <div class="skeleton-line" style="width: 72%;"></div>
              </div>
            </div>
            <div class="map-overlay map-overlay--bottom-right">
              <div class="map-controls" aria-label="Placeholder map controls">
                <button type="button" class="control-btn" aria-label="Zoom in">+</button>
                <button type="button" class="control-btn" aria-label="Zoom out">-</button>
                <button type="button" class="control-btn" aria-label="Center on settlement">O</button>
              </div>
            </div>
          </div>
          <aside class="map-side" aria-label="Map side panels">
            <section class="subpanel compact">
              <h3>Selected Tile</h3>
              <p class="loading-copy">Loading selected tile preview...</p>
              <div class="wire-fields">${selectedFields}</div>
            </section>
            <section class="subpanel compact">
              <h3>Legend (Placeholder)</h3>
              <ul class="legend-list">${legendItems}</ul>
            </section>
            <section class="subpanel compact">
              <h3>Map Actions</h3>
              <p class="loading-copy">Actions remain placeholder-only during mock loading.</p>
              <div class="stack-sm">${actionItems}</div>
            </section>
          </aside>
        </div>
      `;

      return;
    }

    if (mode === "empty") {
      refs.content.innerHTML = `
        <div class="map-layout">
          <div class="map-stage" role="group" aria-label="Empty placeholder world map viewport">
            <div class="map-overlay map-overlay--top-left">
              <span class="chip chip--small">Coords: ${escapeHtml(scenario.coords)}</span>
              <span class="chip chip--small">Region: ${escapeHtml(scenario.region)}</span>
            </div>
            <div class="map-grid" aria-hidden="true"></div>
            <div class="map-loading-overlay" aria-hidden="true">
              <div class="map-loading-card">
                <p class="subpanel-note">${escapeHtml(scenario.emptySummary || "No map marker placeholders are available.")}</p>
              </div>
            </div>
            <div class="map-overlay map-overlay--bottom-right">
              <div class="map-controls" aria-label="Placeholder map controls">
                <button type="button" class="control-btn" aria-label="Zoom in">+</button>
                <button type="button" class="control-btn" aria-label="Zoom out">-</button>
                <button type="button" class="control-btn" aria-label="Center on settlement">O</button>
              </div>
            </div>
          </div>
          <aside class="map-side" aria-label="Map side panels">
            <section class="subpanel compact">
              <h3>Selected Tile</h3>
              <p class="subpanel-note">${escapeHtml(scenario.selectedTileHint || "No tile selected.")}</p>
              <div class="wire-fields">${selectedFields}</div>
            </section>
            <section class="subpanel compact">
              <h3>Legend (Placeholder)</h3>
              <ul class="legend-list">${legendItems}</ul>
            </section>
            <section class="subpanel compact">
              <h3>Map Actions</h3>
              <div class="stack-sm">${actionItems}</div>
            </section>
          </aside>
        </div>
      `;

      return;
    }

    if (mode === "error") {
      refs.content.innerHTML = `
        <div class="map-layout">
          <div class="map-stage is-loading" role="group" aria-label="Error placeholder world map viewport">
            <div class="map-overlay map-overlay--top-left">
              <span class="chip chip--small">Coords: ${escapeHtml(scenario.coords)}</span>
              <span class="chip chip--small">Region: ${escapeHtml(scenario.region)}</span>
            </div>
            <div class="map-grid" aria-hidden="true"></div>
            <div class="map-loading-overlay" aria-hidden="true">
              <div class="map-loading-card">
                <p class="subpanel-note"><strong>Placeholder error: ${escapeHtml(scenario.errorCode || "UNKNOWN_MAP_ERROR")}</strong></p>
                <p class="subpanel-note">${escapeHtml(scenario.emptySummary || "Map stream unavailable.")}</p>
              </div>
            </div>
            <div class="map-overlay map-overlay--bottom-right">
              <div class="map-controls" aria-label="Placeholder map controls">
                <button type="button" class="control-btn" aria-label="Zoom in">+</button>
                <button type="button" class="control-btn" aria-label="Zoom out">-</button>
                <button type="button" class="control-btn" aria-label="Center on settlement">O</button>
              </div>
            </div>
          </div>
          <aside class="map-side" aria-label="Map side panels">
            <section class="subpanel compact">
              <h3>Selected Tile</h3>
              <p class="subpanel-note">${escapeHtml(scenario.selectedTileHint || "Tile inspection unavailable.")}</p>
              <div class="wire-fields">${selectedFields}</div>
            </section>
            <section class="subpanel compact">
              <h3>Legend (Placeholder)</h3>
              <ul class="legend-list">${legendItems}</ul>
            </section>
            <section class="subpanel compact">
              <h3>Map Actions</h3>
              <div class="stack-sm">${actionItems}</div>
            </section>
          </aside>
        </div>
      `;

      return;
    }

    const markers = (scenario.markers || [])
      .map(
        (marker) => `
          <div class="map-marker ${escapeHtml(marker.className)}${marker.selected ? " is-selected" : ""}">${escapeHtml(marker.label)}</div>
        `,
      )
      .join("");

    const routes = (scenario.routes || [])
      .map((route) => `<div class="route-line ${escapeHtml(route.className)}"></div>`)
      .join("");

    refs.content.innerHTML = `
      <div class="map-layout">
        <div class="map-stage" role="group" aria-label="Placeholder world map viewport with grid and marker blocks">
          <div class="map-overlay map-overlay--top-left">
            <span class="chip chip--small">Coords: ${escapeHtml(scenario.coords)}</span>
            <span class="chip chip--small">Region: ${escapeHtml(scenario.region)}</span>
          </div>
          <div class="map-grid" aria-hidden="true">
            ${markers}
            ${routes}
          </div>
          <div class="map-overlay map-overlay--bottom-right">
            <div class="map-controls" aria-label="Placeholder map controls">
              <button type="button" class="control-btn" aria-label="Zoom in">+</button>
              <button type="button" class="control-btn" aria-label="Zoom out">-</button>
              <button type="button" class="control-btn" aria-label="Center on settlement">O</button>
            </div>
          </div>
        </div>
        <aside class="map-side" aria-label="Map side panels">
          <section class="subpanel compact">
            <h3>Selected Tile</h3>
            <p class="subpanel-note">Selection state is driven by mock marker data.</p>
            <div class="wire-fields">${selectedFields}</div>
          </section>
          <section class="subpanel compact">
            <h3>Legend (Placeholder)</h3>
            <ul class="legend-list">${legendItems}</ul>
          </section>
          <section class="subpanel compact">
            <h3>Map Actions</h3>
            <div class="stack-sm">${actionItems}</div>
          </section>
        </aside>
      </div>
    `;
  };

  const renderEventPanel = () => {
    const { panel, mode, scenario } = getPanelScenario("eventFeed");
    const refs = panelRefs.eventFeed;

    if (!refs.content || !refs.title) {
      return;
    }

    refs.title.textContent = panel.title;

    const filters = (scenario.filters || [])
      .map((filter) => {
        const isSelected = filter === scenario.selectedFilter;
        return `<button type="button" class="segment${isSelected ? " is-selected" : ""}">${escapeHtml(filter)}</button>`;
      })
      .join("");

    if (mode === "loading") {
      const eventSlots = Array.from({ length: scenario.eventSlots })
        .map(
          () => `
            <li class="skeleton-event" aria-hidden="true">
              <div class="skeleton-line"></div>
              <div class="skeleton-line"></div>
            </li>
          `,
        )
        .join("");

      const notificationSlots = Array.from({ length: scenario.notificationSlots })
        .map(
          () => `
            <div class="wire-tile" aria-hidden="true">
              <div class="skeleton-line" style="width: 90%;"></div>
            </div>
          `,
        )
        .join("");

      refs.content.innerHTML = `
        <div class="stack">
          <section class="subpanel compact">
            <h3>Feed Controls</h3>
            <div class="segment-row" role="group" aria-label="Loading event filters">${filters}</div>
          </section>
          <section class="subpanel">
            <h3>Recent Events</h3>
            <p class="loading-copy">Loading event entries from local mock state...</p>
            <ol class="event-list" aria-label="Loading event feed placeholders">${eventSlots}</ol>
          </section>
          <section class="subpanel compact">
            <h3>Queued Notifications</h3>
            <div class="wire-tiles">${notificationSlots}</div>
          </section>
        </div>
      `;

      return;
    }

    if (mode === "empty") {
      refs.content.innerHTML = `
        <div class="stack">
          <section class="subpanel compact">
            <h3>Feed Controls</h3>
            <div class="segment-row" role="group" aria-label="Mock event filters">${filters}</div>
          </section>
          <section class="subpanel">
            <h3>Recent Events</h3>
            <div class="wire-empty">${escapeHtml(scenario.emptySummary || "No event feed entries are available.")}</div>
          </section>
          <section class="subpanel compact">
            <h3>Queued Notifications</h3>
            <div class="wire-empty">${escapeHtml(scenario.notificationSummary || "No notifications queued.")}</div>
          </section>
        </div>
      `;

      return;
    }

    if (mode === "error") {
      refs.content.innerHTML = `
        <div class="stack">
          <section class="subpanel compact">
            <h3>Feed Controls</h3>
            <div class="segment-row" role="group" aria-label="Mock event filters">${filters}</div>
          </section>
          <section class="subpanel">
            <h3>Recent Events</h3>
            <div class="wire-empty">
              <strong>Placeholder error: ${escapeHtml(scenario.errorCode || "UNKNOWN_EVENT_FEED_ERROR")}</strong><br />
              ${escapeHtml(scenario.emptySummary || "Event feed unavailable in this mock state.")}
            </div>
          </section>
          <section class="subpanel compact">
            <h3>Queued Notifications</h3>
            <div class="wire-empty">${escapeHtml(scenario.notificationSummary || "Notification queue unavailable.")}</div>
          </section>
        </div>
      `;

      return;
    }

    const priorityClassByValue = {
      high: " priority-high",
      medium: " priority-medium",
      normal: "",
    };

    const events = (scenario.events || [])
      .map((item) => {
        const priorityClass = priorityClassByValue[item.priority] || "";
        const title = item.contentKey
          ? getNarrativeText(item.contentKey, item.tokens)
          : item.title || "[Missing event title]";
        return `
          <li class="event-item${priorityClass}"${item.contentKey ? ` data-content-key="${escapeHtml(item.contentKey)}"` : ""}>
            <p class="event-item__title">${escapeHtml(title)}</p>
            <p class="event-item__meta">${escapeHtml(item.meta)}</p>
          </li>
        `;
      })
      .join("");

    const notifications = (scenario.queuedNotifications || [])
      .map((item) => `<div class="wire-tile">${escapeHtml(item)}</div>`)
      .join("");

    refs.content.innerHTML = `
      <div class="stack">
        <section class="subpanel compact">
          <h3>Feed Controls</h3>
          <div class="segment-row" role="group" aria-label="Mock event filters">${filters}</div>
        </section>
        <section class="subpanel">
          <h3>Recent Events</h3>
          <ol class="event-list" aria-label="Mock event feed entries">${events}</ol>
        </section>
        <section class="subpanel compact">
          <h3>Queued Notifications</h3>
          <div class="wire-tiles">${notifications}</div>
        </section>
      </div>
    `;
  };

  const renderPanels = () => {
    renderStateControls("settlement");
    renderStateControls("worldMap");
    renderStateControls("eventFeed");

    renderSettlementPanel();
    renderMapPanel();
    renderEventPanel();
  };

  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-mock-panel][data-mock-mode]");

    if (!button) {
      return;
    }

    const panelKey = button.getAttribute("data-mock-panel");
    const mode = button.getAttribute("data-mock-mode");
    const panel = panelKey ? mockClientShellState.panels[panelKey] : null;

    if (!panel || !mode || !panel.stateOptions.includes(mode)) {
      return;
    }

    mockClientShellState.panelModes[panelKey] = mode;
    renderPanels();

    const replacementButton = document.querySelector(
      `[data-mock-panel="${panelKey}"][data-mock-mode="${mode}"]`,
    );

    if (replacementButton instanceof HTMLButtonElement) {
      replacementButton.focus({ preventScroll: true });
    }
  });

  renderPanels();

  const tabs = Array.from(document.querySelectorAll(".region-tab"));

  if (tabs.length === 0) {
    return;
  }

  const moveFocusToPanel = (tab) => {
    const targetId = tab.getAttribute("data-target");
    const panel = targetId ? document.getElementById(targetId) : null;

    if (!panel) {
      return;
    }

    tabs.forEach((item) => {
      const isActive = item === tab;
      item.classList.toggle("is-active", isActive);
      item.setAttribute("aria-selected", String(isActive));
      item.tabIndex = isActive ? 0 : -1;
    });

    try {
      panel.focus({ preventScroll: true });
    } catch {
      panel.focus();
    }

    panel.scrollIntoView({
      behavior: reducedMotionQuery?.matches ? "auto" : "smooth",
      block: "start",
    });
  };

  tabs.forEach((tab, index) => {
    tab.tabIndex = index === 0 ? 0 : -1;

    tab.addEventListener("click", () => moveFocusToPanel(tab));

    tab.addEventListener("keydown", (event) => {
      const currentIndex = tabs.indexOf(tab);

      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        event.preventDefault();
        const next = tabs[(currentIndex + 1) % tabs.length];
        next.focus();
      }

      if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        event.preventDefault();
        const prev = tabs[(currentIndex - 1 + tabs.length) % tabs.length];
        prev.focus();
      }

      if (event.key === "Home") {
        event.preventDefault();
        tabs[0].focus();
      }

      if (event.key === "End") {
        event.preventDefault();
        tabs[tabs.length - 1].focus();
      }

      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        moveFocusToPanel(tab);
      }
    });
  });

  // Keep region tab state in sync with reading position on scroll.
  const panels = tabs
    .map((tab) => document.getElementById(tab.getAttribute("data-target") || ""))
    .filter(Boolean);

  if ("IntersectionObserver" in window && panels.length > 0) {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

        if (!visible) {
          return;
        }

        const matchingTab = tabs.find(
          (tab) => tab.getAttribute("data-target") === visible.target.id,
        );

        if (!matchingTab) {
          return;
        }

        tabs.forEach((item) => {
          const isActive = item === matchingTab;
          item.classList.toggle("is-active", isActive);
          item.setAttribute("aria-selected", String(isActive));
          item.tabIndex = isActive ? 0 : -1;
        });
      },
      {
        rootMargin: "-20% 0px -55% 0px",
        threshold: [0.15, 0.35, 0.5],
      },
    );

    panels.forEach((panelElement) => observer.observe(panelElement));
  }
})();
