import React from 'react';

const CTA = ({ onExplore, onConsultation }) => {
  return (
    <section className="relative py-24 px-4 md:px-8 text-center overflow-hidden" id="contact">
      {/* Background Image */}
      <div
        className="absolute inset-0 bg-center bg-cover"
        style={{
          backgroundImage:
            "url('https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?q=80&w=2400&auto=format&fit=crop')",
        }}
      />
      <div className="absolute inset-0 bg-navy/90" />

      {/* Content */}
      <div className="relative z-10 max-w-xl mx-auto">
        <h2 className="font-display text-[clamp(1.8rem,3.5vw,2.6rem)] font-semibold text-white mb-3 tracking-tight">
          Ready to Find Your Dream Property?
        </h2>
        <p className="text-white/65 text-base mb-8 font-normal">
          Get personalized recommendations and expert guidance from our real estate specialists.
        </p>

        <div className="flex flex-wrap gap-3 justify-center">
          <button
            type="button"
            onClick={onExplore}
            className="px-7 py-3.5 rounded-full bg-white text-navy font-semibold text-sm hover:bg-[#e8ecf2] hover:-translate-y-0.5 hover:shadow-lg transition-all duration-250 cursor-pointer"
          >
            Explore Properties
          </button>
          <button
            type="button"
            onClick={onConsultation}
            className="px-7 py-3.5 rounded-full border-1.5 border-white/35 text-white font-semibold text-sm hover:border-white hover:bg-white/10 transition-all duration-250 cursor-pointer"
          >
            Book Consultation
          </button>
        </div>
      </div>
    </section>
  );
};

export default CTA;
