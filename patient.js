const GROQ_API_KEY = ""; // ← 必要に応じてGroqのAPIキーを入力

const SHARED_STORAGE_KEY = 'brain_med_app_data';
const BOUND_PATIENT_ID_KEY = 'patient_app_locked_id_v1';
const PET_PROFILES_KEY = 'brain_med_patient_pets_v1';

const fallbackSharedData = {
  currentPatientId: '1001',
  patients: [
    {
      id: '1001',
      name: '眞野 宏太',
      updatedAt: '2026/11/16',
      memo: '血圧安定。食後の飲み忘れに注意。',
      schedule: [
        { label: '朝ごはん', time: '07:00' },
        { label: '昼ごはん', time: '12:00' },
        { label: '晩ごはん', time: '19:00' },
        { label: 'お風呂', time: '17:00' }
      ],
      meds: [
        { name: 'ロキソニン', dosage: '1錠', timing: ['朝', '昼', '夕'] }
      ]
    }
  ]
};

function getTodayStr() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

function loadSharedMedData() {
  try {
    const raw = localStorage.getItem(SHARED_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.patients) && parsed.patients.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('共有データ読み込みエラー:', e);
  }
  return JSON.parse(JSON.stringify(fallbackSharedData));
}

function findPatientById(patientId) {
  const shared = loadSharedMedData();
  const targetStr = String(patientId).trim();
  return shared.patients.find(p => String(p.id).trim() === targetStr) || null;
}

function getLockedPatientId() {
  return localStorage.getItem(BOUND_PATIENT_ID_KEY);
}

function lockPatientId(patientId) {
  localStorage.setItem(BOUND_PATIENT_ID_KEY, String(patientId).trim());
}

/* ====================================================
   患者IDごとの専用ペット・カレンダーデータ管理
   ==================================================== */
function createDefaultPetData() {
  return {
    coins: 11,
    love: 0,
    exp: 0,
    level: 1,
    medTakenDate: "",
    events: {}
  };
}

function loadAllPetProfiles() {
  try {
    const raw = localStorage.getItem(PET_PROFILES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function saveAllPetProfiles(profiles) {
  localStorage.setItem(PET_PROFILES_KEY, JSON.stringify(profiles));
}

function getMyPatientBundle() {
  const lockedId = getLockedPatientId();
  const patient = findPatientById(lockedId);
  if (!patient) return null;

  const profiles = loadAllPetProfiles();
  const key = String(patient.id);
  if (!profiles[key]) {
    profiles[key] = createDefaultPetData();
    saveAllPetProfiles(profiles);
  }

  return {
    patient,
    pet: profiles[key]
  };
}

function updateMyPetData(updaterFn) {
  const bundle = getMyPatientBundle();
  if (!bundle) return;

  const profiles = loadAllPetProfiles();
  const key = String(bundle.patient.id);
  if (!profiles[key]) profiles[key] = createDefaultPetData();
  updaterFn(profiles[key]);
  saveAllPetProfiles(profiles);
}

let petTempMood = null;
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
  initIdLoginGate();
  initPetSystem();
  initCalcSystem();
  initAlarmSystem();
  initCalendarSystem();

  // 起動時判定：既にIDが登録済みならID入力画面は二度と出さずにオープニング画面へ
  const lockedId = getLockedPatientId();
  const existingPatient = lockedId ? findPatientById(lockedId) : null;

  if (existingPatient) {
    refreshAllMyViews();
    showScreen('screen-opening');
  } else {
    showScreen('screen-id-login');
  }
});

/* ====================================================
   初回のみ表示される患者ID入力ゲート
   ==================================================== */
function initIdLoginGate() {
  const form = document.getElementById('patient-id-login-form');
  const input = document.getElementById('login-patient-id-input');
  const errorEl = document.getElementById('id-login-error');

  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const enteredId = input.value.trim();
    if (!enteredId) return;

    const matchedPatient = findPatientById(enteredId);
    if (!matchedPatient) {
      errorEl.textContent = `ID「${enteredId}」は登録されていません。薬剤師さんにIDをご確認ください。`;
      errorEl.classList.remove('hidden');
      return;
    }

    errorEl.classList.add('hidden');
    // 端末にこの患者IDを固定ロック（以降ID入力画面は表示されない）
    lockPatientId(matchedPatient.id);
    refreshAllMyViews();
    showScreen('screen-opening');
  });
}

