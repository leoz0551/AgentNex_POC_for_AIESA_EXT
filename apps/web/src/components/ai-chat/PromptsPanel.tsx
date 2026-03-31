import { useState, useEffect, useRef } from 'react';
import { Sparkles, Settings, ChevronLeft, ChevronRight, Lightbulb, Newspaper, Layers, GitCompare } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface PromptItem {
  id: string;
  title: string;
  titleEn: string;
  prompt: string;
  promptEn: string;
}

interface PromptCategory {
  id: string;
  name: string;
  nameEn: string;
  prompts: PromptItem[];
  iconColor?: string;
}

interface BuiltInCategory {
  id: string;
  icon: LucideIcon;
  name: string;
  nameEn: string;
  prompts: PromptItem[];
}

interface PromptsPanelProps {
  onPromptSelect: (prompt: string) => void;
  onOpenSettings?: () => void;
}

const CUSTOM_PROMPTS_KEY = 'legendagent_custom_prompts_v2';

// 内置提示词分类 - SSG 相关
const builtInCategories: BuiltInCategory[] = [
  {
    id: 'ssg-news',
    icon: Newspaper,
    name: 'SSG 新闻动态',
    nameEn: 'SSG News',
    prompts: [
      { id: 'recent-initiatives', title: '近期SSG举措', titleEn: 'Recent SSG Initiatives', prompt: '请介绍近期SSG的重要举措和战略方向：', promptEn: 'Please introduce recent SSG important initiatives and strategic directions:' },
      { id: 'partnerships', title: 'SSG合作伙伴动态', titleEn: 'Updates on SSG Partnerships', prompt: '请提供SSG合作伙伴关系的最新动态和进展：', promptEn: 'Please provide the latest updates and progress on SSG partnerships:' },
      { id: 'service-innovations', title: '服务交付创新', titleEn: 'Innovations in Service Delivery', prompt: '请介绍SSG在服务交付方面的创新举措：', promptEn: 'Please introduce SSG innovations in service delivery:' },
      { id: 'industry-trends', title: '影响SSG的行业趋势', titleEn: 'Industry Trends Impacting SSG', prompt: '请分析当前影响SSG业务的主要行业趋势：', promptEn: 'Please analyze the main industry trends currently impacting SSG business:' },
      { id: 'customer-feedback', title: '客户反馈机制', titleEn: 'Feedback Mechanisms for Customers', prompt: '请介绍SSG的客户反馈机制和改进流程：', promptEn: 'Please introduce SSG customer feedback mechanisms and improvement processes:' },
      { id: 'customer-support', title: '客户支持增强', titleEn: 'Enhancements in Customer Support', prompt: '请介绍SSG在客户支持方面的最新增强措施：', promptEn: 'Please introduce the latest enhancements in SSG customer support:' },
      { id: 'product-launches', title: 'SSG产品发布', titleEn: 'SSG Product Launches', prompt: '请介绍SSG最新发布的产品和服务：', promptEn: 'Please introduce SSG newly launched products and services:' },
      { id: 'success-stories', title: '客户成功案例', titleEn: 'Customer Success Stories', prompt: '请分享SSG的客户成功案例：', promptEn: 'Please share SSG customer success stories:' },
      { id: 'upcoming-events', title: 'SSG即将举办的活动', titleEn: 'Upcoming Events Hosted by SSG', prompt: '请列出SSG即将举办的各类活动和会议：', promptEn: 'Please list upcoming events and conferences hosted by SSG:' },
      { id: 'training-opportunities', title: 'SSG培训机会', titleEn: 'Training Opportunities Offered by SSG', prompt: '请介绍SSG提供的培训机会和课程：', promptEn: 'Please introduce training opportunities and courses offered by SSG:' },
      { id: 'sustainability', title: 'SSG可持续发展', titleEn: 'Sustainability Efforts of SSG', prompt: '请介绍SSG在可持续发展方面的努力和成果：', promptEn: 'Please introduce SSG efforts and achievements in sustainability:' },
    ],
  },
  {
    id: 'concord-hbb',
    icon: Layers,
    name: 'Concord-HBB 框架',
    nameEn: 'Concord-HBB',
    prompts: [
      { id: 'concept-requirements', title: '概念需求模板', titleEn: 'Concept Requirements Template', prompt: '请提供Concord项目的概念需求模板：', promptEn: 'Please provide the concept requirements template for Concord project:' },
      { id: 'concord-framework', title: 'Concord框架概述', titleEn: 'Concord Framework', prompt: '请介绍Concord框架的核心内容和架构：', promptEn: 'Please introduce the core content and architecture of Concord framework:' },
      { id: 'templates', title: '模板资源', titleEn: 'Templates', prompt: '请提供Concord项目相关的模板资源：', promptEn: 'Please provide template resources related to Concord project:' },
      { id: 'faqs', title: '常见问题解答', titleEn: 'FAQs', prompt: '请回答关于Concord项目的常见问题：', promptEn: 'Please answer frequently asked questions about Concord project:' },
      { id: 'deliverables-customization', title: '交付物定制', titleEn: 'Customization of Deliverables', prompt: '请介绍如何定制Concord项目的交付物：', promptEn: 'Please introduce how to customize deliverables for Concord project:' },
      { id: 'success-factors', title: '关键成功因素', titleEn: 'Key Success Factors', prompt: '请分析Concord项目成功的关键因素：', promptEn: 'Please analyze key success factors for Concord project:' },
      { id: 'market-launch', title: '市场推广策略', titleEn: 'Market Launch Strategy', prompt: '请制定Concord产品的市场推广策略：', promptEn: 'Please develop a market launch strategy for Concord product:' },
      { id: 'customer-targeting', title: '客户定位', titleEn: 'Customer Targeting', prompt: '请分析Concord产品的目标客户群体：', promptEn: 'Please analyze the target customer segments for Concord product:' },
      { id: 'downstream-processes', title: '下游流程', titleEn: 'Downstream Processes', prompt: '请介绍Concord项目的下游业务流程：', promptEn: 'Please introduce downstream business processes for Concord project:' },
      { id: 'the-team', title: '团队介绍', titleEn: 'The Team', prompt: '请介绍Concord项目团队的组织架构和成员：', promptEn: 'Please introduce the organizational structure and members of Concord project team:' },
      { id: 'phases', title: 'Concord阶段规划', titleEn: 'Phases of Concord', prompt: '请介绍Concord项目的各个阶段和里程碑：', promptEn: 'Please introduce the phases and milestones of Concord project:' },
      { id: 'offering-description', title: '服务/能力描述', titleEn: 'Offering/Capability Description', prompt: '请详细描述Concord提供的服务和能力：', promptEn: 'Please describe in detail the services and capabilities offered by Concord:' },
    ],
  },
  {
    id: 'ocm',
    icon: GitCompare,
    name: '组织变革管理 (OCM)',
    nameEn: 'OCM',
    prompts: [
      { id: 'understanding-ocm', title: '理解 OCM', titleEn: 'Understanding OCM', prompt: '请介绍组织变革管理(OCM)的核心概念和重要性：', promptEn: 'Please introduce the core concepts and importance of Organizational Change Management (OCM):' },
      { id: 'ocm-phases', title: 'OCM 阶段', titleEn: 'Phases of OCM', prompt: '请详细说明组织变革管理的各个阶段和关键里程碑：', promptEn: 'Please explain in detail the phases and key milestones of Organizational Change Management:' },
      { id: 'change-agents-role', title: '变革推动者的角色', titleEn: 'Role of Change Agents', prompt: '请说明变革推动者在组织变革中的角色和职责：', promptEn: 'Please explain the role and responsibilities of change agents in organizational change:' },
      { id: 'communication-strategies', title: '变革期间的沟通策略', titleEn: 'Communication Strategies During Changes', prompt: '请提供变革期间有效的沟通策略和最佳实践：', promptEn: 'Please provide effective communication strategies and best practices during organizational change:' },
      { id: 'stakeholder-engagement', title: '利益相关者参与最佳实践', titleEn: 'Best Practices for Stakeholder Engagement', prompt: '请介绍利益相关者参与的最佳实践和方法：', promptEn: 'Please introduce best practices and methods for stakeholder engagement:' },
      { id: 'addressing-resistance', title: '应对变革阻力', titleEn: 'Addressing Resistance to Change', prompt: '请提供应对和克服变革阻力的策略和方法：', promptEn: 'Please provide strategies and methods to address and overcome resistance to change:' },
      { id: 'ocm-tools', title: '有效 OCM 工具', titleEn: 'Tools for Effective OCM', prompt: '请介绍有效的组织变革管理工具和框架：', promptEn: 'Please introduce effective tools and frameworks for Organizational Change Management:' },
      { id: 'learning-sessions', title: 'OCM 学习课程', titleEn: 'Learning Sessions on OCM', prompt: '请推荐组织变革管理的学习课程和培训资源：', promptEn: 'Please recommend learning sessions and training resources for Organizational Change Management:' },
      { id: 'training-managers', title: '变革管理师培训', titleEn: 'Training for Change Managers', prompt: '请介绍变革管理师需要的关键技能和培训内容：', promptEn: 'Please introduce key skills and training content for change managers:' },
      { id: 'internal-case-studies', title: 'OCM 内部案例研究', titleEn: 'Internal Case Studies on OCM', prompt: '请分享组织变革管理的内部案例研究和经验教训：', promptEn: 'Please share internal case studies and lessons learned in Organizational Change Management:' },
      { id: 'measuring-success', title: 'OCM 成功衡量', titleEn: 'Measuring Success in OCM', prompt: '请介绍如何衡量组织变革管理的成功与效果：', promptEn: 'Please introduce how to measure success and effectiveness in Organizational Change Management:' },
      { id: 'continuous-improvement', title: '变革后持续改进', titleEn: 'Continuous Improvement Post-Change', prompt: '请说明变革实施后如何进行持续改进和优化：', promptEn: 'Please explain how to implement continuous improvement and optimization after change implementation:' },
    ],
  },
];

