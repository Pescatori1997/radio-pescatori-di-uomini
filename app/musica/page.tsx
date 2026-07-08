import PageTemplate from "../components/PageTemplate";

export default function MusicaPage() {
  return (
    <PageTemplate
      title="🎵 Musica"
      subtitle="Scopri gli artisti e la musica trasmessa dalla radio."
    >
      <div className="rounded-3xl border border-slate-700 bg-slate-900 p-8">
        <h2 className="text-3xl font-bold">Musica</h2>

        <p className="mt-4 text-slate-400">
          Qui troverai playlist, artisti autorizzati e nuove uscite.
        </p>
      </div>
    </PageTemplate>
  );
}