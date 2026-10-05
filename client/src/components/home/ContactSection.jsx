import React, { useState } from 'react';
import { Mail, Phone, MapPin, Clock, Send, CheckCircle2, MessageSquare, AlertCircle } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { submitContactMessageApi } from '../../services/contactService';
import { broadcastRealtimeSync, SYNC_EVENTS } from '../../utils/realtimeSync';
import { isValidIndianMobile } from '../../utils/formatters';

const ContactSection = () => {
  const { showToast } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [mountTime] = useState(Date.now());
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: 'General Inquiry',
    message: '',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setEmailError('');
    setErrorMessage('');

    if (!formData.name?.trim()) {
      const msg = 'Please enter your full name.';
      setErrorMessage(msg);
      showToast(msg, 'error');
      return;
    }

    // Strict 10-digit mobile phone validation
    if (!formData.phone || !isValidIndianMobile(formData.phone)) {
      const msg = 'Please enter a valid 10-digit mobile number starting with 6, 7, 8, or 9.';
      setErrorMessage(msg);
      showToast(msg, 'error');
      return;
    }

    if (!formData.email?.trim()) {
      const msg = 'Please enter your email address.';
      setErrorMessage(msg);
      showToast(msg, 'error');
      return;
    }

    // Fast client-side disposable format check
    const emailClean = formData.email.trim().toLowerCase();
    const atIndex = emailClean.lastIndexOf('@');
    if (atIndex > 0) {
      const domain = emailClean.substring(atIndex + 1);
      const suspiciousKws = ['temp', 'burner', 'dispos', 'throwaway', 'fake', 'guerrilla', '10min', 'mailinator', 'trash'];
      if (suspiciousKws.some(kw => domain.includes(kw))) {
        setEmailError('Temporary and disposable email addresses are not allowed. Please enter a valid email address.');
        showToast('Temporary or disposable email addresses are not allowed.', 'error');
        return;
      }
    }

    if (!formData.subject?.trim()) {
      const msg = 'Please select an inquiry subject.';
      setErrorMessage(msg);
      showToast(msg, 'error');
      return;
    }

    if (!formData.message?.trim() || formData.message.trim().length < 10) {
      const msg = 'Please enter your message / requirements (minimum 10 characters).';
      setErrorMessage(msg);
      showToast(msg, 'error');
      return;
    }

    setSubmitting(true);
    try {
      const res = await submitContactMessageApi({
        ...formData,
        email: emailClean,
        formTimeMs: Date.now() - mountTime,
      });
      setSubmitting(false);
      setSubmitted(true);
      showToast(res.message || 'Thank you! Your message has been sent to EstateXplorer support.', 'success');
      broadcastRealtimeSync(SYNC_EVENTS.INQUIRY_CREATED, { action: 'new_contact_message', data: res.data });
      setFormData({
        name: '',
        email: '',
        phone: '',
        subject: 'General Inquiry',
        message: '',
      });
    } catch (err) {
      setSubmitting(false);
      const errorMsg = err.response?.data?.message || err.message || 'Failed to send message. Please try again.';
      setErrorMessage(errorMsg);
      if (
        errorMsg.toLowerCase().includes('disposable') ||
        errorMsg.toLowerCase().includes('temporary') ||
        errorMsg.toLowerCase().includes('email')
      ) {
        setEmailError(errorMsg);
      }
      showToast(errorMsg, 'error');
    }
  };

  return (
    <section className="py-20 px-4 md:px-8 max-w-container mx-auto" id="contact">
      {/* Section Header - Strictly matching Main Page Header Standard */}
      <div className="text-center mb-12">
        <div className="text-[0.72rem] font-semibold tracking-widest uppercase text-blue-mid mb-1.5">
          Get In Touch
        </div>
        <h2 className="font-display text-[clamp(1.6rem,3vw,2.1rem)] font-semibold text-navy tracking-tight">
          Contact EstateXplorer Advisory & Support
        </h2>
        <p className="text-muted text-xs md:text-sm max-w-2xl mx-auto mt-2">
          Have questions about a property, developer onboarding, or site visits? Connect directly with our certified property advisors.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* ── Left Column: Contact Channels ── */}
        <div className="lg:col-span-5 space-y-4 text-left">
          <div className="p-6 md:p-8 rounded-2xl bg-white border border-border shadow-sm">
            <h3 className="font-bold text-navy text-lg mb-6">Support Channels</h3>
            
            <div className="space-y-5">
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                  <Phone size={20} strokeWidth={2} />
                </div>
                <div>
                  <div className="text-xs text-muted font-medium">Customer Advisory Hotline</div>
                  <a href="tel:+9118002660123" className="text-sm font-bold text-navy hover:text-blue-mid transition-colors">
                    +91 18002660123 (Toll Free)
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
                  <Mail size={20} strokeWidth={2} />
                </div>
                <div>
                  <div className="text-xs text-muted font-medium">Official Inquiries & Support</div>
                  <a href="mailto:support@estatexplorer.in" className="text-sm font-bold text-navy hover:text-blue-mid transition-colors">
                    support@estatexplorer.in
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0">
                  <MapPin size={20} strokeWidth={2} />
                </div>
                <div>
                  <div className="text-xs text-muted font-medium">Corporate Headquarters</div>
                  <div className="text-sm font-semibold text-navy leading-snug">
                    EstateXplorer Tech Tower, Vallabh Vidhyanagar, Anand, Gujarat 388120
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
                  <Clock size={20} strokeWidth={2} />
                </div>
                <div>
                  <div className="text-xs text-muted font-medium">Operating Hours</div>
                  <div className="text-sm font-semibold text-navy">
                    Mon – Sat: 9:00 AM – 8:00 PM IST
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* SLA Quick Note */}
          <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-100 flex items-center gap-3 text-xs text-navy font-medium">
            <MessageSquare size={18} className="text-blue-600 flex-shrink-0" />
            <span>Average response time: within 2 business hours for all buyer and builder queries.</span>
          </div>
        </div>

        {/* ── Right Column: Interactive Direct Message Form ── */}
        <div className="lg:col-span-7 bg-white p-6 md:p-8 rounded-2xl border border-border shadow-sm text-left">
          <h3 className="font-bold text-navy text-lg mb-1">Send Us a Direct Message</h3>
          <p className="text-xs text-muted mb-6">Fill in your requirements and an EstateXplorer advisor will reach out shortly.</p>

          {errorMessage && !emailError && (
            <div className="p-3 mb-4 rounded-xl bg-red-50 border border-red-200 flex items-center gap-2 text-xs text-red-600 font-medium">
              <AlertCircle size={16} className="flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {submitted ? (
            <div className="p-8 text-center bg-emerald-50 rounded-xl border border-emerald-100 my-4">
              <CheckCircle2 size={40} className="text-emerald-600 mx-auto mb-3" />
              <h4 className="font-bold text-navy text-lg mb-1">Message Dispatched!</h4>
              <p className="text-xs text-muted mb-4">Our advisory team has received your query and will contact you via phone or email.</p>
              <button
                type="button"
                onClick={() => setSubmitted(false)}
                className="px-5 py-2.5 text-xs font-semibold rounded-lg bg-navy text-white hover:bg-navy-mid transition-all"
              >
                Send Another Message
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[0.72rem] font-semibold text-light uppercase tracking-wider mb-1">
                    Your Full Name <span className="text-red-500 font-bold" style={{ color: '#ef4444', marginLeft: '3px' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rahul Mehta"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-slate-50 border border-border rounded-lg text-sm p-3 outline-none focus:bg-white focus:border-navy transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[0.72rem] font-semibold text-light uppercase tracking-wider mb-1">
                    Phone Number <span className="text-red-500 font-bold" style={{ color: '#ef4444', marginLeft: '3px' }}>*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="+91 7600973093"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full bg-slate-50 border border-border rounded-lg text-sm p-3 outline-none focus:bg-white focus:border-navy transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[0.72rem] font-semibold text-light uppercase tracking-wider mb-1">
                    Email Address <span className="text-red-500 font-bold" style={{ color: '#ef4444', marginLeft: '3px' }}>*</span>
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="rahul@example.com"
                    value={formData.email}
                    onChange={(e) => {
                      setFormData({ ...formData, email: e.target.value });
                      if (emailError) setEmailError('');
                      if (errorMessage) setErrorMessage('');
                    }}
                    className={`w-full border rounded-lg text-sm p-3 outline-none transition-all ${
                      emailError
                        ? 'border-red-500 bg-red-50/20 text-red-950 focus:border-red-600'
                        : 'bg-slate-50 border-border focus:bg-white focus:border-navy'
                    }`}
                  />
                  {emailError && (
                    <p className="text-red-500 text-xs mt-1.5 flex items-center gap-1 font-medium">
                      <AlertCircle size={13} className="flex-shrink-0" />
                      <span>{emailError}</span>
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-[0.72rem] font-semibold text-light uppercase tracking-wider mb-1">
                    Inquiry Subject <span className="text-red-500 font-bold" style={{ color: '#ef4444', marginLeft: '3px' }}>*</span>
                  </label>
                  <select
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    required
                    className="w-full bg-slate-50 border border-border rounded-lg text-sm p-3 outline-none focus:bg-white focus:border-navy transition-all"
                  >
                    <option value="General Inquiry">General Property Inquiry</option>
                    <option value="Builder Listing Partnership">Builder / Developer Onboarding</option>
                    <option value="Agent Verification">Real Estate Broker Registration</option>
                    <option value="Homeowner Listing Assistance">Homeowner Property Post Help</option>
                    <option value="Legal & RERA Consultation">Legal & RERA Verification Query</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[0.72rem] font-semibold text-light uppercase tracking-wider mb-1">
                  Your Message / Requirements <span className="text-red-500 font-bold" style={{ color: '#ef4444', marginLeft: '3px' }}>*</span>
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="Tell us what you are looking for (e.g. location, BHK, budget, or question)..."
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  className="w-full bg-slate-50 border border-border rounded-lg text-sm p-3 outline-none focus:bg-white focus:border-navy transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full sm:w-auto px-8 py-3.5 rounded-lg bg-navy text-white text-xs font-semibold hover:bg-navy-mid transition-all flex items-center justify-center gap-2 shadow-sm"
              >
                <Send size={15} />
                {submitting ? 'Sending Message...' : 'Submit Inquiry'}
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
};

export default React.memo(ContactSection);

