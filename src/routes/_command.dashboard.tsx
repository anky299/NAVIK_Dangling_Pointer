import { createFileRoute } from "@tanstack/react-router";
import { CommandDashboardWorkspace } from "@/components/navik/CommandDashboardWorkspace";

export const Route = createFileRoute("/_command/dashboard")({
  head: () => ({
    meta: [
      { title: "Command Center — NAVIK" },
      {
        name: "description",
        content:
          "Market snapshot, route canvas, risk alerts and recent decisions for the East Coast India programme.",
      },
      { property: "og:title", content: "Command Center — NAVIK" },
      {
        property: "og:description",
        content:
          "Market snapshot, route canvas, risk alerts and recent decisions for the East Coast India programme.",
      },
    ],
  }),
  component: Page,
});

function Page() {
  return <CommandDashboardWorkspace />;
}
