import api from './api';

// High-speed client-side in-memory cache with Stale-While-Revalidate (0ms instant UI rendering)
const clientCache = new Map();
const CLIENT_CACHE_TTL = 120 * 1000; // 2 minutes fresh TTL

export const invalidateClientPropertyCache = () => {
  clientCache.clear();
};
if (typeof window !== 'undefined') {
  window.__invalidateClientPropertyCache = invalidateClientPropertyCache;
}

export const createProperty = async (propertyData) => {
  invalidateClientPropertyCache();
  const response = await api.post('/properties', propertyData);
  return response.data;
};

export const getProperties = async (params = {}, options = { useCache: true }) => {
  const cacheKey = `properties:${JSON.stringify(params)}`;
  const cached = clientCache.get(cacheKey);
  const now = Date.now();

  // Instant cache return (0ms speed)
  if (options.useCache !== false && cached) {
    // If cache is older than TTL, revalidate silently in the background
    if (now - cached.timestamp >= CLIENT_CACHE_TTL) {
      api.get('/properties', { params }).then((res) => {
        if (res.data && res.data.success) {
          clientCache.set(cacheKey, { data: res.data, timestamp: Date.now() });
        }
      }).catch(() => {});
    }
    return cached.data;
  }

  const response = await api.get('/properties', { params });
  if (response.data && response.data.success) {
    clientCache.set(cacheKey, { data: response.data, timestamp: now });
  }
  return response.data;
};

export const getProperty = async (id, options = { useCache: true }) => {
  const cacheKey = `property:${id}`;
  const cached = clientCache.get(cacheKey);
  const now = Date.now();

  // Instant cache return (0ms speed)
  if (options.useCache !== false && cached) {
    if (now - cached.timestamp >= CLIENT_CACHE_TTL) {
      api.get(`/properties/${id}`).then((res) => {
        if (res.data && res.data.success) {
          clientCache.set(cacheKey, { data: res.data, timestamp: Date.now() });
        }
      }).catch(() => {});
    }
    return cached.data;
  }

  const response = await api.get(`/properties/${id}`);
  if (response.data && response.data.success) {
    clientCache.set(cacheKey, { data: response.data, timestamp: now });
  }
  return response.data;
};

export const getFeaturedProperties = async (category = 'property', options = { useCache: true }) => {
  const cacheKey = `featured:${category}`;
  const cached = clientCache.get(cacheKey);
  const now = Date.now();

  // Instant cache return (0ms speed)
  if (options.useCache !== false && cached) {
    if (now - cached.timestamp >= CLIENT_CACHE_TTL) {
      api.get('/properties/featured', { params: { category } }).then((res) => {
        if (res.data && res.data.success) {
          clientCache.set(cacheKey, { data: res.data, timestamp: Date.now() });
        }
      }).catch(() => {});
    }
    return cached.data;
  }

  const response = await api.get('/properties/featured', { params: { category } });
  if (response.data && response.data.success) {
    clientCache.set(cacheKey, { data: response.data, timestamp: now });
  }
  return response.data;
};

export const getMyProperties = async () => {
  const response = await api.get('/properties/mine');
  return response.data;
};

export const updateProperty = async (id, propertyData) => {
  invalidateClientPropertyCache();
  const response = await api.patch(`/properties/${id}`, propertyData);
  return response.data;
};

export const deleteProperty = async (id) => {
  invalidateClientPropertyCache();
  const response = await api.delete(`/properties/${id}`);
  return response.data;
};

export const submitInquiry = async (id, inquiryData) => {
  invalidateClientPropertyCache();
  const response = await api.post(`/properties/${id}/inquiry`, inquiryData);
  return response.data;
};

export const getMyInquiries = async (params = {}) => {
  const response = await api.get('/properties/inquiries/mine', { params });
  return response.data;
};

export const updateInquiryStatus = async (id, status, extraData = {}) => {
  const response = await api.patch(`/properties/inquiries/${id}`, { status, ...extraData });
  return response.data;
};

export const deleteInquiryApi = async (id) => {
  const response = await api.delete(`/properties/inquiries/${id}`);
  return response.data;
};

export const replyToInquiryApi = async (id, replyMessage) => {
  const response = await api.post(`/properties/inquiries/${id}/reply`, { replyMessage });
  return response.data;
};

export const bulkDeleteInquiriesApi = async (ids) => {
  const response = await api.post('/properties/inquiries/bulk-delete', { ids });
  return response.data;
};

export const getBuyerInquiries = async () => {
  const response = await api.get('/properties/inquiries/buyer');
  return response.data;
};

export const getUserWishlist = async () => {
  const response = await api.get('/properties/wishlist');
  return response.data;
};

export const toggleWishlistApi = async (id) => {
  const response = await api.post(`/properties/wishlist/${id}`);
  return response.data;
};

export const uploadImage = async (file) => {
  const formData = new FormData();
  formData.append('image', file);
  const response = await api.post('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

export const uploadMultipleImages = async (files) => {
  const formData = new FormData();
  files.forEach((file) => formData.append('images', file));
  const response = await api.post('/upload/multiple', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

