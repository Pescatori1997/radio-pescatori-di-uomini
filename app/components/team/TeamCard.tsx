"use client";

import Image from "next/image";

type TeamCardProps = {
  image: string;
  name: string;
  role: string;
  description: string;
  verse: string;
};

export default function TeamCard({
  image,
  name,
  role,
  description,
  verse,
}: TeamCardProps) {
  return (
    <div className="relative overflow-hidden rounded-[32px] border border-slate-800 bg-slate-950 shadow-2xl">

      <div className="relative h-[720px] w-full">

        <Image
          src={image}
          alt={name}
          fill
          priority
          className="object-cover"
        />

        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />

        <div className="absolute bottom-0 left-0 right-0 p-10">

          <p className="text-sm uppercase tracking-[0.35em] text-sky-400">
            {role}
          </p>

          <h2 className="mt-3 text-5xl font-extrabold text-white">
            {name}
          </h2>

          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-200">
            {description}
          </p>

          <div className="mt-8 rounded-2xl bg-white/10 backdrop-blur p-5">

            <p className="text-sm uppercase tracking-[0.3em] text-sky-300">
              Versetto Guida
            </p>

            <p className="mt-2 text-xl font-semibold text-white">
              {verse}
            </p>

          </div>

        </div>

      </div>

    </div>
  );
}