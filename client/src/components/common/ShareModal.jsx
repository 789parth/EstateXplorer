import React, { useState } from 'react';
import { X, Copy, Check, Share2, MapPin, Link2, ShieldCheck, Smartphone } from 'lucide-react';
import { formatPrice, getPublicImageUrl } from '../../utils/formatters';

const WhatsAppIcon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.952 3.71 1.453 5.711 1.454h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

const GmailIcon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
    <path fill="#4285F4" d="M1.5 5.25v13.5c0 .966.784 1.75 1.75 1.75h3.25V9.673L12 14.25l5.5-4.577V20.5h3.25c.966 0 1.75-.784 1.75-1.75V5.25c0-1.874-2.128-2.955-3.625-1.832L12 8.75 5.125 3.418C3.628 2.295 1.5 3.376 1.5 5.25z" />
    <path fill="#34A853" d="M1.5 18.75c0 .966.784 1.75 1.75 1.75h3.25V12L1.5 8.25v10.5z" />
    <path fill="#EA4335" d="M18.5 3.418L12 8.75 5.125 3.418C3.628 2.295 1.5 3.376 1.5 5.25L12 13.5l10.5-8.25c0-1.874-2.128-2.955-3.625-1.832z" />
    <path fill="#FBBC04" d="M22.5 5.25L17.5 9v11.5h3.25c.966 0 1.75-.784 1.75-1.75V5.25z" />
  </svg>
);

