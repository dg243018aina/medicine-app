// アプリの状態管理
const state = {
  coins: 11,
  love: 100,
  currentPatientId: 1,
  selectedOp: '+',
  selectedDiff: 'easy',
  currentQuestion: { a: 0, b: 0, ans: 0 },
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
    },
    {
      id: 2,
      name: '井上 翔流',
      age: 88,
      schedule: [
        { label: '朝ごはん', time: '8:00' },
        { label: '昼ごはん', time: '12:30' },
        { label: '晩ごはん', time: '18:30' }
      ],
      meds: [
        { name: 'アムロジピン', instruction: '朝食後 1錠' }
      ]
    }
  ]
};

// DOM要素取得
document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initPetSystem();
  initCalcSystem();
  initPharmacistSystem();
  initAlarmSystem();
  renderPatientData();
});

/* ================= 画面ナビゲーション ================= */
function initNavigation() {
  document.querySelectorAll('[data-target]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const targetId = e.currentTarget.getAttribute('data-target');
      showScreen(targetId);
    });
  });

  // 薬剤師モード切替ボタン
  const modeBtn = document.getElementById('mode-toggle-btn');
  modeBtn.addEventListener('click', () => {
    const currentActive = document.querySelector('.screen.active').id;
    if (currentActive === 'screen-pharmacist') {
      showScreen('screen-home');
      modeBtn.textContent = 'ver薬剤師';
    } else {
      showScreen('screen-pharmacist');
      modeBtn.textContent = '患者画面へ';
    }
  });
}

function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(screenId).classList.add('active');
}

/* ================= ペット育成 ＆ おしゃべり ================= */
function initPetSystem() {
  // タブ切替
  const tabGohan = document.getElementById('tab-btn-gohan');
  const tabTalk = document.getElementById('tab-btn-talk');
  const contentGohan = document.getElementById('tab-content-gohan');
  const contentTalk = document.getElementById('tab-content-talk');

  tabGohan.addEventListener('click', () => {
    tabGohan.classList.add('active');
    tabTalk.classList.remove('active');
    contentGohan.classList.add('active');
    contentTalk.classList.remove('active');
  });

  tabTalk.addEventListener('click', () => {
    tabTalk.classList.add('active');
    tabGohan.classList.remove('active');
    contentTalk.classList.add('active');
    contentGohan.classList.remove('active');
  });

  // ごはんをあげる
  document.querySelectorAll('.food-card').forEach(card => {
    card.addEventListener('click', () => {
      const cost = parseInt(card.getAttribute('data-cost'));
      const foodName = card.getAttribute('data-food');

      if (state.coins >= cost) {
        state.coins -= cost;
        state.love = Math.min(100, state.love + 5);
        updatePetDisplay();
        alert(`ハムスターに${foodName}をあげました！`);
      } else {
        alert('コインがたりません！計算をしてコインを集めましょう。');
      }
    });
  });

  // おしゃべり
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
  document.getElementById('coin-count').textContent = state.coins;
  document.getElementById('pet-love').textContent = state.love;
}

/* ================= 脳トレ計算ゲーム ================= */
function initCalcSystem() {
  const menu = document.getElementById('calc-menu');
  const game = document.getElementById('calc-game');
  const userAns = document.getElementById('user-answer');

  // 演算子選択
  document.querySelectorAll('.calc-op-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.calc-op-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      state.selectedOp = e.target.getAttribute('data-op');
    });
  });

  // 難易度選択
  document.querySelectorAll('.calc-diff-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.calc-diff-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      state.selectedDiff = e.target.getAttribute('data-diff');
    });
  });

  // ゲーム開始
  document.getElementById('start-calc-btn').addEventListener('click', () => {
    menu.classList.add('hidden');
    game.classList.remove('hidden');
    generateQuestion();
  });

  // 中途終了
  document.getElementById('calc-quit-btn').addEventListener('click', () => {
    game.classList.add('hidden');
    menu.classList.remove('hidden');
    userAns.textContent = '';
  });

  // テンキー入力
  document.querySelectorAll('.num-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const val = e.target.textContent;
      if (val === 'C') {
        userAns.textContent = '';
      } else if (val === '確定') {
        checkAnswer();
      } else {
        if (userAns.textContent.length < 4) {
          userAns.textContent += val;
        }
      }
    });
  });
}

