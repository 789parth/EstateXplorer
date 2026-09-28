import React from 'react';
import { trustStats } from '../../utils/homeData';
import { Home, ShieldCheck, Users, Layers, Star, CheckCircle, Clock } from 'lucide-react';

const iconMap = {
  house: Home,
  shield: ShieldCheck,
  users: Users,
  layers: Layers,
  star: Star,
  checkCircle: CheckCircle,
  clock: Clock,
};

const TrustBar = () => {
  return (
    <div className="bg-navy py-7 px-4 md:px-8 border-t border-white/5">
      <div className="max-w-container mx-auto flex flex-wrap justify-between items-center gap-6">
        {trustStats.map((item, index) => {
          const IconComponent = iconMap[item.icon] || Home;
          return (
            <div key={index} className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gold/15 rounded-xl flex items-center justify-center text-gold flex-shrink-0">
                <IconComponent size={20} strokeWidth={2} />
              </div>
              <div className="text-left">
                <div className="text-base font-bold text-white leading-tight">
                  {item.num}
                </div>
                <div className="text-[0.75rem] text-white/50 leading-tight">
                  {item.label}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TrustBar;
