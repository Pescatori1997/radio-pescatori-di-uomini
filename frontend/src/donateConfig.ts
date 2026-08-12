// "Sostieni il Progetto" configuration — fully editable from the Admin panel
// and stored in settings.donate_config. Defaults mirror the original hardcoded copy.

export type MonthlyPlan = { plan: string; label: string; desc: string };

export type DonateConfig = {
  title: string;
  subtitle: string;
  body: string;
  amounts_title: string;
  presets: number[];
  default_amount: number;
  message_title: string;
  secure_note: string;
  monthly_enabled: boolean;
  monthly_title: string;
  monthly_sub: string;
  monthly_plans: MonthlyPlan[];
};

export const DEFAULT_DONATE: DonateConfig = {
  title: "Sostieni Pescatori di Uomini",
  subtitle: "Un progetto senza scopo di lucro, sostenuto dalle offerte.",
  body: "Ogni contenuto, ogni diretta e ogni podcast sono resi possibili grazie alla generosità di chi crede in questa missione. Il tuo sostegno ci permette di continuare ad annunciare il Vangelo.",
  amounts_title: "Scegli un importo",
  presets: [5, 10, 25, 50, 100],
  default_amount: 10,
  message_title: "Il tuo messaggio (facoltativo)",
  secure_note: "Pagamento sicuro con Stripe. Nessun dato della carta viene salvato.",
  monthly_enabled: true,
  monthly_title: "Sostieni la radio ogni mese",
  monthly_sub: "Con una piccola offerta mensile ci aiuti a pianificare e a portare avanti la missione con continuità. Puoi annullare quando vuoi.",
  monthly_plans: [
    { plan: "5", label: "5€", desc: "Un piccolo gesto costante" },
    { plan: "10", label: "10€", desc: "Il sostegno più scelto" },
    { plan: "20", label: "20€", desc: "Aiuti a crescere la missione" },
  ],
};

export function mergeDonate(stored?: Partial<DonateConfig> | null): DonateConfig {
  const s = stored || {};
  const presets = Array.isArray(s.presets) && s.presets.length
    ? s.presets.map((n) => Number(n)).filter((n) => n > 0)
    : DEFAULT_DONATE.presets;
  const plans = Array.isArray(s.monthly_plans)
    ? s.monthly_plans.filter((p) => p && p.plan).map((p) => ({ plan: String(p.plan), label: p.label || `${p.plan}€`, desc: p.desc || "" }))
    : DEFAULT_DONATE.monthly_plans;
  return {
    ...DEFAULT_DONATE,
    ...s,
    presets,
    default_amount: Number(s.default_amount) || DEFAULT_DONATE.default_amount,
    monthly_enabled: s.monthly_enabled !== false,
    monthly_plans: plans,
  } as DonateConfig;
}
