import { HeartHandshake, ArrowRight } from "lucide-react";

export default function SupportSection() {
  return (
    <section className="mx-auto max-w-7xl px-6 pb-20">
      <div className="rounded-3xl border border-sky-500/20 bg-gradient-to-br from-sky-900/20 to-slate-900 p-8 shadow-xl">

        <div className="flex items-center gap-3">
          <HeartHandshake className="text-sky-400" size={30} />
          <h2 className="text-3xl font-bold text-white">
            Sostieni Radio Pescatori di Uomini
          </h2>
        </div>

        <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-300">
          Ogni contributo ci aiuta ad annunciare il Vangelo attraverso la radio,
          i podcast, gli studi biblici e nuovi progetti di evangelizzazione.
        </p>

        <div className="mt-10 flex flex-wrap gap-4">
          <button className="rounded-2xl bg-sky-500 px-8 py-4 text-lg font-bold text-white hover:bg-sky-400 transition">
            ❤️ Dona Ora
          </button>

          <button className="flex items-center gap-2 rounded-2xl border border-slate-700 px-8 py-4 text-lg font-semibold text-white hover:bg-slate-800 transition">
            Scopri di più
            <ArrowRight size={20} />
          </button>
        </div>

      </div>
    </section>
  );
}