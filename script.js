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

/* ===================================================
   日本の祝日判定（文化の日・勤労感謝の日・振替休日など）
=================================================== */
function getNthMonday(year, month1to12, nth) {
  const firstDayOfWeek = new Date(year, month1to12 - 1, 1).getDay();
  const offset = (1 - firstDayOfWeek + 7) % 7;
  return 1 + offset + (nth - 1) * 7;
}

function getVernalEquinoxDay(year) {
  return Math.floor(20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
}

function getAutumnalEquinoxDay(year) {
  return Math.floor(23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
}

function getBaseHolidayName(year, month, day) {
  if (month === 1 && day === 1) return '元日';
  if (month === 1 && day === getNthMonday(year, 1, 2)) return '成人の日';
  if (month === 2 && day === 11) return '建国記念の日';
  if (month === 2 && day === 23) return '天皇誕生日';
  if (month === 3 && day === getVernalEquinoxDay(year)) return '春分の日';
  if (month === 4 && day === 29) return '昭和の日';
  if (month === 5 && day === 3) return '憲法記念日';
  if (month === 5 && day === 4) return 'みどりの日';
  if (month === 5 && day === 5) return 'こどもの日';
  if (month === 7 && day === getNthMonday(year, 7, 3)) return '海の日';
  if (month === 8 && day === 11) return '山の日';
  if (month === 9 && day === getNthMonday(year, 9, 3)) return '敬老の日';
  if (month === 9 && day === getAutumnalEquinoxDay(year)) return '秋分の日';
  if (month === 10 && day === getNthMonday(year, 10, 2)) return 'スポーツの日';
  if (month === 11 && day === 3) return '文化の日';
  if (month === 11 && day === 23) return '勤労感謝の日';
  return null;
}

function getJapaneseHolidayName(year, month, day) {
  const base = getBaseHolidayName(year, month, day);
  if (base) return base;

  const dateObj = new Date(year, month - 1, day);
  const dow = dateObj.getDay();

  // 振替休日判定（日曜が祝日の場合の直後の平日）
  if (dow !== 0) {
    let prev = new Date(year, month - 1, day - 1);
    while (true) {
      const pBase = getBaseHolidayName(prev.getFullYear(), prev.getMonth() + 1, prev.getDate());
      if (!pBase) break;
      if (prev.getDay() === 0) return '振替休日';
      prev.setDate(prev.getDate() - 1);
    }
  }

  // 国民の休日（前日と翌日が祝日に挟まれた平日：例 2026年9月22日）
  const yesterday = new Date(year, month - 1, day - 1);
  const tomorrow = new Date(year, month - 1, day + 1);
  if (
    getBaseHolidayName(yesterday.getFullYear(), yesterday.getMonth() + 1, yesterday.getDate()) &&
    getBaseHolidayName(tomorrow.getFullYear(), tomorrow.getMonth() + 1, tomorrow.getDate())
  ) {
    return '国民の休日';
  }

  return null;
}

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

function saveImportedPatient(patientObj) {
  const shared = loadSharedMedData();
  const idx = shared.patients.findIndex(p => String(p.id).trim() === String(patientObj.id).trim());
  if (idx !== -1) {
    shared.patients[idx] = patientObj;
  } else {
    shared.patients.push(patientObj);
  }
  shared.currentPatientId = String(patientObj.id).trim();
  localStorage.setItem(SHARED_STORAGE_KEY, JSON.stringify(shared));
}

function extractSyncCode(rawText) {
  const trimmed = String(rawText || '').trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('MED:')) return trimmed;

  try {
    const urlObj = new URL(trimmed);
    const syncParam = urlObj.searchParams.get('sync');
    if (syncParam && syncParam.startsWith('MED:')) {
      return syncParam;
    }
  } catch (e) {
    // URLでない場合は無視
  }

  const match = trimmed.match(/MED:[A-Za-z0-9+/=]+/);
  return match ? match[0] : null;
}

function decodePatientSyncCode(rawText) {
  const syncCode = extractSyncCode(rawText);
  if (!syncCode) throw new Error('Invalid sync code');

  const raw = syncCode.slice(4);
  const binStr = atob(raw);
  const bytes = new Uint8Array(binStr.length);
  for (let i = 0; i < binStr.length; i++) {
    bytes[i] = binStr.charCodeAt(i);
  }
  const jsonStr = new TextDecoder().decode(bytes);
  return JSON.parse(jsonStr);
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
let activeQrScanner = null;
let activeQrWrapId = null;

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
  selectedDateStr: getTodayStr()
};

let homeCalState = {
  currentDate: new Date(),
  selectedDateStr: getTodayStr()
};

document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initIdLoginGate();
  initHomeGoogleCalendar();
  initPetSystem();
  initCalcSystem();
  initAlarmSystem();
  initCalendarSystem();
  initSyncUpdateModal();

  // QRコード等のURLパラメータ(?sync=MED:...)経由で開かれた場合の自動ログイン・最新更新
  const params = new URLSearchParams(window.location.search);
  const urlSync = params.get('sync');
  if (urlSync) {
    try {
      const imported = decodePatientSyncCode(urlSync);
      if (imported && imported.id && imported.name) {
        saveImportedPatient(imported);
        lockPatientId(imported.id);
      }
    } catch (e) {
      console.warn('URL連携コード読み込みエラー:', e);
    }
  }

  const lockedId = getLockedPatientId();
  const existingPatient = lockedId ? findPatientById(lockedId) : null;

  if (existingPatient) {
    refreshAllMyViews();
    showScreen('screen-opening');
  } else {
    showScreen('screen-id-login');
  }
});

