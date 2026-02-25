import type { Instant } from "./time";

export interface IntegrationEvent<TPayload = unknown> {
  readonly type: string;
  readonly occurredAt: Instant;
  readonly payload: TPayload;
  readonly correlationId?: string;
}

export type IntegrationEventHandler<TEvent extends IntegrationEvent = IntegrationEvent> =
  (event: TEvent) => void | Promise<void>;

export interface EventSubscription {
  unsubscribe(): void;
}

export interface InProcessEventBus {
  publish<TEvent extends IntegrationEvent>(event: TEvent): Promise<void>;
  subscribe<TEvent extends IntegrationEvent = IntegrationEvent>(
    eventType: string,
    handler: IntegrationEventHandler<TEvent>,
  ): EventSubscription;
}
