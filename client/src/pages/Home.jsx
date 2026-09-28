import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check } from 'lucide-react';
import Navbar from '../components/layout/Navbar';
import Hero from '../components/home/Hero';
import TrustBar from '../components/home/TrustBar';
import CategoryGrid from '../components/home/CategoryGrid';
import FeaturedProperties from '../components/home/FeaturedProperties';
import FeaturedProjects from '../components/home/FeaturedProjects';
import CityGrid from '../components/home/CityGrid';
import WhySection from '../components/home/WhySection';
import AboutSection from '../components/home/AboutSection';
import ExperienceSection from '../components/home/ExperienceSection';
import InsightsGrid from '../components/home/InsightsGrid';
import ContactSection from '../components/home/ContactSection';
import Footer from '../components/layout/Footer';
import Modal from '../components/common/Modal';
import LoginForm from '../components/auth/LoginForm';
import RegisterForm from '../components/auth/RegisterForm';
import ForgotForm from '../components/auth/ForgotForm';
import ResetForm from '../components/auth/ResetForm';
import Button from '../components/common/Button';
import EmailVerificationModal from '../components/common/EmailVerificationModal';
import { submitInquiry } from '../services/propertyService';
import { useAuth } from '../hooks/useAuth';

const Home = () => {
  const navigate = useNavigate();
  const { user, showToast } = useAuth();
  const [authModalState, setAuthModalState] = useState(null); // 'login' | 'register' | 'forgot' | 'reset' | null
  const [authModalEmail, setAuthModalEmail] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [modalType, setModalType] = useState(null); // 'visit' | 'details' | 'project' | null
  const [verifyModalOpen, setVerifyModalOpen] = useState(false);
  const [bookingSubmitting, setBookingSubmitting] = useState(false);
  const [bookedPropertyIds, setBookedPropertyIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('booked_visits') || '[]');
    } catch {
      return [];
    }
  });

  const handleBookVisit = (property) => {
    if (!user) {
      showToast('Please log in to schedule and book a site visit.', 'info');
      setAuthModalState('login');
      return;
    }
    setSelectedItem(property);
    if (!user.isVerified) {
      setVerifyModalOpen(true);
      return;
    }
    setModalType('visit');
  };

  const handleViewDetails = (property) => {
    setSelectedItem(property);
    setModalType('details');
  };

  const handleExploreProject = (project) => {
    setSelectedItem(project);
    setModalType('project');
  };

  const handleBookVisitConfirm = async (e) => {
    e.preventDefault();
    if (!user) {
      showToast('Please log in to book a site visit.', 'info');
      setModalType(null);
      setAuthModalState('login');
      return;
    }
    if (!user.isVerified) {
      setModalType(null);
      setVerifyModalOpen(true);
      return;
    }

    try {
      setBookingSubmitting(true);
      const visitDate = e.target.visitDate?.value;
      const visitTime = e.target.visitTime?.value;
      if (selectedItem?.id) {
        await submitInquiry(selectedItem.id, {
          name: user.name,
          email: user.email,
          phone: user.phone || '',
          message: `Site visit scheduled for ${selectedItem.name}`,
          visitRequested: true,
          visitDate,
          visitTime,
          propertyTitle: selectedItem.name,
          propertyLocation: selectedItem.location,
          propertyImage: selectedItem.image,
          builderName: selectedItem.builder,
        });
        setBookedPropertyIds((prev) => {
          const updated = [...prev, String(selectedItem.id)];
          try {
            localStorage.setItem('booked_visits', JSON.stringify(updated));
          } catch {}
          return updated;
        });
      }
      setModalType(null);
      showToast(`Site visit booked for ${selectedItem?.name}! We'll contact you shortly.`, 'success');
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to book site visit.';
      showToast(msg, 'error');
      if (err.response?.data?.requiresEmailVerification) {
        setModalType(null);
        setVerifyModalOpen(true);
      }
    } finally {
      setBookingSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg">
      {/* 1. Header Navigation */}
      <Navbar
        solid={true}
        onOpenLogin={() => setAuthModalState('login')}
        onOpenRegister={() => setAuthModalState('register')}
      />

      {/* 2. Hero + Search Card */}
      <Hero />

      {/* 3. Trust Bar */}
      <TrustBar />

      {/* 4. Categories */}
      <CategoryGrid />

      {/* 5. Featured Properties */}
      <FeaturedProperties
        onBookVisit={handleBookVisit}
        onViewDetails={handleViewDetails}
        bookedPropertyIds={bookedPropertyIds}
      />

      {/* 6. Featured Projects */}
      <FeaturedProjects onExplore={handleExploreProject} />

      {/* 7. Cities */}
      <CityGrid />

      {/* 9. About Us & Values (hidden for admin) */}
      {user?.role !== 'admin' && <AboutSection />}

      {/* 10. Why Choose Us */}
      <WhySection />

      {/* 10. 3D Experience Viewer */}
      <ExperienceSection />

      {/* 11. Real Estate Insights */}
      <InsightsGrid />

      {/* 12. Contact Us Section (hidden for admin) */}
      {user?.role !== 'admin' && <ContactSection />}

      {/* Footer */}
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
        title="Join EstateXplorer"
        maxWidth="max-w-lg"
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
        title="Forgot Password"
      >
        <ForgotForm
          onOtpSent={(email) => {
            setResetEmail(email);
            setAuthModalState('reset');
          }}
          onBackToLogin={() => setAuthModalState('login')}
        />
      </Modal>

      <Modal
        isOpen={authModalState === 'reset'}
        onClose={() => setAuthModalState(null)}
        title="Reset Password"
      >
        <ResetForm
          email={resetEmail}
          onSuccess={() => setAuthModalState(null)}
          onBackToLogin={() => setAuthModalState('login')}
        />
      </Modal>

      {/* Book Visit Modal */}
      <Modal
        isOpen={modalType === 'visit'}
        onClose={() => setModalType(null)}
        title={`Book Site Visit — ${selectedItem?.name || ''}`}
      >
        <form onSubmit={handleBookVisitConfirm} className="space-y-4 text-left">
          <p className="text-xs text-muted">
            Select your preferred date and time slot for visiting <strong className="text-navy">{selectedItem?.name}</strong> in {selectedItem?.location}.
          </p>

          <div>
            <label className="block text-[0.72rem] font-semibold text-light uppercase mb-1">
              Select Visit Date
            </label>
            <input
              type="date"
              name="visitDate"
              required
              min={new Date().toISOString().split('T')[0]}
              className="w-full bg-white border border-border rounded-lg text-sm p-2.5 outline-none focus:border-navy"
            />
          </div>

          <div>
            <label className="block text-[0.72rem] font-semibold text-light uppercase mb-1">
              Select Preferred Time Slot
            </label>
            <select name="visitTime" className="w-full bg-white border border-border rounded-lg text-sm p-2.5 outline-none focus:border-navy">
              <option>10:00 AM – 12:00 PM</option>
              <option>12:00 PM – 02:00 PM</option>
              <option>02:00 PM – 04:00 PM</option>
              <option>04:00 PM – 06:00 PM</option>
            </select>
          </div>

          <Button type="submit" variant="primary" fullWidth disabled={bookingSubmitting} className="mt-4">
            {bookingSubmitting ? 'Booking Site Visit...' : 'Confirm Visit Booking'}
          </Button>
        </form>
      </Modal>

      {/* View Property Details Modal */}
      <Modal
        isOpen={modalType === 'details'}
        onClose={() => setModalType(null)}
        title={selectedItem?.name || 'Property Details'}
        maxWidth="max-w-xl"
      >
        {selectedItem && (
          <div className="space-y-4 text-left">
            <div className="aspect-[16/10] overflow-hidden rounded-xl">
              <img
                src={selectedItem.image}
                alt={selectedItem.name}
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <div className="text-xs font-bold text-light uppercase tracking-wider">
                {selectedItem.builder}
              </div>
              <h3 className="text-xl font-bold text-navy">{selectedItem.name}</h3>
              <p className="text-xs text-muted">{selectedItem.location}</p>
            </div>
            <div className="flex justify-between items-baseline p-3 bg-bg rounded-lg">
              <div className="text-xl font-bold text-navy">{selectedItem.price}</div>
              <div className="text-xs text-muted">{selectedItem.emi}</div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-navy font-medium p-3 border border-border rounded-lg">
              <div>Bedrooms: {selectedItem.beds}</div>
              <div>Bathrooms: {selectedItem.baths}</div>
              <div>Area: {selectedItem.sqft}</div>
              <div>Parking: {selectedItem.parking}</div>
            </div>
            <Button
              variant="dark"
              fullWidth
              onClick={() => {
                if (!user) {
                  showToast('Please log in to schedule and book a site visit.', 'info');
                  setModalType(null);
                  setAuthModalState('login');
                  return;
                }
                if (!user.isVerified) {
                  setModalType(null);
                  setVerifyModalOpen(true);
                  return;
                }
                setModalType('visit');
              }}
            >
              Book Site Visit Now
            </Button>
          </div>
        )}
      </Modal>

      {/* Explore Project Modal */}
      <Modal
        isOpen={modalType === 'project'}
        onClose={() => setModalType(null)}
        title={selectedItem?.name || 'Project Details'}
        maxWidth="max-w-xl"
      >
        {selectedItem && (
          <div className="space-y-4 text-left">
            <div className="aspect-[16/10] overflow-hidden rounded-xl">
              <img
                src={selectedItem.image}
                alt={selectedItem.name}
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <div className="text-xs font-bold text-light uppercase tracking-wider">
                {selectedItem.builder}
              </div>
              <h3 className="text-xl font-bold text-navy">{selectedItem.name}</h3>
              <p className="text-xs text-muted">{selectedItem.meta}</p>
            </div>
            <div>
              <h4 className="text-xs font-bold text-navy uppercase mb-2">Key Highlights</h4>
              <ul className="space-y-1.5 text-xs text-muted">
                {selectedItem.features?.map((feat, idx) => (
                  <li key={idx} className="flex items-center gap-2">
                    <Check size={13} className="text-emerald-600 flex-shrink-0" />
                    {feat}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </Modal>

      {/* Mandatory Email Verification Modal for Site Visit Bookings */}
      <EmailVerificationModal
        isOpen={verifyModalOpen}
        onClose={() => setVerifyModalOpen(false)}
        onVerified={() => {
          if (selectedItem) {
            setModalType('visit');
          }
        }}
        actionType="visit"
        propertyTitle={selectedItem?.name || ''}
      />
    </div>
  );
};

export default Home;
