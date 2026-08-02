export type QueryResult = { data: unknown; error: unknown };

type QueryBuilder = {
  select: (...args: unknown[]) => QueryBuilder;
  eq: (...args: unknown[]) => QueryBuilder;
  neq: (...args: unknown[]) => QueryBuilder;
  gte: (...args: unknown[]) => QueryBuilder;
  lte: (...args: unknown[]) => QueryBuilder;
  lt: (...args: unknown[]) => QueryBuilder;
  or: (...args: unknown[]) => QueryBuilder;
  is: (...args: unknown[]) => QueryBuilder;
  order: (...args: unknown[]) => QueryBuilder;
  limit: (...args: unknown[]) => QueryBuilder;
  single: () => Promise<QueryResult>;
  maybeSingle: () => Promise<QueryResult>;
  then: (resolve: (value: QueryResult) => unknown) => Promise<unknown>;
};

export function createSupabaseMock(
  results: Record<string, QueryResult>,
  authResult: QueryResult = {
    data: { user: { id: "user-1", email: "user@example.com" } },
    error: null,
  },
) {
  const calls: Array<{ source: string; method: string; args: unknown[] }> = [];

  function resultFor(source: string) {
    return results[source] ?? { data: [], error: null };
  }

  function from(source: string): QueryBuilder {
    const builder = {} as QueryBuilder;
    for (const method of [
      "select",
      "eq",
      "neq",
      "gte",
      "lte",
      "lt",
      "or",
      "is",
      "order",
      "limit",
    ] as const) {
      builder[method] = (...args: unknown[]) => {
        calls.push({ source, method, args });
        return builder;
      };
    }
    builder.single = async () => resultFor(source);
    builder.maybeSingle = async () => resultFor(source);
    builder.then = (resolve) =>
      Promise.resolve(resultFor(source)).then(resolve);
    return builder;
  }

  return {
    client: {
      auth: { getUser: async () => authResult },
      from,
      rpc: async (name: string, args: unknown) => {
        calls.push({ source: `rpc:${name}`, method: "rpc", args: [args] });
        return resultFor(`rpc:${name}`);
      },
    },
    calls,
  };
}
