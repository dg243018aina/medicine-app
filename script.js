const GEMINI_API_KEY = "";

const defaultData = {
  coins: 11,
  love: 0,
  exp: 0,
  level: 1,
  medTakenDate: "",
  currentPatientId: 1,
  patients: [
    {
      id: 1,
      name: 'マノ コウタ',
      age: 86,
      schedule: [
        { label: '朝ごはん', time: '7:00' },
        { label: '昼ごはん', time: '12:00' },
        { label: '晩ごはん', time: '19:00' },
        { label: 'お風呂', time: '17:00' }
      ],
      meds: [
        { name: 'ロキソニン', instruction: '朝 食後 2錠' },
        { name: '軟膏(塗り薬)', instruction: '朝洗顔後 入浴後 就寝前' }
      ]
    }
  ],
  events: {}
};

function getTodayStr() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

function getData() {
  try {
    const saved = localStorage.getItem('brain_med_app_data');
    if (!saved) return JSON.parse(JSON.stringify(defaultData));
    const data = JSON.parse(saved);
    data.exp = data.exp || 0;
    data.level = data.level || 1;
    data.coins = data.coins ?? 11;
    data.love = data.love ?? 0;
    data.medTakenDate = data.medTakenDate || "";
    data.events = data.events || {};
    return data;
  } catch (e) {
    return JSON.parse(JSON.stringify(defaultData));
  }
}

function saveData(data) {
  localStorage.setItem('brain_med_app_data', JSON.stringify(data));
}

let appData = getData();
let petTempMood = null; // 'eating' | 'wink' | null
let petMoodTimer = null;

let calcState = {
  selectedOp: '+',
  selectedDiff: 'easy',
  currentQuestion: { a: 0, b: 0, ans: 0 },
  questionIndex: 0,
  correctCount: 0,
  earnedCoins: 0,
  isChecking: false
};

let calendarState = {
  currentDate: new Date(),
  selectedDateStr: null
};

document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initPetSystem();
  initCalcSystem();
  initAlarmSystem();
  initCalendarSystem();
  renderPatientData();
  updatePetDisplay();
  updateHomeCalendarAndPet();
});

function initNavigation() {
  document.querySelectorAll('[data-target]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const targetId = e.currentTarget.getAttribute('data-target');
      showScreen(targetId);
      if (targetId === 'screen-home') {
        updateHomeCalendarAndPet();
      } else if (targetId === 'screen-med') {
        appData = getData();
        renderPatientData();
      } else if (targetId === 'screen-calendar') {
        renderCalendar();
      } else if (targetId === 'screen-pet') {
        updatePetDisplay();
      }
    });
  });
}

function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const targetElem = document.getElementById(screenId);
  if (targetElem) targetElem.classList.add('active');
}

/* ====================================================
   添付画像ベースの可愛いハムスターSVG生成（Lv5ごと変化・Lv100上限）
   ==================================================== */
