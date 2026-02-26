import {
  DeterministicAmbushResolutionService,
  type DeterministicAmbushResolutionResult,
} from "../../combat/application";
import {
  WORLD_MAP_NEUTRAL_GATHERING_FLOW,
  type WorldMapGatherMarchState,
  type WorldMapGatherYieldOutput,
  type WorldMapNeutralGatherEvent,
  type WorldMapNeutralGatheringResolutionResponseDto,
  type WorldMapNeutralNodeSpawnTableRow,
  type WorldMapNeutralNodeState,
} from "../domain";
import type {
  WorldMapGatherMarchRuntimeState,
  WorldMapGatherMarchStateRepository,
  WorldMapNeutralNodeRuntimeState,
  WorldMapNeutralNodeStateRepository,
} from "../ports";

const DEFAULT_TRAVEL_SECONDS_PER_LEG = 30;
const DEFAULT_AMBUSH_INTERCEPT_YIELD_MULTIPLIER = 0;

export interface WorldMapNeutralNodeSpawnInput {
  readonly world_id: string;
  readonly world_seed: string;
  readonly map_size: number;
  readonly spawn_table: readonly WorldMapNeutralNodeSpawnTableRow[];
}

export interface WorldMapGatherMarchStartInput {
  readonly world_id: string;
  readonly world_seed: string;
  readonly march_id: string;
  readonly settlement_id: string;
  readonly army_name?: string;
  readonly node_id: string;
  readonly departed_at?: Date;
  readonly travel_seconds_per_leg?: number;
  readonly escort_strength: number;
}

export interface WorldMapGatherMarchAdvanceInput {
  readonly march_id: string;
  readonly observed_at?: Date;
}

export interface WorldMapNeutralGatheringService {
  spawnNeutralNodes(input: WorldMapNeutralNodeSpawnInput): readonly WorldMapNeutralNodeRuntimeState[];
  startGatherMarch(
    input: WorldMapGatherMarchStartInput,
  ): WorldMapNeutralGatheringResolutionResponseDto;
  advanceGatherMarch(
    input: WorldMapGatherMarchAdvanceInput,
  ): WorldMapNeutralGatheringResolutionResponseDto;
}

export class WorldMapNeutralNodeNotFoundError extends Error {
  readonly status_code = 404;
  readonly code = "neutral_node_not_found" as const;

  constructor(message: string) {
    super(message);
    this.name = "WorldMapNeutralNodeNotFoundError";
  }
}

export class WorldMapNeutralNodeDepletedError extends Error {
  readonly status_code = 409;
  readonly code = "neutral_node_depleted" as const;

  constructor(message: string) {
    super(message);
    this.name = "WorldMapNeutralNodeDepletedError";
  }
}

export class WorldMapGatherMarchNotFoundError extends Error {
  readonly status_code = 404;
  readonly code = "gather_march_not_found" as const;

  constructor(message: string) {
    super(message);
    this.name = "WorldMapGatherMarchNotFoundError";
  }
}

export class WorldMapGatherMarchConflictError extends Error {
  readonly status_code = 409;
  readonly code = "gather_march_already_exists" as const;

  constructor(message: string) {
    super(message);
    this.name = "WorldMapGatherMarchConflictError";
  }
}

