import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // jsdom gives lib/gpx.ts a DOMParser in the test runner; the pure
    // analyzer/geo/classify tests don't need it but it's harmless for them.
    environment: "jsdom",
    include: ["tests/**/*.test.ts"],
  },
});