window.addEventListener('storage', (e) => {
  if (e.key === SHARED_STORAGE_KEY && getLockedPatientId()) {
    refreshAllMyViews();
  }
});

window.addEventListener('focus', () => {
  if (getLockedPatientId()) {
    renderPatientData();
  }
});

/* ===================================================
   カメラQRコード読み取り共通制御
=================================================== */
function stopPatientQrScanner() {
  if (activeQrScanner) {
    const scannerRef = activeQrScanner;
    activeQrScanner = null;
    try {
      if (scannerRef.isScanning) {
        scannerRef.stop().then(() => scannerRef.clear()).catch(() => {});
      } else {
        scannerRef.clear();
      }
    } catch (e) {}
  }
  if (activeQrWrapId) {
    const wrap = document.getElementById(activeQrWrapId);
    if (wrap) wrap.classList.add('hidden');
    activeQrWrapId = null;
  }
}

function startPatientQrScanner(readerElemId, wrapElemId, onDecodedSuccess) {
  if (typeof Html5Qrcode === 'undefined') {
    alert('QRコードカメラ機能を読み込み中です。少し待ってからもう一度押してください。');
    return;
  }

  stopPatientQrScanner();

  const wrap = document.getElementById(wrapElemId);
  if (wrap) wrap.classList.remove('hidden');
  activeQrWrapId = wrapElemId;

  const scanner = new Html5Qrcode(readerElemId);
  activeQrScanner = scanner;

  scanner.start(
    { facingMode: 'environment' },
    { fps: 10, qrbox: { width: 210, height: 210 } },
    (decodedText) => {
      stopPatientQrScanner();
      onDecodedSuccess(decodedText);
    },
    () => {}
  ).catch(err => {
    stopPatientQrScanner();
    alert('カメラを起動できませんでした。ブラウザのカメラ許可を確認してください。\n(' + err + ')');
  });
}

function applySyncedQrData(rawText) {
  const imported = decodePatientSyncCode(rawText);
  if (!imported || !imported.id || !imported.name) {
    throw new Error('患者データが含まれていません');
  }
  saveImportedPatient(imported);
  lockPatientId(imported.id);
  refreshAllMyViews();
  return imported;
}

