import type {
  WorldMapHostileAttackResolvedResponseDto,
  WorldMapMarchCombatOutcome,
} from "../domain";
import {
  WORLD_MAP_HOSTILE_ATTACK_FLOW,
} from "../domain";
import type { WorldMapMarchStateRepository } from "../ports";
import type {
  WorldMapMarchDispatchService,
} from "./world-map-march-dispatch-service";
import type {
  WorldMapMarchSnapshotService,
} from "./world-map-march-snapshot-service";
import { WorldMapMarchDispatchOperationError } from "./world-map-march-dispatch-service";

const DEFAULT_ARMY_NAME = "Raid Column";
const DEFAULT_TARGET_TILE_LABEL = "Hostile Settlement";
const DEFAULT_MAX_ACTIVE_MARCHES = 2;
const DEFAULT_WORLD_SEED = "seed_world_alpha";
const DEFAULT_MAP_SIZE = 16;
const IMPASSABLE_TILE_HASH_MODULUS = 11;

const OUTCOME_LOSS_RATIOS: Readonly<Record<WorldMapMarchCombatOutcome, {
  readonly attacker: number;
  readonly defender: number;
}>> = {
  attacker_win: {
    attacker: 0.25,
    defender: 1,
  },
  defender_win: {
    attacker: 1,
    defender: 0.2,
  },
};

export interface WorldMapHostileAttackDispatchedUnitInput {
  readonly unit_id: string;
  readonly unit_count: number;
  readonly unit_attack: number;
}

export interface WorldMapHostileAttackCommandInput {
  readonly march_id: string;
  readonly source_settlement_id: string;
  readonly source_settlement_name?: string;
  readonly target_settlement_id: string;
  readonly target_settlement_name?: string;
  readonly target_tile_label?: string;
  readonly origin: {
    readonly x: number;
    readonly y: number;
  };
  readonly target: {
    readonly x: number;
    readonly y: number;
  };
  readonly dispatched_units: readonly WorldMapHostileAttackDispatchedUnitInput[];
  readonly defender_garrison_strength: number;
  readonly departed_at?: Date;
  readonly seconds_per_tile?: number;
  readonly army_name?: string;
}

export interface WorldMapHostileAttackService {
  resolveHostileAttack(input: WorldMapHostileAttackCommandInput): WorldMapHostileAttackResolvedResponseDto;
}

export type WorldMapHostileAttackOperationErrorCode =
  | "source_target_not_foreign"
  | "march_already_exists"
  | "max_active_marches_reached"
  | "path_blocked_impassable";

export class WorldMapHostileAttackOperationError extends Error {
  readonly status_code = 409;

  constructor(
    readonly code: WorldMapHostileAttackOperationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "WorldMapHostileAttackOperationError";
  }
}

