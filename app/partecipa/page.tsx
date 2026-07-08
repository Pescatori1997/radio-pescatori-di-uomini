import PageTemplate from "../components/PageTemplate";

export default function PartecipaPage() {
  return (
    <PageTemplate
      title="💬 Partecipa"
      subtitle="Inviaci messaggi e vocali WhatsApp da condividere durante le trasmissioni."
    >
      <div className="rounded-3xl border border-slate-700 bg-slate-900 p-8">
        <h2 className="text-3xl font-bold">Partecipa</h2>

        <p className="mt-4 text-slate-400">
          Questa pagina conterrà il pulsante WhatsApp e tutte le informazioni per partecipare.
        </p>
      </div>
    </PageTemplate>
  );
}