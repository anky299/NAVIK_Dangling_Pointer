import { createFileRoute } from "@tanstack/react-router";
import { AuditWorkspace } from "@/components/navik/AuditWorkspace";

export const Route = createFileRoute("/_command/audit")({
  head: () => ({
    meta: [
      { title: "Audit Trail — NAVIK" },
      {
        name: "description",
        content:
          "Chronological audit timeline of significant decision-support runs, fixes, and updates.",
      },
      { property: "og:title", content: "Audit Trail — NAVIK" },
      {
        property: "og:description",
        content:
          "Chronological audit timeline of significant decision-support runs, fixes, and updates.",
      },
    ],
  }),
  component: Page,
});

function Page() {
  return <AuditWorkspace />;
}