function createCuteHamsterSVG(level, mood) {
  // Lv100以上は見た目もサイズも変化しない（Lv100でカンスト）
  const cappedLevel = Math.min(level || 1, 100);
  // Lv5ごとに進化段階（0〜20の21段階）
  const evoTier = Math.floor(cappedLevel / 5);

  // Lv5ごとのワンポイント装飾（Lv100でカンスト）
  let accessorySVG = '';
  if (evoTier >= 20) {
    // Lv100以上：王冠＋キラキラオーラ
    accessorySVG = `
      <polygon points="44,24 50,11 60,18 70,11 76,24" fill="#ffd43b" stroke="#5c3a21" stroke-width="2.5" stroke-linejoin="round"/>
      <circle cx="50" cy="11" r="2.5" fill="#ff6b6b"/><circle cx="60" cy="18" r="2.5" fill="#339af0"/><circle cx="70" cy="11" r="2.5" fill="#51cf66"/>
      <text x="14" y="34" font-size="14">✨</text><text x="92" y="34" font-size="14">✨</text>
    `;
  } else if (evoTier >= 15) {
    // Lv75〜99：金のティアラ
    accessorySVG = `
      <polygon points="46,24 52,13 60,19 68,13 74,24" fill="#fcc419" stroke="#5c3a21" stroke-width="2.5" stroke-linejoin="round"/>
      <circle cx="60" cy="19" r="2.5" fill="#ff6b6b"/>
    `;
  } else if (evoTier >= 12) {
    // Lv60〜74：天使の羽
    accessorySVG = `
      <path d="M 22 68 Q 6 54 16 44 Q 26 52 26 64 Z" fill="#ffffff" stroke="#5c3a21" stroke-width="2.5"/>
      <path d="M 98 68 Q 114 54 104 44 Q 94 52 94 64 Z" fill="#ffffff" stroke="#5c3a21" stroke-width="2.5"/>
    `;
  } else if (evoTier >= 9) {
    // Lv45〜59：赤いおしゃれマフラー
    accessorySVG = `
      <path d="M 33 78 Q 60 88 87 78 L 84 88 Q 60 97 36 88 Z" fill="#ff6b6b" stroke="#5c3a21" stroke-width="2.5"/>
      <rect x="68" y="83" width="11" height="18" rx="4" fill="#fa5252" stroke="#5c3a21" stroke-width="2.5"/>
    `;
  } else if (evoTier >= 6) {
    // Lv30〜44：お花の髪飾り
    accessorySVG = `
      <circle cx="80" cy="24" r="5" fill="#ff8787" stroke="#5c3a21" stroke-width="2"/>
      <circle cx="88" cy="28" r="5" fill="#ff8787" stroke="#5c3a21" stroke-width="2"/>
      <circle cx="84" cy="35" r="5" fill="#ff8787" stroke="#5c3a21" stroke-width="2"/>
      <circle cx="76" cy="31" r="5" fill="#ff8787" stroke="#5c3a21" stroke-width="2"/>
      <circle cx="82" cy="29" r="4" fill="#ffe066"/>
    `;
  } else if (evoTier >= 3) {
    // Lv15〜29：ピンクのリボン
    accessorySVG = `
      <polygon points="60,23 48,16 50,28" fill="#ff6b81" stroke="#5c3a21" stroke-width="2.5" stroke-linejoin="round"/>
      <polygon points="60,23 72,16 70,28" fill="#ff6b81" stroke="#5c3a21" stroke-width="2.5" stroke-linejoin="round"/>
      <circle cx="60" cy="23" r="4" fill="#ff4757" stroke="#5c3a21" stroke-width="2"/>
    `;
  } else if (evoTier >= 1) {
    // Lv5〜14：頭のふたば🌱
    accessorySVG = `
      <path d="M 60 24 Q 60 15 68 12" stroke="#5c3a21" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      <ellipse cx="72" cy="12" rx="7" ry="4" transform="rotate(-20 72 12)" fill="#51cf66" stroke="#5c3a21" stroke-width="2"/>
    `;
  }

  // 表情パーツ（添付画像の表情バリエーションを反映）
  let faceAndHandsSVG = '';

  if (mood === 'eating') {
    // ご飯をもらった時の喜びもぐもぐ表情（目を細めた笑顔＋ふっくらほっぺ＋ひまわりの種）
    faceAndHandsSVG = `
      <!-- ほっぺのふくらみ線 -->
      <path d="M 27 57 Q 21 63 27 69" stroke="#5c3a21" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      <path d="M 93 57 Q 99 63 93 69" stroke="#5c3a21" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      <!-- 喜びの線 -->
      <line x1="15" y1="46" x2="21" y2="50" stroke="#f39c12" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="105" y1="46" x2="99" y2="50" stroke="#f39c12" stroke-width="2.5" stroke-linecap="round"/>
      <!-- 細めた幸せ目 -->
      <path d="M 38 51 Q 44 45 50 51" stroke="#5c3a21" stroke-width="3" fill="none" stroke-linecap="round"/>
      <path d="M 70 51 Q 76 45 82 51" stroke="#5c3a21" stroke-width="3" fill="none" stroke-linecap="round"/>
      <!-- ピンクのほっぺ -->
      <ellipse cx="34" cy="61" rx="7" ry="4.5" fill="#ff8fa3" opacity="0.75"/>
      <ellipse cx="86" cy="61" rx="7" ry="4.5" fill="#ff8fa3" opacity="0.75"/>
      <!-- 鼻と口 -->
      <ellipse cx="60" cy="56" rx="3.5" ry="2.5" fill="#ff8787"/>
      <path d="M 53 61 Q 56.5 65 60 61 Q 63.5 65 67 61" stroke="#5c3a21" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      <!-- ひまわりの種 -->
      <ellipse cx="60" cy="77" rx="9" ry="14" fill="#635852" stroke="#5c3a21" stroke-width="2.5"/>
      <path d="M 56 65 Q 54 77 56 89" stroke="#f1f3f5" stroke-width="2" fill="none"/>
      <path d="M 60 64 L 60 90" stroke="#f1f3f5" stroke-width="2"/>
      <path d="M 64 65 Q 66 77 64 89" stroke="#f1f3f5" stroke-width="2" fill="none"/>
      <!-- 両手 -->
      <ellipse cx="49" cy="77" rx="6" ry="5" fill="#ffc9c9" stroke="#5c3a21" stroke-width="2.5"/>
      <ellipse cx="71" cy="77" rx="6" ry="5" fill="#ffc9c9" stroke="#5c3a21" stroke-width="2.5"/>
    `;
  } else if (mood === 'worried') {
    // まだお薬を飲んでいない時の困り顔・心配顔
    faceAndHandsSVG = `
      <!-- 困り眉 -->
      <line x1="38" y1="44" x2="48" y2="41" stroke="#5c3a21" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="82" y1="44" x2="72" y2="41" stroke="#5c3a21" stroke-width="2.5" stroke-linecap="round"/>
      <!-- うるうる目 -->
      <circle cx="44" cy="52" r="5.5" fill="#3d2616"/>
      <circle cx="42.5" cy="50" r="2" fill="#ffffff"/>
      <circle cx="76" cy="52" r="5.5" fill="#3d2616"/>
      <circle cx="74.5" cy="50" r="2" fill="#ffffff"/>
      <!-- 汗マーク -->
      <path d="M 96 42 Q 100 48 96 51 Q 92 48 96 42 Z" fill="#74c0fc"/>
      <!-- ピンクのほっぺ -->
      <ellipse cx="34" cy="61" rx="6.5" ry="4" fill="#ff8fa3" opacity="0.65"/>
      <ellipse cx="86" cy="61" rx="6.5" ry="4" fill="#ff8fa3" opacity="0.65"/>
      <!-- 鼻とむにゅ口 -->
      <ellipse cx="60" cy="57" rx="3.5" ry="2.5" fill="#ff8787"/>
      <path d="M 54 65 Q 60 61 66 65" stroke="#5c3a21" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      <!-- ちょこんと揃えた手 -->
      <path d="M 46 73 Q 51 77 46 81" stroke="#5c3a21" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      <path d="M 74 73 Q 69 77 74 81" stroke="#5c3a21" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    `;
  } else if (mood === 'wink') {
    // お薬を飲んだ時・褒める時の元気いっぱいウインク笑顔
    faceAndHandsSVG = `
      <!-- 喜び線 -->
      <line x1="15" y1="45" x2="21" y2="49" stroke="#f39c12" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="105" y1="45" x2="99" y2="49" stroke="#f39c12" stroke-width="2.5" stroke-linecap="round"/>
      <!-- ウインク目とキラキラ目 -->
      <path d="M 38 52 Q 44 47 50 52" stroke="#5c3a21" stroke-width="3" fill="none" stroke-linecap="round"/>
      <circle cx="76" cy="52" r="5.5" fill="#3d2616"/>
      <circle cx="74.5" cy="50" r="2" fill="#ffffff"/>
      <!-- ピンクのほっぺ -->
      <ellipse cx="34" cy="61" rx="7" ry="4.5" fill="#ff8fa3" opacity="0.75"/>
      <ellipse cx="86" cy="61" rx="7" ry="4.5" fill="#ff8fa3" opacity="0.75"/>
      <!-- 鼻と笑顔の口 -->
      <ellipse cx="60" cy="56" rx="3.5" ry="2.5" fill="#ff8787"/>
      <path d="M 53 60 Q 56.5 64 60 60 Q 63.5 64 67 60" stroke="#5c3a21" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      <!-- 元気に上げた右手と左手 -->
      <path d="M 32 68 Q 26 54 36 52 Q 42 54 41 68" fill="#f5b062" stroke="#5c3a21" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M 72 74 Q 67 78 72 82" stroke="#5c3a21" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    `;
  } else {
    // 通常時（添付1枚目ベース：くりくり黒目＋ひまわりの種を持ったニコニコ顔）
    faceAndHandsSVG = `
      <!-- くりくり黒目とハイライト -->
      <circle cx="44" cy="51" r="5.8" fill="#3d2616"/>
      <circle cx="42" cy="49" r="2.2" fill="#ffffff"/>
      <circle cx="76" cy="51" r="5.8" fill="#3d2616"/>
      <circle cx="74" cy="49" r="2.2" fill="#ffffff"/>
      <!-- ふっくらチーク -->
      <ellipse cx="34" cy="60" rx="7" ry="4.5" fill="#ff8fa3" opacity="0.7"/>
      <ellipse cx="86" cy="60" rx="7" ry="4.5" fill="#ff8fa3" opacity="0.7"/>
      <!-- ピンクの鼻とにっこり口 -->
      <ellipse cx="60" cy="56" rx="3.5" ry="2.5" fill="#ff8787"/>
      <path d="M 53 60 Q 56.5 64 60 60 Q 63.5 64 67 60" stroke="#5c3a21" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      <!-- ひまわりの種 -->
      <ellipse cx="60" cy="78" rx="8" ry="13" fill="#635852" stroke="#5c3a21" stroke-width="2.5"/>
      <path d="M 57 67 Q 55 78 57 89" stroke="#f1f3f5" stroke-width="1.8" fill="none"/>
      <path d="M 60 66 L 60 90" stroke="#f1f3f5" stroke-width="1.8"/>
      <path d="M 63 67 Q 65 78 63 89" stroke="#f1f3f5" stroke-width="1.8" fill="none"/>
      <!-- 両手 -->
      <ellipse cx="50" cy="78" rx="5.5" ry="4.5" fill="#ffc9c9" stroke="#5c3a21" stroke-width="2.5"/>
      <ellipse cx="70" cy="78" rx="5.5" ry="4.5" fill="#ffc9c9" stroke="#5c3a21" stroke-width="2.5"/>
    `;
  }

  return `
    <svg viewBox="0 0 120 120" class="hamster-svg-art">
      <!-- 丸いお耳 -->
      <circle cx="35" cy="31" r="12" fill="#f5b062" stroke="#5c3a21" stroke-width="3"/>
      <circle cx="35" cy="32" r="6.5" fill="#ffb8c6"/>
      <circle cx="85" cy="31" r="12" fill="#f5b062" stroke="#5c3a21" stroke-width="3"/>
      <circle cx="85" cy="32" r="6.5" fill="#ffb8c6"/>
      
      <!-- 頭の上のふわふわ毛 -->
      <path d="M 55 24 L 58 19 L 60 23 L 63 19 L 65 24" stroke="#5c3a21" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>

      <!-- ぷっくりした体とほっぺの輪郭 -->
      <path d="M 32 45 C 32 27, 88 27, 88 45 C 97 53, 98 66, 91 74 C 95 88, 86 102, 60 102 C 34 102, 25 88, 29 74 C 22 66, 23 53, 32 45 Z" fill="#f5b062" stroke="#5c3a21" stroke-width="3"/>

      <!-- クリーム色のお腹と口元 -->
      <path d="M 43 56 C 43 49, 77 49, 77 56 C 84 63, 86 98, 60 98 C 34 98, 36 63, 43 56 Z" fill="#fff9eb"/>

      <!-- ピンクの小さな足 -->
      <ellipse cx="44" cy="103" rx="8" ry="4.5" fill="#ffc9c9" stroke="#5c3a21" stroke-width="2.5"/>
      <ellipse cx="76" cy="103" rx="8" ry="4.5" fill="#ffc9c9" stroke="#5c3a21" stroke-width="2.5"/>

      ${faceAndHandsSVG}
      ${accessorySVG}
    </svg>
  `;
}

