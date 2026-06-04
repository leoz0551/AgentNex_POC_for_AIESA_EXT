import { useState, useEffect, useRef } from 'react';
import { BookOpen, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { chatApi } from '../../api/chat';

interface CourseItem {
  id: string;
  title: string;
  description: string;
}

interface PromptsPanelProps {
  onPromptSelect: (prompt: string) => void;
  onOpenSettings?: () => void;
}

export function PromptsPanel({ onPromptSelect }: PromptsPanelProps) {
  const { t } = useTranslation();
  
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [isTwoColumns, setIsTwoColumns] = useState(false);

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        setIsLoading(true);
        const tasks = await chatApi.getCourses();
        const validCourses: CourseItem[] = [];
        
        for (const t of tasks) {
          if (t.status === 'completed' && t.result) {
            try {
              const resObj = typeof t.result === 'string' ? JSON.parse(t.result) : t.result;
              if (resObj.course_title) {
                validCourses.push({
                  id: t.id,
                  title: resObj.course_title,
                  description: Array.isArray(resObj.learning_objectives) 
                    ? resObj.learning_objectives.join('; ') 
                    : resObj.learning_objectives || ''
                });
              }
            } catch (e) {
              // ignore parse error
            }
          }
        }
        setCourses(validCourses);
      } catch (err) {
        console.error('Failed to fetch courses:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchCourses();
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        setIsTwoColumns(width >= 360);
      }
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  const handleCourseClick = (course: CourseItem) => {
    // We send a default prompt to start Role Play Simulation for this course
    onPromptSelect(`I want to start the role play simulation for the course: "${course.title}".\n\nObjective: ${course.description}`);
  };

  const filteredCourses = courses.filter(c => 
    c.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div ref={containerRef} className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <p className="text-xs text-muted-foreground">
          {t('prompts.description')}
        </p>
      </div>

      <div className="relative mb-4 flex-shrink-0">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-muted-foreground" />
        </div>
        <input
          type="text"
          placeholder="Search courses by name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-4 py-2 bg-background border border-border/60 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-all shadow-sm"
        />
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : filteredCourses.length > 0 ? (
          <div className={`grid gap-2.5 pr-1 transition-all duration-300 ${isTwoColumns ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {filteredCourses.map((course) => (
              <div
                key={course.id}
                className="group bg-card border border-border/40 rounded-lg p-3 cursor-pointer hover:border-violet-500/40 hover:shadow-sm transition-all duration-200 hover:bg-accent/30"
                onClick={() => handleCourseClick(course)}
              >
                <div className="flex items-start gap-2">
                  <div className="flex-shrink-0 mt-0.5">
                    <BookOpen className="h-4 w-4 text-violet-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {course.title}
                    </p>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5 leading-relaxed">
                      {course.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <BookOpen className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">No courses found.</p>
          </div>
        )}
      </div>
    </div>
  );
}
