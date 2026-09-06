/**
 * 배포 동안 유지보수 화면을 켠 뒤 빌드·배포하고, 끝나면 해제합니다.
 *
 * 1) (dist에 updating.html 있으면) MAINTENANCE=1 로 현재 빌드 재배포
 * 2) npm run build
 * 3) MAINTENANCE=0 으로 새 빌드 배포
 */
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function run(command, args) {
  console.log(`\n> ${command} ${args.join(' ')}\n`);
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: true,
    env: process.env,
  });
  if (result.status) {
    process.exit(result.status ?? 1);
  }
}

const updatingReady = existsSync(path.join(root, 'dist', 'updating.html'));

if (updatingReady) {
  console.log('→ 업데이트 화면 ON (기존 dist)');
  run('npx', ['wrangler', 'deploy', '--var', 'MAINTENANCE:1']);
} else {
  console.log('→ 첫 배포: updating.html 이 아직 dist에 없어 안내 화면 없이 빌드합니다.');
}

console.log('→ 빌드');
run('npm', ['run', 'build']);

console.log('→ 새 버전 배포 + 업데이트 화면 OFF');
run('npx', ['wrangler', 'deploy', '--var', 'MAINTENANCE:0']);

console.log('\n완료! 사용자가 보던 안내 화면은 곧 자동 새로고침됩니다.\n');
