import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import SearchCard from './SearchCard';

const Hero = () => {
  const heroRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    let ctx;
    import('gsap').then(({ default: gsap }) => {
      ctx = gsap.context(() => {
        gsap.fromTo(
          '.hero-animate',
          { opacity: 0, y: 30 },
          {
            opacity: 1,
            y: 0,
            duration: 0.8,
            stagger: 0.15,
            ease: 'power3.out',
          }
        );
      }, heroRef);
    }).catch(() => {});

    return () => ctx?.revert();
  }, []);

  const handleSearch = (searchData) => {
    const params = new URLSearchParams();
    if (searchData.location) params.append('location', searchData.location);
    if (searchData.propertyType && searchData.propertyType !== 'Select type') {
      params.append('type', searchData.propertyType);
    }
    if (searchData.bedrooms && searchData.bedrooms !== 'Any') {
      const bhkNum = searchData.bedrooms.replace(/\D/g, '');
      if (bhkNum) params.append('bhk', bhkNum);
    }
    if (searchData.budget && searchData.budget !== 'Min – Max') {
      params.append('budget', searchData.budget);
    }
    if (searchData.status) {
      params.append('status', searchData.status);
    }
    if (searchData.purpose && searchData.purpose !== 'all') {
      params.append('purpose', searchData.purpose);
    }
    if (searchData.tab === 'New Projects') {
      params.append('category', 'project');
    } else if (searchData.tab === 'Commercial') {
      params.append('type', 'Commercial');
    }
    navigate(`/listings?${params.toString()}`);
  };

  return (
    <section ref={heroRef} className="relative min-h-screen flex items-center overflow-hidden bg-navy" id="home">
      {/* Background Image */}
      <div
        className="absolute inset-0 bg-center bg-cover bg-no-repeat transition-transform duration-1000 scale-105"
        style={{
          backgroundImage:
            "url('https://images.unsplash.com/photo-1613490493576-7fde63acd811?q=80&w=2400&auto=format&fit=crop')",
        }}
      />

      {/* Dark Overlay */}
      <div className="absolute inset-0 bg-navy/70" />

      {/* Content */}
      <div className="relative z-10 max-w-container mx-auto px-4 md:px-8 pt-36 pb-20 w-full text-left">
        <div className="hero-animate inline-flex items-center gap-2 text-[0.75rem] font-semibold tracking-widest uppercase text-sky mb-5">
          <span className="w-2 h-2 bg-sky rounded-full" />
          Find Your Perfect Space
        </div>

        <h1 className="hero-animate font-display text-[clamp(2.6rem,5.5vw,4rem)] font-semibold leading-[1.12] text-white max-w-2xl mb-4 tracking-tight">
          Discover Luxury<br />Living <em className="italic text-sky">Redefined</em>
        </h1>

        <p className="hero-animate text-sm md:text-base text-white/70 max-w-lg mb-9 leading-relaxed font-normal">
          Explore verified premium properties, world-class projects and exclusive opportunities across India's finest locations.
        </p>

        <div className="hero-animate">
          <SearchCard onSearch={handleSearch} />
        </div>
      </div>
    </section>
  );
};

export default React.memo(Hero);

