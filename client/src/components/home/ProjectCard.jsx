import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ArrowRight, Building2 } from 'lucide-react';
import Button from '../common/Button';

const ProjectCard = ({ project, onExplore }) => {
  const navigate = useNavigate();

  const handleExplore = () => {
    navigate('/projects');
  };

  return (
    <div
      onClick={handleExplore}
      className="group grid grid-cols-1 md:grid-cols-[1.1fr_1fr] bg-white border border-slate-200/90 rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-lg hover:border-slate-300 text-left cursor-pointer"
    >
      <div className="overflow-hidden min-h-[260px] bg-slate-100 relative">
        <img
          src={project.image || project.img || 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=600&auto=format&fit=crop'}
          alt={project.name || 'Project Image'}
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
        />
        <div className="absolute top-3 left-3">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-slate-900/80 text-white backdrop-blur-md border border-slate-700/50 shadow-xs">
            <Building2 size={12} className="text-sky-300" />
            New Development
          </span>
        </div>
      </div>

      <div className="p-6 md:p-8 flex flex-col justify-between">
        <div>
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
            {project.builder || 'Verified Builder'}
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-3 tracking-tight group-hover:text-blue-700 transition-colors">
            {project.name || 'Premium Project'}
          </h3>
          <ul className="space-y-2 mb-5 text-xs text-slate-600 font-medium">
            {(project.features || [project.bhk, project.location, project.priceRange || project.priceDisplay].filter(Boolean)).map((feat, idx) => (
              <li key={idx} className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
                  <Check size={11} strokeWidth={3} />
                </span>
                <span>{feat}</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <div className="text-xs text-slate-500 font-medium mb-4 pb-3 border-b border-slate-100">
            {project.meta || `${project.location || ''} • ${project.priceRange || project.priceDisplay || ''}`}
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleExplore();
            }}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl flex items-center gap-2"
          >
            <span>Explore Project</span>
            <ArrowRight size={14} />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ProjectCard;
