import React from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Building2 } from 'lucide-react';
import RegisterForm from '../../components/auth/RegisterForm';
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';

const Register = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const initialEmail = location.state?.email || '';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between relative overflow-hidden">
      {/* Decorative ambient background glows */}
      <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-blue-50/50 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute -bottom-10 left-1/4 w-[450px] h-[250px] bg-slate-200/40 rounded-full blur-3xl pointer-events-none -z-10" />

      <Navbar solid={true} />

      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 pt-24 sm:pt-28 pb-16 relative z-10">
        <div className="w-full max-w-[500px] bg-white rounded-3xl border border-slate-200/90 shadow-[0_20px_60px_-15px_rgba(15,23,42,0.08),0_1px_3px_0_rgba(15,23,42,0.03)] p-6 sm:p-9 text-center relative">
          {/* Brand Logo */}
          <Link to="/" className="inline-flex items-center gap-2.5 mb-5 group">
            <div className="w-10 h-10 rounded-xl bg-slate-950 flex items-center justify-center text-white shadow-md shadow-slate-950/20 group-hover:scale-105 transition-transform duration-200">
              <Building2 className="w-5 h-5 text-blue-400" />
            </div>
            <div className="flex flex-col text-left">
              <span className="font-display font-extrabold text-xl leading-tight tracking-tight text-slate-900">
                Estate<span className="text-blue-600">X</span>plorer
              </span>
              <span className="text-[10px] font-semibold tracking-widest uppercase text-slate-400 -mt-0.5">
                Luxury Real Estate
              </span>
            </div>
          </Link>

          <h1 className="font-display font-bold text-2xl sm:text-[1.75rem] text-slate-900 tracking-tight mb-1">
            Create Your Account
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mb-6 leading-relaxed">
            Join thousands of buyers, owners, builders and agents on EstateXplorer
          </p>

          <RegisterForm
            initialEmail={initialEmail}
            onSuccess={() => navigate('/')}
            onSwitchToLogin={() => navigate('/login')}
          />
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Register;
