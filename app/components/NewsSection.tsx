import { Newspaper } from "lucide-react";

export default function NewsSection() {
  return (
    <section className="mx-auto max-w-7xl px-6 pb-16">

      <div className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900">

        <div className="flex items-center gap-3 border-b border-slate-800 px-6 py-4">

          <Newspaper className="text-sky-400" size={22} />

          <h2 className="text-xl font-bold text-white">
            Ultime News
          </h2>

        </div>

        <div className="overflow-hidden whitespace-nowrap py-5">

          <div className="animate-[marquee_30s_linear_infinite] inline-block text-lg text-slate-300">

            📻 Benvenuto su Radio Pescatori di Uomini •
            🎙 Nuovi podcast ogni settimana •
            📖 Nuovi studi biblici disponibili •
            🙏 Inviaci la tua richiesta di preghiera •
            💬 Scrivici su WhatsApp •

          </div>

        </div>

      </div>

    </section>
  );
}