import React from 'react';
import { Link } from 'react-router-dom';
import { cities } from '../../utils/homeData';
import CityCard from './CityCard';

const CityGrid = () => {
  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto" id="cities">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-3 text-left">
        <div>
          <div className="text-[0.72rem] font-bold tracking-widest uppercase text-blue-600 mb-1.5">
            Explore by City
          </div>
          <h2 className="font-display text-[clamp(1.6rem,3vw,2.2rem)] font-bold text-slate-900 tracking-tight">
            Discover Properties in Top Cities
          </h2>
        </div>
        <Link
          to="/listings"
          className="text-xs font-bold text-slate-900 flex items-center gap-1.5 hover:gap-2.5 hover:text-blue-600 transition-all duration-200"
        >
          View All Cities →
        </Link>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 sm:gap-5">
        {cities.map((city) => (
          <CityCard key={city.id} city={city} />
        ))}
      </div>
    </section>
  );
};

export default CityGrid;
