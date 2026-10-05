import React from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '../../hooks/useAuth';

const Footer = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  return (
    <footer className="bg-navy text-white pt-20 px-4 md:px-8 pb-0 relative overflow-hidden">
      <div className="max-w-container mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[1.8fr_1fr_1fr_1fr] gap-12 pb-16 relative z-10 text-left">
        {/* Brand Column */}
        <div className="space-y-5">
          <Link to="/" className="flex items-center gap-2.5 font-bold text-xl text-white">
            <div className="w-9 h-9 bg-white text-navy rounded-lg flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </div>
            <span className="font-sans">
              Estate<span className="text-[#4a6fa5]">X</span>plorer
            </span>
          </Link>
          <p className="text-xs text-white/45 leading-relaxed max-w-xs">
            We craft inspiring spaces that blend cutting-edge design with enduring functionality, turning your vision into reality.
          </p>
        </div>

        {/* Links Column 1 */}
        <div>
          <h5 className="text-[0.8rem] font-semibold tracking-wider text-white/55 uppercase mb-5">
            Quick Navigation
          </h5>
          <ul className="space-y-3 text-xs">
            {!isAdmin && <li><Link to="/about" className="text-white/85 hover:text-white transition-colors">About Us</Link></li>}
            <li><Link to="/listings" className="text-white/85 hover:text-white transition-colors">Properties</Link></li>
            <li><Link to="/projects" className="text-white/85 hover:text-white transition-colors">Builder Projects</Link></li>
            {!isAdmin && <li><Link to="/contact" className="text-white/85 hover:text-white transition-colors">Contact Support</Link></li>}
          </ul>
        </div>

        {/* Links Column 2 */}
        <div>
          <h5 className="text-[0.8rem] font-semibold tracking-wider text-white/55 uppercase mb-5">
            Social media
          </h5>
          <ul className="space-y-3 text-xs">
            <li><a href="#" className="text-white/85 hover:text-white transition-colors">Instagram</a></li>
            <li><a href="#" className="text-white/85 hover:text-white transition-colors">YouTube</a></li>
            <li><a href="#" className="text-white/85 hover:text-white transition-colors">Facebook</a></li>
            <li><a href="#" className="text-white/85 hover:text-white transition-colors">X (Twitter)</a></li>
          </ul>
        </div>

        {/* Links Column 3 */}
        <div>
          <h5 className="text-[0.8rem] font-semibold tracking-wider text-white/55 uppercase mb-5">
            EstateXplorer
          </h5>
          <ul className="space-y-3 text-xs">
            <li><a href="#" className="text-white/85 hover:text-white transition-colors">Licensing</a></li>
            <li><a href="#" className="text-white/85 hover:text-white transition-colors">Style Guide</a></li>
            <li><a href="#" className="text-white/85 hover:text-white transition-colors">Privacy Policy</a></li>
            <li><a href="#" className="text-white/85 hover:text-white transition-colors">Terms of Service</a></li>
          </ul>
        </div>
      </div>

      {/* Giant Watermark Text */}
      <div className="max-w-container mx-auto pt-5 overflow-hidden relative z-0 text-center select-none">
        <div className="font-display text-[clamp(4rem,14vw,10rem)] font-semibold text-white/[0.06] tracking-tight whitespace-nowrap leading-[0.85]">
          EstateXplorer
        </div>
      </div>

      {/* Bottom Legal Row */}
      <div className="max-w-container mx-auto py-5 border-t border-white/[0.06] flex flex-wrap items-center justify-between gap-3 text-xs text-white/35 relative z-10">
        <span>© 2026 EstateXplorer. All rights reserved.</span>
        <div className="flex gap-5">
          <a href="#" className="hover:text-sky transition-colors">Privacy Policy</a>
          <a href="#" className="hover:text-sky transition-colors">Terms of Service</a>
          <a href="#" className="hover:text-sky transition-colors">RERA Disclosures</a>
        </div>
      </div>
    </footer>
  );
};

export default React.memo(Footer);

