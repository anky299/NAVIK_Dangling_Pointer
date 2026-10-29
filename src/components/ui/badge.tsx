import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80",
        secondary: "border-sea-glass/40 bg-sea-glass/20 text-warm-ivory hover:bg-sea-glass/30",
        destructive: "border-crimson/50 bg-crimson/15 text-crimson shadow hover:bg-crimson/25",
        copper: "border-copper/50 bg-copper/15 text-copper-soft font-mono",
        brass: "border-brass/50 bg-brass/15 text-brass font-mono",
        teal: "border-sea-glass/50 bg-deep-teal/40 text-warm-ivory font-mono",
        sage: "border-sage/50 bg-sage/15 text-sage-soft font-mono",
        warning: "border-amber-400/50 bg-amber-400/15 text-amber-300 font-mono",
        outline: "border-border/80 text-foreground bg-card/40",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