export class DeterministicWorldMapHostileAttackService
  implements WorldMapHostileAttackService
{
  private readonly maxActiveMarches: number;
  private readonly worldSeed: string;
  private readonly mapSize: number;
  private readonly marchStateRepository?: Pick<
    WorldMapMarchStateRepository,
    "listActiveMarchRuntimeStates"
  >;
  private readonly resolveTilePassable: (input: {
    readonly world_seed: string;
    readonly map_size: number;
    readonly coordinate: {
      readonly x: number;
      readonly y: number;
    };
  }) => boolean;

  constructor(
    private readonly marchDispatchService: WorldMapMarchDispatchService,
    private readonly marchSnapshotService: WorldMapMarchSnapshotService,
    options?: {
      readonly max_active_marches?: number;
      readonly world_seed?: string;
      readonly map_size?: number;
      readonly march_state_repository?: Pick<
        WorldMapMarchStateRepository,
        "listActiveMarchRuntimeStates"
      >;
      readonly resolve_tile_passable?: (input: {
        readonly world_seed: string;
        readonly map_size: number;
        readonly coordinate: {
          readonly x: number;
          readonly y: number;
        };
      }) => boolean;
    },
  ) {
    this.maxActiveMarches = normalizeMinimumPositiveInteger(
      options?.max_active_marches,
      DEFAULT_MAX_ACTIVE_MARCHES,
    );
    this.worldSeed = normalizeFallbackText(options?.world_seed, DEFAULT_WORLD_SEED);
    this.mapSize = normalizeMinimumPositiveInteger(options?.map_size, DEFAULT_MAP_SIZE);
    this.marchStateRepository = options?.march_state_repository;
    this.resolveTilePassable = options?.resolve_tile_passable
      ?? resolveDeterministicTilePassable;
  }

  resolveHostileAttack(
    input: WorldMapHostileAttackCommandInput,
  ): WorldMapHostileAttackResolvedResponseDto {
    const marchId = normalizeRequiredText(input.march_id, "march_id");
    const sourceSettlementId = normalizeRequiredText(
      input.source_settlement_id,
      "source_settlement_id",
    );
    const targetSettlementId = normalizeRequiredText(
      input.target_settlement_id,
      "target_settlement_id",
    );
    if (sourceSettlementId === targetSettlementId) {
      throw new WorldMapHostileAttackOperationError(
        "source_target_not_foreign",
        "Attack target settlement must be foreign to the source settlement.",
      );
    }

    const armyName = normalizeFallbackText(input.army_name, DEFAULT_ARMY_NAME);
    const sourceSettlementName = normalizeFallbackText(
      input.source_settlement_name,
      sourceSettlementId,
    );
    const targetTileLabel = normalizeFallbackText(
      input.target_tile_label,
      normalizeFallbackText(input.target_settlement_name, DEFAULT_TARGET_TILE_LABEL),
    );

    const normalizedUnits = input.dispatched_units.map((unit) => ({
      unit_id: normalizeFallbackText(unit.unit_id, "unit_unknown"),
      unit_count: normalizeNonNegativeInteger(unit.unit_count),
      unit_attack: normalizeNonNegativeInteger(unit.unit_attack),
    }));
    const attackerStrength = normalizedUnits.reduce(
      (total, unit) => total + unit.unit_count * unit.unit_attack,
      0,
    );
    const defenderStrength = normalizeNonNegativeInteger(
      input.defender_garrison_strength,
    );
    const origin = {
      x: normalizeFiniteGridCoordinate(input.origin.x),
      y: normalizeFiniteGridCoordinate(input.origin.y),
    };
    const target = {
      x: normalizeFiniteGridCoordinate(input.target.x),
      y: normalizeFiniteGridCoordinate(input.target.y),
    };

    this.assertMarchCapNotExceeded(sourceSettlementId);
    this.assertRoutePassable({
      origin,
      target,
    });

    const dispatch = this.dispatchMarchWithMappedErrors({
      march_id: marchId,
      settlement_id: sourceSettlementId,
      origin,
      target,
      departed_at: input.departed_at,
      seconds_per_tile: normalizeOptionalPositiveInteger(input.seconds_per_tile),
      attacker_strength: attackerStrength,
      defender_strength: defenderStrength,
    });

    const snapshot = this.marchSnapshotService.emitMarchSnapshot({
      march_id: marchId,
      observed_at: dispatch.arrives_at,
    });
    const resolvedAt = snapshot.resolution?.resolved_at ?? dispatch.arrives_at;
    const combatOutcome = snapshot.resolution?.combat_outcome
      ?? resolveCombatOutcome(attackerStrength, defenderStrength);
    const lossRatios = OUTCOME_LOSS_RATIOS[combatOutcome];
    const unitLosses = resolveAttackerUnitLosses(normalizedUnits, lossRatios.attacker);
    const attackerUnitsDispatched = normalizedUnits.reduce(
      (total, unit) => total + unit.unit_count,
      0,
    );
    const attackerUnitsLost = sumRecordValues(unitLosses);
    const defenderGarrisonLost = Math.min(
      defenderStrength,
      Math.floor(defenderStrength * lossRatios.defender),
    );
    const attackerUnitsRemaining = Math.max(0, attackerUnitsDispatched - attackerUnitsLost);
    const defenderGarrisonRemaining = Math.max(0, defenderStrength - defenderGarrisonLost);

    const dispatchEvent = {
      payload_key: "dispatch_sent" as const,
      content_key: "event.world.march_started",
      occurred_at: new Date(dispatch.departed_at.getTime()),
      tokens: {
        army_name: armyName,
        origin_settlement_name: sourceSettlementName,
        target_tile_label: targetTileLabel,
      },
    };
    const marchArrivedEvent = {
      payload_key: "march_arrived" as const,
      content_key: "event.world.march_returned",
      occurred_at: new Date(dispatch.arrives_at.getTime()),
      tokens: {
        army_name: armyName,
        settlement_name: sourceSettlementName,
        haul_summary: `combat:${combatOutcome};attacker_remaining:${attackerUnitsRemaining};defender_remaining:${defenderGarrisonRemaining}`,
      },
    };
    const combatResolvedEvent = {
      payload_key: "combat_resolved" as const,
      content_key: combatOutcome === "attacker_win"
        ? "event.combat.placeholder_skirmish_win"
        : "event.combat.placeholder_skirmish_loss",
      occurred_at: new Date(resolvedAt.getTime()),
      tokens: combatOutcome === "attacker_win"
        ? {
          army_name: armyName,
          target_tile_label: targetTileLabel,
        }
        : {
          army_name: armyName,
          target_tile_label: targetTileLabel,
          settlement_name: sourceSettlementName,
        },
    };

    return {
      flow: WORLD_MAP_HOSTILE_ATTACK_FLOW,
      march_id: snapshot.march_id,
      march_revision: snapshot.march_revision,
      march_state: "march_state_resolved",
      source_settlement_id: sourceSettlementId,
      target_settlement_id: targetSettlementId,
      departed_at: new Date(dispatch.departed_at.getTime()),
      arrives_at: new Date(dispatch.arrives_at.getTime()),
      resolved_at: new Date(resolvedAt.getTime()),
      attacker_strength: attackerStrength,
      defender_strength: defenderStrength,
      combat_outcome: combatOutcome,
      losses: {
        attacker_loss_ratio: lossRatios.attacker,
        defender_loss_ratio: lossRatios.defender,
        attacker_units_dispatched: attackerUnitsDispatched,
        attacker_units_lost: attackerUnitsLost,
        attacker_units_remaining: attackerUnitsRemaining,
        defender_garrison_lost: defenderGarrisonLost,
        defender_garrison_remaining: defenderGarrisonRemaining,
        attacker_unit_losses_by_id: unitLosses,
      },
      event_payloads: {
        dispatch_sent: dispatchEvent,
        march_arrived: marchArrivedEvent,
        combat_resolved: combatResolvedEvent,
      },
      events: [
        dispatchEvent,
        marchArrivedEvent,
        combatResolvedEvent,
      ],
    };
  }

  private dispatchMarchWithMappedErrors(input: {
    readonly march_id: string;
    readonly settlement_id: string;
    readonly origin: {
      readonly x: number;
      readonly y: number;
    };
    readonly target: {
      readonly x: number;
      readonly y: number;
    };
    readonly departed_at?: Date;
    readonly seconds_per_tile?: number;
    readonly attacker_strength: number;
    readonly defender_strength: number;
  }) {
    try {
      return this.marchDispatchService.dispatchMarch(input);
    } catch (error: unknown) {
      if (
        error instanceof WorldMapMarchDispatchOperationError
        && error.code === "march_already_exists"
      ) {
        throw new WorldMapHostileAttackOperationError("march_already_exists", error.message);
      }
      throw error;
    }
  }

  private assertMarchCapNotExceeded(sourceSettlementId: string): void {
    if (this.marchStateRepository === undefined) {
      return;
    }

    const activeMarches = this.marchStateRepository.listActiveMarchRuntimeStates({
      settlement_id: sourceSettlementId,
    });
    if (activeMarches.length >= this.maxActiveMarches) {
      throw new WorldMapHostileAttackOperationError(
        "max_active_marches_reached",
        `Settlement '${sourceSettlementId}' reached active march cap ${this.maxActiveMarches}.`,
      );
    }
  }

  private assertRoutePassable(input: {
    readonly origin: {
      readonly x: number;
      readonly y: number;
    };
    readonly target: {
      readonly x: number;
      readonly y: number;
    };
  }): void {
    const routeTiles = resolveDeterministicRouteTiles(input);
    for (const tile of routeTiles) {
      if (
        !isCoordinateWithinMapBounds({
          coordinate: tile,
          map_size: this.mapSize,
        })
      ) {
        throw new WorldMapHostileAttackOperationError(
          "path_blocked_impassable",
          `Deterministic route blocked at out-of-bounds tile (${tile.x}, ${tile.y}).`,
        );
      }

      const isPassable = this.resolveTilePassable({
        world_seed: this.worldSeed,
        map_size: this.mapSize,
        coordinate: tile,
      });
      if (!isPassable) {
        throw new WorldMapHostileAttackOperationError(
          "path_blocked_impassable",
          `Deterministic route blocked by impassable tile (${tile.x}, ${tile.y}).`,
        );
      }
    }
  }
}