// Lv5ごとの成長サイズを計算（Lv100以上でストップし、画面いっぱいにならない）
function getHamsterScale(level) {
  const cappedLevel = Math.min(level || 1, 100);
  const evoTier = Math.floor(cappedLevel / 5); // 0〜20
  // 0.84倍 〜 最大1.22倍（Lv100で上限）
  return (0.84 + evoTier * 0.019).toFixed(3);
}

/* ====================================================
   ホーム画面：カレンダー日付＆ハムスターの表情・コメント更新
   ==================================================== */
function updateHomeCalendarAndPet() {
  const today = new Date();
  const monthEl = document.getElementById('home-cal-month');
  const dayEl = document.getElementById('home-cal-day');
  if (monthEl) monthEl.textContent = `${today.getMonth() + 1}月`;
  if (dayEl) dayEl.textContent = today.getDate();

  const speechEl = document.getElementById('home-pet-speech');
  const homePetBody = document.getElementById('home-pet-body');

  const todayStr = getTodayStr();
  const todayEvents = appData.events[todayStr] || [];
  const isMedTakenToday = (appData.medTakenDate === todayStr);

  const eventNames = todayEvents.map(ev => ev.title).join('・');
  let message = "";
  let homeMood = "normal";

  if (todayEvents.length > 0 && !isMedTakenToday) {
    message = `今日の予定は「${eventNames}」があるよ！それと、まだ今日のお薬を飲んでいないよチュ！`;
    homeMood = "worried";
  } else if (todayEvents.length > 0 && isMedTakenToday) {
    message = `今日の予定は「${eventNames}」があるよチュ！お薬も飲んでえらいのだ！`;
    homeMood = "wink";
  } else if (todayEvents.length === 0 && !isMedTakenToday) {
    message = `まだ今日のお薬を飲んでいないよチュ！忘れずに飲もうね！`;
    homeMood = "worried";
  } else {
    message = `今日のお薬はバッチリ飲んだね！予定はないからゆっくり過ごそうチュ！`;
    homeMood = "wink";
  }

  if (speechEl) speechEl.textContent = message;
  if (homePetBody) {
    homePetBody.innerHTML = createCuteHamsterSVG(appData.level, homeMood);
    const scale = Math.min(parseFloat(getHamsterScale(appData.level)), 1.12);
    homePetBody.style.transform = `scale(${scale})`;
  }
}

