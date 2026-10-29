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
          "bg-[#B96F50] text-[#FAF5EC] font-semibold shadow-sm hover:bg-[#C67C5E] hover:shadow-md active:scale-[0.98] transition-all",
        destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline:
          "border border-border/70 bg-card/50 text-[#F2E6D5] hover:bg-[#382720]/60 hover:border-[#D7B88C]/60 hover:text-[#FAF5EC] transition-all",
        secondary:
          "bg-[#382720]/60 border border-[#D7B88C]/30 text-[#F2E6D5] shadow-sm hover:bg-[#382720]/90 hover:border-[#D7B88C]/60 active:scale-[0.98] transition-all",
        brass:
          "bg-[#D7B88C] text-[#25201D] font-bold shadow-sm hover:bg-[#E6CEAE] active:scale-[0.98] transition-all",
        ghost: "hover:bg-[#382720]/50 hover:text-[#FAF5EC] transition-colors",
        link: "text-[#B96F50] underline-offset-4 hover:underline hover:text-[#C67C5E]",
        hero: "bg-gradient-to-r from-[#B96F50] to-[#D7B88C] text-[#FAF5EC] font-semibold shadow-md hover:brightness-105 active:scale-[0.98] transition-all",
        glass:
          "surface-glass text-[#F2E6D5] border-[#D7B88C]/20 hover:bg-[#382720]/40 hover:border-[#D7B88C]/50 transition-all",
        paper:
          "bg-[#382720] text-[#FAF5EC] hover:bg-[#48332A] font-medium shadow-sm transition-all",
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
