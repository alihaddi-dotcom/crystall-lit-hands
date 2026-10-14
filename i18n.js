// Tiny i18n: [data-i18n] → textContent, [data-i18n-html] → innerHTML (static,
// trusted strings only), [data-i18n-content] → content attribute.
const STRINGS = {
  en: {
    "lang.switch": "日本語",

    "dark.title": "CRYSTALL — Hold the light",
    "dark.desc": "CRYSTALL — a quieter corner of the universe. Breathe, write, and find your stillness.",
    "dark.nav.practice": "Practice",
    "dark.nav.journal": "Journal",
    "dark.nav.crystals": "Crystals",
    "nav.signin": "Sign in",
    "dark.eyebrow": "A quieter corner of the universe",
    "dark.h1": "Hold the light.<br /><em>Find your stillness.</em>",
    "dark.lede": "Five quiet minutes a day. Breathe, write a little, and let the noise settle — at your own pace.",
    "dark.cta": "Begin a session",
    "dark.how": "How it works",
    "dark.scroll": "Scroll",
    "dark.practice.eyebrow": "The practice",
    "dark.practice.h2": "Three small rituals.<br /><em>One calmer mind.</em>",
    "dark.focus.h": "Focus",
    "dark.focus.p": "A guided breath that follows the light. Return to one thing, for five minutes.",
    "dark.journal.h": "Journal",
    "dark.journal.p": "No perfect words needed. Let a thought find its place, then let it go.",
    "dark.explore.h": "Explore",
    "dark.explore.p": "Amethyst, rose quartz, aquamarine — each brings its own colour and quiet character.",
    "dark.quote": "“Light moves at its own pace.<br />So can you.”",
    "dark.start": "Start free",
    "dark.footer": "© CRYSTALL · a prototype · <a href=\"./light.html\">light version</a>",

    "light.title": "LUMEN — Meditation in light",
    "light.desc": "LUMEN — short guided meditations. Breathe in, let the light settle.",
    "light.nav.sessions": "Sessions",
    "light.nav.about": "About",
    "light.eyebrow": "Meditation, made of light",
    "light.h1": "Breathe in.<br /><em>Let the light settle.</em>",
    "light.lede": "A few quiet minutes, guided by a single point of light. Nothing to fix — just follow it in, and let it go.",
    "light.cta": "Start breathing",
    "light.sessions": "Sessions",
    "light.sessions.h2": "Three moments<br /><em>in your day.</em>",
    "light.morning.t": "5 min",
    "light.morning.h": "Morning light",
    "light.morning.p": "Wake gently. Count ten slow breaths before the day begins.",
    "light.midday.t": "3 min",
    "light.midday.h": "Midday pause",
    "light.midday.p": "Step out of the noise. One breath in, one breath out, then back.",
    "light.evening.t": "10 min",
    "light.evening.h": "Evening release",
    "light.evening.p": "Let the day loosen its hold. Follow the light down into rest.",
    "light.quote": "“Nothing to fix.<br />Just this breath.”",
    "light.begin": "Begin",
    "light.footer": "LUMEN · a prototype · <a href=\"./crystall.html\">dark version</a>",

    "breath.in": "Breathe in",
    "breath.out": "Breathe out",
    "breath.slow": "Breathe slowly",

    "s.title": "HAKU — Energy healing salon in Kamakura",
    "s.desc": "HAKU — a private energy healing salon in Kamakura. Reiki, crystal light and sound sessions.",
    "s.nav.about": "About",
    "s.nav.menu": "Menu",
    "s.nav.visit": "First visit",
    "s.nav.access": "Access",
    "s.nav.book": "Book",
    "s.eyebrow": "Energy healing salon · Kamakura",
    "s.h1": "Come back<br /><em>to your own light.</em>",
    "s.lede": "A quiet, private room a few minutes from the sea. Reiki, crystal light and sound sessions to help you rest deeply and feel like yourself again.",
    "s.cta": "Book a session",
    "s.viewMenu": "View menu",
    "s.about.eyebrow": "About HAKU",
    "s.about.h2": "One room.<br /><em>One guest at a time.</em>",
    "s.about.p": "HAKU means “white” — the colour of light before it splits into all the others. Sessions are fully private and unhurried: we begin with tea and a conversation, then you simply lie down and rest.",
    "s.menu.eyebrow": "Menu",
    "s.menu.h2": "Choose<br /><em>your session.</em>",
    "s.m1.h": "Reiki healing",
    "s.m1.meta": "60 min · ¥9,800",
    "s.m1.p": "Gentle hands-on energy work to release tension and help you feel calm.",
    "s.m2.h": "Crystal light session",
    "s.m2.meta": "90 min · ¥14,000",
    "s.m2.p": "Crystals placed around the body, combined with Reiki and guided breathing.",
    "s.m3.h": "Sound & breath",
    "s.m3.meta": "45 min · ¥7,500",
    "s.m3.p": "Singing bowls and slow breathing. A good first step if you are new to healing.",
    "s.menu.note": "First visit: ¥2,000 off any session. All prices include tax.",
    "s.visit.eyebrow": "Your first visit",
    "s.visit.h2": "What to<br /><em>expect.</em>",
    "s.v1.h": "Tea & conversation",
    "s.v1.p": "We talk about how you feel today and what you would like from the session.",
    "s.v2.h": "Rest & receive",
    "s.v2.p": "You lie down fully clothed. There is nothing you need to do.",
    "s.v3.h": "Gentle return",
    "s.v3.p": "Time to sit, drink some water and share anything you noticed.",
    "s.faq.eyebrow": "Questions",
    "s.q1": "Do I need any experience?",
    "s.a1": "None at all. Most guests come for the first time without knowing what to expect.",
    "s.q2": "What should I wear?",
    "s.a2": "Comfortable clothes. You stay dressed for every session.",
    "s.q3": "Is this a medical treatment?",
    "s.a3": "No. Energy healing is a relaxation practice and does not diagnose or treat any condition. Please keep seeing your doctor for any health concerns.",
    "s.access.eyebrow": "Access",
    "s.access.h2": "Visit<br /><em>HAKU.</em>",
    "s.i.addr": "Address",
    "s.i.addr.v": "Kamakura, Kanagawa (sample address)",
    "s.i.station": "Station",
    "s.i.station.v": "8 min walk from Kamakura Station",
    "s.i.hours": "Hours",
    "s.i.hours.v": "10:00–18:00 · Closed Tuesdays",
    "s.i.booking": "Booking",
    "s.i.booking.v": "Reservation only",
    "s.quote": "“Rest is not a reward.<br />It is where you begin.”",
    "s.book.note": "Prototype — booking is not connected.",
    "s.footer": "HAKU is a fictional salon for a design prototype · <a href=\"./light.html\">LUMEN</a> · <a href=\"./crystall.html\">CRYSTALL</a>",
  },
  ja: {
    "lang.switch": "English",

    "dark.title": "CRYSTALL — 光を、そっと手に",
    "dark.desc": "CRYSTALL — 宇宙の静かな片隅で。呼吸して、書いて、静けさを見つける。",
    "dark.nav.practice": "プラクティス",
    "dark.nav.journal": "ジャーナル",
    "dark.nav.crystals": "クリスタル",
    "nav.signin": "ログイン",
    "dark.eyebrow": "宇宙の、静かな片隅で",
    "dark.h1": "光を、そっと手に。<br /><em>静けさを見つける。</em>",
    "dark.lede": "一日五分の静かな時間。呼吸をして、少しだけ書いて、ざわめきが落ち着くのを待つ。自分のペースで。",
    "dark.cta": "セッションを始める",
    "dark.how": "使い方",
    "dark.scroll": "スクロール",
    "dark.practice.eyebrow": "プラクティス",
    "dark.practice.h2": "三つの小さな習慣。<br /><em>穏やかな心へ。</em>",
    "dark.focus.h": "集中",
    "dark.focus.p": "光に合わせて呼吸する、五分間のガイド。ひとつのことに立ち返る。",
    "dark.journal.h": "ジャーナル",
    "dark.journal.p": "完璧な言葉はいらない。思いに居場所を与えて、そっと手放す。",
    "dark.explore.h": "探索",
    "dark.explore.p": "アメジスト、ローズクォーツ、アクアマリン。それぞれの色と、静かな個性。",
    "dark.quote": "「光は、自分のペースで進む。<br />あなたも、それでいい。」",
    "dark.start": "無料で始める",
    "dark.footer": "© CRYSTALL · プロトタイプ · <a href=\"./light.html\">ライト版</a>",

    "light.title": "LUMEN — 光の瞑想",
    "light.desc": "LUMEN — 短いガイド付き瞑想。息を吸って、光が静まるのを待つ。",
    "light.nav.sessions": "セッション",
    "light.nav.about": "概要",
    "light.eyebrow": "光でできた、瞑想",
    "light.h1": "息を吸って。<br /><em>光が静まるのを待つ。</em>",
    "light.lede": "ひとつの光に導かれる、数分間の静かな時間。直すことは何もない。光を追って吸い込み、そして手放すだけ。",
    "light.cta": "呼吸を始める",
    "light.sessions": "セッション",
    "light.sessions.h2": "一日の中の、<br /><em>三つの時間。</em>",
    "light.morning.t": "5分",
    "light.morning.h": "朝の光",
    "light.morning.p": "やさしく目覚める。一日が始まる前に、ゆっくり十回の呼吸を。",
    "light.midday.t": "3分",
    "light.midday.h": "昼のひと休み",
    "light.midday.p": "喧騒から一歩離れて。吸って、吐いて、また戻る。",
    "light.evening.t": "10分",
    "light.evening.h": "夜、手放す",
    "light.evening.p": "一日の緊張をゆるめて。光を追って、静かな眠りへ。",
    "light.quote": "「直すことは、何もない。<br />ただ、この呼吸だけ。」",
    "light.begin": "始める",
    "light.footer": "LUMEN · プロトタイプ · <a href=\"./crystall.html\">ダーク版</a>",

    "breath.in": "吸って",
    "breath.out": "吐いて",
    "breath.slow": "ゆっくり呼吸を",

    "s.title": "HAKU — 鎌倉のエネルギーヒーリングサロン",
    "s.desc": "HAKU — 鎌倉の完全予約制エネルギーヒーリングサロン。レイキ、クリスタル、サウンドのセッション。",
    "s.nav.about": "サロンについて",
    "s.nav.menu": "メニュー",
    "s.nav.visit": "はじめての方へ",
    "s.nav.access": "アクセス",
    "s.nav.book": "予約する",
    "s.eyebrow": "エネルギーヒーリングサロン・鎌倉",
    "s.h1": "あなた本来の<br /><em>光へ、還る。</em>",
    "s.lede": "海から歩いて数分の、静かな個室サロン。レイキ、クリスタル、サウンドのセッションで、深く休み、自分らしさを取り戻す時間を。",
    "s.cta": "セッションを予約",
    "s.viewMenu": "メニューを見る",
    "s.about.eyebrow": "HAKUについて",
    "s.about.h2": "ひとつの部屋に、<br /><em>おひとりずつ。</em>",
    "s.about.p": "HAKUは「白」。すべての色に分かれる前の、光の色です。セッションは完全予約制のプライベート空間で、時間を気にせずゆっくりと。お茶とカウンセリングから始まり、あとは横になって、ただ休むだけ。",
    "s.menu.eyebrow": "メニュー",
    "s.menu.h2": "セッションを<br /><em>選ぶ。</em>",
    "s.m1.h": "レイキヒーリング",
    "s.m1.meta": "60分 · 9,800円",
    "s.m1.p": "やさしく手を当てるエネルギーワーク。緊張をほどき、穏やかな状態へ。",
    "s.m2.h": "クリスタルライトセッション",
    "s.m2.meta": "90分 · 14,000円",
    "s.m2.p": "身体のまわりにクリスタルを配置し、レイキと呼吸ガイドを組み合わせて。",
    "s.m3.h": "サウンド＆ブレス",
    "s.m3.meta": "45分 · 7,500円",
    "s.m3.p": "シンギングボウルとゆっくりした呼吸。ヒーリングがはじめての方にもおすすめです。",
    "s.menu.note": "初回限定：全セッション2,000円引き。価格はすべて税込です。",
    "s.visit.eyebrow": "はじめての方へ",
    "s.visit.h2": "当日の<br /><em>流れ。</em>",
    "s.v1.h": "お茶とカウンセリング",
    "s.v1.p": "今日の体調や気持ち、セッションで望むことをお聞かせください。",
    "s.v2.h": "横になって受け取る",
    "s.v2.p": "着衣のまま横になります。何もしなくて大丈夫です。",
    "s.v3.h": "ゆっくりと戻る",
    "s.v3.p": "座ってお水を飲みながら、感じたことを自由にお話しください。",
    "s.faq.eyebrow": "よくある質問",
    "s.q1": "経験がなくても大丈夫ですか？",
    "s.a1": "まったく問題ありません。多くの方がはじめてのご来店です。",
    "s.q2": "服装は？",
    "s.a2": "楽な服装でお越しください。セッション中も着衣のままです。",
    "s.q3": "医療行為ですか？",
    "s.a3": "いいえ。エネルギーヒーリングはリラクゼーションを目的としたもので、診断や治療を行うものではありません。体調に関するご相談は医療機関へお願いいたします。",
    "s.access.eyebrow": "アクセス",
    "s.access.h2": "サロン<br /><em>情報。</em>",
    "s.i.addr": "住所",
    "s.i.addr.v": "神奈川県鎌倉市（サンプル住所）",
    "s.i.station": "最寄り駅",
    "s.i.station.v": "鎌倉駅より徒歩8分",
    "s.i.hours": "営業時間",
    "s.i.hours.v": "10:00〜18:00・火曜定休",
    "s.i.booking": "ご予約",
    "s.i.booking.v": "完全予約制",
    "s.quote": "「休むことは、ご褒美ではなく、<br />はじまりです。」",
    "s.book.note": "プロトタイプのため、予約機能は未接続です。",
    "s.footer": "HAKUはデザインプロトタイプ用の架空のサロンです · <a href=\"./light.html\">LUMEN</a> · <a href=\"./crystall.html\">CRYSTALL</a>",
  },
};

