import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, CheckCircle2, MapPin, Share2 } from 'lucide-react';
import Button from '../common/Button';
import ShareModal from '../common/ShareModal';
import { formatPrice, getPublicImageUrl } from '../../utils/formatters';

const PropertyCard = ({ property, onBookVisit, isBooked = false }) => {
  const [shareOpen, setShareOpen] = useState(false);
  const [isFav, setIsFav] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('wishlist') || '[]');
      return saved.includes(property.id);
    } catch {
      return false;
    }
  });
  const navigate = useNavigate();

  const handleCardClick = () => {
    if (property.id && typeof property.id === 'string' && !property.id.startsWith('static')) {
      navigate(`/property/${property.id}`);
    } else {
      navigate('/listings');
    }
  };

  const handleToggleFav = (e) => {
    e.stopPropagation();
    try {
      const saved = JSON.parse(localStorage.getItem('wishlist') || '[]');
      let updated;
      if (saved.includes(property.id)) {
        updated = saved.filter(id => id !== property.id);
        setIsFav(false);
      } else {
        updated = [...saved, property.id];
        setIsFav(true);
      }
      localStorage.setItem('wishlist', JSON.stringify(updated));
    } catch {
      setIsFav(!isFav);
    }
  };

  const imgSrc = getPublicImageUrl(property.image || (Array.isArray(property.images) && property.images[0]) || property.img);

  return (
    <>
      <div
        onClick={handleCardClick}
        className="group bg-white border border-slate-200/90 rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-1.5 hover:shadow-lg hover:border-slate-300 text-left flex flex-col justify-between cursor-pointer"
      >
        <div>
          {/* Image Container & Badges */}
          <div className="relative aspect-[16/10] overflow-hidden bg-slate-100">
            <img
              src={imgSrc}
              alt={property.name || 'Property'}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=800&auto=format&fit=crop';
              }}
            />
            
            {/* Top Badges */}
            <div className="absolute top-3 left-3 flex items-center gap-1.5 z-10">
              {property.verified && (
                <span className="inline-flex items-center gap-1 text-[0.68rem] font-bold px-2.5 py-1 rounded-full bg-emerald-900/80 text-emerald-200 backdrop-blur-md border border-emerald-500/30 shadow-xs">
                  <CheckCircle2 size={11} className="text-emerald-400" />
                  Verified
                </span>
              )}
              {property.rera && (
                <span className="inline-flex items-center text-[0.68rem] font-bold px-2.5 py-1 rounded-full bg-slate-900/80 text-slate-200 backdrop-blur-md border border-slate-700/50 shadow-xs">
                  RERA
                </span>
              )}
            </div>

            {/* Top Right Action Buttons (Share + Fav) */}
            <div className="absolute top-3 right-3 flex items-center gap-1.5 z-10">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShareOpen(true);
                }}
                className="w-8 h-8 rounded-full bg-white/95 hover:bg-white text-slate-600 hover:text-blue-600 flex items-center justify-center shadow-md border border-slate-200/80 transition-all cursor-pointer"
                aria-label="Share"
                title="Share Property"
              >
                <Share2 size={14} />
              </button>
              <button
                type="button"
                onClick={handleToggleFav}
                className="w-8 h-8 rounded-full bg-white/95 hover:bg-white text-slate-600 hover:text-rose-500 flex items-center justify-center shadow-md border border-slate-200/80 transition-all cursor-pointer"
                aria-label="Wishlist"
              >
                <Heart
                  size={15}
                  className={isFav ? 'text-rose-500 fill-rose-500' : 'text-slate-600'}
                  fill={isFav ? 'currentColor' : 'none'}
                  strokeWidth={2}
                />
              </button>
            </div>
          </div>

        {/* Card Body */}
        <div className="p-5">
          {/* Builder Eyebrow */}
          <div className="text-[0.68rem] font-bold text-slate-500 uppercase tracking-wider mb-1 truncate">
            {property.builder}
          </div>

          {/* Title */}
          <h3 className="text-[0.95rem] font-bold text-slate-900 leading-snug mb-1 group-hover:text-blue-700 transition-colors line-clamp-1">
            {property.name}
          </h3>

          {/* Location */}
          <p className="text-xs text-slate-500 mb-3.5 font-normal flex items-center gap-1 truncate">
            <MapPin size={12.5} className="text-slate-400 shrink-0" />
            <span className="truncate">{property.location}</span>
          </p>

          {/* Pricing Row */}
          <div className="flex items-center justify-between mb-3.5 bg-slate-50/90 p-2.5 rounded-xl border border-slate-100/90 gap-2">
            <div className="min-w-0">
              <span className="text-[0.65rem] text-slate-400 font-semibold block uppercase tracking-wider">Starting from</span>
              <span className="text-[1.05rem] font-bold text-slate-900 tabular-nums tracking-tight whitespace-nowrap">
                {formatPrice(property.price, property.priceDisplay || property.price)}
              </span>
            </div>
            {property.emi && (
              <div className="text-right min-w-0 flex-1 pl-2 border-l border-slate-200/60">
                <span className="text-[0.65rem] text-slate-400 font-medium block truncate">
                  {property.emi.toLowerCase().includes('sq') ? 'Unit Rate' : 'Est. EMI'}
                </span>
                <span className="text-[0.72rem] text-slate-700 font-semibold truncate block" title={property.emi}>
                  {property.emi}
                </span>
              </div>
            )}
          </div>

          {/* Specifications Meta */}
          <div className="flex items-center justify-between text-[0.72rem] text-slate-600 pb-3 mb-3 border-b border-slate-100 font-medium">
            <span className="truncate">{property.beds}</span>
            <span className="text-slate-300">•</span>
            <span className="truncate">{property.baths}</span>
            <span className="text-slate-300">•</span>
            <span className="truncate">{property.sqft}</span>
          </div>

          {/* Possession / Status Tag */}
          <div
            className={`inline-flex items-center gap-1.5 text-[0.7rem] font-bold px-2.5 py-1 rounded-md ${
              property.statusType === 'construction'
                ? 'bg-amber-50 text-amber-800 border border-amber-200/60'
                : 'bg-emerald-50 text-emerald-800 border border-emerald-200/60'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            {property.status}
          </div>
        </div>
      </div>

      {/* Dual CTAs */}
      <div className="p-5 pt-0 flex gap-2.5">
        {isBooked ? (
          <button
            type="button"
            disabled
            className="flex-1 rounded-xl min-h-[38px] text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-300 opacity-95 cursor-default flex items-center justify-center gap-1.5"
          >
            <CheckCircle2 size={13} className="text-emerald-600" />
            Booked
          </button>
        ) : (
          <Button
            variant="primary"
            size="sm"
            className="flex-1 rounded-xl min-h-[38px] text-xs font-semibold"
            onClick={(e) => {
              e.stopPropagation();
              onBookVisit && onBookVisit(property);
            }}
          >
            Book Visit
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          className="flex-1 rounded-xl min-h-[38px] text-xs font-semibold"
          onClick={(e) => {
            e.stopPropagation();
            handleCardClick();
          }}
        >
          View Details
        </Button>
      </div>
    </div>

    {/* Professional Share Modal */}
    <ShareModal
      isOpen={shareOpen}
      onClose={() => setShareOpen(false)}
      property={property}
    />
  </>
);
};

export default PropertyCard;
