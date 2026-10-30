import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { DemoTag, PageHeader } from "./primitives";
import { RouteMap } from "./RouteMap";

/** Temporary workspace frame while the full view is being built. */
export function PendingWorkspace({
  eyebrow,
  title,
  accent,
  description,
}: {
  eyebrow: string;
  title: string;
  accent: string;
  description: string;
}) {
  return (
    <div>
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        accent={accent}
        description={description}
      />
      <div className="grid gap-4 lg:grid-cols-12">
        <div className="surface-ink grain overflow-hidden rounded-md p-4 lg:col-span-8">
          <RouteMap title="Indicative sea lanes to East Coast India" labelScale={0.95} />
        </div>
        <div className="surface-ink flex flex-col justify-between rounded-md p-6 lg:col-span-4">
          <div>
            <p className="text-eyebrow text-brass">Workspace Initializing</p>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              This workspace's analytical modules are being calibrated. The maritime corridor canvas
              displays the primary active routes under evaluation.
            </p>
          </div>
          <Link
            to="/"
            className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-copper-soft hover:text-copper"
          >
            Back to landing <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
