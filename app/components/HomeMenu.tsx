export default function HomeMenu() {
  const items = [
    {
      icon: "📻",
      title: "Radio",
      text: "Ascolta la diretta H24",
    },
    {
      icon: "🎙",
      title: "Podcast",
      text: "Tutti gli episodi",
    },
    {
      icon: "📖",
      title: "Studi Biblici",
      text: "Approfondisci la Parola",
    },
    {
      icon: "🙏",
      title: "Preghiera",
      text: "Invia una richiesta",
    },
    {
      icon: "💬",
      title: "Partecipa",
      text: "Messaggi e vocali WhatsApp",
    },
    {
      icon: "👥",
      title: "Chi siamo",
      text: "Scopri il team",
    },
  ];

  return (
    <section className="border-t border-slate-800 bg-slate-900 py-20">
      <div className="mx-auto max-w-7xl px-6">

        <h2 className="mb-12 text-center text-4xl font-bold text-white">
          Esplora la piattaforma
        </h2>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">

          {items.map((item) => (
            <button
              key={item.title}
              className="rounded-3xl border border-slate-700 bg-slate-950 p-8 text-left transition duration-300 hover:-translate-y-1 hover:border-sky-500 hover:bg-slate-900"
            >
              <div className="text-5xl">{item.icon}</div>

              <h3 className="mt-6 text-2xl font-bold text-white">
                {item.title}
              </h3>

              <p className="mt-3 text-slate-400">
                {item.text}
              </p>
            </button>
          ))}

        </div>

      </div>
    </section>
  );
}