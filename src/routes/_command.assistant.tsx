import { createFileRoute } from "@tanstack/react-router";
import { NirnayAssistantWorkspace } from "@/components/navik/NirnayAssistantWorkspace";

export const Route = createFileRoute("/_command/assistant")({
  head: () => ({
    meta: [
      { title: "Nirnay Assistant — NAVIK" },
      {
        name: "description",
        content:
          "Explainable maritime decision assistant using NAVIK data and calculation engines.",
      },
      { property: "og:title", content: "Nirnay Assistant — NAVIK" },
      {
        property: "og:description",
        content:
          "Explainable maritime decision assistant using NAVIK data and calculation engines.",
      },
    ],
  }),
  component: Page,
});

function Page() {
  return <NirnayAssistantWorkspace />;
}
