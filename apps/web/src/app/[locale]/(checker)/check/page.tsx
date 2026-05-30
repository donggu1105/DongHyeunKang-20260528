import { redirect } from 'next/navigation';

// 체커는 홈 `/`으로 통합됨. 구 경로는 홈으로 리다이렉트.
export default function CheckRedirect() {
  redirect('/');
}
