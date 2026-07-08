import PageTemplate from "../components/PageTemplate";

export default function PodcastPage() {
  return (
    <PageTemplate
      title="🎙 Podcast"
      subtitle="Ascolta tutti i podcast di Radio Pescatori di Uomini."
    >
      <div className="rounded-3xl border border-slate-700 bg-slate-900 p-8">

        <h2 className="text-3xl font-bold">
          Podcast
        </h2>

        <p className="mt-4 text-slate-400">
          Qui verranno mostrati tutti i podcast, divisi per categorie e serie.
        </p>

      </div>
    </PageTemplate>
  );
}