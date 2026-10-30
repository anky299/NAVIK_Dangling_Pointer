import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80",
        secondary: "border-[#24485C] bg-[#15364A]/80 text-[#F3EEE5] hover:bg-[#1f435b]",
        destructive: "border-[#E87945]/50 bg-[#E87945]/15 text-[#E87945] shadow hover:bg-[#E87945]/25",
        coral: "border-[#E87945]/50 bg-[#E87945]/15 text-[#F3EEE5] font-mono",
        copper: "border-[#E87945]/50 bg-[#E87945]/15 text-[#E87945] font-mono",
        brass: "border-[#F2B653]/50 bg-[#F2B653]/15 text-[#F2B653] font-mono",
        amber: "border-[#F2B653]/50 bg-[#F2B653]/15 text-[#F2B653] font-mono",
        walnut: "border-[#24485C] bg-[#15364A] text-[#F3EEE5] font-mono",
        rose: "border-[#E87945]/40 bg-[#E87945]/15 text-[#E87945] font-mono",
        parchment: "border-[#F2B653]/30 bg-[#15364A] text-[#F3EEE5] font-mono",
        teal: "border-[#35BFC3]/50 bg-[#35BFC3]/20 text-[#35BFC3] font-mono",
        sage: "border-[#78958F]/40 bg-[#15364A] text-[#78958F] font-mono",
        seafoam: "border-[#78958F]/50 bg-[#78958F]/20 text-[#78958F] font-mono",
        warning: "border-[#F2B653]/50 bg-[#F2B653]/15 text-[#F2B653] font-mono",
        outline: "border-[#24485C] text-[#D8E2E8] bg-[#0D2233]/60",
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
