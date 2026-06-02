import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  QrCode,
  Link2,
  Radio,
  BarChart3,
  Search,
  Zap,
  Globe,
  Star,
  ArrowRight,
  Shield,
  Clock,
  Users,
  CheckCircle2,
  ChevronRight,
  Sparkles,
} from "lucide-react";

const features = [
  { icon: QrCode, title: "QR Code de proximite", description: "Le client scanne et paie en quelques secondes via Momo, Moov, Celtiis ou carte.", color: "from-emerald-500 to-emerald-600", shadow: "shadow-emerald-500/20" },
  { icon: Link2, title: "Lien de paiement", description: "Partagez par WhatsApp ou SMS pour encaisser a distance, ou qu'il soit.", color: "from-blue-500 to-blue-600", shadow: "shadow-blue-500/20" },
  { icon: Radio, title: "Push USSD", description: "Pour les telephones basiques : confirmation directe sur l'ecran GSM.", color: "from-amber-500 to-amber-600", shadow: "shadow-amber-500/20" },
  { icon: BarChart3, title: "Tableau de bord", description: "Suivez vos ventes par operateur, par jour, par statut. Sans effort.", color: "from-rose-500 to-rose-600", shadow: "shadow-rose-500/20" },
  { icon: Search, title: "Tracabilite totale", description: "Chaque transaction est referencee et consultable a tout moment.", color: "from-orange-500 to-orange-600", shadow: "shadow-orange-500/20" },
  { icon: Zap, title: "100 % automatique", description: "Statut mis a jour en temps reel, fini les fausses confirmations SMS.", color: "from-emerald-500 to-emerald-600", shadow: "shadow-emerald-500/20" },
  { icon: Globe, title: "Multi-reseaux", description: "Compatible MTN MoMo, Moov Money, Celtiis, Glo, et bien d'autres.", color: "from-amber-500 to-amber-600", shadow: "shadow-amber-500/20" },
];

const testimonials = [
  { stars: 5, text: "Depuis que j'utilise PayPME, mes clients paient en quelques secondes. Plus besoin de rendre la monnaie !", name: "Aissatou K.", role: "Epicerie, Cotonou", initials: "AK", color: "from-emerald-500 to-emerald-600" },
  { stars: 5, text: "Le lien WhatsApp c'est revolutionnaire. Je peux encaisser mes clients meme quand ils ne sont pas la !", name: "Marc B.", role: "Coiffeur, Porto-Novo", initials: "MB", color: "from-blue-500 to-blue-600" },
  { stars: 4, text: "Simple a utiliser, meme mes clients ages arrivent a payer sans aide. Je recommande a tous.", name: "Fatoumata D.", role: "Restauratrice, Abomey-Calavi", initials: "FD", color: "from-rose-500 to-rose-600" },
  { stars: 5, text: "Le tableau de bord me permet de voir exactement ce que j'ai gagne chaque jour. Tres utile pour ma gestion.", name: "Sekou K.", role: "Pharmacie, Parakou", initials: "SK", color: "from-amber-500 to-amber-600" },
];

const featuresLoop = [...features, ...features];
const testiLoop = [...testimonials, ...testimonials];

