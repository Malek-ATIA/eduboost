import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Integration tests share login state via global setup — they call the
    // real API. Keep them serial to avoid hammering Cognito with parallel
    // logins on cold runs and to keep mutation-based tests (create/delete)
    // deterministic.
    fileParallelism: false,
    sequence: { concurrent: false },
    globalSetup: ["./global-setup.ts"],
    setupFiles: ["./setup.ts"],
    testTimeout: 30000,
    hookTimeout: 30000,
    reporters: ["default"],
    include: ["**/*.test.ts"],
  },
});
