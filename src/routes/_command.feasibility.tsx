import { createFileRoute } from "@tanstack/react-router";
import { FeasibilityWorkspace } from "@/components/navik/FeasibilityWorkspace";

export const Route = createFileRoute("/_command/feasibility")({
  head: () => ({
    meta: [
      { title: "Fleet & Port Feasibility — NAVIK" },
      {
        name: "description",
        content: "Vessel-class specifications tested against discharge-port limits.",
      },
      { property: "og:title", content: "Fleet & Port Feasibility — NAVIK" },
      {
        property: "og:description",
        content: "Vessel-class specifications tested against discharge-port limits.",
      },
    ],
  }),
  component: Page,
});

function Page() {
  return <FeasibilityWorkspace />;
}
