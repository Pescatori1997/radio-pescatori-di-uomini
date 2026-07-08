export default function About() {
  return (
    <section className="border-t border-slate-800 bg-slate-900 py-24">
      <div className="mx-auto max-w-7xl px-6">

        <p className="mb-3 text-sky-400 font-semibold uppercase tracking-[0.3em]">
          Chi siamo
        </p>

        <h2 className="text-5xl font-bold text-white">
          Le persone dietro Radio Pescatori di Uomini
        </h2>

        <p className="mt-6 max-w-3xl text-xl leading-8 text-slate-300">
          Radio Pescatori di Uomini nasce con il desiderio di annunciare
          Gesù Cristo attraverso la radio, podcast, studi biblici,
          testimonianze e contenuti che possano incoraggiare le persone
          ad avvicinarsi al Vangelo.
        </p>

        <div className="mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-3">

          <div className="rounded-3xl border border-slate-700 bg-slate-950 p-8 text-center">
            <div className="mx-auto mb-6 h-32 w-32 rounded-full bg-slate-800"></div>
            <h3 className="text-2xl font-bold text-white">
              Luigi Volpe
            </h3>
            <p className="mt-2 text-sky-400">
              Fondatore
            </p>
          </div>

          <div className="rounded-3xl border border-dashed border-slate-700 p-8 text-center">
            <div className="mx-auto mb-6 h-32 w-32 rounded-full bg-slate-800"></div>
            <h3 className="text-2xl font-bold text-white">
              Prossimamente
            </h3>
            <p className="mt-2 text-slate-400">
              Nuovo collaboratore
            </p>
          </div>

          <div className="rounded-3xl border border-dashed border-slate-700 p-8 text-center">
            <div className="mx-auto mb-6 h-32 w-32 rounded-full bg-slate-800"></div>
            <h3 className="text-2xl font-bold text-white">
              Prossimamente
            </h3>
            <p className="mt-2 text-slate-400">
              Nuovo collaboratore
            </p>
          </div>

        </div>

      </div>
    </section>
  );
}