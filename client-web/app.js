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
    "event.tick.passive_gain_success":
      "{settlement_name}: the harvest cycle clears after {duration_ms}ms, and stores are restocked without incident.",
    "event.tick.passive_gain_reasoned":
      "{settlement_name}: tick logic resolved with {reason_codes} over {duration_ms}ms.",
    "event.tick.passive_gain_stalled":
      "{settlement_name}: this {duration_ms}ms tick produced no gain; the ledger held steady under poor harvest timing.",
    "event.tick.passive_gain_capped":
      "{settlement_name}: storage limits clipped this tick, and excess yield is marked as waste.",
    "event.buildings.upgrade_started":
      "{settlement_name}: work begins on {building_label} (Lv.{from_level} -> Lv.{to_level}).",
    "event.build.upgrade_started":
      "{settlement_name}: work begins on {building_label} (Lv.{from_level} -> Lv.{to_level}).",
    "event.build.upgrade_completed":
      "{settlement_name}: {building_label} reaches Lv.{new_level}. Crews return to regular duty.",
    "event.build.success":
      "{settlement_name}: work begins on {building_label} (Lv.{from_level} -> Lv.{to_level}).",
    "event.build.failure_insufficient_resources":
      "{building_id}: upgrade halted. Missing stores {missing_resources_by_id}; needed {required_cost_by_id}, on hand {available_stock_by_id}.",
    "event.build.failure_cooldown":
      "{building_id}: work crews are still turning to complete prior orders; new orders resume at {cooldown_ends_at}.",
    "event.build.failure_invalid_state":
      "{building_id}: command rejected while the builder's ledger reports {invalid_reason}.",
    "event.units.training_started":
      "{settlement_name}: training begins for {quantity} {unit_label}.",
    "event.train.started":
      "{settlement_name}: training begins for {quantity} {unit_label}.",
    "event.train.completed":
      "{settlement_name}: {quantity} {unit_label} report ready for orders.",
    "event.train.success":
      "{settlement_name}: training begins for {quantity} {unit_label}.",
    "event.train.failure_insufficient_resources":
      "{unit_id}: muster delayed; missing resources {missing_resources_by_id} against required {required_cost_by_id}.",
    "event.train.failure_cooldown":
      "{unit_id}: barracks queue is locked until {queue_available_at}, {cooldown_remaining_ms}ms remaining.",
    "event.train.failure_invalid_state":
      "{unit_id}: muster rejected as state contract reads {invalid_reason}.",
    "event.units.upkeep_reduced_garrison":
      "{settlement_name}: garrison ration discipline reduces stationed troop upkeep.",
    "event.scout.dispatched_success":
      "{settlement_name}: scouts ride out toward {target_tile_label} and report on first contact within the cycle.",
    "event.scout.dispatched":
      "{settlement_name}: scouts ride out toward {target_tile_label}.",
    "event.scout.report_empty":
      "Scout report from {target_tile_label}: no active host detected. The roads remain quiet for now.",
    "event.world.scout_report_hostile":
      "Scout report from {target_tile_label}: hostile movement sighted ({hostile_force_estimate}).",
    "event.scout.report_hostile":
      "Scout report from {target_tile_label}: hostile movement sighted ({hostile_force_estimate}).",
    "event.scout.return_empty":
      "Scouting returns to quiet from {target_tile_label}; no active host disturbed the roads.",
    "event.scout.return_hostile":
      "Scouts from {target_tile_label} report hostile movement ({hostile_force_estimate}); garrisons should tighten watch.",
    "event.world.scout_unavailable_tile":
      "Scout dispatch to {target_tile_label} aborted: tile is unavailable for this route.",
    "event.scout.unavailable_tile":
      "Scout dispatch to {target_tile_label} aborted: tile is unavailable for this route.",
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
            selected_tile_id: "tile_0412_0198",
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
                contentKey: "event.tick.passive_gain_success",
                tokens: {
                  settlement_name: "Cinderwatch Hold",
                  duration_ms: 250,
                },
                meta: "2m ago | Economy | Tick",
                priority: "high",
              },
              {
                contentKey: "event.tick.passive_gain_stalled",
                tokens: {
                  settlement_name: "Cinderwatch Hold",
                  duration_ms: 240,
                },
                meta: "6m ago | Economy | Tick",
                priority: "normal",
              },
              {
                contentKey: "event.build.success",
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
                contentKey: "event.build.failure_insufficient_resources",
                tokens: {
                  building_id: "granary",
                  missing_resources_by_id: "Wood: 4, Stone: 2",
                  required_cost_by_id: "Wood: 12, Stone: 5",
                  available_stock_by_id: "Wood: 8, Stone: 3",
                },
                meta: "12m ago | Settlement | Build loop",
                priority: "normal",
              },
              {
                contentKey: "event.train.failure_cooldown",
                tokens: {
                  unit_id: "road_wardens",
                  queue_available_at: "08:42",
                  cooldown_remaining_ms: 4200,
                },
                meta: "16m ago | Military | Train loop",
                priority: "normal",
              },
              {
                contentKey: "event.scout.report_empty",
                tokens: {
                  target_tile_label: "Black Reed March",
                },
                meta: "21m ago | World | Scout loop",
                priority: "normal",
              },
              {
                contentKey: "event.scout.report_hostile",
                tokens: {
                  target_tile_label: "Ruin Site",
                  hostile_force_estimate: "3-5 squads",
                },
                meta: "23m ago | World | Scout loop",
                priority: "normal",
              },
              {
                contentKey: "event.scout.dispatched",
                tokens: {
                  settlement_name: "Cinderwatch Hold",
                  target_tile_label: "Black Reed March",
                },
                meta: "25m ago | World | Scout loop",
                priority: "normal",
              },
              {
                contentKey: "event.train.success",
                tokens: {
                  settlement_name: "Cinderwatch Hold",
                  quantity: 12,
                  unit_label: "Road Wardens",
                },
                meta: "31m ago | Military | Train loop",
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

  const firstSliceResourceIds = Object.freeze(["food", "wood", "stone", "iron"]);
  const settlementResourceCardOrder = Object.freeze([
    { resourceId: "wood", label: "Timber" },
    { resourceId: "stone", label: "Stone" },
    { resourceId: "iron", label: "Iron" },
    { resourceId: "food", label: "Grain" },
  ]);
  const settlementGarrisonOrder = Object.freeze([
    { unitId: "watch_levy", label: "Watch Levy" },
    { unitId: "road_wardens", label: "Road Wardens" },
    { unitId: "slingers", label: "Slingers" },
    { unitId: "scout_riders", label: "Scout Riders" },
  ]);
  const populatedSettlementScenario = mockClientShellState.panels.settlement.scenarios.populated;
  const defaultBuildQueueEntries = (populatedSettlementScenario.buildQueue || []).map((item) => ({
    ...item,
  }));

  const settlementActionRuntime = {
    settlement_id: "settlement_alpha",
    settlement_name: "Cinderwatch Hold",
    resource_stock_by_id: {
      food: 1860,
      wood: 1240,
      stone: 980,
      iron: 715,
    },
    storage_cap_by_id: {
      food: 2400,
      wood: 2000,
      stone: 1800,
      iron: 1600,
    },
    passive_prod_per_h_by_id: {
      food: 540,
      wood: 360,
      stone: 240,
      iron: 180,
    },
    building_level_by_id: {
      grain_plot: 6,
    },
    garrison_count_by_unit_id: {
      watch_levy: 120,
      road_wardens: 48,
      slingers: 64,
      scout_riders: 12,
    },
    build_queue_entries: defaultBuildQueueEntries,
    action_outcome_mode: "success",
    pending_action: null,
    last_outcome: null,
    next_correlation_id: 1,
  };
  const settlementContractActionGateRuntime = {
    build: {
      building_id: "grain_plot",
      required_cost_by_id: null,
      cooldown_ends_at: null,
    },
    train: {
      unit_id: "watch_levy",
      required_cost_by_id: null,
      queue_available_at: null,
    },
  };
  const settlementContractGateRefreshTimerByAction = {
    build: null,
    train: null,
  };
  const worldMapActionRuntime = {
    pending_action: null,
    unavailable_scout_tile_by_id: {},
  };

  const cloneResourceValues = (values) => {
    const normalized = {};
    for (const resourceId of firstSliceResourceIds) {
      normalized[resourceId] = Number(values?.[resourceId]) || 0;
    }
    return normalized;
  };
  const parseIsoInstant = (value) => {
    if (value instanceof Date && Number.isFinite(value.getTime())) {
      return value;
    }
    if (typeof value !== "string") {
      return null;
    }
    const normalized = value.trim();
    if (normalized.length < 1) {
      return null;
    }
    const parsed = new Date(normalized);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }
    return parsed;
  };
  const normalizeResourceCostById = (values) => {
    if (!values || typeof values !== "object") {
      return null;
    }
    const normalized = cloneResourceValues(values);
    const hasAtLeastOneCost = firstSliceResourceIds.some((resourceId) => normalized[resourceId] > 0);
    return hasAtLeastOneCost ? normalized : null;
  };
  const hasInsufficientResourceStock = (requiredById, availableById) =>
    firstSliceResourceIds.some(
      (resourceId) => (Number(availableById?.[resourceId]) || 0) < (Number(requiredById?.[resourceId]) || 0),
    );
  const buildMissingResourceValues = (requiredById, availableById) => {
    const missing = {};
    for (const resourceId of firstSliceResourceIds) {
      const requiredValue = Number(requiredById?.[resourceId]) || 0;
      const availableValue = Number(availableById?.[resourceId]) || 0;
      missing[resourceId] = Math.max(0, requiredValue - availableValue);
    }
    return missing;
  };
  const clearSettlementContractGateRefreshTimer = (actionType) => {
    const existingTimer = settlementContractGateRefreshTimerByAction[actionType];
    if (existingTimer !== null) {
      clearTimeout(existingTimer);
      settlementContractGateRefreshTimerByAction[actionType] = null;
    }
  };
  const scheduleSettlementContractGateRefresh = (actionType, instantValue) => {
    clearSettlementContractGateRefreshTimer(actionType);
    const expiresAt = parseIsoInstant(instantValue);
    if (expiresAt === null) {
      return;
    }
    const remainingMs = expiresAt.getTime() - Date.now();
    if (remainingMs <= 0) {
      return;
    }
    const delayMs = Math.min(remainingMs + 50, 2_147_483_647);
    settlementContractGateRefreshTimerByAction[actionType] = window.setTimeout(() => {
      settlementContractGateRefreshTimerByAction[actionType] = null;
      renderPanels();
    }, delayMs);
  };

  const formatEtaFromSeconds = (durationSeconds) => {
    const totalSeconds = Math.max(0, Math.floor(Number(durationSeconds) || 0));
    const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
    const seconds = String(totalSeconds % 60).padStart(2, "0");
    return `${minutes}:${seconds}`;
  };

  const toIsoOrValue = (value) => (value instanceof Date ? value.toISOString() : value);
  const firstSliceTransportRoutes = Object.freeze({
    settlement_tick: "/settlements/{settlementId}/tick",
    building_upgrade: "/settlements/{settlementId}/buildings/{buildingId}/upgrade",
    unit_train: "/settlements/{settlementId}/units/{unitId}/train",
    world_map_tile_interact: "/world-map/tiles/{tileId}/interact",
  });

  const resolveIsoInstant = (value, fallbackIso) => {
    if (value instanceof Date && Number.isFinite(value.getTime())) {
      return value.toISOString();
    }
    if (typeof value === "string") {
      const normalized = value.trim();
      if (normalized.length > 0) {
        const parsed = new Date(normalized);
        if (!Number.isNaN(parsed.getTime())) {
          return parsed.toISOString();
        }
      }
    }
    return fallbackIso;
  };

  const resolveWindowTransportBridge = () => {
    const transportBridge = window.__RK_FIRST_SLICE_SETTLEMENT_LOOP_TRANSPORT__;
    if (transportBridge && typeof transportBridge.invoke === "function") {
      return transportBridge;
    }
    return null;
  };

  const interpolateTransportRoutePath = (routeTemplate, path = {}) =>
    String(routeTemplate).replace(/\{([^}]+)\}/g, (_, tokenName) => {
      const rawValue = path?.[tokenName];
      const normalizedValue = rawValue === undefined || rawValue === null ? "" : String(rawValue);
      return encodeURIComponent(normalizedValue);
    });

  const invokeFirstSliceTransportRoute = async (routeTemplate, request) => {
    const transportBridge = resolveWindowTransportBridge();
    if (transportBridge !== null) {
      try {
        const bridgeResponse = await Promise.resolve(transportBridge.invoke(routeTemplate, request));
        if (
          bridgeResponse
          && Number.isFinite(bridgeResponse.status_code)
          && Object.prototype.hasOwnProperty.call(bridgeResponse, "body")
        ) {
          return bridgeResponse;
        }

        return {
          status_code: 500,
          body: {
            code: "transport_invalid_response",
            message: `Transport bridge returned an invalid response for '${routeTemplate}'.`,
          },
        };
      } catch (error) {
        return {
          status_code: 500,
          body: {
            code: "transport_handler_error",
            message: error instanceof Error ? error.message : "Transport bridge invocation failed.",
          },
        };
      }
    }

    const routePath = interpolateTransportRoutePath(routeTemplate, request?.path);

    try {
      const response = await fetch(routePath, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(request?.body || {}),
      });

      let responseBody = {};
      try {
        responseBody = await response.json();
      } catch {
        responseBody = {};
      }

      return {
        status_code: response.status,
        body: responseBody,
      };
    } catch (error) {
      return {
        status_code: 503,
        body: {
          code: "transport_unreachable",
          message: error instanceof Error ? error.message : "Transport endpoint is unreachable.",
        },
      };
    }
  };

  const unwrapFirstSliceTransportSuccess = (routeTemplate, transportResponse) => {
    if (transportResponse?.status_code === 200) {
      return transportResponse.body;
    }

    const errorCode =
      typeof transportResponse?.body?.code === "string" && transportResponse.body.code.length > 0
        ? transportResponse.body.code
        : "transport_handler_error";
    const errorMessage =
      typeof transportResponse?.body?.message === "string" && transportResponse.body.message.length > 0
        ? transportResponse.body.message
        : `Transport invocation failed for '${routeTemplate}'.`;
    const error = new Error(errorMessage);
    error.code = errorCode;
    error.status_code =
      Number.isFinite(transportResponse?.status_code) ? Math.trunc(transportResponse.status_code) : 500;
    throw error;
  };

  const createFirstSliceClientContractAdapter = () => ({
    tickSettlementCommand: async (input) => {
      const nowIso = new Date().toISOString();
      const requestedAtIso = resolveIsoInstant(input.requested_at, nowIso);
      const requestedAtMs = new Date(requestedAtIso).getTime();
      const durationMs = Math.max(0, Math.floor(Number(input.duration_ms) || 0));
      const tickEndedAtIso = new Date(requestedAtMs + durationMs).toISOString();

      const transportResponse = await invokeFirstSliceTransportRoute(
        firstSliceTransportRoutes.settlement_tick,
        {
          path: {
            settlementId: input.settlement_id,
          },
          body: {
            settlement_id: input.settlement_id,
            flow_version: "v1",
            tick_started_at: requestedAtIso,
            tick_ended_at: tickEndedAtIso,
            settlement_name: input.settlement_name,
            resource_stock_by_id: input.resource_stock_by_id,
            storage_cap_by_id: input.storage_cap_by_id,
            passive_prod_per_h_by_id: input.passive_prod_per_h_by_id,
            correlation_id: input.correlation_id,
          },
        },
      );
      return unwrapFirstSliceTransportSuccess(firstSliceTransportRoutes.settlement_tick, transportResponse);
    },
    buildUpgradeCommand: async (input) => {
      const requestedAtIso = resolveIsoInstant(input.requested_at, new Date().toISOString());

      const transportResponse = await invokeFirstSliceTransportRoute(
        firstSliceTransportRoutes.building_upgrade,
        {
          path: {
            settlementId: input.settlement_id,
            buildingId: input.building_id,
          },
          body: {
            settlement_id: input.settlement_id,
            building_id: input.building_id,
            flow_version: "v1",
            current_level: Number(input.current_level) || 0,
            requested_at: requestedAtIso,
            settlement_name: input.settlement_name,
            resource_stock_by_id: input.resource_stock_by_id,
            cooldown_ends_at: resolveIsoInstant(input.cooldown_ends_at, ""),
            active_upgrade_ends_at: resolveIsoInstant(input.active_upgrade_ends_at, ""),
            correlation_id: input.correlation_id,
          },
        },
      );
      return unwrapFirstSliceTransportSuccess(firstSliceTransportRoutes.building_upgrade, transportResponse);
    },
    trainUnitCommand: async (input) => {
      const requestedAtIso = resolveIsoInstant(input.requested_at, new Date().toISOString());

      const transportResponse = await invokeFirstSliceTransportRoute(
        firstSliceTransportRoutes.unit_train,
        {
          path: {
            settlementId: input.settlement_id,
            unitId: input.unit_id,
          },
          body: {
            settlement_id: input.settlement_id,
            unit_id: input.unit_id,
            flow_version: "v1",
            quantity: Number(input.quantity) || 0,
            requested_at: requestedAtIso,
            barracks_level: Number(input.barracks_level) || 0,
            settlement_name: input.settlement_name,
            resource_stock_by_id: input.resource_stock_by_id,
            queue_available_at: resolveIsoInstant(input.queue_available_at, ""),
            training_time_multiplier: Number(input.training_time_multiplier) || undefined,
            correlation_id: input.correlation_id,
          },
        },
      );
      return unwrapFirstSliceTransportSuccess(firstSliceTransportRoutes.unit_train, transportResponse);
    },
    scoutTileInteractCommand: async (input) => {
      const transportResponse = await invokeFirstSliceTransportRoute(
        firstSliceTransportRoutes.world_map_tile_interact,
        {
          path: {
            tileId: input.tile_id,
          },
          body: {
            settlement_id: input.settlement_id,
            tile_id: input.tile_id,
            interaction_type: "scout",
            flow_version: "v1",
            settlement_name: input.settlement_name,
            player_id: input.player_id,
            assignment_context_type: input.assignment_context_type,
            assignment_context_id: input.assignment_context_id,
          },
        },
      );
      return unwrapFirstSliceTransportSuccess(
        firstSliceTransportRoutes.world_map_tile_interact,
        transportResponse,
      );
    },
  });

  const firstSliceClientContractAdapter = createFirstSliceClientContractAdapter();

  const escapeHtml = (value) =>
    String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const formatNumber = (value) => numberFormatter.format(value);

  const clampPercent = (value) => Math.max(0, Math.min(100, Number(value) || 0));
  const formatTemplateTokenValue = (value) => {
    if (value === undefined || value === null) {
      return "";
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    if (Array.isArray(value)) {
      return value.map((item) => formatTemplateTokenValue(item)).join(", ");
    }

    if (typeof value === "object") {
      return Object.keys(value)
        .sort()
        .map((key) => `${key}: ${formatTemplateTokenValue(value[key])}`)
        .join(", ");
    }

    return String(value);
  };
  const fillTemplateTokens = (template, tokens = {}) =>
    String(template).replace(/\{([a-z0-9_]+)\}/gi, (match, tokenName) =>
      Object.prototype.hasOwnProperty.call(tokens, tokenName)
        ? formatTemplateTokenValue(tokens[tokenName])
        : match,
    );
  const mapBackendEventKeyToClientKey = (contentKey) => {
    if (!contentKey) {
      return "";
    }

    if (contentKey === "event.economy.tick_passive_income") {
      return "event.tick.passive_income";
    }

    if (contentKey.startsWith("event.buildings.")) {
      return contentKey.replace("event.buildings.", "event.build.");
    }

    if (contentKey.startsWith("event.units.")) {
      return contentKey.replace("event.units.", "event.train.");
    }

    if (contentKey.startsWith("event.world.scout_")) {
      return contentKey.replace("event.world.", "event.scout.");
    }

    return contentKey;
  };
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
    } else if (contentKey.startsWith("event.economy.")) {
      addCandidate(contentKey.replace("event.economy.tick_passive_income", "event.tick.passive_income"));
    } else if (contentKey.startsWith("event.world.scout_")) {
      addCandidate(contentKey.replace("event.world.", "event.scout."));
    }

    if (contentKey.startsWith("event.build.")) {
      addCandidate(contentKey.replace("event.build.", "event.buildings."));
    } else if (contentKey.startsWith("event.train.")) {
      addCandidate(contentKey.replace("event.train.", "event.units."));
    } else if (contentKey.startsWith("event.tick.")) {
      addCandidate(contentKey.replace("event.tick.passive_income", "event.economy.tick_passive_income"));
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

  const getPopulatedEventScenario = () => mockClientShellState.panels.eventFeed.scenarios.populated;

  const appendEventFeedEntry = (entry) => {
    const eventScenario = getPopulatedEventScenario();
    const existing = Array.isArray(eventScenario.events) ? eventScenario.events : [];
    eventScenario.events = [entry, ...existing].slice(0, 20);
  };

  const mapPlaceholderEventTokens = (contentKey, payload) => {
    if (!payload) {
      return {};
    }

    if (contentKey === "event.tick.passive_income") {
      const deltaById = payload.resource_delta_by_id || {};
      return {
        settlement_name: payload.settlement_name || settlementActionRuntime.settlement_name,
        food_gain: Number(deltaById.food) || 0,
        wood_gain: Number(deltaById.wood) || 0,
        stone_gain: Number(deltaById.stone) || 0,
        iron_gain: Number(deltaById.iron) || 0,
      };
    }

    return { ...payload };
  };

  const syncSettlementScenarioFromRuntime = () => {
    const scenario = mockClientShellState.panels.settlement.scenarios.populated;
    const resourceStock = settlementActionRuntime.resource_stock_by_id;
    const storageCap = settlementActionRuntime.storage_cap_by_id;

    scenario.resources = settlementResourceCardOrder.map((entry) => {
      const value = Number(resourceStock[entry.resourceId]) || 0;
      const cap = Math.max(1, Number(storageCap[entry.resourceId]) || 1);
      return {
        label: entry.label,
        value,
        fill: clampPercent((value / cap) * 100),
      };
    });

    scenario.buildQueue = (settlementActionRuntime.build_queue_entries || []).map((item) => ({
      ...item,
    }));
    scenario.garrison = settlementGarrisonOrder.map((entry) => ({
      unit: entry.label,
      count: Number(settlementActionRuntime.garrison_count_by_unit_id[entry.unitId]) || 0,
    }));
  };

  const buildOutcomeDetail = (actionType, response) => {
    if (!response) {
      return "";
    }

    const status = response.status === "failed" ? "failed" : "accepted";
    return `${actionType.toUpperCase()} ${status} | ${response.schema_version || response.flow || "contract stub"}`;
  };

  const setLastActionOutcome = (actionType, response, contentKey, tokens) => {
    settlementActionRuntime.last_outcome = {
      actionType,
      status: response?.status === "failed" ? "failed" : "accepted",
      contentKey,
      tokens,
      detail: buildOutcomeDetail(actionType, response),
    };
  };

  const appendPlaceholderEvents = (actionType, response, fallbackKey) => {
    const placeholderEvents = Array.isArray(response?.placeholder_events)
      ? response.placeholder_events
      : [];

    if (placeholderEvents.length === 0) {
      return {
        contentKey: fallbackKey,
        tokens: {},
      };
    }

    const payload = placeholderEvents[0]?.payload || {};
    const contentKey = mapBackendEventKeyToClientKey(payload.event_key || fallbackKey);
    const tokens = mapPlaceholderEventTokens(contentKey, payload);
    appendEventFeedEntry({
      contentKey,
      tokens,
      meta: `Just now | Settlement | ${actionType.toUpperCase()} adapter`,
      priority: "normal",
    });

    return {
      contentKey,
      tokens,
    };
  };

  const applyTickActionResult = (response) => {
    if (response.status === "failed") {
      const failureKey = "event.tick.passive_gain_stalled";
      const failureTokens = {
        settlement_name: settlementActionRuntime.settlement_name,
        duration_ms: Number(response.duration_ms) || 0,
      };
      appendEventFeedEntry({
        contentKey: failureKey,
        tokens: failureTokens,
        meta: "Just now | Economy | TICK adapter",
        priority: "medium",
      });
      setLastActionOutcome("tick", response, failureKey, failureTokens);
      return;
    }

    settlementActionRuntime.resource_stock_by_id = cloneResourceValues(response.resource_stock_by_id);
    const appended = appendPlaceholderEvents("tick", response, "event.tick.passive_income");
    setLastActionOutcome("tick", response, appended.contentKey, appended.tokens);
  };

  const applyBuildActionResult = (response) => {
    if (response.status === "failed") {
      const failureKeyByCode = {
        insufficient_resources: "event.build.failure_insufficient_resources",
        cooldown: "event.build.failure_cooldown",
        invalid_state: "event.build.failure_invalid_state",
      };
      const failureCode = response.error_code || response.failure_code;
      const failureKey = failureKeyByCode[failureCode] || "event.build.failure_invalid_state";
      const failureTokens = {
        ...response,
        settlement_name: settlementActionRuntime.settlement_name,
        cooldown_ends_at: toIsoOrValue(response.cooldown_ends_at),
      };
      const nextBuildingId =
        typeof response.building_id === "string" && response.building_id.trim().length > 0
          ? response.building_id
          : settlementContractActionGateRuntime.build.building_id;
      settlementContractActionGateRuntime.build.building_id = nextBuildingId;
      if (failureCode === "insufficient_resources") {
        const requiredCostById = normalizeResourceCostById(response.required_cost_by_id);
        if (requiredCostById !== null) {
          settlementContractActionGateRuntime.build.required_cost_by_id = requiredCostById;
        }
        settlementContractActionGateRuntime.build.cooldown_ends_at = null;
        clearSettlementContractGateRefreshTimer("build");

        if (response.available_stock_by_id) {
          settlementActionRuntime.resource_stock_by_id = cloneResourceValues(response.available_stock_by_id);
        }
      } else if (failureCode === "cooldown") {
        const cooldownEndsAt = parseIsoInstant(response.cooldown_ends_at);
        settlementContractActionGateRuntime.build.cooldown_ends_at =
          cooldownEndsAt !== null ? cooldownEndsAt.toISOString() : null;
        scheduleSettlementContractGateRefresh(
          "build",
          settlementContractActionGateRuntime.build.cooldown_ends_at,
        );
      }
      appendEventFeedEntry({
        contentKey: failureKey,
        tokens: failureTokens,
        meta: "Just now | Settlement | BUILD adapter",
        priority: "medium",
      });
      setLastActionOutcome("build", response, failureKey, failureTokens);
      return;
    }

    settlementActionRuntime.resource_stock_by_id = cloneResourceValues(response.resource_stock_after_by_id);
    settlementActionRuntime.building_level_by_id[response.building_id] = response.to_level;
    settlementContractActionGateRuntime.build.building_id = response.building_id;
    settlementContractActionGateRuntime.build.required_cost_by_id =
      normalizeResourceCostById(response.resource_cost_by_id)
      || settlementContractActionGateRuntime.build.required_cost_by_id;
    settlementContractActionGateRuntime.build.cooldown_ends_at = null;
    clearSettlementContractGateRefreshTimer("build");
    settlementActionRuntime.build_queue_entries = [
      {
        icon: "B*",
        label: `${response.building_label} (Lv. ${response.from_level} -> ${response.to_level})`,
        progress: 0,
        eta: formatEtaFromSeconds(response.upgrade_duration_s),
      },
      ...settlementActionRuntime.build_queue_entries,
    ].slice(0, 6);

    const appended = appendPlaceholderEvents("build", response, "event.build.upgrade_started");
    setLastActionOutcome("build", response, appended.contentKey, appended.tokens);
  };

  const applyTrainActionResult = (response) => {
    if (response.status === "failed") {
      const failureKeyByCode = {
        insufficient_resources: "event.train.failure_insufficient_resources",
        cooldown: "event.train.failure_cooldown",
        invalid_state: "event.train.failure_invalid_state",
      };
      const failureCode = response.error_code || response.failure_code;
      const failureKey = failureKeyByCode[failureCode] || "event.train.failure_invalid_state";
      const failureTokens = {
        ...response,
        settlement_name: settlementActionRuntime.settlement_name,
        queue_available_at: toIsoOrValue(response.queue_available_at),
      };
      const nextUnitId =
        typeof response.unit_id === "string" && response.unit_id.trim().length > 0
          ? response.unit_id
          : settlementContractActionGateRuntime.train.unit_id;
      settlementContractActionGateRuntime.train.unit_id = nextUnitId;
      if (failureCode === "insufficient_resources") {
        const requiredCostById = normalizeResourceCostById(response.required_cost_by_id);
        if (requiredCostById !== null) {
          settlementContractActionGateRuntime.train.required_cost_by_id = requiredCostById;
        }
        settlementContractActionGateRuntime.train.queue_available_at = null;
        clearSettlementContractGateRefreshTimer("train");

        if (response.available_stock_by_id) {
          settlementActionRuntime.resource_stock_by_id = cloneResourceValues(response.available_stock_by_id);
        }
      } else if (failureCode === "cooldown") {
        const queueAvailableAt = parseIsoInstant(response.queue_available_at);
        settlementContractActionGateRuntime.train.queue_available_at =
          queueAvailableAt !== null ? queueAvailableAt.toISOString() : null;
        scheduleSettlementContractGateRefresh(
          "train",
          settlementContractActionGateRuntime.train.queue_available_at,
        );
      }
      appendEventFeedEntry({
        contentKey: failureKey,
        tokens: failureTokens,
        meta: "Just now | Military | TRAIN adapter",
        priority: "medium",
      });
      setLastActionOutcome("train", response, failureKey, failureTokens);
      return;
    }

    settlementActionRuntime.resource_stock_by_id = cloneResourceValues(response.resource_stock_after_by_id);
    settlementContractActionGateRuntime.train.unit_id = response.unit_id;
    settlementContractActionGateRuntime.train.required_cost_by_id =
      normalizeResourceCostById(response.resource_cost_by_id)
      || settlementContractActionGateRuntime.train.required_cost_by_id;
    settlementContractActionGateRuntime.train.queue_available_at = null;
    clearSettlementContractGateRefreshTimer("train");
    settlementActionRuntime.garrison_count_by_unit_id[response.unit_id] =
      (Number(settlementActionRuntime.garrison_count_by_unit_id[response.unit_id]) || 0) +
      (Number(response.quantity) || 0);
    const appended = appendPlaceholderEvents("train", response, "event.train.started");
    setLastActionOutcome("train", response, appended.contentKey, appended.tokens);
  };

  const resolveActionErrorCode = (error) => {
    if (typeof error?.code === "string" && error.code.trim().length > 0) {
      return error.code.trim();
    }
    return "transport_handler_error";
  };

  const resolveActionErrorMessage = (error) => {
    if (error instanceof Error && error.message.trim().length > 0) {
      return error.message.trim();
    }
    return "Action invocation failed.";
  };

  const handleActionInvocationError = (actionType, error, context = {}) => {
    const errorCode = resolveActionErrorCode(error);
    const failureContentKeyByAction = {
      tick: "event.tick.passive_gain_stalled",
      build: "event.build.failure_invalid_state",
      train: "event.train.failure_invalid_state",
      scout: "event.scout.unavailable_tile",
    };
    const failureMetaByAction = {
      tick: "Just now | Economy | TICK adapter",
      build: "Just now | Settlement | BUILD adapter",
      train: "Just now | Military | TRAIN adapter",
      scout: "Just now | World | SCOUT adapter",
    };

    const failureContentKey = failureContentKeyByAction[actionType] || "event.tick.passive_gain_stalled";
    const fallbackTileLabel =
      typeof context.target_tile_label === "string" && context.target_tile_label.trim().length > 0
        ? context.target_tile_label
        : `Frontier Tile ${context.tile_id || "tile_unknown"}`;
    const failureTokensByAction = {
      tick: {
        settlement_name: settlementActionRuntime.settlement_name,
        duration_ms: Number(context.duration_ms) || 0,
      },
      build: {
        building_id: context.building_id || "building_unknown",
        settlement_name: settlementActionRuntime.settlement_name,
        invalid_reason: errorCode,
      },
      train: {
        unit_id: context.unit_id || "unit_unknown",
        settlement_name: settlementActionRuntime.settlement_name,
        invalid_reason: errorCode,
      },
      scout: {
        settlement_name: settlementActionRuntime.settlement_name,
        target_tile_label: fallbackTileLabel,
      },
    };
    const failureTokens = failureTokensByAction[actionType] || failureTokensByAction.tick;

    appendEventFeedEntry({
      contentKey: failureContentKey,
      tokens: failureTokens,
      meta: failureMetaByAction[actionType] || "Just now | Adapter",
      priority: "medium",
    });
    setLastActionOutcome(
      actionType,
      {
        status: "failed",
        flow: "transport.invocation_error",
        message: resolveActionErrorMessage(error),
      },
      failureContentKey,
      failureTokens,
    );
  };

  const resolveSelectedWorldMapTileId = () => {
    const currentMapScenario = getPanelScenario("worldMap").scenario;
    const scenarioTileId =
      typeof currentMapScenario?.selected_tile_id === "string"
        ? currentMapScenario.selected_tile_id.trim()
        : "";
    if (scenarioTileId.length > 0) {
      return scenarioTileId;
    }

    const populatedScenarioTileId =
      typeof mockClientShellState.panels.worldMap.scenarios.populated.selected_tile_id === "string"
        ? mockClientShellState.panels.worldMap.scenarios.populated.selected_tile_id.trim()
        : "";
    if (populatedScenarioTileId.length > 0) {
      return populatedScenarioTileId;
    }

    return "tile_0412_0198";
  };

  const resolveSelectedWorldMapTileLabel = (tileId) => {
    const currentMapScenario = getPanelScenario("worldMap").scenario;
    const selectedType =
      typeof currentMapScenario?.selectedTile?.Type === "string"
        ? currentMapScenario.selectedTile.Type.trim()
        : "";
    if (
      selectedType.length > 0
      && selectedType !== "No Selection"
      && selectedType !== "Syncing"
      && selectedType !== "Unavailable"
    ) {
      return selectedType;
    }

    return `Frontier Tile ${tileId}`;
  };
  const resolveSettlementContractActionAvailability = (actionType) => {
    if (actionType === "build") {
      const buildGate = settlementContractActionGateRuntime.build;
      const cooldownEndsAt = parseIsoInstant(buildGate.cooldown_ends_at);
      if (cooldownEndsAt !== null) {
        const cooldownRemainingMs = cooldownEndsAt.getTime() - Date.now();
        if (cooldownRemainingMs > 0) {
          return {
            contractDisabled: true,
            contentKey: "event.build.failure_cooldown",
            tokens: {
              building_id: buildGate.building_id,
              settlement_name: settlementActionRuntime.settlement_name,
              cooldown_ends_at: cooldownEndsAt.toISOString(),
              cooldown_remaining_ms: cooldownRemainingMs,
            },
          };
        }
        buildGate.cooldown_ends_at = null;
        clearSettlementContractGateRefreshTimer("build");
      }

      const requiredCostById = normalizeResourceCostById(buildGate.required_cost_by_id);
      const availableStockById = cloneResourceValues(settlementActionRuntime.resource_stock_by_id);
      if (
        requiredCostById !== null
        && hasInsufficientResourceStock(requiredCostById, availableStockById)
      ) {
        return {
          contractDisabled: true,
          contentKey: "event.build.failure_insufficient_resources",
          tokens: {
            building_id: buildGate.building_id,
            settlement_name: settlementActionRuntime.settlement_name,
            required_cost_by_id: requiredCostById,
            available_stock_by_id: availableStockById,
            missing_resources_by_id: buildMissingResourceValues(requiredCostById, availableStockById),
          },
        };
      }
    }

    if (actionType === "train") {
      const trainGate = settlementContractActionGateRuntime.train;
      const queueAvailableAt = parseIsoInstant(trainGate.queue_available_at);
      if (queueAvailableAt !== null) {
        const cooldownRemainingMs = queueAvailableAt.getTime() - Date.now();
        if (cooldownRemainingMs > 0) {
          return {
            contractDisabled: true,
            contentKey: "event.train.failure_cooldown",
            tokens: {
              unit_id: trainGate.unit_id,
              settlement_name: settlementActionRuntime.settlement_name,
              queue_available_at: queueAvailableAt.toISOString(),
              cooldown_remaining_ms: cooldownRemainingMs,
            },
          };
        }
        trainGate.queue_available_at = null;
        clearSettlementContractGateRefreshTimer("train");
      }

      const requiredCostById = normalizeResourceCostById(trainGate.required_cost_by_id);
      const availableStockById = cloneResourceValues(settlementActionRuntime.resource_stock_by_id);
      if (
        requiredCostById !== null
        && hasInsufficientResourceStock(requiredCostById, availableStockById)
      ) {
        return {
          contractDisabled: true,
          contentKey: "event.train.failure_insufficient_resources",
          tokens: {
            unit_id: trainGate.unit_id,
            settlement_name: settlementActionRuntime.settlement_name,
            required_cost_by_id: requiredCostById,
            available_stock_by_id: availableStockById,
            missing_resources_by_id: buildMissingResourceValues(requiredCostById, availableStockById),
          },
        };
      }
    }

    return {
      contractDisabled: false,
      contentKey: "",
      tokens: {},
    };
  };
  const resolveWorldMapScoutContractAvailability = () => {
    const tileId = resolveSelectedWorldMapTileId();
    const unavailableTileEntry = worldMapActionRuntime.unavailable_scout_tile_by_id[tileId];
    if (!unavailableTileEntry) {
      return {
        contractDisabled: false,
        contentKey: "",
        tokens: {},
      };
    }

    const contentKey =
      typeof unavailableTileEntry.contentKey === "string" && unavailableTileEntry.contentKey.trim().length > 0
        ? unavailableTileEntry.contentKey
        : "event.scout.unavailable_tile";
    const fallbackTokens = {
      settlement_name: settlementActionRuntime.settlement_name,
      target_tile_label: resolveSelectedWorldMapTileLabel(tileId),
    };
    const tokens = mapPlaceholderEventTokens(contentKey, {
      ...fallbackTokens,
      ...(unavailableTileEntry.tokens || {}),
    });
    return {
      contractDisabled: true,
      contentKey,
      tokens,
    };
  };

  const applyScoutActionResult = (response) => {
    const isFailure = response?.status === "failed";
    const fallbackBackendContentKey = isFailure
      ? "event.world.scout_unavailable_tile"
      : "event.world.scout_dispatched";
    const backendContentKey = response?.event?.content_key || fallbackBackendContentKey;
    const contentKey = mapBackendEventKeyToClientKey(backendContentKey);
    const fallbackTileId =
      typeof response?.tile_id === "string" && response.tile_id.trim().length > 0
        ? response.tile_id
        : resolveSelectedWorldMapTileId();
    const eventTokens = response?.event?.tokens || {
      settlement_name: settlementActionRuntime.settlement_name,
      target_tile_label: resolveSelectedWorldMapTileLabel(fallbackTileId),
    };
    const tokens = mapPlaceholderEventTokens(contentKey, eventTokens);
    if (isFailure && response?.error_code === "unavailable_tile") {
      worldMapActionRuntime.unavailable_scout_tile_by_id[fallbackTileId] = {
        contentKey,
        tokens,
      };
    } else {
      delete worldMapActionRuntime.unavailable_scout_tile_by_id[fallbackTileId];
    }

    appendEventFeedEntry({
      contentKey,
      tokens,
      meta: "Just now | World | SCOUT adapter",
      priority: isFailure ? "medium" : "normal",
    });
    setLastActionOutcome("scout", response, contentKey, tokens);
  };

  const runSettlementContractAction = async (actionType) => {
    if (settlementActionRuntime.pending_action !== null) {
      return;
    }
    if (actionType === "build" || actionType === "train") {
      const availability = resolveSettlementContractActionAvailability(actionType);
      if (availability.contractDisabled) {
        return;
      }
    }

    settlementActionRuntime.pending_action = actionType;
    const shouldFail = settlementActionRuntime.action_outcome_mode === "failure";
    const requestedAt = new Date();
    const correlationId = `rk-client-web-${settlementActionRuntime.next_correlation_id++}`;
    const tickDurationMs = shouldFail ? 0 : 60_000;
    renderPanels();

    try {
      if (actionType === "tick") {
        const response = await firstSliceClientContractAdapter.tickSettlementCommand({
          settlement_id: settlementActionRuntime.settlement_id,
          settlement_name: settlementActionRuntime.settlement_name,
          requested_at: requestedAt,
          duration_ms: tickDurationMs,
          resource_stock_by_id: settlementActionRuntime.resource_stock_by_id,
          storage_cap_by_id: settlementActionRuntime.storage_cap_by_id,
          passive_prod_per_h_by_id: settlementActionRuntime.passive_prod_per_h_by_id,
          correlation_id: correlationId,
        });
        applyTickActionResult(response);
      }

      if (actionType === "build") {
        const buildResourceStock = shouldFail
          ? {
            food: 0,
            wood: 0,
            stone: 0,
            iron: 0,
          }
          : settlementActionRuntime.resource_stock_by_id;
        const response = await firstSliceClientContractAdapter.buildUpgradeCommand({
          settlement_id: settlementActionRuntime.settlement_id,
          settlement_name: settlementActionRuntime.settlement_name,
          building_id: "grain_plot",
          current_level: settlementActionRuntime.building_level_by_id.grain_plot || 0,
          requested_at: requestedAt,
          resource_stock_by_id: buildResourceStock,
          correlation_id: correlationId,
        });
        applyBuildActionResult(response);
      }

      if (actionType === "train") {
        const queueAvailableAt = shouldFail ? new Date(requestedAt.getTime() + 90_000) : undefined;
        const response = await firstSliceClientContractAdapter.trainUnitCommand({
          settlement_id: settlementActionRuntime.settlement_id,
          settlement_name: settlementActionRuntime.settlement_name,
          unit_id: "watch_levy",
          quantity: 4,
          requested_at: requestedAt,
          barracks_level: 1,
          resource_stock_by_id: settlementActionRuntime.resource_stock_by_id,
          queue_available_at: queueAvailableAt,
          correlation_id: correlationId,
        });
        applyTrainActionResult(response);
      }
    } catch (error) {
      if (actionType === "tick") {
        handleActionInvocationError("tick", error, { duration_ms: tickDurationMs });
      } else if (actionType === "build") {
        handleActionInvocationError("build", error, { building_id: "grain_plot" });
      } else if (actionType === "train") {
        handleActionInvocationError("train", error, { unit_id: "watch_levy" });
      }
    } finally {
      settlementActionRuntime.pending_action = null;
      renderPanels();
    }
  };

  const runWorldMapContractAction = async (actionType) => {
    if (actionType !== "scout" || worldMapActionRuntime.pending_action !== null) {
      return;
    }
    const scoutAvailability = resolveWorldMapScoutContractAvailability();
    if (scoutAvailability.contractDisabled) {
      return;
    }

    worldMapActionRuntime.pending_action = actionType;
    renderPanels();

    const tileId = resolveSelectedWorldMapTileId();
    const targetTileLabel = resolveSelectedWorldMapTileLabel(tileId);

    try {
      const response = await firstSliceClientContractAdapter.scoutTileInteractCommand({
        settlement_id: settlementActionRuntime.settlement_id,
        settlement_name: settlementActionRuntime.settlement_name,
        tile_id: tileId,
      });
      applyScoutActionResult(response);
    } catch (error) {
      handleActionInvocationError("scout", error, {
        tile_id: tileId,
        target_tile_label: targetTileLabel,
      });
    } finally {
      worldMapActionRuntime.pending_action = null;
      renderPanels();
    }
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

    if (mode === "populated") {
      syncSettlementScenarioFromRuntime();
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
    const isSuccessMode = settlementActionRuntime.action_outcome_mode === "success";
    const isFailureMode = settlementActionRuntime.action_outcome_mode === "failure";
    const pendingAction = settlementActionRuntime.pending_action;
    const buildAvailability = resolveSettlementContractActionAvailability("build");
    const trainAvailability = resolveSettlementContractActionAvailability("train");
    const tickDisabled = pendingAction !== null;
    const buildDisabled = pendingAction !== null || buildAvailability.contractDisabled;
    const trainDisabled = pendingAction !== null || trainAvailability.contractDisabled;
    const settlementContractReasonRows = [
      buildAvailability.contractDisabled
        ? `
          <li class="action-reason-item" data-content-key="${escapeHtml(buildAvailability.contentKey)}">
            <strong>Build Upgrade</strong>
            <span>${escapeHtml(getNarrativeText(buildAvailability.contentKey, buildAvailability.tokens))}</span>
          </li>
        `
        : "",
      trainAvailability.contractDisabled
        ? `
          <li class="action-reason-item" data-content-key="${escapeHtml(trainAvailability.contentKey)}">
            <strong>Train Unit</strong>
            <span>${escapeHtml(getNarrativeText(trainAvailability.contentKey, trainAvailability.tokens))}</span>
          </li>
        `
        : "",
    ]
      .filter((row) => row.length > 0)
      .join("");
    const settlementContractReasonSection = settlementContractReasonRows.length > 0
      ? `<ul class="action-reason-list" aria-live="polite">${settlementContractReasonRows}</ul>`
      : "";
    const lastOutcome = settlementActionRuntime.last_outcome;
    const outcomeNarrative = lastOutcome
      ? getNarrativeText(lastOutcome.contentKey, lastOutcome.tokens)
      : "No adapter calls yet. Trigger Tick, Build, Train, or Scout to see contract payload outcomes.";
    const outcomeClass = lastOutcome
      ? lastOutcome.status === "failed"
        ? "action-outcome is-failed"
        : "action-outcome is-success"
      : "action-outcome";

    refs.content.innerHTML = `
      <div class="stack">
        <section class="subpanel compact">
          <div class="subpanel__head">
            <h3>First-Slice Action Adapter</h3>
            <span class="chip chip--small">Transport Bridge</span>
          </div>
          <p class="subpanel-note">Outcome path</p>
          <div class="segment-row segment-row--dual" role="group" aria-label="Settlement action outcome path">
            <button
              type="button"
              class="segment${isSuccessMode ? " is-selected" : ""}"
              data-settlement-outcome-mode="success"
              aria-pressed="${String(isSuccessMode)}"
            >Success</button>
            <button
              type="button"
              class="segment${isFailureMode ? " is-selected" : ""}"
              data-settlement-outcome-mode="failure"
              aria-pressed="${String(isFailureMode)}"
            >Failure</button>
          </div>
          <div class="settlement-action-grid" role="group" aria-label="Settlement actions">
            <button
              type="button"
              class="action-btn"
              data-settlement-adapter-action="tick"
              ${tickDisabled ? "disabled" : ""}
            >${pendingAction === "tick" ? "Ticking..." : "Tick Settlement"}</button>
            <button
              type="button"
              class="action-btn"
              data-settlement-adapter-action="build"
              ${buildDisabled ? "disabled" : ""}
            >${pendingAction === "build" ? "Queuing..." : "Build Upgrade"}</button>
            <button
              type="button"
              class="action-btn"
              data-settlement-adapter-action="train"
              ${trainDisabled ? "disabled" : ""}
            >${pendingAction === "train" ? "Training..." : "Train Unit"}</button>
          </div>
          ${settlementContractReasonSection}
          <p class="${outcomeClass}" aria-live="polite">${escapeHtml(outcomeNarrative)}</p>
          <p class="subpanel-note">${escapeHtml(lastOutcome?.detail || "Awaiting adapter response.")}</p>
        </section>
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

    const isMapActionPending = worldMapActionRuntime.pending_action !== null;
    const scoutAvailability = resolveWorldMapScoutContractAvailability();
    const mapContractReasonSection =
      mode === "populated" && scoutAvailability.contractDisabled
        ? `
          <ul class="action-reason-list" aria-live="polite">
            <li class="action-reason-item" data-content-key="${escapeHtml(scoutAvailability.contentKey)}">
              <strong>Send Scouts</strong>
              <span>${escapeHtml(getNarrativeText(scoutAvailability.contentKey, scoutAvailability.tokens))}</span>
            </li>
          </ul>
        `
        : "";
    const actionItems = (scenario.actions || [])
      .map((label) => {
        const normalizedLabel = String(label).trim().toLowerCase();
        const isScoutAction = normalizedLabel.startsWith("send scouts");
        const isDisabled =
          mode !== "populated"
          || isMapActionPending
          || settlementActionRuntime.pending_action !== null
          || (isScoutAction && scoutAvailability.contractDisabled);
        const displayLabel = isScoutAction && worldMapActionRuntime.pending_action === "scout"
          ? "Scouting..."
          : label;

        return `<button type="button" class="action-btn"${
          isScoutAction ? ' data-worldmap-adapter-action="scout"' : ""
        } ${isDisabled ? "disabled" : ""}>${escapeHtml(displayLabel)}</button>`;
      })
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
              ${mapContractReasonSection}
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
              ${mapContractReasonSection}
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
              ${mapContractReasonSection}
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
            ${mapContractReasonSection}
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
    const settlementOutcomeModeButton = event.target.closest("[data-settlement-outcome-mode]");
    if (settlementOutcomeModeButton) {
      const outcomeMode = settlementOutcomeModeButton.getAttribute("data-settlement-outcome-mode");
      if (outcomeMode === "success" || outcomeMode === "failure") {
        settlementActionRuntime.action_outcome_mode = outcomeMode;
        renderSettlementPanel();
      }
      return;
    }

    const settlementActionButton = event.target.closest("[data-settlement-adapter-action]");
    if (settlementActionButton) {
      const actionType = settlementActionButton.getAttribute("data-settlement-adapter-action");
      if (actionType === "tick" || actionType === "build" || actionType === "train") {
        void runSettlementContractAction(actionType);
      }
      return;
    }

    const worldMapActionButton = event.target.closest("[data-worldmap-adapter-action]");
    if (worldMapActionButton) {
      const actionType = worldMapActionButton.getAttribute("data-worldmap-adapter-action");
      if (actionType === "scout") {
        void runWorldMapContractAction(actionType);
      }
      return;
    }

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

  const syncTabSelection = (activeTab) => {
    tabs.forEach((item) => {
      const isActive = item === activeTab;
      item.classList.toggle("is-active", isActive);
      item.setAttribute("aria-selected", String(isActive));
      item.tabIndex = isActive ? 0 : -1;
    });
  };

  const moveFocusToPanel = (tab) => {
    const targetId = tab.getAttribute("data-target");
    const panel = targetId ? document.getElementById(targetId) : null;

    if (!panel) {
      return;
    }

    syncTabSelection(tab);

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
        const pageOffsetY =
          typeof window.scrollY === "number"
            ? window.scrollY
            : Number(window.pageYOffset || 0);
        if (pageOffsetY < 8) {
          return;
        }

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

        syncTabSelection(matchingTab);
      },
      {
        rootMargin: "-20% 0px -55% 0px",
        threshold: [0.15, 0.35, 0.5],
      },
    );

    panels.forEach((panelElement) => observer.observe(panelElement));
  }
})();
