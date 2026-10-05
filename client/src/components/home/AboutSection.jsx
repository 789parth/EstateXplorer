import React from 'react';
import { ShieldCheck, Building2, Sparkles, Users, Award, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';

const AboutSection = () => {
  const pillars = [
    {
      icon: ShieldCheck,
      title: '100% RERA Verified',
      desc: 'Every listed development is cross-verified against State RERA registries and government land records.',
      bg: 'bg-blue-50',
      color: 'text-blue-700',
    },
    {
      icon: Building2,
      title: 'Direct Developer Access',
      desc: 'Connect directly with builder sales teams for transparent pricing, payment plans, and zero intermediary fees.',
      bg: 'bg-emerald-50',
      color: 'text-emerald-700',
    },
    {
      icon: Sparkles,
      title: 'Immersive 3D Digital Tours',
      desc: 'Explore floor plans, spatial walkthroughs, and unit configurations online before booking site visits.',
      bg: 'bg-indigo-50',
      color: 'text-indigo-700',
    },
    {
      icon: Users,
      title: 'Multi-Role Portals',
      desc: 'Tailored workflow dashboards designed specifically for Buyers, Builders, Certified Brokers, and Owners.',
      bg: 'bg-amber-50',
      color: 'text-amber-700',
    },
  ];

  return (
    <section className="py-20 px-4 md:px-8 max-w-container mx-auto" id="about">
      {/* Section Header - Strictly matching Main Page Header Standard */}
      <div className="text-center mb-12">
        <div className="text-[0.72rem] font-semibold tracking-widest uppercase text-blue-mid mb-1.5">
          About EstateXplorer
        </div>
        <h2 className="font-display text-[clamp(1.6rem,3vw,2.1rem)] font-semibold text-navy tracking-tight">
          Empowering India’s Property Seekers With Complete Transparency
        </h2>
        <p className="text-muted text-xs md:text-sm max-w-2xl mx-auto mt-2">
          Built from the ground up on verified legal documentation, 100% RERA compliance, and direct developer pricing with zero brokerage markups.
        </p>
      </div>

      {/* 4 Feature Pillars Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12 text-left">
        {pillars.map((item, idx) => {
          const Icon = item.icon;
          return (
            <div
              key={idx}
              className="p-6 rounded-2xl bg-white border border-border transition-all duration-300 hover:-translate-y-1 hover:shadow-md hover:border-navy/15 flex flex-col justify-between"
            >
              <div>
                <div className={`w-12 h-12 rounded-xl ${item.bg} ${item.color} flex items-center justify-center mb-4`}>
                  <Icon size={22} strokeWidth={2} />
                </div>
                <h4 className="text-base font-semibold text-navy mb-2">{item.title}</h4>
                <p className="text-xs text-muted leading-relaxed">{item.desc}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Stats Counter & CTA Box */}
      <div className="p-8 md:p-10 rounded-2xl bg-[#eef1f6] border border-border grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
        <div>
          <div className="font-display text-2xl md:text-3xl font-bold text-navy mb-1">100%</div>
          <div className="text-[0.75rem] text-muted font-medium">RERA Verified Projects</div>
        </div>
        <div>
          <div className="font-display text-2xl md:text-3xl font-bold text-navy mb-1">25,000+</div>
          <div className="text-[0.75rem] text-muted font-medium">Verified Properties Listed</div>
        </div>
        <div>
          <div className="font-display text-2xl md:text-3xl font-bold text-navy mb-1">1,200+</div>
          <div className="text-[0.75rem] text-muted font-medium">Certified Developers & Agents</div>
        </div>
        <div>
          <div className="font-display text-2xl md:text-3xl font-bold text-navy mb-1">4.9 / 5</div>
          <div className="text-[0.75rem] text-muted font-medium">Customer Trust Score</div>
        </div>
      </div>

      {/* Button Row */}
      <div className="mt-8 flex justify-center items-center gap-4 flex-wrap">
        <Link
          to="/about"
          className="px-6 py-3 rounded-lg bg-navy text-white text-xs font-semibold hover:bg-navy-mid transition-all shadow-sm"
        >
          Read Full Company Overview →
        </Link>
        <Link
          to="/listings"
          className="px-6 py-3 rounded-lg border border-border bg-white text-navy text-xs font-semibold hover:bg-slate-50 transition-all"
        >
          Explore Properties
        </Link>
      </div>
    </section>
  );
};

export default React.memo(AboutSection);

