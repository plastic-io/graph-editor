import { defineConfig } from "vitest/config";
export default defineConfig({ test: { include: ["docs/polymorphic-application-plan/spikes/**/*.spec.ts"], environment: "node", testTimeout: 600000, hookTimeout: 600000 } });