export class DeterministicWorldMapNeutralGatheringService
  implements WorldMapNeutralGatheringService
{
  private readonly defaultTravelSecondsPerLeg: number;
  private readonly ambushInterceptYieldMultiplier: number;
  private readonly ambushResolutionService: DeterministicAmbushResolutionService;

  constructor(
    private readonly neutralNodeRepository: WorldMapNeutralNodeStateRepository,
    private readonly gatherMarchRepository: WorldMapGatherMarchStateRepository,
    options?: {
      readonly default_travel_seconds_per_leg?: number;
      readonly ambush_intercept_yield_multiplier?: number;
      readonly ambush_resolution_service?: DeterministicAmbushResolutionService;
    },
  ) {
    this.defaultTravelSecondsPerLeg = normalizeMinimumPositiveInteger(
      options?.default_travel_seconds_per_leg,
      DEFAULT_TRAVEL_SECONDS_PER_LEG,
    );
    this.ambushInterceptYieldMultiplier = normalizeBetweenZeroAndOne(
      options?.ambush_intercept_yield_multiplier,
      DEFAULT_AMBUSH_INTERCEPT_YIELD_MULTIPLIER,
    );
    this.ambushResolutionService =
      options?.ambush_resolution_service ?? new DeterministicAmbushResolutionService();
  }

  spawnNeutralNodes(input: WorldMapNeutralNodeSpawnInput): readonly WorldMapNeutralNodeRuntimeState[] {
    const worldId = normalizeNonEmpty(input.world_id, "world_unknown");
    const worldSeed = normalizeNonEmpty(input.world_seed, "world_seed_unknown");
    const mapSize = normalizeMinimumPositiveInteger(input.map_size, 1);
    const totalTiles = mapSize * mapSize;
    const spawnRows = input.spawn_table.map((row) => normalizeSpawnTableRow(row));
    const occupied = new Set<string>();
    for (const existingNode of this.neutralNodeRepository.listNeutralNodeRuntimeStates({
      world_id: worldId,
    })) {
      occupied.add(toTileKey(existingNode.coordinate.x, existingNode.coordinate.y));
    }

    const nodeCountersByType = new Map<string, number>();
    const spawnedNodes: WorldMapNeutralNodeRuntimeState[] = [];

    for (let rowIndex = 0; rowIndex < spawnRows.length; rowIndex += 1) {
      const row = spawnRows[rowIndex];
      for (let spawnOrdinal = 0; spawnOrdinal < row.spawn_count; spawnOrdinal += 1) {
        const nextTypeOrdinal = (nodeCountersByType.get(row.node_type) ?? 0) + 1;
        nodeCountersByType.set(row.node_type, nextTypeOrdinal);
        const nodeId = `${row.node_type}_${nextTypeOrdinal}`;
        const existingNode = this.neutralNodeRepository.readNeutralNodeRuntimeState({
          world_id: worldId,
          node_id: nodeId,
        });
        if (existingNode !== null) {
          spawnedNodes.push(existingNode);
          occupied.add(toTileKey(existingNode.coordinate.x, existingNode.coordinate.y));
          continue;
        }

        const coordinate = resolveDeterministicCoordinate({
          world_seed: worldSeed,
          node_type: row.node_type,
          row_index: rowIndex,
          spawn_ordinal: spawnOrdinal,
          map_size: mapSize,
          total_tiles: totalTiles,
          occupied_tiles: occupied,
        });
        occupied.add(toTileKey(coordinate.x, coordinate.y));

        const savedNode = this.neutralNodeRepository.saveNeutralNodeRuntimeState({
          world_id: worldId,
          node_id: nodeId,
          node_type: row.node_type,
          node_label: row.node_label,
          coordinate,
          node_state: "neutral_node_active",
          node_revision: 1,
          gather_duration_seconds: row.gather_duration_seconds,
          yield_ranges: row.yield_ranges.map((yieldRange) => ({ ...yieldRange })),
          ambush_risk_pct: row.ambush_risk_pct,
          ambush_base_strength: row.ambush_base_strength,
          remaining_cycles: row.depletion_cycles,
        });
        spawnedNodes.push(savedNode);
      }
    }

    return spawnedNodes;
  }

  startGatherMarch(input: WorldMapGatherMarchStartInput): WorldMapNeutralGatheringResolutionResponseDto {
    const worldId = normalizeNonEmpty(input.world_id, "world_unknown");
    const worldSeed = normalizeNonEmpty(input.world_seed, "world_seed_unknown");
    const marchId = normalizeNonEmpty(input.march_id, "gather_march_unknown");
    const settlementId = normalizeNonEmpty(input.settlement_id, "settlement_unknown");
    const armyName = normalizeNonEmpty(input.army_name, "Gathering Party");
    const nodeId = normalizeNonEmpty(input.node_id, "neutral_node_unknown");
    const departedAt = input.departed_at ?? new Date();
    const travelSecondsPerLeg = normalizeMinimumPositiveInteger(
      input.travel_seconds_per_leg,
      this.defaultTravelSecondsPerLeg,
    );
    const escortStrength = normalizeNonNegativeInteger(input.escort_strength);

    const existingMarch = this.gatherMarchRepository.readGatherMarchRuntimeState({
      march_id: marchId,
    });
    if (existingMarch !== null) {
      throw new WorldMapGatherMarchConflictError(
        `Gather march '${marchId}' is already registered.`,
      );
    }

    const nodeState = this.neutralNodeRepository.readNeutralNodeRuntimeState({
      world_id: worldId,
      node_id: nodeId,
    });
    if (nodeState === null) {
      throw new WorldMapNeutralNodeNotFoundError(
        `Neutral node '${nodeId}' is not registered for world '${worldId}'.`,
      );
    }
    if (normalizeNeutralNodeState(nodeState.node_state) === "neutral_node_depleted") {
      throw new WorldMapNeutralNodeDepletedError(
        `Neutral node '${nodeId}' is depleted and cannot be gathered.`,
      );
    }

    const completesAt = new Date(
      departedAt.getTime()
      + (travelSecondsPerLeg * 2 + nodeState.gather_duration_seconds) * 1000,
    );
    const savedMarch = this.gatherMarchRepository.saveGatherMarchRuntimeState({
      world_id: worldId,
      deterministic_seed: worldSeed,
      march_id: marchId,
      settlement_id: settlementId,
      army_name: armyName,
      node_id: nodeId,
      march_revision: 1,
      march_state: "gather_march_in_progress",
      started_at: new Date(departedAt.getTime()),
      completes_at: completesAt,
      escort_strength: escortStrength,
      gathered_yield: [],
      ambush_roll: 0,
      ambush_triggered: false,
      ambush_strength: 0,
      ambush_outcome: "ambush_not_triggered",
    });

    const startEvent: WorldMapNeutralGatherEvent = {
      content_key: "event.world.gather_started",
      tokens: {
        army_name: savedMarch.army_name,
        node_label: nodeState.node_label,
      },
    };

    return createGatheringResponse({
      march: savedMarch,
      node: nodeState,
      observed_at: departedAt,
      events: [startEvent],
    });
  }

  advanceGatherMarch(input: WorldMapGatherMarchAdvanceInput): WorldMapNeutralGatheringResolutionResponseDto {
    const marchId = normalizeNonEmpty(input.march_id, "gather_march_unknown");
    const observedAt = input.observed_at ?? new Date();
    const currentMarch = this.gatherMarchRepository.readGatherMarchRuntimeState({
      march_id: marchId,
    });
    if (currentMarch === null) {
      throw new WorldMapGatherMarchNotFoundError(
        `Gather march '${marchId}' is not registered in runtime state.`,
      );
    }

    const currentNode = this.neutralNodeRepository.readNeutralNodeRuntimeState({
      world_id: currentMarch.world_id,
      node_id: currentMarch.node_id,
    });
    if (currentNode === null) {
      throw new WorldMapNeutralNodeNotFoundError(
        `Neutral node '${currentMarch.node_id}' is not registered for world '${currentMarch.world_id}'.`,
      );
    }

    const normalizedMarchState = normalizeGatherMarchState(currentMarch.march_state);
    if (
      normalizedMarchState === "gather_march_resolved"
      || observedAt.getTime() < currentMarch.completes_at.getTime()
    ) {
      return createGatheringResponse({
        march: currentMarch,
        node: currentNode,
        observed_at: observedAt,
        events: [],
      });
    }

    const baseYield = resolveDeterministicYield({
      encounter_seed: `${currentMarch.deterministic_seed}:${currentMarch.march_id}:${currentNode.node_id}`,
      yield_ranges: currentNode.yield_ranges,
    });
    const ambushResolution = this.ambushResolutionService.resolveAmbush({
      deterministic_seed: currentMarch.deterministic_seed,
      encounter_id: `${currentMarch.march_id}:${currentNode.node_id}`,
      ambush_risk_pct: currentNode.ambush_risk_pct,
      escort_strength: currentMarch.escort_strength,
      ambush_base_strength: currentNode.ambush_base_strength,
    });
    const resolvedYield = applyAmbushYieldOutcome(
      baseYield,
      ambushResolution,
      this.ambushInterceptYieldMultiplier,
    );
    const haulSummary = toHaulSummary(resolvedYield);

    const updatedMarch = this.gatherMarchRepository.saveGatherMarchRuntimeState({
      ...currentMarch,
      march_revision: currentMarch.march_revision + 1,
      march_state: "gather_march_resolved",
      gathered_yield: resolvedYield,
      ambush_roll: ambushResolution.ambush_roll,
      ambush_triggered: ambushResolution.ambush_triggered,
      ambush_strength: ambushResolution.ambush_strength,
      ambush_outcome: ambushResolution.outcome,
      resolved_at: new Date(currentMarch.completes_at.getTime()),
    });

    const updatedNode = this.updateNodeStateAfterGather(currentNode);
    const events = createResolutionEvents({
      march: updatedMarch,
      node: updatedNode,
      ambush: ambushResolution,
      haul_summary: haulSummary,
    });

    return createGatheringResponse({
      march: updatedMarch,
      node: updatedNode,
      observed_at: observedAt,
      events,
    });
  }

  private updateNodeStateAfterGather(
    node: WorldMapNeutralNodeRuntimeState,
  ): WorldMapNeutralNodeRuntimeState {
    const remainingCycles = Math.max(0, node.remaining_cycles - 1);
    return this.neutralNodeRepository.saveNeutralNodeRuntimeState({
      ...node,
      node_revision: node.node_revision + 1,
      remaining_cycles: remainingCycles,
      node_state: remainingCycles > 0 ? "neutral_node_active" : "neutral_node_depleted",
    });
  }
}

