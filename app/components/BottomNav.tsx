"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  House,
  Radio,
  Mic2,
  BookOpen,
  Menu,
} from "lucide-react";

const items = [
  {
    href: "/",
    label: "Home",
    icon: House,
  },
  {
    href: "/radio",
    label: "Radio",
    icon: Radio,
  },
  {
    href: "/podcast",
    label: "Podcast",
    icon: Mic2,
  },
  {
    href: "/studi",
    label: "Studi",
    icon: BookOpen,
  },
  {
    href: "/altro",
    label: "Altro",
    icon: Menu,
  },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50">

      <div className="mx-auto max-w-md px-4 pb-5">

        <div className="flex justify-around rounded-3xl border border-slate-800 bg-slate-950/90 p-3 shadow-2xl backdrop-blur-xl">

          {items.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className="group flex flex-col items-center"
              >
                <div
                  className={`rounded-2xl p-3 transition-all duration-300 ${
                    active
                      ? "bg-sky-500 text-white shadow-lg shadow-sky-500/40 scale-110"
                      : "text-slate-400 group-hover:bg-slate-800 group-hover:text-white"
                  }`}
                >
                  <Icon size={22} strokeWidth={2.2} />
                </div>

                <span
                  className={`mt-2 text-[11px] font-medium transition ${
                    active
                      ? "text-sky-400"
                      : "text-slate-400 group-hover:text-white"
                  }`}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}

        </div>

      </div>

    </nav>
  );
}