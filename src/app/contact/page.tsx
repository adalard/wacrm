'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  MessageSquare,
  Mail,
  MapPin,
  Clock,
  Send,
  Loader2,
  CheckCircle2,
  ChevronLeft,
} from 'lucide-react';

export default function ContactPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [topic, setTopic] = useState('support');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !message) return;

    setSubmitting(true);
    // Simulate submission delay
    setTimeout(() => {
      setSubmitting(false);
      setSubmitted(true);
      setName('');
      setEmail('');
      setMessage('');
    }, 1200);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-violet-600 selection:text-white relative overflow-hidden">
      {/* Sleek Decorative Gradients */}
      <div className="absolute top-0 right-1/4 w-[400px] h-[400px] bg-violet-600/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/4 w-[400px] h-[400px] bg-indigo-600/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Header bar */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <ChevronLeft className="size-4 text-slate-400 group-hover:text-white group-hover:-translate-x-0.5 transition-all" />
            <span className="text-slate-400 group-hover:text-white font-medium text-xs sm:text-sm">Back to Home</span>
          </Link>
          <div className="flex items-center gap-2">
            <div className="bg-gradient-to-tr from-violet-600 to-indigo-500 p-1.5 rounded-lg">
              <MessageSquare className="size-4 text-white" />
            </div>
            <span className="font-bold text-white text-sm">WACRM <span className="text-slate-500 font-normal">Support</span></span>
          </div>
          <div className="size-8 opacity-0" />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12 md:py-20 grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
        {/* Support Grid Information: 5 cols */}
        <div className="lg:col-span-5 space-y-8">
          <div className="space-y-4">
            <h1 className="text-3xl font-extrabold text-white tracking-tight leading-tight">
              Get in touch with{' '}
              <span className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
                our team
              </span>
            </h1>
            <p className="text-slate-400 text-sm leading-relaxed">
              Have questions about Stripe subscriptions, billing models, integration capacities, or Evolutionary API setup? Leave us a message and our engineers will reply shortly.
            </p>
          </div>

          <div className="space-y-6 pt-4 border-t border-slate-900">
            {/* Direct Email */}
            <div className="flex items-start gap-4">
              <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl text-violet-400 shrink-0 mt-0.5">
                <Mail className="size-4" />
              </div>
              <div className="space-y-1">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Customer Support</span>
                <a href="mailto:support@wacrm.app" className="text-sm font-semibold text-white hover:text-violet-400 transition-colors">
                  support@wacrm.app
                </a>
              </div>
            </div>

            {/* SLA Info */}
            <div className="flex items-start gap-4">
              <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl text-violet-400 shrink-0 mt-0.5">
                <Clock className="size-4" />
              </div>
              <div className="space-y-1">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Response Guarantee</span>
                <p className="text-sm font-medium text-slate-200">
                  Pro members: under 12 hours.<br />Enterprise: SLA priority under 2 hours.
                </p>
              </div>
            </div>

            {/* HQ Address */}
            <div className="flex items-start gap-4">
              <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl text-violet-400 shrink-0 mt-0.5">
                <MapPin className="size-4" />
              </div>
              <div className="space-y-1">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Global Headquarters</span>
                <p className="text-sm font-medium text-slate-300 leading-relaxed">
                  WACRM Inc. Suite 400, 100 Pine Street<br />San Francisco, CA 94111, USA
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Support Request Form: 7 cols */}
        <div className="lg:col-span-7">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-xl shadow-violet-500/5">
            {submitted ? (
              <div className="text-center py-8 space-y-4 animate-in zoom-in-95 duration-300">
                <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-full text-emerald-400 inline-flex">
                  <CheckCircle2 className="size-8" />
                </div>
                <h3 className="text-xl font-bold text-white">Ticket Submitted Successfully!</h3>
                <p className="text-slate-400 text-sm max-w-sm mx-auto leading-relaxed">
                  Thank you for reaching out. A developer support engineer has been assigned to your ticket and will contact you at your email address shortly.
                </p>
                <button
                  onClick={() => setSubmitted(false)}
                  className="bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 font-semibold px-6 py-2.5 rounded-xl text-xs transition-colors"
                >
                  Submit Another Inquiry
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Your Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. John Doe"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-sm text-white placeholder:text-slate-600 rounded-xl px-4 py-3 focus:outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/60 transition-colors"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Email Address</label>
                  <input
                    type="email"
                    required
                    placeholder="john.doe@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-sm text-white placeholder:text-slate-600 rounded-xl px-4 py-3 focus:outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/60 transition-colors"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Inquiry Topic</label>
                  <select
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-sm text-white rounded-xl px-4 py-3 focus:outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/60 transition-colors"
                  >
                    <option value="support">Technical & Evolution API Support</option>
                    <option value="billing">Stripe Billing & Subscriptions</option>
                    <option value="enterprise">Enterprise Custom Plans</option>
                    <option value="partnership">Partner & Reseller Opportunities</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Message Content</label>
                  <textarea
                    required
                    rows={4}
                    placeholder="Provide detailed context so we can resolve your issue fast..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-sm text-white placeholder:text-slate-600 rounded-xl px-4 py-3 focus:outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/60 transition-colors resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-violet-600 hover:bg-violet-700 disabled:bg-violet-700 text-white font-semibold py-3.5 rounded-xl shadow-lg shadow-violet-600/10 inline-flex items-center justify-center gap-2 transition-all active:scale-95 duration-75 text-sm"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Dispatching Ticket...
                    </>
                  ) : (
                    <>
                      <Send className="size-4" />
                      Send Message
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </main>

      {/* Footer bar */}
      <footer className="border-t border-slate-900 bg-slate-950 py-8 px-6 text-center text-[10px] text-slate-600">
        &copy; {new Date().getFullYear()} WACRM Inc. All support tickets are covered under privacy agreements.
      </footer>
    </div>
  );
}
