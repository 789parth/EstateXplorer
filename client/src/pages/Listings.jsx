import React, { useState, useEffect, useMemo, useCallback, useRef, Suspense, lazy } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { X, Search, Share2, Check, Building2, Layers, Plus } from 'lucide-react';
import { getProperties, getUserWishlist, toggleWishlistApi } from '../services/propertyService';
import { broadcastRealtimeSync, useRealtimeSync, SYNC_EVENTS } from '../utils/realtimeSync';
import { useAuth } from '../hooks/useAuth';
import Navbar from '../components/layout/Navbar';
import Footer from '../components/layout/Footer';
import Modal from '../components/common/Modal';
import ShareModal from '../components/common/ShareModal';
import { formatPrice, getPublicImageUrl, isVideoUrl } from '../utils/formatters';
import './Listings.css';

// Auth forms only appear in modals — lazy-load to keep Listings initial bundle lean
const LoginForm = lazy(() => import('../components/auth/LoginForm'));
const RegisterForm = lazy(() => import('../components/auth/RegisterForm'));
const ForgotForm = lazy(() => import('../components/auth/ForgotForm'));
const AUTH_MODAL_FALLBACK = <div className="py-8 text-center text-slate-400 text-sm">Loading…</div>;

/**
 * Parses user typed budget input like "25L", "1.5 Cr", "50 Lakhs", "2000000" into raw numeric value.
 */
const parseBudgetValue = (val) => {
  if (val === null || val === undefined) return null;
  const str = String(val).trim().toLowerCase().replace(/,/g, '').replace(/₹/g, '').replace(/rs\.?/g, '').trim();
  if (!str) return null;

  const numMatch = str.match(/([0-9]+(?:\.[0-9]+)?)/);
  if (!numMatch) return null;
  const num = parseFloat(numMatch[1]);
  if (isNaN(num) || num <= 0) return null;

  if (str.includes('cr') || str.includes('crore')) {
    return Math.round(num * 10000000);
  }
  if (str.includes('l') || str.includes('lac') || str.includes('lakh')) {
    return Math.round(num * 100000);
  }
  if (str.includes('k') || str.includes('thousand')) {
    return Math.round(num * 1000);
  }
  return Math.round(num);
};

/**
 * Formats a raw numeric budget into standard Indian display label e.g. "25L", "1.5Cr"
 */
const formatBudgetDisplay = (num) => {
  if (!num || isNaN(num) || num <= 0) return '';
  const val = Math.round(num);
  if (val >= 10000000) {
    const cr = (val / 10000000).toFixed(2).replace(/\.00$/, '');
    return `${cr}Cr`;
  }
  if (val >= 100000) {
    const lac = (val / 100000).toFixed(2).replace(/\.00$/, '');
    return `${lac}L`;
  }
  if (val >= 1000) {
    const k = (val / 1000).toFixed(1).replace(/\.0$/, '');
    return `${k}k`;
  }
  return String(val);
};

const mapListingProperty = (p) => {
  const rawImages = Array.isArray(p.images) && p.images.length > 0
    ? p.images
    : (p.image ? [p.image] : (p.img ? [p.img] : []));
  const validImages = rawImages
    .filter((img) => typeof img === 'string' && img.trim() !== '')
    .map((img) => getPublicImageUrl(img));
  const mainImg = validImages[0] || getPublicImageUrl(p.image || p.img);
  const videoCount = validImages.filter(isVideoUrl).length;
  const photoCount = validImages.length > 0 ? Math.max(0, validImages.length - videoCount) : 1;
  const locStr = typeof p.location === 'string' ? p.location : `${p.location?.address || ''}, ${p.location?.city || ''}`;

  return {
    ...p,
    id: p._id,
    type: p.type || (p.bhk ? `${p.bhk} BHK Apartment` : 'Apartment'),
    amenities: Array.isArray(p.amenities) ? p.amenities : [],
    builder: p.builder,
    postedByRole: p.postedByRole || (typeof p.builder === 'object' ? p.builder?.role : '') || (p.category === 'project' ? 'builder' : 'owner'),
    description: p.description || '',
    area: p.area || 0,
    createdAt: p.createdAt,
    price: p.price,
    purpose: p.purpose || 'buy',
    bhk: p.bhk || 0,
    status: p.status,
    rera: p.rera,
    name: p.title,
    category: p.category || 'property',
    location: locStr,
    city: typeof p.location === 'object' ? p.location?.city : '',
    priceDisplay: formatPrice(p.price, p.priceDisplay, p.purpose),
    priceSub: p.priceSub || (p.price > 0 && p.area > 0 ? `₹ ${Math.round(p.price / p.area).toLocaleString('en-IN')} / Sq.Ft` : ''),
    photos: photoCount,
    videos: videoCount,
    images: validImages.length > 0 ? validImages : [mainImg],
    usps: p.usps || [],
    statusLabel: p.statusLabel || (p.status === 'ready' ? 'Ready To Move' : 'Under Construction'),
    statusDate: p.statusDate,
    ready: p.status === 'ready',
    img: mainImg,
  };
};

