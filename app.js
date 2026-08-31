// LEET Interactive Training Platform Engine v3.0
// Features: Multi-Year Selection, Drag Slider, Full Paper Exam Mode, Question Memo & Wrong Notes Review, 3in1 Sets, LocalStorage Persistence, Safe Random Shuffle, Keyboard Shortcuts, Touch Swipe

class LeetApp {
  constructor() {
    this.rawSets = [];
    this.filteredSets = [];
    this.currentSetIndex = 0;
    this.activeQuestionIndex = 0;
    
    // View state: 'home' or 'exam'
    this.currentView = 'home';
    
    // Exam mode: 'set' (Set-by-Set) or 'full' (Full Exam Paper)
    this.examMode = 'set';
    
    // Mobile Tab state: 'passage' or 'questions'
    this.mobileTab = 'passage';
    
    // Layout orientation: 'left' (passage on left) or 'right' (passage on right)
    this.passageSide = 'left';
    
    // Filter state
    this.selectedSubject = '언어이해'; // 'all', '언어이해', '추리논증'
    this.selectedYears = ['2026', '2025', '2024', '2023', '2022', '2021', '2020', '2019', '2018', '2017', '2016', '2015', '2014', '2013', '2012', '2011', '2010', '2009'];
    this.selectedLimit = '5'; // '1', '3', '5', '10', '20', 'all'
    this.isShuffled = false;
    this.onlyWrongMode = false;
    
    // User progress state (Persisted in LocalStorage)
    this.userAnswers = {}; // { qId: optionNum (1..5) }
    this.checkedSets = {}; // { setId: boolean }
    this.wrongHistory = {}; // { qId: { qId, setId, year, subject, qNum, tag, userAns, correctAns, timestamp } }
    this.userMemos = {}; // { qId: memoString }
    this.isExamSubmitted = false;
    
    // UI states
    this.fontSize = 'md';
    this.isHighlighterActive = false;
    this.currentHighlightColor = 'yellow';
    this.openMemos = new Set(); // qIds of currently expanded memo boxes
    
    // Timer state
    this.timerSeconds = 0;
    this.timerCountdown = false;
    this.timerInterval = null;
    this.isTimerRunning = false;
    
    // Resizer state
    this.isDraggingResizer = false;
    
    this.STORAGE_KEYS = {
      ANSWERS: 'LEET_USER_ANSWERS_V3',
      CHECKED: 'LEET_CHECKED_SETS_V3',
      WRONG: 'LEET_WRONG_HISTORY_V3',
      MEMOS: 'LEET_USER_MEMOS_V3',
      SETTINGS: 'LEET_SETTINGS_V3'
    };
    
    this.init();
  }

  init() {
    this.loadFromStorage();
    
    if (window.LEET_DATABASE) {
      this.rawSets = Array.isArray(window.LEET_DATABASE) ? window.LEET_DATABASE : (window.LEET_DATABASE.sets || []);
      this.initUI();
    } else {
      fetch('./data/leet_database.json')
        .then(res => res.json())
        .then(data => {
          this.rawSets = Array.isArray(data) ? data : (data.sets || []);
          this.initUI();
        })
        .catch(err => {
          console.error('Failed to load database:', err);
          alert('데이터베이스를 불러오는 중 오류가 발생했습니다.');
        });
    }
  }

  // --- LOCALSTORAGE PERSISTENCE ---
  loadFromStorage() {
    try {
      const savedAnswers = localStorage.getItem(this.STORAGE_KEYS.ANSWERS);
      if (savedAnswers) this.userAnswers = JSON.parse(savedAnswers);

      const savedChecked = localStorage.getItem(this.STORAGE_KEYS.CHECKED);
      if (savedChecked) this.checkedSets = JSON.parse(savedChecked);

      const savedWrong = localStorage.getItem(this.STORAGE_KEYS.WRONG);
      if (savedWrong) this.wrongHistory = JSON.parse(savedWrong);

      const savedMemos = localStorage.getItem(this.STORAGE_KEYS.MEMOS);
      if (savedMemos) this.userMemos = JSON.parse(savedMemos);

      const savedSettings = localStorage.getItem(this.STORAGE_KEYS.SETTINGS);
      if (savedSettings) {
        const s = JSON.parse(savedSettings);
        if (s.subject) this.selectedSubject = s.subject;
        if (s.years && Array.isArray(s.years)) this.selectedYears = s.years;
        if (s.limit) this.selectedLimit = s.limit;
        if (s.mode) this.examMode = s.mode;
        if (s.fontSize) this.fontSize = s.fontSize;
        if (s.passageSide) this.passageSide = s.passageSide;
      }
    } catch (e) {
      console.warn('LocalStorage load failed:', e);
    }
  }

  saveToStorage() {
    try {
      localStorage.setItem(this.STORAGE_KEYS.ANSWERS, JSON.stringify(this.userAnswers));
      localStorage.setItem(this.STORAGE_KEYS.CHECKED, JSON.stringify(this.checkedSets));
      localStorage.setItem(this.STORAGE_KEYS.WRONG, JSON.stringify(this.wrongHistory));
      localStorage.setItem(this.STORAGE_KEYS.MEMOS, JSON.stringify(this.userMemos));
      localStorage.setItem(this.STORAGE_KEYS.SETTINGS, JSON.stringify({
        subject: this.selectedSubject,
        years: this.selectedYears,
        limit: this.selectedLimit,
        mode: this.examMode,
        fontSize: this.fontSize,
        passageSide: this.passageSide
      }));
    } catch (e) {
      console.warn('LocalStorage save failed:', e);
    }
  }

  initUI() {
    this.renderHomeMultiYearChips();
    this.updateSliderMetrics();
    this.bindEvents();
    this.syncSavedSettingsToUI();
    this.updateHomeDashboard();
    this.showView('home');
  }

  // --- HOME MULTI-YEAR SELECTION ---
  renderHomeMultiYearChips() {
    const container = document.getElementById('homeMultiYearChips');
    if (!container) return;
    
    const allYears = Array.from({length: 18}, (_, i) => String(2026 - i));
    
    container.innerHTML = allYears.map(yr => {
      const isSelected = this.selectedYears.includes(yr);
      const selClass = isSelected ? 'selected bg-indigo-600 text-white border-indigo-500 shadow-sm font-bold' : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-slate-200';
      return `<button data-year="${yr}" class="multi-year-chip px-3 py-1.5 rounded-xl text-xs border transition ${selClass}">${yr}년</button>`;
    }).join('');

    this.updateSelectedYearsCountBadge();
  }

  updateSelectedYearsCountBadge() {
    const badge = document.getElementById('selectedYearsCountText');
    if (!badge) return;
    if (this.selectedYears.length === 18) {
      badge.textContent = '전체 18개년 선택됨';
      badge.className = 'text-indigo-400 font-bold';
    } else if (this.selectedYears.length === 0) {
      badge.textContent = '선택된 연도 없음 (선택 필요)';
      badge.className = 'text-rose-400 font-bold';
    } else {
      badge.textContent = `${this.selectedYears.length}개년 (${this.selectedYears.slice(0, 3).join(', ')}${this.selectedYears.length > 3 ? '...' : ''})`;
      badge.className = 'text-white font-bold';
    }
  }

