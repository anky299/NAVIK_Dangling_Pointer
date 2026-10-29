import { Link, useRouterState } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronsLeft, ChevronsRight, Menu, Plus, ArrowUpRight } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Logo, LogoMark } from "./Logo";
import { MOBILE_PRIMARY, NAV_GROUPS, NAV_ITEMS, type NavItem } from "./nav";
import { EnvIndicator, OperatorBadge } from "./EnvIndicator";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const STORAGE_KEY = "navik.sidebar.collapsed";

function SideLink({
  item,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  const link = (
    <Link
      to={item.to}
      onClick={onNavigate}
      className={cn(
        "group relative flex items-center gap-3 rounded-md px-3 py-2 text-[0.85rem] font-medium text-muted-foreground transition-all duration-200 hover:bg-[#79513D]/15 hover:text-[#FAF5EC]",
        collapsed && "justify-center px-0",
      )}
      activeProps={{
        className:
          "bg-gradient-to-r from-[#79513D]/25 via-[#382720]/30 to-transparent !text-[#FAF5EC] font-semibold shadow-inner",
        "aria-current": "page",
      }}
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <motion.span
              layoutId="nav-active"
              className="absolute inset-y-1 left-0 w-[3.5px] rounded-r-full bg-[#B96F50] shadow-[0_0_10px_rgba(185,111,80,0.7)]"
              transition={{ type: "spring", stiffness: 420, damping: 36 }}
            />
          )}
          <Icon
            className={cn(
              "size-[1.05rem] shrink-0 transition-colors duration-200",
              isActive ? "text-[#B96F50]" : "text-muted-foreground group-hover:text-brass",
            )}
          />
          {!collapsed && <span className="truncate">{item.label}</span>}
        </>
      )}
    </Link>
  );
  if (!collapsed) return link;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent
        side="right"
        className="bg-popover border-[#D7B88C]/30 text-[#FAF5EC] font-mono text-xs"
      >
        {item.label}
      </TooltipContent>
    </Tooltip>
  );
}

