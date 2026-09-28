import React, { useState } from 'react';
import { Search } from 'lucide-react';
import { popularSearches } from '../../utils/homeData';

const SearchCard = ({ onSearch }) => {
  const [activeTab, setActiveTab] = useState('All');
  const [location, setLocation] = useState('');
  const [propertyType, setPropertyType] = useState('Select type');
  const [budget, setBudget] = useState('Min – Max');
  const [bedrooms, setBedrooms] = useState('Any');

  const tabs = ['All', 'Buy', 'Rent', 'New Projects', 'Commercial'];

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (onSearch) {
      onSearch({
        tab: activeTab,
        purpose: activeTab === 'Rent' ? 'rent' : activeTab === 'Buy' ? 'buy' : 'all',
        location,
        propertyType,
        budget,
        bedrooms,
      });
    }
  };

  return (
    <div className="w-full text-left">
      <div className="bg-white border border-border rounded-xl p-2 shadow-lg max-w-[860px]">
        {/* Tabs */}
        <div className="flex items-center gap-1 px-2 pt-1 pb-1 mb-1 overflow-x-auto scrollbar-none flex-nowrap">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`text-xs font-semibold px-3.5 py-1.5 rounded-lg whitespace-nowrap transition-all duration-250 cursor-pointer flex-shrink-0 ${
                activeTab === tab
                  ? 'bg-navy-soft text-navy font-bold shadow-xs'
                  : 'text-muted hover:text-navy'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Fields */}
        <form
          onSubmit={handleSearchSubmit}
          className="flex flex-col md:flex-row items-center gap-0 p-1"
        >
          {/* Location */}
          <div className="w-full md:flex-1 p-2.5 md:border-r border-border border-b md:border-b-0">
            <label className="block text-[0.7rem] font-semibold text-light uppercase tracking-wider mb-1">
              Location
            </label>
            <input
              type="text"
              placeholder="Enter location or locality"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full border-none outline-none text-sm font-medium text-navy bg-transparent"
            />
          </div>

          {/* Property Type */}
          <div className="w-full md:flex-1 p-2.5 md:border-r border-border border-b md:border-b-0">
            <label className="block text-[0.7rem] font-semibold text-light uppercase tracking-wider mb-1">
              Property Type
            </label>
            <select
              value={propertyType}
              onChange={(e) => setPropertyType(e.target.value)}
              className="w-full border-none outline-none text-sm font-medium text-navy bg-transparent cursor-pointer"
            >
              <option value="Select type">Select type</option>
              <option value="Apartment">Apartment</option>
              <option value="Villa">Villa</option>
              <option value="Penthouse">Penthouse</option>
              <option value="Commercial">Commercial</option>
              <option value="Plot">Plot / Land</option>
              <option value="Studio">Studio</option>
              <option value="Row House">Row House</option>
              <option value="Duplex">Duplex</option>
            </select>
          </div>

          {/* Budget */}
          <div className="w-full md:flex-1 p-2.5 md:border-r border-border border-b md:border-b-0">
            <label className="block text-[0.7rem] font-semibold text-light uppercase tracking-wider mb-1">
              Budget
            </label>
            <select
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              className="w-full border-none outline-none text-sm font-medium text-navy bg-transparent cursor-pointer"
            >
              <option value="Min – Max">Min – Max</option>
              <option value="Under ₹25L">Under ₹25L</option>
              <option value="₹25L – ₹50L">₹25L – ₹50L</option>
              <option value="₹50L – ₹1Cr">₹50L – ₹1Cr</option>
              <option value="₹1Cr – ₹1.25Cr">₹1Cr – ₹1.25Cr</option>
              <option value="₹1.25Cr – ₹1.5Cr">₹1.25Cr – ₹1.5Cr</option>
              <option value="₹1.5Cr – ₹2Cr">₹1.5Cr – ₹2Cr</option>
              <option value="Above ₹2Cr">Above ₹2Cr</option>
            </select>
          </div>

          {/* Bedrooms */}
          <div className="w-full md:flex-1 p-2.5 border-b md:border-b-0">
            <label className="block text-[0.7rem] font-semibold text-light uppercase tracking-wider mb-1">
              Bedrooms
            </label>
            <select
              value={bedrooms}
              onChange={(e) => setBedrooms(e.target.value)}
              className="w-full border-none outline-none text-sm font-medium text-navy bg-transparent cursor-pointer"
            >
              <option value="Any">Any</option>
              <option value="1 BHK">1 BHK</option>
              <option value="2 BHK">2 BHK</option>
              <option value="3 BHK">3 BHK</option>
              <option value="4+ BHK">4+ BHK</option>
            </select>
          </div>

          {/* Search Button */}
          <button
            type="submit"
            className="w-full md:w-auto bg-navy text-white font-semibold text-xs py-3.5 px-7 rounded-lg flex items-center justify-center gap-2 hover:bg-navy-mid hover:scale-[1.02] transition-all duration-250 whitespace-nowrap m-1 cursor-pointer shadow-md"
          >
            <Search size={16} strokeWidth={2.5} />
            Search Properties
          </button>
        </form>
      </div>

      {/* Popular Chips */}
      <div className="flex flex-wrap gap-2 items-center mt-4 text-left">
        <span className="text-xs text-white/55 font-medium">
          Popular Searches:
        </span>
        {popularSearches.map((chip) => (
          <button
            key={chip}
            type="button"
            onClick={() => {
              if (chip === 'Luxury Villas') {
                setPropertyType('Villa');
                if (onSearch) onSearch({ tab: activeTab, location: '', propertyType: 'Villa', budget, bedrooms });
              } else if (chip === '2 BHK Flats') {
                setPropertyType('Apartment');
                setBedrooms('2 BHK');
                if (onSearch) onSearch({ tab: activeTab, location: '', propertyType: 'Apartment', budget, bedrooms: '2 BHK' });
              } else if (chip === 'Under ₹1 Cr') {
                setBudget('₹50L – ₹1Cr');
                if (onSearch) onSearch({ tab: activeTab, location, propertyType, budget: '₹50L – ₹1Cr', bedrooms });
              } else if (chip === 'Ready to Move') {
                if (onSearch) onSearch({ tab: activeTab, location, propertyType, budget, bedrooms, status: 'ready' });
              } else if (chip === 'Commercial Spaces') {
                setPropertyType('Commercial');
                if (onSearch) onSearch({ tab: 'Commercial', location: '', propertyType: 'Commercial', budget, bedrooms });
              } else {
                setLocation(chip);
                if (onSearch) onSearch({ tab: activeTab, location: chip, propertyType, budget, bedrooms });
              }
            }}
            className="bg-white/10 border border-white/15 text-white/90 px-3.5 py-1 rounded-full text-xs font-medium hover:bg-white hover:border-white hover:text-navy transition-all duration-250 cursor-pointer"
          >
            {chip}
          </button>
        ))}
      </div>
    </div>
  );
};

export default SearchCard;
