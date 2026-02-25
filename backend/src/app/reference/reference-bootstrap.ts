import { ok } from "../../shared";
import type { AppError, Result } from "../../shared";
import type {
  ApplicationBootstrapContract,
  ApplicationComposition,
  BackendModule,
  BootstrapDependencies,
  LifecycleHook,
  ModuleRegistrationContext,
} from "../composition";

export class ReferenceApplicationBootstrap implements ApplicationBootstrapContract {
  async compose(input: {
    readonly modules: readonly BackendModule[];
    readonly dependencies: BootstrapDependencies;
  }): Promise<Result<ApplicationComposition, AppError>> {
    const lifecycleHooks: LifecycleHook[] = [];
    const context: ModuleRegistrationContext = {
      clock: input.dependencies.clock,
      eventBus: input.dependencies.eventBus,
      services: input.dependencies.services,
      addLifecycleHook: (hook) => {
        lifecycleHooks.push(hook);
      },
    };

    for (const backendModule of input.modules) {
      const registration = await backendModule.register(context);

      if (!registration.ok) {
        return registration;
      }
    }

    return ok({
      modules: [...input.modules],
      dependencies: input.dependencies,
      lifecycleHooks,
    });
  }
}

export const createReferenceApplicationBootstrap =
  (): ApplicationBootstrapContract => new ReferenceApplicationBootstrap();
