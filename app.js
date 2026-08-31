// LEET Interactive Training Platform Engine
// Features: Home Setup Screen, 3in1 Sets, LocalStorage Persistence, Safe Random Shuffle, Wrong Answers Review Notebook, Mobile View Switcher

class LeetApp {
  constructor() {
    this.rawSets = [];
    this.filteredSets = [];
    this.currentSetIndex = 0;
    this.activeQuestionIndex = 0;
    
    // View state: 'home' or 'exam'
    this.currentView = 'home';
    
    // Mobile Tab state: 'passage' or 'questions'
    this.mobileTab = 'passage';
    
    // Layout orientation: 'left' (passage on left) or 'right' (passage on right)
    this.passageSide = 'left';
    
    // Filter & Mode state
    this.selectedSubject = '언어이해'; // 'all', '언어이해', '추리논증'
    this.selectedYear = 'all'; // 'all', '2026', '2025', '2024', '2023'
    this.selectedLimit = '3'; // '1', '3', '5', '10', 'all'
    this.isShuffled = false;
    this.onlyWrongMode = false;
    
    // User progress state (Persisted in LocalStorage)
    this.userAnswers = {}; // { qId: optionNum (1..5) }
    this.checkedSets = {}; // { setId: boolean }
    this.wrongHistory = {}; // { qId: { qId, setId, year, subject, qNum, tag, userAns, correctAns, timestamp } }
    this.isExamSubmitted = false;
    
    // UI states
    this.fontSize = 'md';
    this.isHighlighterActive = false;
    this.currentHighlightColor = 'yellow';
    
    // Timer state
    this.timerSeconds = 0;
    this.timerInterval = null;
    this.isTimerRunning = false;
    
    // Resizer state
    this.isDraggingResizer = false;
    
    this.STORAGE_KEYS = {
      ANSWERS: 'LEET_USER_ANSWERS_V2',
      CHECKED: 'LEET_CHECKED_SETS_V2',
      WRONG: 'LEET_WRONG_HISTORY_V2',
      SETTINGS: 'LEET_SETTINGS_V2'
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

      const savedSettings = localStorage.getItem(this.STORAGE_KEYS.SETTINGS);
      if (savedSettings) {
        const s = JSON.parse(savedSettings);
        if (s.subject) this.selectedSubject = s.subject;
        if (s.year) this.selectedYear = s.year;
        if (s.limit) this.selectedLimit = s.limit;
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
      localStorage.setItem(this.STORAGE_KEYS.SETTINGS, JSON.stringify({
        subject: this.selectedSubject,
        year: this.selectedYear,
        limit: this.selectedLimit,
        fontSize: this.fontSize,
        passageSide: this.passageSide
      }));
    } catch (e) {
      console.warn('LocalStorage save failed:', e);
    }
  }

  initUI() {
    this.bindEvents();
    this.syncSavedSettingsToUI();
    this.updateHomeDashboard();
    this.showView('home');
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

    // Sync Mobile Subject buttons
    document.querySelectorAll('.mobile-filter-subject-btn').forEach(b => {
      const isMatch = b.dataset.subject === this.selectedSubject;
      b.classList.toggle('bg-indigo-50', isMatch);
      b.classList.toggle('border-indigo-600', isMatch);
      b.classList.toggle('text-indigo-700', isMatch);
      b.classList.toggle('font-bold', isMatch);
      b.classList.toggle('bg-slate-50', !isMatch);
      b.classList.toggle('border-slate-200', !isMatch);
      b.classList.toggle('text-slate-700', !isMatch);
    });

    // Sync Home Subject Cards
    document.querySelectorAll('#homeSubjectCards .setup-card').forEach(c => {
      const isMatch = c.dataset.val === this.selectedSubject;
      c.classList.toggle('selected', isMatch);
      c.classList.toggle('border-indigo-500', isMatch);
      c.classList.toggle('border-slate-700', !isMatch);
    });

    // Sync Home Year Chips
    document.querySelectorAll('#homeYearChips .chip-btn').forEach(c => {
      const isMatch = c.dataset.val === this.selectedYear;
      c.classList.toggle('selected', isMatch);
      c.classList.toggle('bg-indigo-600', isMatch);
      c.classList.toggle('text-white', isMatch);
      c.classList.toggle('bg-slate-800', !isMatch);
      c.classList.toggle('text-slate-300', !isMatch);
    });

    // Sync Home Limit Chips
    document.querySelectorAll('#homeLimitChips .chip-btn').forEach(c => {
      const isMatch = c.dataset.val === this.selectedLimit;
      c.classList.toggle('selected', isMatch);
      c.classList.toggle('bg-indigo-600', isMatch);
      c.classList.toggle('text-white', isMatch);
      c.classList.toggle('bg-slate-800', !isMatch);
      c.classList.toggle('text-slate-300', !isMatch);
    });

    const yearSelect = document.getElementById('yearFilterSelect');
    if (yearSelect) yearSelect.value = this.selectedYear;

    const limitSelect = document.getElementById('limitFilterSelect');
    if (limitSelect) limitSelect.value = this.selectedLimit;

    const mobileYear = document.getElementById('mobileYearSelect');
    if (mobileYear) mobileYear.value = this.selectedYear;

    const mobileLimit = document.getElementById('mobileLimitSelect');
    if (mobileLimit) mobileLimit.value = this.selectedLimit;

    const mobileShuffle = document.getElementById('mobileShuffleCheck');
    if (mobileShuffle) mobileShuffle.checked = this.isShuffled;

    const mobileWrong = document.getElementById('mobileWrongCheck');
    if (mobileWrong) mobileWrong.checked = this.onlyWrongMode;

    document.querySelectorAll('.mobile-font-btn').forEach(b => {
      const isMatch = b.dataset.size === this.fontSize;
      b.classList.toggle('bg-indigo-50', isMatch);
      b.classList.toggle('border-indigo-600', isMatch);
      b.classList.toggle('text-indigo-700', isMatch);
      b.classList.toggle('font-bold', isMatch);
      b.classList.toggle('bg-slate-50', !isMatch);
      b.classList.toggle('border-slate-200', !isMatch);
      b.classList.toggle('text-slate-700', !isMatch);
    });

    this.setFontSize(this.fontSize);
  }

  // --- FILTER & SHUFFLE ENGINE (IMMUTABLE) ---
  applyFilters() {
    let list = [...this.rawSets];
    
    // Subject filter
    if (this.selectedSubject !== 'all') {
      list = list.filter(s => s.subject === this.selectedSubject);
    }
    
    // Year filter
    if (this.selectedYear !== 'all') {
      list = list.filter(s => s.year === parseInt(this.selectedYear));
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
      const limit = parseInt(this.selectedLimit);
      list = list.slice(0, limit);
    }
    
    this.filteredSets = list;
    this.currentSetIndex = 0;
    this.activeQuestionIndex = 0;
    
    this.updateShuffleUI();
    this.updateWrongModeUI();
    this.renderCurrentSet();
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
      shuffleBtn.classList.toggle('border-amber-400', this.isShuffled);
      shuffleBtn.classList.toggle('text-amber-900', this.isShuffled);
      shuffleBtn.innerHTML = this.isShuffled 
        ? `🔀 <strong>셔플 ON</strong>` 
        : `🔀 셔플`;
    }
  }

