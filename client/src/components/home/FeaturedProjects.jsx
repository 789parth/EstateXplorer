import React, { useState, useEffect } from 'react';
import ProjectCard from './ProjectCard';
import { Link } from 'react-router-dom';
import { getFeaturedProperties } from '../../services/propertyService';

const FeaturedProjects = ({ onExplore }) => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fetchFeatured = async () => {
      try {
        const res = await getFeaturedProperties('project');
        if (isMounted && res.success && Array.isArray(res.data) && res.data.length > 0) {
          const mapped = res.data.map(p => {
            const loc = typeof p.location === 'string' ? p.location : `${p.location?.address || ''}, ${p.location?.city || ''}`;
            return {
              id: p._id,
              name: p.title || p.name,
              builder: p.builder?.builderProfile?.companyName || p.builder?.name || 'Top Builder',
              location: loc,
              bhk: p.type || 'Luxury Project',
              priceRange: p.priceDisplay || `₹${p.price}`,
              status: p.status === 'uc' || p.status === 'upcoming' ? 'under_construction' : 'ready',
              statusLabel: p.statusLabel || (p.status === 'ready' ? 'Ready To Move' : 'Under Construction'),
              rera: p.rera,
              tags: [p.status === 'ready' ? 'Ready' : 'New Launch'],
              features: p.usps && p.usps.length > 0 ? p.usps.slice(0, 3) : [p.type, loc, p.priceDisplay || `₹${p.price}`],
              meta: `${loc} • ${p.priceDisplay || ''}`,
              image: p.images && p.images.length > 0 ? p.images[0] : 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=600&auto=format&fit=crop',
            };
          });
          setProjects(mapped);
        }
      } catch (err) {
        console.error('Failed to fetch featured projects:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchFeatured();
    return () => { isMounted = false; };
  }, []);

  return (
    <section className="py-20 px-4 md:px-8 max-w-container mx-auto" id="projects">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-9 gap-3 text-left">
        <div>
          <div className="text-[0.72rem] font-semibold tracking-widest uppercase text-blue-mid mb-1.5">
            Featured Projects
          </div>
          <h2 className="font-display text-[clamp(1.6rem,3vw,2.1rem)] font-semibold text-navy tracking-tight">
            Iconic Projects by Top Builders
          </h2>
        </div>
        <Link
          to="/projects"
          className="text-xs font-semibold text-navy flex items-center gap-1.5 hover:gap-2.5 transition-all duration-250"
        >
          View All Projects →
        </Link>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {loading
          ? Array.from({ length: 2 }).map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl border border-slate-200 overflow-hidden animate-pulse flex flex-col h-[420px]"
              >
                <div className="h-64 bg-slate-200" />
                <div className="p-6 space-y-3 flex-1 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="h-3 bg-slate-200 rounded w-1/4" />
                    <div className="h-6 bg-slate-200 rounded w-3/4" />
                    <div className="h-3 bg-slate-200 rounded w-1/2" />
                  </div>
                  <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
                    <div className="h-6 bg-slate-200 rounded w-1/3" />
                    <div className="h-10 bg-slate-200 rounded w-1/3" />
                  </div>
                </div>
              </div>
            ))
          : projects.map((project) => (
              <ProjectCard key={project.id || project.name} project={project} onExplore={onExplore} />
            ))}
      </div>
    </section>
  );
};

export default React.memo(FeaturedProjects);

