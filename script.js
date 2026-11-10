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
  ]
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

document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initPetSystem();
  initCalcSystem();
  initAlarmSystem();
  renderPatientData();
  updatePetDisplay();
});

function initNavigation() {
  // すべての data-target ボタン（はじめる、戻る、各メニューボタン）に一括対応
  document.querySelectorAll('[data-target]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const targetId = e.currentTarget.getAttribute('data-target');
      showScreen(targetId);
      if (targetId === 'screen-med') {
        appData = getData();
        renderPatientData();
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

  // チャット
  const input = document.getElementById('talk-input');
  const sendBtn = document.getElementById('talk-send-btn');
  if (sendBtn && input) {
    const sendMessage = () => {
      const text = input.value.trim();
      if (!text) return;
      appendChatBubble(text, 'user');
      input.value = '';
      const reply = generateLocalAIResponse(text);
      appendChatBubble(reply, 'pet');
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
        alert('リセットしました。');
      }
    });
  }
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

function generateLocalAIResponse(text) {
  const love = appData.love || 0;
  if (love < 30) {
    return "まだちょっと緊張してるチュ... ごはんをくれると仲良くなれる気がするのだ！";
  } else if (text.includes("元気") || text.includes("調子")) {
    return "とっても元気チュ！ご飯を食べるともっと元気になるのだ！";
  } else if (text.includes("くすり") || text.includes("薬")) {
    return "お薬をしっかり飲んでえらいチュ！健康一番なのだ！";
  } else if (text.includes("ありがと")) {
    return "こちらこそいつも優しくしてくれてありがとうチュ！";
  } else {
    const randomReplies = [
      `「${text}」なんだね！お話してくれてとっても嬉しいチュ！`,
      `今日もお散歩とお昼寝が楽しみチュ！`,
      `脳トレの計算、いっぱい解いてコインあつめようチュ！`
    ];
    return randomReplies[Math.floor(Math.random() * randomReplies.length)];
  }
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
