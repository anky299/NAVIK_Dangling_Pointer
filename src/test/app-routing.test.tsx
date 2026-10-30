import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, createRouter, rootRouteId, RouterProvider } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";

import { routeTree } from "@/routeTree.gen";

describe("App routing across all 11 platform workspaces", () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  const router = createRouter({ routeTree, context: { queryClient } });

  const coreRoutes = [
    { path: "/", expectedRouteId: "/" },
    { path: "/dashboard", expectedRouteId: "/_command/dashboard" },
    { path: "/charter", expectedRouteId: "/_command/charter" },
    { path: "/market", expectedRouteId: "/_command/market" },
    { path: "/insurance", expectedRouteId: "/_command/insurance" },
    { path: "/feasibility", expectedRouteId: "/_command/feasibility" },
    { path: "/scenarios", expectedRouteId: "/_command/scenarios" },
    { path: "/strategy", expectedRouteId: "/_command/strategy" },
    { path: "/assistant", expectedRouteId: "/_command/assistant" },
    { path: "/contracts", expectedRouteId: "/_command/contracts" },
    { path: "/audit", expectedRouteId: "/_command/audit" },
  ];

  it.each(coreRoutes)(
    "matches a dedicated route for $path without falling back",
    ({ path, expectedRouteId }) => {
      const matches = router.matchRoutes(path);
      const leaf = matches.at(-1);

      expect(leaf?.routeId).not.toBe(rootRouteId);
      expect(leaf?.routeId).toBe(expectedRouteId);
    },
  );

  describe("Workspace route rendering checks with memory router", () => {
    it.each([
      "/dashboard",
      "/charter",
      "/market",
      "/insurance",
      "/feasibility",
      "/scenarios",
      "/strategy",
      "/assistant",
      "/contracts",
      "/audit",
    ])("renders route %s without crashing", async (path) => {
      const history = createMemoryHistory({ initialEntries: [path] });
      const testRouter = createRouter({
        routeTree,
        history,
        context: { queryClient },
      });
      await testRouter.load();
      const { container } = render(
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={testRouter} />
        </QueryClientProvider>
      );
      expect(container).toBeTruthy();
    });
  });
});
