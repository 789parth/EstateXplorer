import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { X, Building2, MapPin, IndianRupee, Image as ImageIcon, Video, Play, Film, ExternalLink, Loader2, Calendar } from 'lucide-react';
import Input from '../common/Input';
import Button from '../common/Button';
import { createProperty, updateProperty, uploadMultipleImages } from '../../services/propertyService';
import { useAuth } from '../../hooks/useAuth';
import { INDIAN_STATES } from '../../utils/indianStates';
import { formatPrice, formatTitleCase, formatCode, sanitizeInput, getPublicImageUrl, isVideoUrl } from '../../utils/formatters';
import KycVerificationModal from './KycVerificationModal';

const AddPropertyModal = ({ isOpen, onClose, onSuccess, initialData = null }) => {
  const { user, showToast } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [images, setImages] = useState(['']);
  const [showKycModal, setShowKycModal] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    trigger,
    clearErrors,
    formState: { errors },
    watch
  } = useForm({
    defaultValues: {
      category: 'property',
      purpose: 'buy',
      type: '2 BHK Apartment',
      status: 'under_construction',
      bhk: 2,
      rera: false,
      allowAgentAcquisition: false
    }
  });

  const watchedPrice = watch('price');
  const watchedArea = watch('area');
  const watchedPurpose = watch('purpose');
  const watchedCategory = watch('category');
  const watchedRera = watch('rera');

  React.useEffect(() => {
    if (!watchedRera) {
      setValue('reraId', '');
      clearErrors('reraId');
    } else {
      trigger('reraId');
    }
  }, [watchedRera, setValue, clearErrors, trigger]);

  const computedDisplayPrice = React.useMemo(() => {
    if (!watchedPrice || Number(watchedPrice) <= 0) return '';
    return formatPrice(Number(watchedPrice), null, watchedPurpose || 'buy');
  }, [watchedPrice, watchedPurpose]);

  const computedPriceSub = React.useMemo(() => {
    const p = Number(watchedPrice) || 0;
    const a = Number(watchedArea) || 0;
    if (p > 0 && a > 0) {
      const rate = Math.round(p / a);
      return `₹ ${rate.toLocaleString('en-IN')} / Sq.Ft`;
    }
    return '';
  }, [watchedPrice, watchedArea]);

  React.useEffect(() => {
    if (initialData && isOpen) {
      reset({
        title: initialData.title || '',
        category: initialData.category || 'property',
        purpose: initialData.purpose || 'buy',
        type: initialData.type || '2 BHK Apartment',
        description: initialData.description || '',
        price: initialData.price || '',
        bhk: initialData.bhk || '',
        area: initialData.area || '',
        status: initialData.status || 'ready',
        statusLabel: initialData.statusLabel || '',
        statusDate: (() => {
          if (!initialData.statusDate) return '';
          // If already YYYY-MM-DD
          if (/^\d{4}-\d{2}-\d{2}$/.test(initialData.statusDate)) return initialData.statusDate;
          // Try parse date
          const parsed = new Date(initialData.statusDate);
          if (!isNaN(parsed.getTime())) {
            return parsed.toISOString().split('T')[0];
          }
          // Check for month year (e.g. Dec 2027)
          const match = initialData.statusDate.match(/([a-zA-Z]+)\s+(\d{4})/);
          if (match) {
            const months = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };
            const m = months[match[1].slice(0, 3).toLowerCase()] || '01';
            return `${match[2]}-${m}-01`;
          }
          return '';
        })(),
        city: initialData.location?.city || '',
        state: initialData.location?.state || 'Gujarat',
        address: initialData.location?.address || '',
        rera: initialData.rera || false,
        reraId: initialData.reraId || '',
        uspsString: initialData.usps ? initialData.usps.join(', ') : '',
        amenitiesString: initialData.amenities ? initialData.amenities.join(', ') : '',
        isFeatured: initialData.isFeatured || false,
        allowAgentAcquisition: Boolean(initialData.allowAgentAcquisition ?? initialData.networkEnabled),
      });
      setImages(initialData.images && initialData.images.length > 0 ? initialData.images : ['']);
    } else if (isOpen) {
      reset({
        title: '',
        category: 'property',
        purpose: 'buy',
        type: '2 BHK Apartment',
        description: '',
        price: '',
        bhk: 2,
        area: '',
        status: 'ready',
        statusLabel: '',
        statusDate: '',
        city: '',
        state: 'Gujarat',
        address: '',
        rera: false,
        reraId: '',
        uspsString: '',
        amenitiesString: '',
        isFeatured: false,
        allowAgentAcquisition: false,
      });
      setImages(['']);
    }
  }, [initialData, isOpen, reset]);

  if (!isOpen) return null;

  const onSubmit = async (data) => {
    setSubmitting(true);
    try {
      // Process images array (remove empty strings)
      const validImages = images.filter(img => img.trim() !== '');
      if (validImages.length === 0) {
        showToast('Please add at least one image URL', 'error');
        setSubmitting(false);
        return;
      }

      // Process amenities/usps from comma separated strings
      const amenities = data.amenitiesString ? data.amenitiesString.split(',').map(i => sanitizeInput(i)).filter(Boolean) : [];
      const usps = data.uspsString ? data.uspsString.split(',').map(i => sanitizeInput(i)).filter(Boolean) : [];

      const numPrice = Number(data.price) || 0;
      const numArea = Number(data.area) || 0;
      const purpose = data.purpose || 'buy';

      // Auto-compute priceDisplay and priceSub
      const autoPriceDisplay = formatPrice(numPrice, null, purpose);
      const autoPriceSub = (numPrice > 0 && numArea > 0)
        ? `₹ ${Math.round(numPrice / numArea).toLocaleString('en-IN')} / Sq.Ft`
        : '';

      const payload = {
        title: sanitizeInput(data.title),
        description: data.description ? data.description.trim() : '',
        type: data.type,
        category: user?.role === 'owner' ? 'property' : (data.category || 'property'),
        purpose: purpose,
        price: numPrice,
        priceDisplay: autoPriceDisplay,
        priceSub: autoPriceSub,
        bhk: Number(data.bhk) || 0,
        area: numArea,
        location: {
          city: formatTitleCase(data.city),
          address: sanitizeInput(data.address),
          state: formatTitleCase(data.state || 'Gujarat'),
        },
        status: data.status,
        statusLabel: data.statusLabel ? sanitizeInput(data.statusLabel) : (
          data.status === 'ready' ? 'Ready To Move' : data.status === 'upcoming' ? 'Upcoming' : 'Under Construction'
        ),
        statusDate: (() => {
          if (!data.statusDate) return '';
          if (/^\d{4}-\d{2}-\d{2}$/.test(data.statusDate)) {
            const [y, m, d] = data.statusDate.split('-');
            const dateObj = new Date(Number(y), Number(m) - 1, Number(d));
            if (!isNaN(dateObj.getTime())) {
              const formatted = dateObj.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
              return `Possession: ${formatted}`;
            }
          }
          return sanitizeInput(data.statusDate);
        })(),
        amenities,
        usps,
        images: validImages,
        reraId: data.rera ? formatCode(data.reraId) : '',
        rera: Boolean(data.rera),
        isFeatured: data.isFeatured,
        allowAgentAcquisition: Boolean(data.allowAgentAcquisition),
        networkEnabled: Boolean(data.allowAgentAcquisition),
      };

      let res;
      if (initialData) {
        const propId = initialData._id || initialData.id;
        res = await updateProperty(propId, payload);
      } else {
        res = await createProperty(payload);
      }
      
      if (res.success) {
        showToast(initialData ? 'Listing updated successfully!' : 'Listing created successfully!', 'success');
        reset();
        setImages(['']);
        onSuccess(); // Refresh list and close
      }
    } catch (err) {
      if (err.response?.data?.requiresKyc) {
        showToast(err.response?.data?.message || 'Mandatory document verification required.', 'warning');
        setShowKycModal(true);
      } else {
        showToast(err.response?.data?.message || (initialData ? 'Failed to update listing' : 'Failed to create listing'), 'error');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleFilesUpload = async (files) => {
    if (!files || !files.length) return;
    try {
      setUploadingFiles(true);
      const res = await uploadMultipleImages(files);
      if (res.success && (res.urls || res.data)) {
        const rawUrls = res.urls || (Array.isArray(res.data) ? res.data.map(d => d.url) : [res.data?.url]).filter(Boolean);
        const resolvedUrls = rawUrls.map(u => getPublicImageUrl(u));
        setImages(prev => {
          const existing = prev.filter(x => x.trim() !== '');
          return [...existing, ...resolvedUrls];
        });
        showToast(`${files.length} photo/video file(s) uploaded successfully!`, 'success');
      }
    } catch (err) {
      console.error('File upload error:', err);
      showToast(err.response?.data?.message || 'Failed to upload photo/video file(s)', 'error');
    } finally {
      setUploadingFiles(false);
    }
  };

  const addImageField = () => setImages([...images, '']);
  const updateImage = (index, value) => {
    const newImages = [...images];
    newImages[index] = value;
    setImages(newImages);
  };
  const removeImageField = (index) => {
    if (images.length > 1) {
      const newImages = [...images];
      newImages.splice(index, 1);
      setImages(newImages);
    } else {
      setImages(['']);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-navy/50 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl my-3 sm:my-8 relative overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-100 sticky top-0 bg-white z-10 shrink-0">
          <div className="min-w-0 pr-2">
            <h2 className="text-lg sm:text-xl font-bold text-navy truncate">{initialData ? 'Edit Listing' : 'Add New Listing'}</h2>
            <p className="text-xs sm:text-sm text-muted truncate">
              {initialData
                ? 'Update the details of your listing.'
                : user?.role === 'owner'
                ? 'Create a new individual property listing.'
                : 'Create a new project or property listing.'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-muted hover:text-navy hover:bg-slate-100 rounded-lg transition-colors cursor-pointer shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1">
          <form id="add-property-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            
            {/* Basic Info */}
            <div>
              <h3 className="text-sm font-semibold text-navy uppercase tracking-wider mb-4 border-b border-light pb-2">Basic Info</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <Input
                    label="Listing Title"
                    required={true}
                    placeholder="e.g. Godrej Woods Estate"
                    icon={Building2}
                    error={errors.title?.message}
                    {...register('title', {
                      required: 'Listing title is required',
                      minLength: { value: 3, message: 'Title must be at least 3 characters' }
                    })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Category <span className="text-rose-500 font-bold">*</span>
                  </label>
                  {user?.role === 'owner' ? (
                    <div>
                      <input
                        type="text"
                        value="Individual Property"
                        readOnly
                        disabled
                        className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-300 rounded-lg text-sm text-slate-700 font-medium cursor-not-allowed select-none shadow-2xs"
                      />
                      <input type="hidden" value="property" {...register('category')} />
                    </div>
                  ) : (
                    <select
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-navy focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-2xs font-medium"
                      {...register('category', { required: true })}
                    >
                      <option value="property">Individual Property</option>
                      <option value="project">New Project</option>
                    </select>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Listing Purpose <span className="text-rose-500 font-bold">*</span>
                  </label>
                  <select
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-navy focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-2xs font-medium"
                    {...register('purpose', { required: true })}
                  >
                    <option value="buy">For Sale (Buy)</option>
                    <option value="rent">For Rent (Monthly Lease)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Property Type <span className="text-rose-500 font-bold">*</span>
                  </label>
                  <select
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-navy focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-2xs font-medium"
                    {...register('type', { required: true })}
                  >
                    <option value="1 BHK Apartment">1 BHK Apartment</option>
                    <option value="2 BHK Apartment">2 BHK Apartment</option>
                    <option value="3 BHK Apartment">3 BHK Apartment</option>
                    <option value="4 BHK Apartment">4 BHK Apartment</option>
                    <option value="3 BHK Villa">3 BHK Villa</option>
                    <option value="4 BHK Villa">4 BHK Villa</option>
                    <option value="5+ BHK Luxury Villa">5+ BHK Luxury Villa</option>
                    <option value="Penthouse">Penthouse</option>
                    <option value="Studio Apartment">Studio Apartment</option>
                    <option value="Row House / Duplex">Row House / Duplex</option>
                    <option value="Commercial Office Space">Commercial Office Space</option>
                    <option value="Commercial Retail Shop">Commercial Retail Shop</option>
                    <option value="Residential Plot / Land">Residential Plot / Land</option>
                    <option value="Farmhouse / Country Estate">Farmhouse / Country Estate</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Description <span className="text-rose-500 font-bold">*</span>
                    </label>
                  </div>
                  <textarea
                    rows="3"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-navy focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-2xs"
                    placeholder="Detailed description of the property, features, connectivity, highlights..."
                    {...register('description', {
                      required: 'Description is required',
                      minLength: { value: 10, message: 'Description should be at least 10 characters' }
                    })}
                  ></textarea>
                  {errors.description && <p className="text-xs text-rose-500 font-medium mt-1">{errors.description.message}</p>}
                </div>
              </div>
            </div>

            {/* Pricing & Details */}
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-light pb-2 mb-4">
                <h3 className="text-sm font-semibold text-navy uppercase tracking-wider">Pricing & Details</h3>
                {computedDisplayPrice && (
                  <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200/60 flex items-center gap-1.5 shadow-2xs">
                    <span>Auto-calculated: <strong>{computedDisplayPrice}</strong></span>
                    {computedPriceSub && <span>• <strong>{computedPriceSub}</strong></span>}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input
                  label="Exact Price (₹)"
                  type="number"
                  min="0"
                  step="any"
                  required={true}
                  placeholder="e.g. 4500000"
                  icon={IndianRupee}
                  error={errors.price?.message}
                  onKeyDown={(e) => {
                    if (e.key === '-' || e.key === 'e' || e.key === 'E' || e.key === '+') {
                      e.preventDefault();
                    }
                  }}
                  {...register('price', {
                    required: 'Price is required',
                    min: { value: 1, message: 'Price must be greater than 0' },
                    validate: (value) => Number(value) > 0 || 'Price must be greater than 0'
                  })}
                />
                <Input
                  label="Area (Sq.Ft)"
                  type="number"
                  min="1"
                  step="any"
                  required={true}
                  placeholder="e.g. 860"
                  error={errors.area?.message}
                  onKeyDown={(e) => {
                    if (e.key === '-' || e.key === 'e' || e.key === 'E' || e.key === '+') {
                      e.preventDefault();
                    }
                  }}
                  {...register('area', {
                    required: 'Area is required',
                    min: { value: 1, message: 'Area must be at least 1 sq.ft' },
                    validate: (value) => Number(value) >= 1 || 'Area must be at least 1 sq.ft'
                  })}
                />
                
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Status <span className="text-rose-500 font-bold">*</span>
                  </label>
                  <select
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-navy focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-2xs font-medium"
                    {...register('status', { required: true })}
                  >
                    <option value="uc">Under Construction</option>
                    <option value="ready">Ready To Move</option>
                    <option value="upcoming">Upcoming</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <Input
                    label="Possession / Launch Date "
                    type="date"
                    optional={true}
                    icon={Calendar}
                    className="cursor-pointer"
                    {...register('statusDate')}
                  />
                </div>
              </div>
            </div>

            {/* Location & Legal */}
            <div>
              <h3 className="text-sm font-semibold text-navy uppercase tracking-wider mb-4 border-b border-light pb-2">Location & Legal</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="City"
                  required={true}
                  placeholder="e.g. Anand"
                  icon={MapPin}
                  error={errors.city?.message}
                  {...register('city', {
                    required: 'City is required',
                    minLength: { value: 2, message: 'City name must be valid' }
                  })}
                />
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                      State / Union Territory <span className="text-rose-500 font-bold">*</span>
                    </label>
                  </div>
                  <select
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-navy focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-2xs font-medium"
                    {...register('state', { required: 'State is required' })}
                  >
                    <option value="">Select State</option>
                    {INDIAN_STATES.map((st) => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                  {errors.state && <p className="text-xs text-rose-500 font-medium mt-1">{errors.state.message}</p>}
                </div>
                <Input
                  label="Full Address / Locality"
                  required={true}
                  placeholder="e.g. Vallabh Vidhyanagar"
                  error={errors.address?.message}
                  {...register('address', {
                    required: 'Address is required',
                    minLength: { value: 3, message: 'Address must be at least 3 characters' }
                  })}
                />
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <input type="checkbox" id="rera" className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer" {...register('rera')} />
                    <label htmlFor="rera" className="text-xs font-bold text-slate-700 uppercase tracking-wider cursor-pointer">RERA Registered</label>
                  </div>
                  <Input
                    label="RERA ID"
                    required={Boolean(watchedRera)}
                    optional={!watchedRera}
                    disabled={!watchedRera}
                    placeholder={watchedRera ? "e.g. PR/GJ/ANAND/..." : "Enable 'RERA Registered' to enter RERA ID"}
                    error={errors.reraId?.message}
                    {...register('reraId', {
                      validate: (val) => {
                        if (watchedRera && (!val || !val.trim())) {
                          return 'RERA ID is required when RERA Registered is selected';
                        }
                        return true;
                      }
                    })}
                  />
                </div>
              </div>
            </div>

            {/* Amenities & Media */}
            <div>
              <h3 className="text-sm font-semibold text-navy uppercase tracking-wider mb-4 border-b border-light pb-2">Features & Media</h3>
              <div className="space-y-4">
                <Input
                  label="USPs / Key Highlights"
                  optional={true}
                  placeholder="e.g. Rooftop garden, Power backup, Play area (comma separated)"
                  {...register('uspsString')}
                />
                <Input
                  label="Amenities"
                  optional={true}
                  placeholder="e.g. Gym, Swimming Pool, Security (comma separated)"
                  {...register('amenitiesString')}
                />
                
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Property Photos &amp; Videos <span className="text-rose-500 font-bold">*</span>
                    </label>
                    <span className="text-[0.7rem] text-muted font-medium">Upload photos/videos or paste media links (at least 1 required)</span>
                  </div>

                  {/* Drag & Drop / File Upload Area */}
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault();
                      setIsDragging(false);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragging(false);
                      const droppedFiles = Array.from(e.dataTransfer.files || []).filter(f => f.type.startsWith('image/') || f.type.startsWith('video/'));
                      if (droppedFiles.length) {
                        handleFilesUpload(droppedFiles);
                      }
                    }}
                    className={`mb-4 p-5 border-2 border-dashed rounded-xl text-center transition-all ${
                      isDragging
                        ? 'border-blue-600 bg-blue-50/80 scale-[1.01]'
                        : 'border-slate-300 bg-slate-50/70 hover:bg-slate-100/80 hover:border-slate-400'
                    }`}
                  >
                    <input
                      type="file"
                      id="property-file-upload"
                      multiple
                      accept="image/png, image/jpeg, image/jpg, image/webp, image/gif, image/avif, video/mp4, video/webm, video/ogg, video/quicktime, .mp4, .webm, .mov, .m4v"
                      className="hidden"
                      onChange={(e) => {
                        const files = Array.from(e.target.files || []);
                        handleFilesUpload(files);
                        e.target.value = '';
                      }}
                    />
                    <label htmlFor="property-file-upload" className="cursor-pointer flex flex-col items-center justify-center gap-1.5">
                      <div className="w-11 h-11 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shadow-xs">
                        {uploadingFiles ? <Loader2 size={22} className="animate-spin" /> : <Film size={22} />}
                      </div>
                      <span className="text-xs font-bold text-slate-800">
                        {uploadingFiles ? 'Uploading media to database...' : 'Click to browse or drag & drop photos & videos'}
                      </span>
                      <span className="text-[0.7rem] text-slate-500 font-medium">PNG, JPG, WEBP, MP4, WEBM, MOV up to 50MB each</span>
                    </label>
                  </div>

                  {/* Previews with Open Link & Delete Actions */}
                  {images.filter(x => x && x.trim() !== '').length > 0 && (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 mb-3.5">
                      {images.filter(x => x && x.trim() !== '').map((img, idx) => {
                        const resolvedSrc = getPublicImageUrl(img);
                        const isVid = isVideoUrl(img);
                        return (
                          <div key={idx} className="relative group rounded-xl overflow-hidden border border-slate-200 aspect-video bg-slate-900 shadow-xs">
                            {isVid ? (
                              <div className="relative w-full h-full flex items-center justify-center bg-slate-900">
                                <video
                                  src={resolvedSrc}
                                  preload="metadata"
                                  className="w-full h-full object-cover opacity-80"
                                />
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                  <div className="w-8 h-8 rounded-full bg-black/60 backdrop-blur-xs text-white flex items-center justify-center">
                                    <Play size={14} className="fill-white translate-x-0.5" />
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <img
                                src={resolvedSrc}
                                alt={`Upload preview ${idx + 1}`}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.src = 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=400&auto=format&fit=crop';
                                }}
                              />
                            )}

                            {/* Overlay Actions */}
                            <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-1.5 z-10">
                              <a
                                href={resolvedSrc}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-7 h-7 rounded-full bg-white/90 hover:bg-white text-slate-800 flex items-center justify-center shadow-sm transition-transform hover:scale-110"
                                title="Open full media in new tab"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <ExternalLink size={13} />
                              </a>
                              <button
                                type="button"
                                onClick={() => removeImageField(idx)}
                                className="w-7 h-7 rounded-full bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center shadow-sm transition-transform hover:scale-110"
                                title="Remove media"
                              >
                                <X size={13} />
                              </button>
                            </div>
                            <span className="absolute bottom-1 left-1.5 text-[0.62rem] font-bold text-white bg-slate-900/80 backdrop-blur-xs px-1.5 py-0.5 rounded flex items-center gap-1 z-10">
                              {isVid && <Video size={10} />}
                              <span>#{idx + 1} {isVid ? 'VIDEO' : ''}</span>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="space-y-2">
                    {images.map((img, idx) => {
                      const isVid = isVideoUrl(img);
                      return (
                        <div key={idx} className="flex items-center gap-2">
                          <div className="relative flex-1">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                              {isVid ? <Video size={16} className="text-blue-600" /> : <ImageIcon size={16} />}
                            </div>
                            <input
                              type="text"
                              value={img}
                              onChange={(e) => updateImage(idx, e.target.value)}
                              placeholder="https://... or /uploads/... (Photo or Video URL)"
                              className="w-full pl-10 pr-9 py-2 bg-white border border-light rounded-lg text-xs sm:text-sm text-navy focus:outline-none focus:border-blue-mid focus:ring-1 focus:ring-blue-mid truncate"
                            />
                            {img && img.trim() !== '' && (
                              <a
                                href={getPublicImageUrl(img)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-blue-600 transition-colors"
                                title="Open media in new tab"
                              >
                                <ExternalLink size={14} />
                              </a>
                            )}
                          </div>
                          {images.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeImageField(idx)}
                              className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg shrink-0 transition-colors"
                              title="Remove media URL"
                            >
                              <X size={18} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <button type="button" onClick={addImageField} className="mt-2 text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors inline-flex items-center gap-1">
                    + Add Another Photo or Video URL
                  </button>
                </div>
                
                <div className="flex items-center gap-2 mt-4 p-3 bg-blue-50/50 rounded-lg border border-blue-100">
                  <input type="checkbox" id="isFeatured" className="w-4 h-4 rounded border-light text-blue-mid" {...register('isFeatured')} />
                  <label htmlFor="isFeatured" className="text-sm font-medium text-navy cursor-pointer">
                    Feature this listing on the Home Page
                  </label>
                </div>

                {/* Allow Agents to Acquire / Represent This Project / Property */}
                <div className="flex items-start gap-2.5 mt-3 p-3 bg-emerald-50/60 rounded-lg border border-emerald-200/80">
                  <input
                    type="checkbox"
                    id="allowAgentAcquisition"
                    className="w-4 h-4 mt-0.5 rounded border-emerald-400 text-emerald-600 focus:ring-emerald-500 cursor-pointer shrink-0"
                    {...register('allowAgentAcquisition')}
                  />
                  <div>
                    <label htmlFor="allowAgentAcquisition" className="text-xs sm:text-sm font-bold text-slate-900 cursor-pointer block">
                      Allow Agents to Acquire / Represent This {watchedCategory === 'project' ? 'Project' : 'Property'}
                    </label>
                    <span className="text-[0.72rem] text-slate-600 block mt-0.5 leading-relaxed">
                      When checked, registered agents can discover this {watchedCategory === 'project' ? 'project' : 'property'} in <strong>Agent Dashboard → Find Projects &amp; Properties</strong>, view details, and request to become an affiliated selling agent.
                    </span>
                  </div>
                </div>
              </div>
            </div>

          </form>
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-t border-slate-100 bg-slate-50/70 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 shrink-0 sticky bottom-0 z-10">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={submitting}
            className="w-full sm:w-auto px-6 py-2 text-xs sm:text-sm font-bold min-w-[100px]"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="add-property-form"
            variant="primary"
            isLoading={submitting}
            className="w-full sm:w-auto px-6 py-2 text-xs sm:text-sm font-bold min-w-[140px]"
          >
            {initialData ? 'Update Property' : 'Save Property'}
          </Button>
        </div>
      </div>

      {/* KYC Verification Modal */}
      <KycVerificationModal
        isOpen={showKycModal}
        onClose={() => setShowKycModal(false)}
        user={user}
        showToast={showToast}
        onVerificationSubmitted={(kycData) => {
          if (user) user.kycVerification = kycData;
        }}
      />
    </div>
  );
};

export default AddPropertyModal;
