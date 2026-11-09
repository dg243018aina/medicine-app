// 初期データ
const defaultData = {
  coins: 11,
  love: 100,
  currentPatientId: 1,
  patients: [
    {
      id: 1,
      name: '眞野 宏太',
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

// localStorageからデータ読み込み
function getData() {
  const saved = localStorage.getItem('brain_med_app_data');
  return saved ? JSON.parse(saved) : defaultData;
}

function saveData(data) {
  localStorage.setItem('brain_med_app_data', JSON.stringify(data));
}

let appData = getData();
let state = {
  selectedOp: '+',
  selectedDiff: 'easy',
  currentQuestion: { a: 0, b: 0, ans: 0 }
};

document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initPetSystem();
  initCalcSystem();
  initAlarmSystem();
  renderPatientData();
});

function initNavigation() {
  document.querySelectorAll('[data-target]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const targetId = e.currentTarget.getAttribute('data-target');
      showScreen(targetId);
      if (targetId === 'screen-med') {
        appData = getData(); // 薬剤師が更新した可能性があるので再読み込み
        renderPatientData();
      }
    });
  });
}

function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(screenId).classList.add('active');
}

function initPetSystem() {
  const tabGohan = document.getElementById('tab-btn-gohan');
  const tabTalk = document.getElementById('tab-btn-talk');
  const contentGohan = document.getElementById('tab-content-gohan');
  const contentTalk = document.getElementById('tab-content-talk');

  tabGohan.addEventListener('click', () => {
    tabGohan.classList.add('active'); tabTalk.classList.remove('active');
    contentGohan.classList.add('active'); contentTalk.classList.remove('active');
  });

  tabTalk.addEventListener('click', () => {
    tabTalk.classList.add('active'); tabGohan.classList.remove('active');
    contentTalk.classList.add('active'); contentGohan.classList.remove('active');
  });

  document.querySelectorAll('.food-card').forEach(card => {
    card.addEventListener('click', () => {
      const cost = parseInt(card.getAttribute('data-cost'));
      const foodName = card.getAttribute('data-food');

      if (appData.coins >= cost) {
        appData.coins -= cost;
        appData.love = Math.min(100, appData.love + 5);
        saveData(appData);
        updatePetDisplay();
        alert(`ハムスターに${foodName}をあげました！`);
      } else {
        alert('コインがたりません！計算をしてコインを集めましょう。');
      }
    });
  });

  const input = document.getElementById('talk-input');
  const sendBtn = document.getElementById('talk-send-btn');
  const dialog = document.getElementById('pet-dialog');

  sendBtn.addEventListener('click', () => {
    const text = input.value.trim();
    if (text) {
      dialog.textContent = `「${text}」だね！お話してくれてありがとう！チュッ！`;
      input.value = '';
    }
  });
}

function updatePetDisplay() {
  document.getElementById('coin-count').textContent = appData.coins;
  document.getElementById('pet-love').textContent = appData.love;
}

function initCalcSystem() {
  const menu = document.getElementById('calc-menu');
  const game = document.getElementById('calc-game');
  const userAns = document.getElementById('user-answer');

  document.querySelectorAll('.calc-op-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.calc-op-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      state.selectedOp = e.target.getAttribute('data-op');
    });
  });

  document.querySelectorAll('.calc-diff-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.calc-diff-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      state.selectedDiff = e.target.getAttribute('data-diff');
    });
  });

  document.getElementById('start-calc-btn').addEventListener('click', () => {
    menu.classList.add('hidden'); game.classList.remove('hidden');
    generateQuestion();
  });

  document.getElementById('calc-quit-btn').addEventListener('click', () => {
    game.classList.add('hidden'); menu.classList.remove('hidden');
    userAns.textContent = '';
  });

  document.querySelectorAll('.num-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const val = e.target.textContent;
      if (val === 'C') userAns.textContent = '';
      else if (val === '確定') checkAnswer();
      else if (userAns.textContent.length < 4) userAns.textContent += val;
    });
  });
}

function generateQuestion() {
  let max = state.selectedDiff === 'mid' ? 50 : (state.selectedDiff === 'hard' ? 100 : 10);
  let a = Math.floor(Math.random() * max) + 1;
  let b = Math.floor(Math.random() * max) + 1;
  let ans = 0;

  if (state.selectedOp === '+') ans = a + b;
  if (state.selectedOp === '-') { if (a < b) [a, b] = [b, a]; ans = a - b; }
  if (state.selectedOp === '*') ans = a * b;
  if (state.selectedOp === '/') { ans = a; a = a * b; }

  state.currentQuestion = { a, b, ans, op: state.selectedOp };
  document.getElementById('question-text').textContent = `${a} ${state.selectedOp} ${b} = ?`;
  document.getElementById('user-answer').textContent = '';
}

function checkAnswer() {
  const userVal = parseInt(document.getElementById('user-answer').textContent);
  if (userVal === state.currentQuestion.ans) {
    appData.coins += 3;
    saveData(appData);
    updatePetDisplay();
    alert('正解です！ 💰 3コインを獲得しました！');
    generateQuestion();
  } else {
    alert('ざんねん！ちがうよ。もう一度やってみよう！');
    document.getElementById('user-answer').textContent = '';
  }
}

function renderPatientData() {
  const patient = appData.patients.find(p => p.id === appData.currentPatientId);
  if (!patient) return;

  document.getElementById('patient-display-name').textContent = `${patient.name} (${patient.age})`;
  
  const schedList = document.getElementById('schedule-list');
  schedList.innerHTML = patient.schedule.map(s => 
    `<li><span>${s.label}</span> <strong>${s.time}</strong></li>`
  ).join('');

  const medList = document.getElementById('medicine-list');
  medList.innerHTML = patient.meds.map(m => 
    `<div class="med-item">
      <div class="med-name">${m.name}</div>
      <div class="med-instruction">${m.instruction}</div>
    </div>`
  ).join('');
}

function initAlarmSystem() {
  const modal = document.getElementById('alarm-modal');
  document.getElementById('trigger-alarm-test-btn').addEventListener('click', () => modal.classList.remove('hidden'));
  document.getElementById('alarm-btn-yes').addEventListener('click', () => { modal.classList.add('hidden'); alert('のんだ記録を保存しました。'); });
  document.getElementById('alarm-btn-no').addEventListener('click', () => { modal.classList.add('hidden'); alert('再通知に設定しました。'); });
}
