import React from 'react';
import { whyItems } from '../../utils/homeData';
import {
  CheckCircle2,
  Shield,
  CreditCard,
  Building,
  UserCheck,
  HeartHandshake,
} from 'lucide-react';

const iconMap = {
  checkBadge: CheckCircle2,
  scale: Shield,
  creditCard: CreditCard,
  building: Building,
  userCheck: UserCheck,
  heartHandshake: HeartHandshake,
};

const WhySection = () => {
  return (
    <section className="bg-[#eef1f6] border-y border-border py-14" id="why">
      <div className="max-w-container mx-auto px-4 md:px-8 text-center mb-9">
        <div className="text-[0.72rem] font-semibold tracking-widest uppercase text-blue-mid mb-1.5">
          Why Choose EstateXplorer
        </div>
        <h2 className="font-display text-[clamp(1.6rem,3vw,2.1rem)] font-semibold text-navy tracking-tight">
          We Make Real Estate Simple & Secure
        </h2>
      </div>

      <div className="max-w-container mx-auto px-4 md:px-8 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-5">
        {whyItems.map((item, idx) => {
          const IconComponent = iconMap[item.icon] || CheckCircle2;
          return (
            <div key={idx} className="text-center">
              <div className="w-13 h-13 bg-navy/7 rounded-2xl flex items-center justify-center mx-auto mb-3.5 text-navy">
                <IconComponent size={24} strokeWidth={2} />
              </div>
              <h4 className="text-xs sm:text-sm font-semibold text-navy mb-1">
                {item.title}
              </h4>
              <p className="text-[0.75rem] text-muted leading-snug">
                {item.desc}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default WhySection;
