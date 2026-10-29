import { createFileRoute } from "@tanstack/react-router";
import { PortfolioWorkspace } from "@/components/navik/PortfolioWorkspace";

export const Route = createFileRoute("/_command/strategy")({
  head: () => ({
    meta: [
      { title: "Portfolio & Repositioning — NAVIK" },
      {
        name: "description",
        content: "Spot, short- and medium-term cover balanced against cost variance and idle days.",
      },
      { property: "og:title", content: "Portfolio & Repositioning — NAVIK" },
      {
        property: "og:description",
        content: "Spot, short- and medium-term cover balanced against cost variance and idle days.",
      },
    ],
  }),
  component: Page,
});

function Page() {
  return <PortfolioWorkspace />;
}
