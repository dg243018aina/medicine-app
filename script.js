// ====== Gemini API 設定 ======
// ご自身のGemini APIキーを取得された場合は、下のダブルクォーテーション内に入力してください。
const GEMINI_API_KEY = ""; 

// 初期データ
const defaultData = {
  coins: 11,
  love: 0,
  exp: 0,
  level: 1,
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
  events: {} // カレンダー予定管理用データ構造を追加
};

function getData() {
  try {
    const saved = localStorage.getItem('brain_med_app_data');
    if (!saved) return defaultData;
    const data = JSON.parse(saved);
    data.exp = data.exp || 0;
    data.level = data.level || 1;
    data.coins = data.coins ?? 11;
    data.love = data.love ?? 0;
    data.events = data.events || {};
    return data;
  } catch (e) {
    return defaultData;
  }
}

function saveData(data) {
  localStorage.setItem('brain_med_app_data', JSON.stringify(data));
}

let appData = getData();

let calcState = {
  selectedOp: '+',
  selectedDiff: 'easy',
  currentQuestion: { a: 0, b: 0, ans: 0 },
  questionIndex: 0,
  correctCount: 0,
  earnedCoins: 0
};

// カレンダー管理用状態
let calendarState = {
  currentDate: new Date(),
  selectedDateStr: null
};

document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initPetSystem();
  initCalcSystem();
  initAlarmSystem();
  initCalendarSystem(); // カレンダーの初期化関数を追加
  renderPatientData();
  updatePetDisplay();
});

function initNavigation() {
  document.querySelectorAll('[data-target]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const targetId = e.currentTarget.getAttribute('data-target');
      showScreen(targetId);
      if (targetId === 'screen-med') {
        appData = getData();
        renderPatientData();
      } else if (targetId === 'screen-calendar') {
        renderCalendar();
      }
    });
  });
}

function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const targetElem = document.getElementById(screenId);
  if (targetElem) targetElem.classList.add('active');
}

/* ペット育成 */
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

  // ごはんをあげる
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
        appData.level = Math.floor(appData.exp / 50) + 1;

        saveData(appData);
        updatePetDisplay();

        if (appData.level > oldLevel) {
          alert(`🎉 ハムスターがレベルアップ！ Lv.${appData.level} に成長しました！`);
        } else {
          alert(`ハムスターに${foodName}をあげました！`);
        }
      } else {
        alert('コインが足りません！計算をしてコインを集めましょう。');
      }
    });
  });

  // おしゃべり機能（Gemini AI & 高度なローカル対話）
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
    };

    sendBtn.addEventListener('click', sendMessage);
    input.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });
  }

  // リセット
  const resetBtn = document.getElementById('reset-data-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (confirm('最初からやり直しますか？')) {
        localStorage.removeItem('brain_med_app_data');
        appData = defaultData;
        saveData(appData);
        updatePetDisplay();
        renderCalendar();
        alert('リセットしました。');
      }
    });
  }
}

// Gemini API / 多彩な会話エンジン呼び出し
async function fetchAIReply(userText) {
  if (GEMINI_API_KEY) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `あなたは高齢者の患者さんを心から癒す親切で可愛い相棒ハムスターです。語尾に「チュ」「～のだ」をつけて、優しくわかりやすい丁寧な日本語（70文字以内）で返答してください。質問: ${userText}`
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

  // APIキーが無い場合でも多様なおしゃべりができる高度なロジック
  return generateRichLocalAIResponse(userText);
}

