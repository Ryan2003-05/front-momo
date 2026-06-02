import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function FailedConfirmPage() {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const reference = "TXN-20250430-0042";

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(reference);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-gray-100 font-sans text-gray-900">
      <aside className="flex w-55 shrink-0 flex-col border-r border-blue-900 bg-blue-950 text-white">
        <div className="flex items-center gap-2 border-b border-blue-900 px-4 py-4">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-green-600 text-xs font-semibold text-white">
            P
          </div>
          <span className="text-sm font-semibold text-white">Paycom</span>
        </div>
      </aside>

      <main className="relative flex min-w-0 flex-1 flex-col">
        <div className="flex flex-1 items-start justify-center overflow-y-auto p-6">
          <section className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-8">
            <h1 className="text-center text-2xl font-semibold text-red-700">Paiement echoue</h1>
            <p className="mb-6 text-center text-sm text-gray-500">La transaction n'a pas pu etre completee</p>
            <div className="mb-5 rounded-md border border-red-300 bg-red-50 p-4 text-center">
              <p className="text-3xl font-semibofmfld text-red-700">12 500 FCFA</p>
            </div>
            <div className="mb-5 flex items-center justify-between rounded-md bg-gray-50 px-3 py-2">
              <div>
                <p className="text-[11px] text-gray-500">Reference transaction</p>
                <p className="font-mono text-xs font-semibold text-gray-900">{reference}</p>
              </div>
              <button onClick={handleCopy} className="text-xs font-semibold text-green-600 hover:text-green-700">
                {copied ? "Copie !" : "Copier"}
              </button>
            </div>
            <button
              onClick={() => navigate("/nouveau-paiement")}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-md border border-gray-300 text-sm font-semibold text-gray-800 hover:bg-gray-50"
            >
              ＋ Nouveau paiement
            </button>
          </section>
        </div>
      </main>
    </div>
  );
}
