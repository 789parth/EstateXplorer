import React from 'react';
import { useNavigate } from 'react-router-dom';

const CityCard = ({ city }) => {
  const navigate = useNavigate();
  return (
    <div
      onClick={() => navigate(`/listings?location=${encodeURIComponent(city.name)}`)}
      className="group bg-white border border-slate-200/90 rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-slate-300 cursor-pointer text-left flex flex-col justify-between"
    >
      <div>
        <div className="aspect-[16/11] overflow-hidden bg-slate-100">
          <img
            src={city.image}
            alt={city.name}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-106"
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = 'https://images.unsplash.com/photo-1596401057633-54a8fe8ef647?q=80&w=800&auto=format&fit=crop';
            }}
          />
        </div>
        <div className="p-3.5 sm:p-4">
          <div className="text-sm font-bold text-slate-900 mb-1 group-hover:text-blue-600 transition-colors">
            {city.name}
          </div>
          <div className="text-[0.75rem] text-slate-500 leading-snug space-y-0.5">
            <div>{city.count}</div>
            <div className="text-slate-400">{city.price}</div>
            <div className="text-emerald-600 font-bold">{city.growth}</div>
          </div>
        </div>
      </div>
      <div className="px-3.5 sm:px-4 pb-3.5 pt-0">
        <span className="inline-flex items-center gap-1 text-[0.75rem] font-bold text-slate-900 group-hover:text-blue-600 group-hover:gap-1.5 transition-all">
          Explore →
        </span>
      </div>
    </div>
  );
};

export default CityCard;
