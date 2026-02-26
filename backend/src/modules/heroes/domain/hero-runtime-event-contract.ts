export const HERO_RUNTIME_EVENT_CONTENT_KEYS = [
  "event.hero.assigned",
  "event.hero.ability_activated",
  "event.hero.cooldown_complete",
] as const;

export type HeroRuntimeEventContentKey = (typeof HERO_RUNTIME_EVENT_CONTENT_KEYS)[number];

export const HERO_RUNTIME_EVENT_TOKENS = [
  "hero_id",
  "ability_id",
  "assignment_context_type",
  "assignment_context_id",
  "cooldown_ends_at",
] as const;

export type HeroRuntimeEventToken = (typeof HERO_RUNTIME_EVENT_TOKENS)[number];

export type HeroRuntimeAssignmentContextToken =
  | "army"
  | "scout_detachment"
  | "siege_column";

export interface HeroRuntimeEventTokenizedPayload {
  readonly content_key: HeroRuntimeEventContentKey;
  readonly tokens: Readonly<Record<string, string>>;
}

export interface HeroAssignedRuntimeEvent extends HeroRuntimeEventTokenizedPayload {
  readonly content_key: "event.hero.assigned";
  readonly tokens: {
    readonly hero_id: string;
    readonly assignment_context_type: HeroRuntimeAssignmentContextToken;
    readonly assignment_context_id: string;
  };
}

export interface HeroAbilityActivatedRuntimeEvent extends HeroRuntimeEventTokenizedPayload {
  readonly content_key: "event.hero.ability_activated";
  readonly tokens: {
    readonly hero_id: string;
    readonly ability_id: string;
    readonly assignment_context_type: HeroRuntimeAssignmentContextToken;
    readonly assignment_context_id: string;
    readonly cooldown_ends_at: string;
  };
}

export interface HeroCooldownCompleteRuntimeEvent extends HeroRuntimeEventTokenizedPayload {
  readonly content_key: "event.hero.cooldown_complete";
  readonly tokens: {
    readonly hero_id: string;
    readonly ability_id: string;
  };
}

export type HeroRuntimeEvent =
  | HeroAssignedRuntimeEvent
  | HeroAbilityActivatedRuntimeEvent
  | HeroCooldownCompleteRuntimeEvent;

export interface CreateHeroAssignedRuntimeEventInput {
  readonly hero_id: string;
  readonly assignment_context_type: HeroRuntimeAssignmentContextToken;
  readonly assignment_context_id: string;
}

export interface CreateHeroAbilityActivatedRuntimeEventInput {
  readonly hero_id: string;
  readonly ability_id: string;
  readonly assignment_context_type: HeroRuntimeAssignmentContextToken;
  readonly assignment_context_id: string;
  readonly cooldown_ends_at: string;
}

export interface CreateHeroCooldownCompleteRuntimeEventInput {
  readonly hero_id: string;
  readonly ability_id: string;
}

export const createHeroAssignedRuntimeEvent = (
  input: CreateHeroAssignedRuntimeEventInput,
): HeroAssignedRuntimeEvent => ({
  content_key: "event.hero.assigned",
  tokens: {
    hero_id: input.hero_id,
    assignment_context_type: input.assignment_context_type,
    assignment_context_id: input.assignment_context_id,
  },
});

export const createHeroAbilityActivatedRuntimeEvent = (
  input: CreateHeroAbilityActivatedRuntimeEventInput,
): HeroAbilityActivatedRuntimeEvent => ({
  content_key: "event.hero.ability_activated",
  tokens: {
    hero_id: input.hero_id,
    ability_id: input.ability_id,
    assignment_context_type: input.assignment_context_type,
    assignment_context_id: input.assignment_context_id,
    cooldown_ends_at: input.cooldown_ends_at,
  },
});

export const createHeroCooldownCompleteRuntimeEvent = (
  input: CreateHeroCooldownCompleteRuntimeEventInput,
): HeroCooldownCompleteRuntimeEvent => ({
  content_key: "event.hero.cooldown_complete",
  tokens: {
    hero_id: input.hero_id,
    ability_id: input.ability_id,
  },
});
