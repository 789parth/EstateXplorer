import React from 'react';
import { User, Home, Building2, Briefcase, Check } from 'lucide-react';

const rolesList = [
  {
    id: 'buyer',
    title: 'Buyer',
    subtitle: 'Find & buy properties',
    icon: User,
  },
  {
    id: 'owner',
    title: 'Owner',
    subtitle: 'Sell or rent properties',
    icon: Home,
  },
  {
    id: 'builder',
    title: 'Builder',
    subtitle: 'Showcase projects',
    icon: Building2,
  },
  {
    id: 'agent',
    title: 'Agent',
    subtitle: 'Brokers & advisors',
    icon: Briefcase,
  },
];

const RoleSelect = ({ selectedRole, onSelectRole, title = 'Select Role to Login As' }) => {
  return (
    <div className="w-full text-left mb-4">
      {title && (
        <label className="block text-[0.72rem] font-bold text-slate-700 uppercase tracking-wider mb-2.5">
          {title}
        </label>
      )}
      <div className="grid grid-cols-2 gap-2.5">
        {rolesList.map((r) => {
          const IconComponent = r.icon;
          const isSelected = selectedRole === r.id;
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => onSelectRole(r.id)}
              aria-pressed={isSelected}
              className={`group relative p-2.5 sm:p-3 rounded-xl border text-left cursor-pointer transition-all duration-200 flex items-center gap-2.5 sm:gap-3 outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                isSelected
                  ? 'border-blue-600 bg-blue-50/70 shadow-xs ring-1 ring-blue-600/30'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60 shadow-2xs'
              }`}
            >
              <div
                className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg shrink-0 flex items-center justify-center transition-all ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200/80 group-hover:text-slate-800'
                }`}
              >
                <IconComponent size={16} strokeWidth={2.2} />
              </div>
              <div className="flex flex-col min-w-0 flex-1">
                <span
                  className={`text-xs sm:text-sm font-bold leading-tight whitespace-nowrap transition-colors ${
                    isSelected ? 'text-blue-950' : 'text-slate-800'
                  }`}
                >
                  {r.title}
                </span>
                <span
                  className={`text-[10px] sm:text-[11px] leading-tight mt-0.5 truncate transition-colors ${
                    isSelected ? 'text-blue-600 font-medium' : 'text-slate-400'
                  }`}
                >
                  {r.subtitle}
                </span>
              </div>
              {isSelected && (
                <div className="hidden sm:flex w-4 h-4 rounded-full bg-blue-600 text-white items-center justify-center shrink-0 ml-auto">
                  <Check size={10} strokeWidth={3} />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default RoleSelect;
