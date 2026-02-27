import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  createDeterministicFirstSliceSettlementLoopLocalRpcTransport,
  type FirstSliceSettlementLoopLocalRpcTransport,
  type FirstSliceSettlementLoopRequestByRoute,
  type FirstSliceSettlementLoopRoute,
} from "./local-first-slice-settlement-loop-transport.ts";

const DEFAULT_HTTP_HOST = "127.0.0.1";
const DEFAULT_HTTP_PORT = 8787;
const DEFAULT_MAX_REQUEST_BODY_BYTES = 256 * 1024;
const DEFAULT_INTERNAL_ERROR_STATUS_CODE = 500;

const DEFAULT_JSON_HEADERS = Object.freeze({
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type",
});

const NO_CONTENT_HEADERS = Object.freeze({
  "cache-control": "no-store",
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type",
});

interface CompiledRouteTemplate {
  readonly route_template: FirstSliceSettlementLoopRoute;
  readonly matcher: RegExp;
  readonly parameter_names: readonly string[];
}

interface MatchedRouteTemplate {
  readonly route_template: FirstSliceSettlementLoopRoute;
  readonly path_params: Readonly<Record<string, string>>;
}

interface ParsedRequestBodySuccess {
  readonly ok: true;
  readonly body: unknown;
}

interface ParsedRequestBodyFailure {
  readonly ok: false;
  readonly status_code: number;
  readonly body: {
    readonly code: string;
    readonly message: string;
  };
}

type ParsedRequestBodyResult = ParsedRequestBodySuccess | ParsedRequestBodyFailure;

interface ParsedHttpHostCommandArgs {
  readonly show_help: boolean;
  readonly host: string;
  readonly port: number;
}

export interface DeterministicFirstSliceSettlementLoopHttpHostOptions {
  readonly host?: string;
  readonly port?: number;
  readonly max_request_body_bytes?: number;
  readonly transport?: FirstSliceSettlementLoopLocalRpcTransport;
}

export interface DeterministicFirstSliceSettlementLoopHttpHost {
  readonly host: string;
  readonly port: number;
  readonly base_url: string;
  readonly route_templates: readonly FirstSliceSettlementLoopRoute[];
  stop(): Promise<void>;
}

export const startDeterministicFirstSliceSettlementLoopHttpHost = async (
  options?: DeterministicFirstSliceSettlementLoopHttpHostOptions,
): Promise<DeterministicFirstSliceSettlementLoopHttpHost> => {
  const host = normalizeHost(options?.host ?? DEFAULT_HTTP_HOST);
  const port = normalizePort(options?.port ?? DEFAULT_HTTP_PORT);
  const maxRequestBodyBytes = normalizeMaxRequestBodyBytes(
    options?.max_request_body_bytes ?? DEFAULT_MAX_REQUEST_BODY_BYTES,
  );
  const transport =
    options?.transport
    ?? createDeterministicFirstSliceSettlementLoopLocalRpcTransport();
  const routeTemplates = transport.getRegisteredRoutes();
  const compiledRouteTemplates = routeTemplates.map(compileRouteTemplate);
  const server = createServer((request, response) => {
    void handleTransportHttpRequest({
      request,
      response,
      transport,
      compiled_route_templates: compiledRouteTemplates,
      max_request_body_bytes: maxRequestBodyBytes,
    });
  });

  await listenServer(server, host, port);
  const boundAddress = server.address();
  const boundPort =
    typeof boundAddress === "object" && boundAddress !== null
      ? boundAddress.port
      : port;

  return {
    host,
    port: boundPort,
    base_url: `http://${host}:${boundPort}`,
    route_templates: routeTemplates,
    stop: () => closeServer(server),
  };
};

export const runDeterministicFirstSliceSettlementLoopHttpHostCommand = async (
  argv: readonly string[] = process.argv.slice(2),
): Promise<number> => {
  const parsedArgs = parseHttpHostCommandArgs(argv);
  if (parsedArgs.show_help) {
    printHttpHostCommandUsage();
    return 0;
  }

  const host = await startDeterministicFirstSliceSettlementLoopHttpHost({
    host: parsedArgs.host,
    port: parsedArgs.port,
  });

  console.log(
    `[rk-first-slice-http-host] listening base_url=${host.base_url} routes=${host.route_templates.length}`,
  );
  for (const routeTemplate of host.route_templates) {
    console.log(`[rk-first-slice-http-host] route ${routeTemplate}`);
  }

  try {
    await waitForShutdownSignal();
  } finally {
    await host.stop();
    console.log("[rk-first-slice-http-host] stopped");
  }

  return 0;
};

