import Link from "next/link";
import PageTemplate from "../components/PageTemplate";

export default function AltroPage() {
  const items = [
    {
      title: "Chi siamo",
      description: "Scopri il team della radio",
      href: "/chi-siamo",
      icon: "👥",
    },
    {
      title: "Richieste di Preghiera",
      description: "Invia una richiesta di preghiera",
      href: "/preghiera",
      icon: "🙏",
    },
    {
      title: "Partecipa",
      description: "Messaggi e vocali WhatsApp",
      href: "/partecipa",
      icon: "💬",
    },
    {
      title: "Eventi",
      description: "Calendario e appuntamenti",
      href: "/eventi",
      icon: "📅",
    },
    {
      title: "Musica",
      description: "Artisti e playlist",
      href: "/musica",
      icon: "🎵",
    },
    {
      title: "Sostienici",
      description: "Aiuta questo progetto",
      href: "/sostienici",
      icon: "❤️",
    },
    {
      title: "Dashboard",
      description: "Area amministratore",
      href: "/dashboard",
      icon: "⚙️",
    },
  ];

  return (
    <PageTemplate
      title="☰ Altro"
      subtitle="Tutte le sezioni della piattaforma."
    >
      <div className="space-y-4">
        {items.map((item) => (
          <Link
            key={item.title}
            href={item.href}
            className="flex items-center justify-between rounded-3xl border border-slate-700 bg-slate-900 p-6 transition hover:border-sky-500 hover:bg-slate-800"
          >
            <div className="flex items-center gap-5">
              <div className="text-4xl">{item.icon}</div>

              <div>
                <h2 className="text-xl font-bold">
                  {item.title}
                </h2>

                <p className="text-slate-400">
                  {item.description}
                </p>
              </div>
            </div>

            <div className="text-3xl text-slate-500">
              →
            </div>
          </Link>
        ))}
      </div>
    </PageTemplate>
  );
}