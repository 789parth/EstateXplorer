import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { categories } from '../../utils/homeData';

const CategoryGrid = () => {
  const navigate = useNavigate();
  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-3 text-left">
        <div>
          <div className="text-[0.72rem] font-bold tracking-widest uppercase text-blue-600 mb-1.5">
            Browse Categories
          </div>
          <h2 className="font-display text-[clamp(1.6rem,3vw,2.2rem)] font-bold text-slate-900 tracking-tight">
            Find the Right Property for You
          </h2>
        </div>
        <Link
          to="/listings"
          className="text-xs font-bold text-slate-900 flex items-center gap-1.5 hover:gap-2.5 hover:text-blue-600 transition-all duration-200"
        >
          View All Categories →
        </Link>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 sm:gap-5">
        {categories.map((cat) => (
          <div
            key={cat.id}
            onClick={() => {
              let typeParam = 'apartment';
              const titleLower = cat.title.toLowerCase();
              if (titleLower.includes('villa')) typeParam = 'villa';
              else if (titleLower.includes('apartment')) typeParam = 'apartment';
              else if (titleLower.includes('commercial')) typeParam = 'commercial';
              else if (titleLower.includes('plot')) typeParam = 'plot';
              else if (titleLower.includes('penthouse')) typeParam = 'penthouse';
              else if (titleLower.includes('farmhouse')) typeParam = 'farmhouse';
              navigate(`/listings?type=${encodeURIComponent(typeParam)}`);
            }}
            className="group bg-white border border-slate-200/90 rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-slate-300 cursor-pointer text-left flex flex-col justify-between"
          >
            <div>
              <div className="aspect-[16/11] overflow-hidden bg-slate-100">
                <img
                  src={cat.image}
                  alt={cat.title}
                  loading="lazy"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-106"
                />
              </div>
              <div className="p-3.5 sm:p-4">
                <div className="text-sm font-bold text-slate-900 mb-0.5 group-hover:text-blue-600 transition-colors">
                  {cat.title}
                </div>
                <div className="text-[0.78rem] text-slate-500 mb-1.5 font-medium">
                  {cat.count}
                </div>
                <div className="text-[0.72rem] text-slate-400 leading-snug">
                  {cat.desc}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default CategoryGrid;