const LANGS = Object.keys(STRINGS);
const KEY = "lang";

function initialLang() {
  const param = new URLSearchParams(location.search).get(KEY);
  if (LANGS.includes(param)) return param;
  try {
    const saved = localStorage.getItem(KEY);
    if (LANGS.includes(saved)) return saved;
  } catch {}
  return navigator.language?.toLowerCase().startsWith("ja") ? "ja" : "en";
}

export let lang = initialLang();
export const t = (key) => STRINGS[lang][key] ?? STRINGS.en[key] ?? key;

function apply() {
  document.documentElement.lang = lang;
  for (const el of document.querySelectorAll("[data-i18n]")) el.textContent = t(el.dataset.i18n);
  for (const el of document.querySelectorAll("[data-i18n-html]")) el.innerHTML = t(el.dataset.i18nHtml);
  for (const el of document.querySelectorAll("[data-i18n-content]")) el.content = t(el.dataset.i18nContent);
}

export function setLang(next) {
  lang = next;
  try { localStorage.setItem(KEY, next); } catch {}
  apply();
}

for (const btn of document.querySelectorAll("[data-lang-toggle]"))
  btn.addEventListener("click", () => setLang(lang === "ja" ? "en" : "ja"));

apply();

// Self-check: both languages define the same keys.
if (import.meta.env?.DEV) {
  const missing = LANGS.flatMap((l) => Object.keys(STRINGS.en).filter((k) => !(k in STRINGS[l])).map((k) => `${l}:${k}`));
  console.assert(missing.length === 0, "i18n missing keys", missing);
}
