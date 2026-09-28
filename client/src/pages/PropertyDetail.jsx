import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useSearchParams, Link, useNavigate } from 'react-router-dom';
import {
  Bed,
  Maximize2,
  Building2,
  ShieldCheck,
  Camera,
  CalendarCheck,
  Home,
  CheckCircle2,
  X,
  MapPin,
  Mail,
  Calendar,
  Tag,
  Share2,
  Video,
  Play,
  Film,
  Calculator,
  Clock,
  AlertCircle,
  Copy,
  Check,
  Award,
} from 'lucide-react';
import { getProperty, submitInquiry, toggleWishlistApi, getUserWishlist, getMyInquiries, getBuyerInquiries } from '../services/propertyService';
import { getProjectPartnership } from '../services/partnershipService';
import { broadcastRealtimeSync, useRealtimeSync, SYNC_EVENTS } from '../utils/realtimeSync';
import { useAuth } from '../hooks/useAuth';
import Navbar from '../components/layout/Navbar';
import Footer from '../components/layout/Footer';
import Modal from '../components/common/Modal';
import ShareModal from '../components/common/ShareModal';
import LoginForm from '../components/auth/LoginForm';
import RegisterForm from '../components/auth/RegisterForm';
import ForgotForm from '../components/auth/ForgotForm';
import EmiCalculator from '../components/property/EmiCalculator';
import PropertyCompare from '../components/property/PropertyCompare';
import SimilarProperties from '../components/property/SimilarProperties';
import EmailVerificationModal from '../components/common/EmailVerificationModal';
import RequestSellingRightsModal from '../components/dashboard/RequestSellingRightsModal';
import { formatPrice, formatPhoneNumber, formatTitleCase, getPublicImageUrl, isVideoUrl, isValidIndianMobile } from '../utils/formatters';
import './PropertyDetail.css';

// ── Real-World Site Visit Time Slots & Coordination Helpers ──
export const SITE_VISIT_TIME_SLOTS = [
  {
    id: 'morning',
    value: 'Morning (10 AM - 1 PM)',
    label: '10:00 AM – 01:00 PM',
    period: 'Morning',
    timeRange: '10:00 AM – 01:00 PM',
    cutoffHour: 12, // Bookings close at 12:00 PM (1 hr before slot ends)
    cutoffMinute: 0,
  },
  {
    id: 'afternoon',
    value: 'Afternoon (1 PM - 4 PM)',
    label: '01:00 PM – 04:00 PM',
    period: 'Afternoon',
    timeRange: '01:00 PM – 04:00 PM',
    cutoffHour: 15, // Bookings close at 03:00 PM (1 hr before slot ends)
    cutoffMinute: 0,
  },
  {
    id: 'evening',
    value: 'Evening (4 PM - 7 PM)',
    label: '04:00 PM – 07:00 PM',
    period: 'Evening',
    timeRange: '04:00 PM – 07:00 PM',
    cutoffHour: 18, // Bookings close at 06:00 PM (1 hr before slot ends)
    cutoffMinute: 0,
  },
];

// Returns YYYY-MM-DD in user's local world time
export const getLocalYmd = (date = new Date()) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// Check if a specific time slot has passed its cutoff in actual world time for a given date
export const isSlotExpired = (slot, dateStr, now = new Date()) => {
  if (!dateStr) return false;
  const todayYmd = getLocalYmd(now);
  if (dateStr > todayYmd) return false; // Any future date is 100% available
  if (dateStr < todayYmd) return true;  // Past date is closed

  // For today, compare current world minutes with slot cutoff
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const cutoffMinutes = slot.cutoffHour * 60 + slot.cutoffMinute;
  return currentMinutes >= cutoffMinutes;
};

// Returns all non-expired slots for a given date string
export const getAvailableSlots = (dateStr, now = new Date()) => {
  return SITE_VISIT_TIME_SLOTS.filter(slot => !isSlotExpired(slot, dateStr, now));
};

// Determines the earliest date open for booking in real-world time
// If all slots today have concluded (after 6:00 PM cutoff), auto-advances to tomorrow
export const getEarliestBookableDate = (now = new Date()) => {
  const todayYmd = getLocalYmd(now);
  const slotsToday = getAvailableSlots(todayYmd, now);
  if (slotsToday.length > 0) {
    return todayYmd;
  }
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return getLocalYmd(tomorrow);
};

// Maximum bookable date (60 days into future)
export const getMaxBookableDate = (now = new Date(), daysAhead = 60) => {
  const maxDate = new Date(now);
  maxDate.setDate(maxDate.getDate() + daysAhead);
  return getLocalYmd(maxDate);
};

// Returns human-friendly readable date (e.g. "Tomorrow · Fri, 25 Sep 2026")
export const formatDisplayDate = (dateStr, now = new Date()) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3) return dateStr;
  const targetDate = new Date(parts[0], parts[1] - 1, parts[2]);
  const todayYmd = getLocalYmd(now);
  const tomorrowObj = new Date(now);
  tomorrowObj.setDate(tomorrowObj.getDate() + 1);
  const tomorrowYmd = getLocalYmd(tomorrowObj);

  let prefix = '';
  if (dateStr === todayYmd) prefix = 'Today · ';
  else if (dateStr === tomorrowYmd) prefix = 'Tomorrow · ';

  const formatted = targetDate.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  return `${prefix}${formatted}`;
};