  // --- SLIDER METRICS ---
  updateSliderMetrics() {
    const slider = document.getElementById('homeLimitSlider');
    const badge = document.getElementById('sliderMetricBadge');
    if (!slider || !badge) return;

    const val = parseInt(slider.value);
    this.selectedLimit = String(val);
    const estQ = val * 3;
    const estMin = Math.round(estQ * 2.5);

    badge.innerHTML = `⚡ <strong>${val}세트</strong> (약 ${estQ}문항 · 예상 ${estMin}분)`;
  }

  showView(viewName) {
    this.currentView = viewName;
    const homeView = document.getElementById('homeView');
    const examView = document.getElementById('examView');

    if (viewName === 'home') {
      if (homeView) homeView.classList.remove('hidden');
      if (examView) examView.classList.add('hidden');
      this.pauseTimer();
      this.updateHomeDashboard();
    } else {
      if (homeView) homeView.classList.add('hidden');
      if (examView) examView.classList.remove('hidden');
      this.applyFilters();
      this.startTimer();
      this.setMobileTab('passage');
    }
  }

  setMobileTab(tab) {
    this.mobileTab = tab;
    const passageBtn = document.getElementById('mobileTabPassage');
    const questionsBtn = document.getElementById('mobileTabQuestions');
    const passagePane = document.getElementById('passagePane');
    const questionsPane = document.getElementById('questionsPane');

    if (tab === 'passage') {
      if (passageBtn) passageBtn.classList.add('active');
      if (questionsBtn) questionsBtn.classList.remove('active');
      if (passagePane) {
        passagePane.classList.remove('mobile-pane-hidden');
        passagePane.classList.add('mobile-pane-visible');
      }
      if (questionsPane) {
        questionsPane.classList.remove('mobile-pane-visible');
        questionsPane.classList.add('mobile-pane-hidden');
      }
    } else {
      if (questionsBtn) questionsBtn.classList.add('active');
      if (passageBtn) passageBtn.classList.remove('active');
      if (questionsPane) {
        questionsPane.classList.remove('mobile-pane-hidden');
        questionsPane.classList.add('mobile-pane-visible');
      }
      if (passagePane) {
        passagePane.classList.remove('mobile-pane-visible');
        passagePane.classList.add('mobile-pane-hidden');
      }
    }
  }

  updateHomeDashboard() {
    let totalQuestions = 0;
    let answeredCount = 0;
    let correctCount = 0;

    this.rawSets.forEach(s => {
      s.questions.forEach(q => {
        totalQuestions++;
        const ans = this.userAnswers[q.id];
        if (ans !== undefined) {
          answeredCount++;
          if (ans === q.answer) correctCount++;
        }
      });
    });

    const wrongCount = Object.keys(this.wrongHistory).length;
    const accuracy = answeredCount > 0 ? ((correctCount / answeredCount) * 100).toFixed(0) : 0;

    const elTotal = document.getElementById('homeTotalSolved');
    const elAcc = document.getElementById('homeAccuracyRate');
    const elWrong = document.getElementById('homeWrongCount');
    const elWrongLabel = document.getElementById('homeWrongOnlyCountLabel');

    if (elTotal) elTotal.textContent = `${answeredCount} / ${totalQuestions}`;
    if (elAcc) elAcc.textContent = `${accuracy}%`;
    if (elWrong) elWrong.textContent = `${wrongCount}개`;
    if (elWrongLabel) elWrongLabel.textContent = `${wrongCount}문제`;
  }

  syncSavedSettingsToUI() {
    // Sync Exam Header Subject buttons
    document.querySelectorAll('.filter-subject-btn').forEach(b => {
      const isMatch = b.dataset.subject === this.selectedSubject;
      b.classList.toggle('bg-indigo-600', isMatch);
      b.classList.toggle('text-white', isMatch);
      b.classList.toggle('shadow-sm', isMatch);
      b.classList.toggle('bg-slate-100', !isMatch);
      b.classList.toggle('text-slate-700', !isMatch);
    });

    // Sync Home Subject Cards (Dark theme vibrant styles)
    document.querySelectorAll('#homeSubjectCards .setup-card').forEach(c => {
      const isMatch = c.dataset.val === this.selectedSubject;
      c.classList.toggle('selected', isMatch);
      c.classList.toggle('border-indigo-500', isMatch);
      c.classList.toggle('border-slate-700', !isMatch);
    });

    // Sync Home Exam Mode Cards
    document.querySelectorAll('#homeExamModeCards .mode-card').forEach(c => {
      const isMatch = c.dataset.mode === this.examMode;
      c.classList.toggle('selected', isMatch);
      c.classList.toggle('border-indigo-500', isMatch);
      c.classList.toggle('border-slate-700', !isMatch);
    });

    // Sync Limit Slider
    const slider = document.getElementById('homeLimitSlider');
    if (slider) {
      if (this.selectedLimit === 'all') slider.value = 30;
      else slider.value = parseInt(this.selectedLimit) || 5;
    }
    this.updateSliderMetrics();

    // Sync Checkboxes
    const mobileShuffle = document.getElementById('homeShuffleCheckbox');
    if (mobileShuffle) mobileShuffle.checked = this.isShuffled;

    const mobileWrong = document.getElementById('homeWrongOnlyCheckbox');
    if (mobileWrong) mobileWrong.checked = this.onlyWrongMode;

    this.setFontSize(this.fontSize);
  }

  // --- FILTER ENGINE ---
  applyFilters() {
    let list = [...this.rawSets];
    
    // Subject filter
    if (this.selectedSubject !== 'all') {
      list = list.filter(s => s.subject === this.selectedSubject);
    }
    
    // Multi-Year filter
    if (this.selectedYears.length > 0) {
      list = list.filter(s => this.selectedYears.includes(String(s.year)));
    }

    // Only Wrong Filter (오답 노트 모드)
    if (this.onlyWrongMode) {
      list = list.filter(s => s.questions.some(q => this.wrongHistory[q.id]));
    }
    
    // Safe Random Shuffle
    if (this.isShuffled) {
      list = this.fisherYatesShuffle([...list]);
    }
    
    // Limit filter
    if (this.selectedLimit !== 'all') {
      const limit = parseInt(this.selectedLimit) || 5;
      list = list.slice(0, limit);
    }
    
    this.filteredSets = list;
    this.currentSetIndex = 0;
    this.activeQuestionIndex = 0;
    
    this.updateShuffleUI();
    this.updateWrongModeUI();
    
    if (this.examMode === 'full') {
      this.renderFullPaperMode();
    } else {
      this.renderCurrentSet();
    }
    
    this.renderOMR();
    this.updateStatsBar();
    this.saveToStorage();
  }

  fisherYatesShuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  toggleShuffle() {
    this.isShuffled = !this.isShuffled;
    const homeShuffleCheckbox = document.getElementById('homeShuffleCheckbox');
    if (homeShuffleCheckbox) homeShuffleCheckbox.checked = this.isShuffled;
    this.applyFilters();
  }

