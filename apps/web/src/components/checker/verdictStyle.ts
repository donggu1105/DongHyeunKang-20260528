import type { Verdict } from '@/libs/Api';

// 색상은 단독 신호가 아니다 — 라벨 + 이모지 + 텍스트를 함께 제공해 접근성을 확보한다.
export const VERDICT_STYLE: Record<
  Verdict,
  { label: string; icon: string; card: string; badge: string }
> = {
  SAFE: {
    label: '안전',
    icon: '🟢',
    card: 'border-green-300 bg-green-50',
    badge: 'bg-green-600 text-white',
  },
  DUPLICATE: {
    label: '중복 · 범위내',
    icon: '🟡',
    card: 'border-amber-300 bg-amber-50',
    badge: 'bg-amber-500 text-white',
  },
  OVER: {
    label: '과다',
    icon: '🔴',
    card: 'border-red-300 bg-red-50',
    badge: 'bg-red-600 text-white',
  },
  UNKNOWN: {
    label: '확인불가',
    icon: '⚪',
    card: 'border-gray-300 bg-gray-50',
    badge: 'bg-gray-500 text-white',
  },
};
