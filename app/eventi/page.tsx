import PageTemplate from "../components/PageTemplate";

export default function EventiPage() {
  return (
    <PageTemplate
      title="📅 Eventi"
      subtitle="Scopri gli eventi di Radio Pescatori di Uomini."
    >
      <div className="rounded-3xl border border-slate-700 bg-slate-900 p-8">
        <h2 className="text-3xl font-bold">Eventi</h2>

        <p className="mt-4 text-slate-400">
          Qui troverai conferenze, evangelizzazioni, incontri e appuntamenti futuri.
        </p>
      </div>
    </PageTemplate>
  );
}