function refreshAllMyViews() {
  renderPatientData();
  updatePetDisplay();
  updateHomeCalendarAndPet();
  renderCalendar();
}

function initNavigation() {
  document.querySelectorAll('[data-target]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const targetId = e.currentTarget.getAttribute('data-target');
      // 外部からID画面へ戻す操作は一切許可しない
      if (targetId === 'screen-id-login') return;

      showScreen(targetId);
      if (targetId === 'screen-home') {
        updateHomeCalendarAndPet();
      } else if (targetId === 'screen-med') {
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
   可愛いハムスターSVG生成
   ==================================================== */
function createCuteHamsterSVG(level, mood) {
  const cappedLevel = Math.min(level || 1, 100);
  const evoTier = Math.floor(cappedLevel / 5);

  let accessorySVG = '';
  if (evoTier >= 20) {
    accessorySVG = `
      <polygon points="44,24 50,11 60,18 70,11 76,24" fill="#ffd43b" stroke="#5c3a21" stroke-width="2.5" stroke-linejoin="round"/>
      <circle cx="50" cy="11" r="2.5" fill="#ff6b6b"/><circle cx="60" cy="18" r="2.5" fill="#339af0"/><circle cx="70" cy="11" r="2.5" fill="#51cf66"/>
      <text x="14" y="34" font-size="14">✨</text><text x="92" y="34" font-size="14">✨</text>
    `;
  } else if (evoTier >= 15) {
    accessorySVG = `
      <polygon points="46,24 52,13 60,19 68,13 74,24" fill="#fcc419" stroke="#5c3a21" stroke-width="2.5" stroke-linejoin="round"/>
      <circle cx="60" cy="19" r="2.5" fill="#ff6b6b"/>
    `;
  } else if (evoTier >= 12) {
    accessorySVG = `
      <path d="M 22 68 Q 6 54 16 44 Q 26 52 26 64 Z" fill="#ffffff" stroke="#5c3a21" stroke-width="2.5"/>
      <path d="M 98 68 Q 114 54 104 44 Q 94 52 94 64 Z" fill="#ffffff" stroke="#5c3a21" stroke-width="2.5"/>
    `;
  } else if (evoTier >= 9) {
    accessorySVG = `
      <path d="M 33 78 Q 60 88 87 78 L 84 88 Q 60 97 36 88 Z" fill="#ff6b6b" stroke="#5c3a21" stroke-width="2.5"/>
      <rect x="68" y="83" width="11" height="18" rx="4" fill="#fa5252" stroke="#5c3a21" stroke-width="2.5"/>
    `;
  } else if (evoTier >= 6) {
    accessorySVG = `
      <circle cx="80" cy="24" r="5" fill="#ff8787" stroke="#5c3a21" stroke-width="2"/>
      <circle cx="88" cy="28" r="5" fill="#ff8787" stroke="#5c3a21" stroke-width="2"/>
      <circle cx="84" cy="35" r="5" fill="#ff8787" stroke="#5c3a21" stroke-width="2"/>
      <circle cx="76" cy="31" r="5" fill="#ff8787" stroke="#5c3a21" stroke-width="2"/>
      <circle cx="82" cy="29" r="4" fill="#ffe066"/>
    `;
  } else if (evoTier >= 3) {
    accessorySVG = `
      <polygon points="60,23 48,16 50,28" fill="#ff6b81" stroke="#5c3a21" stroke-width="2.5" stroke-linejoin="round"/>
      <polygon points="60,23 72,16 70,28" fill="#ff6b81" stroke="#5c3a21" stroke-width="2.5" stroke-linejoin="round"/>
      <circle cx="60" cy="23" r="4" fill="#ff4757" stroke="#5c3a21" stroke-width="2"/>
    `;
  } else if (evoTier >= 1) {
    accessorySVG = `
      <path d="M 60 24 Q 60 15 68 12" stroke="#5c3a21" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      <ellipse cx="72" cy="12" rx="7" ry="4" transform="rotate(-20 72 12)" fill="#51cf66" stroke="#5c3a21" stroke-width="2"/>
    `;
  }

  let faceAndHandsSVG = '';

  if (mood === 'eating') {
    faceAndHandsSVG = `
      <path d="M 27 57 Q 21 63 27 69" stroke="#5c3a21" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      <path d="M 93 57 Q 99 63 93 69" stroke="#5c3a21" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      <line x1="15" y1="46" x2="21" y2="50" stroke="#f39c12" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="105" y1="46" x2="99" y2="50" stroke="#f39c12" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M 38 51 Q 44 45 50 51" stroke="#5c3a21" stroke-width="3" fill="none" stroke-linecap="round"/>
      <path d="M 70 51 Q 76 45 82 51" stroke="#5c3a21" stroke-width="3" fill="none" stroke-linecap="round"/>
      <ellipse cx="34" cy="61" rx="7" ry="4.5" fill="#ff8fa3" opacity="0.75"/>
      <ellipse cx="86" cy="61" rx="7" ry="4.5" fill="#ff8fa3" opacity="0.75"/>
      <ellipse cx="60" cy="56" rx="3.5" ry="2.5" fill="#ff8787"/>
      <path d="M 53 61 Q 56.5 65 60 61 Q 63.5 65 67 61" stroke="#5c3a21" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      <ellipse cx="60" cy="77" rx="9" ry="14" fill="#635852" stroke="#5c3a21" stroke-width="2.5"/>
      <path d="M 56 65 Q 54 77 56 89" stroke="#f1f3f5" stroke-width="2" fill="none"/>
      <path d="M 60 64 L 60 90" stroke="#f1f3f5" stroke-width="2"/>
      <path d="M 64 65 Q 66 77 64 89" stroke="#f1f3f5" stroke-width="2" fill="none"/>
      <ellipse cx="49" cy="77" rx="6" ry="5" fill="#ffc9c9" stroke="#5c3a21" stroke-width="2.5"/>
      <ellipse cx="71" cy="77" rx="6" ry="5" fill="#ffc9c9" stroke="#5c3a21" stroke-width="2.5"/>
    `;
  } else if (mood === 'worried') {
    faceAndHandsSVG = `
      <line x1="38" y1="44" x2="48" y2="41" stroke="#5c3a21" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="82" y1="44" x2="72" y2="41" stroke="#5c3a21" stroke-width="2.5" stroke-linecap="round"/>
      <circle cx="44" cy="52" r="5.5" fill="#3d2616"/>
      <circle cx="42.5" cy="50" r="2" fill="#ffffff"/>
      <circle cx="76" cy="52" r="5.5" fill="#3d2616"/>
      <circle cx="74.5" cy="50" r="2" fill="#ffffff"/>
      <path d="M 96 42 Q 100 48 96 51 Q 92 48 96 42 Z" fill="#74c0fc"/>
      <ellipse cx="34" cy="61" rx="6.5" ry="4" fill="#ff8fa3" opacity="0.65"/>
      <ellipse cx="86" cy="61" rx="6.5" ry="4" fill="#ff8fa3" opacity="0.65"/>
      <ellipse cx="60" cy="57" rx="3.5" ry="2.5" fill="#ff8787"/>
      <path d="M 54 65 Q 60 61 66 65" stroke="#5c3a21" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      <path d="M 46 73 Q 51 77 46 81" stroke="#5c3a21" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      <path d="M 74 73 Q 69 77 74 81" stroke="#5c3a21" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    `;
  } else if (mood === 'wink') {
    faceAndHandsSVG = `
      <line x1="15" y1="45" x2="21" y2="49" stroke="#f39c12" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="105" y1="45" x2="99" y2="49" stroke="#f39c12" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M 38 52 Q 44 47 50 52" stroke="#5c3a21" stroke-width="3" fill="none" stroke-linecap="round"/>
      <circle cx="76" cy="52" r="5.5" fill="#3d2616"/>
      <circle cx="74.5" cy="50" r="2" fill="#ffffff"/>
      <ellipse cx="34" cy="61" rx="7" ry="4.5" fill="#ff8fa3" opacity="0.75"/>
      <ellipse cx="86" cy="61" rx="7" ry="4.5" fill="#ff8fa3" opacity="0.75"/>
      <ellipse cx="60" cy="56" rx="3.5" ry="2.5" fill="#ff8787"/>
      <path d="M 53 60 Q 56.5 64 60 60 Q 63.5 64 67 60" stroke="#5c3a21" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      <path d="M 32 68 Q 26 54 36 52 Q 42 54 41 68" fill="#f5b062" stroke="#5c3a21" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M 72 74 Q 67 78 72 82" stroke="#5c3a21" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    `;
  } else {
    faceAndHandsSVG = `
      <circle cx="44" cy="51" r="5.8" fill="#3d2616"/>
      <circle cx="42" cy="49" r="2.2" fill="#ffffff"/>
      <circle cx="76" cy="51" r="5.8" fill="#3d2616"/>
      <circle cx="74" cy="49" r="2.2" fill="#ffffff"/>
      <ellipse cx="34" cy="60" rx="7" ry="4.5" fill="#ff8fa3" opacity="0.7"/>
      <ellipse cx="86" cy="60" rx="7" ry="4.5" fill="#ff8fa3" opacity="0.7"/>
      <ellipse cx="60" cy="56" rx="3.5" ry="2.5" fill="#ff8787"/>
      <path d="M 53 60 Q 56.5 64 60 60 Q 63.5 64 67 60" stroke="#5c3a21" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      <ellipse cx="60" cy="78" rx="8" ry="13" fill="#635852" stroke="#5c3a21" stroke-width="2.5"/>
      <path d="M 57 67 Q 55 78 57 89" stroke="#f1f3f5" stroke-width="1.8" fill="none"/>
      <path d="M 60 66 L 60 90" stroke="#f1f3f5" stroke-width="1.8"/>
      <path d="M 63 67 Q 65 78 63 89" stroke="#f1f3f5" stroke-width="1.8" fill="none"/>
      <ellipse cx="50" cy="78" rx="5.5" ry="4.5" fill="#ffc9c9" stroke="#5c3a21" stroke-width="2.5"/>
      <ellipse cx="70" cy="78" rx="5.5" ry="4.5" fill="#ffc9c9" stroke="#5c3a21" stroke-width="2.5"/>
    `;
  }

  return `
    <svg viewBox="0 0 120 120" class="hamster-svg-art">
      <circle cx="35" cy="31" r="12" fill="#f5b062" stroke="#5c3a21" stroke-width="3"/>
      <circle cx="35" cy="32" r="6.5" fill="#ffb8c6"/>
      <circle cx="85" cy="31" r="12" fill="#f5b062" stroke="#5c3a21" stroke-width="3"/>
      <circle cx="85" cy="32" r="6.5" fill="#ffb8c6"/>
      <path d="M 55 24 L 58 19 L 60 23 L 63 19 L 65 24" stroke="#5c3a21" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M 32 45 C 32 27, 88 27, 88 45 C 97 53, 98 66, 91 74 C 95 88, 86 102, 60 102 C 34 102, 25 88, 29 74 C 22 66, 23 53, 32 45 Z" fill="#f5b062" stroke="#5c3a21" stroke-width="3"/>
      <path d="M 43 56 C 43 49, 77 49, 77 56 C 84 63, 86 98, 60 98 C 34 98, 36 63, 43 56 Z" fill="#fff9eb"/>
      <ellipse cx="44" cy="103" rx="8" ry="4.5" fill="#ffc9c9" stroke="#5c3a21" stroke-width="2.5"/>
      <ellipse cx="76" cy="103" rx="8" ry="4.5" fill="#ffc9c9" stroke="#5c3a21" stroke-width="2.5"/>
      ${faceAndHandsSVG}
      ${accessorySVG}
    </svg>
  `;
}

function getHamsterScale(level) {
  const cappedLevel = Math.min(level || 1, 100);
  const evoTier = Math.floor(cappedLevel / 5);
  return (0.84 + evoTier * 0.019).toFixed(3);
}

/* ====================================================
   ホーム画面：カレンダー日付＆ハムスター更新
   ==================================================== */
function updateHomeCalendarAndPet() {
  const bundle = getMyPatientBundle();
  if (!bundle) return;
  const { patient, pet } = bundle;

  const today = new Date();
  const monthEl = document.getElementById('home-cal-month');
  const dayEl = document.getElementById('home-cal-day');
  if (monthEl) monthEl.textContent = `${today.getMonth() + 1}月`;
  if (dayEl) dayEl.textContent = today.getDate();

  const openingBadge = document.getElementById('opening-user-badge');
  if (openingBadge) openingBadge.textContent = `${patient.name} 様 専用`;

  const speechEl = document.getElementById('home-pet-speech');
  const homePetBody = document.getElementById('home-pet-body');

  const todayStr = getTodayStr();
  const todayEvents = (pet.events && pet.events[todayStr]) || [];
  const isMedTakenToday = (pet.medTakenDate === todayStr);

  const eventNames = todayEvents.map(ev => ev.title).join('・');
  let message = '';
  let homeMood = 'normal';

  if (todayEvents.length > 0 && !isMedTakenToday) {
    message = `今日の予定は「${eventNames}」があるよ！それと、まだ今日のお薬を飲んでいないよチュ！`;
    homeMood = 'worried';
  } else if (todayEvents.length > 0 && isMedTakenToday) {
    message = `今日の予定は「${eventNames}」があるよチュ！お薬も飲んでえらいのだ！`;
    homeMood = 'wink';
  } else if (todayEvents.length === 0 && !isMedTakenToday) {
    message = `まだ今日のお薬を飲んでいないよチュ！忘れずに飲もうね！`;
    homeMood = 'worried';
  } else {
    message = `今日のお薬はバッチリ飲んだね！予定はないからゆっくり過ごそうチュ！`;
    homeMood = 'wink';
  }

  if (speechEl) speechEl.textContent = message;
  if (homePetBody) {
    homePetBody.innerHTML = createCuteHamsterSVG(pet.level, homeMood);
    const scale = Math.min(parseFloat(getHamsterScale(pet.level)), 1.12);
    homePetBody.style.transform = `scale(${scale})`;
  }
}

/* ====================================================
   ペット育成 ＆ おしゃべり
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
      const bundle = getMyPatientBundle();
      if (!bundle) return;
      const { pet } = bundle;

      const cost = parseInt(card.getAttribute('data-cost'), 10);
      const expGain = parseInt(card.getAttribute('data-exp'), 10);
      const loveGain = parseInt(card.getAttribute('data-love') || '5', 10);
      const foodName = card.getAttribute('data-food');

      if (pet.coins >= cost) {
        const oldLevel = pet.level || 1;
        let newLevel = oldLevel;

        updateMyPetData(p => {
          p.coins -= cost;
          p.love = Math.min(100, (p.love || 0) + loveGain);
          p.exp = (p.exp || 0) + expGain;
          p.level = Math.floor(p.exp / 30) + 1;
          newLevel = p.level;
        });

        triggerTempPetMood('eating', 3500);
        updatePetDisplay();

        const oldEvo = Math.floor(Math.min(oldLevel, 100) / 5);
        const newEvo = Math.floor(Math.min(newLevel, 100) / 5);

        if (newEvo > oldEvo) {
          alert(`🎉 おめでとう！ Lv.${newLevel} に成長してハムスターの姿が変化しました！`);
        } else if (newLevel > oldLevel) {
          alert(`🎉 レベルアップ！ Lv.${newLevel} になりました！`);
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

      const tempBubble = appendChatBubble('考え中チュ...', 'pet');
      const reply = await fetchAIReply(text);
      tempBubble.textContent = reply;
      triggerTempPetMood('wink', 2500);
    };

    sendBtn.addEventListener('click', sendMessage);
    input.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });
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

async function callGroqModel(modelName, userText) {
  const bundle = getMyPatientBundle();
  const patientName = bundle ? bundle.patient.name : 'あなた';
  const level = bundle ? bundle.pet.level : 1;

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROQ_API_KEY.trim()}`
    },
    body: JSON.stringify({
      model: modelName,
      messages: [
        {
          role: 'system',
          content: `あなたは${patientName}さんを心から癒す可愛い相棒ハムスター（現在Lv.${level}）です。語尾に「チュ」「～のだ」をつけて、優しく丁寧な日本語（70文字以内）で返答してください。`
        },
        {
          role: 'user',
          content: userText
        }
      ],
      temperature: 0.7,
      max_tokens: 512
    })
  });

  if (!response.ok) throw new Error(`Groq API Error: ${response.status}`);
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty response');
  return content.trim();
}

async function fetchAIReply(userText) {
  if (GROQ_API_KEY && GROQ_API_KEY.trim() !== '') {
    try {
      return await callGroqModel('openai/gpt-oss-120b', userText);
    } catch (e) {
      try {
        return await callGroqModel('openai/gpt-oss-20b', userText);
      } catch (e2) {
        console.error('Groq API通信エラー:', e2);
      }
    }
  }
  return generateLevelBasedReply(userText);
}

function generateLevelBasedReply(text) {
  const bundle = getMyPatientBundle();
  const level = bundle ? (bundle.pet.level || 1) : 1;

  if (text.includes('天気') || text.includes('雨') || text.includes('晴れ') || text.includes('暑い') || text.includes('寒い')) {
    return '今日もお外の空気をすうと気持ちいいチュ！無理せず快適にお過ごしくださいね！';
  }
  if (text.includes('ご飯') || text.includes('ごはん') || text.includes('食べ') || text.includes('腹')) {
    return '美味しいものを食べると元気が湧いてくるチュ！僕にもひまわりの種をちょうだいね！';
  }
  if (text.includes('くすり') || text.includes('薬') || text.includes('時間')) {
    return 'お薬をしっかり飲んで素晴らしいチュ！健康が一番大切なのだ！';
  }
  if (text.includes('ありがと') || text.includes('感謝')) {
    return 'こちらこそいつも温かくしてくれてありがとうチュ！大好きだよ！';
  }
  if (text.includes('つかれた') || text.includes('しんどい') || text.includes('痛い')) {
    return '大丈夫チュ？無理は厳禁だよ。温かい飲み物を飲んでゆっくり休みましょうね。';
  }

  const pool = [
    `「${text}」って教えてくれてありがとうチュ！とっても嬉しいのだ！`,
    'お話できて楽しいチュ！今日も一緒にのんびり過ごそうね！',
    '計算テストも無理のないペースで楽しんでねチュ！'
  ];

  if (level >= 5) {
    pool.push('少しずつ大きくなってきた気がするチュ！いつもごはんをありがとうなのだ！');
  }
  if (level >= 15) {
    pool.push('あなたが笑顔でいてくれると、僕もほっぺが落ちそうなくらい幸せチュ！');
  }
  if (level >= 30) {
    pool.push('もうすっかり大親友だチュ！いつも一緒にお話しできて嬉しいのだ！');
  }

  return pool[Math.floor(Math.random() * pool.length)];
}

function updatePetDisplay() {
  const bundle = getMyPatientBundle();
  if (!bundle) return;
  const { pet } = bundle;

  const coinElem = document.getElementById('coin-count');
  const loveElem = document.getElementById('pet-love');
  const levelElem = document.getElementById('pet-level');
  const stageElem = document.getElementById('pet-stage-name');
  const petBody = document.getElementById('pet-character-body');
  const openingSlot = document.getElementById('opening-pet-slot');

  const level = pet.level || 1;
  if (coinElem) coinElem.textContent = pet.coins || 0;
  if (loveElem) loveElem.textContent = pet.love || 0;
  if (levelElem) levelElem.textContent = level;

  const currentLevelExp = (pet.exp || 0) % 30;
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

  let stageName = '赤ちゃんハム';
  if (level >= 100) stageName = '王様ハム（最大成長）';
  else if (level >= 75) stageName = 'ティアラハム';
  else if (level >= 60) stageName = 'エンジェルハム';
  else if (level >= 45) stageName = 'おしゃれハム';
  else if (level >= 30) stageName = 'お花見ハム';
  else if (level >= 15) stageName = 'リボンハム';
  else if (level >= 5) stageName = 'ふたばハム';

  if (stageElem) stageElem.textContent = stageName;

  const isMedTakenToday = (pet.medTakenDate === getTodayStr());
  const currentMood = petTempMood || (isMedTakenToday ? 'wink' : 'normal');

  if (petBody) {
    petBody.innerHTML = createCuteHamsterSVG(level, currentMood);
    petBody.style.transform = `scale(${getHamsterScale(level)})`;
  }

  if (openingSlot) {
    openingSlot.innerHTML = createCuteHamsterSVG(level, 'wink');
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
   計算ゲーム
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
      if (calcState.isChecking) return;
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
  const userVal = parseInt(uAns.textContent, 10);
  const correctAns = calcState.currentQuestion.ans;
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

  updateMyPetData(p => {
    p.coins = (p.coins || 0) + calcState.earnedCoins;
  });
  updatePetDisplay();

  document.getElementById('result-correct-count').textContent = calcState.correctCount;
  document.getElementById('result-earned-coins').textContent = calcState.earnedCoins;

  game.classList.add('hidden');
  result.classList.remove('hidden');
}

/* ====================================================
   服薬・生活データ（本人専用データのみ表示）
   ==================================================== */
function renderPatientData() {
  // 最新の薬剤師側データも毎回再取得する
  const bundle = getMyPatientBundle();
  if (!bundle) return;
  const { patient } = bundle;

  const nameElem = document.getElementById('patient-display-name');
  const idElem = document.getElementById('patient-display-id');
  if (nameElem) nameElem.textContent = `${patient.name} 様`;
  if (idElem) idElem.textContent = `患者ID: ${patient.id}`;

  const schedList = document.getElementById('schedule-list');
  if (schedList) {
    schedList.innerHTML = (patient.schedule || []).map(s =>
      `<li><span>${s.label}</span> <strong>${s.time}</strong></li>`
    ).join('');
  }

  const medList = document.getElementById('medicine-list');
  if (medList) {
    if (!patient.meds || patient.meds.length === 0) {
      medList.innerHTML = '<div class="med-item"><div class="med-instruction">現在登録されているお薬はありません</div></div>';
    } else {
      medList.innerHTML = patient.meds.map(m => {
        const timingStr = Array.isArray(m.timing) && m.timing.length > 0 ? m.timing.join('・') : '指定なし';
        const detailText = m.dosage ? `${timingStr} ／ ${m.dosage}` : timingStr;
        return `
          <div class="med-item">
            <div class="med-name">${m.name}</div>
            <div class="med-instruction">${detailText}</div>
          </div>
        `;
      }).join('');
    }
  }
}

function recordMedTaken() {
  updateMyPetData(p => {
    p.medTakenDate = getTodayStr();
  });
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
   カレンダー機能（本人IDごとに個別保存）
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
      updateMyPetData(p => {
        if (!p.events) p.events = {};
        if (!p.events[dateStr]) p.events[dateStr] = [];
        p.events[dateStr].push({ title, time, category });
      });

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
  const bundle = getMyPatientBundle();
  if (!bundle) return;
  const { pet } = bundle;

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
  const eventsMap = pet.events || {};

  for (let date = 1; date <= lastDate; date++) {
    const cell = document.createElement('div');
    cell.className = 'day-cell';
    cell.textContent = date;

    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(date).padStart(2, '0')}`;

    if (dateStr === todayStr) cell.classList.add('today');
    if (dateStr === calendarState.selectedDateStr) cell.classList.add('selected');

    if (eventsMap[dateStr] && eventsMap[dateStr].length > 0) {
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
  const bundle = getMyPatientBundle();
  if (!bundle) return;
  const { pet } = bundle;

  const eventsList = document.getElementById('selected-day-events');
  if (!eventsList) return;

  eventsList.innerHTML = '';
  const dateStr = calendarState.selectedDateStr;
  const dayEvents = (pet.events && pet.events[dateStr]) || [];

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
  updateMyPetData(p => {
    if (!p.events || !p.events[dateStr]) return;
    p.events[dateStr].splice(index, 1);
    if (p.events[dateStr].length === 0) delete p.events[dateStr];
  });

  updateHomeCalendarAndPet();
  renderCalendar();
  renderEvents();
};
