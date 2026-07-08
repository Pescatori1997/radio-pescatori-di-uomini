import PageTemplate from "../components/PageTemplate";

export default function DashboardPage() {
  return (
    <PageTemplate
      title="⚙️ Dashboard"
      subtitle="Area riservata agli amministratori."
    >
      <div className="rounded-3xl border border-slate-700 bg-slate-900 p-8">
        <h2 className="text-3xl font-bold">Dashboard</h2>

        <p className="mt-4 text-slate-400">
          Da qui gestirai podcast, dirette, collaboratori, eventi, richieste di preghiera e tutte le impostazioni della piattaforma.
        </p>
      </div>
    </PageTemplate>
  );
}