async function handleTransportHttpRequest(input: {
  readonly request: IncomingMessage;
  readonly response: ServerResponse<IncomingMessage>;
  readonly transport: FirstSliceSettlementLoopLocalRpcTransport;
  readonly compiled_route_templates: readonly CompiledRouteTemplate[];
  readonly max_request_body_bytes: number;
}): Promise<void> {
  if (input.request.method === "OPTIONS") {
    writeNoContent(input.response, 204);
    return;
  }

  if (input.request.method !== "POST") {
    writeJson(input.response, 405, {
      code: "method_not_allowed",
      message: "Only POST is supported for first-slice settlement loop routes.",
    });
    return;
  }

  const pathname = resolveRequestPathname(input.request.url);
  const matchedRoute = matchRouteTemplate(pathname, input.compiled_route_templates);
  if (matchedRoute === undefined) {
    writeJson(input.response, 404, {
      code: "route_not_found",
      message: `No transport route is wired for '${pathname}'.`,
    });
    return;
  }

  const parsedBody = await readJsonRequestBody(input.request, input.max_request_body_bytes);
  if (!parsedBody.ok) {
    writeJson(input.response, parsedBody.status_code, parsedBody.body);
    return;
  }

  try {
    const transportResponse = invokeTransportRoute(
      input.transport,
      matchedRoute.route_template,
      matchedRoute.path_params,
      parsedBody.body,
    );
    writeJson(
      input.response,
      normalizeStatusCode(transportResponse.status_code),
      transportResponse.body,
    );
  } catch (error: unknown) {
    writeJson(input.response, DEFAULT_INTERNAL_ERROR_STATUS_CODE, {
      code: "transport_handler_error",
      message:
        error instanceof Error
          ? error.message
          : "Unhandled transport host failure.",
    });
  }
}

function invokeTransportRoute<TRoute extends FirstSliceSettlementLoopRoute>(
  transport: FirstSliceSettlementLoopLocalRpcTransport,
  routeTemplate: TRoute,
  pathParams: Readonly<Record<string, string>>,
  requestBody: unknown,
) {
  const request = {
    path: pathParams,
    body: requestBody,
  } as FirstSliceSettlementLoopRequestByRoute[TRoute];
  return transport.invoke(routeTemplate, request);
}

function resolveRequestPathname(requestUrl: string | undefined): string {
  try {
    return new URL(requestUrl ?? "/", "http://localhost").pathname;
  } catch {
    return "/";
  }
}

function compileRouteTemplate(
  routeTemplate: FirstSliceSettlementLoopRoute,
): CompiledRouteTemplate {
  const parameterNames: string[] = [];
  const escapedTemplate = escapeRegex(routeTemplate);
  const matcherSource = escapedTemplate.replace(
    /\\\{([^}]+)\\\}/g,
    (_token, parameterName: string) => {
      parameterNames.push(parameterName);
      return "([^/]+)";
    },
  );
  return {
    route_template: routeTemplate,
    parameter_names: parameterNames,
    matcher: new RegExp(`^${matcherSource}$`),
  };
}

function matchRouteTemplate(
  pathname: string,
  compiledRouteTemplates: readonly CompiledRouteTemplate[],
): MatchedRouteTemplate | undefined {
  for (const routeTemplate of compiledRouteTemplates) {
    const matches = routeTemplate.matcher.exec(pathname);
    if (matches === null) {
      continue;
    }

    const pathParams: Record<string, string> = {};
    for (let index = 0; index < routeTemplate.parameter_names.length; index += 1) {
      const parameterName = routeTemplate.parameter_names[index];
      const rawValue = matches[index + 1] ?? "";
      pathParams[parameterName] = safeDecodeURIComponent(rawValue);
    }

    return {
      route_template: routeTemplate.route_template,
      path_params: pathParams,
    };
  }

  return undefined;
}

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

async function readJsonRequestBody(
  request: IncomingMessage,
  maxRequestBodyBytes: number,
): Promise<ParsedRequestBodyResult> {
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  for await (const chunk of request) {
    const bufferChunk = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
    totalBytes += bufferChunk.byteLength;
    if (totalBytes > maxRequestBodyBytes) {
      return {
        ok: false,
        status_code: 413,
        body: {
          code: "request_body_too_large",
          message: `Request body exceeds ${maxRequestBodyBytes} bytes.`,
        },
      };
    }
    chunks.push(bufferChunk);
  }

  if (chunks.length < 1) {
    return {
      ok: true,
      body: {},
    };
  }

  const bodyText = Buffer.concat(chunks).toString("utf8").trim();
  if (bodyText.length < 1) {
    return {
      ok: true,
      body: {},
    };
  }

  try {
    return {
      ok: true,
      body: JSON.parse(bodyText) as unknown,
    };
  } catch {
    return {
      ok: false,
      status_code: 400,
      body: {
        code: "invalid_json",
        message: "Request body must be valid JSON.",
      },
    };
  }
}

function writeJson(
  response: ServerResponse<IncomingMessage>,
  statusCode: number,
  body: unknown,
): void {
  const payload = JSON.stringify(body);
  response.writeHead(statusCode, DEFAULT_JSON_HEADERS);
  response.end(payload);
}

