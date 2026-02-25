export type Id<Scope extends string> = string & {
  readonly __idScope: Scope;
};

export interface IdCodec {
  create<Scope extends string>(scope: Scope): Id<Scope>;
  parse<Scope extends string>(scope: Scope, raw: string): Id<Scope> | null;
  format<Scope extends string>(id: Id<Scope>): string;
}

export const asId = <Scope extends string>(raw: string): Id<Scope> =>
  raw as Id<Scope>;
