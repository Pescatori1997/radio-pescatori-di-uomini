import Image from "next/image";

export default function Hero() {
  return (
    <section className="mx-auto flex min-h-[calc(100vh-80px)] max-w-7xl flex-col items-center justify-center gap-16 px-6 py-20 lg:flex-row">
      <div className="flex-1">

        <p className="mb-4 font-semibold uppercase tracking-[0.3em] text-sky-400">
          WEB RADIO CRISTIANA
        </p>

        <h1 className="text-5xl font-extrabold leading-tight text-white md:text-7xl">
          Gesù cambia
          <br />
          ancora oggi
          <br />
          le vite.
        </h1>

        <p className="mt-8 max-w-xl text-xl leading-8 text-slate-300">
          Una piattaforma dedicata ad annunciare Cristo attraverso radio,
          podcast, studi biblici, testimonianze e molto altro.
        </p>

        <div className="mt-10 flex flex-wrap gap-4">

          <button className="rounded-xl bg-sky-500 px-8 py-4 text-lg font-bold text-white transition hover:bg-sky-600">
            ▶ Ascolta la Diretta
          </button>

          <button className="rounded-xl border border-slate-700 px-8 py-4 text-lg text-white transition hover:bg-slate-800">
            Esplora
          </button>

        </div>

      </div>

      <div className="flex flex-1 justify-center">

        <Image
          src="/logo.png"
          alt="Logo Radio Pescatori di Uomini"
          width={380}
          height={380}
          priority
          className="drop-shadow-2xl"
        />

      </div>
    </section>
  );
}