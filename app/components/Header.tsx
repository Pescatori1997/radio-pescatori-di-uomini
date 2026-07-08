"use client";

import Image from "next/image";
import Link from "next/link";
import { Radio } from "lucide-react";
import ThemeToggle from "./ThemeToggle";

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/80 backdrop-blur-xl">

      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">

        <Link href="/" className="flex items-center gap-4">

          <Image
            src="/logo.png"
            alt="Radio Pescatori di Uomini"
            width={56}
            height={56}
            className="rounded-full shadow-lg"
          />

          <div>

            <h1 className="text-xl font-bold text-white">
              Radio Pescatori di Uomini
            </h1>

            <p className="text-sm text-slate-400">
              Annunciare Cristo, 24 ore su 24
            </p>

          </div>

        </Link>

        <div className="flex items-center gap-3">

          <ThemeToggle />

          <button className="flex items-center gap-2 rounded-2xl bg-sky-500 px-5 py-3 font-semibold text-white shadow-lg shadow-sky-500/30 transition hover:scale-105 hover:bg-sky-400">

            <Radio size={20} />

            In diretta

          </button>

        </div>

      </div>

    </header>
  );
}