function initIdLoginGate() {
  const form = document.getElementById('patient-id-login-form');
  const input = document.getElementById('login-patient-id-input');
  const errorEl = document.getElementById('id-login-error');
  const qrBtn = document.getElementById('login-qr-scan-btn');
  const qrStopBtn = document.getElementById('login-qr-stop-btn');

  if (qrBtn) {
    qrBtn.addEventListener('click', () => {
      if (errorEl) errorEl.classList.add('hidden');
      startPatientQrScanner('login-qr-reader', 'login-qr-reader-wrap', (decodedText) => {
        try {
          const imported = applySyncedQrData(decodedText);
          alert(`${imported.name} 様のデータを読み込みました！`);
          showScreen('screen-opening');
        } catch (err) {
          if (errorEl) {
            errorEl.textContent = '薬剤師画面の患者連携QRコードを読み取ってください。';
            errorEl.classList.remove('hidden');
          }
        }
      });
    });
  }

  if (qrStopBtn) {
    qrStopBtn.addEventListener('click', stopPatientQrScanner);
  }

  if (!form || !input) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    stopPatientQrScanner();
    const entered = input.value.trim();
    if (!entered) return;

    let matchedPatient = null;

    if (extractSyncCode(entered)) {
      try {
        matchedPatient = applySyncedQrData(entered);
      } catch (err) {
        errorEl.textContent = '連携コードが正しくありません。上の「カメラでQRコードを読み取る」をお試しください。';
        errorEl.classList.remove('hidden');
        return;
      }
    } else {
      matchedPatient = findPatientById(entered);
    }

    if (!matchedPatient) {
      errorEl.textContent = `ID「${entered}」が見つかりません。上の「カメラでQRコードを読み取る」で薬剤師画面のQRを映してください。`;
      errorEl.classList.remove('hidden');
      return;
    }

    errorEl.classList.add('hidden');
    lockPatientId(matchedPatient.id);
    refreshAllMyViews();
    showScreen('screen-opening');
  });
}

function initSyncUpdateModal() {
  const openBtn = document.getElementById('open-sync-update-btn');
  const closeBtn = document.getElementById('close-sync-update-btn');
  const modal = document.getElementById('sync-update-modal');
  const form = document.getElementById('sync-update-form');
  const input = document.getElementById('sync-update-input');
  const errorEl = document.getElementById('sync-update-error');
  const startQrBtn = document.getElementById('start-sync-qr-btn');
  const stopQrBtn = document.getElementById('stop-sync-qr-btn');

  if (!openBtn || !modal || !form) return;

  openBtn.addEventListener('click', () => {
    renderPatientData();
    if (input) input.value = '';
    if (errorEl) errorEl.classList.add('hidden');
    modal.classList.remove('hidden');
  });

  const closeModalAndCamera = () => {
    stopPatientQrScanner();
    modal.classList.add('hidden');
  };

  if (closeBtn) closeBtn.addEventListener('click', closeModalAndCamera);
  if (stopQrBtn) stopQrBtn.addEventListener('click', stopPatientQrScanner);

  if (startQrBtn) {
    startQrBtn.addEventListener('click', () => {
      if (errorEl) errorEl.classList.add('hidden');
      startPatientQrScanner('sync-qr-reader', 'sync-qr-reader-wrap', (decodedText) => {
        try {
          const imported = applySyncedQrData(decodedText);
          modal.classList.add('hidden');
          alert(`✅ ${imported.name} 様の最新のお薬データに更新・保存しました！`);
        } catch (err) {
          if (errorEl) {
            errorEl.textContent = 'QRコードの読み取りに失敗しました。薬剤師画面のQRをもう一度映してください。';
            errorEl.classList.remove('hidden');
          }
        }
      });
    });
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const code = input.value.trim();
    if (!extractSyncCode(code)) {
      errorEl.textContent = '「MED:」から始まる連携コードを入力するか、上のカメラでQRを読み取ってください。';
      errorEl.classList.remove('hidden');
      return;
    }

    try {
      const imported = applySyncedQrData(code);
      closeModalAndCamera();
      alert(`✅ ${imported.name} 様の最新のお薬データに更新・保存しました！`);
    } catch (err) {
      errorEl.textContent = 'コードの読み込みに失敗しました。コピーし直してください。';
      errorEl.classList.remove('hidden');
    }
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
      if (targetId === 'screen-id-login') return;

      stopPatientQrScanner();
      showScreen(targetId);
      if (targetId === 'screen-home') {
        updateHomeCalendarAndPet();
      } else if (targetId === 'screen-med') {
        renderPatientData();
      } else if (targetId === 'screen-calendar') {
        calendarState.selectedDateStr = homeCalState.selectedDateStr || getTodayStr();
        calendarState.currentDate = new Date(homeCalState.currentDate);
        updateSelectedDateHeader(calendarState.selectedDateStr);
        renderCalendar();
        renderEvents();
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

/* ===================================================
   ホーム画面のGoogleカレンダー風ウィジェット（祝日・色・絵文字対応）
=================================================== */
function initHomeGoogleCalendar() {
  const prevBtn = document.getElementById('home-gcal-prev');
  const nextBtn = document.getElementById('home-gcal-next');

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      homeCalState.currentDate.setMonth(homeCalState.currentDate.getMonth() - 1);
      renderHomeGoogleCalendar();
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      homeCalState.currentDate.setMonth(homeCalState.currentDate.getMonth() + 1);
      renderHomeGoogleCalendar();
    });
  }
}

