import PageTemplate from "../components/PageTemplate";

export default function PreghieraPage() {
  return (
    <PageTemplate
      title="🙏 Richieste di Preghiera"
      subtitle="Condividi una richiesta di preghiera con il nostro team."
    >
      <div className="rounded-3xl border border-slate-700 bg-slate-900 p-8">
        <h2 className="text-3xl font-bold">Preghiera</h2>

        <p className="mt-4 text-slate-400">
          Qui potrai inviare una richiesta di preghiera privata o pubblica.
        </p>
      </div>
    </PageTemplate>
  );
}