"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import TeamCard from "./TeamCard";
import { team } from "./team";

export default function TeamCarousel() {
  const [current, setCurrent] = useState(0);

  const previous = () => {
    setCurrent((prev) =>
      prev === 0 ? team.length - 1 : prev - 1
    );
  };

  const next = () => {
    setCurrent((prev) =>
      prev === team.length - 1 ? 0 : prev + 1
    );
  };

  return (
    <section className="mx-auto max-w-7xl px-6 pb-20">

      <div className="mb-8 flex items-center justify-between">

        <div>

          <p className="text-sky-400 font-semibold uppercase tracking-[0.3em]">
            TEAM
          </p>

          <h2 className="mt-2 text-4xl font-extrabold text-white">
            Le persone dietro la Radio
          </h2>

        </div>

        <div className="flex gap-3">

          <button
            onClick={previous}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-800 text-white transition hover:bg-sky-500"
          >
            <ChevronLeft size={22} />
          </button>

          <button
            onClick={next}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-800 text-white transition hover:bg-sky-500"
          >
            <ChevronRight size={22} />
          </button>

        </div>

      </div>

      <TeamCard {...team[current]} />

      <div className="mt-8 flex justify-center gap-3">

        {team.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrent(index)}
            className={`transition-all duration-300 ${
              current === index
                ? "h-3 w-10 rounded-full bg-sky-500"
                : "h-3 w-3 rounded-full bg-slate-600 hover:bg-slate-400"
            }`}
          />
        ))}

      </div>

    </section>
  );
}