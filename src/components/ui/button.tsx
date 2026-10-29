import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-semibold tracking-tight cursor-pointer transition-[background-color,color,box-shadow,transform,border-color] duration-200 active:translate-y-px focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-copper text-[#0B1213] font-bold shadow-copper hover:bg-copper-soft hover:shadow-lg active:scale-[0.98] transition-all",
        destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline:
          "border border-border/80 bg-card/40 text-foreground hover:bg-sea-glass/20 hover:border-brass/70 hover:text-warm-ivory transition-all",
        secondary:
          "bg-sea-glass/25 border border-sea-glass/50 text-warm-ivory shadow-sm hover:bg-sea-glass/40 hover:border-sea-glass active:scale-[0.98] transition-all",
        teal: "bg-deep-teal border border-sea-glass/60 text-warm-ivory shadow-teal hover:bg-sea-glass active:scale-[0.98] transition-all",
        brass:
          "bg-brass text-[#0B1213] font-bold shadow-sm hover:bg-brass-soft active:scale-[0.98] transition-all",
        ghost: "hover:bg-sea-glass/20 hover:text-warm-ivory transition-colors",
        link: "text-copper-soft underline-offset-4 hover:underline hover:text-copper",
        hero: "bg-copper-gradient text-[#0B1213] font-bold shadow-copper hover:brightness-110 active:scale-[0.98] transition-all",
        glass:
          "surface-glass text-warm-ivory border-sea-glass/30 hover:bg-sea-glass/25 hover:border-brass/50 transition-all",
        paper: "bg-paper-foreground text-paper hover:bg-paper-foreground/90 font-medium",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-11 rounded-md px-6 text-[0.9rem]",
        xl: "h-13 rounded-md px-7 text-base",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
