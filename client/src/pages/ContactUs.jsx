import React from 'react';
import { Mail, Phone, MapPin, Sparkles, HelpCircle, ChevronRight } from 'lucide-react';
import Navbar from '../components/layout/Navbar';
import Footer from '../components/layout/Footer';
import ContactSection from '../components/home/ContactSection';

const ContactUs = () => {
  const faqs = [
    {
      q: 'How does EstateXplorer verify listed properties and projects?',
      a: 'Every developer project listed on EstateXplorer is cross-referenced with State RERA registries, government land revenue records, and approved layout plans. Direct owner properties undergo phone and identity verification.',
    },
    {
      q: 'Do buyers pay any brokerage or commissions on new builder projects?',
      a: 'No. All builder new developments listed on EstateXplorer feature 0% buyer commission and direct developer pricing.',
    },
    {
      q: 'How can builders or certified agents register on the portal?',
      a: 'Builders and agents can register an account, select their respective role, submit their company/RERA details in profile settings, and start posting projects and receiving verified leads instantly.',
    },
    {
      q: 'How do I schedule a site visit for a property?',
      a: 'Click "Book a visit" on any property detail page or listing card, pick your preferred date and time slot, and our property advisory coordinator will confirm your guided visit with the sales office.',
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
              <Sparkles size={13} /> Support &amp; Locations
            </div>
            <h1 className="font-display text-[clamp(2rem,4vw,3rem)] font-bold mb-4 tracking-tight text-white">
              We Are Here to Assist Your Property Journey
            </h1>
            <p className="text-sm md:text-base text-white/80 max-w-2xl leading-relaxed">
              Reach out to our certified property advisors, developer onboarding managers, or consumer dispute resolution helpline.
            </p>
          </div>
        </section>

        {/* Contact Form & Channels */}
        <ContactSection />

        {/* Regional Offices */}
        <section className="py-16 px-4 md:px-8 max-w-container mx-auto text-left">
          <div className="mb-10">
            <div className="text-[0.72rem] font-bold tracking-widest uppercase text-blue-mid mb-1">
              Our Locations
            </div>
            <h2 className="font-display text-2xl font-bold text-navy">
              Regional EstateXplorer Centers
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-6 rounded-2xl bg-white border border-border shadow-sm">
              <div className="font-bold text-navy text-base mb-1">Gujarat (HQ)</div>
              <div className="text-xs text-muted leading-relaxed mb-4">
                Tech Tower, Near Town Hall, Vallabh Vidhyanagar, Anand 388120
              </div>
              <div className="text-xs font-semibold text-blue-mid">+91 2692234800</div>
            </div>

            <div className="p-6 rounded-2xl bg-white border border-border shadow-sm">
              <div className="font-bold text-navy text-base mb-1">Ahmedabad Office</div>
              <div className="text-xs text-muted leading-relaxed mb-4">
                Level 8, Mondeal Heights, SG Highway, Ahmedabad 380015
              </div>
              <div className="text-xs font-semibold text-blue-mid">+91 7949002200</div>
            </div>

            <div className="p-6 rounded-2xl bg-white border border-border shadow-sm">
              <div className="font-bold text-navy text-base mb-1">Mumbai Center</div>
              <div className="text-xs text-muted leading-relaxed mb-4">
                402 Platina, Bandra Kurla Complex (BKC), Mumbai 400051
              </div>
              <div className="text-xs font-semibold text-blue-mid">+91 2261239900</div>
            </div>

            <div className="p-6 rounded-2xl bg-white border border-border shadow-sm">
              <div className="font-bold text-navy text-base mb-1">Bengaluru Hub</div>
              <div className="text-xs text-muted leading-relaxed mb-4">
                Indiqube Delta, 100 Feet Rd, Koramangala, Bengaluru 560034
              </div>
              <div className="text-xs font-semibold text-blue-mid">+91 8041207700</div>
            </div>
          </div>
        </section>

        {/* FAQs */}
        <section className="py-16 px-4 md:px-8 max-w-container mx-auto text-left">
          <div className="mb-10">
            <div className="text-[0.72rem] font-bold tracking-widest uppercase text-blue-mid mb-1">
              Common Inquiries
            </div>
            <h2 className="font-display text-2xl font-bold text-navy">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {faqs.map((f, i) => (
              <div key={i} className="p-6 rounded-2xl bg-white border border-border shadow-sm">
                <div className="flex items-start gap-3">
                  <HelpCircle size={18} className="text-blue-mid flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-navy text-sm mb-2">{f.q}</h4>
                    <p className="text-xs text-muted leading-relaxed">{f.a}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default ContactUs;
