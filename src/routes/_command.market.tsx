import { createFileRoute } from "@tanstack/react-router";
import { FreightMarketWorkspace } from "@/components/navik/FreightMarketWorkspace";

export const Route = createFileRoute("/_command/market")({
  head: () => ({
    meta: [
      { title: "Freight Market Intelligence — NAVIK" },
      {
        name: "description",
        content:
          "Freight rates, bunker prices, port congestion and analyst signals for bulk-cargo routes to Indian East Coast ports.",
      },
      { property: "og:title", content: "Freight Market Intelligence — NAVIK" },
      {
        property: "og:description",
        content:
          "Freight rates, bunker prices, port congestion and analyst signals for bulk-cargo routes to Indian East Coast ports.",
      },
    ],
  }),
  component: Page,
});

function Page() {
  return <FreightMarketWorkspace />;
}
