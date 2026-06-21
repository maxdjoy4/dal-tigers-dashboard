"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClipboardList,
  CircleUserRound,
  Gauge,
  Home,
  LineChart,
  Shield,
  Settings2,
  Swords,
  Upload,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Team Summary", icon: Home },
  { href: "/game-analyzer", label: "Game Analyzer", icon: Gauge },
  { href: "/trends-history", label: "Trends & History", icon: LineChart },
  { href: "/team-comparison", label: "Team Comparison", icon: Swords },
  { href: "/player-overview", label: "Squad Overview", icon: Users },
  { href: "/player-breakdown", label: "Player Breakdown", icon: CircleUserRound },
  { href: "/goalie-breakdown", label: "Goalie Breakdown", icon: Shield },
  { href: "/coaching-focus", label: "Coaching Focus", icon: ClipboardList },
  { href: "/admin/kpi-weights", label: "KPI Weights", icon: Settings2 },
  { href: "/admin/upload", label: "Admin Upload", icon: Upload },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-ice">
      <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col gap-6 px-4 py-4 lg:flex-row lg:px-6">
        <aside className="glass-panel gold-ring w-full rounded-4xl p-4 lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)] lg:w-[280px] lg:flex-shrink-0">
          <div className="rounded-3xl border border-gold-300/20 bg-gradient-to-br from-gold-300/20 via-white/5 to-white/0 p-5">
            <p className="section-title">Dal Tigers</p>
            <h1 className="mt-2 text-2xl font-semibold">Women&apos;s Hockey</h1>
            <p className="mt-2 text-sm text-slate-300">
              Premium team performance intelligence for coaches, analysts, and staff.
            </p>
          </div>

          <nav className="mt-6 space-y-1.5">
            {navItems.map((item) => {
              const isActive =
                item.href === "/"
                  ? pathname === item.href
                  : pathname.startsWith(item.href);
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition",
                    isActive
                      ? "bg-gold-300/15 text-white shadow-glow"
                      : "text-slate-300 hover:bg-white/5 hover:text-white",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        <main className="min-w-0 flex-1 space-y-6 pb-6">{children}</main>
      </div>
    </div>
  );
}