const PropertyDetail = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, showToast } = useAuth();

  // Channel Partner Attribution Code capture & retention
  const agentParam = searchParams.get('agent');
  useEffect(() => {
    if (agentParam) {
      sessionStorage.setItem(`cp_agent_${id}`, agentParam.trim().toUpperCase());
    }
  }, [agentParam, id]);

  const [property, setProperty] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeImg, setActiveImg] = useState(0);
  const [wishlisted, setWishlisted] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [inquiryOpen, setInquiryOpen] = useState(false);
  const [verifyModalOpen, setVerifyModalOpen] = useState(false);
  const [inquiryMode, setInquiryMode] = useState('inquiry'); // 'inquiry' | 'visit'
  const [inquirySuccess, setInquirySuccess] = useState(false);
  const [inquiryError, setInquiryError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [authModalState, setAuthModalState] = useState(null); // 'login' | 'register' | 'forgot' | null
  const [authModalEmail, setAuthModalEmail] = useState('');
  const [form, setForm] = useState(() => {
    const initialDate = getEarliestBookableDate();
    const availableSlots = getAvailableSlots(initialDate);
    return {
      name: '',
      phone: '',
      email: '',
      message: '',
      visitDate: initialDate,
      visitTime: availableSlots[0]?.value || 'Morning (10 AM - 1 PM)',
    };
  });
  const [visitBooked, setVisitBooked] = useState(false);
  const [activeVisitData, setActiveVisitData] = useState(null);
  // Per-property pending inquiry lock — true if user has an unanswered inquiry for this property within 7 days
  const [hasPendingInquiry, setHasPendingInquiry] = useState(false);


  // CP Selling Rights / Agent Acquisition State
  const [isRequestRightsOpen, setIsRequestRightsOpen] = useState(false);
  const [agentPartnership, setAgentPartnership] = useState(null);
  const [copiedAffiliateLink, setCopiedAffiliateLink] = useState(false);

  const fetchAgentPartnershipStatus = useCallback(async () => {
    if (user?.role === 'agent' && id) {
      try {
        const res = await getProjectPartnership(id);
        if (res.success && res.data) {
          setAgentPartnership(res.data);
        } else {
          setAgentPartnership(null);
        }
      } catch (err) {
        setAgentPartnership(null);
      }
    }
  }, [user, id]);

  useEffect(() => {
    fetchAgentPartnershipStatus();
  }, [fetchAgentPartnershipStatus]);

  // Top-level unconditional hooks
  const isOwner = useMemo(() => {
    if (!user || !property || !property.builder) return false;
    const currentUserId = String(user.id || user._id || '');
    if (!currentUserId) return false;

    if (typeof property.builder === 'string') {
      return property.builder === currentUserId;
    }
    if (typeof property.builder === 'object') {
      const builderId = String(property.builder.id || property.builder._id || '');
      return builderId === currentUserId;
    }
    return false;
  }, [user, property]);

  // Admin users must not see or interact with the inquiry system at all
  const isAdmin = user?.role === 'admin';

  const userDashboardRoute = '/dashboard';

  const locationStr = useMemo(() => {
    if (!property || !property.location) return '';
    if (typeof property.location === 'string') {
      const parts = property.location.split(',').map((s) => s.trim()).filter(Boolean);
      const deduped = parts.filter((part, idx) => parts.indexOf(part) === idx);
      return deduped.join(', ');
    }
    const addr = (property.location.address || '').trim();
    const city = (property.location.city || '').trim();
    if (addr && city && addr.toLowerCase().endsWith(city.toLowerCase())) {
      return addr;
    }
    return [addr, city].filter(Boolean).join(', ');
  }, [property]);

  const images = useMemo(() => {
    if (!property) return ['https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=1200&auto=format&fit=crop'];
    const rawList = property.images && Array.isArray(property.images) && property.images.length > 0
      ? property.images
      : (property.image ? [property.image] : (property.img ? [property.img] : []));
    const valid = rawList
      .filter(img => typeof img === 'string' && img.trim() !== '')
      .map(img => getPublicImageUrl(img));
    return valid.length > 0
      ? valid
      : ['https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=1200&auto=format&fit=crop'];
  }, [property]);

  useEffect(() => {
    if (user) {
      setForm(f => ({ ...f, name: user.name || '', email: user.email || '' }));
      getUserWishlist()
        .then(res => {
          if (res.success && Array.isArray(res.data)) {
            setWishlisted(res.data.includes(id));
          }
        })
        .catch(() => {});
    }
  }, [user, id]);

  // Check if user already booked a visit OR has an unanswered pending inquiry for this property
  useEffect(() => {
    if (!user || !id) { setVisitBooked(false); setHasPendingInquiry(false); return; }
    // Instant check from localStorage
    try {
      const stored = JSON.parse(localStorage.getItem('myInquiries') || '[]');
      if (stored.some(inq => String(inq.id) === String(id) && inq.status === 'Site Visit Requested')) {
        setVisitBooked(true);
      }
    } catch {}
    // Authoritative check from API — detect visit booking AND pending inquiry for this property
    getBuyerInquiries()
      .then(res => {
        if (res?.success && Array.isArray(res.data)) {
          const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          const myPropertyInquiries = res.data.filter(
            inq => String(inq.property?._id || inq.property) === String(id)
          );
          // Check visit booking: ONLY for visitRequested === true and not rejected/closed
          const activeVisit = myPropertyInquiries.find(
            inq => inq.visitRequested === true && inq.status !== 'rejected' && inq.status !== 'closed'
          );
          setVisitBooked(Boolean(activeVisit));
          setActiveVisitData(activeVisit || null);

          // Check pending general inquiry within 7-day window: ONLY for general inquiries (!visitRequested)
          const pendingInquiry = myPropertyInquiries.some(
            inq =>
              !inq.visitRequested &&
              inq.status === 'new' &&
              new Date(inq.createdAt) > sevenDaysAgo
          );
          setHasPendingInquiry(pendingInquiry);
        }
      })
      .catch(() => {});
  }, [user, id]);


  useEffect(() => {
    const load = async () => {
      if (!id) return;
      setLoading(true);
      setError('');

      // Fetch directly from live MongoDB database
      try {
        const res = await getProperty(id);
        if (res.success && res.data) {
          setProperty(res.data);
          // Track recently viewed for Buyer
          try {
            const viewedItem = {
              id: res.data._id || id,
              name: res.data.title || res.data.name || 'Property',
              category: res.data.category || 'property',
              type: res.data.type || '',
              bhk: res.data.bhk || 0,
              city: res.data.location?.city || '',
              location: typeof res.data.location === 'string'
                ? res.data.location
                : [res.data.location?.address, res.data.location?.city].filter(Boolean).join(', '),
              price: res.data.price,
              priceDisplay: res.data.priceDisplay,
              img: (res.data.images && res.data.images[0]) || res.data.image || res.data.img || 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=600&auto=format&fit=crop',
              viewedAt: new Date().toISOString()
            };
            const currentRecent = JSON.parse(localStorage.getItem('recentlyViewed') || '[]');
            const filtered = currentRecent.filter(item => String(item.id) !== String(viewedItem.id));
            const updated = [viewedItem, ...filtered].slice(0, 10);
            localStorage.setItem('recentlyViewed', JSON.stringify(updated));
            broadcastRealtimeSync(SYNC_EVENTS.PROPERTIES, { action: 'recent_view', propertyId: viewedItem.id });
          } catch (e) {
            console.error('Error saving recently viewed:', e);
          }
        } else {
          setError('Property not found or has been removed.');
        }
      } catch (err) {
        setError('Property not found or has been removed.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);


  const syncWishlistState = () => {
    if (user) {
      const saved = JSON.parse(localStorage.getItem('wishlist') || '[]');
      setWishlisted(saved.includes(id));
    } else {
      setWishlisted(false);
    }
  };

  useEffect(() => {
    syncWishlistState();
  }, [id, user]);

  // Real-time synchronization for cross-tab wishlist changes
  useRealtimeSync(
    [SYNC_EVENTS.WISHLIST],
    () => {
      syncWishlistState();
    },
    { revalidateOnFocus: true }
  );

  const toggleWishlist = async () => {
    if (!user) {
      if (showToast) showToast('Please sign in to save properties to your wishlist.', 'error');
      setAuthModalState('login');
      return;
    }

    const saved = JSON.parse(localStorage.getItem('wishlist') || '[]');
    const nextState = !wishlisted;
    const updated = wishlisted ? saved.filter(x => x !== id) : [...saved, id];
    localStorage.setItem('wishlist', JSON.stringify(updated));
    setWishlisted(nextState);

    broadcastRealtimeSync(SYNC_EVENTS.WISHLIST, { action: nextState ? 'added' : 'removed', id });

    try {
      await toggleWishlistApi(id);
      if (showToast) {
        showToast(nextState ? 'Property saved to your wishlist!' : 'Removed from wishlist', 'success');
      }
    } catch (err) {
      console.error('Wishlist sync error:', err);
    }
  };

  const handleOpenInquiry = (mode = 'inquiry') => {
    if (!user) {
      if (showToast) {
        showToast(
          mode === 'visit'
            ? 'Please log in to schedule and book a site visit.'
            : 'Please log in to send inquiries and connect with builders.',
          'info'
        );
      }
      setAuthModalState('login');
      return;
    }

    // Strictly require email verification for site visits and inquiries
    if (!user.isVerified) {
      setInquiryMode(mode);
      setVerifyModalOpen(true);
      return;
    }

    setInquiryMode(mode);
    setInquiryError('');

    if (mode === 'visit') {
      const now = new Date();
      const earliest = getEarliestBookableDate(now);
      const available = getAvailableSlots(earliest, now);
      const defaultSlot = available[0]?.value || 'Morning (10 AM - 1 PM)';
      setForm(f => {
        const currentDateValid = f.visitDate && f.visitDate >= earliest;
        const targetDate = currentDateValid ? f.visitDate : earliest;
        const availableForTarget = getAvailableSlots(targetDate, now);
        const currentSlotValid = availableForTarget.some(s => s.value === f.visitTime);
        return {
          ...f,
          visitDate: targetDate,
          visitTime: currentSlotValid ? f.visitTime : (availableForTarget[0]?.value || defaultSlot),
          message: f.message || `I would like to schedule a site visit for ${property?.title || property?.name || 'this property'}. Please confirm the available slots.`
        };
      });
    } else {
      if (!form.message) {
        setForm(f => ({
          ...f,
          message: `I am interested in ${property?.title || property?.name || 'this property'}. Please share more details.`
        }));
      }
    }

    setInquiryOpen(true);
  };

  const handleDateChange = (e) => {
    const selectedDate = e.target.value;
    const now = new Date();
    const minAllowed = getEarliestBookableDate(now);
    const availableSlots = getAvailableSlots(selectedDate, now);

    setForm(f => {
      const isCurrentSlotValid = availableSlots.some(s => s.value === f.visitTime);
      return {
        ...f,
        visitDate: selectedDate,
        visitTime: isCurrentSlotValid ? f.visitTime : (availableSlots[0]?.value || ''),
      };
    });

    if (selectedDate < minAllowed) {
      setInquiryError(`Selected visit date (${selectedDate}) has passed. Earliest available date is ${minAllowed}.`);
    } else if (availableSlots.length === 0) {
      setInquiryError('All visit slots for the selected date are closed. Please select a future date.');
    } else {
      setInquiryError('');
    }
  };

  const handleInquiry = async (e) => {
    e.preventDefault();
    if (!user) {
      if (showToast) showToast('Please log in to submit inquiries or book visits.', 'info');
      setInquiryOpen(false);
      setAuthModalState('login');
      return;
    }

    // Strictly require email verification
    if (!user.isVerified) {
      setInquiryError('Email verification required. Please verify your email address to book site visits or submit property inquiries.');
      setInquiryOpen(false);
      setVerifyModalOpen(true);
      return;
    }

    // Mandatory: Your Name (at least 3 characters)
    const nameClean = (form.name || '').trim();
    if (!nameClean || nameClean.length < 3) {
      const msg = 'Please enter your full name (minimum 3 characters).';
      setInquiryError(msg);
      if (showToast) showToast(msg, 'error');
      return;
    }

    // Mandatory: Valid 10-digit mobile number starting with 6, 7, 8, or 9
    const phoneClean = (form.phone || '').trim();
    if (!phoneClean || !isValidIndianMobile(phoneClean)) {
      const msg = 'Please enter a valid 10-digit mobile number starting with 6, 7, 8, or 9.';
      setInquiryError(msg);
      if (showToast) showToast(msg, 'error');
      return;
    }

    // Mandatory: Valid Email Address
    const emailClean = (form.email || '').trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailClean || !emailRegex.test(emailClean)) {
      const msg = 'Please enter a valid email address.';
      setInquiryError(msg);
      if (showToast) showToast(msg, 'error');
      return;
    }

    const atIndex = emailClean.lastIndexOf('@');
    if (atIndex > 0) {
      const domain = emailClean.substring(atIndex + 1);
      const suspiciousKws = ['temp', 'burner', 'dispos', 'throwaway', 'fake', 'guerrilla', '10min', 'mailinator', 'trash'];
      if (suspiciousKws.some(kw => domain.includes(kw))) {
        const msg = 'Access Blocked: Temporary or disposable email addresses are not allowed. Please enter a valid email address.';
        setInquiryError(msg);
        if (showToast) showToast(msg, 'error');
        return;
      }
    }

    // If site visit mode, strictly validate coordinated date and time slot
    if (inquiryMode === 'visit') {
      const now = new Date();
      const minDate = getEarliestBookableDate(now);
      if (!form.visitDate) {
        const msg = 'Please select a preferred visit date.';
        setInquiryError(msg);
        if (showToast) showToast(msg, 'error');
        return;
      }
      if (form.visitDate < minDate) {
        const msg = `Selected visit date (${form.visitDate}) is not available. Earliest bookable date is ${minDate}.`;
        setInquiryError(msg);
        if (showToast) showToast(msg, 'error');
        return;
      }
      if (!form.visitTime) {
        const msg = 'Please select a preferred time slot.';
        setInquiryError(msg);
        if (showToast) showToast(msg, 'error');
        return;
      }
      const targetSlot = SITE_VISIT_TIME_SLOTS.find(s => s.value === form.visitTime);
      if (targetSlot && isSlotExpired(targetSlot, form.visitDate, now)) {
        const msg = form.visitDate === getLocalYmd(now)
          ? `The ${targetSlot.period} time slot (${targetSlot.timeRange}) for today has already passed. Please select an open slot or choose a future date.`
          : 'The selected time slot is not available for this date. Please choose an open slot.';
        setInquiryError(msg);
        if (showToast) showToast(msg, 'error');
        return;
      }
    }

    // Mandatory: Message (minimum 10 characters)
    const msgClean = (form.message || '').trim();
    if (!msgClean || msgClean.length < 10) {
      const msg = 'Please enter a message (minimum 10 characters).';
      setInquiryError(msg);
      if (showToast) showToast(msg, 'error');
      return;
    }

    setInquiryError('');

    setSubmitting(true);
    try {
      const isVisit = inquiryMode === 'visit';
      const loc = typeof property.location === 'string'
        ? property.location
        : `${property.location?.address || ''}, ${property.location?.city || ''}`;
      const bName = typeof property.builder === 'object' ? property.builder?.name : 'Property Representative';

      const storedAgentCode = sessionStorage.getItem(`cp_agent_${id}`) || agentParam || '';

      const payload = {
        ...form,
        name: formatTitleCase(form.name),
        phone: formatPhoneNumber(form.phone),
        email: emailClean,
        message: form.message ? form.message.trim() : '',
        visitRequested: isVisit,
        propertyTitle: property.title || property.name,
        propertyType: property.type,
        propertyLocation: loc,
        propertyImage: property.images?.[0] || property.img || '',
        builderName: bName,
        agentCode: storedAgentCode || undefined,
      };

      await submitInquiry(id, payload);

      // Save inquiry to localStorage for Buyer Dashboard sync
      const myInquiries = JSON.parse(localStorage.getItem('myInquiries') || '[]');
      if (!myInquiries.some(inq => inq.id === id)) {
        myInquiries.unshift({
          id,
          name: property.title || property.name,
          type: property.type,
          builder: bName,
          location: loc,
          img: property.images?.[0] || property.img || 'https://via.placeholder.com/600',
          date: new Date().toISOString(),
          status: isVisit ? 'Site Visit Requested' : 'Awaiting Reply'
        });
        localStorage.setItem('myInquiries', JSON.stringify(myInquiries));
      }

      broadcastRealtimeSync(SYNC_EVENTS.INQUIRIES, { action: 'submitted', propertyId: id, visit: isVisit });

      setInquirySuccess(true);
      if (isVisit) {
        setVisitBooked(true);
      } else {
        setHasPendingInquiry(true);
      }
      if (showToast) {
        showToast(isVisit ? 'Site visit request submitted!' : 'Inquiry sent successfully!', 'success');
      }
      setTimeout(() => { setInquiryOpen(false); setInquirySuccess(false); }, 2500);
    } catch (err) {
      const errMsg = err.response?.data?.message || err.message || 'Failed to submit. Please try again.';
      setInquiryError(errMsg);
      if (err.response?.data?.requiresEmailVerification) {
        setInquiryOpen(false);
        setVerifyModalOpen(true);
      }
      if (showToast) showToast(errMsg, 'error');
      else alert(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="pd-loading">
        <div className="pd-spinner"></div>
        <p>Loading property details…</p>
      </div>
    );
  }

  if (error || !property) {
    return (
      <div className="pd-error-state">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center mx-auto mb-4">
          <Home size={32} />
        </div>
        <h2>{error || 'Property not found'}</h2>
        <button onClick={() => navigate('/listings')} className="pd-back-btn">← Back to Listings</button>
      </div>
    );
  }

  const safeActiveImg = activeImg < images.length ? activeImg : 0;

  const builder = property.builder || {};
  const builderName = typeof builder === 'object' ? (builder.name || 'Unknown Builder') : 'Unknown Builder';
  const builderPhone = typeof builder === 'object' ? (builder.phone || '') : '';
  const builderEmail = typeof builder === 'object' ? (builder.email || '') : '';
  const builderCompany = typeof builder === 'object' ? (builder.builderProfile?.companyName || '') : '';

  return (
    <div className="pd-page">
      {/* Global Standard Navbar */}
      <Navbar
        solid={true}
        onOpenLogin={() => setAuthModalState('login')}
        onOpenRegister={() => setAuthModalState('register')}
      />

      <div style={{ paddingTop: '70px' }}>
        {/* ── Sticky Sub-Header ── */}
        <header className="pd-header">
        <div className="pd-header-inner">
          <button className="pd-back" onClick={() => navigate('/listings')}>
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M19 12H5M12 5l-7 7 7 7"/>
            </svg>
            Back to Listings
          </button>
          <div className="pd-header-actions">
            {!isOwner && (
              <button className={`pd-wish-btn ${wishlisted ? 'active' : ''}`} onClick={toggleWishlist}>
                <svg width="18" height="18" fill={wishlisted ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
                </svg>
                {wishlisted ? 'Saved' : 'Save'}
              </button>
            )}
            <button
              type="button"
              className="pd-share-btn"
              onClick={() => setShareOpen(true)}
              title="Share property details"
            >
              <Share2 size={16} />
              <span>Share</span>
            </button>
            {!isOwner && !isAdmin && (
              hasPendingInquiry ? (
                <button
                  className="pd-inquiry-btn"
                  disabled
                  style={{ opacity: 0.55, cursor: 'not-allowed' }}
                  title="You already have a pending inquiry for this property. Wait for a response or 7 days."
                >
                  <Mail size={16} />
                  Inquiry Pending
                </button>
              ) : (
                <button
                  className="pd-inquiry-btn"
                  onClick={() => handleOpenInquiry('inquiry')}
                >
                  <Mail size={16} />
                  Send Inquiry
                </button>
              )
            )}


          </div>
        </div>
      </header>

      <main className="pd-main">
        {/* ── Gallery ── */}
        <section className="pd-gallery">
          <div className="pd-gallery-main">
            {isVideoUrl(images[safeActiveImg] || images[0]) ? (
              <video
                src={images[safeActiveImg] || images[0]}
                controls
                autoPlay
                muted
                playsInline
                className="w-full h-full object-contain bg-slate-950"
              />
            ) : (
              <img
                src={images[safeActiveImg] || images[0]}
                alt={property.title || property.name}
                onError={(e) => {
                  e.currentTarget.src = 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=1200&auto=format&fit=crop';
                }}
              />
            )}
            {property.rera && (
              <span className="pd-rera-badge">
                <ShieldCheck size={14} />
                RERA Registered
              </span>
            )}
            {images.length > 1 && (
              <>
                <button
                  className="pd-nav pd-nav-prev"
                  type="button"
                  onClick={() => setActiveImg(i => (i - 1 + images.length) % images.length)}
                >
                  ‹
                </button>
                <button
                  className="pd-nav pd-nav-next"
                  type="button"
                  onClick={() => setActiveImg(i => (i + 1) % images.length)}
                >
                  ›
                </button>
              </>
            )}
            <div className="pd-photo-count flex items-center gap-1.5">
              {(() => {
                const vidCount = images.filter(img => isVideoUrl(img)).length;
                const picCount = Math.max(0, images.length - vidCount);
                if (vidCount > 0 && picCount > 0) {
                  return (
                    <div className="flex items-center gap-1.5">
                      <span className="inline-flex items-center gap-1">
                        <Camera size={13} />
                        <span>{picCount} Photo{picCount !== 1 ? 's' : ''}</span>
                      </span>
                      <span className="opacity-50">·</span>
                      <span className="inline-flex items-center gap-1">
                        <Video size={13} />
                        <span>{vidCount} Video{vidCount !== 1 ? 's' : ''}</span>
                      </span>
                    </div>
                  );
                }
                if (vidCount > 0) {
                  return (
                    <span className="inline-flex items-center gap-1">
                      <Video size={13} />
                      <span>{vidCount} Video{vidCount !== 1 ? 's' : ''}</span>
                    </span>
                  );
                }
                return (
                  <span className="inline-flex items-center gap-1">
                    <Camera size={13} />
                    <span>{picCount || 1} Photo{picCount !== 1 ? 's' : ''}</span>
                  </span>
                );
              })()}
            </div>
          </div>
          {images.length > 1 && (
            <div className="pd-thumbs">
              {images.map((img, i) => {
                const isVid = isVideoUrl(img);
                return (
                  <button
                    key={i}
                    className={`pd-thumb ${i === safeActiveImg ? 'active' : ''} relative overflow-hidden`}
                    onClick={() => setActiveImg(i)}
                    type="button"
                  >
                    {isVid ? (
                      <div className="w-full h-full bg-slate-900 flex items-center justify-center relative">
                        <video src={img} preload="metadata" className="w-full h-full object-cover opacity-75" />
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <Play size={12} className="text-white fill-white" />
                        </div>
                      </div>
                    ) : (
                      <img
                        src={img}
                        alt={`Media ${i + 1}`}
                        onError={(e) => {
                          e.currentTarget.src = 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=600&auto=format&fit=crop';
                        }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* ── Content Grid ── */}
        <div className="pd-content-grid">

          {/* ── LEFT: Details ── */}
          <div className="pd-details">

            <div className="pd-card pd-title-card">
              <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`px-2.5 py-0.5 rounded text-xs font-semibold uppercase tracking-wide ${
                      property.purpose === 'rent'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-800 text-white'
                    }`}
                  >
                    {property.purpose === 'rent' ? 'For Rent' : 'For Sale'}
                  </span>

                  {property.type && (
                    <span className="px-2.5 py-0.5 rounded text-xs text-slate-700 bg-slate-100 border border-slate-200">
                      {property.type}
                    </span>
                  )}

                  {(property.statusLabel || property.status) && (
                    <span
                      className={`px-2.5 py-0.5 rounded text-xs border ${
                        property.status === 'ready' || property.ready
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-amber-50 text-amber-800 border-amber-200'
                      }`}
                    >
                      {property.statusLabel || (property.status === 'ready' ? 'Ready to Move' : 'Under Construction')}
                    </span>
                  )}

                  {property.rera && (
                    <span className="px-2.5 py-0.5 rounded text-xs bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                      <ShieldCheck size={12} className="text-emerald-600" />
                      <span>RERA Registered</span>
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setShareOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200/80 transition-all cursor-pointer shadow-2xs"
                  title="Share Property"
                >
                  <Share2 size={13} className="text-slate-600" />
                  <span>Share Listing</span>
                </button>
              </div>

              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 leading-snug mb-1.5">
                {property.title || property.name}
              </h1>

              <p className="text-sm text-slate-500 flex items-center gap-1.5 mb-3.5 font-normal">
                <MapPin size={14} className="text-slate-400 shrink-0" />
                <span>{locationStr}</span>
              </p>

              <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xl sm:text-2xl font-bold text-blue-600">
                    {formatPrice(property.price, property.priceDisplay, property.purpose)}
                  </span>
                  {property.purpose === 'rent' && (
                    <span className="text-xs text-slate-500">/ month</span>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {(property.priceSub || (property.price > 0 && property.area > 0 ? `₹ ${Math.round(property.price / property.area).toLocaleString('en-IN')} / Sq.Ft` : '')) && (
                    <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200/60">
                      {property.priceSub || `₹ ${Math.round(property.price / property.area).toLocaleString('en-IN')} / Sq.Ft`}
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      document.getElementById('emi-calculator')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-blue-600 bg-slate-100 hover:bg-slate-200/80 px-2.5 py-1 rounded-md border border-slate-200/80 transition-all cursor-pointer shadow-2xs"
                    title="Calculate Home Loan EMI"
                  >
                    <Calculator size={13} className="text-amber-500" />
                    <span>Calculate EMI</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Overview Grid */}
            <div className="pd-card pd-overview-card">
              <div className="flex items-center justify-between pb-3 border-b border-border mb-4">
                <h2 className="pd-section-title !mb-0 !pb-0 !border-none">Property Overview</h2>
                <span className="text-xs text-muted font-medium">Quick Specifications</span>
              </div>
              <div className="pd-overview-grid">
                {property.bhk ? (
                  <div className="pd-ov-item">
                    <div className="pd-ov-icon-box bg-blue-50 text-blue-600 border border-blue-100">
                      <Bed size={20} />
                    </div>
                    <div className="pd-ov-content">
                      <span className="pd-ov-label">Bedrooms</span>
                      <strong className="pd-ov-val">{property.bhk} BHK Configuration</strong>
                    </div>
                  </div>
                ) : null}

                {property.area ? (
                  <div className="pd-ov-item">
                    <div className="pd-ov-icon-box bg-amber-50 text-amber-600 border border-amber-100">
                      <Maximize2 size={20} />
                    </div>
                    <div className="pd-ov-content">
                      <span className="pd-ov-label">Carpet Area</span>
                      <strong className="pd-ov-val">{Number(property.area).toLocaleString()} sq.ft</strong>
                    </div>
                  </div>
                ) : null}

                <div className="pd-ov-item">
                  <div className="pd-ov-icon-box bg-indigo-50 text-indigo-600 border border-indigo-100">
                    <Building2 size={20} />
                  </div>
                  <div className="pd-ov-content">
                    <span className="pd-ov-label">Property Type</span>
                    <strong className="pd-ov-val">{property.type || 'Residential'}</strong>
                  </div>
                </div>

                <div className="pd-ov-item">
                  <div className="pd-ov-icon-box bg-emerald-50 text-emerald-600 border border-emerald-100">
                    <Calendar size={20} />
                  </div>
                  <div className="pd-ov-content">
                    <span className="pd-ov-label">Possession</span>
                    <strong className="pd-ov-val">{property.statusDate || (property.status === 'ready' ? 'Ready to Move' : 'Under Construction')}</strong>
                  </div>
                </div>

                <div className="pd-ov-item">
                  <div className="pd-ov-icon-box bg-purple-50 text-purple-600 border border-purple-100">
                    <Tag size={20} />
                  </div>
                  <div className="pd-ov-content">
                    <span className="pd-ov-label">Listing Purpose</span>
                    <strong className="pd-ov-val">{property.purpose === 'rent' ? 'For Rent (Lease)' : 'For Sale (Ownership)'}</strong>
                  </div>
                </div>

                <div className="pd-ov-item">
                  <div className="pd-ov-icon-box bg-teal-50 text-teal-600 border border-teal-100">
                    <ShieldCheck size={20} />
                  </div>
                  <div className="pd-ov-content">
                    <span className="pd-ov-label">RERA Registration</span>
                    <strong className="pd-ov-val">{property.rera ? (property.reraId || 'RERA Approved') : 'Verified Listing'}</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Description */}
            {property.description && (
              <div className="pd-card">
                <h2 className="pd-section-title">About this Property</h2>
                <p className="pd-description">{property.description}</p>
              </div>
            )}

            {/* Key Highlights */}
            {property.usps && property.usps.length > 0 && (
              <div className="pd-card">
                <div className="flex items-center justify-between pb-3 border-b border-border mb-4">
                  <h2 className="pd-section-title !mb-0 !pb-0 !border-none">Key Highlights</h2>
                  <span className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full font-bold">
                    {property.usps.length} Highlights
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {property.usps.map((usp, i) => (
                    <div
                      key={i}
                      className="p-3 bg-emerald-50/50 hover:bg-emerald-50/80 border border-emerald-200/80 rounded-xl flex items-start gap-2.5 text-xs sm:text-sm font-medium text-slate-800 transition-colors"
                    >
                      <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                      <span className="leading-snug">{usp}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Amenities */}
            {property.amenities && property.amenities.length > 0 && (
              <div className="pd-card">
                <h2 className="pd-section-title">Amenities</h2>
                <div className="pd-amenities">
                  {property.amenities.map((a, i) => (
                    <span key={i} className="pd-amenity">{a}</span>
                  ))}
                </div>
              </div>
            )}

            {/* ── Mortgage & Home Loan EMI Calculator ── */}
            <EmiCalculator property={property} />

            {/* ── Property / Project Comparison Matrix ── */}
            <PropertyCompare currentProperty={property} />
          </div>

          {/* ── RIGHT: Sidebar ── */}
          <aside className="pd-sidebar space-y-4">

            {/* Builder Card */}
            <div className={`pd-card pd-builder-card ${isOwner ? '!border-blue-200 !bg-blue-50/40' : ''}`}>
              <div className={`pd-builder-avatar ${isOwner ? '!bg-blue-600 !text-white' : ''}`}>
                {builderName.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="pd-builder-label">
                  {isOwner ? 'Your Listing' : 'Listed by'}
                </div>
                <div className="pd-builder-name">{builderName}</div>
                {builderCompany && <div className="pd-builder-company">{builderCompany}</div>}
              </div>
            </div>

            {/* Agent-Builder Project Acquisition Workflow Card */}
            {user?.role === 'agent' && !isOwner && (property.category === 'project' || property.isProject) && (
              <div className="pd-card border border-blue-200 bg-gradient-to-br from-blue-50/90 via-indigo-50/50 to-white p-5 rounded-2xl shadow-xs text-left">
                <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-blue-100">
                  <div className="flex items-center gap-2 text-blue-950 font-bold text-sm">
                    <ShieldCheck size={18} className="text-blue-600" />
                    <span>Become an Agent for This Project</span>
                  </div>
                  {(!property.allowAgentAcquisition && !property.networkEnabled) ? (
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                      Acquisition Closed
                    </span>
                  ) : agentPartnership?.status === 'pending' ? (
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                      Pending Approval
                    </span>
                  ) : (agentPartnership?.status === 'approved' || agentPartnership?.status === 'accepted') ? (
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                      Already Affiliated
                    </span>
                  ) : agentPartnership?.status === 'rejected' ? (
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300">
                      Request Rejected
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                      Acquisition Open
                    </span>
                  )}
                </div>

                {(!property.allowAgentAcquisition && !property.networkEnabled) ? (
                  <div className="space-y-2">
                    <p className="text-xs text-slate-500 leading-relaxed">
                      The builder has currently disabled agent acquisition for this project. Check back later or explore other partner-ready projects.
                    </p>
                    <Link
                      to="/dashboard?tab=find-projects"
                      className="inline-flex items-center justify-center w-full py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-all"
                    >
                      Browse Available Projects
                    </Link>
                  </div>
                ) : agentPartnership?.status === 'pending' ? (
                  <div className="space-y-3">
                    <div className="flex items-start gap-2 p-2.5 bg-amber-50/80 rounded-xl border border-amber-200 text-amber-900 text-xs">
                      <Clock size={16} className="shrink-0 mt-0.5 text-amber-600" />
                      <div>
                        <strong className="block font-semibold">Request Sent — Pending Approval</strong>
                        <span>Your acquisition request has been sent to {property.builder?.companyName || property.builder?.name || 'the builder'} and is awaiting review.</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled
                      className="w-full py-2 px-3 bg-amber-100 text-amber-800 font-semibold text-xs rounded-xl border border-amber-300 flex items-center justify-center gap-1.5 cursor-not-allowed opacity-90"
                    >
                      <Clock size={14} />
                      <span>Request Already Sent (Pending)</span>
                    </button>
                  </div>
                ) : (agentPartnership?.status === 'approved' || agentPartnership?.status === 'accepted') ? (
                  <div className="space-y-3">
                    <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-900 text-xs">
                      <div className="flex items-center gap-1.5 font-bold mb-1">
                        <CheckCircle2 size={15} className="text-emerald-600" />
                        <span>You are an authorized agent for this project!</span>
                      </div>
                      <p className="text-[11px] text-emerald-800 leading-relaxed">
                        Earn up to <strong>{property.defaultCommissionRate || 2}% commission</strong> on verified bookings. Share your unique referral link to capture buyer leads directly:
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-700 block">
                        Your Exclusive Referral Link:
                      </label>
                      <div className="flex items-center gap-1.5 bg-white p-1.5 pl-2.5 rounded-xl border border-slate-300 shadow-xs">
                        <input
                          type="text"
                          readOnly
                          value={agentPartnership.affiliateUrl || `${window.location.origin}/property/${property._id || property.id}?agent=${agentPartnership.affiliateCode || user.agentCode || user._id || user.id}`}
                          className="w-full bg-transparent text-[11px] text-slate-700 select-all outline-hidden font-mono truncate"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const link = agentPartnership.affiliateUrl || `${window.location.origin}/property/${property._id || property.id}?agent=${agentPartnership.affiliateCode || user.agentCode || user._id || user.id}`;
                            navigator.clipboard.writeText(link);
                            setCopiedAffiliateLink(true);
                            setTimeout(() => setCopiedAffiliateLink(false), 2200);
                            if (showToast) showToast('Affiliate tracking link copied to clipboard!', 'success');
                          }}
                          className={`shrink-0 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                            copiedAffiliateLink
                              ? 'bg-emerald-600 text-white'
                              : 'bg-blue-600 hover:bg-blue-700 text-white'
                          }`}
                        >
                          {copiedAffiliateLink ? <Check size={13} /> : <Copy size={13} />}
                          <span>{copiedAffiliateLink ? 'Copied!' : 'Copy Link'}</span>
                        </button>
                      </div>
                    </div>

                    <Link
                      to="/dashboard?tab=affiliations"
                      className="inline-flex items-center justify-center w-full py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-all"
                    >
                      View in My Affiliations
                    </Link>
                  </div>
                ) : agentPartnership?.status === 'rejected' ? (
                  <div className="space-y-3">
                    <div className="p-2.5 bg-rose-50 rounded-xl border border-rose-200 text-rose-900 text-xs">
                      <div className="flex items-center gap-1.5 font-bold mb-1">
                        <AlertCircle size={15} className="text-rose-600" />
                        <span>Request Rejected</span>
                      </div>
                      <p className="text-[11px] text-rose-800 leading-relaxed">
                        {agentPartnership.rejectionReason
                          ? `Reason from builder: "${agentPartnership.rejectionReason}". You may revise your pitch and re-apply.`
                          : 'The builder declined your request. You can submit updated portfolio details and apply again.'}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsRequestRightsOpen(true)}
                      className="w-full py-2 px-3 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      <ShieldCheck size={14} />
                      <span>Apply Again</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Earn up to <strong>{property.defaultCommissionRate || 2}% commission</strong> on every verified booking for this project. Apply for authorized selling rights to receive your exclusive client tracking URL.
                    </p>
                    <button
                      type="button"
                      onClick={() => setIsRequestRightsOpen(true)}
                      className="w-full py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      <ShieldCheck size={15} />
                      <span>Request to Become Agent</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Owner Management or Buyer Inquiry CTA — hidden from admin */}
            {!isAdmin && (isOwner ? (
              <div className="pd-card border border-blue-200/80 bg-blue-50/70 p-5 rounded-2xl shadow-xs text-left">
                <div className="flex items-center gap-2 mb-2 text-blue-900 font-bold text-sm">
                  <Building2 size={18} className="text-blue-600" />
                  <span>Owner Listing Controls</span>
                </div>
                <p className="text-xs text-slate-600 mb-4 leading-relaxed">
                  You created and own this property. Inquiries and site visits sent by prospective buyers are delivered straight to your dashboard.
                </p>
                <Link
                  to={userDashboardRoute}
                  className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-2 transition-all"
                >
                  <Building2 size={15} />
                  <span>Go to Dashboard &amp; Inquiries</span>
                </Link>
              </div>
            ) : (
              <div className="pd-card pd-cta-card">
                {/* Inquiry & Site Visit CTA */}
                <h3>Interested in this property?</h3>
                <p>Schedule a free verified site visit or connect with the representative.</p>

                {/* ── Option 1: Book a Site Visit ── */}
                {visitBooked ? (
                  <div className="w-full mb-2.5">
                    <button
                      className="pd-cta-btn flex items-center justify-center gap-2 w-full"
                      disabled
                      style={{ background: 'linear-gradient(135deg,#059669,#047857)', opacity: 1, cursor: 'default' }}
                    >
                      <CheckCircle2 size={18} />
                      Site Visit Scheduled
                    </button>
                    {activeVisitData && (activeVisitData.visitDate || activeVisitData.notes) && (
                      <div className="mt-2 p-2.5 bg-emerald-50/90 border border-emerald-200 rounded-xl text-left text-xs text-emerald-900 space-y-1">
                        {activeVisitData.visitDate && (
                          <div className="flex items-center gap-1.5 font-semibold text-[0.78rem]">
                            <Clock size={13} className="text-emerald-700 shrink-0" />
                            <span>{activeVisitData.visitDate} · {activeVisitData.visitTime || 'Slot TBD'}</span>
                          </div>
                        )}
                        {activeVisitData.notes && (
                          <div className="text-[0.72rem] text-emerald-800 bg-white/80 p-1.5 rounded-lg border border-emerald-100">
                            <span className="font-semibold text-emerald-950">Representative:</span> &quot;{activeVisitData.notes}&quot;
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <button
                    className="pd-cta-btn flex items-center justify-center gap-2 w-full mb-2.5 cursor-pointer"
                    onClick={() => handleOpenInquiry('visit')}
                  >
                    <CalendarCheck size={18} />
                    Book a Site Visit
                  </button>
                )}

                <div className="pd-safe-note mt-1">
                  <ShieldCheck size={13} className="text-emerald-600" />
                  100% safe &amp; free. No spam guaranteed.
                </div>
              </div>

            ))}

          </aside>
        </div>

        {/* ── Similar Property / Project Section (Price & Location Based) ── */}
        <SimilarProperties currentProperty={property} />
      </main>

      {/* ── Inquiry / Site Visit Modal ── */}
      {inquiryOpen && (
        <div className="pd-overlay" onClick={e => { if (e.target === e.currentTarget) setInquiryOpen(false); }}>
          <div className="pd-modal">
            <button className="pd-modal-close" onClick={() => setInquiryOpen(false)}>
              <X size={18} />
            </button>
            {inquirySuccess ? (
              <div className="pd-success">
                <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 size={32} />
                </div>
                <h3>{inquiryMode === 'visit' ? 'Site Visit Booked!' : 'Inquiry Sent!'}</h3>
                <p>
                  {inquiryMode === 'visit'
                    ? 'Your visit request has been recorded in the database. The builder representative will confirm your scheduled slot shortly.'
                    : 'The builder representative will contact you shortly. Thank you for your interest!'}
                </p>
              </div>
            ) : (
              <>
                <div className="pd-modal-head">
                  <h3>{inquiryMode === 'visit' ? 'Book a Site Visit' : 'Send Free Inquiry'}</h3>
                  <p>About: <strong>{property.title || property.name}</strong></p>
                </div>
                {inquiryError && (
                  <div className="pd-error-banner">
                    {inquiryError}
                  </div>
                )}
                <form className="pd-form" onSubmit={handleInquiry}>
                  <div className="pd-form-row">
                    <div className="pd-field">
                      <label htmlFor="inq-name">
                        Your Name <span className="text-red-500 font-bold" style={{ color: '#ef4444', marginLeft: '3px' }}>*</span>
                      </label>
                      <input 
                        id="inq-name" 
                        type="text" 
                        placeholder="Full name" 
                        value={form.name}
                        onChange={e => setForm(f => ({ ...f, name: e.target.value }))} 
                        minLength={3}
                        required 
                      />
                    </div>
                    <div className="pd-field">
                      <label htmlFor="inq-phone">
                        Phone Number <span className="text-red-500 font-bold" style={{ color: '#ef4444', marginLeft: '3px' }}>*</span>
                      </label>
                      <input 
                        id="inq-phone" 
                        type="tel" 
                        placeholder="+91 7600973093" 
                        value={form.phone}
                        onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} 
                        required 
                      />
                    </div>
                  </div>
                  <div className="pd-field">
                    <label htmlFor="inq-email">
                      Email Address <span className="text-red-500 font-bold" style={{ color: '#ef4444', marginLeft: '3px' }}>*</span>
                    </label>
                    <input 
                      id="inq-email" 
                      type="email" 
                      placeholder="you@example.com" 
                      value={form.email}
                      onChange={e => setForm(f => ({ ...f, email: e.target.value }))} 
                      required 
                    />
                  </div>

                  {inquiryMode === 'visit' && (() => {
                    const now = new Date();
                    const earliestDate = getEarliestBookableDate(now);
                    const maxDate = getMaxBookableDate(now, 60);

                    return (
                      <div className="pd-form-row">
                        <div className="pd-field">
                          <label htmlFor="inq-date">
                            Preferred Visit Date <span className="text-red-500 font-bold" style={{ color: '#ef4444', marginLeft: '3px' }}>*</span>
                          </label>
                          <input
                            id="inq-date"
                            type="date"
                            min={earliestDate}
                            max={maxDate}
                            value={form.visitDate}
                            onChange={handleDateChange}
                            required
                          />
                        </div>

                        <div className="pd-field">
                          <label htmlFor="inq-time">
                            Preferred Time Slot <span className="text-red-500 font-bold" style={{ color: '#ef4444', marginLeft: '3px' }}>*</span>
                          </label>
                          <select
                            id="inq-time"
                            value={form.visitTime}
                            onChange={e => {
                              setForm(f => ({ ...f, visitTime: e.target.value }));
                              setInquiryError('');
                            }}
                            required
                          >
                            {SITE_VISIT_TIME_SLOTS.map(slot => {
                              const expired = isSlotExpired(slot, form.visitDate, now);
                              return (
                                <option key={slot.id} value={slot.value} disabled={expired}>
                                  {slot.label}{expired ? ' (Closed)' : ''}
                                </option>
                              );
                            })}
                          </select>
                        </div>
                      </div>
                    );
                  })()}

                  <div className="pd-field">
                    <label htmlFor="inq-msg">
                      Message <span className="text-red-500 font-bold" style={{ color: '#ef4444', marginLeft: '3px' }}>*</span>
                    </label>
                    <textarea 
                      id="inq-msg" 
                      rows={inquiryMode === 'visit' ? 2 : 3}
                      placeholder={inquiryMode === 'visit' ? 'Any specific requirements for your site visit (min 10 characters)...' : `I am interested in ${property.title || property.name}. Please share more details.`}
                      value={form.message}
                      onChange={e => setForm(f => ({ ...f, message: e.target.value }))} 
                      minLength={10}
                      required
                    />
                  </div>
                  <button type="submit" className="pd-submit" disabled={submitting}>
                    {submitting ? 'Submitting…' : (inquiryMode === 'visit' ? 'Confirm Visit Request' : 'Send Inquiry')}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      </div>

      {/* Global Standard Footer */}
      <Footer />

      {/* Auth Modals */}
      <Modal
        isOpen={authModalState === 'login'}
        onClose={() => setAuthModalState(null)}
        title="Sign In to EstateXplorer"
      >
        <LoginForm
          onSuccess={() => setAuthModalState(null)}
          onSwitchToRegister={(email) => {
            if (email) setAuthModalEmail(email);
            setAuthModalState('register');
          }}
          onSwitchToForgot={() => setAuthModalState('forgot')}
        />
      </Modal>

      <Modal
        isOpen={authModalState === 'register'}
        onClose={() => setAuthModalState(null)}
        title="Create your EstateXplorer Account"
      >
        <RegisterForm
          initialEmail={authModalEmail}
          onSuccess={() => setAuthModalState(null)}
          onSwitchToLogin={() => setAuthModalState('login')}
        />
      </Modal>

      <Modal
        isOpen={authModalState === 'forgot'}
        onClose={() => setAuthModalState(null)}
        title="Reset Your Password"
      >
        <ForgotForm
          onOtpSent={(email) => {
            setAuthModalState(null);
            navigate('/reset-password', { state: { email } });
          }}
          onBackToLogin={() => setAuthModalState('login')}
        />
      </Modal>

      {/* Professional Property Share Modal */}
      <ShareModal
        isOpen={shareOpen}
        onClose={() => setShareOpen(false)}
        property={property}
      />

      {/* Mandatory Email Verification Modal for Bookings & Inquiries */}
      <EmailVerificationModal
        isOpen={verifyModalOpen}
        onClose={() => setVerifyModalOpen(false)}
        onVerified={() => {
          setInquiryOpen(true);
        }}
        actionType={inquiryMode}
        propertyTitle={property.title || property.name}
      />

      {/* Request Selling Rights Modal for Agents */}
      <RequestSellingRightsModal
        isOpen={isRequestRightsOpen}
        project={property}
        showToast={showToast}
        onClose={() => setIsRequestRightsOpen(false)}
        onSuccess={() => {
          setIsRequestRightsOpen(false);
          fetchAgentPartnershipStatus();
          if (showToast) showToast('Selling rights application submitted to developer!', 'success');
        }}
      />
    </div>
  );
};

export default PropertyDetail;
