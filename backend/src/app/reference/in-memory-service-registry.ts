import type { ServiceRegistry, ServiceToken } from "../composition";

export class InMemoryServiceRegistry implements ServiceRegistry {
  private readonly servicesByKey = new Map<string, unknown>();

  register<TService>(token: ServiceToken<TService>, service: TService): void {
    if (this.servicesByKey.has(token.key)) {
      throw new Error(`Service already registered: ${token.key}`);
    }

    this.servicesByKey.set(token.key, service);
  }

  resolve<TService>(token: ServiceToken<TService>): TService {
    const service = this.tryResolve(token);

    if (service === null) {
      throw new Error(`Service not registered: ${token.key}`);
    }

    return service;
  }

  tryResolve<TService>(token: ServiceToken<TService>): TService | null {
    if (!this.servicesByKey.has(token.key)) {
      return null;
    }

    return this.servicesByKey.get(token.key) as TService;
  }
}
