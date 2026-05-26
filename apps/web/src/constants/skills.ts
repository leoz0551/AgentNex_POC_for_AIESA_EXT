import { 
  Brain, 
  Search, 
  FileText, 
  Presentation, 
  Globe, 
  FileSearch, 
  Mic,
} from 'lucide-react';

export interface Skill {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
}

export const ALL_SKILLS: Skill[] = [
  { id: 'deepThinking', icon: Brain, color: 'text-violet-500', bgColor: 'bg-violet-500/10' },
  { id: 'deepResearch', icon: Search, color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
  { id: 'readDoc', icon: FileText, color: 'text-emerald-500', bgColor: 'bg-emerald-500/10' },
  { id: 'meetingMinutes', icon: Mic, color: 'text-orange-500', bgColor: 'bg-orange-500/10' },
  { id: 'webSearch', icon: Globe, color: 'text-cyan-500', bgColor: 'bg-cyan-500/10' },
  { id: 'docSearch', icon: FileSearch, color: 'text-amber-500', bgColor: 'bg-amber-500/10' },
  { id: 'pptGenerate', icon: Presentation, color: 'text-pink-500', bgColor: 'bg-pink-500/10' },
];