const XIcon = ({ size = 17, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const LinkedInIcon = ({ size = 18, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 8.76a1.45 1.45 0 0 0 1.45-1.45 1.45 1.45 0 0 0-1.45-1.45 1.45 1.45 0 0 0-1.45 1.45 1.45 1.45 0 0 0 1.45 1.45m1.39 9.74v-8.37H5.07v8.37z" />
  </svg>
);

const FacebookIcon = ({ size = 18, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </svg>
);

const ShareModal = ({ isOpen, onClose, property }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !property) return null;

  const propId = property._id || property.id;
  const shareUrl = `${window.location.origin}/property/${propId}`;
  const title = property.title || property.name || 'Verified Property Listing';
  const price = formatPrice(property.price, property.priceDisplay, property.purpose);
  const location = typeof property.location === 'string'
    ? property.location
    : `${property.location?.address || ''}, ${property.location?.city || ''}`.replace(/^,\s*/, '');
  const rawImage = property.img || (Array.isArray(property.images) && property.images[0]) || property.image || '';
  const displayImage = getPublicImageUrl(rawImage);

  const shareText = `Check out ${title} located at ${location} for ${price} on EstateXplorer: ${shareUrl}`;

  const handleCopyLink = async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = shareUrl;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        textArea.remove();
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text: `Check out ${title} on EstateXplorer (${price})`,
          url: shareUrl,
        });
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.warn('Native share failed, falling back to copy:', err);
          handleCopyLink();
        }
      }
    } else {
      handleCopyLink();
    }
  };

  const shareChannels = [
    {
      name: 'WhatsApp',
      icon: WhatsAppIcon,
      badgeBg: 'bg-emerald-50 text-emerald-600 border border-emerald-200/80 group-hover:bg-emerald-500 group-hover:text-white',
      url: `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`,
    },
    {
      name: 'Gmail',
      icon: GmailIcon,
      badgeBg: 'bg-red-50/70 border border-red-200/80 group-hover:bg-white group-hover:shadow-xs',
      url: `https://mail.google.com/mail/?view=cm&fs=1&su=${encodeURIComponent(`EstateXplorer Property: ${title}`)}&body=${encodeURIComponent(shareText)}`,
    },
    {
      name: 'X',
      icon: XIcon,
      badgeBg: 'bg-slate-100 text-slate-900 border border-slate-300/80 group-hover:bg-black group-hover:text-white',
      url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(`${title} - ${price} on @EstateXplorer`)}&url=${encodeURIComponent(shareUrl)}`,
    },
    {
      name: 'LinkedIn',
      icon: LinkedInIcon,
      badgeBg: 'bg-blue-50 text-[#0A66C2] border border-blue-200/80 group-hover:bg-[#0A66C2] group-hover:text-white',
      url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
    },
    {
      name: 'Facebook',
      icon: FacebookIcon,
      badgeBg: 'bg-blue-50 text-[#1877F2] border border-blue-200/80 group-hover:bg-[#1877F2] group-hover:text-white',
      url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white border border-slate-200/90 rounded-[28px] shadow-[0_25px_60px_-15px_rgba(15,23,42,0.25)] w-full max-w-[470px] overflow-hidden relative text-left transform transition-all">
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-100/90 text-blue-600 flex items-center justify-center shadow-2xs shrink-0">
              <Share2 size={18} className="stroke-[2.2]" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 tracking-tight leading-snug">Share Listing</h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">Send verified property details to clients &amp; network</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer shrink-0"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="px-6 pt-5 pb-6 space-y-4">
          {/* Enterprise Property Preview Card */}
          <div className="p-3.5 bg-slate-50 border border-slate-200/90 rounded-2xl flex items-center gap-3.5 shadow-2xs">
            <div className="relative w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 border border-slate-200 bg-slate-200">
              <img
                src={displayImage}
                alt={title}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.src = 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=400&auto=format&fit=crop';
                }}
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200/60 text-[0.62rem] font-extrabold uppercase tracking-wide">
                  <ShieldCheck size={10} className="text-blue-600" />
                  Verified
                </span>
                <span className="text-[0.68rem] text-slate-400 font-medium uppercase tracking-wider">
                  {property.purpose === 'rent' ? 'For Rent' : 'For Sale'}
                </span>
              </div>
              <h4 className="text-xs font-bold text-slate-900 truncate leading-tight">{title}</h4>
              <p className="text-[0.72rem] text-slate-500 truncate flex items-center gap-1 mt-0.5">
                <MapPin size={11} className="text-slate-400 shrink-0" />
                <span>{location || 'Prime Location'}</span>
              </p>
              <div className="text-xs font-black text-blue-600 mt-1">{price}</div>
            </div>
          </div>

          {/* Social Share Grid */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <label className="text-[0.68rem] font-bold text-slate-600 uppercase tracking-wider">
                Instant Share Channels
              </label>
              {typeof navigator !== 'undefined' && !!navigator.share && (
                <button
                  type="button"
                  onClick={handleNativeShare}
                  className="text-[0.7rem] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Smartphone size={12} />
                  <span>Device apps</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-5 gap-2">
              {shareChannels.map((ch) => {
                const IconComponent = ch.icon;
                return (
                  <a
                    key={ch.name}
                    href={ch.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex flex-col items-center justify-center p-2 rounded-2xl border border-slate-200/80 bg-slate-50/50 hover:bg-white hover:border-slate-300 hover:shadow-sm transition-all duration-200 cursor-pointer"
                    title={`Share via ${ch.name}`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 ${ch.badgeBg}`}>
                      <IconComponent />
                    </div>
                    <span className="text-[0.64rem] font-bold text-slate-700 group-hover:text-slate-900 truncate max-w-full leading-none mt-2">
                      {ch.name}
                    </span>
                  </a>
                );
              })}
            </div>
          </div>

          {/* Copy Direct Link Section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[0.68rem] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
                <Link2 size={12} className="text-slate-400" />
                <span>Property URL</span>
              </label>
              <span className="text-[0.65rem] font-medium text-slate-400">Shareable secure link</span>
            </div>

            <div className="flex items-center gap-2 bg-slate-50/80 border border-slate-200 rounded-xl p-1.5 focus-within:bg-white focus-within:border-blue-600 focus-within:ring-3 focus-within:ring-blue-100 transition-all">
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="flex-1 bg-transparent px-3 text-xs text-slate-700 outline-none truncate font-mono select-all"
                onClick={(e) => e.target.select()}
              />
              <button
                type="button"
                onClick={handleCopyLink}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold text-white transition-all duration-150 active:scale-95 cursor-pointer shadow-xs ${
                  copied
                    ? 'bg-emerald-600 shadow-emerald-500/20'
                    : 'bg-slate-900 hover:bg-slate-800 shadow-slate-900/10'
                }`}
              >
                {copied ? (
                  <>
                    <Check size={13} className="stroke-[2.5]" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy size={13} />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Trust Watermark */}
          <div className="pt-1 text-center">
            <p className="text-[0.65rem] text-slate-400 flex items-center justify-center gap-1 font-medium">
              <ShieldCheck size={11} className="text-emerald-500" />
              <span>Verified Listing on EstateXplorer Network · Direct Owner/Builder Connection</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShareModal;
