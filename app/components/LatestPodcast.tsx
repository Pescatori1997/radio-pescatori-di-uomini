import { PlayCircle, Clock3, Mic2 } from "lucide-react";

export default function LatestPodcast() {
  return (
    <section className="mx-auto max-w-7xl px-6 pb-12">

      <div className="rounded-3xl border border-slate-800 bg-slate-900 p-8 shadow-xl">

        <div className="mb-8 flex items-center gap-3">

          <Mic2 className="text-sky-400" size={26} />

          <h2 className="text-3xl font-bold text-white">
            Ultimo Podcast
          </h2>

        </div>

        <div className="flex flex-col gap-8 lg:flex-row">

          <div className="flex h-56 w-full items-center justify-center rounded-3xl bg-gradient-to-br from-sky-600 to-sky-400 lg:w-64">

            <Mic2 size={90} className="text-white" />

          </div>

          <div className="flex flex-1 flex-col justify-center">

            <span className="text-sm font-semibold uppercase tracking-[0.3em] text-sky-400">
              Ultimo Episodio
            </span>

            <h3 className="mt-4 text-4xl font-bold text-white">
              Gesù cambia ancora oggi le vite
            </h3>

            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-400">
              Un episodio dedicato alla speranza che troviamo in Cristo,
              con riflessioni bibliche e incoraggiamento per la vita di ogni giorno.
            </p>

            <div className="mt-8 flex items-center gap-6 text-slate-400">

              <div className="flex items-center gap-2">

                <Clock3 size={18} />

                24 minuti

              </div>

              <div className="flex items-center gap-2">

                <Mic2 size={18} />

                Podcast

              </div>

            </div>

            <button className="mt-10 flex w-fit items-center gap-3 rounded-2xl bg-sky-500 px-8 py-4 text-lg font-bold text-white transition hover:bg-sky-400">

              <PlayCircle size={24} />

              Ascolta Episodio

            </button>

          </div>

        </div>

      </div>

    </section>
  );
}