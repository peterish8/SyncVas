import { query } from "./_generated/server";

export const status = query({
  args: {},
  handler: async () => ({ status: "ready" as const }),
});
