import { useTranslation } from 'react-i18next';

/**
 * 格式化相对时间
 * - 1分钟内: "刚刚"
 * - 1小时内: "X分钟前"
 * - 24小时内: "X小时前"
 * - 7天内: "X天前"
 * - 超过7天: 显示具体日期时间 "YYYY-MM-DD HH:mm:ss"
 */
export function formatRelativeTime(dateString: string, t: (key: string, options?: Record<string, unknown>) => string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  // 1分钟内
  if (diffSeconds < 60) {
    return t('time.justNow');
  }

  // 1小时内
  if (diffMinutes < 60) {
    return t('time.minutesAgo', { count: diffMinutes });
  }

  // 24小时内
  if (diffHours < 24) {
    return t('time.hoursAgo', { count: diffHours });
  }

  // 7天内
  if (diffDays < 7) {
    return t('time.daysAgo', { count: diffDays });
  }

  // 超过7天，显示具体日期时间
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * Hook for formatting relative time with i18n
 */
export function useRelativeTime() {
  const { t } = useTranslation();
  
  return (dateString: string) => formatRelativeTime(dateString, t);
}
