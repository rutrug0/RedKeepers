import type { AppError, Clock, InProcessEventBus, Result } from "../shared";

export interface ServiceToken<TService> {
  readonly key: string;
  readonly description?: string;
}

export interface ServiceRegistry {
  register<TService>(token: ServiceToken<TService>, service: TService): void;
  resolve<TService>(token: ServiceToken<TService>): TService;
  tryResolve<TService>(token: ServiceToken<TService>): TService | null;
}

export interface LifecycleHook {
  readonly name: string;
  start?(): void | Promise<void>;
  stop?(): void | Promise<void>;
}

export interface ModuleRegistrationContext {
  readonly clock: Clock;
  readonly eventBus: InProcessEventBus;
  readonly services: ServiceRegistry;
  addLifecycleHook(hook: LifecycleHook): void;
}

export interface BackendModule {
  readonly moduleId: string;
  register(
    context: ModuleRegistrationContext,
  ): Result<void, AppError> | Promise<Result<void, AppError>>;
}

export interface BootstrapDependencies {
  readonly clock: Clock;
  readonly eventBus: InProcessEventBus;
  readonly services: ServiceRegistry;
}

export interface ApplicationComposition {
  readonly modules: readonly BackendModule[];
  readonly dependencies: BootstrapDependencies;
  readonly lifecycleHooks: readonly LifecycleHook[];
}

export interface ApplicationBootstrapContract {
  compose(input: {
    readonly modules: readonly BackendModule[];
    readonly dependencies: BootstrapDependencies;
  }): Promise<Result<ApplicationComposition, AppError>>;
}