/* ====================================================
   ペット育成 ＆ レベル連動おしゃべり
   ==================================================== */
function initPetSystem() {
  const tabGohan = document.getElementById('tab-btn-gohan');
  const tabTalk = document.getElementById('tab-btn-talk');
  const contentGohan = document.getElementById('tab-content-gohan');
  const contentTalk = document.getElementById('tab-content-talk');

  if (tabGohan && tabTalk) {
    tabGohan.addEventListener('click', () => {
      tabGohan.classList.add('active'); tabTalk.classList.remove('active');
      contentGohan.classList.add('active'); contentTalk.classList.remove('active');
    });

    tabTalk.addEventListener('click', () => {
      tabTalk.classList.add('active'); tabGohan.classList.remove('active');
      contentTalk.classList.add('active'); contentGohan.classList.remove('active');
    });
  }

  document.querySelectorAll('.food-card').forEach(card => {
    card.addEventListener('click', () => {
      const cost = parseInt(card.getAttribute('data-cost'));
      const expGain = parseInt(card.getAttribute('data-exp'));
      const loveGain = parseInt(card.getAttribute('data-love') || "5");
      const foodName = card.getAttribute('data-food');

      if (appData.coins >= cost) {
        appData.coins -= cost;
        appData.love = Math.min(100, (appData.love || 0) + loveGain);
        appData.exp = (appData.exp || 0) + expGain;

        const oldLevel = appData.level || 1;
        // 30EXPごとに1レベルアップ（Lv5ごとの変化を実感しやすい設計）
        appData.level = Math.floor(appData.exp / 30) + 1;

        // ご飯をもらった喜び表情に切り替え
        triggerTempPetMood('eating', 3500);

        saveData(appData);
        updatePetDisplay();

        const oldEvo = Math.floor(Math.min(oldLevel, 100) / 5);
        const newEvo = Math.floor(Math.min(appData.level, 100) / 5);

        if (newEvo > oldEvo) {
          alert(`🎉 おめでとう！ Lv.${appData.level} に成長してハムスターの姿が変化しました！`);
        } else if (appData.level > oldLevel) {
          alert(`🎉 レベルアップ！ Lv.${appData.level} になりました！`);
        } else {
          alert(`ハムスターに${foodName}をあげました！もぐもぐ大喜び！`);
        }
      } else {
        alert('コインが足りません！計算をしてコインを集めましょう。');
      }
    });
  });

  const input = document.getElementById('talk-input');
  const sendBtn = document.getElementById('talk-send-btn');

  if (sendBtn && input) {
    const sendMessage = async () => {
      const text = input.value.trim();
      if (!text) return;

      appendChatBubble(text, 'user');
      input.value = '';

      const tempBubble = appendChatBubble("考え中チュ...", 'pet');
      const reply = await fetchAIReply(text);
      tempBubble.textContent = reply;
      triggerTempPetMood('wink', 2500);
    };

    sendBtn.addEventListener('click', sendMessage);
    input.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });
  }

  const resetBtn = document.getElementById('reset-data-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (confirm('最初からやり直しますか？')) {
        localStorage.removeItem('brain_med_app_data');
        appData = JSON.parse(JSON.stringify(defaultData));
        petTempMood = null;
        saveData(appData);
        updatePetDisplay();
        updateHomeCalendarAndPet();
        renderCalendar();
        alert('リセットしました。');
      }
    });
  }
}