function createGatheringResponse(input: {
  readonly march: WorldMapGatherMarchRuntimeState;
  readonly node: WorldMapNeutralNodeRuntimeState;
  readonly observed_at: Date;
  readonly events: readonly WorldMapNeutralGatherEvent[];
}): WorldMapNeutralGatheringResolutionResponseDto {
  return {
    flow: WORLD_MAP_NEUTRAL_GATHERING_FLOW,
    world_id: input.march.world_id,
    march_id: input.march.march_id,
    march_revision: input.march.march_revision,
    march_state: normalizeGatherMarchState(input.march.march_state),
    node_id: input.node.node_id,
    node_revision: input.node.node_revision,
    observed_at: new Date(input.observed_at.getTime()),
    resolved_at:
      input.march.resolved_at === undefined
        ? undefined
        : new Date(input.march.resolved_at.getTime()),
    gathered_yield: input.march.gathered_yield.map((yieldOutput) => ({ ...yieldOutput })),
    ambush: {
      ambush_triggered: input.march.ambush_triggered,
      ambush_roll: input.march.ambush_roll,
      ambush_strength: input.march.ambush_strength,
      escort_strength: input.march.escort_strength,
      outcome: input.march.ambush_outcome,
    },
    events: input.events.map((event) => cloneEvent(event)),
  };
}

