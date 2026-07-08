import PageTemplate from "../components/PageTemplate";

export default function StudiPage() {
  return (
    <PageTemplate
      title="📖 Studi Biblici"
      subtitle="Approfondisci la Parola di Dio attraverso studi, meditazioni e serie bibliche."
    >
      <div className="rounded-3xl border border-slate-700 bg-slate-900 p-8">
        <h2 className="text-3xl font-bold">Studi Biblici</h2>

        <p className="mt-4 text-slate-400">
          Qui saranno disponibili tutti gli studi biblici organizzati per argomento, libro e serie.
        </p>
      </div>
    </PageTemplate>
  );
}