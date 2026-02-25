import { err, ok } from "../../shared";
import type { AppError, Clock, Result } from "../../shared";
import type { BackendModule, ServiceToken } from "../composition";
import { InMemoryEventBus } from "./in-memory-event-bus";
import { InMemoryServiceRegistry } from "./in-memory-service-registry";
import { createReferenceApplicationBootstrap } from "./reference-bootstrap";

interface SmokeService {
  readonly status: "ready";
}

const SMOKE_SERVICE_TOKEN: ServiceToken<SmokeService> = {
  key: "reference.smoke.service",
  description: "Temporary placeholder service used by the reference bootstrap smoke path.",
};

const SMOKE_EVENT_TYPE = "reference.smoke.published";
const SMOKE_LIFECYCLE_HOOK_NAME = "reference.smoke.lifecycle";
const SMOKE_MODULE_ID = "reference.smoke.module";

export interface ReferenceBootstrapSmokeResult {
  readonly moduleIds: readonly string[];
  readonly lifecycleHookNames: readonly string[];
  readonly receivedEventTypes: readonly string[];
  readonly registeredServiceTokenKey: string;
}

export const runReferenceBootstrapSmoke = async (): Promise<
  Result<ReferenceBootstrapSmokeResult, AppError>
> => {
  const clock: Clock = {
    now: () => new Date("2026-01-01T00:00:00.000Z"),
  };
  const eventBus = new InMemoryEventBus();
  const services = new InMemoryServiceRegistry();
  const receivedEventTypes: string[] = [];

  const module: BackendModule = {
    moduleId: SMOKE_MODULE_ID,
    register: (context) => {
      context.services.register(SMOKE_SERVICE_TOKEN, { status: "ready" });
      context.eventBus.subscribe(SMOKE_EVENT_TYPE, async () => {
        receivedEventTypes.push(SMOKE_EVENT_TYPE);
      });
      context.addLifecycleHook({
        name: SMOKE_LIFECYCLE_HOOK_NAME,
      });

      return ok(undefined);
    },
  };

  const bootstrap = createReferenceApplicationBootstrap();
  const composition = await bootstrap.compose({
    modules: [module],
    dependencies: {
      clock,
      eventBus,
      services,
    },
  });

  if (!composition.ok) {
    return composition;
  }

  if (services.tryResolve(SMOKE_SERVICE_TOKEN) === null) {
    return err({
      code: "reference_bootstrap_smoke_missing_service",
      message: `Expected service token '${SMOKE_SERVICE_TOKEN.key}' to be registered by the smoke module.`,
    });
  }

  await eventBus.publish({
    type: SMOKE_EVENT_TYPE,
    occurredAt: clock.now(),
    payload: {
      source: "reference-bootstrap-smoke",
    },
  });

  if (receivedEventTypes.length !== 1) {
    return err({
      code: "reference_bootstrap_smoke_missing_event",
      message: `Expected one '${SMOKE_EVENT_TYPE}' event delivery, received ${receivedEventTypes.length}.`,
      details: {
        receivedEventTypes,
      },
    });
  }

  return ok({
    moduleIds: composition.value.modules.map((registeredModule) => registeredModule.moduleId),
    lifecycleHookNames: composition.value.lifecycleHooks.map((hook) => hook.name),
    receivedEventTypes,
    registeredServiceTokenKey: SMOKE_SERVICE_TOKEN.key,
  });
};
