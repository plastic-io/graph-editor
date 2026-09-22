import { defineConfig } from "@playwright/test";

/**
 * The two-browser suite (plan §8.1.5, PB-104).
 *
 * These tests are about what two people watching the same graph each do with
 * a hop the server hands to "the browsers": who runs it, who does not, and
 * what happens to one nobody takes.  None of that can be answered in a single
 * page, so this runs real browsers against the local dev server — the same
 * service code the Lambda runs, with an in-memory store.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 120000,
  expect: { timeout: 20000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:4188",
    actionTimeout: 15000,
    trace: "retain-on-failure",
  },
  webServer: [
    {
      // the graph server, in memory: no AWS, no authentication
      command: "npm run dev-server",
      cwd: "../graph-server",
      url: "http://localhost:3030/debug/keys",
      reuseExistingServer: true,
      timeout: 180000,
      stdout: "pipe",
    },
    {
      // the editor, on a port of its own so it never fights the one a person
      // is working in
      command: "npm run dev -- --port 4188 --strictPort",
      url: "http://localhost:4188/graph-editor/",
      reuseExistingServer: true,
      timeout: 180000,
    },
  ],
});
