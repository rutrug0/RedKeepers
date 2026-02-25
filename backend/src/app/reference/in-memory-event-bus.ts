import type {
  EventSubscription,
  InProcessEventBus,
  IntegrationEvent,
  IntegrationEventHandler,
} from "../../shared";

type AnyEventHandler = IntegrationEventHandler<IntegrationEvent>;

export class InMemoryEventBus implements InProcessEventBus {
  private readonly handlersByEventType = new Map<string, Set<AnyEventHandler>>();

  async publish<TEvent extends IntegrationEvent>(event: TEvent): Promise<void> {
    const handlers = this.handlersByEventType.get(event.type);

    if (handlers === undefined) {
      return;
    }

    for (const handler of Array.from(handlers)) {
      await handler(event);
    }
  }

  subscribe<TEvent extends IntegrationEvent = IntegrationEvent>(
    eventType: string,
    handler: IntegrationEventHandler<TEvent>,
  ): EventSubscription {
    let handlers = this.handlersByEventType.get(eventType);

    if (handlers === undefined) {
      handlers = new Set<AnyEventHandler>();
      this.handlersByEventType.set(eventType, handlers);
    }

    const storedHandler = handler as AnyEventHandler;
    handlers.add(storedHandler);

    let active = true;

    return {
      unsubscribe: () => {
        if (!active) {
          return;
        }

        active = false;
        handlers.delete(storedHandler);

        if (handlers.size === 0) {
          this.handlersByEventType.delete(eventType);
        }
      },
    };
  }
}