function getDefaultColorForCategory(category) {
  if (!category) return '#1a73e8';
  if (category.includes('🏥')) return '#d93025';
  if (category.includes('💊')) return '#0b8043';
  if (category.includes('🦷')) return '#039be5';
  if (category.includes('🛒')) return '#f4511e';
  if (category.includes('🎂')) return '#8e24aa';
  return '#1a73e8';
}

function renderHomeGoogleCalendar() {
  const bundle = getMyPatientBundle();
  if (!bundle) return;
  const { pet } = bundle;

  const titleEl = document.getElementById('home-gcal-title');
  const gridEl = document.getElementById('home-gcal-grid');
  if (!titleEl || !gridEl) return;

  const year = homeCalState.currentDate.getFullYear();
  const month = homeCalState.currentDate.getMonth();
  titleEl.textContent = `${year}年 ${month + 1}月`;

  gridEl.innerHTML = '';

  const firstDay = new Date(year, month, 1).getDay();
  const lastDate = new Date(year, month + 1, 0).getDate();
  const totalCells = Math.ceil((firstDay + lastDate) / 7) * 7;

  const todayStr = getTodayStr();
  const eventsMap = pet.events || {};

  for (let i = 0; i < totalCells; i++) {
    const cell = document.createElement('div');
    const dayOfWeek = i % 7;
    cell.className = 'gcal-cell';
    if (dayOfWeek === 0) cell.classList.add('sun');
    if (dayOfWeek === 6) cell.classList.add('sat');

    const dateNum = i - firstDay + 1;
    if (dateNum < 1 || dateNum > lastDate) {
      cell.classList.add('other-month');
      gridEl.appendChild(cell);
      continue;
    }

    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dateNum).padStart(2, '0')}`;
    const holidayName = getJapaneseHolidayName(year, month + 1, dateNum);

    if (holidayName) cell.classList.add('holiday');
    if (dateStr === todayStr) cell.classList.add('today');
    if (dateStr === homeCalState.selectedDateStr) cell.classList.add('selected');

    const numSpan = document.createElement('div');
    numSpan.className = 'gcal-day-num';
    numSpan.textContent = dateNum;
    cell.appendChild(numSpan);

    if (holidayName) {
      const holEl = document.createElement('div');
      holEl.className = 'gcal-holiday-text';
      holEl.textContent = holidayName;
      cell.appendChild(holEl);
    }

    const dayEvents = eventsMap[dateStr] || [];
    const maxChips = holidayName ? 1 : 2;
    dayEvents.slice(0, maxChips).forEach(ev => {
      const chip = document.createElement('div');
      chip.className = 'gcal-event-chip';
      chip.style.backgroundColor = ev.color || getDefaultColorForCategory(ev.category);
      const emojiPrefix = ev.category ? `${ev.category} ` : '';
      chip.textContent = `${emojiPrefix}${ev.title}`;
      cell.appendChild(chip);
    });

    cell.addEventListener('click', () => {
      homeCalState.selectedDateStr = dateStr;
      renderHomeGoogleCalendar();
      updateHomePetSpeechForDate(dateStr);
    });

    gridEl.appendChild(cell);
  }
}

function updateHomePetSpeechForDate(dateStr) {
  const bundle = getMyPatientBundle();
  if (!bundle) return;
  const { pet } = bundle;

  const speechEl = document.getElementById('home-pet-speech');
  const homePetBody = document.getElementById('home-pet-body');
  if (!speechEl) return;

  const todayStr = getTodayStr();
  const isMedTakenToday = (pet.medTakenDate === todayStr);
  const events = (pet.events && pet.events[dateStr]) || [];
  const eventNames = events.map(ev => `${ev.category || ''}${ev.time ? ev.time + ' ' : ''}${ev.title}`).join('・');

  const [yStr, mStr, dStr] = dateStr.split('-');
  const holidayName = getJapaneseHolidayName(Number(yStr), Number(mStr), Number(dStr));
  const holidayPrefix = holidayName ? `【${holidayName}】` : '';

  let message = '';
  let homeMood = 'normal';

  if (dateStr === todayStr) {
    if (events.length > 0 && !isMedTakenToday) {
      message = `${holidayPrefix}今日の予定は「${eventNames}」だよ！まだお薬を飲んでいないよチュ！`;
      homeMood = 'worried';
    } else if (events.length > 0 && isMedTakenToday) {
      message = `${holidayPrefix}今日の予定は「${eventNames}」だよチュ！お薬も飲んでえらいのだ！`;
      homeMood = 'wink';
    } else if (events.length === 0 && !isMedTakenToday) {
      message = `${holidayPrefix}まだ今日のお薬を飲んでいないよチュ！忘れずに飲もうね！`;
      homeMood = 'worried';
    } else {
      message = `${holidayPrefix}今日のお薬はバッチリ飲んだね！ゆっくり過ごそうチュ！`;
      homeMood = 'wink';
    }
  } else {
    const dateLabel = `${Number(mStr)}月${Number(dStr)}日`;
    if (events.length > 0) {
      message = `${dateLabel}${holidayPrefix}の予定は「${eventNames}」が入っているよチュ！`;
      homeMood = 'wink';
    } else if (holidayName) {
      message = `${dateLabel}は「${holidayName}」でお休みだよチュ！予定があれば右上の「＋予定管理」から追加してね！`;
      homeMood = 'wink';
    } else {
      message = `${dateLabel}の予定はまだないよチュ！右上の「＋予定管理」から追加できるのだ！`;
      homeMood = 'normal';
    }
  }

  speechEl.textContent = message;
  if (homePetBody) {
    homePetBody.innerHTML = createCuteHamsterSVG(pet.level, homeMood);
  }
}

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

function updateHomeCalendarAndPet() {
  const bundle = getMyPatientBundle();
  if (!bundle) return;
  const { patient } = bundle;

  const openingBadge = document.getElementById('opening-user-badge');
  if (openingBadge) openingBadge.textContent = `${patient.name} 様 専用`;

  renderHomeGoogleCalendar();
  updateHomePetSpeechForDate(homeCalState.selectedDateStr || getTodayStr());
}

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

function renderPatientData() {
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
        const newTag = m.isNewlyAdded ? '<span class="new-med-tag">NEW</span>' : '';
        return `
          <div class="med-item">
            <div class="med-name">${m.name}${newTag}</div>
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

