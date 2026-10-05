import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Eye, Layout, Layers, Sparkles } from 'lucide-react';
import Button from '../common/Button';

const ExperienceSection = () => {
  const navigate = useNavigate();
  const [activeControl, setActiveControl] = useState('Rotate');
  const [activeFloor, setActiveFloor] = useState('All Floors');

  const controls = ['Rotate', 'Zoom', 'Interior', 'Exterior', 'Amenities'];
  const floors = ['All Floors', '12', '11', '10', '9', '8', '7', '6', '5', '4', '3', '2', '1', 'G'];

  const previewImages = {
    Rotate: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?q=80&w=900&auto=format&fit=crop',
    Zoom: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=900&auto=format&fit=crop',
    Interior: 'https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?q=80&w=900&auto=format&fit=crop',
    Exterior: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?q=80&w=900&auto=format&fit=crop',
    Amenities: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?q=80&w=900&auto=format&fit=crop',
  };

  return (
    <section className="bg-navy py-20 px-4 md:px-8 relative overflow-hidden text-left">
      <div className="max-w-container mx-auto grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-12 items-center">
        {/* Left Copy */}
        <div>
          <div className="text-[0.72rem] font-semibold tracking-widest uppercase text-sky mb-2 flex items-center gap-1.5">
            <Sparkles size={14} />
            <span>Immersive Experience</span>
          </div>
          <h2 className="font-display text-[clamp(1.8rem,3.5vw,2.6rem)] font-semibold text-white mb-3 tracking-tight">
            Trusted Thousands of Happy Families
          </h2>
          <p className="text-white/60 text-sm md:text-base mb-7 max-w-md leading-relaxed font-normal">
            Explore our interactive 3D models, virtual tours and floor plans. See every detail of your future home before booking a site visit.
          </p>

          <div className="space-y-4 mb-8">
            <div className="flex items-center gap-3.5 cursor-pointer" onClick={() => setActiveControl('Rotate')}>
              <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-white hover:bg-white/20 transition-colors">
                <Box size={20} />
              </div>
              <div>
                <strong className="block text-white text-sm font-semibold">3D Building</strong>
                <span className="text-xs text-white/50">Explore exterior architecture</span>
              </div>
            </div>

            <div className="flex items-center gap-3.5 cursor-pointer" onClick={() => setActiveControl('Interior')}>
              <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-white hover:bg-white/20 transition-colors">
                <Eye size={20} />
              </div>
              <div>
                <strong className="block text-white text-sm font-semibold">360° Virtual Tour</strong>
                <span className="text-xs text-white/50">Full interior walkthrough</span>
              </div>
            </div>

            <div className="flex items-center gap-3.5 cursor-pointer" onClick={() => setActiveControl('Amenities')}>
              <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-white hover:bg-white/20 transition-colors">
                <Layout size={20} />
              </div>
              <div>
                <strong className="block text-white text-sm font-semibold">Clubhouse &amp; Amenities</strong>
                <span className="text-xs text-white/50">Olympic pool, gym &amp; lounge</span>
              </div>
            </div>

            <div className="flex items-center gap-3.5 cursor-pointer" onClick={() => setActiveControl('Exterior')}>
              <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-white hover:bg-white/20 transition-colors">
                <Layers size={20} />
              </div>
              <div>
                <strong className="block text-white text-sm font-semibold">Skyline &amp; Floor Views</strong>
                <span className="text-xs text-white/50">Switch floors {activeFloor !== 'All Floors' ? `(Floor ${activeFloor})` : ''}</span>
              </div>
            </div>
          </div>

          <Button
            variant="white"
            size="lg"
            className="inline-flex"
            onClick={() => navigate('/listings')}
          >
            Explore All 3D Properties →
          </Button>
        </div>

        {/* Right Viewer Shell */}
        <div className="relative rounded-2xl overflow-hidden aspect-[4/3] shadow-2xl border border-white/10 group">
          <img
            src={previewImages[activeControl] || previewImages.Rotate}
            alt="3D Building Preview"
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />

          <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/15 text-[0.72rem] font-semibold text-white flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Mode: {activeControl} · {activeFloor === 'All Floors' ? 'Full Tower' : `Floor ${activeFloor}`}</span>
          </div>

          {/* Viewer Bottom Controls */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 bg-black/65 backdrop-blur-md p-1.5 rounded-full border border-white/10">
            {controls.map((ctrl) => (
              <button
                key={ctrl}
                onClick={() => setActiveControl(ctrl)}
                className={`text-[0.72rem] font-medium px-3 py-1.5 rounded-full transition-all duration-250 cursor-pointer ${
                  activeControl === ctrl
                    ? 'bg-white text-navy font-semibold shadow-sm'
                    : 'text-white/70 hover:text-white'
                }`}
              >
                {ctrl}
              </button>
            ))}
          </div>

          {/* Floor Switcher */}
          <div className="absolute right-3 top-3 bg-black/60 backdrop-blur-md rounded-xl p-2 flex flex-col gap-0.5 border border-white/10 text-[0.65rem] max-h-[70%] overflow-y-auto">
            {floors.map((floor) => (
              <button
                key={floor}
                onClick={() => setActiveFloor(floor)}
                className={`px-2 py-0.5 rounded text-center transition-colors cursor-pointer ${
                  activeFloor === floor
                    ? 'text-sky font-bold bg-white/10'
                    : 'text-white/50 hover:text-white'
                }`}
              >
                {floor}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default React.memo(ExperienceSection);