function resolveCombatOutcome(
  attackerStrength: number,
  defenderStrength: number,
): WorldMapMarchCombatOutcome {
  return attackerStrength > defenderStrength ? "attacker_win" : "defender_win";
}

function resolveAttackerUnitLosses(
  dispatchedUnits: readonly {
    readonly unit_id: string;
    readonly unit_count: number;
  }[],
  lossRatio: number,
): Readonly<Record<string, number>> {
  const lossesByUnitId: Record<string, number> = {};
  for (const unit of dispatchedUnits) {
    lossesByUnitId[unit.unit_id] = Math.min(
      unit.unit_count,
      Math.floor(unit.unit_count * lossRatio),
    );
  }
  return lossesByUnitId;
}

function sumRecordValues(input: Readonly<Record<string, number>>): number {
  return Object.values(input).reduce(
    (total, value) => total + normalizeNonNegativeInteger(value),
    0,
  );
}

function normalizeRequiredText(value: string, field: string): string {
  const normalized = value.trim();
  if (normalized.length < 1) {
    throw new Error(`Expected non-empty '${field}'.`);
  }
  return normalized;
}

function normalizeFallbackText(value: string | undefined, fallback: string): string {
  if (value === undefined) {
    return fallback;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : fallback;
}

function normalizeOptionalPositiveInteger(value: number | undefined): number | undefined {
  if (value === undefined || !Number.isFinite(value)) {
    return undefined;
  }
  return Math.max(1, Math.trunc(value));
}

function normalizeMinimumPositiveInteger(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(1, Math.trunc(value));
}

function normalizeNonNegativeInteger(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.trunc(value));
}

