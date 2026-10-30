import { createFileRoute } from "@tanstack/react-router";
import { CharterWorkspace } from "@/components/navik/CharterWorkspace";

export const Route = createFileRoute("/_command/charter")({
  head: () => ({
    meta: [
      { title: "Charter Workspace — NAVIK" },
      {
        name: "description",
        content: "Cargo intake, five-stage pipeline and an optimized charter recommendation.",
      },
      { property: "og:title", content: "Charter Workspace — NAVIK" },
      {
        property: "og:description",
        content: "Cargo intake, five-stage pipeline and an optimized charter recommendation.",
      },
    ],
  }),
  component: Page,
});

function Page() {
  return <CharterWorkspace />;
}
