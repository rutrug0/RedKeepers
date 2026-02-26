import type {
  SettlementResourceProjectionService,
  SettlementResourceTickProjection,
} from "../application";

export const POST_SETTLEMENT_TICK_ROUTE = "/settlements/{settlementId}/tick" as const;
export const SETTLEMENT_TICK_FLOW = "settlement.tick_v1" as const;

export interface PostSettlementTickPathParamsDto {
  readonly settlementId: string;
}

export interface PostSettlementTickRequestBodyDto {
  readonly settlement_id: string;
  readonly flow_version: string;
  readonly tick_started_at: string;
  readonly tick_ended_at: string;
  readonly settlement_name?: string;
  readonly resource_stock_by_id?: Readonly<Record<string, number | undefined>>;
  readonly storage_cap_by_id?: Readonly<Record<string, number | undefined>>;
  readonly passive_prod_per_h_by_id?: Readonly<Record<string, number | undefined>>;
  readonly correlation_id?: string;
}

export interface PostSettlementTickRequestDto {
  readonly path: PostSettlementTickPathParamsDto;
  readonly body: PostSettlementTickRequestBodyDto;
}

export type PostSettlementTickResponseDto = SettlementResourceTickProjection & {
  readonly flow: typeof SETTLEMENT_TICK_FLOW;
  readonly status: "accepted";
};

type SettlementTickValidationErrorCode =
  | "missing_settlement_id"
  | "settlement_id_mismatch"
  | "flow_version_not_supported"
  | "missing_tick_started_at"
  | "missing_tick_ended_at"
  | "invalid_tick_started_at"
  | "invalid_tick_ended_at";

export class SettlementTickValidationError extends Error {
  readonly status_code = 400;

  constructor(
    readonly code: SettlementTickValidationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "SettlementTickValidationError";
  }
}

export class SettlementTickEndpointHandler {
  constructor(
    private readonly projectionService: SettlementResourceProjectionService,
  ) {}

  handlePostTick(request: PostSettlementTickRequestDto): PostSettlementTickResponseDto {
    const pathSettlementId = normalizeRequiredId(
      request.path.settlementId,
      "missing_settlement_id",
      "Path `settlementId` is required.",
    );
    const bodySettlementId = normalizeRequiredId(
      request.body.settlement_id,
      "missing_settlement_id",
      "Request body `settlement_id` is required.",
    );
    if (pathSettlementId !== bodySettlementId) {
      throw new SettlementTickValidationError(
        "settlement_id_mismatch",
        "Path `settlementId` must match request body `settlement_id`.",
      );
    }

    if (request.body.flow_version !== "v1") {
      throw new SettlementTickValidationError(
        "flow_version_not_supported",
        "Only `flow_version: v1` is supported for M0.",
      );
    }

    const tickStartedAt = parseRequiredInstant(
      request.body.tick_started_at,
      "missing_tick_started_at",
      "invalid_tick_started_at",
      "Request body `tick_started_at` is required.",
      "Request body `tick_started_at` must be a valid ISO timestamp.",
    );
    const tickEndedAt = parseRequiredInstant(
      request.body.tick_ended_at,
      "missing_tick_ended_at",
      "invalid_tick_ended_at",
      "Request body `tick_ended_at` is required.",
      "Request body `tick_ended_at` must be a valid ISO timestamp.",
    );

    const projection = this.projectionService.tickSettlementResources({
      settlement_id: bodySettlementId,
      settlement_name: normalizeOptionalString(request.body.settlement_name),
      tick_started_at: tickStartedAt,
      tick_ended_at: tickEndedAt,
      resource_stock: request.body.resource_stock_by_id,
      storage_caps: request.body.storage_cap_by_id,
      passive_prod_per_h: request.body.passive_prod_per_h_by_id,
      correlation_id: normalizeOptionalString(request.body.correlation_id),
    });

    return {
      flow: SETTLEMENT_TICK_FLOW,
      status: "accepted",
      ...projection,
    };
  }
}

function normalizeRequiredId(
  value: string,
  code: SettlementTickValidationErrorCode,
  message: string,
): string {
  const normalized = value.trim();
  if (normalized.length < 1) {
    throw new SettlementTickValidationError(code, message);
  }
  return normalized;
}

function parseRequiredInstant(
  value: string,
  missingCode: SettlementTickValidationErrorCode,
  invalidCode: SettlementTickValidationErrorCode,
  missingMessage: string,
  invalidMessage: string,
): Date {
  const normalized = value.trim();
  if (normalized.length < 1) {
    throw new SettlementTickValidationError(missingCode, missingMessage);
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    throw new SettlementTickValidationError(invalidCode, invalidMessage);
  }
  return parsed;
}

function normalizeOptionalString(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}
