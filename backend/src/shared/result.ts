export interface AppError {
  readonly code: string;
  readonly message: string;
  readonly details?: Record<string, unknown>;
  readonly cause?: unknown;
}

export interface Ok<TValue> {
  readonly ok: true;
  readonly value: TValue;
}

export interface Err<TError extends AppError = AppError> {
  readonly ok: false;
  readonly error: TError;
}

export type Result<TValue, TError extends AppError = AppError> =
  | Ok<TValue>
  | Err<TError>;

export const ok = <TValue>(value: TValue): Ok<TValue> => ({
  ok: true,
  value,
});

export const err = <TError extends AppError>(error: TError): Err<TError> => ({
  ok: false,
  error,
});
