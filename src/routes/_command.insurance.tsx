import { createFileRoute } from "@tanstack/react-router";
import { InsuranceWorkspace } from "@/components/navik/insurance/InsuranceWorkspace";

export const Route = createFileRoute("/_command/insurance")({
  head: () => ({
    meta: [
      { title: "Insurance Intelligence — NAVIK" },
      {
        name: "description",
        content:
          "Historical marine cargo insurance intelligence for informed voyage procurement decisions across East Coast India discharge terminals.",
      },
      { property: "og:title", content: "Insurance Intelligence — NAVIK" },
      {
        property: "og:description",
        content:
          "Historical marine cargo insurance intelligence for informed voyage procurement decisions across East Coast India discharge terminals.",
      },
    ],
  }),
  component: Page,
});

function Page() {
  return <InsuranceWorkspace />;
}