function generateQuestion() {
  let max = 10;
  if (state.selectedDiff === 'mid') max = 50;
  if (state.selectedDiff === 'hard') max = 100;

  let a = Math.floor(Math.random() * max) + 1;
  let b = Math.floor(Math.random() * max) + 1;
  let ans = 0;

  if (state.selectedOp === '+') ans = a + b;
  if (state.selectedOp === '-') {
    if (a < b) [a, b] = [b, a];
    ans = a - b;
  }
  if (state.selectedOp === '*') ans = a * b;
  if (state.selectedOp === '/') {
    ans = a;
    a = a * b;
  }

  state.currentQuestion = { a, b, ans, op: state.selectedOp };
  document.getElementById('question-text').textContent = `${a} ${state.selectedOp} ${b} = ?`;
  document.getElementById('user-answer').textContent = '';
}

function checkAnswer() {
  const userVal = parseInt(document.getElementById('user-answer').textContent);
  if (userVal === state.currentQuestion.ans) {
    state.coins += 3;
    updatePetDisplay();
    alert('正解です！ 💰 3コインを獲得しました！');
    generateQuestion();
  } else {
    alert('ざんねん！ちがうよ。もう一度やってみよう！');
    document.getElementById('user-answer').textContent = '';
  }
}

/* ================= 患者データ・表示 ================= */
function renderPatientData() {
  const patient = state.patients.find(p => p.id === state.currentPatientId);
  if (!patient) return;

  document.getElementById('patient-display-name').textContent = `${patient.name} (${patient.age})`;

  // スケジュール描画
  const schedList = document.getElementById('schedule-list');
  schedList.innerHTML = patient.schedule.map(s => 
    `<li><span>${s.label}</span> <strong>${s.time}</strong></li>`
  ).join('');

  // お薬リスト描画
  const medList = document.getElementById('medicine-list');
  medList.innerHTML = patient.meds.map(m => 
    `<div class="med-item">
      <div class="med-name">${m.name}</div>
      <div class="med-instruction">${m.instruction}</div>
    </div>`
  ).join('');
}

/* ================= 薬剤師管理モード ================= */
function initPharmacistSystem() {
  renderPharmacistPatientList();

  const form = document.getElementById('add-med-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('input-med-name').value;
    const instruction = document.getElementById('input-med-instruction').value;

    const patient = state.patients.find(p => p.id === state.currentPatientId);
    if (patient) {
      patient.meds.push({ name, instruction });
      renderPatientData();
      alert(`${patient.name} 様にお薬を追加しました。`);
      form.reset();
    }
  });
}

function renderPharmacistPatientList() {
  const container = document.getElementById('pharmacist-patient-list');
  container.innerHTML = state.patients.map(p => `
    <div class="patient-card-item ${p.id === state.currentPatientId ? 'active' : ''}" data-id="${p.id}">
      ${p.name} (${p.age})
    </div>
  `).join('');

  container.querySelectorAll('.patient-card-item').forEach(item => {
    item.addEventListener('click', (e) => {
      state.currentPatientId = parseInt(e.currentTarget.getAttribute('data-id'));
      renderPharmacistPatientList();
      renderPatientData();
    });
  });
}

/* ================= 服薬アラーム ================= */
function initAlarmSystem() {
  const modal = document.getElementById('alarm-modal');
  const triggerBtn = document.getElementById('trigger-alarm-test-btn');
  const yesBtn = document.getElementById('alarm-btn-yes');
  const noBtn = document.getElementById('alarm-btn-no');

  triggerBtn.addEventListener('click', () => {
    modal.classList.remove('hidden');
  });

  yesBtn.addEventListener('click', () => {
    modal.classList.add('hidden');
    alert('お薬記録を「のんだ」として記録しました。');
  });

  noBtn.addEventListener('click', () => {
    modal.classList.add('hidden');
    alert('アラームを一時停止しました。時間をおいて再通知します。');
  });
}
