import Link from 'next/link';
import { MessageSquare, ChevronLeft } from 'lucide-react';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 font-sans selection:bg-violet-600 selection:text-white pb-16">
      {/* Decorative Blur */}
      <div className="absolute top-0 right-1/3 w-[300px] h-[300px] bg-indigo-600/5 rounded-full blur-[80px] pointer-events-none" />

      {/* Header bar */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group text-xs sm:text-sm text-slate-455 hover:text-white transition-colors">
            <ChevronLeft className="size-4 text-slate-550 group-hover:-translate-x-0.5 transition-all" />
            <span>Back to Home</span>
          </Link>
          <div className="flex items-center gap-2">
            <div className="bg-slate-900 border border-slate-800 p-1.5 rounded-lg">
              <MessageSquare className="size-4 text-violet-400" />
            </div>
            <span className="font-bold text-white text-sm">WACRM <span className="text-slate-500 font-normal">Legal</span></span>
          </div>
        </div>
      </header>

      {/* Privacy Body */}
      <main className="max-w-3xl mx-auto px-6 py-12 md:py-16 space-y-10">
        <div className="space-y-4 border-b border-slate-900 pb-8">
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Privacy Policy</h1>
          <p className="text-xs text-slate-550 font-medium">Last updated: May 25, 2026</p>
        </div>

        <section className="space-y-4 text-sm leading-relaxed">
          <h2 className="text-lg font-bold text-white">1. Introduction</h2>
          <p>
            At WACRM Inc., we respect your privacy and are committed to protecting your personal data. This Privacy Policy outlines our guidelines regarding the collection, storage, encryption, and usage of information when you use our website, APIs, and multi-tenant WACRM software.
          </p>
        </section>

        <section className="space-y-4 text-sm leading-relaxed">
          <h2 className="text-lg font-bold text-white">2. Information We Collect</h2>
          <ul className="list-disc pl-6 space-y-2 text-slate-350">
            <li>
              <strong>Account Data:</strong> When you register for WACRM, we collect your name, email address, password hash, and billing configuration variables.
            </li>
            <li>
              <strong>Integration Keys:</strong> Official WhatsApp Business API tokens and Evolution API instance parameters are securely stored. Sensitive access tokens are cryptographically encrypted at rest before being saved in our Supabase instance.
            </li>
            <li>
              <strong>Customer Conversations:</strong> We cache contact details, tag relationships, and chat histories (messages, media URLs, delivery statuses) to provide our real-time omnichannel inbox interface.
            </li>
          </ul>
        </section>

        <section className="space-y-4 text-sm leading-relaxed">
          <h2 className="text-lg font-bold text-white">3. Data Security and Encryption</h2>
          <p>
            We implement state-of-the-art security practices to protect your tenant information:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-slate-350">
            <li>
              <strong>API Access Keys:</strong> Developer REST keys are generated as secure 256-bit strings shown *only once* to the user. We store exclusively the secure **SHA-256 hash** of the key.
            </li>
            <li>
              <strong>Row Level Security (RLS):</strong> The Supabase database implements strict Postgres policies guaranteeing that tenants can only view and manage records matching their own authenticated `user_id`.
            </li>
            <li>
              <strong>Outbound Webhooks:</strong> Webhook payloads are signed using custom per-subscription secret signatures (`HMAC-SHA256`) to ensure target integrity.
            </li>
          </ul>
        </section>

        <section className="space-y-4 text-sm leading-relaxed">
          <h2 className="text-lg font-bold text-white">4. Billing and Payment Processing</h2>
          <p>
            Subscription payments are processed securely by our payment processor, **Stripe**. WACRM Inc. does not capture or store your raw credit card numbers or bank credentials. All transactions are securely channeled via Stripe Hosted Checkout, covered by PCI-DSS compliance regulations.
          </p>
        </section>

        <section className="space-y-4 text-sm leading-relaxed border-t border-slate-900 pt-8 text-xs text-slate-500">
          <p>
            If you have any questions, concerns, or requests regarding this Privacy Policy or your data rights, please contact us at <a href="mailto:support@wacrm.app" className="text-violet-400 hover:underline">support@wacrm.app</a>.
          </p>
        </section>
      </main>
    </div>
  );
}
