import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  getRoleRequestsApi,
  approveRoleRequestApi,
  rejectRoleRequestApi,
  revokeRoleRequestApi,
  grantRoleDirectlyApi,
  revokeRoleDirectlyApi,
  getAdminUsersApi,
  deleteUserApi,
  toggleBlockUserApi,
  getKycRequestsApi,
  approveKycRequestApi,
  rejectKycRequestApi,
} from '../../services/adminService';
import {
  getContactMessagesApi,
  updateContactStatusApi,
  deleteContactMessageApi,
  replyContactMessageApi,
} from '../../services/contactService';
import {
  getProperties,
  updateProperty,
  deleteProperty,
} from '../../services/propertyService';
import { broadcastRealtimeSync, useRealtimeSync, SYNC_EVENTS } from '../../utils/realtimeSync';
import { formatPhoneNumber, formatPrice } from '../../utils/formatters';
import {
  ShieldCheck,
  Clock,
  CheckCircle2,
  XCircle,
  UserPlus,
  Users,
  Search,
  Mail,
  Send,
  Building2,
  Briefcase,
  UserCheck,
  Shield,
  ArrowRightLeft,
  Check,
  X,
  Ban,
  Unlock,
  Trash2,
  AlertTriangle,
  UserMinus,
  MessageSquare,
  Phone,
  MessageCircle,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';
import './BuyerDashboard.css';


const AdminDashboard = () => {
  const { user, showToast, logout } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab');
  const validTabs = ['requests', 'kyc', 'grant', 'users', 'messages', 'security', 'properties'];
  const [activeTab, setActiveTab] = useState(
    tabFromUrl && validTabs.includes(tabFromUrl) ? tabFromUrl : 'requests'
  );

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && validTabs.includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  const handleTabChange = (newTab) => {
    setActiveTab(newTab);
    setSearchParams({ tab: newTab });
  };
  const [requests, setRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [filterStatus, setFilterStatus] = useState('PENDING'); // 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'

  // KYC Verification state
  const [kycRequests, setKycRequests] = useState([]);
  const [loadingKyc, setLoadingKyc] = useState(false);
  const [kycStatusFilter, setKycStatusFilter] = useState('pending'); // 'pending' | 'verified' | 'rejected' | 'all'
  const [kycRoleFilter, setKycRoleFilter] = useState('all'); // 'all' | 'builder' | 'agent' | 'owner'
  const [kycActionLoading, setKycActionLoading] = useState(null);
  const [rejectKycModalItem, setRejectKycModalItem] = useState(null);
  const [rejectKycReason, setRejectKycReason] = useState('');

  // Direct grant/revoke state
  const [grantMode, setGrantMode] = useState('grant'); // 'grant' | 'revoke'
  const [grantEmail, setGrantEmail] = useState('');
  const [grantRole, setGrantRole] = useState('builder');
  const [granting, setGranting] = useState(false);
  const [grantResult, setGrantResult] = useState(null);

  // Users state
  const [usersList, setUsersList] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userSearch, setUserSearch] = useState('');

  // Reject modal state
  const [rejectModalItem, setRejectModalItem] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(null);

  // Revoke/Cancel Role modal state
  const [revokeModalItem, setRevokeModalItem] = useState(null);
  const [revokeReason, setRevokeReason] = useState('');

  // Block modal & state
  const [blockModalItem, setBlockModalItem] = useState(null);
  const [blockReason, setBlockReason] = useState('');
  const [userActionLoading, setUserActionLoading] = useState(null);

  // Delete modal & state
  const [deleteModalItem, setDeleteModalItem] = useState(null);

  // Direct Messages / Inquiries state
  const [contactsList, setContactsList] = useState([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [contactSearch, setContactSearch] = useState('');
  const [contactStatusFilter, setContactStatusFilter] = useState('ALL'); // 'ALL' | 'new' | 'in_progress' | 'resolved'
  const [contactActionLoading, setContactActionLoading] = useState(null);
  const [deleteContactModalItem, setDeleteContactModalItem] = useState(null);
  const [replyTextMap, setReplyTextMap] = useState({});
  const [sendingReplyId, setSendingReplyId] = useState(null);


  // Properties Moderation state
  const [propertiesList, setPropertiesList] = useState([]);
  const [loadingProperties, setLoadingProperties] = useState(false);
  const [propertySearch, setPropertySearch] = useState('');
  const [propertyCategoryFilter, setPropertyCategoryFilter] = useState('ALL'); // 'ALL' | 'property' | 'project'
  const [propertyStatusFilter, setPropertyStatusFilter] = useState('ALL'); // 'ALL' | 'active' | 'pending' | 'sold'
  const [propertyActionLoading, setPropertyActionLoading] = useState(null);
  const [deletePropertyModalItem, setDeletePropertyModalItem] = useState(null);

  const loadProperties = useCallback(async (isBackground = false) => {
    try {
      if (!isBackground) setLoadingProperties(true);
      const res = await getProperties({}, { useCache: false });
      const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
      setPropertiesList(list);
    } catch (err) {
      console.error('Failed to load properties for admin moderation:', err);
    } finally {
      if (!isBackground) setLoadingProperties(false);
    }
  }, []);

  const loadRequests = useCallback(async (isBackground = false) => {
    try {
      if (!isBackground) {
        setLoadingRequests(true);
      }
      const res = await getRoleRequestsApi(filterStatus === 'ALL' ? '' : filterStatus);
      if (res.success && Array.isArray(res.data)) {
        setRequests(res.data);
      }
    } catch (err) {
      console.error('Failed to load role requests:', err);
    } finally {
      if (!isBackground) {
        setLoadingRequests(false);
      }
    }
  }, [filterStatus]);

  const loadKyc = useCallback(async (isBackground = false) => {
    try {
      if (!isBackground) setLoadingKyc(true);
      const st = kycStatusFilter === 'all' ? '' : kycStatusFilter;
      const ro = kycRoleFilter === 'all' ? '' : kycRoleFilter;
      const res = await getKycRequestsApi(st, ro);
      if (res.success && Array.isArray(res.data)) {
        setKycRequests(res.data);
      }
    } catch (err) {
      console.error('Failed to load KYC requests:', err);
    } finally {
      if (!isBackground) setLoadingKyc(false);
    }
  }, [kycStatusFilter, kycRoleFilter]);

  const handleApproveKyc = async (userId, userName) => {
    try {
      setKycActionLoading(userId);
      const res = await approveKycRequestApi(userId);
      if (res.success) {
        showToast(res.message || `KYC approved for ${userName}`, 'success');
        broadcastRealtimeSync(SYNC_EVENTS.AUTH, { action: 'kyc_verified', userId });
        loadKyc();
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to approve KYC', 'error');
    } finally {
      setKycActionLoading(null);
    }
  };

  const handleRejectKycConfirm = async () => {
    if (!rejectKycModalItem) return;
    const userId = rejectKycModalItem._id;
    const userName = rejectKycModalItem.name;
    const reason = rejectKycReason.trim();

    try {
      setKycActionLoading(userId);
      const res = await rejectKycRequestApi(userId, reason);
      if (res.success) {
        showToast(res.message || `KYC rejected for ${userName}`, 'info');
        broadcastRealtimeSync(SYNC_EVENTS.AUTH, { action: 'kyc_rejected', userId });
        setRejectKycModalItem(null);
        setRejectKycReason('');
        loadKyc();
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to reject KYC', 'error');
    } finally {
      setKycActionLoading(null);
    }
  };

  const loadUsers = useCallback(async (isBackground = false) => {
    try {
      if (!isBackground) {
        setLoadingUsers(true);
      }
      const res = await getAdminUsersApi(userSearch);
      if (res.success && Array.isArray(res.data)) {
        setUsersList(res.data);
      }
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      if (!isBackground) {
        setLoadingUsers(false);
      }
    }
  }, [userSearch]);

  const loadContacts = useCallback(async (isBackground = false) => {
    try {
      if (!isBackground) {
        setLoadingContacts(true);
      }
      const res = await getContactMessagesApi();
      if (res.success && Array.isArray(res.data)) {
        // Exclude any inquiries that have been replied to so they never display
        const activeContacts = res.data.filter((c) => !c.replyMessage && !c.repliedAt);
        setContactsList(activeContacts);
      }
    } catch (err) {
      console.error('Failed to load contact inquiries:', err);
    } finally {
      if (!isBackground) {
        setLoadingContacts(false);
      }
    }
  }, []);

  // Real-time synchronization for role requests, users & contact inquiries
  useRealtimeSync(
    [SYNC_EVENTS.ROLES, SYNC_EVENTS.AUTH, SYNC_EVENTS.INQUIRY_CREATED],
    () => {
      loadRequests(true);
      loadContacts(true);
      loadKyc(true);
      if (activeTab === 'users') {
        loadUsers(true);
      }
    },
    { revalidateOnFocus: true, intervalMs: 15000 }
  );

  useEffect(() => {
    loadRequests(false);
    loadContacts(false);
    loadKyc(false);
  }, [loadRequests, loadContacts, loadKyc]);

  useEffect(() => {
    if (activeTab === 'users') {
      loadUsers(false);
    } else if (activeTab === 'messages') {
      loadContacts(false);
    } else if (activeTab === 'properties') {
      loadProperties(false);
    }
  }, [activeTab, loadUsers, loadContacts, loadProperties]);

  const handleApprove = async (id) => {
    // Instant optimistic update: immediately remove from pending list or update status
    setRequests((prev) => {
      if (filterStatus === 'PENDING') {
        return prev.filter((r) => r._id !== id);
      }
      return prev.map((r) =>
        r._id === id ? { ...r, status: 'APPROVED', reviewedAt: new Date() } : r
      );
    });

    try {
      setActionLoading(id);
      const res = await approveRoleRequestApi(id);
      if (res.success) {
        broadcastRealtimeSync(SYNC_EVENTS.ROLES, { action: 'approved', id });
        broadcastRealtimeSync(SYNC_EVENTS.AUTH, { action: 'role_approved', id });
        showToast(res.message || 'Role request approved and email sent!', 'success');
        loadRequests();
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to approve request';
      showToast(msg, 'error');
      loadRequests();
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectConfirm = async () => {
    if (!rejectModalItem) return;
    const targetId = rejectModalItem._id;
    const reason = rejectionReason;

    // Close modal and instantly remove/update from list
    setRejectModalItem(null);
    setRejectionReason('');
    setRequests((prev) => {
      if (filterStatus === 'PENDING') {
        return prev.filter((r) => r._id !== targetId);
      }
      return prev.map((r) =>
        r._id === targetId
          ? { ...r, status: 'REJECTED', rejectionReason: reason, reviewedAt: new Date() }
          : r
      );
    });

    try {
      setActionLoading(targetId);
      const res = await rejectRoleRequestApi(targetId, reason);
      if (res.success) {
        broadcastRealtimeSync(SYNC_EVENTS.ROLES, { action: 'rejected', id: targetId });
        showToast('Role request rejected.', 'info');
        loadRequests();
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to reject request';
      showToast(msg, 'error');
      loadRequests();
    } finally {
      setActionLoading(null);
    }
  };

  // Revoke / Cancel Role Confirm Handler
  const handleConfirmRevoke = async () => {
    if (!revokeModalItem) return;
    const { type, data, role } = revokeModalItem;
    const reason = revokeReason;

    setRevokeModalItem(null);
    setRevokeReason('');

    if (type === 'request') {
      const targetId = data._id;
      // Optimistic update
      setRequests((prev) =>
        prev.map((r) =>
          r._id === targetId
            ? { ...r, status: 'REVOKED', rejectionReason: reason, reviewedAt: new Date() }
            : r
        )
      );

      try {
        setActionLoading(targetId);
        const res = await revokeRoleRequestApi(targetId, reason);
        if (res.success) {
          broadcastRealtimeSync(SYNC_EVENTS.ROLES, { action: 'revoked', id: targetId });
          broadcastRealtimeSync(SYNC_EVENTS.AUTH, { action: 'role_revoked', id: targetId });
          showToast(res.message || 'Role access cancelled successfully.', 'success');
          loadRequests();
          if (activeTab === 'users') loadUsers();
        }
      } catch (err) {
        const msg = err.response?.data?.message || 'Failed to cancel role';
        showToast(msg, 'error');
        loadRequests();
      } finally {
        setActionLoading(null);
      }
    } else if (type === 'user') {
      const targetId = data._id;
      // Optimistic update
      setUsersList((prev) =>
        prev.map((u) => {
          if (u._id === targetId) {
            const updatedRoles = (u.roles || []).filter((r) => r !== role);
            return {
              ...u,
              roles: updatedRoles.length > 0 ? updatedRoles : ['buyer'],
              role: u.role === role ? 'buyer' : u.role,
            };
          }
          return u;
        })
      );

      try {
        setUserActionLoading(targetId);
        const res = await revokeRoleDirectlyApi({ userId: targetId, email: data.email, role });
        if (res.success) {
          broadcastRealtimeSync(SYNC_EVENTS.ROLES, { action: 'revoked', userId: targetId, role });
          broadcastRealtimeSync(SYNC_EVENTS.AUTH, { action: 'role_revoked', userId: targetId, role });
          showToast(res.message || `Cancelled '${role}' role for ${data.email}`, 'success');
          loadUsers();
          loadRequests();
        }
      } catch (err) {
        const msg = err.response?.data?.message || 'Failed to cancel user role';
        showToast(msg, 'error');
        loadUsers();
      } finally {
        setUserActionLoading(null);
      }
    }
  };

  // Block / Unblock handler
  const handleToggleBlockClick = async (targetUser) => {
    if (targetUser.isBlocked) {
      // Direct unblock with instant optimistic update
      setUsersList((prev) =>
        prev.map((u) => (u._id === targetUser._id ? { ...u, isBlocked: false } : u))
      );
      try {
        setUserActionLoading(targetUser._id);
        const res = await toggleBlockUserApi(targetUser._id, false);
        if (res.success) {
          broadcastRealtimeSync(SYNC_EVENTS.AUTH, { action: 'unblocked', userId: targetUser._id });
          showToast(res.message || `Access unblocked for ${targetUser.email}`, 'success');
          loadUsers();
        }
      } catch (err) {
        const msg = err.response?.data?.message || 'Failed to unblock user access';
        showToast(msg, 'error');
        loadUsers();
      } finally {
        setUserActionLoading(null);
      }
    } else {
      // Open block confirmation modal
      setBlockModalItem(targetUser);
      setBlockReason('');
    }
  };

  const handleConfirmBlock = async () => {
    if (!blockModalItem) return;
    const targetId = blockModalItem._id;
    const email = blockModalItem.email;
    const reason = blockReason;

    // Instant optimistic update
    setBlockModalItem(null);
    setBlockReason('');
    setUsersList((prev) =>
      prev.map((u) => (u._id === targetId ? { ...u, isBlocked: true } : u))
    );

    try {
      setUserActionLoading(targetId);
      const res = await toggleBlockUserApi(targetId, true, reason);
      if (res.success) {
        broadcastRealtimeSync(SYNC_EVENTS.AUTH, { action: 'blocked', userId: targetId });
        showToast(res.message || `User ${email} has been blocked.`, 'info');
        loadUsers();
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to block user';
      showToast(msg, 'error');
      loadUsers();
    } finally {
      setUserActionLoading(null);
    }
  };

  // Delete user handler
  const handleConfirmDelete = async () => {
    if (!deleteModalItem) return;
    const targetId = deleteModalItem._id;
    const email = deleteModalItem.email;

    // Instant optimistic update
    setDeleteModalItem(null);
    setUsersList((prev) => prev.filter((u) => u._id !== targetId));
    setRequests((prev) => prev.filter((r) => r.userId?._id !== targetId && r.email !== email));

    try {
      setUserActionLoading(targetId);
      const res = await deleteUserApi(targetId);
      if (res.success) {
        broadcastRealtimeSync(SYNC_EVENTS.AUTH, { action: 'deleted', userId: targetId });
        broadcastRealtimeSync(SYNC_EVENTS.ROLES, { action: 'user_deleted', userId: targetId });
        showToast(res.message || `User ${email} deleted successfully.`, 'success');
        loadUsers();
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to delete user';
      showToast(msg, 'error');
      loadUsers();
    } finally {
      setUserActionLoading(null);
    }
  };

  // Update Contact Status Handler
  const handleUpdateContactStatus = async (contactId, newStatus) => {
    // Instant optimistic update
    setContactsList((prev) =>
      prev.map((c) => (c._id === contactId ? { ...c, status: newStatus } : c))
    );

    try {
      setContactActionLoading(contactId);
      const res = await updateContactStatusApi(contactId, newStatus);
      if (res.success) {
        broadcastRealtimeSync(SYNC_EVENTS.INQUIRY_CREATED, { action: 'status_updated', id: contactId, status: newStatus });
        showToast(res.message || `Inquiry marked as ${newStatus.replace('_', ' ')}`, 'success');
        loadContacts(true);
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to update inquiry status';
      showToast(msg, 'error');
      loadContacts(true);
    } finally {
      setContactActionLoading(null);
    }
  };

  // Delete Contact Inquiry Handler
  const handleConfirmDeleteContact = async () => {
    if (!deleteContactModalItem) return;
    const targetId = deleteContactModalItem._id;
    setDeleteContactModalItem(null);

    // Instant optimistic update
    setContactsList((prev) => prev.filter((c) => c._id !== targetId));

    try {
      setContactActionLoading(targetId);
      const res = await deleteContactMessageApi(targetId);
      if (res.success) {
        broadcastRealtimeSync(SYNC_EVENTS.INQUIRY_CREATED, { action: 'deleted', id: targetId });
        showToast(res.message || 'Inquiry deleted successfully', 'success');
        loadContacts(true);
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to delete inquiry';
      showToast(msg, 'error');
      loadContacts(true);
    } finally {
      setContactActionLoading(null);
    }
  };

  // Send Email Reply to Contact Inquiry
  const handleSendReply = async (contactId, userEmail) => {
    const text = replyTextMap[contactId]?.trim();
    if (!text) {
      showToast('Please type a reply message to send via email', 'error');
      return;
    }

    try {
      setSendingReplyId(contactId);
      const res = await replyContactMessageApi(contactId, text);
      if (res.success) {
        showToast(res.message || `Reply email sent to ${userEmail} and inquiry cleared!`, 'success');
        // Automatically remove the replied inquiry from the list since it's deleted from database
        setContactsList((prev) => prev.filter((c) => c._id !== contactId));
        setReplyTextMap((prev) => {
          const next = { ...prev };
          delete next[contactId];
          return next;
        });
        broadcastRealtimeSync(SYNC_EVENTS.INQUIRY_CREATED, { action: 'deleted', id: contactId });
        loadContacts(true);
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to send reply email';
      showToast(msg, 'error');
    } finally {
      setSendingReplyId(null);
    }
  };



  const handleGrantDirect = async (e) => {
    e.preventDefault();
    setGrantResult(null);
    if (!grantEmail) {
      showToast('Please enter a user email', 'error');
      return;
    }

    try {
      setGranting(true);
      const res = await grantRoleDirectlyApi(grantEmail, grantRole);
      if (res.success) {
        broadcastRealtimeSync(SYNC_EVENTS.ROLES, { action: 'granted', email: grantEmail, role: grantRole });
        broadcastRealtimeSync(SYNC_EVENTS.AUTH, { action: 'role_granted', email: grantEmail, role: grantRole });
        setGrantResult({
          success: true,
          message: res.message || `Successfully granted '${grantRole}' access to ${grantEmail}`,
        });
        showToast(`Role '${grantRole}' granted to ${grantEmail}!`, 'success');
        setGrantEmail('');
        await loadRequests();
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to grant role access';
      setGrantResult({ success: false, message: msg });
      showToast(msg, 'error');
    } finally {
      setGranting(false);
    }
  };

  const handleRevokeDirect = async (e) => {
    e.preventDefault();
    setGrantResult(null);
    if (!grantEmail) {
      showToast('Please enter a user email', 'error');
      return;
    }

    try {
      setGranting(true);
      const res = await revokeRoleDirectlyApi({ email: grantEmail, role: grantRole });
      if (res.success) {
        broadcastRealtimeSync(SYNC_EVENTS.ROLES, { action: 'revoked', email: grantEmail, role: grantRole });
        broadcastRealtimeSync(SYNC_EVENTS.AUTH, { action: 'role_revoked', email: grantEmail, role: grantRole });
        setGrantResult({
          success: true,
          message: res.message || `Successfully cancelled '${grantRole}' access for ${grantEmail}`,
        });
        showToast(res.message, 'success');
        setGrantEmail('');
        await loadRequests();
        if (activeTab === 'users') loadUsers();
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to cancel role access';
      setGrantResult({ success: false, message: msg });
      showToast(msg, 'error');
    } finally {
      setGranting(false);
    }
  };

  const pendingCount = requests.filter((r) => r.status === 'PENDING').length;
  const pendingKycCount = kycRequests.filter((k) => k.kycVerification?.status === 'pending').length;
  const newContactsCount = contactsList.filter((c) => c.status === 'new').length;

  const filteredContacts = useMemo(() => {
    return contactsList
      .filter((c) => !c.replyMessage && !c.repliedAt)
      .filter((c) => {
        const matchesStatus =
          contactStatusFilter === 'ALL' || c.status === contactStatusFilter;
        const q = contactSearch.toLowerCase().trim();
        const matchesSearch =
          !q ||
          (c.name && c.name.toLowerCase().includes(q)) ||
          (c.email && c.email.toLowerCase().includes(q)) ||
          (c.phone && c.phone.toLowerCase().includes(q)) ||
          (c.subject && c.subject.toLowerCase().includes(q)) ||
          (c.message && c.message.toLowerCase().includes(q));
        return matchesStatus && matchesSearch;
      });
  }, [contactsList, contactStatusFilter, contactSearch]);

  const filteredProperties = useMemo(() => {
    return propertiesList.filter((p) => {
      const matchesCategory =
        propertyCategoryFilter === 'ALL' || (p.category || 'property') === propertyCategoryFilter;
      const matchesStatus =
        propertyStatusFilter === 'ALL' || (p.status || 'active') === propertyStatusFilter;
      const q = propertySearch.toLowerCase().trim();
      const matchesSearch =
        !q ||
        (p.title && p.title.toLowerCase().includes(q)) ||
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.location?.city && p.location.city.toLowerCase().includes(q)) ||
        (p.location?.address && p.location.address.toLowerCase().includes(q)) ||
        (p.postedRole && p.postedRole.toLowerCase().includes(q));
      return matchesCategory && matchesStatus && matchesSearch;
    });
  }, [propertiesList, propertyCategoryFilter, propertyStatusFilter, propertySearch]);

  const handleTogglePropertyStatus = async (propId, currentStatus) => {
    const nextStatus = currentStatus === 'active' ? 'pending' : 'active';
    try {
      setPropertyActionLoading(propId);
      await updateProperty(propId, { status: nextStatus });
      setPropertiesList((prev) =>
        prev.map((p) => (p._id === propId ? { ...p, status: nextStatus } : p))
      );
      showToast(`Property status updated to '${nextStatus}'`, 'success');
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to update property status', 'error');
    } finally {
      setPropertyActionLoading(null);
    }
  };

  const handleTogglePropertyFeatured = async (propId, currentFeatured) => {
    try {
      setPropertyActionLoading(propId);
      await updateProperty(propId, { isFeatured: !currentFeatured });
      setPropertiesList((prev) =>
        prev.map((p) => (p._id === propId ? { ...p, isFeatured: !currentFeatured } : p))
      );
      showToast(currentFeatured ? 'Removed from featured' : 'Marked as featured property', 'success');
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to update featured flag', 'error');
    } finally {
      setPropertyActionLoading(null);
    }
  };

  const handleConfirmDeleteProperty = async () => {
    if (!deletePropertyModalItem) return;
    const propId = deletePropertyModalItem._id;
    setDeletePropertyModalItem(null);
    try {
      setPropertyActionLoading(propId);
      await deleteProperty(propId);
      setPropertiesList((prev) => prev.filter((p) => p._id !== propId));
      showToast('Property deleted successfully', 'success');
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to delete property', 'error');
    } finally {
      setPropertyActionLoading(null);
    }
  };

  const initials = user?.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .substring(0, 2)
        .toUpperCase()
    : 'AD';

  return (
    <div className="dashboard-wrapper">
      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="logo-icon bg-amber-500 text-white">
            <ShieldCheck size={20} />
          </div>
          <div>
            <div className="brand-text">
              <Link to="/">
                Estate<span>Xplorer</span>
              </Link>
            </div>
            <div className="role text-amber-600 font-bold">Admin Portal</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section">
            <div className="nav-section-label">Main</div>
            <button
              onClick={() => handleTabChange('requests')}
              className={`nav-item w-full text-left flex items-center gap-3 ${
                activeTab === 'requests' ? 'active' : ''
              }`}
            >
              <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>
              <span>Dashboard</span>
            </button>
          </div>

          <div className="nav-section">
            <div className="nav-section-label">Management</div>
            <button
              onClick={() => handleTabChange('requests')}
              className={`nav-item w-full text-left flex items-center justify-between ${
                activeTab === 'requests' ? 'active' : ''
              }`}
            >
              <span className="flex items-center gap-3">
                <Clock size={18} className="shrink-0" />
                <span>Role Requests</span>
              </span>
              {pendingCount > 0 && (
                <span className="px-1.5 py-0.5 text-[0.65rem] font-bold rounded-full bg-amber-500 text-white">
                  {pendingCount}
                </span>
              )}
            </button>

            <button
              onClick={() => handleTabChange('kyc')}
              className={`nav-item w-full text-left flex items-center justify-between ${
                activeTab === 'kyc' ? 'active' : ''
              }`}
            >
              <span className="flex items-center gap-3">
                <ShieldCheck size={18} className="shrink-0" />
                <span>KYC Verifications</span>
              </span>
              {pendingKycCount > 0 && (
                <span className="px-1.5 py-0.5 text-[0.65rem] font-bold rounded-full bg-blue-600 text-white animate-pulse">
                  {pendingKycCount}
                </span>
              )}
            </button>

            <button
              onClick={() => handleTabChange('grant')}
              className={`nav-item w-full text-left flex items-center gap-3 ${
                activeTab === 'grant' ? 'active' : ''
              }`}
            >
              <Shield size={18} className="shrink-0" />
              <span>Role Management</span>
            </button>

            <button
              onClick={() => handleTabChange('users')}
              className={`nav-item w-full text-left flex items-center gap-3 ${
                activeTab === 'users' ? 'active' : ''
              }`}
            >
              <Users size={18} className="shrink-0" />
              <span>User Management</span>
            </button>

            <button
              onClick={() => handleTabChange('messages')}
              className={`nav-item w-full text-left flex items-center justify-between ${
                activeTab === 'messages' ? 'active' : ''
              }`}
            >
              <span className="flex items-center gap-3">
                <MessageSquare size={18} className="shrink-0" />
                <span>Direct Inquiries</span>
              </span>
              {newContactsCount > 0 && (
                <span className="px-1.5 py-0.5 text-[0.65rem] font-bold rounded-full bg-blue-600 text-white animate-pulse">
                  {newContactsCount}
                </span>
              )}
            </button>
          </div>

          <div className="nav-section">
            <div className="nav-section-label">Account</div>
            <Link className="nav-item flex items-center gap-3" to="/dashboard/profile">
              <UserCheck size={18} className="shrink-0" />
              <span>Admin Profile</span>
            </Link>
          </div>

          <div className="nav-section">
            <div className="nav-section-label">Navigation</div>
            <Link className="nav-item flex items-center gap-3" to="/">
              <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1"/></svg>
              <span>Homepage</span>
            </Link>
            <Link className="nav-item flex items-center gap-3" to="/listings">
              <Building2 size={18} className="shrink-0" />
              <span>Browse Properties</span>
            </Link>
            <button
              className="nav-item w-full text-left bg-transparent border-0 cursor-pointer flex items-center gap-3"
              onClick={logout}
            >
              <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              <span>Sign Out</span>
            </button>
          </div>
        </nav>

        <div className="sidebar-footer">
          <Link to="/dashboard/profile" className="user-profile">
            <div className="user-avatar bg-amber-600">{initials}</div>
            <div className="user-info">
              <div className="user-name">{user?.name || 'Administrator'}</div>
              <div className="user-email">{user?.email || 'admin@estatexplorer.in'}</div>
            </div>
          </Link>
        </div>
      </aside>

      {/* MAIN */}
      <div className="main">
        <header className="topbar">
          <h1 className="page-title">Admin Authorization &amp; Role Control</h1>
          <div className="topbar-right">
            <span className="px-3 py-1 bg-amber-50 border border-amber-200 text-amber-800 rounded-full text-xs font-bold flex items-center gap-1.5">
              <Shield size={13} /> Administrator Verified
            </span>
          </div>
        </header>

        <div className="content">
          {/* Welcome Note */}
          <div className="welcome">
            <p>
              Welcome, <strong>{user?.name || 'Administrator'}</strong> · Review pending role requests, manage user authorizations, and monitor incoming customer inquiries.
            </p>
          </div>

          {/* Stats Grid */}
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            <div className="stat-card">
              <div className="stat-header">
                <div className="stat-icon orange">
                  <Clock size={20} />
                </div>
              </div>
              <div className="stat-value">{pendingCount}</div>
              <div className="stat-label">Pending Review Requests</div>
            </div>

            <div className="stat-card">
              <div className="stat-header">
                <div className="stat-icon green">
                  <CheckCircle2 size={20} />
                </div>
              </div>
              <div className="stat-value">
                {requests.filter((r) => r.status === 'APPROVED').length}
              </div>
              <div className="stat-label">Approved Roles</div>
            </div>

            <div className="stat-card">
              <div className="stat-header">
                <div className="stat-icon blue">
                  <Users size={20} />
                </div>
              </div>
              <div className="stat-value">{usersList.length || requests.length}</div>
              <div className="stat-label">Total Users</div>
            </div>

            <div className="stat-card">
              <div className="stat-header">
                <div className="stat-icon" style={{ background: '#eff6ff', color: '#2563eb' }}>
                  <MessageSquare size={20} />
                </div>
              </div>
              <div className="stat-value">{contactsList.length}</div>
              <div className="stat-label">Direct Inquiries ({newContactsCount} New)</div>
            </div>
          </div>

          {/* TAB 1: Role Requests */}
          {activeTab === 'requests' && (
            <div className="card mb-6">
              <div className="card-header flex flex-wrap items-center justify-between gap-3">
                <h2 className="card-title">Role Access Applications</h2>

                {/* Filter Pills */}
                <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg">
                  {['PENDING', 'APPROVED', 'REJECTED', 'ALL'].map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setFilterStatus(st)}
                      className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                        filterStatus === st
                          ? 'bg-white text-blue-600 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {st === 'ALL' ? 'All Requests' : st.charAt(0) + st.slice(1).toLowerCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-5">
                {loadingRequests && requests.length === 0 ? (
                  <div className="text-center py-10 text-xs text-muted">
                    <div className="inline-block w-5 h-5 border-2 border-slate-300 border-t-blue-600 rounded-full animate-spin mb-2" />
                    <p>Loading role requests...</p>
                  </div>
                ) : requests.length === 0 ? (
                  <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-border">
                    <CheckCircle2 size={36} className="text-slate-400 mx-auto mb-2" />
                    <p className="text-sm font-bold text-navy">No {filterStatus.toLowerCase()} requests</p>
                    <p className="text-xs text-muted mt-0.5">
                      All role access requests in this category have been processed.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-border text-muted uppercase text-[0.68rem] tracking-wider bg-slate-50">
                          <th className="py-3 px-3">Applicant User</th>
                          <th className="py-3 px-3">Current Role</th>
                          <th className="py-3 px-3">Requested Role</th>
                          <th className="py-3 px-3">Requested Date</th>
                          <th className="py-3 px-3">Status</th>
                          <th className="py-3 px-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {requests.map((req) => (
                          <tr key={req._id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-3 px-3">
                              <div className="font-bold text-navy">
                                {req.userId?.name || 'Registered User'}
                              </div>
                              <div className="text-[0.72rem] text-muted">{req.email}</div>
                              {req.userId?.phone && (
                                <div className="text-[0.68rem] text-slate-400">{formatPhoneNumber(req.userId.phone)}</div>
                              )}
                            </td>
                            <td className="py-3 px-3">
                              <span className="px-2 py-0.5 rounded text-[0.7rem] font-semibold bg-slate-100 text-slate-700">
                                {req.currentRole}
                              </span>
                            </td>
                            <td className="py-3 px-3">
                              <span className="px-2.5 py-1 rounded text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200 inline-flex items-center gap-1">
                                <ShieldCheck size={12} />
                                {req.requestedRole.toUpperCase()}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-muted">
                              {new Date(req.requestedAt).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </td>
                            <td className="py-3 px-3">
                              {req.status === 'PENDING' ? (
                                <span className="px-2 py-0.5 rounded text-[0.68rem] font-bold bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1 w-max">
                                  <Clock size={11} /> Pending Review
                                </span>
                              ) : req.status === 'APPROVED' ? (
                                <span className="px-2 py-0.5 rounded text-[0.68rem] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1 w-max">
                                  <CheckCircle2 size={11} /> Approved
                                </span>
                              ) : req.status === 'REVOKED' || req.status === 'CANCELLED' ? (
                                <span className="px-2 py-0.5 rounded text-[0.68rem] font-bold bg-rose-100 text-rose-800 border border-rose-200 flex items-center gap-1 w-max">
                                  <Ban size={11} /> Cancelled
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[0.68rem] font-bold bg-red-100 text-red-800 border border-red-200 flex items-center gap-1 w-max">
                                  <XCircle size={11} /> Rejected
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-right">
                              {req.status === 'PENDING' ? (
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => handleApprove(req._id)}
                                    disabled={actionLoading === req._id}
                                    className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[0.72rem] transition-colors flex items-center gap-1 cursor-pointer"
                                    title="Approve & Send Email"
                                  >
                                    <Check size={12} />
                                    {actionLoading === req._id ? 'Approving...' : 'Approve'}
                                  </button>
                                  <button
                                    onClick={() => setRejectModalItem(req)}
                                    disabled={actionLoading === req._id}
                                    className="px-2.5 py-1 rounded bg-red-100 hover:bg-red-200 text-red-700 font-bold text-[0.72rem] transition-colors flex items-center gap-1 cursor-pointer"
                                    title="Reject Request"
                                  >
                                    <X size={12} /> Reject
                                  </button>
                                </div>
                              ) : req.status === 'APPROVED' ? (
                                <div className="flex items-center justify-end gap-2">
                                  <span className="text-[0.72rem] text-muted italic mr-1 hidden sm:inline">
                                    Approved {new Date(req.reviewedAt || req.updatedAt).toLocaleDateString()}
                                  </span>
                                  <button
                                    onClick={() => setRevokeModalItem({ type: 'request', data: req, role: req.requestedRole })}
                                    className="px-2.5 py-1 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-[0.72rem] transition-colors flex items-center gap-1 border border-rose-200 cursor-pointer"
                                    title={`Cancel ${req.requestedRole} role`}
                                  >
                                    <Ban size={12} /> Cancel Role
                                  </button>
                                </div>
                              ) : (
                                <span className="text-[0.72rem] text-muted italic">
                                  {req.status === 'REVOKED' || req.status === 'CANCELLED' ? 'Cancelled' : 'Reviewed'} {new Date(req.reviewedAt || req.updatedAt).toLocaleDateString()}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 1.5: KYC Document Verifications (Mandatory for Builder, Agent, Owner before posting properties) */}
          {activeTab === 'kyc' && (
            <div className="card mb-6">
              <div className="card-header flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="card-title flex items-center gap-2">
                    <ShieldCheck size={20} className="text-blue-600" />
                    KYC Document Verification Management
                  </h2>
                  <p className="text-xs text-muted mt-0.5">
                    Verify mandatory Aadhar, PAN, and Company/Agency documents before builders, agents, and owners can post properties.
                  </p>
                </div>

                {/* Filter Pills */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                    {['pending', 'verified', 'rejected', 'all'].map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setKycStatusFilter(st)}
                        className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                          kycStatusFilter === st
                            ? 'bg-white text-blue-600 shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {st === 'all' ? 'All' : st.charAt(0).toUpperCase() + st.slice(1)}
                      </button>
                    ))}
                  </div>

                  <select
                    value={kycRoleFilter}
                    onChange={(e) => setKycRoleFilter(e.target.value)}
                    className="text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-700 font-medium focus:ring-1 focus:ring-blue-600"
                  >
                    <option value="all">All Roles</option>
                    <option value="builder">Builders</option>
                    <option value="agent">Agents</option>
                    <option value="owner">Owners</option>
                  </select>
                </div>
              </div>

              <div className="p-5">
                {loadingKyc && kycRequests.length === 0 ? (
                  <div className="text-center py-10 text-xs text-muted">
                    <div className="inline-block w-5 h-5 border-2 border-slate-300 border-t-blue-600 rounded-full animate-spin mb-2" />
                    <p>Loading KYC verification submissions...</p>
                  </div>
                ) : kycRequests.length === 0 ? (
                  <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-border">
                    <CheckCircle2 size={36} className="text-slate-400 mx-auto mb-2" />
                    <p className="text-sm font-bold text-navy">No {kycStatusFilter} KYC submissions</p>
                    <p className="text-xs text-muted mt-0.5">
                      No document submissions currently require action in this filter.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {kycRequests.map((item) => {
                      const kyc = item.kycVerification || {};
                      const roleLabel = (item.role || 'user').charAt(0).toUpperCase() + (item.role || 'user').slice(1);
                      const isPending = kyc.status === 'pending';

                      return (
                        <div
                          key={item._id}
                          className="p-4 border border-slate-200 rounded-xl bg-white shadow-xs hover:border-slate-300 transition-all text-left"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-slate-100">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900 text-sm">{item.name}</span>
                                <span className="px-2 py-0.5 rounded text-[0.7rem] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                  {roleLabel}
                                </span>
                                {kyc.status === 'verified' ? (
                                  <span className="px-2 py-0.5 rounded text-[0.68rem] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                                    <CheckCircle2 size={11} /> Verified
                                  </span>
                                ) : kyc.status === 'rejected' ? (
                                  <span className="px-2 py-0.5 rounded text-[0.68rem] font-bold bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1">
                                    <XCircle size={11} /> Rejected
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded text-[0.68rem] font-bold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                                    <Clock size={11} /> Pending Review
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-3">
                                <span>{item.email}</span>
                                {item.phone && <span>· Phone: {formatPhoneNumber(item.phone)}</span>}
                                {kyc.submittedAt && (
                                  <span>
                                    · Submitted:{' '}
                                    {new Date(kyc.submittedAt).toLocaleDateString('en-US', {
                                      month: 'short',
                                      day: 'numeric',
                                      year: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-2">
                              {isPending ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleApproveKyc(item._id, item.name)}
                                    disabled={kycActionLoading === item._id}
                                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                                  >
                                    <Check size={13} />
                                    <span>{kycActionLoading === item._id ? 'Approving...' : 'Approve Documents'}</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setRejectKycModalItem(item);
                                      setRejectKycReason('');
                                    }}
                                    disabled={kycActionLoading === item._id}
                                    className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                                  >
                                    <X size={13} />
                                    <span>Reject</span>
                                  </button>
                                </>
                              ) : kyc.status === 'verified' ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRejectKycModalItem(item);
                                    setRejectKycReason('');
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-600 font-semibold text-xs transition-colors cursor-pointer"
                                >
                                  Re-evaluate / Revoke
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleApproveKyc(item._id, item.name)}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-semibold text-xs transition-colors cursor-pointer"
                                >
                                  Re-approve
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Rejection reason if any */}
                          {kyc.rejectionReason && (
                            <div className="mt-2.5 p-2 bg-rose-50/70 border border-rose-200 rounded-lg text-xs text-rose-800">
                              <span className="font-bold">Rejection Feedback: </span>
                              {kyc.rejectionReason}
                            </div>
                          )}

                          {/* Uploaded Documents Grid */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
                            {/* 1. Aadhar Card */}
                            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                              <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center justify-between">
                                <span>1. Aadhar Card</span>
                                {kyc.aadharCard?.url ? (
                                  <span className="text-[10px] text-emerald-600 font-semibold">Attached</span>
                                ) : (
                                  <span className="text-[10px] text-rose-600 font-semibold">Missing</span>
                                )}
                              </div>
                              {kyc.aadharCard?.number && (
                                <div className="text-xs text-slate-600 font-mono mb-1">
                                  No: {kyc.aadharCard.number}
                                </div>
                              )}
                              {kyc.aadharCard?.url ? (
                                <a
                                  href={kyc.aadharCard.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-semibold hover:underline mt-1"
                                >
                                  <ExternalLink size={12} /> View Aadhar File
                                </a>
                              ) : (
                                <span className="text-xs text-slate-400 italic">No document file</span>
                              )}
                            </div>

                            {/* 2. PAN Card */}
                            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                              <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center justify-between">
                                <span>2. PAN Card</span>
                                {kyc.panCard?.url ? (
                                  <span className="text-[10px] text-emerald-600 font-semibold">Attached</span>
                                ) : (
                                  <span className="text-[10px] text-rose-600 font-semibold">Missing</span>
                                )}
                              </div>
                              {kyc.panCard?.number && (
                                <div className="text-xs text-slate-600 font-mono mb-1">
                                  No: {kyc.panCard.number}
                                </div>
                              )}
                              {kyc.panCard?.url ? (
                                <a
                                  href={kyc.panCard.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-semibold hover:underline mt-1"
                                >
                                  <ExternalLink size={12} /> View PAN File
                                </a>
                              ) : (
                                <span className="text-xs text-slate-400 italic">No document file</span>
                              )}
                            </div>

                            {/* 3. Company Doc (Builder) */}
                            {item.role === 'builder' && (
                              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                                <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center justify-between">
                                  <span>3. Company Document</span>
                                  {kyc.companyDoc?.url ? (
                                    <span className="text-[10px] text-emerald-600 font-semibold">Attached</span>
                                  ) : (
                                    <span className="text-[10px] text-slate-400 font-normal">Optional</span>
                                  )}
                                </div>
                                {kyc.companyDoc?.number && (
                                  <div className="text-xs text-slate-600 font-mono mb-1">
                                    CIN/GST: {kyc.companyDoc.number}
                                  </div>
                                )}
                                {kyc.companyDoc?.url ? (
                                  <a
                                    href={kyc.companyDoc.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-semibold hover:underline mt-1"
                                  >
                                    <ExternalLink size={12} /> View Company File
                                  </a>
                                ) : (
                                  <span className="text-xs text-slate-400 italic">Not provided</span>
                                )}
                              </div>
                            )}

                            {/* 3. Agency Doc (Agent) */}
                            {item.role === 'agent' && (
                              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                                <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center justify-between">
                                  <span>3. Agency Document</span>
                                  {kyc.agencyDoc?.url ? (
                                    <span className="text-[10px] text-emerald-600 font-semibold">Attached</span>
                                  ) : (
                                    <span className="text-[10px] text-slate-400 font-normal">Optional</span>
                                  )}
                                </div>
                                {kyc.agencyDoc?.number && (
                                  <div className="text-xs text-slate-600 font-mono mb-1">
                                    Lic: {kyc.agencyDoc.number}
                                  </div>
                                )}
                                {kyc.agencyDoc?.url ? (
                                  <a
                                    href={kyc.agencyDoc.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-semibold hover:underline mt-1"
                                  >
                                    <ExternalLink size={12} /> View Agency File
                                  </a>
                                ) : (
                                  <span className="text-xs text-slate-400 italic">Not provided</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: Direct Grant / Revoke Role */}
          {activeTab === 'grant' && (
            <div className="card max-w-2xl mb-6">
              <div className="card-header">
                <h2 className="card-title">
                  {grantMode === 'grant' ? 'Direct Role Assignment' : 'Cancel / Revoke User Role'}
                </h2>
              </div>
              <div className="p-6">
                {/* Segmented Mode Selector */}
                <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-xl mb-5 w-max">
                  <button
                    type="button"
                    onClick={() => {
                      setGrantMode('grant');
                      setGrantResult(null);
                    }}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      grantMode === 'grant'
                        ? 'bg-white text-navy shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Grant Role Access
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setGrantMode('revoke');
                      setGrantResult(null);
                    }}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      grantMode === 'revoke'
                        ? 'bg-rose-50 text-rose-700 shadow-xs border border-rose-200/80'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Cancel / Revoke Role
                  </button>
                </div>

                <p className="text-xs text-muted mb-4 leading-relaxed">
                  {grantMode === 'grant'
                    ? 'As an authorized administrator, you can directly grant role permissions to an existing user by email. The backend will update their authorizations and send an official congratulations email.'
                    : 'Revoking a role will remove that permission from the user account. If their active dashboard is currently this role, they will be safely switched back to Buyer access.'}
                </p>

                {grantResult && (
                  <div
                    className={`p-3.5 rounded-xl text-xs mb-4 flex items-start gap-2 ${
                      grantResult.success
                        ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                        : 'bg-red-50 border border-red-200 text-red-800'
                    }`}
                  >
                    {grantResult.success ? (
                      <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-emerald-600" />
                    ) : (
                      <XCircle size={16} className="shrink-0 mt-0.5 text-red-600" />
                    )}
                    <div>
                      <div className="font-bold">{grantResult.message}</div>
                      {grantResult.user && (
                        <div className="mt-1 text-[0.7rem] opacity-85">
                          User: {grantResult.user.name} ({grantResult.user.email}) · Role: {grantResult.user.role}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <form onSubmit={grantMode === 'grant' ? handleGrantDirect : handleRevokeDirect} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-navy uppercase tracking-wider mb-1.5">
                      User Email Address
                    </label>
                    <div className="relative">
                      <Mail size={15} className="absolute left-3.5 top-3 text-muted pointer-events-none" />
                      <input
                        type="email"
                        required
                        value={grantEmail}
                        onChange={(e) => setGrantEmail(e.target.value)}
                        placeholder="e.g. user@example.com"
                        className="w-full pl-10 pr-3.5 py-2.5 bg-white border border-border rounded-lg text-xs font-medium text-navy placeholder:text-muted outline-none focus:border-blue-600 focus:ring-3 focus:ring-blue-600/15 transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-navy uppercase tracking-wider mb-1.5">
                      {grantMode === 'grant' ? 'Role to Grant' : 'Role to Cancel / Revoke'}
                    </label>
                    <select
                      value={grantRole}
                      onChange={(e) => setGrantRole(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-border rounded-lg text-xs font-medium text-navy outline-none focus:border-blue-600 focus:ring-3 focus:ring-blue-600/15 transition-all cursor-pointer"
                    >
                      <option value="builder">Builder (Developer portal access)</option>
                      <option value="agent">Agent / Broker (Agency console)</option>
                      <option value="owner">Property Owner (Direct listing access)</option>
                      <option value="admin">System Administrator (Full access)</option>
                      {grantMode === 'grant' && <option value="buyer">Buyer (Default consumer role)</option>}
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={granting}
                    className={`px-5 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-xs disabled:opacity-50 ${
                      grantMode === 'grant'
                        ? 'bg-navy hover:bg-slate-800 text-white'
                        : 'bg-rose-600 hover:bg-rose-700 text-white'
                    }`}
                  >
                    {grantMode === 'grant' ? (
                      <>
                        <Send size={13} />
                        {granting ? 'Granting Role & Sending Email...' : 'Grant Role & Notify User'}
                      </>
                    ) : (
                      <>
                        <Ban size={13} />
                        {granting ? 'Cancelling Role...' : 'Cancel / Revoke Role'}
                      </>
                    )}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* TAB 3: User Management */}
          {activeTab === 'users' && (
            <div className="card mb-6">
              <div className="card-header flex flex-wrap items-center justify-between gap-3">
                <h2 className="card-title">User Management</h2>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-2.5 text-muted" />
                  <input
                    type="text"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Search by name or email..."
                    className="pl-8 pr-3 py-1.5 text-xs border border-border rounded-lg focus:outline-none focus:border-blue-600 w-64 bg-surface text-navy"
                  />
                </div>
              </div>
              <div className="p-5">
                {loadingUsers && usersList.length === 0 ? (
                  <div className="text-center py-10 text-xs text-muted">
                    <div className="inline-block w-5 h-5 border-2 border-slate-300 border-t-blue-600 rounded-full animate-spin mb-2" />
                    <p>Loading users...</p>
                  </div>
                ) : usersList.length === 0 ? (
                  <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-border">
                    <p className="text-sm font-bold text-navy">No users found</p>
                    <p className="text-xs text-muted mt-0.5">
                      No user accounts match your search criteria.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-border text-muted uppercase text-[0.68rem] tracking-wider bg-slate-50">
                          <th className="py-3 px-3">User</th>
                          <th className="py-3 px-3">Active Role</th>
                          <th className="py-3 px-3">All Approved Roles</th>
                          <th className="py-3 px-3">Account Status</th>
                          <th className="py-3 px-3">Registered On</th>
                          <th className="py-3 px-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {usersList.map((u) => {
                          const isCurrentAdmin =
                            u._id === user?.id ||
                            u._id === user?._id ||
                            (user?.email && u.email?.toLowerCase() === user.email.toLowerCase()) ||
                            u.email === 'admin@estatexplorer.in';

                          const isAdminUser =
                            u.role === 'admin' ||
                            (Array.isArray(u.roles) && u.roles.includes('admin')) ||
                            isCurrentAdmin;

                          return (
                            <tr key={u._id} className={`hover:bg-slate-50/70 transition-colors ${u.isBlocked ? 'bg-red-50/20' : ''}`}>
                              <td className="py-3 px-3">
                                <div className="font-bold text-navy flex items-center gap-1.5">
                                  <span>{u.name}</span>
                                  {isCurrentAdmin && (
                                    <span className="text-[0.65rem] px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-semibold">
                                      Admin (You)
                                    </span>
                                  )}
                                </div>
                                <div className="text-[0.72rem] text-muted flex items-center gap-1.5">
                                  <span>{u.email}</span>
                                  {u.authProvider === 'google' && (
                                    <span className="text-[0.62rem] px-1 rounded bg-slate-100 text-slate-500 font-medium">
                                      Google OAuth
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-3 px-3">
                                <span className="px-2 py-0.5 rounded text-[0.7rem] font-bold bg-blue-50 text-blue-700 border border-blue-200 uppercase">
                                  {u.role}
                                </span>
                              </td>
                              <td className="py-3 px-3">
                                <div className="flex flex-wrap gap-1.5">
                                  {(u.roles && u.roles.length > 0 ? u.roles : [u.role || 'buyer']).map((r) => (
                                    <span
                                      key={r}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[0.68rem] font-semibold bg-slate-100 text-slate-700 border border-slate-200/80"
                                    >
                                      <span>{r}</span>
                                      {r !== 'buyer' && r !== 'admin' && !isAdminUser && (
                                        <button
                                          onClick={() => setRevokeModalItem({ type: 'user', data: u, role: r })}
                                          className="text-slate-400 hover:text-rose-600 transition-colors cursor-pointer ml-0.5 p-0.5 rounded"
                                          title={`Cancel '${r}' role for ${u.name}`}
                                        >
                                          <X size={11} />
                                        </button>
                                      )}
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td className="py-3 px-3">
                                {u.isBlocked ? (
                                  <span
                                    className="px-2 py-0.5 rounded text-[0.68rem] font-bold bg-red-100 text-red-800 border border-red-200 flex items-center gap-1 w-max cursor-help"
                                    title={u.blockedReason || 'Suspended by admin'}
                                  >
                                    <Ban size={12.5} /> Blocked
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded text-[0.68rem] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1 w-max">
                                    <CheckCircle2 size={12.5} /> Active
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-3 text-muted">
                                {new Date(u.createdAt).toLocaleDateString()}
                              </td>
                              <td className="py-3 px-3 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    onClick={() => {
                                      setGrantEmail(u.email);
                                      setActiveTab('grant');
                                    }}
                                    className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[0.7rem] transition-colors cursor-pointer"
                                    title="Modify User Role"
                                  >
                                    Modify Role
                                  </button>

                                  {!isAdminUser && (
                                    <>
                                      {u.isBlocked ? (
                                        <button
                                          onClick={() => handleToggleBlockClick(u)}
                                          disabled={userActionLoading === u._id}
                                          className="px-2.5 py-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold text-[0.7rem] transition-colors flex items-center gap-1 border border-emerald-200 cursor-pointer disabled:opacity-50"
                                          title="Restore User Access"
                                        >
                                          <Unlock size={13} /> Unblock
                                        </button>
                                      ) : (
                                        <button
                                          onClick={() => handleToggleBlockClick(u)}
                                          disabled={userActionLoading === u._id}
                                          className="px-2.5 py-1 rounded bg-amber-50 hover:bg-amber-100 text-amber-800 font-semibold text-[0.7rem] transition-colors flex items-center gap-1 border border-amber-200 cursor-pointer disabled:opacity-50"
                                          title="Block User Access"
                                        >
                                          <Ban size={13} /> Block
                                        </button>
                                      )}

                                      <button
                                        onClick={() => setDeleteModalItem(u)}
                                        disabled={userActionLoading === u._id}
                                        className="p-1.5 rounded bg-red-50 hover:bg-red-100 text-red-600 font-semibold text-[0.7rem] transition-colors border border-red-200 cursor-pointer disabled:opacity-50 flex items-center justify-center"
                                        title="Delete User Permanently"
                                      >
                                        <Trash2 size={14.5} />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: Direct Inquiries & Messages */}
          {activeTab === 'messages' && (
            <div className="card mb-6">
              <div className="card-header flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="card-title">Customer Inquiries &amp; Direct Messages</h2>
                  <p className="text-xs text-muted mt-0.5">
                    Messages submitted from the homepage "Contact Us" form stored in live MongoDB Atlas database.
                  </p>
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg">
                  {[
                    { id: 'ALL', label: 'All', count: contactsList.length },
                    { id: 'new', label: 'New', count: contactsList.filter((c) => c.status === 'new').length },
                    { id: 'in_progress', label: 'In Progress', count: contactsList.filter((c) => c.status === 'in_progress').length },
                    { id: 'resolved', label: 'Resolved', count: contactsList.filter((c) => c.status === 'resolved').length },
                  ].map((filter) => (
                    <button
                      key={filter.id}
                      type="button"
                      onClick={() => setContactStatusFilter(filter.id)}
                      className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        contactStatusFilter === filter.id
                          ? 'bg-white text-blue-600 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <span>{filter.label}</span>
                      <span className={`px-1.5 py-0.2 rounded-full text-[0.65rem] ${
                        contactStatusFilter === filter.id ? 'bg-blue-50 text-blue-700' : 'bg-slate-200 text-slate-700'
                      }`}>
                        {filter.count}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Search Bar */}
              <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                <div className="relative max-w-md">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={contactSearch}
                    onChange={(e) => setContactSearch(e.target.value)}
                    placeholder="Search by customer name, email, phone, or message text..."
                    className="w-full pl-9 pr-4 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                  />
                  {contactSearch && (
                    <button
                      onClick={() => setContactSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>

              <div className="p-5">
                {loadingContacts ? (
                  <div className="py-12 text-center text-muted">
                    <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-xs">Loading contact inquiries from MongoDB Atlas...</p>
                  </div>
                ) : filteredContacts.length === 0 ? (
                  <div className="py-14 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3">
                      <MessageSquare size={26} />
                    </div>
                    <h3 className="font-bold text-navy text-sm mb-1">No Inquiries Found</h3>
                    <p className="text-xs text-muted max-w-sm mx-auto">
                      {contactSearch
                        ? `No contact messages matching "${contactSearch}". Try clearing the search query.`
                        : `No ${contactStatusFilter !== 'ALL' ? contactStatusFilter.replace('_', ' ') : ''} inquiries received yet.`}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredContacts.map((item) => {
                      const cleanPhone = (item.phone || '').replace(/\D/g, '');
                      return (
                        <div
                          key={item._id}
                          className="bg-white border border-slate-200/90 rounded-xl p-4 hover:border-slate-300 transition-all shadow-xs text-left space-y-3"
                        >
                          {/* Header: User, Details & Status */}
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center shrink-0">
                                {item.name ? item.name.charAt(0).toUpperCase() : 'U'}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-slate-900 text-sm">{item.name}</span>
                                  <span className="px-2 py-0.5 rounded text-[0.68rem] font-semibold bg-slate-100 text-slate-600">
                                    {item.subject || 'General Inquiry'}
                                  </span>
                                  <span className="text-[0.7rem] text-slate-400 flex items-center gap-1">
                                    <Clock size={11} />
                                    {new Date(item.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap">
                                  <a
                                    href={`mailto:${item.email}?subject=Re: ${encodeURIComponent(item.subject || 'EstateXplorer Inquiry')}`}
                                    className="hover:text-blue-600 flex items-center gap-1 font-medium transition-colors"
                                  >
                                    <Mail size={12} className="text-slate-400" />
                                    <span>{item.email}</span>
                                  </a>
                                  {item.phone && (
                                    <>
                                      <span className="text-slate-300">•</span>
                                      <a
                                        href={`tel:${item.phone}`}
                                        className="hover:text-blue-600 flex items-center gap-1 font-medium transition-colors"
                                      >
                                        <Phone size={12} className="text-slate-400" />
                                        <span>{item.phone}</span>
                                      </a>
                                    </>
                                  )}
                                  {cleanPhone && (
                                    <>
                                      <span className="text-slate-300">•</span>
                                      <a
                                        href={`https://wa.me/${cleanPhone}?text=Hello%20${encodeURIComponent(item.name || '')},%20thank%20you%20for%20contacting%20EstateXplorer.`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-emerald-600 hover:text-emerald-700 flex items-center gap-1 font-medium transition-colors"
                                      >
                                        <MessageCircle size={12} />
                                        <span>WhatsApp</span>
                                      </a>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Status Selector & Delete */}
                            <div className="flex items-center gap-2 shrink-0">
                              <select
                                value={item.status || 'new'}
                                onChange={(e) => handleUpdateContactStatus(item._id, e.target.value)}
                                disabled={contactActionLoading === item._id}
                                className={`text-xs rounded-lg px-2.5 py-1 font-bold border transition-colors cursor-pointer focus:outline-none ${
                                  item.status === 'resolved'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : item.status === 'in_progress'
                                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                    : 'bg-amber-50 text-amber-700 border-amber-200'
                                }`}
                              >
                                <option value="new">● New</option>
                                <option value="in_progress">● In Progress</option>
                                <option value="resolved">✔ Resolved</option>
                              </select>

                              <button
                                type="button"
                                onClick={() => setDeleteContactModalItem(item)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                title="Delete inquiry"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>

                          {/* Message Content */}
                          <div className="bg-slate-50/80 rounded-lg px-3 py-2 text-xs text-slate-800 leading-relaxed border border-slate-100">
                            <p className="whitespace-pre-wrap">{item.message}</p>
                          </div>

                          {/* Replied Message Callout (if already replied) */}
                          {item.replyMessage && (
                            <div className="bg-emerald-50/80 border border-emerald-200 rounded-lg px-3 py-2 text-xs text-emerald-900 flex items-start gap-2">
                              <CheckCircle2 size={13} className="text-emerald-600 mt-0.5 shrink-0" />
                              <div className="min-w-0">
                                <span className="font-semibold text-emerald-800">
                                  Replied via Email{item.repliedAt ? ` (${new Date(item.repliedAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })})` : ''}:
                                </span>{' '}
                                <span className="whitespace-pre-wrap">{item.replyMessage}</span>
                              </div>
                            </div>
                          )}

                          {/* Reply Input & Send Button */}
                          <div className="flex items-center gap-2 pt-1">
                            <input
                              type="text"
                              value={replyTextMap[item._id] || ''}
                              onChange={(e) =>
                                setReplyTextMap((prev) => ({ ...prev, [item._id]: e.target.value }))
                              }
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                  e.preventDefault();
                                  handleSendReply(item._id, item.email);
                                }
                              }}
                              placeholder={`Type reply to send via email to ${item.email}...`}
                              disabled={sendingReplyId === item._id}
                              className="flex-1 text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white transition-all disabled:opacity-60"
                            />
                            <button
                              type="button"
                              onClick={() => handleSendReply(item._id, item.email)}
                              disabled={sendingReplyId === item._id || !replyTextMap[item._id]?.trim()}
                              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors shadow-xs cursor-pointer shrink-0"
                            >
                              {sendingReplyId === item._id ? (
                                <>
                                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                  <span>Sending...</span>
                                </>
                              ) : (
                                <>
                                  <Send size={13} />
                                  <span>Send Reply</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Reject Reason Modal */}
        {rejectModalItem && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 text-left">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
                <h4 className="font-bold text-slate-900 text-base flex items-center gap-2 text-red-600">
                  <XCircle size={18} /> Reject Role Application
                </h4>
                <button
                  onClick={() => setRejectModalItem(null)}
                  className="text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <p className="text-xs text-slate-600 mb-3">
                You are about to decline <strong>{rejectModalItem.email}</strong>'s application for{' '}
                <strong>{rejectModalItem.requestedRole.toUpperCase()}</strong> access.
              </p>

              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Reason for Rejection (Optional)
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="e.g. Incomplete profile or missing developer credentials..."
                rows={3}
                className="w-full p-2.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-red-500 mb-4"
              />

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setRejectModalItem(null)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleRejectConfirm}
                  className="px-4 py-2 rounded-lg text-xs font-bold bg-red-600 hover:bg-red-700 text-white cursor-pointer"
                >
                  Confirm Rejection
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Revoke / Cancel User Role Modal */}
        {revokeModalItem && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 text-left animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
                <h4 className="font-bold text-slate-900 text-base flex items-center gap-2 text-rose-600">
                  <Ban size={18} /> Cancel User Role
                </h4>
                <button
                  onClick={() => setRevokeModalItem(null)}
                  className="text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl mb-4 text-xs text-rose-900 flex items-start gap-2.5">
                <AlertTriangle size={18} className="text-rose-600 shrink-0 mt-0.5" />
                <div>
                  Cancelling the <strong>{revokeModalItem.role?.toUpperCase()}</strong> role for <strong>{revokeModalItem.data.email}</strong> will remove their special permissions. If their active dashboard is currently this role, they will be safely switched back to Buyer access.
                </div>
              </div>

              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Cancellation Reason (Optional)
              </label>
              <textarea
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
                placeholder="e.g. Requested by user, license expired, or administrative decision..."
                rows={3}
                className="w-full p-2.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-rose-500 mb-4"
              />

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setRevokeModalItem(null)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Keep Role
                </button>
                <button
                  type="button"
                  onClick={handleConfirmRevoke}
                  className="px-4 py-2 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white cursor-pointer transition-colors shadow-xs"
                >
                  Confirm &amp; Cancel Role
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Block User Modal */}
        {blockModalItem && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 text-left">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
                <h4 className="font-bold text-slate-900 text-base flex items-center gap-2 text-amber-700">
                  <Ban size={18} /> Block User Access
                </h4>
                <button
                  onClick={() => setBlockModalItem(null)}
                  className="text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl mb-4 text-xs text-amber-900 flex items-start gap-2.5">
                <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <div>
                  Blocking <strong>{blockModalItem.email}</strong> will immediately revoke their session and deny future login access across the platform.
                </div>
              </div>

              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Reason for Suspension (Optional)
              </label>
              <textarea
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                placeholder="e.g. Terms of Service violation or unauthorized activities..."
                rows={3}
                className="w-full p-2.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-amber-500 mb-4"
              />

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setBlockModalItem(null)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmBlock}
                  disabled={userActionLoading === blockModalItem._id}
                  className="px-4 py-2 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white cursor-pointer disabled:opacity-50"
                >
                  {userActionLoading === blockModalItem._id ? 'Blocking User...' : 'Confirm & Block User'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete User Account Modal */}
        {deleteModalItem && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 text-left">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
                <h4 className="font-bold text-slate-900 text-base flex items-center gap-2 text-red-600">
                  <Trash2 size={18} /> Delete User Account
                </h4>
                <button
                  onClick={() => setDeleteModalItem(null)}
                  className="text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl mb-4 text-xs text-red-900 flex items-start gap-2.5">
                <AlertTriangle size={18} className="text-red-600 shrink-0 mt-0.5" />
                <div>
                  <strong>Permanent Action Warning:</strong> This will permanently delete the user account for <strong>{deleteModalItem.email}</strong>, along with all their properties/listings, inquiries, and role requests.
                </div>
              </div>

              <p className="text-xs text-slate-600 mb-4">
                Are you sure you want to proceed with permanent deletion?
              </p>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setDeleteModalItem(null)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={userActionLoading === deleteModalItem._id}
                  className="px-4 py-2 rounded-lg text-xs font-bold bg-red-600 hover:bg-red-700 text-white cursor-pointer disabled:opacity-50"
                >
                  {userActionLoading === deleteModalItem._id ? 'Deleting Account...' : 'Permanently Delete User'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Contact Inquiry Modal */}
        {deleteContactModalItem && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 text-left">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
                <h4 className="font-bold text-slate-900 text-base flex items-center gap-2 text-red-600">
                  <Trash2 size={18} /> Delete Contact Inquiry
                </h4>
                <button
                  onClick={() => setDeleteContactModalItem(null)}
                  className="text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl mb-4 text-xs text-red-900 flex items-start gap-2.5">
                <AlertTriangle size={18} className="text-red-600 shrink-0 mt-0.5" />
                <div>
                  Are you sure you want to delete the inquiry from <strong>{deleteContactModalItem.name}</strong> ({deleteContactModalItem.email})? This action cannot be undone.
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setDeleteContactModalItem(null)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteContact}
                  disabled={contactActionLoading === deleteContactModalItem._id}
                  className="px-4 py-2 rounded-lg text-xs font-bold bg-red-600 hover:bg-red-700 text-white cursor-pointer disabled:opacity-50"
                >
                  {contactActionLoading === deleteContactModalItem._id ? 'Deleting...' : 'Delete Inquiry'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Reject KYC Documents Modal */}
        {rejectKycModalItem && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 text-left">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
                <h4 className="font-bold text-slate-900 text-base flex items-center gap-2 text-rose-600">
                  <XCircle size={18} /> Reject KYC Submission
                </h4>
                <button
                  type="button"
                  onClick={() => setRejectKycModalItem(null)}
                  className="text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <p className="text-xs text-slate-600 mb-3">
                You are rejecting verification documents for <strong>{rejectKycModalItem.name}</strong> ({rejectKycModalItem.email}). They will be informed to re-upload.
              </p>

              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Rejection Reason / Guidance
              </label>
              <textarea
                value={rejectKycReason}
                onChange={(e) => setRejectKycReason(e.target.value)}
                placeholder="e.g., Aadhar Card photo is blurred, or PAN card number does not match..."
                rows={3}
                className="w-full p-2.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-rose-500 mb-4"
              />

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setRejectKycModalItem(null)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleRejectKycConfirm}
                  disabled={kycActionLoading === rejectKycModalItem._id}
                  className="px-4 py-2 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white cursor-pointer disabled:opacity-50"
                >
                  {kycActionLoading === rejectKycModalItem._id ? 'Rejecting...' : 'Confirm Rejection'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
