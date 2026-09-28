import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import Button from '../common/Button';
import MobileMenu from './MobileMenu';
import { User, LogOut, ChevronDown, LayoutDashboard } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { formatTitleCase } from '../../utils/formatters';

const Navbar = ({ onOpenLogin, onOpenRegister, solid = false }) => {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const pathname = location.pathname;
  const hash = location.hash;

  const handleLoginClick = () => {
    if (onOpenLogin) {
      onOpenLogin();
    } else {
      navigate('/login');
    }
  };

  const handleRegisterClick = () => {
    if (onOpenRegister) {
      onOpenRegister();
    } else {
      navigate('/register');
    }
  };

  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('home');

  useEffect(() => {
    if (pathname === '/') {
      if (hash === '#about') {
        setActiveSection('about');
      } else if (hash === '#contact') {
        setActiveSection('contact');
      } else {
        setActiveSection('home');
      }

      const handleScroll = () => {
        if (window.scrollY > 40) {
          setScrolled(true);
        } else {
          setScrolled(false);
        }
      };

      window.addEventListener('scroll', handleScroll);
      return () => window.removeEventListener('scroll', handleScroll);
    } else {
      if (pathname.startsWith('/listings') || pathname.startsWith('/property/')) {
        setActiveSection('properties');
      } else if (pathname.startsWith('/projects')) {
        setActiveSection('projects');
      } else if (pathname.startsWith('/about')) {
        setActiveSection('about');
      } else if (pathname.startsWith('/contact')) {
        setActiveSection('contact');
      } else {
        setActiveSection('');
      }
    }
  }, [pathname, hash]);

  const isSolid = solid || scrolled || pathname !== '/';

  const isAdmin = user?.role === 'admin';

  const baseNavLinks = [
    { label: 'Home', section: 'home', href: '/' },
    { label: 'Properties', section: 'properties', href: '/listings' },
    { label: 'Builder Projects', section: 'projects', href: '/projects' },
    { label: 'About Us', section: 'about', href: '/about' },
    { label: 'Contact Us', section: 'contact', href: '/contact' },
  ];

  const navLinks = isAdmin
    ? baseNavLinks.filter((link) => link.section !== 'about' && link.section !== 'contact')
    : baseNavLinks;

  return (
    <>
      <nav
        className="fixed top-0 left-0 right-0 z-[1000] bg-white border-b border-slate-200/80 shadow-xs py-3"
        style={{ backgroundColor: '#ffffff', opacity: 1 }}
      >
        <div className="max-w-container mx-auto px-4 md:px-8 flex items-center justify-between gap-5 relative">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 font-bold text-lg transition-colors flex-shrink-0">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-sm bg-slate-900 text-white">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="w-5 h-5">
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </div>
            <span className="font-sans tracking-tight text-lg font-extrabold text-slate-900">
              Estate<span className="text-blue-500">X</span>plorer
            </span>
          </Link>

          {/* Desktop Navigation Links */}
          <ul className="hidden lg:flex items-center gap-1 list-none absolute left-1/2 -translate-x-1/2">
            {navLinks.map((link) => {
              const isActive = activeSection === link.section;
              return (
                <li key={link.section}>
                  <Link
                    to={link.href}
                    onClick={(e) => {
                      if (pathname === '/' && (link.section === 'about' || link.section === 'contact' || link.section === 'home')) {
                        const el = document.getElementById(link.section);
                        if (el) {
                          e.preventDefault();
                          el.scrollIntoView({ behavior: 'smooth' });
                          setActiveSection(link.section);
                        }
                      }
                    }}
                    className={`relative text-[0.9375rem] px-4 py-2 rounded-full transition-all duration-200 ${
                      isActive
                        ? 'text-blue-600 font-bold bg-blue-50/90'
                        : 'text-slate-700 font-semibold hover:text-slate-900 hover:bg-slate-100/70'
                    }`}
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* Actions / Auth Menu */}
          <div className="flex items-center gap-2.5 flex-shrink-0">
            {isAuthenticated ? (
              <div className="relative">
                <button
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                  className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-full border border-slate-300 text-slate-900 bg-white hover:bg-slate-50 hover:border-slate-400 transition-all duration-200 shadow-sm cursor-pointer"
                >
                  <div className="w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shadow-inner flex-shrink-0">
                    {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <span className="text-xs font-bold max-w-[160px] md:max-w-[220px] truncate hidden sm:inline-block">
                    {formatTitleCase(user?.name) || 'User'}
                  </span>
                  <ChevronDown size={14} className={`transition-transform duration-200 ${userDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown Menu */}
                {userDropdownOpen && (
                  <div
                    className="absolute right-0 mt-2.5 w-60 bg-white border border-slate-200/90 rounded-2xl shadow-luxury overflow-hidden z-50 text-left animate-in fade-in zoom-in-95 duration-150"
                    onMouseLeave={() => setUserDropdownOpen(false)}
                  >
                    <div className="px-4 py-3.5 border-b border-slate-100 bg-slate-50/80">
                      <p className="text-xs font-bold text-slate-900 truncate">{formatTitleCase(user?.name) || 'User'}</p>
                      <p className="text-[0.72rem] text-slate-500 truncate mt-0.5 font-medium">{user?.email}</p>
                      <span className="inline-block mt-2 text-[0.65rem] font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/60 uppercase tracking-wider">
                        {user?.role} Account
                      </span>
                    </div>

                    <div className="py-1">
                      {['buyer', 'builder', 'agent', 'owner', 'admin'].includes(user?.role) && (
                        <>
                          <Link
                            to="/dashboard"
                            className="flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-50 transition-colors"
                            onClick={() => setUserDropdownOpen(false)}
                          >
                            <LayoutDashboard size={15} className="text-slate-400" />
                            Dashboard
                          </Link>
                          <Link
                            to="/dashboard/profile"
                            className="flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-50 transition-colors"
                            onClick={() => setUserDropdownOpen(false)}
                          >
                            <User size={15} className="text-slate-400" />
                            My Profile
                          </Link>
                        </>
                      )}
                    </div>

                    <div className="border-t border-slate-100">
                      <button
                        onClick={() => {
                          setUserDropdownOpen(false);
                          logout();
                        }}
                        className="w-full flex items-center gap-2.5 px-4 py-3 text-xs font-semibold text-rose-600 hover:bg-rose-50/80 transition-colors text-left cursor-pointer"
                      >
                        <LogOut size={15} />
                        Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="hidden sm:flex items-center gap-2.5">
                <button
                  onClick={handleLoginClick}
                  className="text-xs font-bold px-5 py-2 rounded-full border text-slate-800 border-slate-300 hover:border-slate-400 hover:bg-slate-100 bg-white transition-all duration-200 cursor-pointer"
                >
                  Log In
                </button>
                <button
                  onClick={handleRegisterClick}
                  className="text-xs font-bold px-5 py-2 rounded-full bg-slate-900 text-white hover:bg-slate-800 shadow-slate-900/10 transition-all duration-200 hover:-translate-y-0.5 shadow-sm cursor-pointer"
                >
                  Sign Up
                </button>
              </div>
            )}

            {/* Hamburger button for mobile */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg text-slate-900 cursor-pointer"
              aria-label="Toggle navigation"
            >
              <div className="w-5 flex flex-col gap-1.2">
                <span className={`block h-0.5 rounded-full bg-slate-900 transition-all duration-300 ${mobileMenuOpen ? 'rotate-45 translate-y-1.5' : ''}`} />
                <span className={`block h-0.5 rounded-full bg-slate-900 transition-all duration-300 ${mobileMenuOpen ? 'opacity-0' : ''}`} />
                <span className={`block h-0.5 rounded-full bg-slate-900 transition-all duration-300 ${mobileMenuOpen ? '-rotate-45 -translate-y-1.5' : ''}`} />
              </div>
            </button>
          </div>
        </div>
      </nav>

      <MobileMenu
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        activeSection={activeSection}
        onOpenLogin={handleLoginClick}
        onOpenRegister={handleRegisterClick}
        user={user}
        onLogout={logout}
      />
    </>
  );
};

export default Navbar;
