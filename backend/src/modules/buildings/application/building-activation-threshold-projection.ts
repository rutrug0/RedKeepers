import {
  createBuildingActivationThresholdEvaluatorFromStarterData,
  type BuildingActivationThresholdEvaluationInput,
  type BuildingActivationThresholdPhase,
  type BuildingActivationThresholdPhaseEvaluation,
  type StarterBuildingActivationThresholdDefinition,
  type StarterBuildingActivationThresholdsTable,
} from "./building-activation-threshold-evaluator";

export type BuildingReadProjectionBuildingId = string;

export interface BuildingActivationPhaseStateDto {
  readonly threshold_phase: BuildingActivationThresholdPhase;
  readonly is_met: boolean;
  readonly required_rule_ids: readonly string[];
  readonly failed_rule_ids: readonly string[];
}

export interface BuildingActivationReadModelItem {
  readonly building_id: BuildingReadProjectionBuildingId;
  readonly reveal: BuildingActivationPhaseStateDto | null;
  readonly unlock: BuildingActivationPhaseStateDto | null;
  readonly phase_evaluations: readonly BuildingActivationPhaseStateDto[];
}

export interface SettlementBuildingActivationReadProjection {
  readonly buildings: readonly BuildingActivationReadModelItem[];
}

export interface SettlementBuildingActivationReadInput
  extends BuildingActivationThresholdEvaluationInput {}

export interface SettlementBuildingActivationReadModel {
  project(input: SettlementBuildingActivationReadInput): SettlementBuildingActivationReadProjection;
}

export const createSettlementBuildingActivationReadModelFromStarterData = (
  buildingActivationThresholds: StarterBuildingActivationThresholdsTable,
): DeterministicSettlementBuildingActivationReadModel =>
  new DeterministicSettlementBuildingActivationReadModel({
    thresholds: buildingActivationThresholds.rows,
  });

export class DeterministicSettlementBuildingActivationReadModel
  implements SettlementBuildingActivationReadModel
{
  private readonly evaluator: ReturnType<
    typeof createBuildingActivationThresholdEvaluatorFromStarterData
  >;

  constructor(options: {
    readonly thresholds: readonly StarterBuildingActivationThresholdDefinition[];
  }) {
    this.evaluator = createBuildingActivationThresholdEvaluatorFromStarterData({
      rows: options.thresholds,
    });
  }

  public project(
    input: SettlementBuildingActivationReadInput,
  ): SettlementBuildingActivationReadProjection {
    const phaseEvaluations = this.evaluator.evaluate(input).phase_evaluations;
    if (phaseEvaluations.length === 0) {
      return { buildings: [] };
    }

    const states = new Map<
      string,
      {
        reveal: BuildingActivationPhaseStateDto | null;
        unlock: BuildingActivationPhaseStateDto | null;
        phase_evaluations: BuildingActivationPhaseStateDto[];
      }
    >();

    for (const evaluation of phaseEvaluations) {
      const state = states.get(evaluation.building_id) ?? {
        reveal: null,
        unlock: null,
        phase_evaluations: [],
      };
      const phaseState = mapPhaseEvaluation(evaluation);

      if (evaluation.threshold_phase === "reveal") {
        state.reveal = phaseState;
      }

      if (evaluation.threshold_phase === "unlock") {
        state.unlock = phaseState;
      }

      state.phase_evaluations.push(phaseState);
      states.set(evaluation.building_id, state);
    }

    const buildings = Array.from(states.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([buildingId, state]) => ({
        building_id: buildingId,
        reveal: state.reveal,
        unlock: state.unlock,
        phase_evaluations: state.phase_evaluations,
      }));

    return { buildings };
  }
}

function mapPhaseEvaluation(
  evaluation: BuildingActivationThresholdPhaseEvaluation,
): BuildingActivationPhaseStateDto {
  return {
    threshold_phase: evaluation.threshold_phase,
    is_met: evaluation.is_met,
    required_rule_ids: evaluation.required_rule_ids,
    failed_rule_ids: evaluation.failed_rule_ids,
  };
}
