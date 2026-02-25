(() => {
  const numberFormatter = new Intl.NumberFormat("en-US");
  const reducedMotionQuery =
    typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-reduced-motion: reduce)")
      : null;

  const mockClientShellState = {
    panelModes: {
      settlement: "populated",
      worldMap: "loading",
      eventFeed: "populated",
    },
    panels: {
      settlement: {
        title: "Cinderwatch Hold",
        stateOptions: ["loading", "populated"],
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
          },
        },
      },
      worldMap: {
        title: "Frontier Region Map",
        stateOptions: ["loading", "populated"],
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
        },
      },
      eventFeed: {
        title: "Dispatches & Alerts",
        stateOptions: ["loading", "populated"],
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
                title: "Scout report returned from Black Reed March",
                meta: "2m ago | Map | Placeholder content",
                priority: "high",
              },
              {
                title: "Granary upgrade reached 45% completion",
                meta: "8m ago | Settlement | Build queue",
                priority: "normal",
              },
              {
                title: "Road Wardens garrison upkeep reduced at home keep",
                meta: "14m ago | Military | Status effect",
                priority: "normal",
              },
              {
                title: "Neighboring ruin site detected activity spike",
                meta: "23m ago | World | Watchlist trigger",
                priority: "medium",
              },
              {
                title: "Trade cart request queued (placeholder workflow)",
                meta: "29m ago | Settlement | Logistics",
                priority: "normal",
              },
            ],
            queuedNotifications: [
              "Raid warning banner slot",
              "Alliance message drawer slot",
              "Tutorial prompt slot",
            ],
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

    refs.title.textContent = mode === "loading" ? `${panel.title} ${scenario.titleSuffix}` : panel.title;

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

    const priorityClassByValue = {
      high: " priority-high",
      medium: " priority-medium",
      normal: "",
    };

    const events = (scenario.events || [])
      .map((item) => {
        const priorityClass = priorityClassByValue[item.priority] || "";
        return `
          <li class="event-item${priorityClass}">
            <p class="event-item__title">${escapeHtml(item.title)}</p>
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
