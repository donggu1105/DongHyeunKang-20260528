// `/check`는 이제 메인(`/`)의 alias다. 본문은 `(checker)/page.tsx`에 있고,
// 기존 문서·페르소나 링크가 깨지지 않도록 default export만 재노출한다.
export { default } from '../page';
