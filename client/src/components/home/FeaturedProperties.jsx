import React, { useState, useEffect } from 'react';
import PropertyCard from './PropertyCard';
import { Link } from 'react-router-dom';
import { getFeaturedProperties } from '../../services/propertyService';

const FeaturedProperties = ({ onBookVisit, onViewDetails, bookedPropertyIds = [] }) => {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fetchFeatured = async () => {
      try {
        const res = await getFeaturedProperties('property');
        if (isMounted && res.success && Array.isArray(res.data) && res.data.length > 0) {
          const mapped = res.data.map(p => ({
            id: p._id,
            builder: p.builder?.builderProfile?.companyName || p.builder?.name || 'Verified Builder',
            name: p.title || p.name,
            location: typeof p.location === 'string' ? p.location : `${p.location?.address || ''}, ${p.location?.city || ''}`,
            price: p.priceDisplay || `₹${p.price}`,
            emi: p.priceSub || '',
            beds: p.bhk ? `${p.bhk} Beds` : p.type,
            baths: `${p.bhk ? Math.max(1, p.bhk - 1) : 1} Baths`,
            sqft: `${p.area || 1200} sqft`,
            parking: '1-2 Parking',
            status: p.statusLabel || (p.status === 'ready' ? 'Ready to Move' : 'Under Construction'),
            statusType: p.status === 'ready' ? 'ready' : 'construction',
            verified: true,
            rera: Boolean(p.rera),
            image: p.images?.[0] || p.image || 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?q=80&w=600&auto=format&fit=crop',
          }));
          setProperties(mapped);
        }
      } catch (err) {
        console.error('Failed to fetch featured properties:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchFeatured();
    return () => { isMounted = false; };
  }, []);

  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto" id="properties">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-3 text-left">
        <div>
          <div className="text-[0.72rem] font-bold tracking-widest uppercase text-blue-600 mb-1.5">
            Featured Properties
          </div>
          <h2 className="font-display text-[clamp(1.6rem,3vw,2.2rem)] font-bold text-slate-900 tracking-tight">
            Handpicked Premium Properties
          </h2>
        </div>
        <Link
          to="/listings"
          className="text-xs font-bold text-slate-900 flex items-center gap-1.5 hover:gap-2.5 hover:text-blue-600 transition-all duration-200"
        >
          View All Properties →
        </Link>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl border border-slate-200 overflow-hidden animate-pulse flex flex-col h-[380px]"
              >
                <div className="h-48 bg-slate-200" />
                <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="h-3 bg-slate-200 rounded w-1/3" />
                    <div className="h-5 bg-slate-200 rounded w-3/4" />
                    <div className="h-3 bg-slate-200 rounded w-1/2" />
                  </div>
                  <div className="pt-3 border-t border-slate-100 flex justify-between items-center">
                    <div className="h-5 bg-slate-200 rounded w-1/3" />
                    <div className="h-8 bg-slate-200 rounded w-1/3" />
                  </div>
                </div>
              </div>
            ))
          : properties.map((prop) => (
              <PropertyCard
                key={prop.id}
                property={prop}
                onBookVisit={onBookVisit}
                onViewDetails={onViewDetails}
                isBooked={bookedPropertyIds.some(id => String(id) === String(prop.id))}
              />
            ))}
      </div>
    </section>
  );
};

export default React.memo(FeaturedProperties);

