import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Button from '../common/Button';
import { Link, useLocation } from 'react-router-dom';
import { X, User, LayoutDashboard, LogOut } from 'lucide-react';
import { formatTitleCase } from '../../utils/formatters';

const MobileMenu = ({ isOpen, onClose, activeSection, onOpenLogin, onOpenRegister, user, onLogout }) => {
  const location = useLocation();
  if (!isOpen) return null;

  const isAdmin = user?.role === 'admin';
  const baseNavItems = [
    { label: 'Home', section: 'home', href: '/' },
    { label: 'Properties', section: 'properties', href: '/listings' },
    { label: 'Builder Projects', section: 'projects', href: '/projects' },
    { label: 'About Us', section: 'about', href: '/about' },
    { label: 'Contact Us', section: 'contact', href: '/contact' },
  ];

  const navItems = isAdmin
    ? baseNavItems.filter((item) => item.section !== 'about' && item.section !== 'contact')
    : baseNavItems;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3 }}
        className="fixed inset-0 bg-white/98 backdrop-blur-2xl z-[999] pt-6 px-6 pb-8 flex flex-col justify-between overflow-y-auto"
      >
        {/* Top Header Row with Brand & Close Button */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
          <Link to="/" onClick={onClose} className="text-lg font-black tracking-tight text-slate-900">
            Estate<span className="text-blue-600">Xplorer</span>
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Close Menu"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-col gap-1 my-6">
          {navItems.map((item) => (
            <Link
              key={item.section}
              to={item.href}
              onClick={(e) => {
                onClose();
                if (location.pathname === '/' && (item.section === 'about' || item.section === 'contact' || item.section === 'home')) {
                  const el = document.getElementById(item.section);
                  if (el) {
                    e.preventDefault();
                    el.scrollIntoView({ behavior: 'smooth' });
                  }
                }
              }}
              className={`text-lg font-semibold py-3 px-3 rounded-xl border-b border-slate-100 transition-all duration-200 ${
                activeSection === item.section ? 'text-blue-600 bg-blue-50/60 font-bold' : 'text-slate-800 hover:text-blue-600 hover:bg-slate-50'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>

        <div className="flex flex-col gap-3 mt-auto">
          {user ? (
            <div className="flex flex-col gap-2.5">
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold shadow-xs">
                  {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-slate-900 text-sm truncate">{formatTitleCase(user.name)}</div>
                  <div className="text-xs text-slate-500 capitalize">{user.role} Account</div>
                </div>
              </div>
              {['buyer', 'builder', 'agent', 'owner', 'admin'].includes(user.role) && (
                <div className="grid grid-cols-2 gap-2">
                  <Link to="/dashboard" onClick={onClose}>
                    <Button variant="outline" size="sm" className="w-full flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold">
                      <LayoutDashboard size={14} />
                      <span>Dashboard</span>
                    </Button>
                  </Link>
                  <Link to="/dashboard/profile" onClick={onClose}>
                    <Button variant="outline" size="sm" className="w-full flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold">
                      <User size={14} />
                      <span>Profile</span>
                    </Button>
                  </Link>
                </div>
              )}
              <Button
                variant="outline"
                fullWidth
                onClick={() => {
                  onClose();
                  onLogout();
                }}
                className="text-rose-600 hover:bg-rose-50 hover:border-rose-200 text-xs font-bold py-2.5 flex items-center justify-center gap-1.5"
              >
                <LogOut size={14} />
                <span>Sign Out</span>
              </Button>
            </div>
          ) : (
            <>
              <Button
                variant="outline"
                fullWidth
                onClick={() => {
                  onClose();
                  onOpenLogin();
                }}
              >
                Login
              </Button>
              <Button
                variant="primary"
                fullWidth
                onClick={() => {
                  onClose();
                  onOpenRegister();
                }}
              >
                Sign Up
              </Button>
            </>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default MobileMenu;
