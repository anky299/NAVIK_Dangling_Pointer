import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80",
        secondary: "border-[#D7B88C]/30 bg-[#382720]/60 text-[#F2E6D5] hover:bg-[#382720]/80",
        destructive: "border-crimson/50 bg-crimson/15 text-crimson shadow hover:bg-crimson/25",
        coral: "border-[#B96F50]/50 bg-[#B96F50]/15 text-[#FAF5EC] font-mono",
        copper: "border-[#B96F50]/50 bg-[#B96F50]/15 text-[#FAF5EC] font-mono",
        brass: "border-[#D7B88C]/50 bg-[#D7B88C]/15 text-[#D7B88C] font-mono",
        walnut: "border-[#79513D]/50 bg-[#79513D]/25 text-[#FAF5EC] font-mono",
        rose: "border-[#C88C78]/50 bg-[#C88C78]/20 text-[#C88C78] font-mono",
        parchment: "border-[#D7B88C]/40 bg-[#FAF5EC] text-[#382720] font-mono",
        teal: "border-[#79513D]/50 bg-[#382720]/60 text-[#F2E6D5] font-mono",
        sage: "border-[#D7B88C]/40 bg-[#79513D]/25 text-[#FAF5EC] font-mono",
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