  updateWrongModeUI() {
    const wrongBtn = document.getElementById('wrongFilterBtn');
    const wrongCount = Object.keys(this.wrongHistory).length;
    if (wrongBtn) {
      wrongBtn.classList.toggle('bg-rose-100', this.onlyWrongMode);
      wrongBtn.classList.toggle('border-rose-400', this.onlyWrongMode);
      wrongBtn.classList.toggle('text-rose-900', this.onlyWrongMode);
      wrongBtn.innerHTML = `❌ 오답 (${wrongCount})`;
    }
  }

  bindEvents() {
    // 1. HOME SCREEN INTERACTIONS
    // Subject Cards Selection
    document.querySelectorAll('#homeSubjectCards .setup-card').forEach(card => {
      card.addEventListener('click', () => {
        document.querySelectorAll('#homeSubjectCards .setup-card').forEach(c => {
          c.classList.remove('selected', 'border-indigo-500');
          c.classList.add('border-slate-700');
        });
        card.classList.add('selected', 'border-indigo-500');
        card.classList.remove('border-slate-700');
        this.selectedSubject = card.dataset.val;
        this.syncSavedSettingsToUI();
      });
    });

    // Year Chips Selection
    document.querySelectorAll('#homeYearChips .chip-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#homeYearChips .chip-btn').forEach(b => {
          b.classList.remove('selected', 'bg-indigo-600', 'text-white');
          b.classList.add('bg-slate-800', 'text-slate-300');
        });
        btn.classList.add('selected', 'bg-indigo-600', 'text-white');
        btn.classList.remove('bg-slate-800', 'text-slate-300');
        this.selectedYear = btn.dataset.val;
        this.syncSavedSettingsToUI();
      });
    });

    // Limit Chips Selection
    document.querySelectorAll('#homeLimitChips .chip-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#homeLimitChips .chip-btn').forEach(b => {
          b.classList.remove('selected', 'bg-indigo-600', 'text-white');
          b.classList.add('bg-slate-800', 'text-slate-300');
        });
        btn.classList.add('selected', 'bg-indigo-600', 'text-white');
        btn.classList.remove('bg-slate-800', 'text-slate-300');
        this.selectedLimit = btn.dataset.val;
        this.syncSavedSettingsToUI();
      });
    });

    // Home Options Toggle Checkboxes
    const homeShuffle = document.getElementById('homeShuffleCheckbox');
    if (homeShuffle) {
      homeShuffle.addEventListener('change', (e) => {
        this.isShuffled = e.target.checked;
        this.updateShuffleUI();
      });
    }

    const homeWrong = document.getElementById('homeWrongOnlyCheckbox');
    if (homeWrong) {
      homeWrong.addEventListener('change', (e) => {
        this.onlyWrongMode = e.target.checked;
        this.updateWrongModeUI();
      });
    }

    // Home Big Start Button
    const homeStartBtn = document.getElementById('homeStartBtn');
    if (homeStartBtn) {
      homeStartBtn.addEventListener('click', () => {
        this.showView('exam');
      });
    }

    // Back to Home Button
    const backHomeBtn = document.getElementById('backToHomeBtn');
    if (backHomeBtn) {
      backHomeBtn.addEventListener('click', () => {
        this.showView('home');
      });
    }

    // Mobile Guide Modal
    const mobileGuideBtn = document.getElementById('homeMobileGuideBtn');
    const mobileGuideModal = document.getElementById('mobileGuideModal');
    const closeMobileGuideBtn = document.getElementById('closeMobileGuideBtn');
    const closeMobileGuideBtn2 = document.getElementById('closeMobileGuideBtn2');
    
    if (mobileGuideBtn && mobileGuideModal) {
      mobileGuideBtn.addEventListener('click', () => {
        mobileGuideModal.classList.remove('hidden');
        // Update URL
        const wifiUrlEl = document.getElementById('mobileWifiUrl');
        if (wifiUrlEl) {
          const host = window.location.hostname || 'localhost';
          const port = window.location.port ? `:${window.location.port}` : '';
          wifiUrlEl.textContent = `http://${host}${port}/index.html`;
        }
      });
    }
    if (closeMobileGuideBtn && mobileGuideModal) {
      closeMobileGuideBtn.addEventListener('click', () => mobileGuideModal.classList.add('hidden'));
    }
    if (closeMobileGuideBtn2 && mobileGuideModal) {
      closeMobileGuideBtn2.addEventListener('click', () => mobileGuideModal.classList.add('hidden'));
    }

    // Mobile Tabs (Passage vs Questions)
    const mobileTabPassage = document.getElementById('mobileTabPassage');
    const mobileTabQuestions = document.getElementById('mobileTabQuestions');
    if (mobileTabPassage) {
      mobileTabPassage.addEventListener('click', () => this.setMobileTab('passage'));
    }
    if (mobileTabQuestions) {
      mobileTabQuestions.addEventListener('click', () => this.setMobileTab('questions'));
    }

    // Mobile Settings Modal
    const mobileSettingsBtn = document.getElementById('mobileSettingsBtn');
    const mobileSettingsModal = document.getElementById('mobileSettingsModal');
    const closeMobileSettingsBtn = document.getElementById('closeMobileSettingsBtn');
    const applyMobileSettingsBtn = document.getElementById('applyMobileSettingsBtn');

    if (mobileSettingsBtn && mobileSettingsModal) {
      mobileSettingsBtn.addEventListener('click', () => {
        this.syncSavedSettingsToUI();
        mobileSettingsModal.classList.remove('hidden');
      });
    }
    if (closeMobileSettingsBtn && mobileSettingsModal) {
      closeMobileSettingsBtn.addEventListener('click', () => {
        mobileSettingsModal.classList.add('hidden');
      });
    }

    document.querySelectorAll('.mobile-filter-subject-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.selectedSubject = btn.dataset.subject;
        this.syncSavedSettingsToUI();
      });
    });

    document.querySelectorAll('.mobile-font-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.fontSize = btn.dataset.size;
        this.syncSavedSettingsToUI();
      });
    });

    if (applyMobileSettingsBtn && mobileSettingsModal) {
      applyMobileSettingsBtn.addEventListener('click', () => {
        const mobileYear = document.getElementById('mobileYearSelect');
        const mobileLimit = document.getElementById('mobileLimitSelect');
        const mobileShuffle = document.getElementById('mobileShuffleCheck');
        const mobileWrong = document.getElementById('mobileWrongCheck');

        if (mobileYear) this.selectedYear = mobileYear.value;
        if (mobileLimit) this.selectedLimit = mobileLimit.value;
        if (mobileShuffle) this.isShuffled = mobileShuffle.checked;
        if (mobileWrong) this.onlyWrongMode = mobileWrong.checked;

        this.syncSavedSettingsToUI();
        this.applyFilters();
        mobileSettingsModal.classList.add('hidden');
      });
    }

    // 2. EXAM HEADER CONTROLS
    // Subject Filter Header Buttons
    document.querySelectorAll('.filter-subject-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.selectedSubject = btn.dataset.subject;
        this.syncSavedSettingsToUI();
        this.applyFilters();
      });
    });

    // Year Filter Dropdown
    const yearSelect = document.getElementById('yearFilterSelect');
    if (yearSelect) {
      yearSelect.addEventListener('change', (e) => {
        this.selectedYear = e.target.value;
        this.syncSavedSettingsToUI();
        this.applyFilters();
      });
    }

    // Limit Filter Dropdown
    const limitSelect = document.getElementById('limitFilterSelect');
    if (limitSelect) {
      limitSelect.addEventListener('change', (e) => {
        this.selectedLimit = e.target.value;
        this.syncSavedSettingsToUI();
        this.applyFilters();
      });
    }

    // Shuffle Button
    const shuffleBtn = document.getElementById('shuffleToggleBtn');
    if (shuffleBtn) {
      shuffleBtn.addEventListener('click', () => this.toggleShuffle());
    }

    // Wrong Filter Button
    const wrongBtn = document.getElementById('wrongFilterBtn');
    if (wrongBtn) {
      wrongBtn.addEventListener('click', () => this.toggleWrongMode());
    }

    // Passage Side Toggle
    const sideToggleBtn = document.getElementById('sideToggleBtn');
    if (sideToggleBtn) {
      sideToggleBtn.addEventListener('click', () => this.togglePassageSide());
    }

    // Navigation Buttons
    const prevBtn = document.getElementById('prevSetBtn');
    const nextBtn = document.getElementById('nextSetBtn');
    if (prevBtn) prevBtn.addEventListener('click', () => this.prevSet());
    if (nextBtn) nextBtn.addEventListener('click', () => this.nextSet());

    // Font Sizing
    document.querySelectorAll('.font-size-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.font-size-btn').forEach(b => b.classList.remove('bg-indigo-100', 'text-indigo-700', 'font-bold'));
        btn.classList.add('bg-indigo-100', 'text-indigo-700', 'font-bold');
        this.setFontSize(btn.dataset.size);
      });
    });

    // Highlighter Toggle
    const hlBtn = document.getElementById('highlighterToggleBtn');
    if (hlBtn) {
      hlBtn.addEventListener('click', () => {
        this.isHighlighterActive = !this.isHighlighterActive;
        hlBtn.classList.toggle('bg-amber-100', this.isHighlighterActive);
        hlBtn.classList.toggle('border-amber-400', this.isHighlighterActive);
        hlBtn.classList.toggle('text-amber-700', this.isHighlighterActive);
      });
    }

    // Resizer Split-Pane
    const resizer = document.getElementById('resizerBar');
    const passagePane = document.getElementById('passagePane');
    const container = document.getElementById('mainSplitPane');

    if (resizer && passagePane && container) {
      const onMouseDown = () => {
        this.isDraggingResizer = true;
        resizer.classList.add('dragging');
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
      };

      const onMouseMove = (e) => {
        if (!this.isDraggingResizer) return;
        const rect = container.getBoundingClientRect();
        let offsetX = e.clientX - rect.left;
        let percentage = (offsetX / rect.width) * 100;
        
        if (this.passageSide === 'right') {
          percentage = 100 - percentage;
        }

        percentage = Math.max(25, Math.min(75, percentage));
        passagePane.style.width = `${percentage}%`;
      };

      const onMouseUp = () => {
        if (this.isDraggingResizer) {
          this.isDraggingResizer = false;
          resizer.classList.remove('dragging');
          document.body.style.cursor = '';
          document.body.style.userSelect = '';
        }
      };

      resizer.addEventListener('mousedown', onMouseDown);
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    }

    // --- GLOBAL KEYBOARD SHORTCUTS (PC ENHANCEMENT) ---
    document.addEventListener('keydown', (e) => {
      // Ignore when typing in input or select
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
      if (this.currentView !== 'exam') return;

      const set = this.filteredSets[this.currentSetIndex];
      if (!set || !set.questions.length) return;

      const activeQ = set.questions[this.activeQuestionIndex] || set.questions[0];

      // Number keys 1-5: Select answer option
      if (['1', '2', '3', '4', '5'].includes(e.key)) {
        e.preventDefault();
        const choice = parseInt(e.key);
        this.selectAnswer(activeQ.id, choice);
      }
      // Arrow keys / Bracket keys: Prev/Next Set
      else if (e.key === 'ArrowLeft' || e.key === '[') {
        e.preventDefault();
        this.prevSet();
      }
      else if (e.key === 'ArrowRight' || e.key === ']') {
        e.preventDefault();
        this.nextSet();
      }
      // Space: Check answer for current set
      else if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        this.checkCurrentSet();
      }
      // 'O' key: Toggle OMR Modal
      else if (e.key.toLowerCase() === 'o') {
        e.preventDefault();
        const omrModal = document.getElementById('omrDrawerModal');
        if (omrModal) {
          const isHidden = omrModal.classList.contains('hidden');
          omrModal.classList.toggle('hidden', !isHidden);
        }
      }
      // 'Tab' key: Cycle through questions in multi-question set
      else if (e.key === 'Tab' && set.questions.length > 1) {
        e.preventDefault();
        const nextIdx = (this.activeQuestionIndex + 1) % set.questions.length;
        this.scrollToQuestion(nextIdx);
      }
    });

    // --- MOBILE SWIPE GESTURE SUPPORT (MOBILE ENHANCEMENT) ---
    let touchStartX = 0;
    let touchStartY = 0;
    const splitPane = document.getElementById('mainSplitPane');

    if (splitPane) {
      splitPane.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
      }, { passive: true });

      splitPane.addEventListener('touchend', (e) => {
        if (window.innerWidth >= 1024) return; // Only for mobile/tablet
        const touchEndX = e.changedTouches[0].screenX;
        const touchEndY = e.changedTouches[0].screenY;
        const diffX = touchEndX - touchStartX;
        const diffY = touchEndY - touchStartY;

        // Horizontal swipe detected (threshold: 60px horizontal, less than 50px vertical)
        if (Math.abs(diffX) > 60 && Math.abs(diffY) < 50) {
          if (diffX < 0 && this.mobileTab === 'passage') {
            // Swipe Left -> Go to Questions
            this.setMobileTab('questions');
            if (navigator.vibrate) navigator.vibrate(10);
          } else if (diffX > 0 && this.mobileTab === 'questions') {
            // Swipe Right -> Go to Passage
            this.setMobileTab('passage');
            if (navigator.vibrate) navigator.vibrate(10);
          }
        }
      }, { passive: true });
    }

    // Highlight text selection
    const passageContainer = document.getElementById('passageBody');
    if (passageContainer) {
      passageContainer.addEventListener('mouseup', () => {
        if (!this.isHighlighterActive) return;
        const selection = window.getSelection();
        if (!selection.rangeCount || selection.isCollapsed) return;
        
        const range = selection.getRangeAt(0);
        const selectedText = selection.toString().trim();
        if (!selectedText) return;

        const mark = document.createElement('mark');
        mark.className = `hl-${this.currentHighlightColor}`;
        try {
          range.surroundContents(mark);
        } catch (err) {}
        selection.removeAllRanges();
      });
    }

    // Timer Toggle
    const timerBtn = document.getElementById('timerToggleBtn');
    if (timerBtn) {
      timerBtn.addEventListener('click', () => {
        if (this.isTimerRunning) {
          this.pauseTimer();
        } else {
          this.startTimer();
        }
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
      omrCloseBtn.addEventListener('click', () => {
        omrModal.classList.add('hidden');
      });
    }

    // Final Grade Submit
    const submitBtn = document.getElementById('finalSubmitBtn');
    if (submitBtn) {
      submitBtn.addEventListener('click', () => this.confirmSubmitExam());
    }

    // Result Modal Close & Retry
    const resultModal = document.getElementById('resultReportModal');
    const closeResultBtn = document.getElementById('closeResultModalBtn');
    const retryWrongBtn = document.getElementById('modalRetryWrongBtn');
    
    if (closeResultBtn && resultModal) {
      closeResultBtn.addEventListener('click', () => {
        resultModal.classList.add('hidden');
      });
    }
    if (retryWrongBtn && resultModal) {
      retryWrongBtn.addEventListener('click', () => {
        resultModal.classList.add('hidden');
        this.onlyWrongMode = true;
        this.applyFilters();
      });
    }

    // Reset All Answers Button
    const resetAnswersBtn = document.getElementById('resetAnswersBtn');
    const homeResetAllBtn = document.getElementById('homeResetAllBtn');
    
    const onResetAll = () => {
      if (confirm('저장된 모든 문제의 풀이 기록과 오답 노트를 초기화하시겠습니까?')) {
        this.userAnswers = {};
        this.checkedSets = {};
        this.wrongHistory = {};
        this.isExamSubmitted = false;
        this.saveToStorage();
        this.applyFilters();
        this.updateHomeDashboard();
        alert('기록이 초기화되었습니다.');
      }
    };

    if (resetAnswersBtn) resetAnswersBtn.addEventListener('click', onResetAll);
    if (homeResetAllBtn) homeResetAllBtn.addEventListener('click', onResetAll);

    // Shortcuts Guide Modal Listeners
    const shortcutsBtn = document.getElementById('shortcutsGuideBtn');
    const shortcutsModal = document.getElementById('shortcutsModal');
    const closeShortcutsBtn = document.getElementById('closeShortcutsModalBtn');
    const closeShortcutsBtn2 = document.getElementById('closeShortcutsModalBtn2');

    if (shortcutsBtn && shortcutsModal) {
      shortcutsBtn.addEventListener('click', () => {
        shortcutsModal.classList.remove('hidden');
      });
    }
    if (closeShortcutsBtn && shortcutsModal) {
      closeShortcutsBtn.addEventListener('click', () => {
        shortcutsModal.classList.add('hidden');
      });
    }
    if (closeShortcutsBtn2 && shortcutsModal) {
      closeShortcutsBtn2.addEventListener('click', () => {
        shortcutsModal.classList.add('hidden');
      });
    }
  }

  togglePassageSide() {
    const mainContainer = document.getElementById('mainSplitPane');
    const passagePane = document.getElementById('passagePane');
    const questionsPane = document.getElementById('questionsPane');
    const resizer = document.getElementById('resizerBar');
    const btn = document.getElementById('sideToggleBtn');

    if (this.passageSide === 'left') {
      this.passageSide = 'right';
      mainContainer.innerHTML = '';
      mainContainer.appendChild(questionsPane);
      mainContainer.appendChild(resizer);
      mainContainer.appendChild(passagePane);
      passagePane.classList.remove('border-r');
      passagePane.classList.add('border-l');
      if (btn) btn.innerHTML = `🔄 지문: <strong>오른쪽</strong>`;
    } else {
      this.passageSide = 'left';
      mainContainer.innerHTML = '';
      mainContainer.appendChild(passagePane);
      mainContainer.appendChild(resizer);
      mainContainer.appendChild(questionsPane);
      passagePane.classList.remove('border-l');
      passagePane.classList.add('border-r');
      if (btn) btn.innerHTML = `🔄 지문: <strong>왼쪽</strong>`;
    }
    this.saveToStorage();
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
    this.saveToStorage();
  }

  startTimer() {
    this.isTimerRunning = true;
    const timerIcon = document.getElementById('timerPlayIcon');
    if (timerIcon) timerIcon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />`;
    
    clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      this.timerSeconds++;
      this.updateTimerDisplay();
    }, 1000);
  }

  pauseTimer() {
    this.isTimerRunning = false;
    clearInterval(this.timerInterval);
    const timerIcon = document.getElementById('timerPlayIcon');
    if (timerIcon) timerIcon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />`;
  }

  updateTimerDisplay() {
    const mins = Math.floor(this.timerSeconds / 60);
    const secs = this.timerSeconds % 60;
    const display = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    const el = document.getElementById('timerDisplay');
    if (el) el.textContent = display;
  }

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

  jumpToSet(index) {
    if (index >= 0 && index < this.filteredSets.length) {
      this.currentSetIndex = index;
      this.activeQuestionIndex = 0;
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

  renderCurrentSet() {
    if (!this.filteredSets.length) {
      this.renderEmptyState();
      return;
    }

    const set = this.filteredSets[this.currentSetIndex];
    
    // Set Navigation info
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

    // Render Left Pane (Set Passage)
    this.renderPassage(set);

    // Render Right Pane (Questions & Tabs)
    this.renderQuestionTabs(set);
    this.renderQuestions(set);

    // Update OMR and stats
    this.updateStatsBar();
  }

  renderEmptyState() {
    const passageBody = document.getElementById('passageBody');
    const questionsContainer = document.getElementById('questionsContainer');
    const tabsContainer = document.getElementById('setQuestionTabs');
    if (tabsContainer) tabsContainer.innerHTML = '';
    
    const emptyMsg = this.onlyWrongMode 
      ? '🎉 등록된 오답이 없습니다! 모든 문제를 맞히셨거나 오답 노트가 비어 있습니다.' 
      : '선택하신 조건에 일치하는 문항이 없습니다.';
      
    if (passageBody) passageBody.innerHTML = `<div class="p-8 text-center text-slate-400 font-medium">${emptyMsg}</div>`;
    if (questionsContainer) questionsContainer.innerHTML = `<div class="p-8 text-center text-slate-400 font-medium">${emptyMsg}</div>`;
  }

  renderPassage(set) {
    const titleEl = document.getElementById('passageTitle');
    const badgesEl = document.getElementById('passageBadges');
    const charCountEl = document.getElementById('passageCharCount');
    const bodyEl = document.getElementById('passageBody');

    if (titleEl) titleEl.textContent = set.title;
    
    if (badgesEl) {
      const subjectColor = set.subject === '언어이해' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-indigo-100 text-indigo-800 border-indigo-300';
      badgesEl.innerHTML = `
        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${subjectColor}">${set.subject}</span>
        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-300">${set.year}학년도</span>
        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-300">${set.setName} (${set.questionRange}번)</span>
        ${set.questions.length > 1 ? `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">🔥 3 in 1 세트</span>` : ''}
        ${this.isShuffled ? `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">🔀 셔플</span>` : ''}
      `;
    }

    if (charCountEl) {
      charCountEl.textContent = `${set.passage.length.toLocaleString()}자`;
    }

    if (bodyEl) {
      if (!set.passage.trim()) {
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
      const userAns = this.userAnswers[q.id];
      const isSetChecked = this.checkedSets[set.id] || this.isExamSubmitted;
      const isCorrect = userAns === q.answer;
      const isActive = this.activeQuestionIndex === idx;

      let badgeIcon = '미응답';
      let badgeStyle = 'bg-slate-100 text-slate-500';

      if (userAns !== undefined) {
        badgeIcon = `${userAns}번 선택`;
        badgeStyle = 'bg-indigo-100 text-indigo-700 font-bold';
      }

      if (isSetChecked) {
        if (userAns === undefined) {
          badgeIcon = '미응답';
          badgeStyle = 'bg-slate-100 text-slate-400';
        } else if (isCorrect) {
          badgeIcon = '✓ 정답';
          badgeStyle = 'bg-emerald-100 text-emerald-800 font-bold';
        } else {
          badgeIcon = '✕ 오답';
          badgeStyle = 'bg-rose-100 text-rose-800 font-bold';
        }
      }

      const activeClass = isActive 
        ? 'bg-white text-slate-900 shadow-sm border border-slate-200' 
        : 'text-slate-600 hover:bg-white/60';

      tabsHTML += `
        <button 
          onclick="window.leetApp.scrollToQuestion(${idx})"
          class="flex-1 flex items-center justify-between gap-1 sm:gap-2 px-2.5 sm:px-3 py-2 rounded-lg text-xs font-bold transition ${activeClass}"
        >
          <span>문제 ${q.qNum}번</span>
          <span class="px-1.5 py-0.5 rounded text-[10px] ${badgeStyle}">${badgeIcon}</span>
        </button>
      `;
    });

    tabsHTML += '</div>';
    tabsContainer.innerHTML = tabsHTML;

    const mobileQBadge = document.getElementById('mobileQBadge');
    if (mobileQBadge) {
      let answered = 0;
      set.questions.forEach(q => {
        if (this.userAnswers[q.id] !== undefined) answered++;
      });
      mobileQBadge.textContent = `${answered}/${set.questions.length}`;
    }
  }

  renderQuestions(set) {
    const container = document.getElementById('questionsContainer');
    if (!container) return;

    const isSetChecked = this.checkedSets[set.id] || this.isExamSubmitted;

    let setAnsweredCount = 0;
    let setCorrectCount = 0;
    set.questions.forEach(q => {
      const ans = this.userAnswers[q.id];
      if (ans !== undefined) {
        setAnsweredCount++;
        if (ans === q.answer) setCorrectCount++;
      }
    });

    let questionsHTML = '';

    // Set Result Banner
    if (isSetChecked) {
      const allCorrect = setCorrectCount === set.questions.length;
      const bannerBg = allCorrect ? 'bg-emerald-50 border-emerald-300 text-emerald-900' : 'bg-indigo-50 border-indigo-300 text-indigo-900';
      const icon = allCorrect ? '🎉 완벽합니다!' : '📊 채점 완료';

      questionsHTML += `
        <div class="set-result-banner mb-6 border rounded-xl p-4 flex items-center justify-between gap-3 ${bannerBg}">
          <div class="flex items-center gap-3">
            <span class="text-2xl">${allCorrect ? '🏆' : '📝'}</span>
            <div>
              <h4 class="font-extrabold text-sm">${icon}</h4>
              <p class="text-xs mt-0.5 opacity-90">
                총 ${set.questions.length}문제 중 <strong>${setCorrectCount}문제 정답</strong> (정답률 ${((setCorrectCount / set.questions.length) * 100).toFixed(0)}%)
              </p>
            </div>
          </div>
          <button 
            onclick="window.leetApp.resetCurrentSet('${set.id}')"
            class="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-white text-slate-800 hover:bg-slate-50 border border-slate-300 shadow-sm transition"
          >
            🔄 다시 풀기
          </button>
        </div>
      `;
    }

    // Render question cards
    set.questions.forEach((q, idx) => {
      const selectedOpt = this.userAnswers[q.id];
      const isCorrect = selectedOpt === q.answer;

      let statusBadge = '';
      if (isSetChecked) {
        if (selectedOpt === undefined) {
          statusBadge = `<span class="px-2.5 py-1 rounded-md text-xs font-bold bg-slate-100 text-slate-600">미응답 (정답: ${q.answer}번)</span>`;
        } else if (isCorrect) {
          statusBadge = `<span class="px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">✓ ${selectedOpt}번 정답!</span>`;
        } else {
          statusBadge = `<span class="px-2.5 py-1 rounded-md text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1">✕ 오답 (선택: ${selectedOpt}번 / 정답: ${q.answer}번)</span>`;
        }
      }

      // Options ①~⑤
      const circledNums = ['①', '②', '③', '④', '⑤'];
      let optionsHTML = '<div class="space-y-2.5 mb-2">';
      
      q.options.forEach((optText, optIdx) => {
        const optNum = optIdx + 1;
        const isSelected = selectedOpt === optNum;
        
        let optStyle = 'border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/40 bg-white text-slate-800';
        let circleStyle = 'bg-slate-100 text-slate-700 border-slate-300';
        
        if (isSelected) {
          optStyle = 'border-indigo-600 bg-indigo-50/80 text-indigo-950 font-semibold ring-2 ring-indigo-500/20';
          circleStyle = 'bg-indigo-600 text-white border-indigo-600';
        }

        if (isSetChecked) {
          if (optNum === q.answer) {
            optStyle = 'border-emerald-500 bg-emerald-50 text-emerald-950 font-bold ring-2 ring-emerald-500/30';
            circleStyle = 'bg-emerald-600 text-white border-emerald-600';
          } else if (isSelected && !isCorrect) {
            optStyle = 'border-rose-500 bg-rose-50 text-rose-950 line-through opacity-80';
            circleStyle = 'bg-rose-600 text-white border-rose-600';
          }
        }

        optionsHTML += `
          <div 
            class="option-item flex items-start gap-3 p-3.5 rounded-lg border cursor-pointer ${optStyle}"
            onclick="window.leetApp.selectOption('${q.id}', ${optNum})"
          >
            <span class="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border transition ${circleStyle}">
              ${circledNums[optIdx]}
            </span>
            <div class="flex-1 text-sm leading-relaxed pt-0.5">
              ${this.formatInlineText(optText)}
            </div>
          </div>
        `;
      });
      optionsHTML += '</div>';

      questionsHTML += `
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6 mb-6 transition" id="qCard_idx_${idx}">
          <div class="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                🏷️ ${q.tag}
              </span>
              ${this.wrongHistory[q.id] ? `<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">❌ 오답 기록</span>` : ''}
            </div>
            <div>${statusBadge}</div>
          </div>

          <div class="text-slate-900 font-semibold text-base mb-4 leading-relaxed">
            ${this.formatInlineText(q.prompt)}
          </div>

          ${q.box && q.box.trim() ? `
            <div class="leet-box mb-5 text-slate-800 font-passage text-sm sm:text-base">
              ${this.formatInlineText(q.box)}
            </div>
          ` : ''}

          ${optionsHTML}
        </div>
      `;
    });

    // Big Set Submit Button
    const isReadyToSubmit = setAnsweredCount === set.questions.length;
    const submitBtnText = isSetChecked
      ? '🔄 이 세트 다시 풀기'
      : (set.questions.length > 1 
          ? `✨ 이 세트 제출 및 정답 확인 (3문제 동시 채점)` 
          : `✨ 제출 및 정답 확인`);

    const submitBtnClass = isSetChecked
      ? 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300'
      : (isReadyToSubmit
          ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg ring-4 ring-indigo-500/20'
          : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md');

    questionsHTML += `
      <div class="sticky bottom-0 bg-white/95 backdrop-blur border border-slate-200 rounded-2xl p-4 shadow-lg flex items-center justify-between gap-4 mt-8 z-20">
        <div class="text-xs text-slate-600">
          ${set.questions.length > 1 ? `현재 세트: <strong>${setAnsweredCount} / ${set.questions.length} 문제</strong> 선택됨` : `문제 선택: ${setAnsweredCount > 0 ? '완료' : '미선택'}`}
        </div>
        <button 
          onclick="window.leetApp.toggleSubmitCurrentSet('${set.id}')"
          class="px-5 sm:px-6 py-3 rounded-xl text-xs sm:text-sm font-extrabold transition flex items-center gap-2 ${submitBtnClass}"
        >
          ${submitBtnText}
        </button>
      </div>
    `;

    container.innerHTML = questionsHTML;
  }

  selectOption(qId, optNum) {
    const currentSet = this.filteredSets[this.currentSetIndex];
    if (this.checkedSets[currentSet.id] || this.isExamSubmitted) return;
    
    try { if (navigator.vibrate) navigator.vibrate(10); } catch(e) {}
    
    if (this.userAnswers[qId] === optNum) {
      delete this.userAnswers[qId];
    } else {
      this.userAnswers[qId] = optNum;
    }
    
    this.saveToStorage();
    this.renderQuestionTabs(currentSet);
    this.renderQuestions(currentSet);
    this.renderOMR();
    this.updateStatsBar();
  }

  toggleSubmitCurrentSet(setId) {
    if (this.checkedSets[setId]) {
      this.resetCurrentSet(setId);
    } else {
      this.checkedSets[setId] = true;
      
      const set = this.filteredSets[this.currentSetIndex];
      set.questions.forEach(q => {
        const userAns = this.userAnswers[q.id];
        if (userAns !== q.answer) {
          this.wrongHistory[q.id] = {
            qId: q.id,
            setId: set.id,
            year: set.year,
            subject: set.subject,
            qNum: q.qNum,
            tag: q.tag,
            userAns: userAns || null,
            correctAns: q.answer,
            timestamp: new Date().toISOString()
          };
        } else {
          delete this.wrongHistory[q.id];
        }
      });

      this.saveToStorage();
      this.updateWrongModeUI();
      this.renderCurrentSet();
      this.renderOMR();
      this.updateStatsBar();
      this.scrollToTop();
    }
  }

  resetCurrentSet(setId) {
    const currentSet = this.filteredSets[this.currentSetIndex];
    delete this.checkedSets[setId];
    currentSet.questions.forEach(q => {
      delete this.userAnswers[q.id];
    });
    this.saveToStorage();
    this.renderCurrentSet();
    this.renderOMR();
    this.updateStatsBar();
  }

  updateStatsBar() {
    let totalQuestions = 0;
    let answeredCount = 0;
    let correctCount = 0;

    this.filteredSets.forEach(s => {
      s.questions.forEach(q => {
        totalQuestions++;
        const ans = this.userAnswers[q.id];
        if (ans !== undefined) {
          answeredCount++;
          if (ans === q.answer) {
            correctCount++;
          }
        }
      });
    });

    const progressEl = document.getElementById('progressStatusText');
    const progressBar = document.getElementById('progressBarFill');
    const scoreBadge = document.getElementById('headerScoreBadge');

    if (progressEl) {
      progressEl.textContent = `${answeredCount} / ${totalQuestions} 풀이 완료`;
    }
    if (progressBar && totalQuestions > 0) {
      const pct = (answeredCount / totalQuestions) * 100;
      progressBar.style.width = `${pct}%`;
    }
    if (scoreBadge) {
      scoreBadge.textContent = `${correctCount}개 정답`;
    }
  }

  renderOMR() {
    const grid = document.getElementById('omrGridContainer');
    if (!grid) return;

    grid.innerHTML = '';

    this.filteredSets.forEach((set, sIdx) => {
      const isSetChecked = this.checkedSets[set.id] || this.isExamSubmitted;
      const isCurrent = sIdx === this.currentSetIndex;

      const setCard = document.createElement('div');
      setCard.className = `p-3 rounded-xl border transition ${
        isCurrent ? 'bg-indigo-50/80 border-indigo-300 ring-2 ring-indigo-500/20' : 'bg-white border-slate-200'
      }`;

      let questionsHTML = '';
      set.questions.forEach(q => {
        const userAns = this.userAnswers[q.id];
        const isCorrect = userAns === q.answer;

        let badgeClass = 'bg-slate-100 text-slate-600 border-slate-200';
        let statusIcon = userAns !== undefined ? `${userAns}번` : '-';

        if (userAns !== undefined) {
          badgeClass = 'bg-indigo-100 text-indigo-800 border-indigo-300 font-bold';
        }

        if (isSetChecked) {
          if (userAns === undefined) {
            badgeClass = 'bg-slate-100 text-slate-400 border-slate-200';
          } else if (isCorrect) {
            badgeClass = 'bg-emerald-100 text-emerald-800 border-emerald-400 font-bold';
            statusIcon = `${userAns}번 ✓`;
          } else {
            badgeClass = 'bg-rose-100 text-rose-800 border-rose-400 font-bold';
            statusIcon = `${userAns}번 ✕`;
          }
        }

        questionsHTML += `
          <div class="flex items-center justify-between text-xs py-1 border-b border-slate-100 last:border-0">
            <span class="text-slate-600 font-medium">${q.qNum}번</span>
            <span class="px-2 py-0.5 rounded border ${badgeClass}">${statusIcon}</span>
          </div>
        `;
      });

      setCard.innerHTML = `
        <div class="flex items-center justify-between mb-2 cursor-pointer" onclick="window.leetApp.jumpToSet(${sIdx})">
          <span class="text-xs font-bold text-slate-800">${set.title}</span>
          <span class="text-[10px] text-indigo-600 font-semibold hover:underline">이동 ➔</span>
        </div>
        <div class="space-y-1">
          ${questionsHTML}
        </div>
      `;

      grid.appendChild(setCard);
    });
  }

  confirmSubmitExam() {
    let totalQuestions = 0;
    let answeredCount = 0;
    let correctCount = 0;
    const wrongList = [];

    this.filteredSets.forEach(s => {
      this.checkedSets[s.id] = true;
      s.questions.forEach(q => {
        totalQuestions++;
        const ans = this.userAnswers[q.id];
        if (ans !== undefined) {
          answeredCount++;
          if (ans === q.answer) {
            correctCount++;
            delete this.wrongHistory[q.id];
          } else {
            wrongList.push({ q, userAns: ans, set: s });
            this.wrongHistory[q.id] = {
              qId: q.id,
              setId: s.id,
              year: s.year,
              subject: s.subject,
              qNum: q.qNum,
              tag: q.tag,
              userAns: ans,
              correctAns: q.answer,
              timestamp: new Date().toISOString()
            };
          }
        } else {
          wrongList.push({ q, userAns: null, set: s });
          this.wrongHistory[q.id] = {
            qId: q.id,
            setId: s.id,
            year: s.year,
            subject: s.subject,
            qNum: q.qNum,
            tag: q.tag,
            userAns: null,
            correctAns: q.answer,
            timestamp: new Date().toISOString()
          };
        }
      });
    });

    this.isExamSubmitted = true;
    this.pauseTimer();
    this.saveToStorage();
    this.updateWrongModeUI();
    this.renderCurrentSet();
    this.renderOMR();
    this.showResultModal(totalQuestions, answeredCount, correctCount, wrongList);
  }

  showResultModal(total, answered, correct, wrongList) {
    const modal = document.getElementById('resultReportModal');
    if (!modal) return;

    const rate = total > 0 ? ((correct / total) * 100).toFixed(1) : 0;
    const mins = Math.floor(this.timerSeconds / 60);
    const secs = this.timerSeconds % 60;

    document.getElementById('resultTotalScore').textContent = `${correct} / ${total}`;
    document.getElementById('resultAccuracyRate').textContent = `${rate}%`;
    document.getElementById('resultTimeSpent').textContent = `${mins}분 ${secs}초`;
    document.getElementById('resultAnsweredCount').textContent = `${answered}개 풀이 (${total - answered}개 미응답)`;

    const wrongContainer = document.getElementById('resultWrongListContainer');
    if (wrongContainer) {
      if (wrongList.length === 0) {
        wrongContainer.innerHTML = `<div class="p-6 text-center text-emerald-600 font-bold">🎉 모든 문제를 맞히셨습니다! 완벽합니다!</div>`;
      } else {
        wrongContainer.innerHTML = wrongList.map(item => `
          <div class="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm">
            <div>
              <span class="font-bold text-slate-800">[${item.q.tag}]</span>
              <span class="text-xs text-slate-500 ml-2">${item.set.setName}</span>
            </div>
            <div class="flex items-center gap-3">
              <span class="text-xs text-rose-600 font-semibold">선택: ${item.userAns ? item.userAns + '번' : '미응답'}</span>
              <span class="text-xs text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-300">정답: ${item.q.answer}번</span>
            </div>
          </div>
        `).join('');
      }
    }

    modal.classList.remove('hidden');
  }
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
  window.leetApp = new LeetApp();
});