/* ===================================================
   詳細カレンダー ＆ 予定追加（色選択・祝日表示）
=================================================== */
function updateSelectedDateHeader(dateStr) {
  const label = document.getElementById('selected-date-label');
  const holBadge = document.getElementById('selected-holiday-badge');
  if (label) label.textContent = `${dateStr} の予定`;

  if (holBadge) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const holidayName = getJapaneseHolidayName(y, m, d);
    if (holidayName) {
      holBadge.textContent = `🎌 ${holidayName}`;
      holBadge.classList.remove('hidden');
    } else {
      holBadge.classList.add('hidden');
    }
  }
}

function setSelectedEventColor(hexColor) {
  const hiddenInput = document.getElementById('event-color');
  if (hiddenInput) hiddenInput.value = hexColor;
  document.querySelectorAll('#event-color-picker .color-swatch').forEach(btn => {
    if (btn.getAttribute('data-color') === hexColor) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

function initCalendarSystem() {
  const prevBtn = document.getElementById('prev-month-btn');
  const nextBtn = document.getElementById('next-month-btn');
  const openModalBtn = document.getElementById('open-add-event-btn');
  const closeModalBtn = document.getElementById('close-event-modal-btn');
  const eventForm = document.getElementById('event-form');
  const eventModal = document.getElementById('event-modal');
  const categorySelect = document.getElementById('event-category');

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

  if (categorySelect) {
    categorySelect.addEventListener('change', () => {
      const selectedOpt = categorySelect.options[categorySelect.selectedIndex];
      const defColor = selectedOpt ? selectedOpt.getAttribute('data-default-color') : null;
      if (defColor) setSelectedEventColor(defColor);
    });
  }

  document.querySelectorAll('#event-color-picker .color-swatch').forEach(btn => {
    btn.addEventListener('click', () => {
      const color = btn.getAttribute('data-color');
      if (color) setSelectedEventColor(color);
    });
  });

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
      const colorInput = document.getElementById('event-color');

      const title = titleInput.value.trim();
      const time = timeInput ? timeInput.value : '';
      const category = categorySelect ? categorySelect.value : '✏️';
      const color = colorInput ? colorInput.value : getDefaultColorForCategory(category);

      const dateStr = calendarState.selectedDateStr;
      updateMyPetData(p => {
        if (!p.events) p.events = {};
        if (!p.events[dateStr]) p.events[dateStr] = [];
        p.events[dateStr].push({ title, time, category, color });
      });

      homeCalState.selectedDateStr = dateStr;
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
    const dow = (firstDay + date - 1) % 7;
    cell.className = 'day-cell';
    if (dow === 0) cell.classList.add('sun');
    if (dow === 6) cell.classList.add('sat');
    cell.textContent = date;

    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
    const holidayName = getJapaneseHolidayName(year, month + 1, date);

    if (holidayName) cell.classList.add('holiday');
    if (dateStr === todayStr) cell.classList.add('today');
    if (dateStr === calendarState.selectedDateStr) cell.classList.add('selected');

    if (eventsMap[dateStr] && eventsMap[dateStr].length > 0) {
      const dot = document.createElement('div');
      dot.className = 'event-dot';
      dot.style.backgroundColor = eventsMap[dateStr][0].color || '#2f9e44';
      cell.appendChild(dot);
    }

    cell.addEventListener('click', () => {
      calendarState.selectedDateStr = dateStr;
      homeCalState.selectedDateStr = dateStr;
      updateSelectedDateHeader(dateStr);
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
    const dotColor = ev.color || getDefaultColorForCategory(ev.category);
    item.innerHTML = `
      <span>
        <span class="event-color-dot" style="background:${dotColor};"></span>
        ${ev.category || ''} ${ev.time ? ev.time + ' ' : ''}${ev.title}
      </span>
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
