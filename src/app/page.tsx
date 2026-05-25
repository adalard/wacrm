'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  MessageSquare,
  Zap,
  Key,
  ShieldCheck,
  Check,
  ChevronDown,
  Globe,
  Users,
  Menu,
  X,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

export default function LandingPage() {
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'yearly'>('monthly');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const faqs = [
    {
      q: 'Do I need a commercial WhatsApp Business API account to use WACRM?',
      a: 'No! WACRM features a polymorphic messaging factory. You can connect via official Meta Cloud API templates, or choose the Evolution API to securely link your standard WhatsApp Web session using an automated QR code in under 60 seconds.',
    },
    {
      q: 'How does WACRM prevent my WhatsApp number from being blocked?',
      a: 'WACRM embeds advanced presence emulation and spacing jitter. Before dispatching any text message, WACRM emulates a "composing" indicator for 1,200ms. In addition, broadcasts are distributed with a base spacing delay of 3,000ms and a random ±750ms jitter to replicate organic human conversations.',
    },
    {
      q: 'Can I integrate WACRM into my existing internal CRM or ERP systems?',
      a: 'Absolutely! Our developer platform provides secure REST APIs and signed HTTP webhook subscriptions. You can trigger outbound dispatches via standard cURL or link inbound messages and status flips directly to services like Zapier or Node-red.',
    },
    {
      q: 'Can I change or cancel my plan at any time?',
      a: 'Yes, of course! You can easily upgrade, downgrade, or cancel your active subscription plan at any time directly through your self-service Stripe Customer Portal in the Billing panel.',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-violet-600 selection:text-white overflow-x-hidden">
      {/* Sleek Decorative Gradients */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-violet-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-1/3 right-1/4 w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-[150px] pointer-events-none" />

      {/* Header / Navbar */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-slate-950/80 border-b border-slate-900 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-gradient-to-tr from-violet-600 to-indigo-500 p-2 rounded-lg shadow-md shadow-violet-600/20">
              <MessageSquare className="size-5 text-white" />
            </div>
            <span className="text-xl font-bold text-white tracking-tight">
              WA<span className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">CRM</span>
            </span>
          </div>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-300">
            <a href="#features" className="hover:text-violet-400 transition-colors">Features</a>
            <a href="#solutions" className="hover:text-violet-400 transition-colors">Solutions</a>
            <a href="#pricing" className="hover:text-violet-400 transition-colors">Pricing</a>
            <a href="#faqs" className="hover:text-violet-400 transition-colors">FAQs</a>
            <Link href="/contact" className="hover:text-violet-400 transition-colors">Support</Link>
          </nav>

          {/* Header CTAs */}
          <div className="hidden md:flex items-center gap-4">
            <Link
              href="/login"
              className="text-sm font-semibold text-slate-300 hover:text-white px-4 py-2 transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold px-4 py-2 rounded-lg shadow-md shadow-violet-600/20 active:scale-95 transition-transform duration-75"
            >
              Start Free Trial
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden text-slate-400 hover:text-white p-1"
          >
            {mobileMenuOpen ? <X className="size-6" /> : <Menu className="size-6" />}
          </button>
        </div>

        {/* Mobile Navigation Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden border-b border-slate-900 bg-slate-950 px-6 py-6 space-y-4 animate-in slide-in-from-top duration-200">
            <nav className="flex flex-col gap-4 text-base font-medium text-slate-300">
              <a href="#features" onClick={() => setMobileMenuOpen(false)} className="hover:text-white transition-colors">Features</a>
              <a href="#solutions" onClick={() => setMobileMenuOpen(false)} className="hover:text-white transition-colors">Solutions</a>
              <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="hover:text-white transition-colors">Pricing</a>
              <a href="#faqs" onClick={() => setMobileMenuOpen(false)} className="hover:text-white transition-colors">FAQs</a>
              <Link href="/contact" onClick={() => setMobileMenuOpen(false)} className="hover:text-white transition-colors">Support</Link>
            </nav>
            <hr className="border-slate-900" />
            <div className="flex flex-col gap-3 pt-2">
              <Link
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full text-center text-slate-300 hover:text-white font-semibold py-2 rounded-lg border border-slate-800 transition-colors"
              >
                Sign In
              </Link>
              <Link
                href="/signup"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full text-center bg-violet-600 hover:bg-violet-700 text-white font-semibold py-2 rounded-lg"
              >
                Start Free Trial
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* Hero Section */}
      <section className="relative pt-12 pb-24 md:pt-20 md:pb-32 px-6">
        <div className="max-w-6xl mx-auto text-center space-y-6">
          {/* Badge */}
          <div className="inline-flex items-center gap-1.5 bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs font-semibold px-3 py-1.5 rounded-full shadow-lg shadow-violet-500/5">
            <Sparkles className="size-3.5" />
            <span>Introducing WACRM v2.0 Platform</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold text-white tracking-tight leading-[1.1] max-w-4xl mx-auto">
            The Intelligent WhatsApp CRM for{' '}
            <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-indigo-400 bg-clip-text text-transparent">
              High-Velocity Teams
            </span>
          </h1>

          <p className="text-slate-400 text-lg sm:text-xl max-w-2xl mx-auto leading-relaxed">
            Consolidate your customer conversations, emulate natural human typing, automate broadcasts, and expose secure Developer REST APIs and webhooks out-of-the-box.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link
              href="/signup"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-semibold px-8 py-4 rounded-xl shadow-xl shadow-violet-600/25 transition-all duration-150 active:scale-95 group"
            >
              Get Started for Free
              <ArrowRight className="size-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <a
              href="#pricing"
              className="w-full sm:w-auto inline-flex items-center justify-center bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 font-semibold px-8 py-4 rounded-xl transition-all active:scale-95"
            >
              View Pricing plans
            </a>
          </div>

          {/* Browser UI Mockup Preview */}
          <div className="pt-16 max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="relative bg-slate-900 border border-slate-800 rounded-2xl p-2 shadow-2xl shadow-violet-500/5 overflow-hidden">
              {/* Glass Header */}
              <div className="flex items-center justify-between px-4 py-2 bg-slate-950/40 rounded-t-xl border-b border-slate-800/60 mb-2">
                <div className="flex gap-1.5">
                  <div className="size-3 rounded-full bg-red-500/70" />
                  <div className="size-3 rounded-full bg-yellow-500/70" />
                  <div className="size-3 rounded-full bg-green-500/70" />
                </div>
                <div className="bg-slate-950 border border-slate-800/80 text-[10px] text-slate-500 font-mono px-6 py-0.5 rounded">
                  wacrm.app/dashboard/inbox
                </div>
                <div className="size-3 opacity-0" />
              </div>

              {/* CRM App Graphic */}
              <div className="bg-slate-950 rounded-b-xl aspect-[16/9] w-full flex overflow-hidden text-left relative">
                {/* Left navigation sidebar */}
                <div className="w-16 md:w-48 bg-slate-900 border-r border-slate-800 p-2 md:p-4 flex flex-col justify-between shrink-0">
                  <div className="space-y-6">
                    <div className="flex items-center gap-2 px-2">
                      <div className="size-6 bg-violet-600 rounded flex items-center justify-center font-bold text-white text-xs">W</div>
                      <span className="hidden md:inline font-bold text-white text-sm">WACRM Dashboard</span>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-3 bg-violet-950/20 text-violet-400 font-semibold p-2 rounded-lg text-xs">
                        <MessageSquare className="size-4 shrink-0" />
                        <span className="hidden md:inline">Conversations</span>
                      </div>
                      <div className="flex items-center gap-3 text-slate-400 p-2 rounded-lg text-xs hover:bg-slate-800/40">
                        <Users className="size-4 shrink-0" />
                        <span className="hidden md:inline">Contacts</span>
                      </div>
                      <div className="flex items-center gap-3 text-slate-400 p-2 rounded-lg text-xs hover:bg-slate-800/40">
                        <Zap className="size-4 shrink-0" />
                        <span className="hidden md:inline">Automations</span>
                      </div>
                      <div className="flex items-center gap-3 text-slate-400 p-2 rounded-lg text-xs hover:bg-slate-800/40">
                        <Key className="size-4 shrink-0" />
                        <span className="hidden md:inline">Developer API</span>
                      </div>
                    </div>
                  </div>
                  <div className="hidden md:block bg-slate-800/40 border border-slate-700/30 rounded-lg p-3 text-[10px] space-y-1">
                    <span className="font-semibold text-slate-300 block">Current Status</span>
                    <span className="text-emerald-400 flex items-center gap-1.5 font-medium">
                      <span className="size-2 bg-emerald-500 rounded-full animate-pulse" />
                      Evolution API Connected
                    </span>
                  </div>
                </div>

                {/* Main panel - Inbox simulation */}
                <div className="flex-1 flex overflow-hidden">
                  {/* Conversations List */}
                  <div className="w-48 md:w-64 border-r border-slate-800 bg-slate-950 overflow-y-hidden p-3 shrink-0 space-y-2 hidden sm:block">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block px-2">Active Chats</span>
                    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-white">Sarah Jenkins</span>
                        <span className="text-[9px] text-slate-500">10:42 AM</span>
                      </div>
                      <p className="text-[10px] text-slate-400 truncate">Is the webhook setup documented?</p>
                    </div>
                    <div className="bg-slate-950 border border-transparent rounded-xl p-3 space-y-1.5 hover:bg-slate-900/20">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-300">David Miller</span>
                        <span className="text-[9px] text-slate-500">Yesterday</span>
                      </div>
                      <p className="text-[10px] text-slate-500 truncate">Perfect! Let me test the REST endpoint.</p>
                    </div>
                  </div>

                  {/* Active chat window */}
                  <div className="flex-1 flex flex-col bg-slate-950/60 justify-between">
                    <div className="p-4 border-b border-slate-800/60 flex items-center justify-between bg-slate-950/80">
                      <div className="space-y-0.5">
                        <h4 className="text-xs font-bold text-white">Sarah Jenkins</h4>
                        <span className="text-[9px] text-slate-400">Integration Lead at AlphaTech</span>
                      </div>
                      <span className="bg-violet-950/50 text-violet-400 text-[10px] border border-violet-800/20 px-2 py-0.5 rounded-full font-semibold">
                        Prospect
                      </span>
                    </div>

                    {/* Chat Bubbles */}
                    <div className="flex-1 p-4 space-y-4 overflow-y-hidden text-[11px] flex flex-col justify-end">
                      <div className="max-w-[75%] bg-slate-900 border border-slate-800 rounded-2xl rounded-tl-none p-3 space-y-1 self-start">
                        <p className="text-slate-200">Hi, I'm testing WACRM outbound webhooks to automate my Node-red alerts. How fast are they dispatched?</p>
                        <span className="text-[8px] text-slate-500 block text-right">10:41 AM</span>
                      </div>
                      <div className="max-w-[75%] bg-violet-600 text-white rounded-2xl rounded-tr-none p-3 space-y-1 self-end">
                        <p>Hey Sarah! Outbound webhook dispatches run asynchronously on fire-and-forget background threads, executing in under 20ms with HMAC-SHA256 headers for absolute security!</p>
                        <span className="text-[8px] text-violet-200 block text-right">10:42 AM</span>
                      </div>
                      <div className="self-center bg-slate-900/60 border border-slate-800 text-slate-500 px-3 py-1 rounded-full text-[9px] italic flex items-center gap-1.5 font-medium">
                        <span className="size-1.5 bg-violet-400 rounded-full animate-bounce" />
                        WACRM Emulating Typing Delay (1200ms)...
                      </div>
                    </div>

                    {/* Chat Input */}
                    <div className="p-3 bg-slate-950 border-t border-slate-800/60 flex gap-2">
                      <input
                        type="text"
                        readOnly
                        placeholder="Type a message or trigger templates..."
                        className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs focus:outline-none text-slate-300 placeholder:text-slate-500"
                      />
                      <button className="bg-violet-600 p-2 rounded-lg text-white font-semibold shadow hover:bg-violet-700 shrink-0">
                        <Zap className="size-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 bg-slate-950 px-6 border-t border-slate-900">
        <div className="max-w-6xl mx-auto space-y-16">
          <div className="text-center space-y-4">
            <h2 className="text-xs font-semibold text-violet-400 uppercase tracking-widest">Advanced Features</h2>
            <h3 className="text-3xl sm:text-4xl font-extrabold text-white">
              Built for High-Growth WhatsApp Channels
            </h3>
            <p className="text-slate-400 max-w-2xl mx-auto text-base leading-relaxed">
              Experience WACRM's elite core integrations. Scale your business CRM without risking WhatsApp number restriction or blockages.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-slate-900/40 border border-slate-900 rounded-2xl p-6 hover:border-violet-500/20 hover:bg-slate-900/60 transition-all duration-300 group">
              <div className="bg-violet-500/10 p-3 rounded-xl inline-flex text-violet-400 group-hover:scale-110 transition-transform duration-200 mb-6 border border-violet-500/10">
                <Users className="size-6" />
              </div>
              <h4 className="text-lg font-bold text-white mb-2">Omnichannel Contact Center</h4>
              <p className="text-slate-400 text-sm leading-relaxed">
                Organize all inbound WhatsApp sessions under a single elegant multi-tenant workspace. Filter by custom labels, associate tags, and assign dedicated agents.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-slate-900/40 border border-slate-900 rounded-2xl p-6 hover:border-violet-500/20 hover:bg-slate-900/60 transition-all duration-300 group">
              <div className="bg-violet-500/10 p-3 rounded-xl inline-flex text-violet-400 group-hover:scale-110 transition-transform duration-200 mb-6 border border-violet-500/10">
                <ShieldCheck className="size-6" />
              </div>
              <h4 className="text-lg font-bold text-white mb-2">Anti-Ban Spacing Engine</h4>
              <p className="text-slate-400 text-sm leading-relaxed">
                Replicate human communication behaviors automatically. Emulates visual active typing statuses and dispatches high-volume broadcasts with smart jitter spacing.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-slate-900/40 border border-slate-900 rounded-2xl p-6 hover:border-violet-500/20 hover:bg-slate-900/60 transition-all duration-300 group">
              <div className="bg-violet-500/10 p-3 rounded-xl inline-flex text-violet-400 group-hover:scale-110 transition-transform duration-200 mb-6 border border-violet-500/10">
                <Globe className="size-6" />
              </div>
              <h4 className="text-lg font-bold text-white mb-2">Polymorphic Dispatch</h4>
              <p className="text-slate-400 text-sm leading-relaxed">
                Route dispatches seamlessly. WACRM wraps Meta Cloud API templates and standard WhatsApp Web QR connect solutions under a unified Client Factory.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="bg-slate-900/40 border border-slate-900 rounded-2xl p-6 hover:border-violet-500/20 hover:bg-slate-900/60 transition-all duration-300 group">
              <div className="bg-violet-500/10 p-3 rounded-xl inline-flex text-violet-400 group-hover:scale-110 transition-transform duration-200 mb-6 border border-violet-500/10">
                <Key className="size-6" />
              </div>
              <h4 className="text-lg font-bold text-white mb-2">Developer REST API</h4>
              <p className="text-slate-400 text-sm leading-relaxed">
                Generate secure bearer tokens (`wac_sec_...`) hashed with SHA-256 in the database. Integrate easily with curl, Python, or custom ERP systems.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="bg-slate-900/40 border border-slate-900 rounded-2xl p-6 hover:border-violet-500/20 hover:bg-slate-900/60 transition-all duration-300 group">
              <div className="bg-violet-500/10 p-3 rounded-xl inline-flex text-violet-400 group-hover:scale-110 transition-transform duration-200 mb-6 border border-violet-500/10">
                <Zap className="size-6" />
              </div>
              <h4 className="text-lg font-bold text-white mb-2">Outbound Signed Webhooks</h4>
              <p className="text-slate-400 text-sm leading-relaxed">
                Capture events in real-time. Receives messages and status flipping receipts in external apps, validated via custom HMAC-SHA256 secret signing.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="bg-slate-900/40 border border-slate-900 rounded-2xl p-6 hover:border-violet-500/20 hover:bg-slate-900/60 transition-all duration-300 group">
              <div className="bg-violet-500/10 p-3 rounded-xl inline-flex text-violet-400 group-hover:scale-110 transition-transform duration-200 mb-6 border border-violet-500/10">
                <MessageSquare className="size-6" />
              </div>
              <h4 className="text-lg font-bold text-white mb-2">Dynamic Template Manager</h4>
              <p className="text-slate-400 text-sm leading-relaxed">
                Build variable-interpolated WhatsApp template campaigns with interactive preview interfaces directly integrated with your database schemas.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Billing & Pricing Section */}
      <section id="pricing" className="py-24 bg-slate-950 px-6 border-t border-slate-900 relative">
        <div className="max-w-6xl mx-auto space-y-16">
          <div className="text-center space-y-4">
            <h2 className="text-xs font-semibold text-violet-400 uppercase tracking-widest">SaaS Plans & Billing</h2>
            <h3 className="text-3xl sm:text-4xl font-extrabold text-white">Transparent, Value-Packed Pricing</h3>
            <p className="text-slate-400 max-w-xl mx-auto text-base">
              Choose the WACRM plan tier that perfectly aligns with your team scale. Switch or cancel anytime.
            </p>

            {/* Monthly / Yearly Toggle */}
            <div className="flex items-center justify-center gap-3 pt-6">
              <span className={`text-sm font-semibold transition-colors ${billingInterval === 'monthly' ? 'text-white' : 'text-slate-500'}`}>
                Monthly Billing
              </span>
              <button
                onClick={() => setBillingInterval(billingInterval === 'monthly' ? 'yearly' : 'monthly')}
                className="relative bg-slate-900 border border-slate-800 rounded-full h-8 w-14 p-1 flex items-center transition-colors focus:outline-none"
              >
                <div
                  className={`bg-violet-500 size-6 rounded-full shadow transition-transform duration-200 ${
                    billingInterval === 'yearly' ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
              <span className={`text-sm font-semibold transition-colors flex items-center gap-1.5 ${billingInterval === 'yearly' ? 'text-white' : 'text-slate-500'}`}>
                Yearly Billing
                <span className="bg-emerald-500/10 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded border border-emerald-500/25">
                  Save 20%
                </span>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch max-w-5xl mx-auto">
            {/* Card 1: Free */}
            <div className="bg-slate-900/30 border border-slate-900 rounded-3xl p-8 flex flex-col justify-between hover:border-slate-800 transition-colors">
              <div className="space-y-6">
                <div>
                  <h4 className="text-base font-bold text-slate-400">Free Starter</h4>
                  <p className="text-xs text-slate-500 mt-1">Perfect for solo operators launching channels.</p>
                </div>
                <div className="flex items-baseline text-white">
                  <span className="text-4xl font-extrabold">$0</span>
                  <span className="text-slate-500 text-xs ml-1">/ forever</span>
                </div>
                <hr className="border-slate-800/80" />
                <ul className="space-y-3 text-xs text-slate-300">
                  <li className="flex items-center gap-2">
                    <Check className="size-4 text-violet-400 shrink-0" />
                    <span>Up to 100 Contacts</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="size-4 text-violet-400 shrink-0" />
                    <span>1 Active WhatsApp Connection</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="size-4 text-violet-400 shrink-0" />
                    <span>Max 50 Broadcasts / Month</span>
                  </li>
                  <li className="flex items-center gap-2 text-slate-500 line-through">
                    <span>Developer REST API Access</span>
                  </li>
                  <li className="flex items-center gap-2 text-slate-500 line-through">
                    <span>Outbound HMAC Webhooks</span>
                  </li>
                </ul>
              </div>
              <Link
                href="/signup"
                className="w-full text-center bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 font-semibold py-3 rounded-xl mt-8 text-sm transition-all"
              >
                Sign Up Free
              </Link>
            </div>

            {/* Card 2: Pro */}
            <div className="bg-slate-900/60 border-2 border-violet-500 rounded-3xl p-8 flex flex-col justify-between relative shadow-xl shadow-violet-500/5">
              <div className="absolute top-0 right-1/2 translate-x-1/2 -translate-y-1/2 bg-violet-600 text-white text-[10px] font-bold uppercase tracking-wider px-3.5 py-1 rounded-full shadow">
                Most Popular
              </div>
              <div className="space-y-6">
                <div>
                  <h4 className="text-base font-bold text-white">Professional</h4>
                  <p className="text-xs text-slate-400 mt-1">Ideal for expanding commercial teams.</p>
                </div>
                <div className="flex items-baseline text-white">
                  <span className="text-4xl font-extrabold">
                    {billingInterval === 'monthly' ? '$29' : '$23'}
                  </span>
                  <span className="text-slate-400 text-xs ml-1">/ month</span>
                </div>
                <hr className="border-slate-850" />
                <ul className="space-y-3 text-xs text-slate-200">
                  <li className="flex items-center gap-2">
                    <Check className="size-4 text-violet-400 shrink-0" />
                    <span className="font-semibold text-white">Unlimited Contacts</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="size-4 text-violet-400 shrink-0" />
                    <span>Unlimited Connections</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="size-4 text-violet-400 shrink-0" />
                    <span>Unlimited Broadcast dispatches</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="size-4 text-violet-400 shrink-0" />
                    <span className="font-semibold text-white">Developer REST API Keys</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="size-4 text-violet-400 shrink-0" />
                    <span>Signed Webhook Subscriptions</span>
                  </li>
                </ul>
              </div>
              <Link
                href="/signup?plan=pro"
                className="w-full text-center bg-violet-600 hover:bg-violet-700 text-white font-semibold py-3 rounded-xl mt-8 text-sm shadow-md shadow-violet-600/10 transition-all active:scale-95 duration-75"
              >
                Start 14-Day Free Trial
              </Link>
            </div>

            {/* Card 3: Enterprise */}
            <div className="bg-slate-900/30 border border-slate-900 rounded-3xl p-8 flex flex-col justify-between hover:border-slate-800 transition-colors">
              <div className="space-y-6">
                <div>
                  <h4 className="text-base font-bold text-slate-400">Enterprise</h4>
                  <p className="text-xs text-slate-500 mt-1">For corporate scales & massive volumes.</p>
                </div>
                <div className="flex items-baseline text-white">
                  <span className="text-4xl font-extrabold">Custom</span>
                  <span className="text-slate-500 text-xs ml-1">/ bespoke</span>
                </div>
                <hr className="border-slate-800/80" />
                <ul className="space-y-3 text-xs text-slate-300">
                  <li className="flex items-center gap-2">
                    <Check className="size-4 text-violet-400 shrink-0" />
                    <span>Bespoke Contact Limits</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="size-4 text-violet-400 shrink-0" />
                    <span>High-Frequency Dedicated Node</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="size-4 text-violet-400 shrink-0" />
                    <span>Priority Support SLA (under 2 hrs)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="size-4 text-violet-400 shrink-0" />
                    <span>Custom Webhook signed events</span>
                  </li>
                </ul>
              </div>
              <Link
                href="/contact?topic=enterprise"
                className="w-full text-center bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 font-semibold py-3 rounded-xl mt-8 text-sm transition-all"
              >
                Contact Sales
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* FAQs Section */}
      <section id="faqs" className="py-24 bg-slate-950 px-6 border-t border-slate-900">
        <div className="max-w-4xl mx-auto space-y-12">
          <div className="text-center space-y-4">
            <h2 className="text-xs font-semibold text-violet-400 uppercase tracking-widest">Onboarding Help</h2>
            <h3 className="text-3xl sm:text-4xl font-extrabold text-white">Frequently Asked Questions</h3>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, idx) => (
              <div
                key={idx}
                className="bg-slate-900/40 border border-slate-900 rounded-2xl overflow-hidden transition-all"
              >
                <button
                  onClick={() => toggleFaq(idx)}
                  className="w-full flex items-center justify-between p-6 text-left hover:bg-slate-900/60 transition-colors"
                >
                  <span className="font-semibold text-white text-sm sm:text-base">{faq.q}</span>
                  <ChevronDown
                    className={`size-5 text-slate-400 shrink-0 transition-transform duration-300 ${
                      openFaq === idx ? 'rotate-180 text-violet-400' : ''
                    }`}
                  />
                </button>
                <div
                  className={`px-6 transition-all duration-300 ease-in-out ${
                    openFaq === idx ? 'pb-6 max-h-40 opacity-100' : 'max-h-0 opacity-0 pointer-events-none'
                  }`}
                >
                  <p className="text-slate-400 text-xs sm:text-sm leading-relaxed border-t border-slate-800/40 pt-4">
                    {faq.a}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-t from-slate-950 to-slate-900 border-t border-slate-900 text-center px-6 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-violet-600/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="max-w-3xl mx-auto space-y-6 relative">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white">
            Ready to Revolutionize Your WhatsApp Marketing?
          </h2>
          <p className="text-slate-400 text-sm sm:text-base max-w-xl mx-auto leading-relaxed">
            Join high-performance teams already accelerating conversions using WACRM polymorphic Inbox. Setup takes under 2 minutes.
          </p>
          <div className="pt-4">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white font-semibold px-8 py-4 rounded-xl shadow-lg shadow-violet-600/20 active:scale-95 transition-transform"
            >
              Get Started for Free
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 border-t border-slate-900 py-12 px-6 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="bg-slate-900 p-1.5 rounded-md border border-slate-800">
              <MessageSquare className="size-4 text-violet-400" />
            </div>
            <span className="font-bold text-white">WA<span className="text-slate-400">CRM</span></span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 md:gap-8 font-medium">
            <Link href="/terms" className="hover:text-slate-300 transition-colors">Terms of Service</Link>
            <Link href="/privacy" className="hover:text-slate-300 transition-colors">Privacy Policy</Link>
            <Link href="/contact" className="hover:text-slate-300 transition-colors">Contact Support</Link>
          </div>

          <div>
            &copy; {new Date().getFullYear()} WACRM Inc. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
