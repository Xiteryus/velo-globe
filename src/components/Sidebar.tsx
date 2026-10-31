"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Globe, List, Settings, Upload } from "lucide-react";

const ITEMS = [
  { href: "/", label: "Globe", Icon: Globe },
  { href: "/stats", label: "Statistiques", Icon: BarChart3 },
  { href: "/history", label: "Historique", Icon: List },
  { href: "/import", label: "Importation", Icon: Upload },
  { href: "/settings", label: "Paramètres", Icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <nav className="fixed left-0 top-0 z-50 flex h-screen w-14 flex-col items-center gap-2 border-r border-white/10 bg-[#0a0d13] pt-4">
      {ITEMS.map(({ href, label, Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            title={label}
            aria-label={label}
            className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${
              active ? "bg-white/10 text-teal-300" : "text-zinc-500 hover:text-zinc-200"
            }`}
          >
            <Icon size={20} />
          </Link>
        );
      })}
    </nav>
  );
}
