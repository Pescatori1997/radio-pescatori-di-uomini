import PageTemplate from "../components/PageTemplate";

export default function SostieniciPage() {
  return (
    <PageTemplate
      title="❤️ Sostienici"
      subtitle="Aiutaci a portare avanti questo progetto."
    >
      <div className="rounded-3xl border border-slate-700 bg-slate-900 p-8">
        <h2 className="text-3xl font-bold">Sostienici</h2>

        <p className="mt-4 text-slate-400">
          In questa sezione sarà possibile sostenere Radio Pescatori di Uomini.
        </p>
      </div>
    </PageTemplate>
  );
}