export function PromptsPanel({ onPromptSelect, onOpenSettings }: PromptsPanelProps) {
  const { t, i18n } = useTranslation();
  const isEnglish = i18n.language === 'en-US';
  
  const [selectedCategory, setSelectedCategory] = useState<string>(builtInCategories[0].id);
  const [customCategories, setCustomCategories] = useState<PromptCategory[]>([]);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);
  const tabsRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // 根据面板宽度自动切换单列/双列
  const [isTwoColumns, setIsTwoColumns] = useState(false);

  // 加载自定义提示词分类
  useEffect(() => {
    const loadCustomPrompts = () => {
      try {
        const saved = localStorage.getItem(CUSTOM_PROMPTS_KEY);
        if (saved) {
          setCustomCategories(JSON.parse(saved));
        }
      } catch {
        // ignore
      }
    };
    
    loadCustomPrompts();
    
    // 监听 storage 变化
    window.addEventListener('storage', loadCustomPrompts);
    return () => window.removeEventListener('storage', loadCustomPrompts);
  }, []);

  // 监听面板宽度变化，自动切换单列/双列
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        // 宽度大于 360px 时切换为双列
        setIsTwoColumns(width >= 360);
      }
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  // 检查滚动箭头显示状态
  const checkScrollArrows = () => {
    if (tabsRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = tabsRef.current;
      setShowLeftArrow(scrollLeft > 0);
      setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 1);
    }
  };

  useEffect(() => {
    checkScrollArrows();
    window.addEventListener('resize', checkScrollArrows);
    return () => window.removeEventListener('resize', checkScrollArrows);
  }, [customCategories]);

  const scrollTabs = (direction: 'left' | 'right') => {
    if (tabsRef.current) {
      const scrollAmount = 150;
      tabsRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
      setTimeout(checkScrollArrows, 300);
    }
  };

  const handlePromptClick = (promptItem: PromptItem) => {
    const promptText = isEnglish ? promptItem.promptEn : promptItem.prompt;
    onPromptSelect(promptText);
  };

  // 合并内置分类和自定义分类
  const allCategories = [
    ...builtInCategories.map(cat => ({
      id: cat.id,
      icon: cat.icon,
      name: cat.name,
      nameEn: cat.nameEn,
      prompts: cat.prompts,
      isCustom: false,
    })),
    ...customCategories.map(cat => ({
      id: cat.id,
      icon: Sparkles as LucideIcon,
      name: cat.name,
      nameEn: cat.nameEn,
      prompts: cat.prompts,
      isCustom: true,
    })),
  ];

  // 获取当前选中分类
  const currentCategory = allCategories.find(cat => cat.id === selectedCategory);
  const currentPrompts = currentCategory?.prompts || [];

  return (
    <div ref={containerRef} className="flex flex-col h-full">
      {/* 顶部区域：描述和设置按钮 */}
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <p className="text-xs text-muted-foreground">
          {t('prompts.description')}
        </p>
        {onOpenSettings && (
          <button
            onClick={onOpenSettings}
            className="p-1.5 rounded-lg hover:bg-accent/50 transition-colors"
            title={t('styleConfig.title')}
          >
            <Settings className="h-4 w-4 text-muted-foreground hover:text-foreground" />
          </button>
        )}
      </div>

      {/* 横向分类标签栏 */}
      <div className="relative mb-3 flex-shrink-0">
        {/* 左侧滚动箭头 */}
        {showLeftArrow && (
          <button
            onClick={() => scrollTabs('left')}
            className="absolute left-0 top-0 bottom-0 z-10 w-6 bg-gradient-to-r from-background to-transparent flex items-center justify-start"
          >
            <ChevronLeft className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
        
        {/* 标签容器 */}
        <div
          ref={tabsRef}
          onScroll={checkScrollArrows}
          className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {allCategories.map((category) => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-200 ${
                selectedCategory === category.id
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <category.icon className={`h-3.5 w-3.5 ${selectedCategory === category.id ? '' : category.isCustom ? 'text-orange-500' : 'text-violet-500'}`} />
              {isEnglish ? category.nameEn : category.name}
            </button>
          ))}
        </div>

        {/* 右侧滚动箭头 */}
        {showRightArrow && (
          <button
            onClick={() => scrollTabs('right')}
            className="absolute right-0 top-0 bottom-0 z-10 w-6 bg-gradient-to-l from-background to-transparent flex items-center justify-end"
          >
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* 提示词网格 */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {currentPrompts.length > 0 ? (
          <div className={`grid gap-2.5 pr-1 transition-all duration-300 ${isTwoColumns ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {currentPrompts.map((promptItem) => (
              <div
                key={promptItem.id}
                className="group bg-card border border-border/40 rounded-lg p-3 cursor-pointer hover:border-primary/30 hover:shadow-sm transition-all duration-200 hover:bg-accent/30"
                onClick={() => handlePromptClick(promptItem)}
              >
                <div className="flex items-start gap-2">
                  <div className="flex-shrink-0 mt-0.5">
                    <Lightbulb className="h-4 w-4 text-amber-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {isEnglish ? promptItem.titleEn : promptItem.title}
                    </p>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5 leading-relaxed">
                      {isEnglish ? promptItem.promptEn : promptItem.prompt}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Lightbulb className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">{t('prompts.noPrompts')}</p>
            {onOpenSettings && (
              <button
                onClick={onOpenSettings}
                className="mt-2 text-xs text-violet-500 hover:text-violet-600 transition-colors"
              >
                {t('styleConfig.title')} → {t('styleConfig.tabs.prompts')}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
