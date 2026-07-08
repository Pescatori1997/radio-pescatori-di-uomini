import PageTemplate from "../components/PageTemplate";

export default function ChiSiamoPage() {
  return (
    <PageTemplate
      title="👥 Chi siamo"
      subtitle="Conosci il team di Radio Pescatori di Uomini."
    >
      <div className="rounded-3xl border border-slate-700 bg-slate-900 p-8">
        <h2 className="text-3xl font-bold">Il nostro Team</h2>

        <p className="mt-4 text-slate-400">
          Qui presenteremo tutti i collaboratori della radio.
        </p>
      </div>
    </PageTemplate>
  );
}