'use client';

import { useEffect, useState } from 'react';
import { getIngredients } from '@/libs/Api';
import type { IngredientInfo } from '@/libs/Api';

// 모듈 레벨 캐시 — 호버마다 X, 앱에서 단 1회 fetch해 모든 팝오버가 공유.
let cache: Promise<IngredientInfo[]> | null = null;
function loadOnce(): Promise<IngredientInfo[]> {
  if (!cache) {
    // 동기적으로 같은 promise를 공유해야 하므로 체이닝 유지(await 불가).
    // oxlint-disable-next-line promise/prefer-await-to-then, promise/prefer-await-to-callbacks
    cache = getIngredients().catch((error) => {
      cache = null; // 실패 시 캐시 무효화 → 다음 시도 재요청
      throw error;
    });
  }
  return cache;
}

type State =
  | { status: 'loading' }
  | { status: 'ready'; byName: Map<string, IngredientInfo> }
  | { status: 'error' };

export function useIngredients(): State {
  const [state, setState] = useState<State>({ status: 'loading' });
  useEffect(() => {
    let active = true;
    const run = async () => {
      try {
        const list = await loadOnce();
        if (active) {
          setState({
            status: 'ready',
            byName: new Map(list.map((i) => [i.name, i])),
          });
        }
      } catch {
        if (active) {
          setState({ status: 'error' });
        }
      }
    };
    run();
    return () => {
      active = false;
    };
  }, []);
  return state;
}
