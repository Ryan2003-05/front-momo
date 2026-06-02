import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import Toast from "../components/Toast";

interface FormData {
  email: string;
  password: string;
}

type FormErrors = Partial<Record<keyof FormData, string>>;

export default function LoginPage() {
  const navigate = useNavigate();

  const [form, setForm]               = useState<FormData>({ email: "", password: "" });
  const [errors, setErrors]           = useState<FormErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]         = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType]     = useState<"success" | "error" | "info">("error");

  function showToast(message: string, type: "success" | "error" | "info" = "error") {
    setToastMessage(message);
    setToastType(type);
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setErrors({});
  };

  const validate = (): FormErrors => {
    const newErrors: FormErrors = {};
    if (!form.email.trim())
      newErrors.email = "L'email est obligatoire";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      newErrors.email = "Format d'email invalide";
    if (!form.password.trim())
      newErrors.password = "Le mot de passe est obligatoire";
    return newErrors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setLoading(true);

    try {
      const response = await api.post("/auth/login", {
        email:        form.email,
        mot_de_passe: form.password,
      });

      const { token, role, user } = response.data;

      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(user));
      localStorage.setItem("role", role);

      const roleLower = String(role ?? "").toLowerCase();
      if (roleLower === "admin") {
        navigate("/admin/dashboard");
      } else {
        navigate("/dashboard");
      }

    } catch (err) {
      const error = err as { response?: { data?: { message?: string } } };
      showToast(
        error.response?.data?.message || "Email ou mot de passe incorrect. Veuillez réessayer.",
        "error"
      );
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
          <h2 className="text-2xl font-bold mb-3 leading-snug">Bon retour parmi nous</h2>
          <p className="text-sm text-blue-300 leading-relaxed mb-6">
            Connectez-vous pour accéder à votre tableau de bord et gérer vos encaissements.
          </p>
          <div className="flex flex-col gap-3">
            {[
              "Tableau de bord en temps réel",
              "Générez vos QR codes instantanément",
              "Historique complet de vos transactions",
            ].map((f, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-blue-200">
                <span className="w-2 h-2 bg-green-500 rounded-full flex shrink-0" />
                {f}
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs text-blue-400">© 2025 Paycom</p>
      </div>

      {/* Panneau droit */}
      <div className="flex-1 bg-white rounded-l-2xl p-10 flex flex-col justify-center">
        <div onClick={() => navigate("/")}
          className="text-xs text-gray-500 mb-8 cursor-pointer flex items-center gap-1 hover:text-gray-700 w-fit">
          ← Retour à l'accueil
        </div>

        <h2 className="text-xl font-bold text-gray-900 mb-1">Se connecter</h2>
        <p className="text-sm text-gray-400 mb-6">Entrez vos identifiants pour accéder à votre espace</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">

          {/* Email */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Email</label>
            <input type="email" name="email" value={form.email} onChange={handleChange}
              placeholder="monmail@gmail.com"
              className={`h-10 border rounded-lg px-3 text-sm outline-none placeholder:text-gray-300 transition-colors ${
                errors.email ? "border-red-400 focus:border-red-500" : "border-gray-300 focus:border-green-500"
              }`} />
            {errors.email && <span className="text-red-500 text-xs">{errors.email}</span>}
          </div>

          {/* Mot de passe */}
          <div className="flex flex-col gap-1">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Mot de passe</label>
              <span className="text-xs text-green-600 cursor-pointer hover:underline">Mot de passe oublié ?</span>
            </div>
            <div className="relative">
              <input type={showPassword ? "text" : "password"} name="password"
                value={form.password} onChange={handleChange}
                placeholder="Votre mot de passe"
                className={`w-full h-10 border rounded-lg px-3 pr-10 text-sm outline-none placeholder:text-gray-300 transition-colors ${
                  errors.password ? "border-red-400 focus:border-red-500" : "border-gray-300 focus:border-green-500"
                }`} />
              <button type="button" onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                {showPassword ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
            {errors.password && <span className="text-red-500 text-xs">{errors.password}</span>}
          </div>

          <button type="submit" disabled={loading}
            className={`w-full h-10 text-white rounded-lg font-bold mt-2 transition-colors ${
              loading ? "bg-green-400 cursor-not-allowed" : "bg-green-600 hover:bg-green-700"
            }`}>
            {loading ? "Connexion en cours..." : "Se connecter"}
          </button>
        </form>

        <p className="text-center text-xs text-gray-500 mt-5">
          Pas encore de compte ?{" "}
          <span onClick={() => navigate("/register")}
            className="text-green-600 font-semibold cursor-pointer hover:underline">
            Créer un compte
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