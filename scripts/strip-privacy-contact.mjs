const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, 'src/i18n/locales');

const endings = [
  ' 문의는 앱 내 안내 채널을 이용해 주세요.',
  ' Contact us through in-app channels for privacy requests.',
  " Contactez-nous via les canaux de l'app pour toute demande relative à la confidentialité.",
  ' Datenschutzanfragen kannst du über die In-App-Kanäle stellen.',
  ' Contáctanos por los canales de la app para solicitudes de privacidad.',
  ' Entre em contato pelos canais do app para solicitações de privacidade.',
  ' Hubungi kami lewat saluran di aplikasi untuk permintaan privasi.',
  ' Liên hệ qua kênh trong app cho các yêu cầu về riêng tư.',
  ' プライバシーに関するお問い合わせはアプリ内の窓口をご利用ください。',
  ' 隐私相关请求请通过应用内渠道联系我们。',
  ' 隱私相關請求請通過應用內渠道聯繫我們。',
  ' ติดต่อเราผ่านช่องทางในแอปสำหรับคำขอเกี่ยวกับความเป็นส่วนตัว',
];

for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.json'))) {
  const p = path.join(dir, file);
  const data = JSON.parse(fs.readFileSync(p, 'utf8'));
  const body = data?.appInfo?.legal?.privacyBody;
  if (typeof body !== 'string') {
    console.log(file, 'no privacyBody');
    continue;
  }
  let next = body;
  for (const e of endings) {
    if (next.includes(e)) next = next.replace(e, '');
  }
  next = next.trimEnd();
  if (next === body) {
    console.log(file, 'UNCHANGED:', JSON.stringify(body.slice(-90)));
    continue;
  }
  data.appInfo.legal.privacyBody = next;
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n');
  console.log(file, 'ok');
}
