// 데모 전용: vitaminshop 상품 이미지/가격을 우리 상품에 결정적 랜덤 매핑.
// 타사 이미지/가격은 POC 데모용 더미이며 안전 판정과 무관(표시 전용).
// 재실행 시 동일 결과(제품 id 기반 의사난수).
import { PrismaClient } from '@prisma/client';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const PUBLIC_DIR = join(__dirname, '../../web/public/products');
const SOURCE = 'https://vitaminshop.co.kr/';

function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 0xffffffff);
}

async function collectImageUrls(): Promise<string[]> {
  const html = await fetch(SOURCE).then((r) => r.text());
  // 보호상대(//) 또는 https:// 모두 매칭 후 https로 정규화
  const matches = html.match(
    /(?:https:)?\/\/[a-z0-9.]+\/web\/product\/[a-z]+\/[^"'\s)]+\.(?:jpg|jpeg|png)/gi,
  ) ?? [];
  const normalized = matches.map((u) => (u.startsWith('http') ? u : `https:${u}`));
  return Array.from(new Set(normalized)).slice(0, 30);
}

async function download(urls: string[]): Promise<string[]> {
  await mkdir(PUBLIC_DIR, { recursive: true });
  const local: string[] = [];
  for (let i = 0; i < urls.length; i++) {
    const name = `p${String(i + 1).padStart(2, '0')}.jpg`;
    try {
      const res = await fetch(urls[i]);
      const buf = Buffer.from(new Uint8Array(await res.arrayBuffer()));
      await writeFile(join(PUBLIC_DIR, name), buf);
      local.push(`/products/${name}`);
    } catch (e) {
      console.warn(`[backfill] 이미지 다운로드 실패: ${urls[i]}`, e);
    }
  }
  return local;
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const urls = await collectImageUrls();
    console.log(`[backfill] 수집한 이미지 URL: ${urls.length}개`);
    const images = await download(urls);
    if (images.length === 0) throw new Error('다운로드된 이미지가 없습니다.');
    const products = await prisma.product.findMany({ orderBy: { id: 'asc' } });
    for (const p of products) {
      const rand = rng(p.id);
      const img = images[Math.floor(rand() * images.length)];
      const listPrice = (9 + Math.floor(rand() * 52)) * 1000; // 9,000~60,000
      const discount = 0.2 + rand() * 0.3;                    // 20~50%
      const price = Math.round((listPrice * (1 - discount)) / 100) * 100;
      await prisma.product.update({ where: { id: p.id }, data: { imageUrl: img, listPrice, price } });
    }
    console.log(`[backfill] ${products.length}개 제품 매핑 완료 (이미지 ${images.length}장).`);
  } finally {
    await prisma.$disconnect();
  }
}
main();
