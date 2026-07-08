"use client";

import { useState } from "react";
import Image from "next/image";
import {
  Users,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

const team = [
  {
    name: "Luigi Volpe",
    role: "Fondatore & Responsabile",
    image: "/Luigi.png",
    verse: "Giovanni 15:16",
    description:
      "Ho fondato Radio Pescatori di Uomini con il desiderio di annunciare il Vangelo e glorificare Dio attraverso contenuti biblici, testimonianze e programmi che possano raggiungere ogni persona.",
  },

  {
    name: "Collaboratore",
    role: "In arrivo",
    image: "/placeholder.jpg",
    verse: "",
    description:
      "Presto conoscerai uno dei collaboratori della radio.",
  },

  {
    name: "Collaboratore",
    role: "In arrivo",
    image: "/placeholder.jpg",
    verse: "",
    description:
      "Nuovi collaboratori saranno annunciati molto presto.",
  },
];

export default function TeamSection() {

  const [index, setIndex] = useState(0);

  const person = team[index];

  const next = () => {
    setIndex((prev) =>
      prev === team.length - 1 ? 0 : prev + 1
    );
  };

  const previous = () => {
    setIndex((prev) =>
      prev === 0 ? team.length - 1 : prev - 1
    );
  };

  return (

    <section className="mx-auto max-w-7xl px-6 pb-20">

      <div className="rounded-3xl border border-slate-800 bg-slate-900 p-8 shadow-xl">

        <div className="mb-10 flex items-center justify-between">

          <div className="flex items-center gap-3">

            <Users
              className="text-sky-400"
              size={30}
            />

            <h2 className="text-3xl font-bold text-white">
              Il Nostro Team
            </h2>

          </div>
                    <div className="flex gap-3">

            <button
              onClick={previous}
              className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-white transition hover:border-sky-500 hover:bg-sky-500"
            >
              <ChevronLeft size={22} />
            </button>

            <button
              onClick={next}
              className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-white transition hover:border-sky-500 hover:bg-sky-500"
            >
              <ChevronRight size={22} />
            </button>

          </div>

        </div>

        <div className="grid gap-10 lg:grid-cols-2">

          <div className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-950">

            <Image
              src={person.image}
              alt={person.name}
              width={700}
              height={1000}
              priority
              className="h-[700px] w-full object-cover"
            />

          </div>

          <div className="flex flex-col justify-center">

            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-sky-400">
              Collaboratore
            </p>

            <h3 className="mt-4 text-5xl font-extrabold text-white">
              {person.name}
            </h3>

            <p className="mt-3 text-2xl font-semibold text-sky-400">
              {person.role}
            </p>
                        <p className="mt-8 text-lg leading-9 text-slate-300">
              {person.description}
            </p>

            {person.verse && (

              <div className="mt-8 rounded-2xl border border-sky-500/30 bg-sky-500/10 p-6">

                <p className="text-sm uppercase tracking-[0.3em] text-sky-400">
                  Versetto
                </p>

                <p className="mt-3 text-2xl font-semibold text-white">
                  {person.verse}
                </p>

              </div>

            )}

            <div className="mt-10 flex gap-3">

              {team.map((_, i) => (

                <button
                  key={i}
                  onClick={() => setIndex(i)}
                  className={`transition-all duration-300 ${
                    index === i
                      ? "h-3 w-10 rounded-full bg-sky-500"
                      : "h-3 w-3 rounded-full bg-slate-600 hover:bg-slate-400"
                  }`}
                />

              ))}

            </div>
                        <div className="mt-12 rounded-3xl border border-slate-800 bg-slate-950 p-6">

              <h4 className="text-xl font-bold text-white">
                La nostra missione
              </h4>

              <p className="mt-4 text-lg leading-8 text-slate-400">
                Crediamo che il Vangelo debba raggiungere ogni persona.
                Attraverso la radio, i podcast e gli studi biblici vogliamo
                essere uno strumento nelle mani di Dio per incoraggiare,
                evangelizzare e far conoscere Gesù Cristo.
              </p>

            </div>

          </div>

        </div>

        <div className="mt-12 flex justify-center">
                  <button className="rounded-2xl bg-sky-500 px-8 py-4 text-lg font-bold text-white transition hover:bg-sky-400">
            Scopri tutto il Team
          </button>

        </div>

      </div>

    </section>
  );
}