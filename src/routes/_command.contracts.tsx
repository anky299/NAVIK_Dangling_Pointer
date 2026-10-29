import { createFileRoute } from "@tanstack/react-router";
import { ContractsWorkspace } from "@/components/navik/ContractsWorkspace";

export const Route = createFileRoute("/_command/contracts")({
  head: () => ({
    meta: [
      { title: "Contract Records — NAVIK" },
      {
        name: "description",
        content:
          "Freight commitment register, commercial term tracking, and laycan conflict detection.",
      },
      { property: "og:title", content: "Contract Records — NAVIK" },
      {
        property: "og:description",
        content:
          "Freight commitment register, commercial term tracking, and laycan conflict detection.",
      },
    ],
  }),
  component: Page,
});

function Page() {
  return <ContractsWorkspace />;
}
