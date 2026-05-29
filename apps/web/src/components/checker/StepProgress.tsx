'use client';

const STEPS = ['상황', '제품', '나이', '결과'];

export function StepProgress({ current }: { current: number }) {
  return (
    <ol aria-label="진행 단계" className="mb-6 flex items-center gap-2">
      {STEPS.map((label, i) => {
        let state: 'done' | 'active' | 'todo';
        if (i < current) {
          state = 'done';
        } else if (i === current) {
          state = 'active';
        } else {
          state = 'todo';
        }
        return (
          <li className="flex flex-1 items-center gap-2" key={label}>
            <span
              aria-current={state === 'active' ? 'step' : undefined}
              className={`flex size-7 items-center justify-center rounded-full text-sm font-semibold ${
                state === 'todo' ? 'bg-gray-100 text-gray-400' : 'bg-blue-600 text-white'
              }`}
            >
              {i + 1}
            </span>
            <span
              className={`text-sm ${state === 'active' ? 'font-semibold text-gray-900' : 'text-gray-500'}`}
            >
              {label}
            </span>
            {i < STEPS.length - 1 && <span className="h-px flex-1 bg-gray-200" />}
          </li>
        );
      })}
    </ol>
  );
}
