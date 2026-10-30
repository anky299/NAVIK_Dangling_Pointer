import {
  Anchor,
  Compass,
  FileSignature,
  FlaskConical,
  LineChart,
  MessagesSquare,
  ScrollText,
  ShieldCheck,
  Ship,
  Waypoints,
  type LucideIcon,
} from "lucide-react";

export type AppPath =
  | "/dashboard"
  | "/charter"
  | "/market"
  | "/insurance"
  | "/feasibility"
  | "/scenarios"
  | "/strategy"
  | "/assistant"
  | "/contracts"
  | "/audit";

export interface NavItem {
  to: AppPath;
  label: string;
  short: string;
  icon: LucideIcon;
}

export const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Command",
    items: [
      { to: "/dashboard", label: "Command Center", short: "Command", icon: Compass },
      { to: "/charter", label: "Charter Workspace", short: "Charter", icon: Anchor },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { to: "/market", label: "Freight Market", short: "Market", icon: LineChart },
      { to: "/insurance", label: "Insurance Intelligence", short: "Insurance", icon: ShieldCheck },
      { to: "/feasibility", label: "Fleet & Port Feasibility", short: "Feasibility", icon: Ship },
      { to: "/scenarios", label: "Scenario Lab", short: "Scenarios", icon: FlaskConical },
      { to: "/strategy", label: "Portfolio & Repositioning", short: "Strategy", icon: Waypoints },
    ],
  },
  {
    label: "Desk",
    items: [
      { to: "/assistant", label: "Nirnay Assistant", short: "Nirnay", icon: MessagesSquare },
      { to: "/contracts", label: "Contract Records", short: "Contracts", icon: FileSignature },
      { to: "/audit", label: "Audit Trail", short: "Audit", icon: ScrollText },
    ],
  },
];

export const NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items);

export const MOBILE_PRIMARY: AppPath[] = ["/dashboard", "/charter", "/market", "/assistant"];