const Listings = ({ projectOnly = false }) => {
  const { user, showToast } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [properties, setProperties] = useState([]); // 100% live database properties
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loadingMore, setLoadingMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [authModalState, setAuthModalState] = useState(null); // 'login' | 'register' | 'forgot' | null
  const [authModalEmail, setAuthModalEmail] = useState('');
  const [shareModalProp, setShareModalProp] = useState(null);

  const fetchProperties = useCallback(async (isBackground = false) => {
    try {
      if (!isBackground) {
        setLoading(true);
      }
      const res = await getProperties({ page: 1, limit: 100 }, { useCache: !isBackground });
      if (res.success && Array.isArray(res.data)) {
        setProperties(res.data.map(mapListingProperty));
        setPagination({ page: res.page || 1, totalPages: res.totalPages || 1, total: res.total || res.count || 0 });
      }
    } catch (err) {
      console.error('Failed to fetch live database properties:', err);
    } finally {
      if (!isBackground) {
        setLoading(false);
      }
    }
  }, []);

  const loadNextPage = async () => {
    if (loadingMore || pagination.page >= pagination.totalPages) return;
    setLoadingMore(true);
    try {
      const nextPage = pagination.page + 1;
      const res = await getProperties({ page: nextPage, limit: 100 }, { useCache: false });
      if (res.success && Array.isArray(res.data)) {
        setProperties((current) => [...current, ...res.data.map(mapListingProperty)]);
        setPagination({ page: res.page || nextPage, totalPages: res.totalPages || pagination.totalPages, total: res.total || pagination.total });
        setVisibleCount((current) => current + 6);
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not load more listings.', 'error');
    } finally {
      setLoadingMore(false);
    }
  };

  const handleLoadMore = () => {
    if (visibleCount < filtered.length) setVisibleCount((current) => current + 6);
    else loadNextPage();
  };

  useEffect(() => {
    fetchProperties(false);
  }, [fetchProperties]);

  const [activeChip, setActiveChip] = useState('all');
  const [sortBy, setSortBy] = useState('relevance');
  const [reraOnly, setReraOnly] = useState(false);
  // searchInput: drives the visual input field immediately (no lag)
  // locationSearch: drives the filter useMemo — debounced 200ms to avoid
  // re-running the expensive filter pipeline on every single keystroke
  const [searchInput, setSearchInput] = useState('');
  const [locationSearch, setLocationSearch] = useState('');
  const searchDebounceRef = useRef(null);
  const [selectedState, setSelectedState] = useState('');
  const [selectedCities, setSelectedCities] = useState([]);
  const [selectedLocalities, setSelectedLocalities] = useState([]);
  const [selectedBhk, setSelectedBhk] = useState([]);
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [selectedPoss, setSelectedPoss] = useState([]);
  const [selectedAmenities, setSelectedAmenities] = useState([]);
  const [selectedPostedBy, setSelectedPostedBy] = useState([]);
  const [selectedPurpose, setSelectedPurpose] = useState('all');
  const [likedIds, setLikedIds] = useState([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [budgetPreset, setBudgetPreset] = useState(null);
  const [minBudgetInput, setMinBudgetInput] = useState('');
  const [maxBudgetInput, setMaxBudgetInput] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(projectOnly ? 'project' : 'all');
  const [builderFilter, setBuilderFilter] = useState('all'); // 'all' | 'my_projects' | 'my_properties'
  const [visibleCount, setVisibleCount] = useState(6);

  // Parse URL search params on mount & when searchParams changes
  useEffect(() => {
    setVisibleCount(6);
    const loc = searchParams.get('location') || searchParams.get('search');
    const city = searchParams.get('city');
    const state = searchParams.get('state');
    const type = searchParams.get('type');
    const bhk = searchParams.get('bhk');
    const budget = searchParams.get('budget');
    const cat = searchParams.get('category');
    const status = searchParams.get('status');
    const purpose = searchParams.get('purpose');

    if (loc) { setSearchInput(loc); setLocationSearch(loc); }
    else { setSearchInput(''); setLocationSearch(''); }

    if (state) setSelectedState(state);
    else setSelectedState('');

    if (city) {
      setSelectedCities([city.toLowerCase()]);
    } else if (loc && ['mumbai', 'delhi', 'bangalore', 'bengaluru', 'pune', 'hyderabad', 'ahmedabad', 'goa', 'vadodara', 'anand'].some(c => loc.toLowerCase().includes(c))) {
      const match = ['mumbai', 'delhi', 'bangalore', 'bengaluru', 'pune', 'hyderabad', 'ahmedabad', 'goa', 'vadodara', 'anand'].find(c => loc.toLowerCase().includes(c));
      if (match) setSelectedCities([match === 'bangalore' ? 'bengaluru' : match]);
    } else {
      setSelectedCities([]);
    }

    if (purpose === 'rent' || purpose === 'buy') {
      setSelectedPurpose(purpose);
    } else {
      setSelectedPurpose('all');
    }

    if (type && type !== 'Select type') {
      const normalized = type.toLowerCase().replace(/\s+/g, '_');
      setSelectedTypes([normalized]);
    } else {
      setSelectedTypes([]);
    }

    if (bhk && bhk !== 'Any') {
      const cleanBhk = String(bhk).replace(/\D/g, '');
      if (cleanBhk) setSelectedBhk([cleanBhk]);
    } else {
      setSelectedBhk([]);
    }

    if (cat === 'project' || projectOnly) {
      setSelectedCategory('project');
      setSelectedPostedBy(['builder']);
    } else if (cat === 'property') {
      setSelectedCategory('property');
      setSelectedPostedBy([]);
    } else {
      setSelectedCategory('all');
      setSelectedPostedBy([]);
    }

    if (status === 'ready') {
      setActiveChip('ready');
      setSelectedPoss(['ready']);
    } else {
      setActiveChip('all');
      setSelectedPoss([]);
    }

    const minPriceParam = searchParams.get('minPrice') || searchParams.get('min');
    const maxPriceParam = searchParams.get('maxPrice') || searchParams.get('max');

    if (minPriceParam || maxPriceParam) {
      const minVal = parseBudgetValue(minPriceParam);
      const maxVal = parseBudgetValue(maxPriceParam);
      setMinBudgetInput(minVal ? formatBudgetDisplay(minVal) : '');
      setMaxBudgetInput(maxVal ? formatBudgetDisplay(maxVal) : '');
      setBudgetPreset(null);
    } else if (budget && budget !== 'Min – Max') {
      let presetFound = null;
      if (budget === 'Under ₹50L' || budget === 'Under ₹25L') presetFound = { label: 'Under ₹25L', min: 0, max: 2500000, minLabel: '', maxLabel: '25L' };
      else if (budget === '₹25–50L' || budget === '₹25L – ₹50L') presetFound = { label: '₹25–50L', min: 2500000, max: 5000000, minLabel: '25L', maxLabel: '50L' };
      else if (budget === '₹50L – ₹1Cr' || budget === '₹50L–1Cr') presetFound = { label: '₹50L–1Cr', min: 5000000, max: 10000000, minLabel: '50L', maxLabel: '1Cr' };
      else if (budget === '₹1Cr–1.25Cr' || budget === '₹1Cr – ₹1.25Cr' || budget === '1Cr-1.25Cr') presetFound = { label: '₹1Cr–1.25Cr', min: 10000000, max: 12500000, minLabel: '1Cr', maxLabel: '1.25Cr' };
      else if (budget === '₹1.25Cr–1.5Cr' || budget === '₹1.25Cr – ₹1.5Cr' || budget === '1.25Cr-1.5Cr') presetFound = { label: '₹1.25Cr–1.5Cr', min: 12500000, max: 15000000, minLabel: '1.25Cr', maxLabel: '1.5Cr' };
      else if (budget === '₹1.5Cr–2Cr' || budget === '₹1.5Cr – ₹2Cr' || budget === '1.5Cr-2Cr') presetFound = { label: '₹1.5Cr–2Cr', min: 15000000, max: 20000000, minLabel: '1.5Cr', maxLabel: '2Cr' };
      else if (budget === 'Above ₹2Cr' || budget === 'above 2Cr' || budget === 'Above 2Cr' || budget === '₹2Cr+' || budget === '₹3Cr+') presetFound = { label: 'Above ₹2Cr', min: 20000000, max: null, minLabel: '2Cr', maxLabel: '' };
      else if (budget === '₹1Cr – ₹3Cr') presetFound = { label: '₹1Cr–1.25Cr', min: 10000000, max: 12500000, minLabel: '1Cr', maxLabel: '1.25Cr' };

      setBudgetPreset(presetFound);
      setMinBudgetInput(presetFound?.minLabel || '');
      setMaxBudgetInput(presetFound?.maxLabel || '');
    } else {
      setBudgetPreset(null);
      setMinBudgetInput('');
      setMaxBudgetInput('');
    }
  }, [searchParams, projectOnly]);

  const syncWishlist = useCallback(() => {
    if (user) {
      getUserWishlist()
        .then(res => {
          if (res.success && Array.isArray(res.data)) {
            const clean = res.data.map(String);
            setLikedIds(clean);
            localStorage.setItem('wishlist', JSON.stringify(clean));
          } else {
            setLikedIds([]);
            localStorage.setItem('wishlist', JSON.stringify([]));
          }
        })
        .catch(() => {
          setLikedIds([]);
        });
    } else {
      setLikedIds([]);
      localStorage.removeItem('wishlist');
    }
  }, [user]);

  // Sync wishlist from backend if logged in
  useEffect(() => {
    syncWishlist();
  }, [syncWishlist]);

  // Debounce search input: update the filter state 200ms after user stops typing.
  // Prevents re-running the full filter pipeline on every keystroke.
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setLocationSearch(searchInput);
    }, 200);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchInput]);

  // Real-time synchronization for inventory and cross-tab wishlist changes (silent background updates)
  useRealtimeSync(
    [SYNC_EVENTS.WISHLIST, SYNC_EVENTS.PROPERTIES],
    () => {
      syncWishlist();
      fetchProperties(true);
    },
    { revalidateOnFocus: true, intervalMs: 30000 }
  );

  // Derived O(1) lookup set — avoids O(n) .some() inside every filter pass
  const likedSet = useMemo(() => new Set(likedIds.map(String)), [likedIds]);

  // Real valid saved count from loaded properties
  const savedCount = useMemo(() => {
    return properties.filter(p => likedSet.has(String(p.id))).length;
  }, [properties, likedSet]);

  // Helper to determine who posted the property/project
  const getPropertyPosterRole = useCallback((p) => {
    if (p.category === 'project') return 'builder';
    const role = (p.postedByRole || (typeof p.builder === 'object' ? p.builder?.role : '') || '').toLowerCase();
    if (role === 'builder') return 'builder';
    if (role === 'agent') return 'agent';
    if (role === 'owner' || role === 'buyer') return 'owner';
    return 'owner';
  }, []);

  // Dynamic counts for sidebar badges
  const counts = useMemo(() => {
    const res = {
      bhk: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
      type: {
        apartment: 0,
        villa: 0,
        penthouse: 0,
        farmhouse: 0,
        commercial: 0,
        plot: 0,
        studio: 0,
        row_house: 0,
      },
      city: {
        mumbai: 0,
        delhi: 0,
        bengaluru: 0,
        pune: 0,
        hyderabad: 0,
        ahmedabad: 0,
        goa: 0,
        vadodara: 0,
        anand: 0,
      },
      poss: {
        ready: 0,
        '2026': 0,
        '2027': 0,
        '2028': 0,
        '2029': 0,
      },
      amenity: {
        pool: 0,
        gym: 0,
        parking: 0,
        security: 0,
        club: 0,
      },
      postedBy: {
        builder: 0,
        agent: 0,
        owner: 0,
      },
    };

    properties.forEach(p => {
      const bhkNum = Number(p.bhk) || 0;
      if (bhkNum === 1) res.bhk['1']++;
      else if (bhkNum === 2) res.bhk['2']++;
      else if (bhkNum === 3) res.bhk['3']++;
      else if (bhkNum === 4) res.bhk['4']++;
      else if (bhkNum >= 5) res.bhk['5']++;

      const t = (p.type || '').toLowerCase();
      if (t.includes('apartment') || t.includes('bhk') || t.includes('flat')) res.type.apartment++;
      if (t.includes('villa') || t.includes('house') || t.includes('bungalow')) res.type.villa++;
      if (t.includes('penthouse')) res.type.penthouse++;
      if (t.includes('farmhouse') || t.includes('country estate') || t.includes('estate') || t.includes('farm')) res.type.farmhouse++;
      if (t.includes('commercial') || t.includes('office') || t.includes('retail') || t.includes('shop')) res.type.commercial++;
      if (t.includes('plot') || t.includes('land')) res.type.plot++;
      if (t.includes('studio')) res.type.studio++;
      if (t.includes('row house') || t.includes('duplex') || t.includes('townhouse') || t.includes('rowhouse')) res.type.row_house++;

      const fullLoc = `${p.location || ''} ${p.city || ''}`.toLowerCase();
      if (fullLoc.includes('mumbai') || fullLoc.includes('bandra') || fullLoc.includes('worli') || fullLoc.includes('powai') || fullLoc.includes('bkc')) res.city.mumbai++;
      if (fullLoc.includes('delhi') || fullLoc.includes('gurugram') || fullLoc.includes('noida') || fullLoc.includes('sohna')) res.city.delhi++;
      if (fullLoc.includes('bengaluru') || fullLoc.includes('bangalore') || fullLoc.includes('marathahalli') || fullLoc.includes('devanahalli') || fullLoc.includes('indiranagar')) res.city.bengaluru++;
      if (fullLoc.includes('pune') || fullLoc.includes('hadapsar') || fullLoc.includes('kalyani')) res.city.pune++;
      if (fullLoc.includes('hyderabad') || fullLoc.includes('hitec') || fullLoc.includes('jubilee')) res.city.hyderabad++;
      if (fullLoc.includes('ahmedabad') || fullLoc.includes('sindhu') || fullLoc.includes('sg highway') || fullLoc.includes('makarba')) res.city.ahmedabad++;
      if (fullLoc.includes('goa') || fullLoc.includes('assagao') || fullLoc.includes('candolim')) res.city.goa++;
      if (fullLoc.includes('vadodara')) res.city.vadodara++;
      if (fullLoc.includes('anand')) res.city.anand++;

      // Possession counts
      if (p.status === 'ready' || p.ready === true) res.poss.ready++;
      const sDate = p.statusDate || '';
      if (sDate.includes('2026')) res.poss['2026']++;
      if (sDate.includes('2027')) res.poss['2027']++;
      if (sDate.includes('2028')) res.poss['2028']++;
      if (sDate.includes('2029') || sDate.includes('2030') || sDate.includes('2031')) res.poss['2029']++;

      // Amenities counts
      const propAmenities = [
        ...(Array.isArray(p.amenities) ? p.amenities : []),
        ...(Array.isArray(p.usps) ? p.usps : []),
        p.description || '',
      ].join(' ').toLowerCase();

      if (propAmenities.includes('pool') || propAmenities.includes('swim')) res.amenity.pool++;
      if (propAmenities.includes('gym') || propAmenities.includes('fitness') || propAmenities.includes('workout')) res.amenity.gym++;
      if (propAmenities.includes('parking') || propAmenities.includes('garage')) res.amenity.parking++;
      if (propAmenities.includes('security') || propAmenities.includes('cctv') || propAmenities.includes('guard')) res.amenity.security++;
      if (propAmenities.includes('club') || propAmenities.includes('community')) res.amenity.club++;

      // Posted by counts
      const posterRole = getPropertyPosterRole(p);
      if (posterRole === 'builder') res.postedBy.builder++;
      else if (posterRole === 'agent') res.postedBy.agent++;
      else if (posterRole === 'owner') res.postedBy.owner++;
    });

    return res;
  }, [properties, getPropertyPosterRole]);

  // Derive unique localities from loaded properties
  const allLocalities = useMemo(() => {
    const set = new Set();
    properties.forEach(p => {
      if (p.location) {
        // Take the first part (before comma) as the locality
        const locality = p.location.split(',')[0].trim();
        if (locality) set.add(locality);
      }
    });
    return Array.from(set).slice(0, 8); // max 8 chips
  }, [properties]);

  const toggleCity = (val) => {
    setVisibleCount(6);
    const s = String(val).toLowerCase();
    setSelectedCities(prev => prev.includes(s) ? prev.filter(v => v !== s) : [...prev, s]);
  };
  const toggleBhk = (val) => {
    setVisibleCount(6);
    const s = String(val);
    setSelectedBhk(prev => prev.includes(s) ? prev.filter(v => v !== s) : [...prev, s]);
  };
  const toggleType = (val) => {
    setVisibleCount(6);
    const s = String(val).toLowerCase();
    setSelectedTypes(prev => prev.includes(s) ? prev.filter(v => v !== s) : [...prev, s]);
  };
  const togglePoss = (val) => {
    setVisibleCount(6);
    const s = String(val);
    setSelectedPoss(prev => prev.includes(s) ? prev.filter(v => v !== s) : [...prev, s]);
  };
  const toggleAmenity = (val) => {
    setVisibleCount(6);
    setSelectedAmenities(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);
  };
  const togglePostedBy = (val) => {
    setVisibleCount(6);
    setSelectedPostedBy(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);
  };
  const toggleLocality = (val) => {
    setVisibleCount(6);
    setSelectedLocalities(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);
  };

  const toggleLike = async (id) => {
    if (!user) {
      if (showToast) showToast('Please sign in to save properties to your wishlist.', 'error');
      setAuthModalState('login');
      return;
    }

    const nextState = !likedSet.has(String(id));
    const updated = likedSet.has(String(id)) ? likedIds.filter(v => v !== id) : [...likedIds, id];
    setLikedIds(updated);
    localStorage.setItem('wishlist', JSON.stringify(updated));

    broadcastRealtimeSync(SYNC_EVENTS.WISHLIST, { action: nextState ? 'added' : 'removed', id });

    try {
      await toggleWishlistApi(id);
      if (showToast) {
        showToast(updated.includes(id) ? 'Saved to wishlist!' : 'Removed from wishlist', 'success');
      }
    } catch (e) {
      console.error('Failed to sync wishlist to server:', e);
    }
  };

  const clearFilters = () => {
    setReraOnly(false);
    setSearchInput('');
    setLocationSearch('');
    setSelectedState('');
    setSelectedCities([]);
    setSelectedLocalities([]);
    setSelectedBhk([]);
    setSelectedTypes([]);
    setSelectedPoss([]);
    setSelectedAmenities([]);
    setSelectedPostedBy([]);
    setSelectedPurpose('all');
    setSelectedCategory(projectOnly ? 'project' : 'all');
    setBudgetPreset(null);
    setMinBudgetInput('');
    setMaxBudgetInput('');
    setActiveChip('all');
    setSortBy('relevance');
    setVisibleCount(6);
    setSearchParams({});
    navigate(projectOnly ? '/projects' : '/listings', { replace: true });
  };

  // Active filter tags for quick pill dismissals
  const activeFilterTags = useMemo(() => {
    const tags = [];
    if (locationSearch.trim()) tags.push({ label: `Search: "${locationSearch}"`, clear: () => { setSearchInput(''); setLocationSearch(''); } });
    if (selectedState) tags.push({ label: `State: ${selectedState}`, clear: () => setSelectedState('') });
    selectedCities.forEach(c => tags.push({ label: `City: ${c.charAt(0).toUpperCase() + c.slice(1)}`, clear: () => toggleCity(c) }));
    selectedLocalities.forEach(l => tags.push({ label: `Locality: ${l}`, clear: () => toggleLocality(l) }));
    selectedBhk.forEach(b => tags.push({ label: b === '5' ? '5+ BHK' : `${b} BHK`, clear: () => toggleBhk(b) }));
    
    const typeLabels = {
      apartment: 'Apartment',
      villa: 'Villa / House',
      penthouse: 'Penthouse',
      farmhouse: 'Farmhouse',
      commercial: 'Commercial',
      plot: 'Plot / Land',
      studio: 'Studio Apartment',
      row_house: 'Row House / Duplex',
    };
    selectedTypes.forEach(t => tags.push({ label: `Type: ${typeLabels[t] || t.replace(/_/g, ' ')}`, clear: () => toggleType(t) }));
    selectedPoss.forEach(p => tags.push({ label: p === 'ready' ? 'Ready to Move' : `Possession: ${p}`, clear: () => togglePoss(p) }));
    
    const amenityLabels = {
      pool: 'Swimming Pool',
      gym: 'Gym',
      parking: 'Covered Parking',
      security: '24×7 Security',
      club: 'Clubhouse',
    };
    selectedAmenities.forEach(a => tags.push({ label: `Amenity: ${amenityLabels[a] || a}`, clear: () => toggleAmenity(a) }));
    selectedPostedBy.forEach(pb => tags.push({ label: `Posted By: ${pb.charAt(0).toUpperCase() + pb.slice(1)}`, clear: () => togglePostedBy(pb) }));
    if (selectedPurpose !== 'all') tags.push({ label: selectedPurpose === 'buy' ? 'For Sale (Buy)' : 'For Rent', clear: () => setSelectedPurpose('all') });
    if (reraOnly) tags.push({ label: 'RERA Verified', clear: () => setReraOnly(false) });
    if (budgetPreset) {
      tags.push({
        label: `Budget: ${budgetPreset.label}`,
        clear: () => {
          setBudgetPreset(null);
          setMinBudgetInput('');
          setMaxBudgetInput('');
        },
      });
    } else if (minBudgetInput || maxBudgetInput) {
      const minNum = parseBudgetValue(minBudgetInput);
      const maxNum = parseBudgetValue(maxBudgetInput);
      let label = 'Budget: ';
      if (minNum && maxNum) label += `₹${formatBudgetDisplay(minNum)} – ₹${formatBudgetDisplay(maxNum)}`;
      else if (minNum) label += `Min ₹${formatBudgetDisplay(minNum)}`;
      else if (maxNum) label += `Up to ₹${formatBudgetDisplay(maxNum)}`;
      else label += `${minBudgetInput} – ${maxBudgetInput}`;

      tags.push({
        label,
        clear: () => {
          setMinBudgetInput('');
          setMaxBudgetInput('');
        },
      });
    }
    if (selectedCategory !== 'all') tags.push({ label: selectedCategory === 'project' ? 'Projects Only' : 'Properties Only', clear: () => setSelectedCategory('all') });
    return tags;
  }, [locationSearch, selectedState, selectedCities, selectedLocalities, selectedBhk, selectedTypes, selectedPoss, selectedAmenities, selectedPostedBy, selectedPurpose, reraOnly, budgetPreset, minBudgetInput, maxBudgetInput, selectedCategory]);

  const filtered = useMemo(() => {
    let list = [...properties];

    if (selectedCategory === 'project' || projectOnly) {
      list = list.filter(p => p.category === 'project' || (p.builder && !p.postedByRole) || p.postedByRole === 'builder');
    } else if (selectedCategory === 'property') {
      list = list.filter(p => p.category === 'property');
    }

    // Purpose filter: Buy vs Rent
    if (selectedPurpose && selectedPurpose !== 'all') {
      list = list.filter(p => (p.purpose || 'buy') === selectedPurpose);
    }

    // Search filter: text search across name, location, city, type, builder, description, and amenities
    if (locationSearch.trim()) {
      const q = locationSearch.toLowerCase().trim();
      list = list.filter(p =>
        (p.location && p.location.toLowerCase().includes(q)) ||
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.city && p.city.toLowerCase().includes(q)) ||
        (p.type && p.type.toLowerCase().includes(q)) ||
        (p.description && p.description.toLowerCase().includes(q)) ||
        (Array.isArray(p.usps) && p.usps.some(u => u.toLowerCase().includes(q))) ||
        (Array.isArray(p.amenities) && p.amenities.some(a => a.toLowerCase().includes(q)))
      );
    }

    // State Filter
    if (selectedState && selectedState !== 'all' && selectedState.trim() !== '') {
      const st = selectedState.toLowerCase();
      const stateCities = {
        'maharashtra': ['mumbai', 'pune', 'alibaug', 'bandra', 'worli', 'powai', 'bkc'],
        'karnataka': ['bengaluru', 'bangalore', 'marathahalli', 'devanahalli', 'indiranagar', 'panathur'],
        'gujarat': ['ahmedabad', 'gandhinagar', 'anand', 'vadodara', 'gift city', 'bodakdev'],
        'delhi (nct)': ['delhi', 'gurugram', 'noida', 'cybercity'],
        'haryana': ['gurugram', 'gurgaon', 'sohna'],
        'uttar pradesh': ['noida'],
        'telangana': ['hyderabad', 'hitec city', 'jubilee hills', 'madhapur'],
        'goa': ['goa', 'assagao', 'candolim'],
      };
      const allowedCities = stateCities[st] || [st];
      list = list.filter(p => {
        const fullLoc = `${p.location || ''} ${p.city || ''}`.toLowerCase();
        return allowedCities.some(c => fullLoc.includes(c)) || fullLoc.includes(st);
      });
    }

    // City Filter
    if (selectedCities.length > 0) {
      list = list.filter(p => {
        const fullLoc = `${p.location || ''} ${p.city || ''}`.toLowerCase();
        return selectedCities.some(city => {
          const c = city.toLowerCase();
          if (c.includes('bangalore') || c.includes('bengaluru')) {
            return fullLoc.includes('bangalore') || fullLoc.includes('bengaluru') || fullLoc.includes('devanahalli') || fullLoc.includes('marathahalli');
          }
          if (c.includes('delhi')) {
            return fullLoc.includes('delhi') || fullLoc.includes('gurugram') || fullLoc.includes('noida') || fullLoc.includes('sohna');
          }
          return fullLoc.includes(c);
        });
      });
    }

    if (selectedLocalities.length) {
      list = list.filter(p =>
        selectedLocalities.some(loc => p.location && p.location.toLowerCase().includes(loc.toLowerCase()))
      );
    }
    // Quick chip filters
    if (activeChip === 'wishlist') list = list.filter(p => likedSet.has(String(p.id)));
    if (activeChip === 'rera') list = list.filter(p => p.rera);
    if (activeChip === 'ready') list = list.filter(p => p.status === 'ready');
    if (activeChip === 'possession') list = list.filter(p => p.status !== 'ready');
    if (activeChip === 'new') {
      // "New Launch" = under construction
      list = list.filter(p => p.status !== 'ready');
    }

    // Sidebar: RERA
    if (reraOnly) list = list.filter(p => p.rera);

    // Sidebar: Bedroom (BHK)
    if (selectedBhk.length) {
      list = list.filter(p => selectedBhk.some(b => {
        const num = Number(b);
        const pBhk = Number(p.bhk) || 0;
        if (num >= 5) return pBhk >= 5;
        if (num === 0) return pBhk === 0;
        return pBhk === num || String(b) === String(p.bhk);
      }));
    }

    // Sidebar: Property Type — match against type string with full aliases
    if (selectedTypes.length) {
      list = list.filter(p =>
        selectedTypes.some(type => {
          if (!p.type) return false;
          const t = p.type.toLowerCase().replace(/_/g, ' ');
          const targetType = type.toLowerCase().replace(/_/g, ' ');
          if (targetType === 'row house' || targetType === 'row_house') {
            return t.includes('row house') || t.includes('duplex') || t.includes('townhouse') || t.includes('rowhouse');
          }
          if (targetType === 'plot' || targetType === 'land') {
            return t.includes('plot') || t.includes('land');
          }
          if (targetType === 'commercial') {
            return t.includes('commercial') || t.includes('office') || t.includes('retail') || t.includes('shop');
          }
          if (targetType === 'apartment') {
            return t.includes('apartment') || t.includes('flat') || t.includes('bhk');
          }
          if (targetType === 'villa') {
            return t.includes('villa') || t.includes('house') || t.includes('bungalow');
          }
          if (targetType === 'penthouse') {
            return t.includes('penthouse');
          }
          if (targetType === 'farmhouse') {
            return t.includes('farmhouse') || t.includes('country estate') || t.includes('estate') || t.includes('farm');
          }
          if (targetType === 'studio') {
            return t.includes('studio');
          }
          return t.includes(targetType) || targetType.includes(t);
        })
      );
    }

    // Sidebar: Possession year
    if (selectedPoss.length) {
      list = list.filter(p =>
        selectedPoss.some(poss => {
          if (poss === 'ready') return p.status === 'ready' || p.ready === true;
          return p.statusDate && p.statusDate.includes(poss);
        })
      );
    }

    // Sidebar: Amenities — at least one selected amenity must be present
    if (selectedAmenities.length) {
      list = list.filter(p => {
        const propAmenities = [
          ...(Array.isArray(p.amenities) ? p.amenities : []),
          ...(Array.isArray(p.usps) ? p.usps : []),
          p.description || '',
        ].join(' ').toLowerCase();

        return selectedAmenities.some(targetAmenity => {
          const ta = targetAmenity.toLowerCase();
          if (ta === 'pool') return propAmenities.includes('pool') || propAmenities.includes('swim');
          if (ta === 'gym') return propAmenities.includes('gym') || propAmenities.includes('fitness') || propAmenities.includes('workout');
          if (ta === 'parking') return propAmenities.includes('parking') || propAmenities.includes('garage');
          if (ta === 'security') return propAmenities.includes('security') || propAmenities.includes('cctv') || propAmenities.includes('guard');
          if (ta === 'club') return propAmenities.includes('club') || propAmenities.includes('community');
          return propAmenities.includes(ta);
        });
      });
    }

    // Sidebar: Posted By
    if (selectedPostedBy.length) {
      list = list.filter(p => selectedPostedBy.includes(getPropertyPosterRole(p)));
    }

    // Budget filter (preset or custom typed values)
    const activeMin = budgetPreset ? budgetPreset.min : parseBudgetValue(minBudgetInput);
    const activeMax = budgetPreset ? budgetPreset.max : parseBudgetValue(maxBudgetInput);

    if (activeMin && activeMin > 0) {
      list = list.filter(p => (typeof p.price === 'number' && p.price >= activeMin));
    }
    if (activeMax && activeMax > 0) {
      list = list.filter(p => (typeof p.price === 'number' && p.price <= activeMax));
    }

    // Builder quick filters: My Projects and My Properties (Requirement 11)
    if (user?.role === 'builder' && builderFilter !== 'all') {
      const myId = String(user._id || user.id || '');
      list = list.filter(p => {
        const pBuilderId = typeof p.builder === 'object' ? String(p.builder?._id || '') : String(p.builder || '');
        const pUserId = typeof p.user === 'object' ? String(p.user?._id || '') : String(p.user || '');
        const pPostedBy = typeof p.postedBy === 'object' ? String(p.postedBy?._id || '') : String(p.postedBy || '');
        const isMine = (pBuilderId && pBuilderId === myId) || (pUserId && pUserId === myId) || (pPostedBy && pPostedBy === myId);
        
        const isProj = p.category === 'project' || p.isProject || p.propertyType === 'project' || Boolean(p.unitsCount || p.towersCount);
        
        if (builderFilter === 'my_projects') {
          return isMine && isProj;
        }
        if (builderFilter === 'my_properties') {
          return isMine && !isProj;
        }
        return true;
      });
    }

    // Sort
    if (sortBy === 'price-asc') list.sort((a, b) => a.price - b.price);
    if (sortBy === 'price-desc') list.sort((a, b) => b.price - a.price);
    if (sortBy === 'newest') {
      list.sort((a, b) => {
        const aDate = a.createdAt ? new Date(a.createdAt) : new Date(0);
        const bDate = b.createdAt ? new Date(b.createdAt) : new Date(0);
        return bDate - aDate;
      });
    }
    if (sortBy === 'possession') {
      list.sort((a, b) => {
        if (a.status === 'ready' && b.status !== 'ready') return -1;
        if (b.status === 'ready' && a.status !== 'ready') return 1;
        const aYear = a.statusDate ? parseInt(a.statusDate.match(/\d{4}/)?.[0] || '9999') : 9999;
        const bYear = b.statusDate ? parseInt(b.statusDate.match(/\d{4}/)?.[0] || '9999') : 9999;
        return aYear - bYear;
      });
    }

    return list;
  }, [properties, projectOnly, activeChip, reraOnly, locationSearch, selectedState, selectedCities, selectedLocalities, selectedBhk, selectedTypes, selectedPoss, selectedAmenities, selectedPostedBy, selectedPurpose, selectedCategory, budgetPreset, minBudgetInput, maxBudgetInput, sortBy, getPropertyPosterRole, user, builderFilter]);

  return (
    <div className="listings-page">
      {/* Global Standard Navbar */}
      <Navbar
        solid={true}
        onOpenLogin={() => setAuthModalState('login')}
        onOpenRegister={() => setAuthModalState('register')}
      />

      <div className="lp-page" style={{ paddingTop: '80px' }}>
        {/* Breadcrumb */}
        <div className="lp-breadcrumb">
          <Link to="/">Home</Link>
          <span>/</span>
          <span>{selectedCategory === 'project' || projectOnly ? 'Builder Projects' : 'Properties'}</span>
        </div>

        {/* Header */}
        <div className="lp-list-header">
          <div>
            <h1 className="lp-list-title">
              {selectedCategory === 'project' || projectOnly ? 'New Builder Projects & Developments' : 'Properties and Projects in nearby area'}
            </h1>
            <p className="lp-list-meta">
              <strong>{filtered.length}</strong> matches across {properties.length} loaded listings · {pagination.total} total listings
            </p>
          </div>
          <button className="lp-mobile-filter-btn" onClick={() => setFiltersOpen(true)}>
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M4 6h16M4 12h10M4 18h6"/>
            </svg>
            Filters
          </button>
        </div>

        {/* Builder Quick Action Bar (Requirement 11) */}
        {user?.role === 'builder' && (
          <div className="lp-builder-action-bar">
            <div className="lp-builder-bar-label">
              <span className="lp-builder-badge">Builder Mode</span>
              <span className="lp-builder-name">{user?.builderProfile?.companyName || user?.name}</span>
            </div>
            <div className="lp-builder-buttons">
              <button
                type="button"
                className={`lp-builder-btn ${builderFilter === 'all' ? 'active' : ''}`}
                onClick={() => { setBuilderFilter('all'); setVisibleCount(6); }}
              >
                All Listings
              </button>
              <button
                type="button"
                className={`lp-builder-btn ${builderFilter === 'my_projects' ? 'active' : ''}`}
                onClick={() => { setBuilderFilter('my_projects'); setVisibleCount(6); }}
              >
                <Building2 size={15} /> My Projects
              </button>
              <button
                type="button"
                className={`lp-builder-btn ${builderFilter === 'my_properties' ? 'active' : ''}`}
                onClick={() => { setBuilderFilter('my_properties'); setVisibleCount(6); }}
              >
                <Layers size={15} /> My Properties
              </button>
              <Link
                to="/dashboard?tab=projects"
                className="lp-builder-btn lp-builder-btn-primary"
              >
                <Plus size={15} /> Add New Listing
              </Link>
            </div>
          </div>
        )}

        {/* Dedicated Functional Search Bar */}
        <div style={{ marginBottom: '18px' }}>
          <div style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            width: '100%',
            background: 'var(--surface)',
            border: '1.5px solid var(--border)',
            borderRadius: '14px',
            boxShadow: '0 2px 12px rgba(10,22,40,0.04)',
            padding: '4px 16px',
            transition: 'all 0.2s',
          }}>
            <Search size={18} style={{ color: 'var(--text-muted)', marginRight: '12px', flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Search by title, locality, city, state, builder, or property type (e.g. Villa, Mumbai, Luxury, Penthouse)..."
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
                setVisibleCount(6);
              }}
              style={{
                width: '100%',
                padding: '10px 0',
                border: 'none',
                outline: 'none',
                fontSize: '0.92rem',
                background: 'transparent',
                color: 'var(--text)',
              }}
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => { setSearchInput(''); setLocationSearch(''); }}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                }}
                title="Clear Search"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Quick filters */}
        <div className="lp-quick-filters">
          {[
            { key: 'all', label: 'All' },
            { key: 'wishlist', label: `Saved (${savedCount})`, isWishlist: true },
            { key: 'rera', label: 'RERA Registered', icon: true },
            { key: 'offers', label: 'Offers' },
            { key: 'ready', label: 'Ready to Move' },
            { key: 'possession', label: 'Possession this year' },
            { key: 'new', label: 'New Launch' },
          ].map(chip => (
            <button
              key={chip.key}
              className={`lp-qchip ${activeChip === chip.key ? 'active' : ''} ${chip.isWishlist && activeChip === chip.key ? '!bg-rose-600 !text-white !border-rose-600' : ''}`}
              onClick={() => {
                if (chip.key === 'wishlist' && !user) {
                  if (showToast) showToast('Please sign in to view your saved properties.', 'error');
                  setAuthModalState('login');
                  return;
                }
                setActiveChip(chip.key);
              }}
            >
              {chip.isWishlist && (
                <svg viewBox="0 0 24 24" fill={activeChip === 'wishlist' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5 text-rose-500 mr-1 inline-block">
                  <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
                </svg>
              )}
              {chip.icon && (
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/>
                </svg>
              )}
              {chip.label}
            </button>
          ))}

          <div className="lp-sort-wrap">
            <span>Sort by</span>
            <select value={sortBy} onChange={e => setSortBy(e.target.value)}>
              <option value="relevance">Relevance</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
              <option value="newest">Newest First</option>
            </select>
          </div>
        </div>

        {/* Main layout */}
        <div className="lp-main-layout">
          {/* Sidebar filters */}
          <aside className={`lp-filters ${filtersOpen ? 'open' : ''}`} onClick={e => { if (e.target.classList.contains('lp-filters')) setFiltersOpen(false); }}>
            <div className="lp-filter-header">
              <h3>Filters</h3>
              <button className="lp-clear-btn" onClick={clearFilters}>Clear All</button>
            </div>

            <div className="lp-filters-body">
              {/* Listing Category */}
            <div className="lp-filter-group">
              <div className="lp-filter-label">Listing Category</div>
              {[
                ['all', 'All Properties & Projects'],
                ['project', 'New Builder Projects Only'],
                ['property', 'Individual Resale / Direct Owner'],
              ].map(([val, label]) => (
                <label key={val} className="lp-check-item">
                  <input
                    type="radio"
                    name="listingCategory"
                    checked={selectedCategory === val}
                    onChange={() => {
                      setSelectedCategory(val);
                      if (val === 'project') setSelectedPostedBy(['builder']);
                      else if (val === 'all') setSelectedPostedBy([]);
                    }}
                  />
                  {label}
                </label>
              ))}
            </div>

            {/* Purpose (Buy vs Rent) */}
            <div className="lp-filter-group">
              <div className="lp-filter-label">Purpose (Buy / Rent)</div>
              {[
                ['all', 'All (Buy & Rent)'],
                ['buy', 'For Sale (Buy)'],
                ['rent', 'For Rent (Monthly Lease)'],
              ].map(([val, label]) => (
                <label key={val} className="lp-check-item">
                  <input
                    type="radio"
                    name="listingPurpose"
                    checked={selectedPurpose === val}
                    onChange={() => {
                      setSelectedPurpose(val);
                      setVisibleCount(6);
                    }}
                  />
                  {label}
                </label>
              ))}
            </div>

            {/* State Filter */}
            <div className="lp-filter-group">
              <div className="lp-filter-label">State / Union Territory</div>
              <select
                value={selectedState}
                onChange={(e) => {
                  setSelectedState(e.target.value);
                  setVisibleCount(6);
                }}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  border: '1.5px solid var(--border)',
                  borderRadius: '8px',
                  fontSize: '.82rem',
                  background: 'var(--surface)',
                  color: 'var(--text)',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              >
                <option value="">All States & UTs</option>
                {['Maharashtra', 'Karnataka', 'Gujarat', 'Delhi (NCT)', 'Haryana', 'Uttar Pradesh', 'Telangana', 'Goa'].map((st) => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
            </div>

            {/* City Filter */}
            <div className="lp-filter-group">
              <div className="lp-filter-label">City</div>
              {[
                ['mumbai', 'Mumbai', counts.city.mumbai],
                ['delhi', 'Delhi NCR / Gurugram / Noida', counts.city.delhi],
                ['bengaluru', 'Bangalore / Bengaluru', counts.city.bengaluru],
                ['pune', 'Pune', counts.city.pune],
                ['hyderabad', 'Hyderabad', counts.city.hyderabad],
                ['ahmedabad', 'Ahmedabad', counts.city.ahmedabad],
                ['goa', 'Goa', counts.city.goa],
                ['vadodara', 'Vadodara', counts.city.vadodara],
                ['anand', 'Anand', counts.city.anand],
              ].map(([val, label, count]) => (
                <label key={val} className="lp-check-item">
                  <input
                    type="checkbox"
                    checked={selectedCities.includes(val.toLowerCase())}
                    onChange={() => toggleCity(val.toLowerCase())}
                  />
                  {label}
                  <span className="count">{count || 0}</span>
                </label>
              ))}
            </div>

            {/* Location */}
            <div className="lp-filter-group">
              <div className="lp-filter-label">Locality & Area</div>
              <div style={{ position: 'relative', marginBottom: '10px' }}>
                <input
                  type="text"
                  className="lp-loc-search"
                  placeholder="Search area, locality..."
                  value={searchInput}
                  onChange={e => { setSearchInput(e.target.value); setVisibleCount(6); }}
                  style={{
                    width: '100%',
                    padding: '8px 32px 8px 10px',
                    border: '1.5px solid var(--border)',
                    borderRadius: '8px',
                    fontSize: '.82rem',
                    background: 'var(--bg)',
                    color: 'var(--text)',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
                {searchInput && (
                  <button
                    onClick={() => { setSearchInput(''); setLocationSearch(''); }}
                    style={{
                      position: 'absolute', right: '8px', top: '50%',
                      transform: 'translateY(-50%)', background: 'none',
                      border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
                      padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                    aria-label="Clear location search"
                  ><X size={14} /></button>
                )}
              </div>
              {/* Quick locality chips derived from property data */}
              {allLocalities.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {allLocalities.map(loc => (
                    <button
                      key={loc}
                      onClick={() => toggleLocality(loc)}
                      style={{
                        padding: '3px 10px',
                        borderRadius: '20px',
                        fontSize: '.75rem',
                        fontWeight: 500,
                        border: selectedLocalities.includes(loc)
                          ? '1.5px solid var(--navy)'
                          : '1.5px solid var(--border)',
                        background: selectedLocalities.includes(loc)
                          ? 'var(--navy)'
                          : 'transparent',
                        color: selectedLocalities.includes(loc)
                          ? '#fff'
                          : 'var(--text-muted)',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}
                    >
                      {loc}
                    </button>
                  ))}
                </div>
              )}
              {(selectedLocalities.length > 0 || locationSearch) && (
                <div style={{ marginTop: '6px', fontSize: '.75rem', color: 'var(--accent)' }}>
                  {selectedLocalities.length > 0
                    ? `Filtering: ${selectedLocalities.join(', ')}`
                    : `Searching: "${locationSearch}"`
                  }
                </div>
              )}
            </div>

            {/* RERA */}
            <div className="lp-filter-group">
              <div className="lp-filter-label">Verification</div>
              <label className="lp-check-item">
                <input type="checkbox" checked={reraOnly} onChange={e => setReraOnly(e.target.checked)} />
                RERA Registered Projects
              </label>
            </div>

            {/* Budget */}
            <div className="lp-filter-group">
              <div className="lp-filter-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Budget</span>
                {(budgetPreset || minBudgetInput || maxBudgetInput) && (
                  <button
                    type="button"
                    onClick={() => {
                      setBudgetPreset(null);
                      setMinBudgetInput('');
                      setMaxBudgetInput('');
                      setVisibleCount(6);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      fontSize: '.72rem',
                      color: 'var(--text-light)',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--danger, #e53e3e)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-light)'; }}
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="lp-budget-row">
                <input
                  type="text"
                  placeholder="Min"
                  value={minBudgetInput}
                  onChange={(e) => {
                    setMinBudgetInput(e.target.value);
                    setBudgetPreset(null);
                    setVisibleCount(6);
                  }}
                />
                <span>—</span>
                <input
                  type="text"
                  placeholder="Max"
                  value={maxBudgetInput}
                  onChange={(e) => {
                    setMaxBudgetInput(e.target.value);
                    setBudgetPreset(null);
                    setVisibleCount(6);
                  }}
                />
              </div>
              <div className="lp-budget-presets">
                {[
                  { label: 'Under ₹25L', min: 0, max: 2500000, minLabel: '', maxLabel: '25L' },
                  { label: '₹25–50L', min: 2500000, max: 5000000, minLabel: '25L', maxLabel: '50L' },
                  { label: '₹50L–1Cr', min: 5000000, max: 10000000, minLabel: '50L', maxLabel: '1Cr' },
                  { label: '₹1Cr–1.25Cr', min: 10000000, max: 12500000, minLabel: '1Cr', maxLabel: '1.25Cr' },
                  { label: '₹1.25Cr–1.5Cr', min: 12500000, max: 15000000, minLabel: '1.25Cr', maxLabel: '1.5Cr' },
                  { label: '₹1.5Cr–2Cr', min: 15000000, max: 20000000, minLabel: '1.5Cr', maxLabel: '2Cr' },
                  { label: 'Above ₹2Cr', min: 20000000, max: null, minLabel: '2Cr', maxLabel: '' },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    className={`lp-budget-preset ${budgetPreset?.label === preset.label ? 'active' : ''}`}
                    onClick={() => {
                      if (budgetPreset?.label === preset.label) {
                        setBudgetPreset(null);
                        setMinBudgetInput('');
                        setMaxBudgetInput('');
                      } else {
                        setBudgetPreset(preset);
                        setMinBudgetInput(preset.minLabel ? preset.minLabel : '');
                        setMaxBudgetInput(preset.maxLabel ? preset.maxLabel : '');
                      }
                      setVisibleCount(6);
                    }}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Bedroom */}
            <div className="lp-filter-group">
              <div className="lp-filter-label">Bedroom</div>
              {[
                ['1', '1 BHK', counts.bhk['1']],
                ['2', '2 BHK', counts.bhk['2']],
                ['3', '3 BHK', counts.bhk['3']],
                ['4', '4 BHK', counts.bhk['4']],
                ['5', '5+ BHK', counts.bhk['5']],
              ].map(([val, label, count]) => (
                <label key={val} className="lp-check-item">
                  <input
                    type="checkbox"
                    checked={selectedBhk.some(b => String(b) === String(val))}
                    onChange={() => toggleBhk(val)}
                  />
                  {label}
                  <span className="count">{count || 0}</span>
                </label>
              ))}
            </div>

            {/* Property Type */}
            <div className="lp-filter-group">
              <div className="lp-filter-label">Property Type</div>
              {[
                ['apartment', 'Apartment', counts.type.apartment],
                ['villa', 'Villa / Independent House', counts.type.villa],
                ['penthouse', 'Penthouse', counts.type.penthouse],
                ['farmhouse', 'Farmhouse / Country Estate', counts.type.farmhouse],
                ['commercial', 'Commercial (Office / Retail)', counts.type.commercial],
                ['plot', 'Plot / Land', counts.type.plot],
                ['studio', 'Studio Apartment', counts.type.studio],
                ['row_house', 'Row House / Duplex', counts.type.row_house],
              ].map(([val, label, count]) => (
                <label key={val} className="lp-check-item">
                  <input
                    type="checkbox"
                    checked={selectedTypes.some(t => t.toLowerCase() === val.toLowerCase() || t.toLowerCase().replace(/_/g, ' ') === val.toLowerCase().replace(/_/g, ' '))}
                    onChange={() => toggleType(val)}
                  />
                  {label}
                  <span className="count">{count || 0}</span>
                </label>
              ))}
            </div>

            {/* Possession */}
            <div className="lp-filter-group">
              <div className="lp-filter-label">Possession</div>
              {[
                ['ready', 'Ready to Move', counts.poss?.ready || 0],
                ['2026', '2026', counts.poss?.['2026'] || 0],
                ['2027', '2027', counts.poss?.['2027'] || 0],
                ['2028', '2028', counts.poss?.['2028'] || 0],
                ['2029', '2029+', counts.poss?.['2029'] || 0],
              ].map(([val, label, count]) => (
                <label key={val} className="lp-check-item">
                  <input type="checkbox" checked={selectedPoss.includes(val)} onChange={() => togglePoss(val)} />
                  {label}
                  <span className="count">{count}</span>
                </label>
              ))}
            </div>

            {/* Amenities */}
            <div className="lp-filter-group">
              <div className="lp-filter-label">Amenities</div>
              {[
                ['pool', 'Swimming Pool', counts.amenity?.pool || 0],
                ['gym', 'Gym', counts.amenity?.gym || 0],
                ['parking', 'Covered Parking', counts.amenity?.parking || 0],
                ['security', '24×7 Security', counts.amenity?.security || 0],
                ['club', 'Clubhouse', counts.amenity?.club || 0],
              ].map(([val, label, count]) => (
                <label key={val} className="lp-check-item">
                  <input type="checkbox" checked={selectedAmenities.includes(val)} onChange={() => toggleAmenity(val)} />
                  {label}
                  <span className="count">{count}</span>
                </label>
              ))}
            </div>

            {/* Posted By */}
            <div className="lp-filter-group">
              <div className="lp-filter-label">Posted By</div>
              {[
                ['builder', 'Builder', counts.postedBy?.builder || 0],
                ['agent', 'Agent', counts.postedBy?.agent || 0],
                ['owner', 'Owner', counts.postedBy?.owner || 0],
              ].map(([val, label, count]) => (
                <label key={val} className="lp-check-item">
                  <input type="checkbox" checked={selectedPostedBy.includes(val)} onChange={() => togglePostedBy(val)} />
                  {label}
                  <span className="count">{count}</span>
                </label>
              ))}
            </div>
          </div>
        </aside>

          {/* Listings */}
          <div>
            {/* Active filter badges */}
            {activeFilterTags.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', marginBottom: '16px', background: 'var(--surface)', padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--navy)' }}>Active Filters:</span>
                {activeFilterTags.map((tag, idx) => (
                  <span
                    key={idx}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      background: 'rgba(10,22,40,0.06)',
                      border: '1px solid var(--border)',
                      padding: '3px 10px',
                      borderRadius: '100px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: 'var(--navy)',
                    }}
                  >
                    {tag.label}
                    <button
                      type="button"
                      onClick={tag.clear}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}
                      title="Remove filter"
                    >
                      <X size={13} />
                    </button>
                  </span>
                ))}
                <button
                  type="button"
                  onClick={clearFilters}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: '#e11d48',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    padding: '2px 6px',
                    marginLeft: 'auto',
                  }}
                >
                  Clear All
                </button>
              </div>
            )}

            <div className="lp-results-bar">
              <span>
                Showing <strong>{filtered.length > 0 ? Math.min(visibleCount, filtered.length) : 0}</strong> loaded matches across <strong>{properties.length}</strong> listings
              </span>
              <span style={{ fontSize: '.8rem', color: 'var(--text-light)' }}>Updated just now</span>
            </div>

            <div className="lp-listings">
              {loading ? (
                Array.from({ length: 6 }).map((_, idx) => (
                  <article key={idx} className="lp-prop-card" style={{ cursor: 'default' }}>
                    <div className="lp-prop-img" style={{ minHeight: '220px', background: '#e2e8f0' }} />
                    <div className="lp-prop-body" style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '16px' }}>
                      <div style={{ height: '22px', background: '#e2e8f0', borderRadius: '6px', width: '75%' }} />
                      <div style={{ height: '14px', background: '#f1f5f9', borderRadius: '4px', width: '45%' }} />
                      <div style={{ height: '26px', background: '#e2e8f0', borderRadius: '6px', width: '35%', marginTop: '8px' }} />
                      <div style={{ display: 'flex', gap: '8px', marginTop: 'auto', paddingTop: '12px' }}>
                        <div style={{ height: '18px', background: '#f1f5f9', borderRadius: '4px', width: '60px' }} />
                        <div style={{ height: '18px', background: '#f1f5f9', borderRadius: '4px', width: '80px' }} />
                      </div>
                    </div>
                    <div className="lp-prop-right" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '16px' }}>
                      <div style={{ height: '18px', background: '#f1f5f9', borderRadius: '4px', width: '90px' }} />
                      <div style={{ height: '38px', background: '#e2e8f0', borderRadius: '8px', width: '100%' }} />
                    </div>
                  </article>
                ))
              ) : filtered.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', background: '#fff', borderRadius: '16px', border: '1px solid var(--border)', gridColumn: '1 / -1' }}>
                  <div className="w-14 h-14 rounded-2xl bg-slate-100 border border-slate-200 text-slate-500 flex items-center justify-center mx-auto mb-3.5 shadow-2xs">
                    <Search size={24} className="text-slate-600" />
                  </div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--navy)', marginBottom: '8px' }}>No properties found</h3>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', maxWidth: '420px', margin: '0 auto 22px', lineHeight: 1.5 }}>
                    We couldn't find any properties matching your exact filter criteria. Try expanding your search or clearing your active filters.
                  </p>
                  <button
                    onClick={clearFilters}
                    style={{
                      background: 'var(--navy)',
                      color: '#fff',
                      padding: '10px 26px',
                      borderRadius: '8px',
                      fontWeight: 600,
                      fontSize: '0.85rem',
                      border: 'none',
                      cursor: 'pointer',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                    }}
                  >
                    Clear All Filters
                  </button>
                </div>
              ) : (
                filtered.slice(0, visibleCount).map(prop => (
                  <article
                    key={prop.id}
                    className={`lp-prop-card ${typeof prop.id === 'string' ? 'lp-clickable' : ''}`}
                    onClick={() => typeof prop.id === 'string' && navigate(`/property/${prop.id}`)}
                    style={{ cursor: typeof prop.id === 'string' ? 'pointer' : 'default' }}
                  >
                    <div className="lp-prop-img">
                      <img
                        src={prop.img || (Array.isArray(prop.images) && prop.images[0]) || prop.image || 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=800&auto=format&fit=crop'}
                        alt={prop.name || 'Property'}
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = (Array.isArray(prop.images) && prop.images[0]) || 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=800&auto=format&fit=crop';
                        }}
                      />
                      <span
                        style={{
                          position: 'absolute',
                          top: '10px',
                          right: '10px',
                          background: prop.purpose === 'rent' ? '#059669' : '#0f172a',
                          color: '#fff',
                          fontSize: '0.65rem',
                          fontWeight: 700,
                          letterSpacing: '0.06em',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          textTransform: 'uppercase',
                          zIndex: 2,
                          boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
                        }}
                      >
                        {prop.purpose === 'rent' ? 'For Rent' : 'For Sale'}
                      </span>
                      {prop.rera && (
                        <span className="lp-prop-badge">
                          <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
                          </svg>
                          RERA
                        </span>
                      )}
                      <span className="lp-prop-photos">
                        {prop.videos > 0 && prop.photos > 0 ? (
                          <>
                            <span className="inline-flex items-center gap-1">
                              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <rect x="3" y="3" width="18" height="18" rx="2"/>
                                <circle cx="8.5" cy="8.5" r="1.5"/>
                                <path d="M21 15l-5-5L5 21"/>
                              </svg>
                              <span>{prop.photos} {prop.photos === 1 ? 'Photo' : 'Photos'}</span>
                            </span>
                            <span className="opacity-50">·</span>
                            <span className="inline-flex items-center gap-1">
                              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <polygon points="23 7 16 12 23 17 23 7" />
                                <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                              </svg>
                              <span>{prop.videos} {prop.videos === 1 ? 'Video' : 'Videos'}</span>
                            </span>
                          </>
                        ) : prop.videos > 0 ? (
                          <span className="inline-flex items-center gap-1">
                            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <polygon points="23 7 16 12 23 17 23 7" />
                              <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                            </svg>
                            <span>{prop.videos} {prop.videos === 1 ? 'Video' : 'Videos'}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1">
                            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <rect x="3" y="3" width="18" height="18" rx="2"/>
                              <circle cx="8.5" cy="8.5" r="1.5"/>
                              <path d="M21 15l-5-5L5 21"/>
                            </svg>
                            <span>{prop.photos || 1} {prop.photos === 1 ? 'Photo' : 'Photos'}</span>
                          </span>
                        )}
                      </span>
                    </div>

                    <div className="lp-prop-body">
                      <div className="lp-prop-top">
                        <h2 className="lp-prop-name">{prop.name}</h2>
                        <p className="lp-prop-loc">
                          <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
                            <circle cx="12" cy="10" r="3"/>
                          </svg>
                          {prop.location}
                        </p>
                      </div>
                      <div>
                        <div className="lp-prop-type">{prop.type}</div>
                        <div className="lp-prop-price">{prop.priceDisplay}</div>
                        <div className="lp-prop-price-sub">{prop.priceSub}</div>
                      </div>
                      <div className="lp-prop-usps">
                        {prop.usps.map((usp, i) => (
                          <span key={i} className="lp-prop-usp">{usp}</span>
                        ))}
                      </div>
                    </div>

                    <div className="lp-prop-right">
                      <div className="lp-prop-status">
                        <div className={`lp-status-label ${prop.ready ? 'lp-status-ready' : ''}`}>{prop.statusLabel}</div>
                        <div className="lp-status-date">{prop.statusDate}</div>
                      </div>
                      <div className="lp-prop-actions">
                        {typeof prop.id === 'string' ? (
                          <Link
                            to={`/property/${prop.id}`}
                            className="lp-btn-primary"
                            onClick={e => e.stopPropagation()}
                          >View Details</Link>
                        ) : (
                          <span className="lp-btn-primary" style={{opacity:.45, cursor:'not-allowed'}} title="Demo listing">View Details</span>
                        )}
                        <button
                          type="button"
                          className="lp-btn-share"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShareModalProp(prop);
                          }}
                          title="Share property details"
                        >
                          <Share2 size={13} />
                          <span>Share</span>
                        </button>
                      </div>
                    </div>
                  </article>
                ))
              )}
            </div>

            <div className="lp-load-more" style={{ marginTop: '32px', textAlign: 'center' }}>
              {visibleCount < filtered.length || pagination.page < pagination.totalPages ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                  <button
                    className="lp-load-more-btn"
                    onClick={handleLoadMore}
                    style={{
                      background: 'var(--navy)',
                      color: '#fff',
                      padding: '12px 32px',
                      borderRadius: '10px',
                      fontWeight: 600,
                      fontSize: '0.9rem',
                      border: 'none',
                      cursor: 'pointer',
                      boxShadow: '0 4px 14px rgba(15, 23, 42, 0.15)',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    {loadingMore ? 'Loading listings…' : visibleCount < filtered.length ? 'See More Properties' : 'Load more listings'}
                  </button>
                </div>
              ) : filtered.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <Check size={14} className="text-emerald-500 shrink-0" />
                    <span>Showing all {filtered.length} {selectedCategory === 'project' || projectOnly ? 'projects' : 'properties'}</span>
                  </p>
                  <button
                    className="lp-load-more-btn"
                    onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                    style={{
                      background: '#f1f5f9',
                      color: 'var(--navy)',
                      padding: '8px 20px',
                      borderRadius: '8px',
                      fontWeight: 600,
                      fontSize: '0.8rem',
                      border: '1px solid var(--border)',
                      cursor: 'pointer',
                    }}
                  >
                    Back to Top ↑
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* Global Standard Footer */}
      <Footer />

      {/* Auth Modals — forms are lazy-loaded; Suspense shows fallback while chunk downloads */}
      <Modal
        isOpen={authModalState === 'login'}
        onClose={() => setAuthModalState(null)}
        title="Sign In to EstateXplorer"
      >
        <Suspense fallback={AUTH_MODAL_FALLBACK}>
          <LoginForm
            onSuccess={() => setAuthModalState(null)}
            onSwitchToRegister={(email) => {
              if (email) setAuthModalEmail(email);
              setAuthModalState('register');
            }}
            onSwitchToForgot={() => setAuthModalState('forgot')}
          />
        </Suspense>
      </Modal>

      <Modal
        isOpen={authModalState === 'register'}
        onClose={() => setAuthModalState(null)}
        title="Create your EstateXplorer Account"
      >
        <Suspense fallback={AUTH_MODAL_FALLBACK}>
          <RegisterForm
            initialEmail={authModalEmail}
            onSuccess={() => setAuthModalState(null)}
            onSwitchToLogin={() => setAuthModalState('login')}
          />
        </Suspense>
      </Modal>

      <Modal
        isOpen={authModalState === 'forgot'}
        onClose={() => setAuthModalState(null)}
        title="Reset Your Password"
      >
        <Suspense fallback={AUTH_MODAL_FALLBACK}>
          <ForgotForm
            onOtpSent={(email) => {
              setAuthModalState(null);
              navigate('/reset-password', { state: { email } });
            }}
            onBackToLogin={() => setAuthModalState('login')}
          />
        </Suspense>
      </Modal>

      {/* Professional Property Share Modal */}
      <ShareModal
        isOpen={!!shareModalProp}
        onClose={() => setShareModalProp(null)}
        property={shareModalProp}
      />
    </div>
  );
};

export default Listings;
