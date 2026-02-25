export type Instant = Date;

export interface Clock {
  now(): Instant;
}