function generateRichLocalAIResponse(text) {
  const love = appData.love || 0;

  if (love < 20) {
    return "まだちょっと緊張してるチュ... ごはんをくれるともっと仲良くなれる気がするのだ！";
  }

  if (text.includes("天気") || text.includes("雨") || text.includes("晴れ") || text.includes("暑い") || text.includes("寒い")) {
    return "今日もお外の空気をすうと気持ちいいチュ！無理せず快適にお過ごしくださいね！";
  }
  if (text.includes("ご飯") || text.includes("ごはん") || text.includes("食べ") || text.includes("腹")) {
    return "美味しいものを食べると元気が湧いてくるチュ！お腹いっぱい食べてね！";
  }
  if (text.includes("散歩") || text.includes("歩") || text.includes("運動")) {
    return "少し体を動かすと気分がすっきりするチュ！転ばないように気をつけてね！";
  }
  if (text.includes("元気") || text.includes("調子")) {
    return "とっても元気チュ！いつも話しかけてくれて本当にありがとうなのだ！";
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
  if (text.includes("名") || text.includes("誰") || text.includes("なまえ")) {
    return "僕はあなたの健康を応援するハムスターチュ！ずっと一緒だよ！";
  }

  const randomReplies = [
    `「${text}」って教えてくれてありがとうチュ！とっても興味深い話なのだ！`,
    `お話できてすごく楽しいチュ！次は何をしようか？`,
    `脳トレの計算テストも頑張って、ごほうびコインをあつめようチュ！`,
    `いつも優しく話しかけてくれて、心があたたかくなるチュ！`,
    `何か困ったことがあったら、看護師さんにも相談してね！`
  ];

  return randomReplies[Math.floor(Math.random() * randomReplies.length)];
}

function updatePetDisplay() {
  const coinElem = document.getElementById('coin-count');
  const loveElem = document.getElementById('pet-love');
  const levelElem = document.getElementById('pet-level');
  const stageElem = document.getElementById('pet-stage-name');
  const petBody = document.getElementById('pet-character-body');

  if (coinElem) coinElem.textContent = appData.coins || 0;
  if (loveElem) loveElem.textContent = appData.love || 0;
  
  const level = appData.level || 1;
  if (levelElem) levelElem.textContent = level;

  const currentLevelExp = (appData.exp || 0) % 50;
  const neededExp = 50 - currentLevelExp;
  const progressPercent = (currentLevelExp / 50) * 100;

  const barFill = document.getElementById('exp-bar-fill');
  const neededElem = document.getElementById('exp-needed');
  if (barFill) barFill.style.width = `${progressPercent}%`;
  if (neededElem) neededElem.textContent = neededExp;

  const stageNames = ['赤ちゃんハム', 'ヤングハム', 'おとなハム', 'ジャンボハム'];
  const stageIndex = Math.min(Math.floor((level - 1) / 2), 3);
  if (stageElem) stageElem.textContent = stageNames[stageIndex];

  if (petBody) {
    petBody.className = `pet-character-svg stage-${stageIndex + 1}`;
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

/* 計算ゲーム */
function initCalcSystem() {
  const menu = document.getElementById('calc-menu');
  const game = document.getElementById('calc-game');
  const result = document.getElementById('calc-result');
  const userAns = document.getElementById('user-answer');

  document.querySelectorAll('.calc-op-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.calc-op-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      calcState.selectedOp = e.target.getAttribute('data-op');
    });
  });

  document.querySelectorAll('.calc-diff-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.calc-diff-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      calcState.selectedDiff = e.target.getAttribute('data-diff');
    });
  });

  document.getElementById('start-calc-btn').addEventListener('click', () => {
    calcState.questionIndex = 0;
    calcState.correctCount = 0;
    calcState.earnedCoins = 0;
    menu.classList.add('hidden');
    result.classList.add('hidden');
    game.classList.remove('hidden');
    generateQuestion();
  });

  document.getElementById('calc-quit-btn').addEventListener('click', () => {
    game.classList.add('hidden');
    menu.classList.remove('hidden');
    if (userAns) userAns.textContent = '';
  });

  document.getElementById('calc-retry-btn').addEventListener('click', () => {
    result.classList.add('hidden');
    menu.classList.remove('hidden');
  });

  document.querySelectorAll('.num-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const val = e.target.textContent;
      if (val === '消す') { if (userAns) userAns.textContent = ''; }
      else if (val === '確定') submitAnswer();
      else if (userAns && userAns.textContent.length < 4) userAns.textContent += val;
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
  if (calcState.selectedOp === '*') ans = a * b;
  if (calcState.selectedOp === '/') { ans = a; a = a * b; }

  calcState.currentQuestion = { a, b, ans, op: calcState.selectedOp };
  
  document.getElementById('calc-progress-text').textContent = `第 ${calcState.questionIndex + 1} / 10 問`;
  document.getElementById('question-text').textContent = `${a} ${calcState.selectedOp} ${b} = ?`;
  document.getElementById('user-answer').textContent = '';
}

function submitAnswer() {
  const uAns = document.getElementById('user-answer');
  if (!uAns || uAns.textContent === '') return;
  
  const userVal = parseInt(uAns.textContent);
  if (userVal === calcState.currentQuestion.ans) {
    calcState.correctCount++;
    calcState.earnedCoins += 2;
  }

  calcState.questionIndex++;

  if (calcState.questionIndex < 10) {
    generateQuestion();
  } else {
    showCalcResult();
  }
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

/* 服薬・生活データ */
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

function initAlarmSystem() {
  const modal = document.getElementById('alarm-modal');
  const triggerBtn = document.getElementById('trigger-alarm-test-btn');
  const yesBtn = document.getElementById('alarm-btn-yes');
  const noBtn = document.getElementById('alarm-btn-no');

  if (triggerBtn) triggerBtn.addEventListener('click', () => modal.classList.remove('hidden'));
  if (yesBtn) yesBtn.addEventListener('click', () => { modal.classList.add('hidden'); alert('のんだ記録を保存しました。'); });
  if (noBtn) noBtn.addEventListener('click', () => { modal.classList.add('hidden'); alert('再通知に設定しました。'); });
}

/* ====================================================
   新規追加：カレンダー機能（描画・日付選択・予定登録・削除）
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

  // 前月の埋めスペース
  for (let i = 0; i < firstDay; i++) {
    const cell = document.createElement('div');
    cell.className = 'day-cell other-month';
    daysGrid.appendChild(cell);
  }

  // 当月の日付描画
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  for (let date = 1; date <= lastDate; date++) {
    const cell = document.createElement('div');
    cell.className = 'day-cell';
    cell.textContent = date;

    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(date).padStart(2, '0')}`;

    if (dateStr === todayStr) cell.classList.add('today');
    if (dateStr === calendarState.selectedDateStr) cell.classList.add('selected');

    // 予定ドットの表示
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
    eventsList.innerHTML = '<p class="empty-msg" style="font-size:12px;color:#888;">予定はありません</p>';
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

// 予定削除用関数（グローバル領域に登録）
window.deleteEvent = function(dateStr, index) {
  if (!appData.events[dateStr]) return;
  appData.events[dateStr].splice(index, 1);
  if (appData.events[dateStr].length === 0) delete appData.events[dateStr];
  
  saveData(appData);
  renderCalendar();
  renderEvents();
};