function triggerTempPetMood(mood, durationMs) {
  petTempMood = mood;
  updatePetDisplay();
  if (petMoodTimer) clearTimeout(petMoodTimer);
  petMoodTimer = setTimeout(() => {
    petTempMood = null;
    updatePetDisplay();
  }, durationMs);
}

async function fetchAIReply(userText) {
  if (GEMINI_API_KEY) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `あなたは高齢者の患者さんを心から癒す可愛い相棒ハムスター（現在Lv.${appData.level}）です。語尾に「チュ」「～のだ」をつけて、優しく丁寧な日本語（70文字以内）で返答してください。質問: ${userText}`
            }]
          }]
        })
      });
      const data = await response.json();
      if (data.candidates && data.candidates[0].content.parts[0].text) {
        return data.candidates[0].content.parts[0].text.trim();
      }
    } catch (e) {
      console.error(e);
    }
  }
  return generateLevelBasedReply(userText);
}

// レベルが上がるごとに会話のレパートリーが増えていく仕組み
function generateLevelBasedReply(text) {
  const level = appData.level || 1;

  // キーワード反応
  if (text.includes("天気") || text.includes("雨") || text.includes("晴れ") || text.includes("暑い") || text.includes("寒い")) {
    return "今日もお外の空気をすうと気持ちいいチュ！無理せず快適にお過ごしくださいね！";
  }
  if (text.includes("ご飯") || text.includes("ごはん") || text.includes("食べ") || text.includes("腹")) {
    return "美味しいものを食べると元気が湧いてくるチュ！僕にもひまわりの種をちょうだいね！";
  }
  if (text.includes("くすり") || text.includes("薬") || text.includes("時間")) {
    return "お薬をしっかり飲んで素晴らしいチュ！健康が一番大切なのだ！";
  }
  if (text.includes("ありがと") || text.includes("感謝")) {
    return "こちらこそいつも温かくしてくれてありがとうチュ！大好きだよ！";
  }
  if (text.includes("つかれた") || text.includes("しんどい") || text.includes("痛い")) {
    return "大丈夫チュ？無理は厳禁だよ。温かい飲み物を飲んでゆっくり休みましょうね。";
  }

  // レベル1〜4の基本会話
  const pool = [
    `「${text}」って教えてくれてありがとうチュ！とっても嬉しいのだ！`,
    "お話できて楽しいチュ！今日も一緒にのんびり過ごそうね！",
    "計算テストも無理のないペースで楽しんでねチュ！"
  ];

  // Lv5以上で追加される会話レパートリー
  if (level >= 5) {
    pool.push(
      "少しずつ大きくなってきた気がするチュ！いつもごはんをありがとうなのだ！",
      "背伸びをすると体がポカポカして気持ちいいチュ！一緒に深呼吸しよう〜！"
    );
  }

  // Lv15以上で追加される会話レパートリー
  if (level >= 15) {
    pool.push(
      "水分補給はこまめにすると体にいいらしいチュ！お茶でも飲んで一息つこうね！",
      "あなたが笑顔でいてくれると、僕もほっぺが落ちそうなくらい幸せチュ！"
    );
  }

  // Lv30以上で追加される会話レパートリー
  if (level >= 30) {
    pool.push(
      "もうすっかり大親友だチュ！昔好きだった食べ物や思い出のお話も聞かせてほしいのだ！",
      "夜ぐっすり眠れるように、昼間は明るく楽しく過ごそうねチュ！"
    );
  }

  // Lv50以上で追加される会話レパートリー
  if (level >= 50) {
    pool.push(
      "ここまで一緒に歩いてくれて本当に感謝しているチュ！ずっと一番の味方なのだ！",
      "今日の調子はどうチュ？楽しい予定があったらカレンダーに書いておこうね！"
    );
  }

  // Lv100以上で追加される特別会話
  if (level >= 100) {
    pool.push(
      "最高レベルまで育ててくれてありがとうチュ！あなたは僕の世界一のパートナーなのだ！✨"
    );
  }

  return pool[Math.floor(Math.random() * pool.length)];
}