export default function HomePage() {
  const navigate = useNavigate();

  const featRef = useRef<HTMLDivElement>(null);
  const testiRef = useRef<HTMLDivElement>(null);
  const featPos = useRef(0);
  const testiPos = useRef(0);
  const featPaused = useRef(false);
  const testiPaused = useRef(false);

  useEffect(() => {
    let animId: number;
    const loop = () => {
      if (featRef.current && !featPaused.current) {
        featPos.current += 0.6;
        const half = featRef.current.scrollWidth / 2;
        if (featPos.current >= half) featPos.current = 0;
        featRef.current.style.transform = `translateX(-${featPos.current}px)`;
      }
      if (testiRef.current && !testiPaused.current) {
        testiPos.current += 0.5;
        const half = testiRef.current.scrollWidth / 2;
        if (testiPos.current >= half) testiPos.current = 0;
        testiRef.current.style.transform = `translateX(-${testiPos.current}px)`;
      }
      animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <div className="font-sans bg-gray-950 text-gray-100 w-full overflow-hidden antialiased">

      {/* NAVBAR */}
      <nav className="flex justify-between items-center px-8 py-4 border-b border-gray-800/50 bg-gray-950/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="flex items-center gap-2.5 font-bold text-xl">
          <div className="w-8 h-8 bg-linear-to-br from-emerald-400 to-emerald-600 rounded-lg flex items-center justify-center text-white text-sm font-bold shadow-lg shadow-emerald-500/30">
            P
          </div>
          <span className="text-white">Pay<span className="text-emerald-400">com</span></span>
        </div>
        <div className="flex gap-3 items-center">
          <button
            onClick={() => navigate("/login")}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold border border-gray-700 bg-gray-900 text-gray-300 hover:text-white hover:border-gray-600 transition-all duration-200"
          >
            Connexion
          </button>
          <button
            onClick={() => navigate("/register")}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-linear-to-r from-emerald-500 to-emerald-600 text-white hover:from-emerald-600 hover:to-emerald-700 shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all duration-200"
          >
            S'inscrire
          </button>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative py-24 px-8 text-center overflow-hidden">
        <div className="absolute inset-0 bg-linear-to-br from-blue-950 via-gray-950 to-emerald-950" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(16,185,129,0.15),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(59,130,246,0.1),transparent_50%)]" />
        <div className="absolute top-1/4 right-1/4 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-blue-500/8 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "2s" }} />
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />

        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold px-4 py-2 rounded-full mb-8">
            <Sparkles className="w-3.5 h-3.5" />
            Solution de paiement nouvelle generation
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-[1.1] tracking-tight max-w-2xl mx-auto mb-5 text-white">
            Encaissez en Mobile Money{" "}
            <span className="bg-linear-to-r from-emerald-400 via-emerald-300 to-blue-400 bg-clip-text text-transparent">
              partout
            </span>
            , par tous vos clients
          </h1>

          <p className="text-base sm:text-lg text-gray-400 max-w-lg mx-auto mb-10 leading-relaxed">
            QR code, lien de paiement ou Push USSD : peu importe le telephone du client, vous recevez votre argent. Concu pour les petits commerces.
          </p>

          <div className="flex justify-center gap-4 flex-wrap">
            <button
              onClick={() => navigate("/register")}
              className="group inline-flex items-center gap-2 px-7 py-4 rounded-2xl text-sm font-bold bg-linear-to-r from-emerald-500 to-emerald-600 text-white hover:from-emerald-600 hover:to-emerald-700 shadow-xl shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all duration-300 hover:-translate-y-0.5"
            >
              Creer mon compte gratuit
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
            <button
              onClick={() => navigate("/login")}
              className="inline-flex items-center gap-2 px-7 py-4 rounded-2xl text-sm font-semibold bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 hover:text-white transition-all duration-200"
            >
              J'ai deja un compte
            </button>
          </div>

          <div className="mt-12 flex items-center justify-center gap-8 text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-500" />
              <span>Paiement securise</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-400" />
              <span>Confirmation instantanee</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-amber-400" />
              <span>2 000+ marchands</span>
            </div>
          </div>
        </div>
      </section>

      {/* STATS */}
      <div className="relative">
        <div className="absolute inset-0 bg-linear-to-b from-gray-950 to-gray-900" />
        <div className="relative grid grid-cols-3 border-t border-b border-gray-800/50 bg-gray-900/50 backdrop-blur-sm">
          {[
            { num: "+2 000", label: "Marchands inscrits", icon: Users, color: "text-emerald-400" },
            { num: "3 min", label: "Duree de validite QR", icon: Clock, color: "text-blue-400" },
            { num: "5 reseaux", label: "MTN, Moov, Celtiis & +", icon: Globe, color: "text-amber-400" },
          ].map((s, i) => (
            <div key={i} className={`py-8 text-center group ${i < 2 ? "border-r border-gray-800/50" : ""}`}>
              <div className="flex justify-center mb-3">
                <div className="w-10 h-10 rounded-xl bg-gray-800/50 border border-gray-700/50 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <s.icon className={`w-5 h-5 ${s.color}`} />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold text-white mb-1">{s.num}</div>
              <div className="text-xs text-gray-500 font-medium">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* FEATURES CAROUSEL */}
      <section className="py-20 bg-gray-950 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(16,185,129,0.04),transparent_60%)]" />
        <div className="relative">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold mb-3 mx-auto w-fit">
            <Zap className="w-3.5 h-3.5" />
            Fonctionnalites
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-center text-white mb-2">
            Tout ce qu'il vous faut
          </h2>
          <p className="text-center text-gray-500 text-sm mb-10 max-w-md mx-auto">
            Des outils simples et puissants pour encaisser sans stress au quotidien.
          </p>
          <div className="overflow-hidden w-full">
            <div ref={featRef} className="flex gap-4" style={{ width: "max-content" }}>
              {featuresLoop.map((f, i) => (
                <div
                  key={i}
                  className="group bg-gray-900/60 border border-gray-800/50 rounded-2xl p-6 shrink-0 w-56 hover:border-gray-700/80 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
                  onMouseEnter={() => (featPaused.current = true)}
                  onMouseLeave={() => (featPaused.current = false)}
                >
                  <div className={`w-11 h-11 rounded-xl bg-linear-to-br ${f.color} flex items-center justify-center shadow-lg ${f.shadow} mb-4 group-hover:scale-110 transition-transform duration-300`}>
                    <f.icon className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-sm font-bold text-white mb-1.5">{f.title}</h3>
                  <p className="text-xs text-gray-400 leading-relaxed">{f.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="py-20 bg-gray-900/50 relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,rgba(59,130,246,0.05),transparent_60%)]" />
        <div className="relative max-w-4xl mx-auto px-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold mb-3 mx-auto w-fit">
            <ChevronRight className="w-3.5 h-3.5" />
            Comment ca marche
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-center text-white mb-14">
            3 etapes, <span className="bg-linear-to-r from-emerald-400 to-blue-400 bg-clip-text text-transparent">c'est tout</span>
          </h2>
          <div className="grid md:grid-cols-3 gap-8 items-end">
            {[
              { step: "01", title: "Creez votre compte", desc: "Inscription gratuite en 2 minutes. Aucun document complexe necessaire.", icon: Users, color: "from-emerald-500 to-emerald-600", offset: false },
              { step: "02", title: "Generez un QR ou lien", desc: "Depuis votre tableau de bord, creez un moyen de paiement en un clic.", icon: QrCode, color: "from-blue-500 to-blue-600", offset: true },
              { step: "03", title: "Encaissez instantanement", desc: "Le client paie, vous recevez la confirmation et l'argent en temps reel.", icon: Zap, color: "from-amber-500 to-amber-600", offset: false },
            ].map((item) => (
              <div key={item.step} className={`relative group ${item.offset ? "md:-translate-y-6" : ""}`}>
                <div className="bg-gray-900/80 border border-gray-800/50 rounded-2xl p-7 hover:border-gray-700/80 transition-all duration-300 hover:-translate-y-1 h-full">
                  <div className="text-5xl font-black text-gray-800/50 mb-4">{item.step}</div>
                  <div className={`w-11 h-11 rounded-xl bg-linear-to-br ${item.color} flex items-center justify-center shadow-lg mb-4 group-hover:scale-110 transition-transform duration-300`}>
                    <item.icon className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-base font-bold text-white mb-2">{item.title}</h3>
                  <p className="text-sm text-gray-400 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS CAROUSEL */}
      <section className="py-20 bg-gray-950 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(245,158,11,0.04),transparent_60%)]" />
        <div className="relative">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold mb-3 mx-auto w-fit">
            <Star className="w-3.5 h-3.5" />
            Temoignages
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-center text-white mb-2">
            Ce que disent nos marchands
          </h2>
          <p className="text-center text-gray-500 text-sm mb-10 max-w-md mx-auto">
            Des milliers de commerces font deja confiance a Paycom.
          </p>
          <div className="overflow-hidden w-full">
            <div ref={testiRef} className="flex gap-4" style={{ width: "max-content" }}>
              {testiLoop.map((t, i) => (
                <div
                  key={i}
                  className="group bg-gray-900/60 border border-gray-800/50 rounded-2xl p-6 shrink-0 w-64 hover:border-gray-700/80 transition-all duration-300 hover:-translate-y-1"
                  onMouseEnter={() => (testiPaused.current = true)}
                  onMouseLeave={() => (testiPaused.current = false)}
                >
                  <div className="flex items-center gap-0.5 mb-4">
                    {Array.from({ length: 5 }).map((_, si) => (
                      <Star key={si} className={`w-3.5 h-3.5 ${si < t.stars ? "fill-amber-400 text-amber-400" : "text-gray-700"}`} />
                    ))}
                  </div>
                  <p className="text-sm text-gray-300 leading-relaxed italic mb-5">"{t.text}"</p>
                  <div className="flex items-center gap-3 pt-4 border-t border-gray-800/50">
                    <div className={`w-9 h-9 rounded-full bg-linear-to-br ${t.color} flex items-center justify-center text-xs font-bold text-white shadow-lg`}>
                      {t.initials}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white">{t.name}</div>
                      <div className="text-xs text-gray-500">{t.role}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA BAND */}
      <section className="relative py-20 px-8 text-center overflow-hidden">
        <div className="absolute inset-0 bg-linear-to-br from-blue-950 via-gray-950 to-emerald-950" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(16,185,129,0.1),transparent_60%)]" />
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold mb-6 mx-auto w-fit">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Rejoignez 2 000+ marchands
          </div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white mb-4 leading-tight">
            Pret a moderniser{" "}
            <span className="bg-linear-to-r from-emerald-400 to-blue-400 bg-clip-text text-transparent">
              votre commerce
            </span>
            ?
          </h2>
          <p className="text-gray-400 mb-8 text-sm sm:text-base leading-relaxed max-w-lg mx-auto">
            Rejoignez des milliers de marchands qui encaissent plus facilement, plus rapidement, sans stress.
          </p>
          <button
            onClick={() => navigate("/register")}
            className="group inline-flex items-center gap-2 bg-white text-emerald-700 font-bold px-8 py-4 rounded-2xl text-sm hover:bg-emerald-50 shadow-xl shadow-white/10 transition-all duration-300 hover:-translate-y-0.5"
          >
            Creer mon compte gratuit
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-xs text-gray-500">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span>Gratuit</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span>Sans carte bancaire</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span>Annulation a tout moment</span>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="flex justify-between items-center px-8 py-6 border-t border-gray-800/50 bg-gray-950">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-linear-to-br from-emerald-400 to-emerald-600 rounded-md flex items-center justify-center text-white text-xs font-bold shadow shadow-emerald-500/20">
            P
          </div>
          <span className="text-xs text-gray-600">2025 Paycom</span>
        </div>
        <div className="flex gap-6">
          <a href="#" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">Confidentialite</a>
          <a href="#" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">CGU</a>
          <a href="#" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">Contact</a>
        </div>
      </footer>

    </div>
  );
}

