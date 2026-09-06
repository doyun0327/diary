/**
 * 배포 동안 유지보수 화면을 켠 뒤 빌드·배포하고, 끝나면 해제합니다.
 *
 * 1) MAINTENANCE=1 배포 (열린 앱이 폴링으로 로티 표시)
 * 2) 앱이 감지할 시간 확보 후 빌드
 * 3) MAINTENANCE=0 으로 새 빌드 배포
 */
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
/** 열린 앱이 /deploy-status.json 을 잡을 여유 (폴링 2.5초 기준) */
const HOLD_BEFORE_BUILD_MS = 8_000;

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

async function main() {
  const updatingReady = existsSync(path.join(root, 'dist', 'updating.html'));

  if (updatingReady) {
    console.log('→ 업데이트 화면 ON (기존 dist)');
    run('npx', ['wrangler', 'deploy', '--var', 'MAINTENANCE:1']);
    console.log(
      `→ 앱이 로티를 띄울 때까지 ${HOLD_BEFORE_BUILD_MS / 1000}초 대기… (앱을 켜 두면 보입니다)`,
    );
    await sleep(HOLD_BEFORE_BUILD_MS);
  } else {
    console.log(
      '→ 첫 배포: updating.html 이 아직 dist에 없어 안내 없이 빌드합니다.',
    );
  }

  console.log('→ 빌드');
  run('npm', ['run', 'build']);

  console.log('→ 새 버전 배포 + 업데이트 화면 OFF');
  run('npx', ['wrangler', 'deploy', '--var', 'MAINTENANCE:0']);

  console.log('\n완료! 앱은 곧 자동으로 새로고침됩니다.\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