function updatePetDisplay() {
  const coinElem = document.getElementById('coin-count');
  const loveElem = document.getElementById('pet-love');
  const levelElem = document.getElementById('pet-level');
  const stageElem = document.getElementById('pet-stage-name');
  const petBody = document.getElementById('pet-character-body');
  const openingSlot = document.getElementById('opening-pet-slot');
  const repCountEl = document.getElementById('talk-repertoire-count');

  const level = appData.level || 1;
  if (coinElem) coinElem.textContent = appData.coins || 0;
  if (loveElem) loveElem.textContent = appData.love || 0;
  if (levelElem) levelElem.textContent = level;

  const currentLevelExp = (appData.exp || 0) % 30;
  const neededExp = 30 - currentLevelExp;
  const progressPercent = (currentLevelExp / 30) * 100;

  const barFill = document.getElementById('exp-bar-fill');
  const expTextEl = document.getElementById('exp-status-text');
  if (level >= 100) {
    if (barFill) barFill.style.width = '100%';
    if (expTextEl) expTextEl.innerHTML = '<strong>最大サイズに成長しました！（Lv.100達成）</strong>';
  } else {
    if (barFill) barFill.style.width = `${progressPercent}%`;
    if (expTextEl) expTextEl.innerHTML = `あと <strong>${neededExp}</strong> でレベルアップ！`;
  }

  // Lv5ごとの呼び名
  let stageName = '赤ちゃんハム';
  if (level >= 100) stageName = '王様ハム（最大成長）';
  else if (level >= 75) stageName = 'ティアラハム';
  else if (level >= 60) stageName = 'エンジェルハム';
  else if (level >= 45) stageName = 'おしゃれハム';
  else if (level >= 30) stageName = 'お花見ハム';
  else if (level >= 15) stageName = 'リボンハム';
  else if (level >= 5) stageName = 'ふたばハム';

  if (stageElem) stageElem.textContent = stageName;

  // 表情の決定（一時的な喜び/ウインク ＞ 薬の服用状況 ＞ 通常）
  const isMedTakenToday = (appData.medTakenDate === getTodayStr());
  const currentMood = petTempMood || (isMedTakenToday ? 'wink' : 'normal');

  if (petBody) {
    petBody.innerHTML = createCuteHamsterSVG(level, currentMood);
    petBody.style.transform = `scale(${getHamsterScale(level)})`;
  }

  if (openingSlot) {
    openingSlot.innerHTML = createCuteHamsterSVG(level, 'wink');
  }

  // 会話レパートリー段階の表示
  if (repCountEl) {
    if (level >= 100) repCountEl.textContent = '最大解放（すべての会話）';
    else if (level >= 50) repCountEl.textContent = '段階5（大親友トーク解放中）';
    else if (level >= 30) repCountEl.textContent = '段階4（思い出トーク解放中）';
    else if (level >= 15) repCountEl.textContent = '段階3（健康アドバイス解放中）';
    else if (level >= 5) repCountEl.textContent = '段階2（成長トーク解放中）';
    else repCountEl.textContent = '段階1（Lv5で新しい会話が解放！）';
  }
}

function appendChatBubble(text, sender) {
  const history = document.getElementById('chat-history');
  if (!history) return;
  const bubble = document.createElement('div');
  bubble.className = `chat-bubble ${sender === 'user' ? 'user-bubble' : 'pet-bubble'}`;
  bubble.textContent = text;
  history.appendChild(bubble);
  history.scrollTop = history.scrollHeight;
  return bubble;
}

/* ====================================================
   計算ゲーム（難易度別コイン調整 ＆ 1問ごとの○×・答え表示）
   ==================================================== */
function initCalcSystem() {
  const menu = document.getElementById('calc-menu');
  const game = document.getElementById('calc-game');
  const result = document.getElementById('calc-result');
  const userAns = document.getElementById('user-answer');
  const feedbackEl = document.getElementById('calc-feedback');

  document.querySelectorAll('.calc-op-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.calc-op-btn').forEach(b => b.classList.remove('active'));
      e.currentTarget.classList.add('active');
      calcState.selectedOp = e.currentTarget.getAttribute('data-op');
    });
  });

  document.querySelectorAll('.calc-diff-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.calc-diff-btn').forEach(b => b.classList.remove('active'));
      e.currentTarget.classList.add('active');
      calcState.selectedDiff = e.currentTarget.getAttribute('data-diff');
    });
  });

  document.getElementById('start-calc-btn').addEventListener('click', () => {
    calcState.questionIndex = 0;
    calcState.correctCount = 0;
    calcState.earnedCoins = 0;
    calcState.isChecking = false;
    if (feedbackEl) feedbackEl.classList.add('hidden');
    menu.classList.add('hidden');
    result.classList.add('hidden');
    game.classList.remove('hidden');
    generateQuestion();
  });

  document.getElementById('calc-quit-btn').addEventListener('click', () => {
    calcState.isChecking = false;
    game.classList.add('hidden');
    menu.classList.remove('hidden');
    if (userAns) userAns.textContent = '';
    if (feedbackEl) feedbackEl.classList.add('hidden');
  });

  document.getElementById('calc-retry-btn').addEventListener('click', () => {
    result.classList.add('hidden');
    menu.classList.remove('hidden');
  });

  document.querySelectorAll('.num-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      if (calcState.isChecking) return; // 判定表示中は入力ロック
      const val = e.currentTarget.textContent;
      if (val === '消す') { if (userAns) userAns.textContent = ''; }
      else if (val === '確定') submitAnswer();
      else if (userAns && userAns.textContent.length < 5) userAns.textContent += val;
    });
  });
}