  toggleWrongMode() {
    this.onlyWrongMode = !this.onlyWrongMode;
    const homeWrongOnlyCheckbox = document.getElementById('homeWrongOnlyCheckbox');
    if (homeWrongOnlyCheckbox) homeWrongOnlyCheckbox.checked = this.onlyWrongMode;
    this.applyFilters();
  }

  updateShuffleUI() {
    const shuffleBtn = document.getElementById('shuffleToggleBtn');
    if (shuffleBtn) {
      shuffleBtn.classList.toggle('bg-amber-100', this.isShuffled);
      shuffleBtn.classList.toggle('text-amber-800', this.isShuffled);
      shuffleBtn.classList.toggle('border-amber-300', this.isShuffled);
    }
  }

  updateWrongModeUI() {
    const wrongBtn = document.getElementById('wrongFilterBtn');
    if (wrongBtn) {
      wrongBtn.classList.toggle('bg-rose-100', this.onlyWrongMode);
      wrongBtn.classList.toggle('text-rose-800', this.onlyWrongMode);
      wrongBtn.classList.toggle('border-rose-300', this.onlyWrongMode);
    }
  }

  // --- TIMER ENGINE ---
  startTimer() {
    if (this.isTimerRunning) return;
    this.isTimerRunning = true;
    
    // In Full Exam mode: set official countdown (언어이해 70분 = 4200s, 추리논증 125분 = 7500s)
    if (this.examMode === 'full' && this.timerSeconds === 0) {
      this.timerSeconds = this.selectedSubject === '언어이해' ? 4200 : 7500;
      this.timerCountdown = true;
    } else if (!this.timerCountdown && this.examMode !== 'full') {
      this.timerCountdown = false;
    }

    this.timerInterval = setInterval(() => {
      if (this.timerCountdown) {
        if (this.timerSeconds > 0) this.timerSeconds--;
        else {
          this.pauseTimer();
          alert('⏰ 정규 시험 시간이 종료되었습니다! OMR 답안을 제출하여 채점 결과를 확인하세요.');
        }
      } else {
        this.timerSeconds++;
      }
      this.updateTimerDisplay();
    }, 1000);
  }

  pauseTimer() {
    this.isTimerRunning = false;
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    this.updateTimerDisplay();
  }

  resetTimer() {
    this.pauseTimer();
    this.timerSeconds = 0;
    this.timerCountdown = false;
    this.updateTimerDisplay();
  }

