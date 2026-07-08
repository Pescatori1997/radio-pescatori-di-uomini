import { Play, Radio, Volume2 } from "lucide-react";

export default function LiveSection() {
  return (
    <section className="mx-auto max-w-7xl px-6 pb-12">

      <div className="rounded-3xl border border-slate-800 bg-slate-900 p-8 shadow-xl">

        <div className="mb-6 flex items-center gap-3">

          <div className="h-3 w-3 animate-pulse rounded-full bg-red-500"></div>

          <span className="font-bold uppercase tracking-[0.3em] text-red-400">
            Ora in onda
          </span>

        </div>

        <h2 className="text-4xl font-extrabold text-white">
          Musica Cristiana
        </h2>

        <p className="mt-3 text-lg text-slate-400">
          La radio trasmette musica cristiana 24 ore su 24.
        </p>

        <div className="mt-8 rounded-3xl border border-slate-800 bg-slate-950 p-8">

          <div className="flex items-center gap-5">

            <button className="flex h-16 w-16 items-center justify-center rounded-full bg-sky-500 text-white transition hover:scale-105 hover:bg-sky-400">

              <Play size={28} fill="white" />

            </button>

            <div className="flex-1">

              <h3 className="text-2xl font-bold text-white">
                Radio Pescatori di Uomini
              </h3>

              <p className="mt-1 text-slate-400">
                Diretta Streaming
              </p>

            </div>

            <div className="flex items-center gap-2 rounded-full bg-red-500/20 px-4 py-2">

              <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500"></div>

              <span className="font-semibold text-red-400">
                LIVE
              </span>

            </div>

          </div>

          <div className="mt-8">

            <div className="h-2 overflow-hidden rounded-full bg-slate-800">

              <div className="h-full w-1/3 rounded-full bg-sky-500"></div>

            </div>

            <div className="mt-2 flex justify-between text-sm text-slate-500">

              <span>00:00</span>

              <span>LIVE</span>

            </div>

          </div>

          <div className="mt-8 flex items-center gap-3">

            <Volume2 className="text-slate-400" size={22} />

            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-800">

              <div className="h-full w-3/4 rounded-full bg-sky-500"></div>

            </div>

          </div>

          <div className="mt-8 flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-5">

            <Radio className="text-sky-400" size={26} />

            <div>

              <h4 className="font-semibold text-white">
                Programmazione Automatica
              </h4>

              <p className="text-slate-400">
                In attesa della prossima diretta.
              </p>

            </div>

          </div>

        </div>

      </div>

    </section>
  );
}