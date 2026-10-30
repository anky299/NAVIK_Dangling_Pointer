import { Link, useRouterState } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronsLeft, ChevronsRight, Menu, Plus, ArrowUpRight, Search, ChevronDown, Compass } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Logo, LogoMark } from "./Logo";
import { MOBILE_PRIMARY, NAV_GROUPS, NAV_ITEMS, type NavItem } from "./nav";
import { EnvIndicator, OperatorBadge } from "./EnvIndicator";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import heroCarrier from "@/assets/hero-carrier.jpg";

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
        "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[0.84rem] font-medium text-[#D8E2E8] transition-all duration-200 hover:bg-[#15364A] hover:text-[#F3EEE5]",
        collapsed && "justify-center px-0",
      )}
      activeProps={{
        className:
          "bg-[#15364A] !text-[#F3EEE5] font-semibold",
        "aria-current": "page",
      }}
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <motion.span
              layoutId="nav-active"
              className="absolute inset-y-1.5 left-0 w-[3px] rounded-r-full bg-[#35BFC3] shadow-[0_0_8px_rgba(53,191,195,0.7)]"
              transition={{ type: "spring", stiffness: 420, damping: 36 }}
            />
          )}
          <Icon
            className={cn(
              "size-[1.05rem] shrink-0 transition-colors duration-200",
              isActive ? "text-[#35BFC3]" : "text-[#78958F] group-hover:text-[#F3EEE5]",
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
        className="bg-[#102A40] border-[#263D50] text-[#EAF1F6] font-mono text-xs"
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
            <p className="text-eyebrow mb-2 px-3 text-[0.62rem] text-[#7E93A6] font-mono tracking-wider font-semibold uppercase">
              {g.label}
            </p>
          ) : (
            <div className="mx-auto mb-2 h-px w-6 bg-[#263D50]" />
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

function ActiveDeskCard() {
  return (
    <div className="rounded-lg border border-[#24485C] bg-[#15364A] p-2.5 flex items-center justify-between gap-2.5 overflow-hidden shadow-sm">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-[#35BFC3] animate-pulse shadow-[0_0_6px_rgba(53,191,195,0.6)]" />
          <p className="text-[0.72rem] font-bold text-[#F3EEE5] truncate">East Coast India Desk</p>
        </div>
        <p className="text-[0.62rem] text-[#78958F] mt-0.5 pl-3.5">Active</p>
      </div>
      <div className="size-11 shrink-0 rounded-md overflow-hidden border border-[#24485C]/70 relative">
        <img src={heroCarrier} alt="Carrier" className="size-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0D2233]/40 to-transparent" />
      </div>
    </div>
  );
}

function ApiCard() {
  return (
    <div className="rounded-lg border border-[#24485C] bg-[#0D2233] p-2.5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-eyebrow text-[0.58rem] text-[#78958F] flex items-center gap-1.5 font-semibold tracking-wider uppercase">
          <span className="size-1.5 rounded-full bg-[#35BFC3]" />
          <span>Operational Telemetry</span>
        </p>
        <span className="font-mono text-[0.55rem] text-[#D8E2E8] font-semibold bg-[#15364A] px-1.5 py-0.5 rounded border border-[#24485C]">
          v1.0
        </span>
      </div>
      <p className="mt-1.5 text-[0.66rem] leading-snug text-[#78958F]">
        Deterministic dispatch models calibrated for Indian East Coast raw material intake.
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
      <div className="workspace-shell flex min-h-screen bg-[#081827] text-[#F3EEE5]">
        {/* Desktop sidebar */}
        <motion.aside
          initial={false}
          animate={{ width: collapsed ? 76 : 260 }}
          transition={{ type: "spring", stiffness: 300, damping: 34 }}
          className="sticky top-0 hidden h-screen shrink-0 flex-col border-r border-[#24485C] bg-[#0D2233] lg:flex z-40"
        >
          <div
            className={cn(
              "flex h-20 items-center border-b border-[#24485C] px-4",
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
          <div className="space-y-2.5 border-t border-[#24485C] p-3">
            {!collapsed && (
              <>
                <ActiveDeskCard />
                <ApiCard />
              </>
            )}
            <button
              type="button"
              onClick={toggle}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-expanded={!collapsed}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs text-[#78958F] transition-colors hover:bg-[#15364A] hover:text-[#F3EEE5]",
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

        <div className="flex min-w-0 flex-1 flex-col bg-[#081827] text-[#F3EEE5]">
          {/* Top bar */}
          <header className="sticky top-0 z-30 flex h-16 sm:h-20 items-center justify-between gap-3 border-b border-[#24485C] bg-[#0D2233]/90 px-4 backdrop-blur-md sm:px-6 lg:px-8">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <button
                type="button"
                onClick={() => setDrawer(true)}
                aria-label="Open navigation"
                className="-ml-1 rounded-md p-2 text-[#D8E2E8] hover:bg-[#15364A] hover:text-[#F3EEE5] transition-colors lg:hidden"
              >
                <Menu className="size-5" />
              </button>
              <Link to="/" className="flex items-center lg:hidden" aria-label="NAVIK home">
                <LogoMark className="h-10 sm:h-11 w-auto" />
              </Link>
              
              {/* Search bar matching reference */}
              <div className="relative flex-1 max-w-md hidden md:block">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-[#78958F]" />
                <input
                  type="text"
                  placeholder="Search ports, vessels, routes..."
                  className="w-full h-9 pl-10 pr-4 rounded-lg bg-[#0D2233] border border-[#24485C] text-xs text-[#F3EEE5] placeholder-[#78958F] focus:outline-none focus:border-[#35BFC3] transition-colors"
                />
              </div>

              {/* Mobile workspace title */}
              <div className="md:hidden truncate">
                <p className="truncate text-sm font-bold tracking-tight text-[#F3EEE5]">
                  {current?.label ?? "Command Center"}
                </p>
              </div>
            </div>

            {/* Right actions matching reference */}
            <div className="flex items-center gap-2.5 sm:gap-3">
              <button
                type="button"
                className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0D2233] border border-[#24485C] text-xs font-medium text-[#F3EEE5] hover:bg-[#15364A] transition-colors"
              >
                <Compass className="size-3.5 text-[#35BFC3]" />
                <span>East Coast India Desk</span>
                <ChevronDown className="size-3 text-[#78958F]" />
              </button>

              {pathname !== "/charter" && (
                <Link
                  to="/charter"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#F2B653] px-3.5 py-1.5 text-xs font-bold text-[#081827] shadow-[0_2px_12px_rgba(242,182,83,0.35)] transition-all hover:bg-[#F5C56E] hover:shadow-[0_4px_16px_rgba(242,182,83,0.5)] active:scale-[0.98]"
                >
                  <Plus className="size-3.5 stroke-[2.5]" />
                  <span className="hidden sm:inline">New analysis</span>
                </Link>
              )}

              <OperatorBadge />
            </div>
          </header>

          <main className="flex-1 px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-16 relative">
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
          className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-[#24485C] bg-[#0D2233]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
        >
          {MOBILE_PRIMARY.map((to) => {
            const item = NAV_ITEMS.find((n) => n.to === to)!;
            const Icon = item.icon;
            return (
              <Link
                key={to}
                to={to}
                className="flex flex-col items-center gap-1 py-2.5 text-[0.62rem] font-medium text-[#D8E2E8]"
                activeProps={{ className: "!text-[#35BFC3] font-bold" }}
              >
                <Icon className="size-[1.15rem]" />
                {item.short}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setDrawer(true)}
            className="flex flex-col items-center gap-1 py-2.5 text-[0.62rem] font-medium text-[#D8E2E8]"
          >
            <Menu className="size-[1.15rem]" />
            More
          </button>
        </nav>

        <Sheet open={drawer} onOpenChange={setDrawer}>
          <SheetContent side="left" className="w-[290px] border-r border-[#263D50] bg-[#0B1C2B] p-0">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <SheetDescription className="sr-only">All NAVIK workspaces</SheetDescription>
            <div className="flex h-20 items-center border-b border-[#263D50] px-5">
              <Logo size="sidebar" />
            </div>
            <div className="overflow-y-auto px-3 py-6">
              <NavList collapsed={false} onNavigate={() => setDrawer(false)} />
            </div>
            <div className="space-y-3 border-t border-[#263D50] p-3">
              <ActiveDeskCard />
              <ApiCard />
              <Link
                to="/"
                onClick={() => setDrawer(false)}
                className="flex items-center justify-between rounded-md px-3 py-2 text-xs text-[#A8BAC8] hover:bg-[#102A40] hover:text-[#EAF1F6]"
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