function generateQuestion() {
  let max = calcState.selectedDiff === 'mid' ? 50 : (calcState.selectedDiff === 'hard' ? 100 : 10);
  let a = Math.floor(Math.random() * max) + 1;
  let b = Math.floor(Math.random() * max) + 1;
  let ans = 0;

  if (calcState.selectedOp === '+') ans = a + b;
  if (calcState.selectedOp === '-') { if (a < b) [a, b] = [b, a]; ans = a - b; }
  if (calcState.selectedOp === '*') {
    a = Math.floor(Math.random() * (calcState.selectedDiff === 'easy' ? 9 : (calcState.selectedDiff === 'mid' ? 15 : 25))) + 1;
    b = Math.floor(Math.random() * 9) + 1;
    ans = a * b;
  }
  if (calcState.selectedOp === '/') {
    ans = Math.floor(Math.random() * 9) + 1;
    b = Math.floor(Math.random() * (calcState.selectedDiff === 'easy' ? 5 : 9)) + 1;
    a = ans * b;
  }

  calcState.currentQuestion = { a, b, ans, op: calcState.selectedOp };
  const opSymbol = calcState.selectedOp === '*' ? '×' : (calcState.selectedOp === '/' ? '÷' : calcState.selectedOp);

  document.getElementById('calc-progress-text').textContent = `第 ${calcState.questionIndex + 1} / 10 問`;
  document.getElementById('question-text').textContent = `${a} ${opSymbol} ${b} = ?`;
  document.getElementById('user-answer').textContent = '';

  const feedbackEl = document.getElementById('calc-feedback');
  if (feedbackEl) feedbackEl.classList.add('hidden');
}

function submitAnswer() {
  const uAns = document.getElementById('user-answer');
  const feedbackEl = document.getElementById('calc-feedback');
  if (!uAns || uAns.textContent === '' || calcState.isChecking) return;

  calcState.isChecking = true;
  const userVal = parseInt(uAns.textContent);
  const correctAns = calcState.currentQuestion.ans;

  // 難易度ごとの1問あたりコイン数（かんたん:1, ふつう:2, むずかしい:3）
  const coinPerQuestion = calcState.selectedDiff === 'easy' ? 1 : (calcState.selectedDiff === 'mid' ? 2 : 3);

  if (feedbackEl) {
    feedbackEl.classList.remove('hidden', 'correct', 'wrong');
    if (userVal === correctAns) {
      calcState.correctCount++;
      calcState.earnedCoins += coinPerQuestion;
      feedbackEl.classList.add('correct');
      feedbackEl.textContent = `⭕ 正解！ 答え：${correctAns}`;
    } else {
      feedbackEl.classList.add('wrong');
      feedbackEl.textContent = `❌ ざんねん… 答え：${correctAns}`;
    }
  }

  // 1.3秒間、○×と答えを表示してから次の問題またはリザルトへ進む
  setTimeout(() => {
    calcState.isChecking = false;
    calcState.questionIndex++;
    if (calcState.questionIndex < 10) {
      generateQuestion();
    } else {
      showCalcResult();
    }
  }, 1300);
}

function showCalcResult() {
  const game = document.getElementById('calc-game');
  const result = document.getElementById('calc-result');

  appData.coins = (appData.coins || 0) + calcState.earnedCoins;
  saveData(appData);
  updatePetDisplay();

  document.getElementById('result-correct-count').textContent = calcState.correctCount;
  document.getElementById('result-earned-coins').textContent = calcState.earnedCoins;

  game.classList.add('hidden');
  result.classList.remove('hidden');
}

/* ====================================================
   服薬・生活データ ＆ アラーム
   ==================================================== */
function renderPatientData() {
  const patient = appData.patients.find(p => p.id === appData.currentPatientId);
  if (!patient) return;

  const nameElem = document.getElementById('patient-display-name');
  if (nameElem) nameElem.textContent = `${patient.name} 様`;

  const schedList = document.getElementById('schedule-list');
  if (schedList) {
    schedList.innerHTML = patient.schedule.map(s =>
      `<li><span>${s.label}</span> <strong>${s.time}</strong></li>`
    ).join('');
  }

  const medList = document.getElementById('medicine-list');
  if (medList) {
    medList.innerHTML = patient.meds.map(m =>
      `<div class="med-item">
        <div class="med-name">${m.name}</div>
        <div class="med-instruction">${m.instruction}</div>
      </div>`
    ).join('');
  }
}

function recordMedTaken() {
  appData.medTakenDate = getTodayStr();
  saveData(appData);
  updatePetDisplay();
  updateHomeCalendarAndPet();
  alert('今日のお薬をのんだ記録を保存しました！ハムスターも大喜びです！');
}

