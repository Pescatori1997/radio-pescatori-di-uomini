import Header from "./components/Header";
import Hero from "./components/Hero";
import LiveSection from "./components/LiveSection";
import NewsSection from "./components/NewsSection";
import LatestPodcast from "./components/LatestPodcast";
import ScheduleSection from "./components/ScheduleSection";
import WhatsAppSection from "./components/WhatsAppSection";
import SupportSection from "./components/SupportSection";
import TeamCarousel from "./components/team/TeamCarousel";
import BottomNav from "./components/BottomNav";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 transition-colors duration-300 dark:bg-slate-950 dark:text-white pb-28">

      <Header />

      <Hero />

      <LiveSection />

      <NewsSection />

      <LatestPodcast />

      <ScheduleSection />

      <WhatsAppSection />

      <SupportSection />

      <TeamCarousel />

      <BottomNav />

    </main>
  );
}