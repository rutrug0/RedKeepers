import { strict as assert } from "node:assert";
import { test } from "node:test";

import { ok } from "../../shared";
import type { BackendModule, Clock, ServiceToken } from "../composition";
import { InMemoryEventBus } from "./in-memory-event-bus";
import { InMemoryServiceRegistry } from "./in-memory-service-registry";
import { ReferenceApplicationBootstrap } from "./reference-bootstrap";

interface ReferenceTestService {
  readonly status: "ready";
}

const TEST_EVENT_TYPE = "reference.test.event";
const TEST_SERVICE_TOKEN: ServiceToken<ReferenceTestService> = {
  key: "reference.test.service",
  description: "Reference adapter contract smoke test service token.",
};

test("ReferenceApplicationBootstrap composes placeholder module and collects lifecycle hooks", async () => {
  const clock: Clock = {
    now: () => new Date("2026-02-25T00:00:00.000Z"),
  };
  const eventBus = new InMemoryEventBus();
  const services = new InMemoryServiceRegistry();
  const bootstrap = new ReferenceApplicationBootstrap();

  const placeholderModule: BackendModule = {
    moduleId: "reference.test.module",
    register: (context) => {
      context.services.register(TEST_SERVICE_TOKEN, { status: "ready" });
      context.addLifecycleHook({
        name: "reference.test.lifecycle",
      });
      return ok(undefined);
    },
  };

  const composition = await bootstrap.compose({
    modules: [placeholderModule],
    dependencies: {
      clock,
      eventBus,
      services,
    },
  });

  assert.equal(composition.ok, true);
  if (!composition.ok) {
    return;
  }

  assert.equal(composition.value.modules.length, 1);
  assert.equal(composition.value.modules[0].moduleId, "reference.test.module");
  assert.equal(composition.value.dependencies.clock, clock);
  assert.equal(composition.value.dependencies.eventBus, eventBus);
  assert.equal(composition.value.dependencies.services, services);
  assert.deepStrictEqual(
    composition.value.lifecycleHooks.map((hook) => hook.name),
    ["reference.test.lifecycle"],
  );
});

test("InMemoryEventBus delivers and then stops delivery after unsubscribe for a single event type", async () => {
  const eventBus = new InMemoryEventBus();
  const receivedPayloads: string[] = [];

  const subscription = eventBus.subscribe(TEST_EVENT_TYPE, async (event) => {
    receivedPayloads.push(String(event.payload));
  });

  await eventBus.publish({
    type: TEST_EVENT_TYPE,
    occurredAt: new Date("2026-02-25T00:00:01.000Z"),
    payload: "first",
  });

  subscription.unsubscribe();
  subscription.unsubscribe();

  await eventBus.publish({
    type: TEST_EVENT_TYPE,
    occurredAt: new Date("2026-02-25T00:00:02.000Z"),
    payload: "second",
  });

  assert.deepStrictEqual(receivedPayloads, ["first"]);
});

test("InMemoryServiceRegistry resolves registered services and rejects duplicate registrations", () => {
  const services = new InMemoryServiceRegistry();
  const service: ReferenceTestService = { status: "ready" };

  assert.equal(services.tryResolve(TEST_SERVICE_TOKEN), null);
  assert.throws(
    () => services.resolve(TEST_SERVICE_TOKEN),
    /Service not registered: reference\.test\.service/,
  );

  services.register(TEST_SERVICE_TOKEN, service);
  assert.equal(services.tryResolve(TEST_SERVICE_TOKEN), service);
  assert.equal(services.resolve(TEST_SERVICE_TOKEN), service);

  assert.throws(
    () => services.register(TEST_SERVICE_TOKEN, service),
    /Service already registered: reference\.test\.service/,
  );
});