function initAlarmSystem() {
  const modal = document.getElementById('alarm-modal');
  const triggerBtn = document.getElementById('trigger-alarm-test-btn');
  const doneBtn = document.getElementById('mark-med-taken-btn');
  const yesBtn = document.getElementById('alarm-btn-yes');
  const noBtn = document.getElementById('alarm-btn-no');

  if (doneBtn) doneBtn.addEventListener('click', recordMedTaken);
  if (triggerBtn) triggerBtn.addEventListener('click', () => modal.classList.remove('hidden'));
  if (yesBtn) {
    yesBtn.addEventListener('click', () => {
      modal.classList.add('hidden');
      recordMedTaken();
    });
  }
  if (noBtn) {
    noBtn.addEventListener('click', () => {
      modal.classList.add('hidden');
      alert('再通知に設定しました。忘れずに飲みましょうね。');
    });
  }
}

/* ====================================================
   カレンダー機能
   ==================================================== */
function initCalendarSystem() {
  const prevBtn = document.getElementById('prev-month-btn');
  const nextBtn = document.getElementById('next-month-btn');
  const openModalBtn = document.getElementById('open-add-event-btn');
  const closeModalBtn = document.getElementById('close-event-modal-btn');
  const eventForm = document.getElementById('event-form');
  const eventModal = document.getElementById('event-modal');

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      calendarState.currentDate.setMonth(calendarState.currentDate.getMonth() - 1);
      renderCalendar();
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      calendarState.currentDate.setMonth(calendarState.currentDate.getMonth() + 1);
      renderCalendar();
    });
  }

  if (openModalBtn) {
    openModalBtn.addEventListener('click', () => {
      if (!calendarState.selectedDateStr) {
        alert('先にカレンダーから日付を選択してください。');
        return;
      }
      if (eventModal) eventModal.classList.remove('hidden');
    });
  }

  if (closeModalBtn && eventModal) {
    closeModalBtn.addEventListener('click', () => {
      eventModal.classList.add('hidden');
    });
  }

  if (eventForm) {
    eventForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const titleInput = document.getElementById('event-title');
      const timeInput = document.getElementById('event-time');
      const categorySelect = document.getElementById('event-category');

      const title = titleInput.value.trim();
      const time = timeInput ? timeInput.value : '';
      let category = '';
      if (categorySelect) {
        category = categorySelect.options[categorySelect.selectedIndex].text.split(' ')[0];
      }

      const dateStr = calendarState.selectedDateStr;
      if (!appData.events[dateStr]) appData.events[dateStr] = [];
      appData.events[dateStr].push({ title, time, category });

      saveData(appData);
      updateHomeCalendarAndPet();

      titleInput.value = '';
      if (timeInput) timeInput.value = '';
      if (eventModal) eventModal.classList.add('hidden');

      renderCalendar();
      renderEvents();
    });
  }
}

function renderCalendar() {
  const monthTitle = document.getElementById('calendar-month-title');
  const daysGrid = document.getElementById('calendar-days-grid');
  if (!monthTitle || !daysGrid) return;

  const year = calendarState.currentDate.getFullYear();
  const month = calendarState.currentDate.getMonth();

  monthTitle.textContent = `${year}年 ${month + 1}月`;
  daysGrid.innerHTML = '';

  const firstDay = new Date(year, month, 1).getDay();
  const lastDate = new Date(year, month + 1, 0).getDate();

  for (let i = 0; i < firstDay; i++) {
    const cell = document.createElement('div');
    cell.className = 'day-cell other-month';
    daysGrid.appendChild(cell);
  }

  const todayStr = getTodayStr();

  for (let date = 1; date <= lastDate; date++) {
    const cell = document.createElement('div');
    cell.className = 'day-cell';
    cell.textContent = date;

    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(date).padStart(2, '0')}`;

    if (dateStr === todayStr) cell.classList.add('today');
    if (dateStr === calendarState.selectedDateStr) cell.classList.add('selected');

    if (appData.events[dateStr] && appData.events[dateStr].length > 0) {
      const dot = document.createElement('div');
      dot.className = 'event-dot';
      cell.appendChild(dot);
    }

    cell.addEventListener('click', () => {
      calendarState.selectedDateStr = dateStr;
      const label = document.getElementById('selected-date-label');
      if (label) label.textContent = `${dateStr} の予定`;
      renderCalendar();
      renderEvents();
    });

    daysGrid.appendChild(cell);
  }
}

function renderEvents() {
  const eventsList = document.getElementById('selected-day-events');
  if (!eventsList) return;

  eventsList.innerHTML = '';
  const dateStr = calendarState.selectedDateStr;
  const dayEvents = appData.events[dateStr] || [];

  if (dayEvents.length === 0) {
    eventsList.innerHTML = '<p class="empty-msg">予定はありません</p>';
    return;
  }

  dayEvents.forEach((ev, index) => {
    const item = document.createElement('div');
    item.className = 'event-item';
    item.innerHTML = `
      <span>${ev.category || ''} ${ev.time ? ev.time + ' ' : ''}${ev.title}</span>
      <button class="delete-event-btn" onclick="deleteEvent('${dateStr}', ${index})">✕</button>
    `;
    eventsList.appendChild(item);
  });
}

window.deleteEvent = function(dateStr, index) {
  if (!appData.events[dateStr]) return;
  appData.events[dateStr].splice(index, 1);
  if (appData.events[dateStr].length === 0) delete appData.events[dateStr];

  saveData(appData);
  updateHomeCalendarAndPet();
  renderCalendar();
  renderEvents();
};