function writeNoContent(
  response: ServerResponse<IncomingMessage>,
  statusCode: number,
): void {
  response.writeHead(statusCode, NO_CONTENT_HEADERS);
  response.end();
}

async function listenServer(server: Server, host: string, port: number): Promise<void> {
  await new Promise<void>((resolvePromise, rejectPromise) => {
    const onError = (error: Error) => {
      server.off("listening", onListening);
      rejectPromise(error);
    };
    const onListening = () => {
      server.off("error", onError);
      resolvePromise();
    };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(port, host);
  });
}

async function closeServer(server: Server): Promise<void> {
  if (!server.listening) {
    return;
  }

  await new Promise<void>((resolvePromise, rejectPromise) => {
    server.close((error) => {
      if (error !== undefined) {
        rejectPromise(error);
        return;
      }
      resolvePromise();
    });
  });
}

function normalizeStatusCode(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_INTERNAL_ERROR_STATUS_CODE;
  }
  const normalized = Math.trunc(value);
  if (normalized < 100 || normalized > 599) {
    return DEFAULT_INTERNAL_ERROR_STATUS_CODE;
  }
  return normalized;
}

function normalizeHost(value: string): string {
  const normalized = value.trim();
  if (normalized.length < 1) {
    throw new Error("HTTP host cannot be empty.");
  }
  return normalized;
}

function normalizePort(value: number): number {
  if (!Number.isFinite(value)) {
    throw new Error("HTTP port must be a finite number.");
  }
  const normalized = Math.trunc(value);
  if (normalized < 0 || normalized > 65535) {
    throw new Error("HTTP port must be between 0 and 65535.");
  }
  return normalized;
}

function normalizeMaxRequestBodyBytes(value: number): number {
  if (!Number.isFinite(value)) {
    throw new Error("max_request_body_bytes must be a finite number.");
  }
  const normalized = Math.trunc(value);
  if (normalized < 1) {
    throw new Error("max_request_body_bytes must be greater than 0.");
  }
  return normalized;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseHttpHostCommandArgs(argv: readonly string[]): ParsedHttpHostCommandArgs {
  let host = DEFAULT_HTTP_HOST;
  let port = DEFAULT_HTTP_PORT;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === "--help" || argument === "-h") {
      return {
        show_help: true,
        host,
        port,
      };
    }

    if (argument === "--host") {
      const value = argv[index + 1];
      if (value === undefined) {
        throw new Error("Missing value for --host.");
      }
      host = normalizeHost(value);
      index += 1;
      continue;
    }

    if (argument.startsWith("--host=")) {
      host = normalizeHost(argument.slice("--host=".length));
      continue;
    }

    if (argument === "--port") {
      const value = argv[index + 1];
      if (value === undefined) {
        throw new Error("Missing value for --port.");
      }
      port = normalizePort(parseInteger(value, "--port"));
      index += 1;
      continue;
    }

    if (argument.startsWith("--port=")) {
      port = normalizePort(parseInteger(argument.slice("--port=".length), "--port"));
      continue;
    }

    throw new Error(`Unknown argument '${argument}'.`);
  }

  return {
    show_help: false,
    host,
    port,
  };
}

function parseInteger(value: string, label: string): number {
  const normalized = value.trim();
  if (normalized.length < 1) {
    throw new Error(`${label} must be a non-empty integer string.`);
  }
  if (!/^-?\d+$/.test(normalized)) {
    throw new Error(`${label} must be an integer.`);
  }
  return Number.parseInt(normalized, 10);
}

async function waitForShutdownSignal(): Promise<void> {
  await new Promise<void>((resolvePromise) => {
    const onSignal = () => {
      process.off("SIGINT", onSignal);
      process.off("SIGTERM", onSignal);
      resolvePromise();
    };
    process.on("SIGINT", onSignal);
    process.on("SIGTERM", onSignal);
  });
}

function printHttpHostCommandUsage(): void {
  console.log("Usage: node backend/src/app/transport/first-slice-settlement-loop-http-host.ts [--host <host>] [--port <port>]");
  console.log("Defaults:");
  console.log(`  --host ${DEFAULT_HTTP_HOST}`);
  console.log(`  --port ${DEFAULT_HTTP_PORT}`);
}

function isMainModule(mainArg: string | undefined, moduleUrl: string): boolean {
  if (mainArg === undefined) {
    return false;
  }

  try {
    return pathToFileURL(resolve(mainArg)).href === moduleUrl;
  } catch {
    return false;
  }
}

if (isMainModule(process.argv[1], import.meta.url)) {
  void runDeterministicFirstSliceSettlementLoopHttpHostCommand().then(
    (exitCode) => {
      if (exitCode !== 0) {
        process.exitCode = exitCode;
      }
    },
    (error: unknown) => {
      const message =
        error instanceof Error
          ? error.message
          : "Unknown host command failure.";
      console.error(`[rk-first-slice-http-host] ${message}`);
      process.exitCode = 1;
    },
  );
}