function NavList({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  return (
    <nav aria-label="Primary" className="flex flex-col gap-6">
      {NAV_GROUPS.map((g) => (
        <div key={g.label}>
          {!collapsed ? (
            <p className="text-eyebrow mb-2 px-3 text-[0.58rem] text-brass/80 font-mono tracking-wider">
              {g.label}
            </p>
          ) : (
            <div className="mx-auto mb-2 h-px w-6 bg-border/80" />
          )}
          <div className="flex flex-col gap-0.5">
            {g.items.map((item) => (
              <SideLink
                key={item.to}
                item={item}
                collapsed={collapsed}
                {...(onNavigate ? { onNavigate } : {})}
              />
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

function ApiCard() {
  return (
    <div className="rounded-lg border border-[#D7B88C]/25 bg-gradient-to-b from-[#2C2522]/95 to-[#382720]/60 p-3 shadow-deep">
      <div className="flex items-center justify-between">
        <p className="text-eyebrow text-[0.58rem] text-brass flex items-center gap-1.5 font-semibold">
          <span className="size-1.5 rounded-full bg-[#D7B88C] animate-pulse shadow-[0_0_6px_rgba(215,184,140,0.7)]" />
          <span>Demo Desk Mode</span>
        </p>
        <span className="font-mono text-[0.55rem] text-[#FAF5EC] font-semibold bg-[#B96F50]/20 px-1.5 py-0.5 rounded border border-[#B96F50]/40">
          v1.0-rc
        </span>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        Deterministic models calibrated for East Coast India. Connect Python backend for live broker
        feeds.
      </p>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [collapsed, setCollapsed] = useState(false);
  const [drawer, setDrawer] = useState(false);

  useEffect(() => {
    setCollapsed(window.localStorage.getItem(STORAGE_KEY) === "1");
  }, []);
  const toggle = () =>
    setCollapsed((c) => {
      window.localStorage.setItem(STORAGE_KEY, c ? "0" : "1");
      return !c;
    });

  const current = NAV_ITEMS.find((n) => pathname.startsWith(n.to));

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex min-h-screen">
        {/* Desktop sidebar */}
        <motion.aside
          initial={false}
          animate={{ width: collapsed ? 76 : 260 }}
          transition={{ type: "spring", stiffness: 300, damping: 34 }}
          className="sticky top-0 hidden h-screen shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex"
        >
          <div
            className={cn(
              "flex h-20 items-center border-b border-sidebar-border px-4",
              collapsed && "justify-center px-0",
            )}
          >
            <Link to="/" aria-label="NAVIK home" className="flex items-center">
              {collapsed ? <LogoMark className="h-12 w-auto" /> : <Logo size="sidebar" />}
            </Link>
          </div>
          <div className="scrollbar-thin flex-1 overflow-y-auto overflow-x-hidden px-3 py-6">
            <NavList collapsed={collapsed} />
          </div>
          <div className="space-y-3 border-t border-sidebar-border p-3">
            {!collapsed && <ApiCard />}
            <button
              type="button"
              onClick={toggle}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-expanded={!collapsed}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground",
                collapsed && "justify-center px-0",
              )}
            >
              {collapsed ? (
                <ChevronsRight className="size-4" />
              ) : (
                <ChevronsLeft className="size-4" />
              )}
              {!collapsed && "Collapse"}
            </button>
          </div>
        </motion.aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Top bar */}
          <header className="sticky top-0 z-30 flex h-16 sm:h-20 items-center gap-3 border-b border-[#D7B88C]/15 bg-background/85 px-4 backdrop-blur-md sm:px-6 lg:px-10">
            <button
              type="button"
              onClick={() => setDrawer(true)}
              aria-label="Open navigation"
              className="-ml-1 rounded-md p-2 text-muted-foreground hover:bg-[#79513D]/20 hover:text-[#FAF5EC] transition-colors lg:hidden"
            >
              <Menu className="size-5" />
            </button>
            <Link to="/" className="flex items-center lg:hidden" aria-label="NAVIK home">
              <LogoMark className="h-10 sm:h-11 w-auto" />
            </Link>
            <div className="min-w-0 flex-1">
              <div className="hidden sm:flex items-center gap-2">
                <span className="size-2 rounded-full bg-[#D7B88C] animate-pulse shadow-[0_0_8px_rgba(215,184,140,0.7)]" />
                <p className="text-eyebrow text-[0.62rem] text-brass/90 font-mono tracking-wider">
                  NAVIK · East Coast India Desk · Active
                </p>
              </div>
              <p className="truncate text-base font-semibold tracking-tight text-warm-ivory">
                {current?.label ?? "Command Center"}
              </p>
            </div>
            <EnvIndicator />
            {pathname !== "/charter" && (
              <Link
                to="/charter"
                className="hidden items-center gap-1.5 rounded-md bg-[#B96F50] px-3.5 py-2 text-xs font-bold text-[#FAF5EC] shadow-[0_2px_12px_rgba(185,111,80,0.35)] transition-all hover:bg-[#C67C5E] hover:shadow-lg md:inline-flex"
              >
                <Plus className="size-3.5 stroke-[2.5]" /> New analysis
              </Link>
            )}
            <OperatorBadge />
          </header>

          <main className="flex-1 px-4 pb-28 pt-8 sm:px-6 lg:px-10 lg:pb-16">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={pathname}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                className="mx-auto w-full max-w-[1440px]"
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>

        {/* Mobile bottom nav */}
        <nav
          aria-label="Quick navigation"
          className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-border bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
        >
          {MOBILE_PRIMARY.map((to) => {
            const item = NAV_ITEMS.find((n) => n.to === to)!;
            const Icon = item.icon;
            return (
              <Link
                key={to}
                to={to}
                className="flex flex-col items-center gap-1 py-2.5 text-[0.62rem] font-medium text-muted-foreground"
                activeProps={{ className: "!text-[#B96F50]" }}
              >
                <Icon className="size-[1.15rem]" />
                {item.short}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setDrawer(true)}
            className="flex flex-col items-center gap-1 py-2.5 text-[0.62rem] font-medium text-muted-foreground"
          >
            <Menu className="size-[1.15rem]" />
            More
          </button>
        </nav>

        <Sheet open={drawer} onOpenChange={setDrawer}>
          <SheetContent side="left" className="w-[290px] border-sidebar-border bg-sidebar p-0">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <SheetDescription className="sr-only">All NAVIK workspaces</SheetDescription>
            <div className="flex h-20 items-center border-b border-sidebar-border px-5">
              <Logo size="sidebar" />
            </div>
            <div className="overflow-y-auto px-3 py-6">
              <NavList collapsed={false} onNavigate={() => setDrawer(false)} />
            </div>
            <div className="space-y-3 border-t border-sidebar-border p-3">
              <ApiCard />
              <Link
                to="/"
                onClick={() => setDrawer(false)}
                className="flex items-center justify-between rounded-md px-3 py-2 text-xs text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
              >
                Back to landing <ArrowUpRight className="size-3.5" />
              </Link>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </TooltipProvider>
  );
}