function cloneEvent(event: WorldMapNeutralGatherEvent): WorldMapNeutralGatherEvent {
  return {
    ...event,
    tokens: { ...event.tokens },
  };
}

function createResolutionEvents(input: {
  readonly march: WorldMapGatherMarchRuntimeState;
  readonly node: WorldMapNeutralNodeRuntimeState;
  readonly ambush: DeterministicAmbushResolutionResult;
  readonly haul_summary: string;
}): readonly WorldMapNeutralGatherEvent[] {
  const events: WorldMapNeutralGatherEvent[] = [];

  if (input.ambush.ambush_triggered) {
    events.push({
      content_key: "event.world.ambush_triggered",
      tokens: {
        army_name: input.march.army_name,
        node_label: input.node.node_label,
        ambush_strength: String(input.ambush.ambush_strength),
      },
    });
    events.push({
      content_key: "event.world.ambush_resolved",
      tokens: {
        army_name: input.march.army_name,
        node_label: input.node.node_label,
        ambush_outcome: input.ambush.outcome,
        haul_summary: input.haul_summary,
      },
    });
  }

  events.push({
    content_key: "event.world.gather_completed",
    tokens: {
      army_name: input.march.army_name,
      node_label: input.node.node_label,
      haul_summary: input.haul_summary,
    },
  });

  return events;
}

function resolveDeterministicYield(input: {
  readonly encounter_seed: string;
  readonly yield_ranges: readonly {
    readonly resource_id: string;
    readonly min_amount: number;
    readonly max_amount: number;
  }[];
}): readonly WorldMapGatherYieldOutput[] {
  const yieldOutputs: WorldMapGatherYieldOutput[] = [];
  for (const yieldRange of input.yield_ranges) {
    const minAmount = normalizeNonNegativeInteger(yieldRange.min_amount);
    const maxAmount = Math.max(minAmount, normalizeNonNegativeInteger(yieldRange.max_amount));
    const spread = maxAmount - minAmount + 1;
    const hash = hashDeterministicSeed(`${input.encounter_seed}:${yieldRange.resource_id}`);
    const amount = minAmount + (spread <= 0 ? 0 : hash % spread);
    if (amount <= 0) {
      continue;
    }
    yieldOutputs.push({
      resource_id: normalizeNonEmpty(yieldRange.resource_id, "resource_unknown"),
      amount,
    });
  }
  return yieldOutputs;
}