function normalizeFiniteNumber(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return value;
}

function normalizeFiniteGridCoordinate(value: number): number {
  return Math.trunc(normalizeFiniteNumber(value));
}

function resolveDeterministicRouteTiles(input: {
  readonly origin: {
    readonly x: number;
    readonly y: number;
  };
  readonly target: {
    readonly x: number;
    readonly y: number;
  };
}): readonly {
  readonly x: number;
  readonly y: number;
}[] {
  const routeTiles: Array<{ readonly x: number; readonly y: number }> = [];
  let cursorX = input.origin.x;
  let cursorY = input.origin.y;
  const xDirection = Math.sign(input.target.x - input.origin.x);
  const yDirection = Math.sign(input.target.y - input.origin.y);

  while (cursorX !== input.target.x) {
    cursorX += xDirection;
    routeTiles.push({ x: cursorX, y: cursorY });
  }
  while (cursorY !== input.target.y) {
    cursorY += yDirection;
    routeTiles.push({ x: cursorX, y: cursorY });
  }

  return routeTiles;
}

function isCoordinateWithinMapBounds(input: {
  readonly coordinate: {
    readonly x: number;
    readonly y: number;
  };
  readonly map_size: number;
}): boolean {
  return input.coordinate.x >= 0
    && input.coordinate.y >= 0
    && input.coordinate.x < input.map_size
    && input.coordinate.y < input.map_size;
}

function resolveDeterministicTilePassable(input: {
  readonly world_seed: string;
  readonly map_size: number;
  readonly coordinate: {
    readonly x: number;
    readonly y: number;
  };
}): boolean {
  if (
    !isCoordinateWithinMapBounds({
      coordinate: input.coordinate,
      map_size: input.map_size,
    })
  ) {
    return false;
  }

  const hash = hashDeterministicSeed(
    `${input.world_seed}:${input.coordinate.x}:${input.coordinate.y}`,
  );
  return hash % IMPASSABLE_TILE_HASH_MODULUS !== 0;
}

function hashDeterministicSeed(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
