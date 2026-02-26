import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface HeroRuntimeSqlExecutionOptions {
  readonly tuples_only?: boolean;
}

export interface HeroRuntimeSqlExecutionResult {
  readonly command: string;
  readonly args: readonly string[];
  readonly exit_code: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

export interface HeroRuntimeMigrationRunner {
  readonly runtime_label: string;
  prepare(): void;
  runSql(
    sql: string,
    options?: HeroRuntimeSqlExecutionOptions,
  ): HeroRuntimeSqlExecutionResult;
  applyMigration(): HeroRuntimeSqlExecutionResult;
  resetHeroRuntimeObjects(): HeroRuntimeSqlExecutionResult;
}

export interface HeroRuntimeMigrationRunnerResolution {
  readonly runner: HeroRuntimeMigrationRunner | null;
  readonly skip_reason?: string;
}

const CURRENT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(
  CURRENT_DIRECTORY,
  "..",
  "..",
  "..",
  "..",
  "..",
  "..",
  "..",
);
const MIGRATION_FILE_PATH = resolve(
  CURRENT_DIRECTORY,
  "20260226_000001_create_hero_runtime_tables_v1.sql",
);
const COMPOSE_FILE_PATH = resolve(PROJECT_ROOT, "infra", "docker-compose.yml");

const DEFAULT_DATABASE_URL =
  "postgresql://redkeepers:redkeepers@127.0.0.1:5432/redkeepers";
const DEFAULT_POSTGRES_DB = "redkeepers";
const DEFAULT_POSTGRES_USER = "redkeepers";
const DEFAULT_POSTGRES_SERVICE = "postgres";

const RESET_HERO_RUNTIME_SQL_V1 = `
DROP TABLE IF EXISTS heroes.hero_modifier_instances_v1;
DROP TABLE IF EXISTS heroes.hero_assignment_bindings_v1;
DROP TABLE IF EXISTS heroes.hero_runtime_states_v1;
DROP TYPE IF EXISTS heroes.hero_modifier_status_v1;
DROP TYPE IF EXISTS heroes.hero_modifier_op_v1;
DROP TYPE IF EXISTS heroes.hero_modifier_domain_v1;
DROP TYPE IF EXISTS heroes.hero_assignment_bound_context_type_v1;
DROP TYPE IF EXISTS heroes.hero_assignment_context_type_v1;
DROP TYPE IF EXISTS heroes.hero_readiness_state_v1;
DROP TYPE IF EXISTS heroes.hero_unlock_state_v1;
`;

const commandExists = (command: string, args: readonly string[]): boolean => {
  const commandResult = spawnSync(command, args, {
    cwd: PROJECT_ROOT,
    encoding: "utf8",
  });
  return commandResult.status === 0;
};

const executeCommand = (
  command: string,
  args: readonly string[],
  stdin?: string,
): HeroRuntimeSqlExecutionResult => {
  const commandResult = spawnSync(command, args, {
    cwd: PROJECT_ROOT,
    encoding: "utf8",
    input: stdin,
  });

  return {
    command,
    args,
    exit_code: commandResult.status,
    stdout: commandResult.stdout ?? "",
    stderr: commandResult.stderr ?? "",
  };
};

const sleepMilliseconds = (milliseconds: number): void => {
  const lock = new Int32Array(new SharedArrayBuffer(4));
  Atomics.wait(lock, 0, 0, milliseconds);
};

class DirectPsqlMigrationRunner implements HeroRuntimeMigrationRunner {
  readonly runtime_label = "direct-psql";

  constructor(private readonly database_url: string) {}

  prepare(): void {
    const probeResult = this.runSql("SELECT 1;");
    if (probeResult.exit_code === 0) {
      return;
    }
    throw new Error(
      `Failed to reach direct Postgres runtime.\n${probeResult.stderr}\n${probeResult.stdout}`,
    );
  }

  runSql(
    sql: string,
    options?: HeroRuntimeSqlExecutionOptions,
  ): HeroRuntimeSqlExecutionResult {
    const args = [
      "--dbname",
      this.database_url,
      "-v",
      "ON_ERROR_STOP=1",
      "-X",
      "-q",
    ];
    if (options?.tuples_only) {
      args.push("-t", "-A");
    }
    args.push("-f", "-");

    return executeCommand("psql", args, sql);
  }

  applyMigration(): HeroRuntimeSqlExecutionResult {
    const migrationSql = readFileSync(MIGRATION_FILE_PATH, "utf8");
    return this.runSql(migrationSql);
  }

