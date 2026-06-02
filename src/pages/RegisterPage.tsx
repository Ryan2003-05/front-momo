import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import Toast from "../components/Toast";

interface OperateurState {
  active: boolean;
  numero: string;
}

interface FormData {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  businessName: string;
  businessType: string;
  ifu: string;
  city: string;
  password: string;
  confirmPassword: string;
}

interface Operateurs {
  mtn: OperateurState;
  moov: OperateurState;
  celtiis: OperateurState;
}

type FormErrors = Partial<Record<keyof FormData | "operateurs" | "global", string>>;

const OPERATEURS_CONFIG = [
  { key: "mtn",     label: "MTN MoMo",   short: "MTN", color: "#f59e0b", placeholder: "+229 97 00 00 00", nom: "MTN"    },
  { key: "moov",    label: "Moov Money", short: "MOV", color: "#2563eb", placeholder: "+229 96 00 00 00", nom: "Moov"   },
  { key: "celtiis", label: "Celtiis",    short: "CEL", color: "#7c3aed", placeholder: "+229 95 00 00 00", nom: "Celtiis" },
] as const;

type OperateurKey = "mtn" | "moov" | "celtiis";

export default function RegisterPage() {
  const navigate = useNavigate();

  const [form, setForm] = useState<FormData>({
    firstName: "", lastName: "", phone: "", email: "",
    businessName: "", businessType: "", ifu: "", city: "",
    password: "", confirmPassword: "",
  });

  const [operateurs, setOperateurs] = useState<Operateurs>({
    mtn:     { active: true,  numero: "" },
    moov:    { active: false, numero: "" },
    celtiis: { active: false, numero: "" },
  });

  const [errors, setErrors]         = useState<FormErrors>({});
  const [loading, setLoading]       = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType]   = useState<"success" | "error" | "info">("success");
  const [showSingleOperatorWarning, setShowSingleOperatorWarning] = useState(false);

  const activeOperatorCount = Object.values(operateurs).filter((o) => o.active).length;
  const shouldShowSingleOperatorWarning = showSingleOperatorWarning && activeOperatorCount === 1;

  function showToast(message: string, type: "success" | "error" | "info" = "success") {
    setToastMessage(message);
    setToastType(type);
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const toggleOperateur = (key: OperateurKey) => {
    const activeCount = Object.values(operateurs).filter((o) => o.active).length;
    if (operateurs[key].active && activeCount === 1) return;
    setOperateurs({ ...operateurs, [key]: { ...operateurs[key], active: !operateurs[key].active } });
  };

  const handleNumeroChange = (key: OperateurKey, value: string) => {
    setOperateurs({ ...operateurs, [key]: { ...operateurs[key], numero: value } });
  };

  const validate = (): FormErrors => {
    const newErrors: FormErrors = {};
    (Object.keys(form) as (keyof FormData)[]).forEach((key) => {
      if (key === "ifu") return;
      if (!form[key].trim()) newErrors[key] = "Champ obligatoire";
    });
    if (form.password !== form.confirmPassword)
      newErrors.confirmPassword = "Les mots de passe ne correspondent pas";
    if (form.password.trim() && form.password.length < 8)
      newErrors.password = "Le mot de passe doit contenir au moins 8 caractères";
    const activeOps = OPERATEURS_CONFIG.filter((op) => operateurs[op.key].active);
    const missingNumero = activeOps.some((op) => !operateurs[op.key].numero.trim());
    if (missingNumero)
      newErrors.operateurs = "Veuillez renseigner le numéro pour chaque opérateur activé";
    return newErrors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (activeOperatorCount === 1) setShowSingleOperatorWarning(true);
    const validationErrors = validate();
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;
    setLoading(true);

    const comptes = OPERATEURS_CONFIG
      .filter((op) => operateurs[op.key].active)
      .map((op) => ({ operateur_nom: op.nom, numero: operateurs[op.key].numero }));

    try {
      await api.post("/auth/register", {
        email: form.email, mot_de_passe: form.password,
        mot_de_passe_confirmation: form.confirmPassword,
        nom: form.lastName, prenom: form.firstName,
        nom_entreprise: form.businessName, telephone: form.phone,
        type_commerce: form.businessType, ville: form.city,
        ifu: form.ifu || null, comptes,
      });
      setErrors({});
      showToast("Compte créé avec succès ! Redirection en cours...", "success");
      setTimeout(() => navigate("/login"), 3000);
    } catch (err) {
      const error = err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } };
      const serverMessage = error.response?.data?.message;
      const serverErrors  = error.response?.data?.errors;
      if (serverErrors) {
        const mapped: FormErrors = {};
        if (serverErrors["email"])           mapped.email        = serverErrors["email"][0];
        if (serverErrors["mot_de_passe"])     mapped.password     = serverErrors["mot_de_passe"][0];
        if (serverErrors["nom"])              mapped.lastName     = serverErrors["nom"][0];
        if (serverErrors["prenom"])           mapped.firstName    = serverErrors["prenom"][0];
        if (serverErrors["nom_entreprise"])   mapped.businessName = serverErrors["nom_entreprise"][0];
        if (serverErrors["telephone"])        mapped.phone        = serverErrors["telephone"][0];
        if (serverErrors["type_commerce"])    mapped.businessType = serverErrors["type_commerce"][0];
        if (serverErrors["ville"])            mapped.city         = serverErrors["ville"][0];
        if (serverErrors["comptes"])          mapped.operateurs   = serverErrors["comptes"][0];
        setErrors(mapped);
      } else {
        showToast(serverMessage || "Une erreur est survenue. Veuillez réessayer.", "error");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-blue-950">

      {/* Panneau gauche */}
      <div className="w-[42%] bg-blue-950 p-10 flex flex-col justify-between text-white">
        <div className="flex items-center gap-2 font-bold text-lg">
          <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center text-white text-sm">P</div>
          Paycom
        </div>
        <div>
          <h2 className="text-2xl font-bold mb-3 leading-snug">
            Rejoignez des milliers de marchands béninois
          </h2>
          <p className="text-sm text-blue-300 leading-relaxed mb-6">
            Créez votre compte en quelques minutes et commencez à encaisser par QR code, lien ou USSD.
          </p>
          <div className="flex flex-col gap-3">
            {["Inscription gratuite et rapide", "Compatible MTN, Moov, Celtiis & +", "Tableau de bord en temps réel", "Support dédié aux commerçants"].map((f, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-blue-200">
                <span className="w-2 h-2 bg-green-500 rounded-full shrink-0" />
                {f}
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs text-blue-400">© 2025 Paycom</p>
      </div>

      {/* Panneau droit */}
      <div className="flex-1 bg-white rounded-l-2xl p-10 overflow-y-auto">
        <div onClick={() => navigate("/")}
          className="text-xs text-gray-500 mb-4 cursor-pointer flex items-center gap-1 hover:text-gray-700">
          ← Retour à l'accueil
        </div>

        <h2 className="text-xl font-bold text-gray-900 mb-1">Créer un compte</h2>
        <p className="text-sm text-gray-400 mb-5">Renseignez vos informations pour commencer</p>

        {errors.global && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 mb-4">
            {errors.global}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-3">
            <Section title="Informations personnelles" />
            <Input name="firstName" label="Prénom" placeholder="Ex : Kouassi"
              value={form.firstName} onChange={handleChange} error={errors.firstName} />
            <Input name="lastName" label="Nom" placeholder="Ex : Aïssatou"
              value={form.lastName} onChange={handleChange} error={errors.lastName} />
            <Input name="phone" label="Téléphone" placeholder="+229 97 00 00 00"
              value={form.phone} onChange={handleChange} error={errors.phone} />
            <Input name="email" label="Email" placeholder="monmail@gmail.com"
              value={form.email} onChange={handleChange} error={errors.email} />

            <Section title="Informations du commerce" />
            <Input full name="businessName" label="Nom du commerce" placeholder="Ex : Épicerie Kouassi"
              value={form.businessName} onChange={handleChange} error={errors.businessName} />
            <Select name="businessType" label="Type de commerce"
              value={form.businessType} onChange={handleChange} error={errors.businessType}
              options={["Épicerie / Alimentation", "Restauration", "Coiffure / Beauté", "Pharmacie", "Textile / Mode", "Autre"]} />
            <Input name="ifu" label="Ifu (optionnel)" placeholder="Ex : 1234567890123"
              value={form.ifu} onChange={handleChange} error={errors.ifu} />
            <Select name="city" label="Ville"
              value={form.city} onChange={handleChange} error={errors.city}
              options={["Cotonou", "Porto-Novo", "Abomey-Calavi", "Parakou", "Bohicon", "Autre"]} />

            <Section title="Comptes mobile money" />
            <p className="col-span-2 text-xs text-gray-400 -mt-1 mb-1">
              Activez au moins un opérateur. Vous pouvez en ajouter d'autres depuis votre profil.
            </p>

            <div className="col-span-2 flex flex-col gap-2">
              {OPERATEURS_CONFIG.map((op) => {
                const state = operateurs[op.key];
                const activeCount = Object.values(operateurs).filter((o) => o.active).length;
                const isLast = state.active && activeCount === 1;
                return (
                  <div key={op.key} className={`border rounded-xl overflow-hidden transition-all ${state.active ? "border-green-500" : "border-gray-200"}`}>
                    <div onClick={() => !isLast && toggleOperateur(op.key)}
                      className={`flex items-center gap-3 px-4 py-3 bg-gray-50 transition-colors ${isLast ? "cursor-not-allowed" : "cursor-pointer hover:bg-gray-100"}`}>
                      <div className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-all ${state.active ? "bg-green-600 border-green-600" : "border-gray-300 bg-white"}`}>
                        {state.active && (
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                            <path d="M2 5l2.5 2.5L8 3" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                      <div className="w-8 h-6 rounded flex items-center justify-center text-white text-xs font-bold shrink-0"
                        style={{ background: op.color }}>{op.short}</div>
                      <span className="text-sm font-semibold text-gray-800">{op.label}</span>
                      {!state.active && (
                        <span className="ml-auto text-xs text-gray-400 border border-gray-200 rounded-full px-2 py-0.5">optionnel</span>
                      )}
                      {isLast && (
                        <span className="ml-auto text-xs text-orange-500 font-medium">au moins 1 requis</span>
                      )}
                    </div>
                    {state.active && (
                      <div className="px-4 py-3 border-t border-gray-100">
                        <input type="tel" value={state.numero}
                          onChange={(e) => handleNumeroChange(op.key, e.target.value)}
                          placeholder={op.placeholder}
                          className="w-full h-9 border border-gray-300 rounded-md px-3 text-sm outline-none placeholder:text-gray-300 focus:border-green-500 transition-colors" />
                        <p className="text-xs text-gray-400 mt-1">Numéro enregistré sur votre compte {op.label}</p>
                      </div>
                    )}
                  </div>
                );
              })}
              {errors.operateurs && (
                <p className="text-red-500 text-xs mt-1">{errors.operateurs}</p>
              )}
              {shouldShowSingleOperatorWarning && (
                <div className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-xs leading-relaxed text-orange-800">
                  ⚠️ NB : Un seul compte actif peut réduire vos ventes, les clients qui n'ont pas cet opérateur ne pourront pas vous payer. Nous recommandons d'activer au moins 02 opérateurs pour toucher un maximum de clients. Si vous n’avez qu’un seul compte MoMo actuellement ce n’est pas un souci, vous pourrez en ajouter d'autres depuis votre profil après l'inscription.
                </div>
              )}
            </div>

            <Section title="Sécurité" />
            <Input type="password" name="password" label="Mot de passe"
              placeholder="8 caractères minimum"
              value={form.password} onChange={handleChange} onFocus={() => setShowSingleOperatorWarning(true)} error={errors.password} />
            <Input type="password" name="confirmPassword" label="Confirmer le mot de passe"
              placeholder="Répétez votre mot de passe"
              value={form.confirmPassword} onChange={handleChange} onFocus={() => setShowSingleOperatorWarning(true)} error={errors.confirmPassword} />
          </div>

          <button type="submit" disabled={loading}
            className={`w-full h-10 text-white rounded-lg font-bold mt-5 transition-colors ${loading ? "bg-green-400 cursor-not-allowed" : "bg-green-600 hover:bg-green-700"}`}>
            {loading ? "Création en cours..." : "Créer mon compte"}
          </button>
        </form>

        <p className="text-center text-xs text-gray-500 mt-4">
          Déjà un compte ?{" "}
          <span onClick={() => navigate("/login")}
            className="text-green-600 font-semibold cursor-pointer hover:underline">
            Se connecter
          </span>
        </p>
      </div>

      {/* Toast unifié */}
      {toastMessage && (
        <Toast message={toastMessage} type={toastType} onClose={() => setToastMessage("")} />
      )}
    </div>
  );
}

// ─── Composants internes ──────────────────────────────────────────────────────

function Section({ title }: { title: string }) {
  return (
    <div className="col-span-2 text-xs font-bold text-gray-400 uppercase tracking-wider mt-2 pb-1 border-b border-gray-100">
      {title}
    </div>
  );
}

interface InputProps {
  label: string; name: string; value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onFocus?: () => void;
  error?: string; type?: string; full?: boolean; placeholder?: string;
}

function Input({ label, name, value, onChange, onFocus, error, type = "text", full, placeholder }: InputProps) {
  return (
    <div className={`flex flex-col gap-1 ${full ? "col-span-2" : ""}`}>
      <label className="text-xs font-semibold text-gray-700">{label}</label>
      <input type={type} name={name} value={value} onChange={onChange} onFocus={onFocus} placeholder={placeholder}
        className={`h-9 border rounded-md px-3 text-sm outline-none placeholder:text-gray-300 transition-colors ${
          error ? "border-red-400 focus:border-red-500" : "border-gray-300 focus:border-green-500"
        }`} />
      {error && <span className="text-red-500 text-xs">{error}</span>}
    </div>
  );
}

interface SelectProps {
  label: string; name: string; value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  error?: string; options: string[];
}

function Select({ label, name, value, onChange, error, options }: SelectProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-gray-700">{label}</label>
      <select name={name} value={value} onChange={onChange}
        className={`h-9 border rounded-md px-3 text-sm outline-none transition-colors ${
          error ? "border-red-400" : "border-gray-300 focus:border-green-500"
        } ${!value ? "text-gray-300" : "text-gray-900"}`}>
        <option value="" disabled>Choisir...</option>
        {options.map((opt, i) => (
          <option key={i} value={opt} className="text-gray-900">{opt}</option>
        ))}
      </select>
      {error && <span className="text-red-500 text-xs">{error}</span>}
    </div>
  );
}

