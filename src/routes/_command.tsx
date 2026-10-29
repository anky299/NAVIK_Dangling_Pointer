import { Outlet, createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/navik/AppShell";

/** Pathless layout for every command-center workspace (sidebar + top bar). */
export const Route = createFileRoute("/_command")({
  component: CommandLayout,
});

function CommandLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
