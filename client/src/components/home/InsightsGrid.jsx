import React from 'react';
import { insights } from '../../utils/homeData';

const InsightsGrid = () => {
  return (
    <section className="py-20 px-4 md:px-8 max-w-container mx-auto">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-9 gap-3 text-left">
        <div>
          <div className="text-[0.72rem] font-semibold tracking-widest uppercase text-blue-mid mb-1.5">
            Real Estate Insights
          </div>
          <h2 className="font-display text-[clamp(1.6rem,3vw,2.1rem)] font-semibold text-navy tracking-tight">
            Latest Insights & Market Updates
          </h2>
        </div>
        <a
          href="#insights"
          className="text-xs font-semibold text-navy flex items-center gap-1.5 hover:gap-2.5 transition-all duration-250"
        >
          View All Articles →
        </a>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {insights.map((item) => (
          <div
            key={item.id}
            className="group bg-white border border-border rounded-xl overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-md hover:border-navy/15 cursor-pointer text-left flex flex-col justify-between"
          >
            <div className="aspect-[16/10] overflow-hidden">
              <img
                src={item.image}
                alt={item.title}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            </div>
            <div className="p-3.5 flex-1 flex flex-col justify-between">
              <div>
                <div className="text-[0.68rem] font-bold text-blue-mid uppercase tracking-wider mb-1">
                  {item.cat}
                </div>
                <h4 className="text-[0.88rem] font-semibold text-navy leading-snug mb-2">
                  {item.title}
                </h4>
              </div>
              <div className="text-[0.72rem] text-light mt-2">
                {item.meta}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default InsightsGrid;
