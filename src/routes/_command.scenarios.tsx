import { createFileRoute } from "@tanstack/react-router";
import { ScenarioWorkspace } from "@/components/navik/ScenarioWorkspace";

export const Route = createFileRoute("/_command/scenarios")({
  head: () => ({
    meta: [
      { title: "Scenario Lab — NAVIK" },
      {
        name: "description",
        content:
          "Stress freight, bunkers, congestion and fleet supply against a preserved baseline.",
      },
      { property: "og:title", content: "Scenario Lab — NAVIK" },
      {
        property: "og:description",
        content:
          "Stress freight, bunkers, congestion and fleet supply against a preserved baseline.",
      },
    ],
  }),
  component: Page,
});

function Page() {
  return <ScenarioWorkspace />;
}
