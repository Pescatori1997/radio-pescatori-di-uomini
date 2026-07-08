import PageTemplate from "../components/PageTemplate";

export default function RadioPage() {
  return (
    <PageTemplate
      title="📻 Radio"
      subtitle="Ascolta la diretta 24 ore su 24, scopri i programmi e segui la nostra web radio."
    >
      <div className="rounded-3xl border border-slate-700 bg-slate-900 p-8">

        <div className="flex items-center gap-3">
          <div className="h-4 w-4 rounded-full bg-red-500 animate-pulse"></div>

          <span className="font-bold">
            IN DIRETTA
          </span>
        </div>

        <h2 className="mt-6 text-3xl font-bold">
          Player Radio
        </h2>

        <p className="mt-4 text-slate-400">
          Qui inseriremo il player della radio e tutte le informazioni sulla diretta.
        </p>

      </div>
    </PageTemplate>
  );
}