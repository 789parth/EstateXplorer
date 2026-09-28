import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Award, Users, CheckCircle2, Building2, Sparkles, Target, Compass, HeartHandshake, Zap, Globe, Check } from 'lucide-react';
import Navbar from '../components/layout/Navbar';
import Footer from '../components/layout/Footer';
import AboutSection from '../components/home/AboutSection';
import TrustBar from '../components/home/TrustBar';
import WhySection from '../components/home/WhySection';

const AboutUs = () => {
  const milestones = [
    {
      year: '2023',
      title: 'Platform Foundation',
      desc: 'Launched EstateXplorer with a mission to verify every real estate listing with state RERA registries and eliminate fake listings.',
    },
    {
      year: '2024',
      title: 'Builder Direct Network',
      desc: 'Partnered with over 500 top developers across Gujarat and Maharashtra to offer direct developer pricing with 0% brokerage for buyers.',
    },
    {
      year: '2025',
      title: '3D Virtual Tours & Multi-Role Suite',
      desc: 'Introduced immersive digital 3D model walkthroughs and dedicated workflow portals for Buyers, Builders, Certified Brokers, and Owners.',
    },
    {
      year: '2026',
      title: 'Pan-India Expansion',
      desc: 'Crossed 25,000+ verified properties and 1,200+ partner developers across 18 major metropolitan and growing urban cities.',
    },
  ];

  const team = [
    {
      name: 'Parth Aadhakkar',
      role: 'Founder & CEO',
      bio: 'PropTech pioneer focused on creating open, transparent real estate marketplaces powered by digital verification.',
    },
    {
      name: 'Aarav Mehta',
      role: 'Head of Architecture & Design',
      bio: 'Urban planner and spatial architect specializing in 3D digital twin visualization and sustainable master plans.',
    },
    {
      name: 'Kavita Patel',
      role: 'Chief Legal & Compliance Officer',
      bio: 'Senior real estate advocate with 15+ years experience in State RERA laws and title deed verifications.',
    },
    {
      name: 'Rohan Sharma',
      role: 'VP of Developer Partnerships',
      bio: 'Connecting India’s premier builders and enterprise developers with verified institutional and retail homebuyers.',
    },
  ];

  return (
    <div className="min-h-screen bg-bg flex flex-col justify-between">
      <Navbar solid={true} />

      <main className="pt-24 pb-16 flex-1">
        {/* Page Banner */}
        <section className="bg-navy text-white py-16 px-4 md:px-8">
          <div className="max-w-container mx-auto text-left">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-sky text-xs font-semibold uppercase tracking-wider mb-4">
              <Sparkles size={13} /> Corporate Overview
            </div>
            <h1 className="font-display text-[clamp(2rem,4vw,3rem)] font-bold mb-4 tracking-tight text-white">
              Pioneering Transparency in Indian Real Estate
            </h1>
            <p className="text-sm md:text-base text-white/80 max-w-2xl leading-relaxed">
              We are on a mission to democratize property discovery, verification, and transactions for every Indian home seeker, homeowner, broker, and builder.
            </p>
          </div>
        </section>

        {/* Story Section */}
        <AboutSection />

        {/* Mission & Vision Grid */}
        <section className="py-16 px-4 md:px-8 max-w-container mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
            <div className="p-8 rounded-2xl bg-white border border-border shadow-sm">
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-5">
                <Target size={24} />
              </div>
              <h3 className="font-bold text-navy text-lg mb-2">Our Mission</h3>
              <p className="text-xs text-muted leading-relaxed">
                Empower every Indian citizen to buy, sell, or rent residential and commercial properties with absolute legal clarity, zero misinformation, and fair pricing.
              </p>
            </div>

            <div className="p-8 rounded-2xl bg-white border border-border shadow-sm">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-5">
                <Compass size={24} />
              </div>
              <h3 className="font-bold text-navy text-lg mb-2">Our Vision</h3>
              <p className="text-xs text-muted leading-relaxed">
                Build India's most trustworthy, AI-powered proptech marketplace where digital twin tours, online documentation, and RERA validations happen seamlessly.
              </p>
            </div>

            <div className="p-8 rounded-2xl bg-white border border-border shadow-sm">
              <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-5">
                <HeartHandshake size={24} />
              </div>
              <h3 className="font-bold text-navy text-lg mb-2">Our Core Values</h3>
              <p className="text-xs text-muted leading-relaxed">
                Integrity in every listing, developer accountability, consumer data privacy, and technological innovation to simplify property decisions.
              </p>
            </div>
          </div>
        </section>

        {/* Growth & Timeline */}
        <section className="py-16 px-4 md:px-8 max-w-container mx-auto text-left">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <div className="text-[0.72rem] font-bold tracking-widest uppercase text-blue-mid mb-2">
              Our Journey
            </div>
            <h2 className="font-display text-2xl md:text-3xl font-bold text-navy">
              Milestones That Shaped EstateXplorer
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {milestones.map((m, i) => (
              <div key={i} className="p-6 rounded-2xl bg-white border border-border shadow-sm relative">
                <div className="text-xs font-bold text-blue-mid uppercase tracking-widest mb-1">{m.year}</div>
                <h4 className="font-bold text-navy text-base mb-2">{m.title}</h4>
                <p className="text-xs text-muted leading-relaxed">{m.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Leadership Team */}
        <section className="py-16 px-4 md:px-8 max-w-container mx-auto text-left">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <div className="text-[0.72rem] font-bold tracking-widest uppercase text-blue-mid mb-2">
              Leadership
            </div>
            <h2 className="font-display text-2xl md:text-3xl font-bold text-navy">
              The Team Behind EstateXplorer
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {team.map((member, i) => (
              <div key={i} className="p-6 rounded-2xl bg-white border border-border shadow-sm text-left">
                <div className="w-14 h-14 rounded-2xl bg-navy text-white flex items-center justify-center font-bold text-lg mb-4">
                  {member.name.split(' ').map(n => n[0]).join('')}
                </div>
                <h4 className="font-bold text-navy text-base mb-0.5">{member.name}</h4>
                <div className="text-xs font-semibold text-blue-mid mb-3">{member.role}</div>
                <p className="text-xs text-muted leading-relaxed">{member.bio}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Why Choose Us */}
        <WhySection />

        {/* Trust Metrics */}
        <TrustBar />

        {/* Bottom CTA */}
        <section className="py-16 px-4 md:px-8 max-w-container mx-auto text-center">
          <div className="p-10 rounded-3xl bg-navy text-white relative overflow-hidden shadow-lg">
            <h2 className="font-display text-2xl md:text-3xl font-bold mb-3 text-white">
              Ready to Explore Verified Homes?
            </h2>
            <p className="text-xs md:text-sm text-white/80 max-w-xl mx-auto mb-6">
              Browse over 25,000+ certified developments and direct owner properties across India.
            </p>
            <div className="flex justify-center gap-4 flex-wrap">
              <Link
                to="/listings"
                className="px-6 py-3 rounded-lg bg-white text-navy text-xs font-bold hover:bg-slate-100 transition-all"
              >
                Browse Listings
              </Link>
              <Link
                to="/contact"
                className="px-6 py-3 rounded-lg border border-white/30 text-white text-xs font-semibold hover:bg-white/10 transition-all"
              >
                Contact Advisory Team
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default AboutUs;