  updateTimerDisplay() {
    const el = document.getElementById('timerDisplay');
    if (!el) return;
    const mins = Math.floor(this.timerSeconds / 60);
    const secs = this.timerSeconds % 60;
    el.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  // --- NAVIGATION ---
  prevSet() {
    if (this.currentSetIndex > 0) {
      this.currentSetIndex--;
      this.activeQuestionIndex = 0;
      this.renderCurrentSet();
      this.scrollToTop();
    }
  }

  nextSet() {
    if (this.currentSetIndex < this.filteredSets.length - 1) {
      this.currentSetIndex++;
      this.activeQuestionIndex = 0;
      this.renderCurrentSet();
      this.scrollToTop();
    }
  }

  jumpToSet(setIdx, qIdx = 0) {
    if (setIdx >= 0 && setIdx < this.filteredSets.length) {
      this.currentSetIndex = setIdx;
      this.activeQuestionIndex = qIdx;
      this.renderCurrentSet();
      this.scrollToTop();
      const omrModal = document.getElementById('omrDrawerModal');
      if (omrModal) omrModal.classList.add('hidden');
    }
  }

  scrollToTop() {
    const passagePane = document.getElementById('passagePane');
    const questionsPane = document.getElementById('questionsPane');
    if (passagePane) passagePane.scrollTop = 0;
    if (questionsPane) questionsPane.scrollTop = 0;
  }

  scrollToQuestion(qIndex) {
    this.activeQuestionIndex = qIndex;
    this.renderQuestionTabs(this.filteredSets[this.currentSetIndex]);
    
    const targetCard = document.getElementById(`qCard_idx_${qIndex}`);
    if (targetCard) {
      targetCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
      targetCard.classList.add('ring-2', 'ring-indigo-500');
      setTimeout(() => {
        targetCard.classList.remove('ring-2', 'ring-indigo-500');
      }, 1200);
    }
  }

  // --- RENDER NORMAL SET MODE ---
  renderCurrentSet() {
    if (!this.filteredSets.length) {
      this.renderEmptyState();
      return;
    }

    const set = this.filteredSets[this.currentSetIndex];
    
    const indicator = document.getElementById('currentSetIndicator');
    if (indicator) {
      indicator.textContent = `세트 ${this.currentSetIndex + 1} / ${this.filteredSets.length}`;
    }

    const headerTitle = document.getElementById('examHeaderTitle');
    if (headerTitle) {
      headerTitle.textContent = `${set.year} ${set.subject} · 세트 ${this.currentSetIndex + 1}/${this.filteredSets.length}`;
    }

    const prevBtn = document.getElementById('prevSetBtn');
    const nextBtn = document.getElementById('nextSetBtn');
    if (prevBtn) prevBtn.disabled = this.currentSetIndex === 0;
    if (nextBtn) nextBtn.disabled = this.currentSetIndex === this.filteredSets.length - 1;

    this.renderPassage(set);
    this.renderQuestionTabs(set);
    this.renderQuestions(set);
    this.updateStatsBar();
  }

  renderEmptyState() {
    const passageBody = document.getElementById('passageBody');
    const questionsContainer = document.getElementById('questionsContainer');
    const tabsContainer = document.getElementById('setQuestionTabs');
    if (tabsContainer) tabsContainer.innerHTML = '';
    
    const emptyMsg = this.onlyWrongMode 
      ? '🎉 등록된 오답이 없습니다! 모든 문제를 맞히셨거나 오답 노트가 비어 있습니다.' 
      : '선택하신 조건에 일치하는 문항이 없습니다. 연도 다중 선택을 확인해 주세요.';
      
    if (passageBody) passageBody.innerHTML = `<div class="p-8 text-center text-slate-400 font-medium">${emptyMsg}</div>`;
    if (questionsContainer) questionsContainer.innerHTML = `<div class="p-8 text-center text-slate-400 font-medium">${emptyMsg}</div>`;
  }

  renderPassage(set) {
    const titleEl = document.getElementById('passageTitle');
    const badgesEl = document.getElementById('passageBadges');
    const charCountEl = document.getElementById('passageCharCount');
    const bodyEl = document.getElementById('passageBody');

    if (titleEl) titleEl.textContent = set.title || `${set.year}학년도 ${set.subject} [${set.questions.map(q => q.qNum).join(', ')}번]`;
    
    if (badgesEl) {
      const subjectColor = set.subject === '언어이해' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-indigo-100 text-indigo-800 border-indigo-300';
      badgesEl.innerHTML = `
        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${subjectColor}">${set.subject}</span>
        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-300">${set.year}학년도</span>
        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-300">${set.questions.map(q=>q.qNum).join('~')}번 세트</span>
        ${set.questions.length > 1 ? `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">🔥 다문항 세트 (${set.questions.length}문항)</span>` : ''}
        ${this.isShuffled ? `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">🔀 셔플</span>` : ''}
      `;
    }

    if (charCountEl) {
      charCountEl.textContent = `${(set.passage || '').length.toLocaleString()}자`;
    }

    if (bodyEl) {
      if (!set.passage || !set.passage.trim()) {
        bodyEl.innerHTML = `
          <div class="bg-indigo-50/70 border border-indigo-200 rounded-xl p-5 text-indigo-900 text-sm leading-relaxed">
            <h4 class="font-bold text-base mb-1">💡 단독 문항 제시문 안내</h4>
            <p>본 문제는 우측 문제 영역에 기재된 사실관계, 법안 및 조건을 종합하여 풀이하는 단독 추리/논증 문항입니다.</p>
          </div>
        `;
      } else {
        const paragraphs = set.passage.split('\n\n').flatMap(p => p.split('\n'));
        const formatted = paragraphs
          .map(p => p.trim())
          .filter(p => p.length > 0)
          .map(p => `<p class="mb-4 text-slate-800 leading-relaxed font-passage">${this.formatInlineText(p)}</p>`)
          .join('');
        bodyEl.innerHTML = formatted;
      }
    }
  }

  formatInlineText(text) {
    let t = text;
    t = t.replace(/(\[[A-Z]\])/g, '<span class="symbol-bracket">$1</span>');
    t = t.replace(/([㉠㉡㉢㉣㉤])/g, '<u><span class="symbol-circle">$1</span></u>');
    t = t.replace(/([ⓐⓑⓒⓓⓔ])/g, '<span class="symbol-circle">$1</span>');
    t = t.replace(/(?:\n|\A)([ㄱㄴㄷㄹㅁ]\.)/g, '<br><strong class="symbol-bogi">$1</strong>');
    return t;
  }

  renderQuestionTabs(set) {
    const tabsContainer = document.getElementById('setQuestionTabs');
    if (!tabsContainer) return;

    if (set.questions.length <= 1) {
      tabsContainer.innerHTML = '';
      tabsContainer.classList.add('hidden');
      return;
    }

    tabsContainer.classList.remove('hidden');
    let tabsHTML = '<div class="flex items-center gap-2 p-1 bg-slate-200/70 rounded-xl">';
    
    set.questions.forEach((q, idx) => {
      const isAnswered = this.userAnswers[q.id] !== undefined;
      const isCurrentActive = idx === this.activeQuestionIndex;
      const isChecked = this.checkedSets[set.id];
      const isCorrect = isChecked && this.userAnswers[q.id] === q.answer;
      const isWrong = isChecked && isAnswered && !isCorrect;

      let statusBadge = '';
      if (isChecked) {
        statusBadge = isCorrect 
          ? '<span class="ml-1 text-emerald-600">✓</span>' 
          : '<span class="ml-1 text-rose-600">✕</span>';
      } else if (isAnswered) {
        statusBadge = '<span class="ml-1 w-2 h-2 rounded-full bg-indigo-600 inline-block"></span>';
      }

      const activeClass = isCurrentActive 
        ? 'bg-white text-indigo-700 shadow-sm font-black' 
        : 'text-slate-600 hover:bg-slate-100 font-semibold';

      tabsHTML += `
        <button 
          class="flex-1 py-1.5 px-3 rounded-lg text-xs transition flex items-center justify-center gap-1 ${activeClass}"
          onclick="app.scrollToQuestion(${idx})"
        >
          <span>Q${q.qNum}</span>
          ${statusBadge}
        </button>
      `;
    });

    tabsHTML += '</div>';
    tabsContainer.innerHTML = tabsHTML;
  }

  renderQuestions(set) {
    const container = document.getElementById('questionsContainer');
    if (!container) return;

    const isChecked = this.checkedSets[set.id] || false;

    let html = '';
    set.questions.forEach((q, qIndex) => {
      const userAns = this.userAnswers[q.id];
      const isAnswered = userAns !== undefined;
      const isCorrect = isChecked && userAns === q.answer;
      const isWrong = isChecked && isAnswered && !isCorrect;
      const memoText = this.userMemos[q.id] || '';
      const isMemoOpen = this.openMemos.has(q.id) || !!memoText;

      html += `
        <div id="qCard_idx_${qIndex}" class="question-card bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-sm transition mb-6 ${isChecked ? (isCorrect ? 'border-emerald-300 ring-1 ring-emerald-200' : 'border-rose-300 ring-1 ring-rose-200') : ''}">
          
          <!-- Question Header & Badges -->
          <div class="flex items-start justify-between gap-3 mb-3">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-indigo-600 text-white font-black text-xs shadow-sm">
                ${q.qNum}
              </span>
              <span class="text-xs font-bold text-slate-500">${set.year}학년도 ${set.subject}</span>
              ${isCorrect ? `<span class="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">정답 ✓</span>` : ''}
              ${isWrong ? `<span class="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800">오답 ✕ (공식 정답: ${q.answer}번)</span>` : ''}
            </div>

            <!-- Action Buttons (Memo & Bookmark) -->
            <div class="flex items-center gap-1.5">
              <button 
                onclick="app.toggleMemo('${q.id}')" 
                class="px-2.5 py-1 rounded-lg text-xs font-semibold border transition flex items-center gap-1 ${memoText ? 'bg-amber-50 text-amber-800 border-amber-300' : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'}"
                title="문제별 풀이 메모 작성"
              >
                📝 <span>${memoText ? '메모 있음' : '메모'}</span>
              </button>
            </div>
          </div>

          <!-- Prompt Question Text -->
          <h3 class="text-base sm:text-lg font-bold text-slate-900 leading-relaxed mb-4">
            ${this.formatInlineText(q.prompt)}
          </h3>

          <!-- Box Content (규정 / 보기 / 사례 / 표) -->
          ${q.box ? `
            <div class="leet-box mb-5 text-sm text-slate-800">
              ${this.formatInlineText(q.box)}
            </div>
          ` : ''}

          <!-- 5-Option Choices List -->
          <div class="space-y-2.5 mb-5">
            ${q.options.map((optText, optIdx) => {
              const optNum = optIdx + 1;
              const isSelected = userAns === optNum;
              
              let optStyleClass = 'border-slate-200 bg-white hover:bg-indigo-50/50 hover:border-indigo-300 text-slate-800';
              let badgeStyleClass = 'bg-slate-100 text-slate-700 border-slate-300';

              if (isChecked) {
                if (optNum === q.answer) {
                  optStyleClass = 'border-emerald-500 bg-emerald-50 text-emerald-950 font-semibold';
                  badgeStyleClass = 'bg-emerald-600 text-white border-emerald-600';
                } else if (isSelected && !isCorrect) {
                  optStyleClass = 'border-rose-400 bg-rose-50 text-rose-950';
                  badgeStyleClass = 'bg-rose-600 text-white border-rose-600';
                } else {
                  optStyleClass = 'opacity-60 border-slate-200 bg-slate-50 text-slate-500';
                }
              } else if (isSelected) {
                optStyleClass = 'border-indigo-600 bg-indigo-50 text-indigo-950 font-bold shadow-sm';
                badgeStyleClass = 'bg-indigo-600 text-white border-indigo-600';
              }

              const circleSymbols = ['①', '②', '③', '④', '⑤'];

              return `
                <div 
                  class="option-item flex items-start gap-3 p-3 sm:p-3.5 rounded-xl border cursor-pointer transition ${optStyleClass}"
                  onclick="app.selectAnswer('${q.id}', ${optNum})"
                >
                  <span class="flex-shrink-0 w-6 h-6 rounded-full border text-xs font-bold flex items-center justify-center ${badgeStyleClass}">
                    ${circleSymbols[optIdx]}
                  </span>
                  <span class="text-sm sm:text-base leading-relaxed flex-1 pt-0.5">
                    ${optText}
                  </span>
                </div>
              `;
            }).join('')}
          </div>

          <!-- Question Memo Scratchpad (Inline) -->
          <div id="memoBox_${q.id}" class="memo-box mt-3 p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl ${isMemoOpen ? '' : 'hidden'}">
            <div class="flex items-center justify-between mb-1.5 text-xs font-bold text-amber-900">
              <span>📝 나만의 풀이 팁 & 오답 메모</span>
              <span class="text-[10px] text-amber-700 font-normal">입력 시 자동 저장</span>
            </div>
            <textarea 
              rows="2" 
              placeholder="이 문제의 함정 포인트, 헷갈린 선지, 핵심 키워드를 메모해 보세요..."
              class="w-full text-xs p-2.5 bg-white border border-amber-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-500 text-slate-800"
              oninput="app.saveMemo('${q.id}', this.value)"
            >${memoText}</textarea>
          </div>

          <!-- Explanation Reveal -->
          ${isChecked ? `
            <div class="mt-4 pt-4 border-t border-slate-200 bg-slate-50/80 -mx-5 -mb-5 sm:-mx-6 sm:-mb-6 p-4 sm:p-5 rounded-b-2xl">
              <div class="flex items-center gap-2 mb-2 font-bold text-xs text-slate-700">
                <span class="text-indigo-600">💡 공식 해설 및 정답</span>
                <span class="font-black text-indigo-700">[정답: ${q.answer}번]</span>
              </div>
              <p class="text-xs sm:text-sm text-slate-700 leading-relaxed">
                ${q.explanation || `${set.year}학년도 LEET ${set.subject} ${q.qNum}번 기출 문항입니다.`}
              </p>
            </div>
          ` : ''}

        </div>
      `;
    });

    // Bottom Action Bar: Check Answers / Next Set
    html += `
      <div class="flex items-center gap-3 pt-2 pb-8">
        <button 
          onclick="app.checkCurrentSet()" 
          class="flex-1 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white font-bold text-sm shadow-md transition flex items-center justify-center gap-2"
        >
          <span>${isChecked ? '🔄 다시 채점하기' : '✨ 현재 세트 즉시 채점'}</span>
        </button>
        ${this.currentSetIndex < this.filteredSets.length - 1 ? `
          <button 
            onclick="app.nextSet()" 
            class="px-5 py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm shadow transition flex items-center gap-1.5"
          >
            <span>다음 세트</span> <span>▶</span>
          </button>
        ` : `
          <button 
            onclick="app.openExamResultModal()" 
            class="px-5 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm shadow transition"
          >
            🏆 시험 제출
          </button>
        `}
      </div>
    `;

    container.innerHTML = html;
  }

  // --- FULL EXAM PAPER CONTINUOUS MODE (PDF REAL EXAM STYLE) ---
  renderFullPaperMode() {
    const passagePane = document.getElementById('passagePane');
    const questionsPane = document.getElementById('questionsPane');
    const tabsContainer = document.getElementById('setQuestionTabs');
    if (tabsContainer) tabsContainer.classList.add('hidden');

    const totalSets = this.filteredSets;
    if (!totalSets.length) {
      this.renderEmptyState();
      return;
    }

    const headerTitle = document.getElementById('examHeaderTitle');
    if (headerTitle) {
      headerTitle.textContent = `📜 ${this.selectedSubject} 실전 전체 시험지 모드 (${totalSets.length}개 세트)`;
    }

    // Combine all passages and questions in a continuous scroll view
    if (passagePane) {
      let passageHTML = `
        <div class="mb-6 p-4 bg-indigo-900 text-white rounded-2xl">
          <h2 class="text-lg font-black">📜 실전 시험지 본문 뷰</h2>
          <p class="text-xs text-indigo-200 mt-1">우측의 문제와 연동하여 전체 지문을 순서대로 열람하실 수 있습니다.</p>
        </div>
      `;

      totalSets.forEach((set, sIdx) => {
        if (set.passage && set.passage.trim()) {
          passageHTML += `
            <div class="passage-section mb-10 pb-8 border-b-2 border-slate-200">
              <div class="flex items-center gap-2 mb-3">
                <span class="px-2.5 py-1 rounded-lg bg-indigo-100 text-indigo-900 font-black text-xs">[${set.questions.map(q=>q.qNum).join('~')}번 지문]</span>
                <span class="text-xs font-bold text-slate-500">${set.year}학년도 ${set.subject}</span>
              </div>
              <article class="font-passage text-base leading-loose text-slate-900">
                ${set.passage.split('\n\n').map(p => `<p class="mb-3">${this.formatInlineText(p)}</p>`).join('')}
              </article>
            </div>
          `;
        }
      });

      passagePane.innerHTML = passageHTML;
    }

    if (questionsPane) {
      let questionsHTML = `
        <div class="mb-6 p-4 bg-slate-800 text-white rounded-2xl flex items-center justify-between">
          <div>
            <h3 class="text-base font-black">✍️ 실전 문제 풀이 (전체 ${totalSets.reduce((acc, s) => acc + s.questions.length, 0)}문항)</h3>
            <p class="text-xs text-slate-300 mt-0.5">1번부터 순서대로 풀이 후 하단의 최종 제출을 클릭하세요.</p>
          </div>
          <button onclick="app.openExamResultModal()" class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-black text-xs text-white shadow">
            채점 및 제출
          </button>
        </div>
      `;

      totalSets.forEach((set, sIdx) => {
        set.questions.forEach((q, qIdx) => {
          const userAns = this.userAnswers[q.id];
          const isChecked = this.isExamSubmitted;
          const isCorrect = isChecked && userAns === q.answer;
          const memoText = this.userMemos[q.id] || '';

          questionsHTML += `
            <div class="question-card bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-sm mb-6">
              <div class="flex items-center justify-between mb-3">
                <div class="flex items-center gap-2">
                  <span class="w-7 h-7 rounded-lg bg-slate-900 text-white font-black text-xs flex items-center justify-center">${q.qNum}</span>
                  <span class="text-xs font-bold text-slate-500">${set.year}학년도 ${set.subject}</span>
                </div>
                <button onclick="app.toggleMemo('${q.id}')" class="text-xs text-slate-500 hover:text-indigo-600">📝 메모</button>
              </div>

              <h4 class="text-base font-bold text-slate-900 mb-3">${this.formatInlineText(q.prompt)}</h4>

              ${q.box ? `<div class="leet-box text-sm mb-4">${this.formatInlineText(q.box)}</div>` : ''}

              <div class="space-y-2 mb-4">
                ${q.options.map((opt, oIdx) => {
                  const oNum = oIdx + 1;
                  const isSel = userAns === oNum;
                  const circleSymbols = ['①', '②', '③', '④', '⑤'];
                  return `
                    <div 
                      class="option-item flex items-center gap-2.5 p-2.5 rounded-xl border text-sm cursor-pointer transition ${isSel ? 'bg-indigo-50 border-indigo-600 font-bold text-indigo-950' : 'bg-white border-slate-200 hover:bg-slate-50'}"
                      onclick="app.selectAnswer('${q.id}', ${oNum})"
                    >
                      <span class="w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center ${isSel ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}">${circleSymbols[oIdx]}</span>
                      <span>${opt}</span>
                    </div>
                  `;
                }).join('')}
              </div>

              <div id="memoBox_${q.id}" class="memo-box p-3 bg-amber-50 rounded-xl border border-amber-200 ${memoText ? '' : 'hidden'}">
                <textarea 
                  rows="2" 
                  placeholder="메모 작성..." 
                  class="w-full text-xs p-2 bg-white border border-amber-300 rounded-lg"
                  oninput="app.saveMemo('${q.id}', this.value)"
                >${memoText}</textarea>
              </div>
            </div>
          `;
        });
      });

      questionsHTML += `
        <div class="p-6 text-center">
          <button onclick="app.openExamResultModal()" class="w-full max-w-md py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-lg shadow-xl">
            🏆 전체 시험 제출 및 최종 채점
          </button>
        </div>
      `;

      questionsPane.innerHTML = questionsHTML;
    }
  }

  // --- QUESTION MEMO ENGINE ---
  toggleMemo(qId) {
    const memoBox = document.getElementById(`memoBox_${qId}`);
    if (memoBox) {
      const isHidden = memoBox.classList.contains('hidden');
      memoBox.classList.toggle('hidden', !isHidden);
      if (isHidden) {
        this.openMemos.add(qId);
        const txtArea = memoBox.querySelector('textarea');
        if (txtArea) txtArea.focus();
      } else {
        this.openMemos.delete(qId);
      }
    }
  }

  saveMemo(qId, text) {
    if (text.trim()) {
      this.userMemos[qId] = text.trim();
    } else {
      delete this.userMemos[qId];
    }
    this.saveToStorage();
  }

  // --- WRONG NOTES REVIEW DASHBOARD MODAL ---
  openWrongNotesModal() {
    const modal = document.getElementById('wrongNotesModal');
    if (!modal) return;
    modal.classList.remove('hidden');
    this.renderWrongNotesList('all');
  }

  renderWrongNotesList(subjectFilter = 'all') {
    const container = document.getElementById('wrongNotesListContainer');
    const countBadge = document.getElementById('wrongNotesCountBadge');
    if (!container) return;

    let wrongItems = Object.values(this.wrongHistory);
    if (subjectFilter !== 'all') {
      wrongItems = wrongItems.filter(item => item.subject === subjectFilter);
    }

    if (countBadge) countBadge.textContent = `총 ${wrongItems.length}개 문항`;

    if (wrongItems.length === 0) {
      container.innerHTML = `
        <div class="text-center py-16 text-slate-400">
          <span class="text-4xl block mb-2">🎉</span>
          <p class="font-bold text-base text-slate-700">등록된 오답이 없습니다!</p>
          <p class="text-xs text-slate-400 mt-1">문제를 풀고 채점하면 틀린 문항이 자동으로 이곳에 정리됩니다.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = wrongItems.map(item => {
      const memo = this.userMemos[item.qId] || '';
      return `
        <div class="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="px-2.5 py-1 rounded-lg bg-rose-100 text-rose-800 font-black text-xs">${item.year}학년도 ${item.subject} ${item.qNum}번</span>
              <span class="text-xs font-semibold text-slate-500">내 답안: <strong class="text-rose-600">${item.userAns}번</strong> / 정답: <strong class="text-emerald-600">${item.correctAns}번</strong></span>
            </div>
            <button onclick="app.removeWrongNote('${item.qId}')" class="text-xs text-slate-400 hover:text-rose-600 transition">
              ✕ 오답 해제
            </button>
          </div>

          <div class="p-3 bg-amber-50 rounded-xl border border-amber-200">
            <span class="text-[11px] font-bold text-amber-900 block mb-1">📝 나의 오답 메모:</span>
            <textarea 
              rows="2" 
              class="w-full text-xs p-2 bg-white border border-amber-300 rounded-lg text-slate-800"
              placeholder="오답 원인과 팁을 적어보세요..."
              oninput="app.saveMemo('${item.qId}', this.value)"
            >${memo}</textarea>
          </div>
        </div>
      `;
    }).join('');
  }

  removeWrongNote(qId) {
    if (this.wrongHistory[qId]) {
      delete this.wrongHistory[qId];
      this.saveToStorage();
      this.renderWrongNotesList();
      this.updateHomeDashboard();
    }
  }

  // --- ANSWER SELECTION & GRADING ---
  selectAnswer(qId, optionNum) {
    this.userAnswers[qId] = optionNum;
    this.saveToStorage();
    
    if (navigator.vibrate) navigator.vibrate(10);
    
    if (this.examMode === 'full') {
      this.renderFullPaperMode();
    } else {
      this.renderQuestions(this.filteredSets[this.currentSetIndex]);
      this.renderQuestionTabs(this.filteredSets[this.currentSetIndex]);
    }
    this.renderOMR();
    this.updateStatsBar();
  }

  checkCurrentSet() {
    if (!this.filteredSets.length) return;
    const set = this.filteredSets[this.currentSetIndex];
    this.checkedSets[set.id] = true;

    set.questions.forEach(q => {
      const userAns = this.userAnswers[q.id];
      if (userAns !== undefined && userAns !== q.answer) {
        this.wrongHistory[q.id] = {
          qId: q.id,
          setId: set.id,
          year: set.year,
          subject: set.subject,
          qNum: q.qNum,
          userAns: userAns,
          correctAns: q.answer,
          timestamp: Date.now()
        };
      } else if (userAns === q.answer && this.wrongHistory[q.id]) {
        delete this.wrongHistory[q.id];
      }
    });

    this.saveToStorage();
    this.renderCurrentSet();
    this.renderOMR();
    this.updateStatsBar();
    this.updateHomeDashboard();
  }

  // --- STATS BAR & OMR ---
  updateStatsBar() {
    let totalQ = 0;
    let solvedQ = 0;
    let correctQ = 0;

    this.filteredSets.forEach(s => {
      s.questions.forEach(q => {
        totalQ++;
        const ans = this.userAnswers[q.id];
        if (ans !== undefined) {
          solvedQ++;
          if (ans === q.answer) correctQ++;
        }
      });
    });

    const fill = document.getElementById('progressBarFill');
    const text = document.getElementById('progressStatusText');
    const badge = document.getElementById('headerScoreBadge');

    if (text) text.textContent = `${solvedQ} / ${totalQ} 풀이`;
    if (fill) fill.style.width = `${totalQ > 0 ? (solvedQ / totalQ) * 100 : 0}%`;
    if (badge) badge.textContent = `${correctQ}개 정답`;
  }

  renderOMR() {
    const grid = document.getElementById('omrGrid');
    if (!grid) return;

    let html = '';
    this.filteredSets.forEach((s, sIdx) => {
      s.questions.forEach((q, qIdx) => {
        const ans = this.userAnswers[q.id];
        const isChecked = this.checkedSets[s.id];
        const isCorrect = isChecked && ans === q.answer;
        const isWrong = isChecked && ans !== undefined && !isCorrect;

        let badgeColor = 'bg-slate-100 text-slate-700 border-slate-300';
        if (isChecked) {
          badgeColor = isCorrect ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-rose-600 text-white border-rose-600';
        } else if (ans !== undefined) {
          badgeColor = 'bg-indigo-600 text-white border-indigo-600';
        }

        const circleSymbols = ['①', '②', '③', '④', '⑤'];

        html += `
          <div 
            class="flex items-center justify-between p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 cursor-pointer text-xs"
            onclick="app.jumpToSet(${sIdx}, ${qIdx})"
          >
            <div class="flex items-center gap-1.5">
              <span class="font-bold text-slate-800">Q${q.qNum}</span>
              <span class="text-[10px] text-slate-400">(${s.year})</span>
            </div>
            <span class="w-6 h-6 rounded-full border text-xs font-bold flex items-center justify-center ${badgeColor}">
              ${ans !== undefined ? circleSymbols[ans - 1] : '-'}
            </span>
          </div>
        `;
      });
    });

    grid.innerHTML = html;
  }

  openExamResultModal() {
    this.isExamSubmitted = true;
    this.pauseTimer();

    // Check all sets
    this.filteredSets.forEach(s => {
      this.checkedSets[s.id] = true;
      s.questions.forEach(q => {
        const userAns = this.userAnswers[q.id];
        if (userAns !== undefined && userAns !== q.answer) {
          this.wrongHistory[q.id] = {
            qId: q.id,
            setId: s.id,
            year: s.year,
            subject: s.subject,
            qNum: q.qNum,
            userAns: userAns,
            correctAns: q.answer,
            timestamp: Date.now()
          };
        }
      });
    });

    this.saveToStorage();
    if (this.examMode === 'full') {
      this.renderFullPaperMode();
    } else {
      this.renderCurrentSet();
    }
    this.updateHomeDashboard();

    const modal = document.getElementById('examResultModal');
    const scoreVal = document.getElementById('resultScoreValue');
    const resultCount = document.getElementById('resultCorrectCount');
    const wrongCount = document.getElementById('resultWrongCount');

    let totalQ = 0;
    let correctQ = 0;
    this.filteredSets.forEach(s => {
      s.questions.forEach(q => {
        totalQ++;
        if (this.userAnswers[q.id] === q.answer) correctQ++;
      });
    });

    const scorePct = totalQ > 0 ? Math.round((correctQ / totalQ) * 100) : 0;
    if (scoreVal) scoreVal.textContent = `${scorePct}점`;
    if (resultCount) resultCount.textContent = `${correctQ} / ${totalQ} 문항`;
    if (wrongCount) wrongCount.textContent = `${totalQ - correctQ} 문항`;

    if (modal) modal.classList.remove('hidden');
  }

  // --- EVENT BINDINGS ---
  bindEvents() {
    // Home Subject Cards
    document.querySelectorAll('#homeSubjectCards .setup-card').forEach(card => {
      card.addEventListener('click', () => {
        this.selectedSubject = card.dataset.val;
        this.syncSavedSettingsToUI();
      });
    });

    // Home Mode Cards
    document.querySelectorAll('#homeExamModeCards .mode-card').forEach(card => {
      card.addEventListener('click', () => {
        this.examMode = card.dataset.mode;
        this.syncSavedSettingsToUI();
      });
    });

    // Multi-Year Chip Toggles
    const yearContainer = document.getElementById('homeMultiYearChips');
    if (yearContainer) {
      yearContainer.addEventListener('click', (e) => {
        const btn = e.target.closest('.multi-year-chip');
        if (!btn) return;
        const yr = btn.dataset.year;
        if (this.selectedYears.includes(yr)) {
          this.selectedYears = this.selectedYears.filter(y => y !== yr);
        } else {
          this.selectedYears.push(yr);
          this.selectedYears.sort((a, b) => parseInt(b) - parseInt(a));
        }
        this.renderHomeMultiYearChips();
      });
    }

    // Multi-Year Presets
    const presetAll = document.getElementById('presetAllYearsBtn');
    if (presetAll) {
      presetAll.addEventListener('click', () => {
        this.selectedYears = Array.from({length: 18}, (_, i) => String(2026 - i));
        this.renderHomeMultiYearChips();
      });
    }

    const presetRecent3 = document.getElementById('presetRecent3Btn');
    if (presetRecent3) {
      presetRecent3.addEventListener('click', () => {
        this.selectedYears = ['2026', '2025', '2024'];
        this.renderHomeMultiYearChips();
      });
    }

    const presetRecent5 = document.getElementById('presetRecent5Btn');
    if (presetRecent5) {
      presetRecent5.addEventListener('click', () => {
        this.selectedYears = ['2026', '2025', '2024', '2023', '2022'];
        this.renderHomeMultiYearChips();
      });
    }

    const presetClear = document.getElementById('presetClearYearsBtn');
    if (presetClear) {
      presetClear.addEventListener('click', () => {
        this.selectedYears = [];
        this.renderHomeMultiYearChips();
      });
    }

    // Range Slider
    const slider = document.getElementById('homeLimitSlider');
    if (slider) {
      slider.addEventListener('input', () => this.updateSliderMetrics());
    }

    const sliderMaxBtn = document.getElementById('sliderMaxBtn');
    if (sliderMaxBtn && slider) {
      sliderMaxBtn.addEventListener('click', () => {
        slider.value = 30;
        this.selectedLimit = 'all';
        const badge = document.getElementById('sliderMetricBadge');
        if (badge) badge.innerHTML = `🏆 <strong>선택 연도 전체</strong> 풀이`;
      });
    }

    // Start Button
    const startBtn = document.getElementById('homeStartBtn');
    if (startBtn) {
      startBtn.addEventListener('click', () => {
        if (this.selectedYears.length === 0) {
          alert('최소 1개 이상의 기출 연도를 선택해 주세요.');
          return;
        }
        this.showView('exam');
      });
    }

    // Back to Home
    const backBtn = document.getElementById('backToHomeBtn');
    if (backBtn) {
      backBtn.addEventListener('click', () => this.showView('home'));
    }

    // Mobile Tabs
    const tabPassage = document.getElementById('mobileTabPassage');
    const tabQuestions = document.getElementById('mobileTabQuestions');
    if (tabPassage) tabPassage.addEventListener('click', () => this.setMobileTab('passage'));
    if (tabQuestions) tabQuestions.addEventListener('click', () => this.setMobileTab('questions'));

    // Navigation Buttons
    const prevBtn = document.getElementById('prevSetBtn');
    const nextBtn = document.getElementById('nextSetBtn');
    if (prevBtn) prevBtn.addEventListener('click', () => this.prevSet());
    if (nextBtn) nextBtn.addEventListener('click', () => this.nextSet());

    // Timer Toggle
    const timerBtn = document.getElementById('timerToggleBtn');
    if (timerBtn) {
      timerBtn.addEventListener('click', () => {
        if (this.isTimerRunning) this.pauseTimer();
        else this.startTimer();
      });
    }

    // OMR Drawer Toggle
    const omrOpenBtn = document.getElementById('omrToggleBtn');
    const omrModal = document.getElementById('omrDrawerModal');
    const omrCloseBtn = document.getElementById('omrCloseBtn');
    if (omrOpenBtn && omrModal) {
      omrOpenBtn.addEventListener('click', () => {
        omrModal.classList.remove('hidden');
        this.renderOMR();
      });
    }
    if (omrCloseBtn && omrModal) {
      omrCloseBtn.addEventListener('click', () => omrModal.classList.add('hidden'));
    }

    // Wrong Notes Modal Listeners
    const openWrongBtn = document.getElementById('homeOpenWrongNotesBtn');
    const closeWrongBtn = document.getElementById('closeWrongNotesBtn');
    const startRetryWrongBtn = document.getElementById('startRetryWrongBtn');
    
    if (openWrongBtn) openWrongBtn.addEventListener('click', () => this.openWrongNotesModal());
    if (closeWrongBtn) {
      const modal = document.getElementById('wrongNotesModal');
      closeWrongBtn.addEventListener('click', () => modal && modal.classList.add('hidden'));
    }
    if (startRetryWrongBtn) {
      startRetryWrongBtn.addEventListener('click', () => {
        const modal = document.getElementById('wrongNotesModal');
        if (modal) modal.classList.add('hidden');
        this.onlyWrongMode = true;
        this.showView('exam');
      });
    }

    // Wrong Notes Subject Filters
    const wrongAll = document.getElementById('wrongFilterSubjectAll');
    const wrongLang = document.getElementById('wrongFilterSubjectLang');
    const wrongReason = document.getElementById('wrongFilterSubjectReason');

    if (wrongAll && wrongLang && wrongReason) {
      wrongAll.addEventListener('click', () => {
        wrongAll.className = 'px-2.5 py-1 rounded-lg bg-indigo-600 text-white font-bold transition';
        wrongLang.className = 'px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition';
        wrongReason.className = 'px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition';
        this.renderWrongNotesList('all');
      });
      wrongLang.addEventListener('click', () => {
        wrongLang.className = 'px-2.5 py-1 rounded-lg bg-indigo-600 text-white font-bold transition';
        wrongAll.className = 'px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition';
        wrongReason.className = 'px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition';
        this.renderWrongNotesList('언어이해');
      });
      wrongReason.addEventListener('click', () => {
        wrongReason.className = 'px-2.5 py-1 rounded-lg bg-indigo-600 text-white font-bold transition';
        wrongAll.className = 'px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition';
        wrongLang.className = 'px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition';
        this.renderWrongNotesList('추리논증');
      });
    }

    // Result Modal
    const closeResultBtn = document.getElementById('closeResultModalBtn');
    const resultModal = document.getElementById('examResultModal');
    if (closeResultBtn && resultModal) {
      closeResultBtn.addEventListener('click', () => resultModal.classList.add('hidden'));
    }

    // Shortcuts Modal
    const shortcutsBtn = document.getElementById('shortcutsGuideBtn');
    const shortcutsModal = document.getElementById('shortcutsModal');
    const closeShortcutsBtn = document.getElementById('closeShortcutsModalBtn');
    const closeShortcutsBtn2 = document.getElementById('closeShortcutsModalBtn2');

    if (shortcutsBtn && shortcutsModal) {
      shortcutsBtn.addEventListener('click', () => shortcutsModal.classList.remove('hidden'));
    }
    if (closeShortcutsBtn && shortcutsModal) {
      closeShortcutsBtn.addEventListener('click', () => shortcutsModal.classList.add('hidden'));
    }
    if (closeShortcutsBtn2 && shortcutsModal) {
      closeShortcutsBtn2.addEventListener('click', () => shortcutsModal.classList.add('hidden'));
    }

    // Reset All Answers
    const homeResetAllBtn = document.getElementById('homeResetAllBtn');
    if (homeResetAllBtn) {
      homeResetAllBtn.addEventListener('click', () => {
        if (confirm('저장된 모든 문제의 풀이 기록과 오답 노트를 초기화하시겠습니까?')) {
          this.userAnswers = {};
          this.checkedSets = {};
          this.wrongHistory = {};
          this.userMemos = {};
          this.isExamSubmitted = false;
          this.saveToStorage();
          this.applyFilters();
          this.updateHomeDashboard();
          alert('모든 학습 데이터가 초기화되었습니다.');
        }
      });
    }

    // Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
      if (this.currentView !== 'exam') return;

      const set = this.filteredSets[this.currentSetIndex];
      if (!set || !set.questions.length) return;
      const activeQ = set.questions[this.activeQuestionIndex] || set.questions[0];

      if (['1', '2', '3', '4', '5'].includes(e.key)) {
        e.preventDefault();
        this.selectAnswer(activeQ.id, parseInt(e.key));
      } else if (e.key === 'ArrowLeft' || e.key === '[') {
        e.preventDefault();
        this.prevSet();
      } else if (e.key === 'ArrowRight' || e.key === ']') {
        e.preventDefault();
        this.nextSet();
      } else if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        this.checkCurrentSet();
      } else if (e.key.toLowerCase() === 'o') {
        e.preventDefault();
        const omrModal = document.getElementById('omrDrawerModal');
        if (omrModal) omrModal.classList.toggle('hidden');
      } else if (e.key === 'Tab' && set.questions.length > 1) {
        e.preventDefault();
        this.scrollToQuestion((this.activeQuestionIndex + 1) % set.questions.length);
      }
    });

