import type { Metadata } from 'next';

// 체커 그룹(`/`, `/check`) 공통 메타데이터. ixartz BaseTemplate 네비/배너는 붙이지 않는다
// (PUBLIC 진입점 — ClerkProvider 없음). 탭 제목만 의미 있게 지정한다.
export const metadata: Metadata = {
  title: '우리 아이 영양제 안전 체크',
  description:
    '먹이는 영양제를 담고 아이 나이만 입력하면, 중복·과다 섭취 위험을 근거와 함께 확인해 드려요.',
};

export default function CheckerLayout(props: { children: React.ReactNode }) {
  return props.children;
}