  resetHeroRuntimeObjects(): HeroRuntimeSqlExecutionResult {
    return this.runSql(RESET_HERO_RUNTIME_SQL_V1);
  }
}

class DockerComposeMigrationRunner implements HeroRuntimeMigrationRunner {
  readonly runtime_label = "docker-compose-postgres";

  constructor(
    private readonly db: string,
    private readonly user: string,
    private readonly service: string,
  ) {}

  private composeArgs(args: readonly string[]): string[] {
    return ["compose", "-f", COMPOSE_FILE_PATH, ...args];
  }

  private executeComposeCommand(
    args: readonly string[],
    stdin?: string,
  ): HeroRuntimeSqlExecutionResult {
    return executeCommand("docker", this.composeArgs(args), stdin);
  }

  prepare(): void {
    const upResult = this.executeComposeCommand(["up", "-d", this.service]);
    if (upResult.exit_code !== 0) {
      throw new Error(
        `Failed to start docker compose postgres runtime.\n${upResult.stderr}\n${upResult.stdout}`,
      );
    }

    for (let attempt = 0; attempt < 60; attempt += 1) {
      const readyResult = this.executeComposeCommand([
        "exec",
        "-T",
        this.service,
        "pg_isready",
        "-U",
        this.user,
        "-d",
        this.db,
      ]);
      if (readyResult.exit_code === 0) {
        return;
      }
      sleepMilliseconds(500);
    }

    throw new Error("Timed out while waiting for docker postgres runtime readiness.");
  }

  runSql(
    sql: string,
    options?: HeroRuntimeSqlExecutionOptions,
  ): HeroRuntimeSqlExecutionResult {
    const args = [
      "exec",
      "-T",
      this.service,
      "psql",
      "-U",
      this.user,
      "-d",
      this.db,
      "-v",
      "ON_ERROR_STOP=1",
      "-X",
      "-q",
    ];
    if (options?.tuples_only) {
      args.push("-t", "-A");
    }
    args.push("-f", "-");

    return this.executeComposeCommand(args, sql);
  }

  applyMigration(): HeroRuntimeSqlExecutionResult {
    const migrationSql = readFileSync(MIGRATION_FILE_PATH, "utf8");
    return this.runSql(migrationSql);
  }

  resetHeroRuntimeObjects(): HeroRuntimeSqlExecutionResult {
    return this.runSql(RESET_HERO_RUNTIME_SQL_V1);
  }
}

const parseRuntimePreference = (): "auto" | "docker" | "direct" => {
  const rawPreference = (
    process.env.REDKEEPERS_HERO_RUNTIME_DB_RUNTIME ?? "auto"
  ).trim()
    .toLowerCase();
  if (rawPreference === "docker" || rawPreference === "direct") {
    return rawPreference;
  }
  return "auto";
};

export const resolveHeroRuntimeMigrationRunner =
  (): HeroRuntimeMigrationRunnerResolution => {
    const runtimePreference = parseRuntimePreference();
    const canUseDocker =
      commandExists("docker", ["--version"]) &&
      commandExists("docker", ["compose", "version"]);
    const canUseDirectPsql = commandExists("psql", ["--version"]);
    const requestedDatabaseUrl =
      process.env.REDKEEPERS_HERO_RUNTIME_TEST_DB_URL ??
      process.env.DATABASE_URL ??
      DEFAULT_DATABASE_URL;

    const dockerRunner = () =>
      new DockerComposeMigrationRunner(
        process.env.REDKEEPERS_POSTGRES_DB ?? DEFAULT_POSTGRES_DB,
        process.env.REDKEEPERS_POSTGRES_USER ?? DEFAULT_POSTGRES_USER,
        process.env.REDKEEPERS_POSTGRES_SERVICE ?? DEFAULT_POSTGRES_SERVICE,
      );

    const directRunner = () => new DirectPsqlMigrationRunner(requestedDatabaseUrl);

    if (runtimePreference === "docker") {
      if (!canUseDocker) {
        return {
          runner: null,
          skip_reason:
            "REDKEEPERS_HERO_RUNTIME_DB_RUNTIME=docker but docker compose is unavailable.",
        };
      }
      return { runner: dockerRunner() };
    }

    if (runtimePreference === "direct") {
      if (!canUseDirectPsql) {
        return {
          runner: null,
          skip_reason: "REDKEEPERS_HERO_RUNTIME_DB_RUNTIME=direct but psql is unavailable.",
        };
      }
      return { runner: directRunner() };
    }

    if (canUseDocker) {
      return { runner: dockerRunner() };
    }
    if (canUseDirectPsql) {
      return { runner: directRunner() };
    }

    return {
      runner: null,
      skip_reason:
        "No supported Postgres runtime detected. Install docker compose or psql to execute hero runtime migration integration tests.",
    };
  };