function applyAmbushYieldOutcome(
  yieldOutputs: readonly WorldMapGatherYieldOutput[],
  ambushResolution: DeterministicAmbushResolutionResult,
  interceptMultiplier: number,
): readonly WorldMapGatherYieldOutput[] {
  if (ambushResolution.outcome !== "ambush_intercepted") {
    return yieldOutputs.map((yieldOutput) => ({ ...yieldOutput }));
  }

  return yieldOutputs
    .map((yieldOutput) => ({
      resource_id: yieldOutput.resource_id,
      amount: Math.max(0, Math.floor(yieldOutput.amount * interceptMultiplier)),
    }))
    .filter((yieldOutput) => yieldOutput.amount > 0);
}

function toHaulSummary(yieldOutputs: readonly WorldMapGatherYieldOutput[]): string {
  if (yieldOutputs.length === 0) {
    return "no haul";
  }
  return yieldOutputs
    .map((yieldOutput) => `${yieldOutput.resource_id}:${yieldOutput.amount}`)
    .join(", ");
}

function resolveDeterministicCoordinate(input: {
  readonly world_seed: string;
  readonly node_type: string;
  readonly row_index: number;
  readonly spawn_ordinal: number;
  readonly map_size: number;
  readonly total_tiles: number;
  readonly occupied_tiles: Set<string>;
}): { readonly x: number; readonly y: number } {
  const source = `${input.world_seed}:${input.node_type}:${input.row_index}:${input.spawn_ordinal}`;
  const baseIndex = hashDeterministicSeed(source) % input.total_tiles;

  for (let offset = 0; offset < input.total_tiles; offset += 1) {
    const candidateIndex = (baseIndex + offset) % input.total_tiles;
    const x = candidateIndex % input.map_size;
    const y = Math.floor(candidateIndex / input.map_size);
    const key = toTileKey(x, y);
    if (!input.occupied_tiles.has(key)) {
      return { x, y };
    }
  }

  return {
    x: baseIndex % input.map_size,
    y: Math.floor(baseIndex / input.map_size),
  };
}

function normalizeSpawnTableRow(
  row: WorldMapNeutralNodeSpawnTableRow,
): WorldMapNeutralNodeSpawnTableRow {
  return {
    node_type: normalizeNonEmpty(row.node_type, "neutral_node_unknown"),
    node_label: normalizeNonEmpty(row.node_label, "Unknown Node"),
    spawn_count: normalizeMinimumPositiveInteger(row.spawn_count, 1),
    yield_ranges: row.yield_ranges.map((yieldRange) => ({
      resource_id: normalizeNonEmpty(yieldRange.resource_id, "resource_unknown"),
      min_amount: normalizeNonNegativeInteger(yieldRange.min_amount),
      max_amount: normalizeNonNegativeInteger(yieldRange.max_amount),
    })),
    gather_duration_seconds: normalizeMinimumPositiveInteger(
      row.gather_duration_seconds,
      30,
    ),
    ambush_risk_pct: normalizeRiskPercent(row.ambush_risk_pct),
    ambush_base_strength: normalizeNonNegativeInteger(row.ambush_base_strength),
    depletion_cycles: normalizeMinimumPositiveInteger(row.depletion_cycles, 1),
  };
}

function normalizeGatherMarchState(value: string): WorldMapGatherMarchState {
  if (value === "gather_march_resolved") {
    return "gather_march_resolved";
  }
  return "gather_march_in_progress";
}

function normalizeNeutralNodeState(value: string): WorldMapNeutralNodeState {
  if (value === "neutral_node_depleted") {
    return "neutral_node_depleted";
  }
  return "neutral_node_active";
}

function normalizeNonNegativeInteger(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.trunc(value));
}

function normalizeMinimumPositiveInteger(
  value: number | undefined,
  fallback: number,
): number {
  if (value === undefined || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(1, Math.trunc(value));
}

function normalizeNonEmpty(value: string | undefined, fallback: string): string {
  if (value === undefined) {
    return fallback;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : fallback;
}

function normalizeRiskPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.trunc(value)));
}

function normalizeBetweenZeroAndOne(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(0, Math.min(1, value));
}

function hashDeterministicSeed(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function toTileKey(x: number, y: number): string {
  return `${x}:${y}`;
}
