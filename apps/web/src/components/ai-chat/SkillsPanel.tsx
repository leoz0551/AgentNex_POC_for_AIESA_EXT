import { useState, useEffect, useCallback } from 'react';
import { 
  Pin,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ALL_SKILLS } from '../../constants/skills';

const allSkills = ALL_SKILLS;

const PINNED_SKILLS_KEY = 'legendagent_pinned_skills';

// 自定义事件，用于同步 pin 状态
const dispatchPinnedChange = () => {
  window.dispatchEvent(new CustomEvent('pinned-skills-change'));
};

interface SkillsPanelProps {
  onSkillSelect: (skillId: string, prompt: string) => void;
}

export function SkillsPanel({ onSkillSelect }: SkillsPanelProps) {
  const { t } = useTranslation();
  const [pinnedSkills, setPinnedSkills] = useState<string[]>([]);

  // 从 localStorage 加载 pinned skills
  useEffect(() => {
    try {
      const saved = localStorage.getItem(PINNED_SKILLS_KEY);
      if (saved) {
        setPinnedSkills(JSON.parse(saved));
      }
    } catch {
      // ignore
    }
  }, []);

  // 保存 pinned skills 到 localStorage
  const savePinnedSkills = useCallback((skills: string[]) => {
    setPinnedSkills(skills);
    try {
      localStorage.setItem(PINNED_SKILLS_KEY, JSON.stringify(skills));
      dispatchPinnedChange();
    } catch {
      // ignore
    }
  }, []);

  // 切换 pin 状态
  const togglePin = useCallback((skillId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newPinned = pinnedSkills.includes(skillId)
      ? pinnedSkills.filter(id => id !== skillId)
      : [...pinnedSkills, skillId];
    savePinnedSkills(newPinned);
  }, [pinnedSkills, savePinnedSkills]);

  // 排序：pinned 在前
  const sortedSkills = [...allSkills].sort((a, b) => {
    const aPinned = pinnedSkills.includes(a.id);
    const bPinned = pinnedSkills.includes(b.id);
    if (aPinned && !bPinned) return -1;
    if (!aPinned && bPinned) return 1;
    return 0;
  });

  const getSkillPrompt = (skillId: string): string => {
    const prompts: Record<string, string> = {
      'deepThinking': t('skills.prompts.deepThinking'),
      'deepResearch': t('skills.prompts.deepResearch'),
      'readDoc': t('skills.prompts.readDoc'),
      'meetingMinutes': t('skills.prompts.meetingMinutes'),
      'webSearch': t('skills.prompts.webSearch'),
      'docSearch': t('skills.prompts.docSearch'),
      'pptGenerate': t('skills.prompts.pptGenerate'),
    };
    return prompts[skillId] || '';
  };

  return (
    <div className="space-y-4">
      {/* Description */}
      <p className="text-sm text-muted-foreground">{t('skills.description')}</p>

      {/* Skills Grid */}
      <div className="grid gap-2.5 grid-cols-1">
        {sortedSkills.map((skill, index) => {
          const Icon = skill.icon;
          const isPinned = pinnedSkills.includes(skill.id);
          return (
            <div
              key={skill.id}
              onClick={() => onSkillSelect(skill.id, getSkillPrompt(skill.id))}
              className={`group relative rounded-xl border transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] p-3.5 text-left cursor-pointer ${
                isPinned
                  ? 'border-violet-500/40 bg-violet-500/5 hover:bg-violet-500/10'
                  : 'border-border/40 bg-background/50 hover:bg-accent/50 hover:border-violet-500/30'
              }`}
              style={{
                animation: `fadeInUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards`,
                animationDelay: `${index * 0.05}s`,
                opacity: 0,
              }}
            >
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded-lg ${skill.bgColor} transition-transform duration-200 group-hover:scale-110 flex-shrink-0`}>
                  <Icon className={`h-4 w-4 ${skill.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="font-medium text-sm">
                      {t(`skills.items.${skill.id}.name`)}
                    </p>
                    {isPinned && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-500/20 text-violet-600 dark:text-violet-400 font-medium">
                        {t('skills.pinned')}
                      </span>
                    )}
                  </div>
                  <p className="text-muted-foreground text-xs mt-0.5">
                    {t(`skills.items.${skill.id}.desc`)}
                  </p>
                </div>
                {/* Pin Button */}
                <button
                  onClick={(e) => togglePin(skill.id, e)}
                  className={`p-2 rounded-lg transition-all duration-200 ${
                    isPinned
                      ? 'bg-violet-500/20 text-violet-500'
                      : 'opacity-0 group-hover:opacity-100 hover:bg-accent text-muted-foreground hover:text-foreground'
                  }`}
                  title={isPinned ? t('skills.unpin') : t('skills.pin')}
                >
                  <Pin className={`h-4 w-4 ${isPinned ? 'fill-current' : ''}`} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes fadeInUp {
          from { 
            opacity: 0; 
            transform: translateY(8px); 
          }
          to { 
            opacity: 1; 
            transform: translateY(0); 
          }
        }
      `}</style>
    </div>
  );
}
