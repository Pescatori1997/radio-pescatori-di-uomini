import {
  MessageCircle,
  CalendarDays,
} from "lucide-react";

const whatsapp = "393517556255";

export default function WhatsAppSection() {
  return (
    <section className="mx-auto max-w-7xl px-6 pb-14">

      <div className="overflow-hidden rounded-3xl border border-green-500/20 bg-gradient-to-br from-green-900/20 to-slate-900 shadow-xl">

        <div className="p-10">

          <div className="flex items-center gap-3">

            <MessageCircle
              className="text-green-400"
              size={30}
            />

            <h2 className="text-4xl font-bold text-white">
              Partecipa alla Radio
            </h2>

          </div>

          <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-300">
            Hai una testimonianza, una domanda biblica, una richiesta di
            preghiera o semplicemente vuoi incoraggiare qualcuno?
            Scrivici su WhatsApp.
          </p>

          <div className="mt-10 rounded-3xl border border-slate-700 bg-slate-950 p-8">

            <p className="text-sm uppercase tracking-[0.3em] text-green-400">
              WhatsApp Ufficiale
            </p>

            <h3 className="mt-3 text-4xl font-extrabold text-white">
              351 755 6255
            </h3>

            <p className="mt-4 text-slate-400">
              Ti risponderemo appena possibile.
            </p>

            <a
              href={`https://wa.me/${whatsapp}?text=Ciao%20Radio%20Pescatori%20di%20Uomini!`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-8 inline-flex rounded-2xl bg-green-500 px-8 py-4 text-lg font-bold text-white transition-all duration-300 hover:scale-105 hover:bg-green-400"
            >
              Apri la chat
            </a>

          </div>

          <div className="mt-10">

            <div className="rounded-3xl border border-slate-800 bg-slate-950 p-8">

              <CalendarDays
                className="text-green-400"
                size={30}
              />

              <h3 className="mt-5 text-3xl font-bold text-white">
                🎙️ La Voce degli Ascoltatori
              </h3>

              <p className="mt-6 leading-8 text-slate-300">
                Durante alcune delle nostre dirette dedicheremo uno spazio
                speciale ai vostri messaggi, alle testimonianze, alle richieste
                di preghiera e, quando possibile, anche ai vocali ricevuti
                tramite WhatsApp.
              </p>

              <p className="mt-5 leading-8 text-slate-300">
                Crediamo che una testimonianza possa incoraggiare qualcuno,
                che una domanda possa aiutare altre persone e che condividere
                insieme ciò che Dio sta facendo nelle nostre vite possa essere
                motivo di edificazione per tutta la comunità.
              </p>

              <div className="mt-8 rounded-2xl border border-green-500/20 bg-green-500/10 p-6">

                <p className="font-semibold text-green-400">
                  💬 Il tuo messaggio potrebbe essere condiviso durante una delle nostre dirette.
                </p>

                <p className="mt-3 leading-7 text-slate-300">
                  Se desideri condividere una testimonianza, una domanda biblica,
                  un motivo di preghiera o un messaggio di incoraggiamento,
                  scrivici su WhatsApp. Saremo felici di leggerti e,
                  quando possibile, di dare spazio al tuo contributo durante la radio.
                </p>

              </div>

            </div>

          </div>

        </div>

      </div>

    </section>
  );
}