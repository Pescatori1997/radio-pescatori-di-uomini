import { CalendarClock } from "lucide-react";

const schedule = [
  {
    time: "08:00",
    title: "Musica Cristiana",
    desc: "Programmazione automatica",
  },
  {
    time: "15:00",
    title: "Studio Biblico",
    desc: "Approfondimento della Parola",
  },
  {
    time: "18:00",
    title: "Podcast",
    desc: "Nuovo episodio",
  },
  {
    time: "21:00",
    title: "Meditazione",
    desc: "Riflessione serale",
  },
];

export default function ScheduleSection() {
  return (
    <section className="mx-auto max-w-7xl px-6 pb-12">

      <div className="rounded-3xl border border-slate-800 bg-slate-900 p-8 shadow-xl">

        <div className="mb-8 flex items-center gap-3">

          <CalendarClock className="text-sky-400" size={26} />

          <h2 className="text-3xl font-bold text-white">
            Programmi di Oggi
          </h2>

        </div>

        <div className="space-y-4">

          {schedule.map((item) => (
            <div
              key={item.time}
              className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950 p-5 transition hover:border-sky-500"
            >
              <div>
                <h3 className="text-xl font-bold text-white">
                  {item.title}
                </h3>

                <p className="mt-1 text-slate-400">
                  {item.desc}
                </p>
              </div>

              <div className="rounded-xl bg-sky-500 px-5 py-3 font-bold text-white">
                {item.time}
              </div>
            </div>
          ))}

        </div>

      </div>

    </section>
  );
}