    // Mobile Swipe
    let touchStartX = 0;
    let touchStartY = 0;
    const splitPane = document.getElementById('mainSplitPane');
    if (splitPane) {
      splitPane.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
      }, { passive: true });

      splitPane.addEventListener('touchend', (e) => {
        if (window.innerWidth >= 1024) return;
        const diffX = e.changedTouches[0].screenX - touchStartX;
        const diffY = e.changedTouches[0].screenY - touchStartY;
        if (Math.abs(diffX) > 60 && Math.abs(diffY) < 50) {
          if (diffX < 0 && this.mobileTab === 'passage') {
            this.setMobileTab('questions');
            if (navigator.vibrate) navigator.vibrate(10);
          } else if (diffX > 0 && this.mobileTab === 'questions') {
            this.setMobileTab('passage');
            if (navigator.vibrate) navigator.vibrate(10);
          }
        }
      }, { passive: true });
    }
  }

  setFontSize(size) {
    this.fontSize = size;
    const passage = document.getElementById('passageBody');
    if (!passage) return;
    passage.classList.remove('text-sm', 'text-base', 'text-lg', 'text-xl');
    if (size === 'sm') passage.classList.add('text-sm');
    else if (size === 'md') passage.classList.add('text-base');
    else if (size === 'lg') passage.classList.add('text-lg');
    else if (size === 'xl') passage.classList.add('text-xl');
  }
}

// Global App Instance
document.addEventListener('DOMContentLoaded', () => {
  window.app = new LeetApp();
});
