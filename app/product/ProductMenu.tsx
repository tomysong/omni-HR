"use client";

import { cn } from "@/lib/utils";
import {
  CalendarDays,
  CheckCheck,
  ClipboardList,
  Home,
  Settings,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const menuItems = [
  { href: "/product", label: "대시보드", icon: CalendarDays },
  { href: "/product/requests", label: "신청", icon: ClipboardList },
  { href: "/product/employees", label: "직원", icon: Users },
  { href: "/product/policy", label: "정책", icon: Settings },
  { href: "/product/approvals", label: "승인", icon: CheckCheck },
];

export function ProductMenu() {
  const pathname = usePathname();

  return (
    <aside className="border-b bg-muted/40 p-2 md:border-b-0 md:border-r">
      <nav className="flex gap-2 overflow-x-auto md:h-full md:max-h-screen md:flex-col md:overflow-visible">
        {menuItems.map((item) => {
          const isActive =
            item.href === "/product"
              ? pathname === "/product"
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <MenuLink key={item.href} href={item.href} active={isActive}>
              <Icon className="h-4 w-4" />
              {item.label}
            </MenuLink>
          );
        })}
        <MenuLink href="/">
          <Home className="h-4 w-4" />홈
        </MenuLink>
      </nav>
    </aside>
  );
}

function MenuLink({
  active,
  href,
  children,
}: {
  active?: boolean;
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex min-w-fit items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-all hover:text-primary",
        active && "bg-muted text-primary",
      )}
    >
      {children}
    </Link>
  );
}
