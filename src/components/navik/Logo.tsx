import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

export const NAVIK_LOGO_SRC = "/navik-logo.svg";

export interface LogoMarkProps {
  className?: string;
  alt?: string;
  style?: CSSProperties;
}

/**
 * Renders the genuine NAVIK anchor-and-N vector logo from public/navik-logo.svg.
 * Fully scalable vector SVG with crisp metallic silver, deep navy outlines,
 * chiseled N diagonal strut, and dynamic oceanic ribbon.
 */
export function LogoMark({ className, alt = "NAVIK Logo", style }: LogoMarkProps) {
  return (
    <img
      src={NAVIK_LOGO_SRC}
      alt={alt}
      className={cn("h-14 w-auto shrink-0 object-contain select-none", className)}
      style={{ width: "auto", objectFit: "contain", ...style }}
      loading="eager"
      decoding="async"
    />
  );
}

export interface LogoProps {
  className?: string;
  markClassName?: string;
  compact?: boolean;
  size?: "sm" | "sidebar" | "nav" | "hero";
}

export function Logo({ className, markClassName, compact = false, size = "nav" }: LogoProps) {
  const sizeConfig = {
    sm: {
      mark: "h-9 w-auto", // 36px
      title: "text-[1rem] tracking-[0.2em]",
      subtitle: "text-[0.52rem] tracking-[0.14em]",
      gap: "gap-2.5",
    },
    sidebar: {
      mark: "h-12 w-auto", // 48px (within 44–56px range)
      title: "text-[1.15rem] tracking-[0.22em]",
      subtitle: "text-[0.58rem] tracking-[0.15em]",
      gap: "gap-3.5",
    },
    nav: {
      mark: "h-11 sm:h-12 lg:h-[56px] w-auto", // 44px mobile, 48px tablet, 56px desktop (within 52–60px range)
      title: "text-lg sm:text-xl lg:text-[1.75rem] tracking-[0.22em]", // 18px -> 20px -> 28px (within 26–30px range)
      subtitle: "text-[0.55rem] sm:text-[0.6rem] lg:text-[0.68rem] tracking-[0.16em]", // ~11px on desktop (within 10–12px range)
      gap: "gap-3 sm:gap-3.5 lg:gap-4", // 12px -> 14px -> 16px (within 14–18px range)
    },
    hero: {
      mark: "h-20 sm:h-24 lg:h-28 w-auto",
      title: "text-2xl sm:text-3xl lg:text-4xl tracking-[0.24em]",
      subtitle: "text-xs sm:text-sm tracking-[0.18em]",
      gap: "gap-4 sm:gap-5",
    },
  }[size];

  return (
    <span className={cn("inline-flex items-center text-foreground", sizeConfig.gap, className)}>
      <LogoMark className={cn(sizeConfig.mark, markClassName)} />
      {!compact && (
        <span className="flex flex-col justify-center leading-none select-none">
          <span
            className={cn(
              "font-extrabold tracking-[0.22em] text-foreground font-sans",
              sizeConfig.title,
            )}
          >
            NAVIK
          </span>
          <span
            className={cn(
              "text-eyebrow mt-1 font-mono uppercase text-muted-foreground/90 font-medium",
              sizeConfig.subtitle,
            )}
          >
            Maritime Intelligence
          </span>
        </span>
      )}
    </span>
  );
}
