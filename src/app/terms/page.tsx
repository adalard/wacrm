import Link from 'next/link';
import { MessageSquare, ChevronLeft } from 'lucide-react';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 font-sans selection:bg-violet-600 selection:text-white pb-16">
      {/* Decorative Blur */}
      <div className="absolute top-0 left-1/3 w-[300px] h-[300px] bg-violet-600/5 rounded-full blur-[80px] pointer-events-none" />

      {/* Header bar */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group text-xs sm:text-sm text-slate-450 hover:text-white transition-colors">
            <ChevronLeft className="size-4 text-slate-500 group-hover:-translate-x-0.5 transition-all" />
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

      {/* Terms Body */}
      <main className="max-w-3xl mx-auto px-6 py-12 md:py-16 space-y-10">
        <div className="space-y-4 border-b border-slate-900 pb-8">
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Terms of Service</h1>
          <p className="text-xs text-slate-550 font-medium">Last updated: May 25, 2026</p>
        </div>

        <section className="space-y-4 text-sm leading-relaxed">
          <h2 className="text-lg font-bold text-white">1. Agreement to Terms</h2>
          <p>
            Welcome to WACRM. These Terms of Service ("Terms") constitute a legally binding agreement made between you, whether personally or on behalf of an entity ("you") and WACRM Inc. ("we," "us," or "our"), concerning your access to and use of our website, software, APIs, and associated services (collectively, the "Services").
          </p>
          <p>
            By accessing or using the Services, you agree that you have read, understood, and agreed to be bound by all of these Terms. If you do not agree with all of these Terms, you are prohibited from using the Services.
          </p>
        </section>

        <section className="space-y-4 text-sm leading-relaxed">
          <h2 className="text-lg font-bold text-white">2. Subscription and Billing</h2>
          <p>
            WACRM offers subscription plans including a Free Starter plan and paid monthly or yearly plans (e.g., Professional and Enterprise tiers) processed securely via Stripe.
          </p>
          <ul className="list-disc pl-6 space-y-2 text-slate-350">
            <li>
              <strong>Billing Cycle:</strong> Subscriptions are billed on a recurring basis in advance of your selected billing interval (monthly or yearly).
            </li>
            <li>
              <strong>Free Trials:</strong> We may offer a 14-day free trial on selected plans. If not canceled before the expiration, your billing credentials will be charged the plan amount.
            </li>
            <li>
              <strong>Cancellation:</strong> You can cancel your subscription at any time through the Billing portal in your Settings. Cancellations take effect at the end of the current billing cycle.
            </li>
            <li>
              <strong>No Refunds:</strong> Paid subscription fees are non-refundable except as required by law.
            </li>
          </ul>
        </section>

        <section className="space-y-4 text-sm leading-relaxed">
          <h2 className="text-lg font-bold text-white">3. WhatsApp Policy and Anti-Ban Guidelines</h2>
          <p>
            You agree to use WACRM in compliance with WhatsApp's official commerce policies and terms. You are solely responsible for all message contents and recipient approvals.
          </p>
          <p>
            While WACRM incorporates anti-ban features such as presence emulators, custom spacing jitter, and broadcast queue delays to reduce risks, **we do not guarantee that your WhatsApp account will not be flagged, suspended, or blocked by Meta**. WACRM is not liable for any losses, suspensions, or bans affecting your WhatsApp accounts resulting from your outreach practices.
          </p>
        </section>

        <section className="space-y-4 text-sm leading-relaxed">
          <h2 className="text-lg font-bold text-white">4. API and Webhook Usage</h2>
          <p>
            Subject to your subscription tier, you may generate Developer API Keys and Webhook Subscriptions. 
          </p>
          <p>
            You agree not to abuse the API routing by sending excessive concurrent requests or attempting to exploit endpoint pipelines. We reserve the right to throttle, suspend, or revoke access tokens for accounts exhibiting abusive API volumes or failing signature authentication rules.
          </p>
        </section>

        <section className="space-y-4 text-sm leading-relaxed">
          <h2 className="text-lg font-bold text-white">5. Limitation of Liability</h2>
          <p>
            In no event shall WACRM Inc., its directors, employees, or partners be liable for any indirect, incidental, special, consequential, or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from your access to or inability to use the Services.
          </p>
        </section>

        <section className="space-y-4 text-sm leading-relaxed border-t border-slate-900 pt-8 text-xs text-slate-500">
          <p>
            If you have any questions or require clarification regarding these Terms of Service, please contact us at <a href="mailto:support@wacrm.app" className="text-violet-400 hover:underline">support@wacrm.app</a>.
          </p>
        </section>
      </main>
    </div>
  );
}
