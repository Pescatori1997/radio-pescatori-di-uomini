import Link from "next/link";
import BottomNav from "./BottomNav";

type PageTemplateProps = {
  title: string;
  subtitle: string;
  children?: React.ReactNode;
};

export default function PageTemplate({
  title,
  subtitle,
  children,
}: PageTemplateProps) {
  return (
    <main className="min-h-screen bg-slate-950 text-white pb-24">

      <section className="mx-auto max-w-7xl px-6 py-10">

        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2 text-slate-300 transition hover:bg-slate-800 hover:text-white"
        >
          ← Torna alla Home
        </Link>

        <p className="mt-10 text-sky-400 uppercase tracking-[0.3em] font-semibold">
          RADIO PESCATORI DI UOMINI
        </p>

        <h1 className="mt-3 text-5xl font-extrabold">
          {title}
        </h1>

        <p className="mt-6 max-w-3xl text-xl leading-8 text-slate-300">
          {subtitle}
        </p>

        <div className="mt-12">
          {children}
        </div>

      </section>

      <BottomNav />

    </main>
  );
}