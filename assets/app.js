/* =========================================================
   工程识图与标注 · 复习站
   Vanilla JS: routing, progress, search, labs, quiz
   ========================================================= */

(() => {
  "use strict";

  const CHAPTER_IDS = ["projection", "reading", "section", "dimension", "precision", "standards", "assembly"];
  const STORAGE = {
    theme: "edg.theme.v1",
    mastered: "edg.mastered.v1",
    quiz: "edg.quiz.v1",
    wrong: "edg.wrong.v1"
  };

  const $ = (selector, context = document) => context.querySelector(selector);
  const $$ = (selector, context = document) => Array.from(context.querySelectorAll(selector));

  const storage = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch (error) {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (error) {
        /* Storage may be unavailable in private mode. */
      }
    }
  };

  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[char]));

  const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const normalize = (value) => String(value).replace(/\s+/g, " ").trim();

  function shuffle(items) {
    const copy = items.slice();
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  let toastTimer = 0;
  function toast(message) {
    const node = $("#toast");
    if (!node) return;
    node.textContent = message;
    node.classList.add("is-visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => node.classList.remove("is-visible"), 2400);
  }

  /* ---------------------------------------------------------
     Theme + mobile nav
     --------------------------------------------------------- */

  const themeButton = $("#theme-toggle");
  const themeIconUse = $("#theme-icon use");

  function syncThemeButton() {
    const isBlueprint = document.documentElement.dataset.theme === "blueprint";
    if (themeButton) themeButton.setAttribute("aria-label", isBlueprint ? "切换到纸稿模式" : "切换蓝图模式");
    if (themeIconUse) themeIconUse.setAttribute("href", isBlueprint ? "#icon-sun" : "#icon-moon");
  }

  if (themeButton) {
    themeButton.addEventListener("click", () => {
      const next = document.documentElement.dataset.theme === "blueprint" ? "paper" : "blueprint";
      document.documentElement.dataset.theme = next;
      storage.set(STORAGE.theme, next);
      syncThemeButton();
      toast(next === "blueprint" ? "已切换到蓝图模式" : "已切换到纸稿模式");
    });
  }
  syncThemeButton();

  const mobileButton = $("#mobile-menu");
  const mainNav = $("#main-nav");
  function closeMobileNav() {
    if (!mainNav || !mobileButton) return;
    mainNav.classList.remove("is-open");
    mobileButton.setAttribute("aria-expanded", "false");
  }
  if (mobileButton && mainNav) {
    mobileButton.addEventListener("click", () => {
      const open = !mainNav.classList.contains("is-open");
      mainNav.classList.toggle("is-open", open);
      mobileButton.setAttribute("aria-expanded", String(open));
    });
    $$("a", mainNav).forEach((link) => link.addEventListener("click", closeMobileNav));
  }

  /* ---------------------------------------------------------
     Chapter mastery
     --------------------------------------------------------- */

  let mastered = new Set(
    (storage.get(STORAGE.mastered, []) || []).filter((id) => CHAPTER_IDS.includes(id))
  );

  function renderProgress() {
    const count = mastered.size;

    $$("[data-chapter-card]").forEach((card) => {
      const id = card.dataset.chapterCard;
      const done = mastered.has(id);
      const state = $("[data-state]", card);
      const bar = $("[data-card-progress]", card);
      if (state) {
        state.textContent = done ? "已掌握" : "未完成";
        state.classList.toggle("is-done", done);
      }
      if (bar) bar.style.width = done ? "100%" : "0%";
    });

    $$("[data-rail]").forEach((link) => {
      link.classList.toggle("is-mastered", mastered.has(link.dataset.rail));
    });

    $$("[data-master]").forEach((button) => {
      const done = mastered.has(button.dataset.master);
      button.classList.toggle("is-mastered", done);
      button.setAttribute("aria-pressed", String(done));
      const label = $("span", button);
      if (label) label.textContent = done ? "已掌握 · 点击取消" : "标记本章已掌握";
    });

    $$("[data-rail-progress]").forEach((bar) => { bar.style.width = `${(count / CHAPTER_IDS.length) * 100}%`; });
    $$("[data-course-progress]").forEach((bar) => { bar.style.width = `${(count / CHAPTER_IDS.length) * 100}%`; });
    $$("[data-rail-count]").forEach((node) => { node.textContent = `${count} / ${CHAPTER_IDS.length}`; });
    $$("[data-course-count]").forEach((node) => { node.textContent = `${count} / ${CHAPTER_IDS.length} MASTERED`; });
  }

  $$("[data-master]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.master;
      if (mastered.has(id)) {
        mastered.delete(id);
        toast("已取消本章的掌握标记");
      } else {
        mastered.add(id);
        toast(mastered.size === CHAPTER_IDS.length ? "七章全部掌握，可以去做结业自测了" : "已标记本章掌握");
      }
      storage.set(STORAGE.mastered, [...mastered]);
      renderProgress();
    });
  });

  renderProgress();

  /* ---------------------------------------------------------
     Router
     --------------------------------------------------------- */

  let currentView = "";
  let currentChapter = "";
  let pendingTopic = "";

  function setNav(viewName) {
    const map = {
      home: "home",
      learn: "learn",
      train: "train",
      reference: "reference",
      quiz: "quiz"
    };
    $$(".main-nav a").forEach((link) => {
      const active = link.dataset.nav === map[viewName];
      if (active) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
  }

  function showView(viewName) {
    let target = $(`[data-view="${viewName}"]`);
    if (!target) {
      viewName = "home";
      target = $('[data-view="home"]');
    }
    $$(".view").forEach((view) => { view.hidden = view !== target; });
    target.hidden = false;
    setNav(viewName);
    closeMobileNav();
    const changed = currentView !== viewName;
    currentView = viewName;
    if (changed) window.scrollTo({ top: 0, behavior: "auto" });
    return changed;
  }

  function showChapter(chapterId, topicId = "") {
    const articles = $$(".chapter");
    let target = $(`.chapter[data-chapter="${chapterId}"]`);
    if (!target) {
      chapterId = CHAPTER_IDS[0];
      target = $('.chapter[data-chapter="projection"]');
    }
    articles.forEach((article) => { article.hidden = article !== target; });

    $$("[data-rail]").forEach((link) => {
      if (link.dataset.rail === chapterId) link.setAttribute("aria-current", "true");
      else link.removeAttribute("aria-current");
    });

    const title = normalize($("h1", target).textContent);
    document.title = `${title} · 工程识图与标注`;
    const changed = currentChapter !== chapterId;
    currentChapter = chapterId;

    if (topicId) {
      pendingTopic = topicId;
      window.setTimeout(() => {
        const topic = document.getElementById(topicId);
        if (topic) topic.scrollIntoView({ behavior: "smooth", block: "start" });
        pendingTopic = "";
      }, 80);
    } else if (changed) {
      window.scrollTo({ top: 0, behavior: "auto" });
    }
  }

  function route() {
    const raw = location.hash.replace(/^#\/?/, "");
    const parts = raw.split("/").filter(Boolean);
    const view = parts[0] || "home";

    if (view === "learn") {
      showView("learn");
      showChapter(parts[1] || "projection", parts[2] || "");
      return;
    }

    if (view === "train" || view === "reference" || view === "quiz" || view === "home") {
      showView(view);
      const titles = {
        train: "识图训练 · 工程识图与标注",
        reference: "一页速查 · 工程识图与标注",
        quiz: "模拟测验 · 工程识图与标注",
        home: "工程识图与标注 · 系统复习站"
      };
      document.title = titles[view];
      return;
    }

    showView("home");
    document.title = "工程识图与标注 · 系统复习站";
  }

  function go(path) {
    const nextHash = `#/${path}`;
    if (location.hash === nextHash) route();
    else location.hash = nextHash;
  }

  window.addEventListener("hashchange", route);
  route();

  /* ---------------------------------------------------------
     Search
     --------------------------------------------------------- */

  const searchDialog = $("#search-dialog");
  const searchInput = $("#search-input");
  const searchResults = $("#search-results");
  const searchOpen = $("#search-open");
  const searchClose = $("#search-close");

  const searchIndex = [];
  $$(".chapter").forEach((article) => {
    const chapterId = article.dataset.chapter;
    const chapterTitle = normalize($("h1", article).textContent);
    $$(".topic", article).forEach((topic) => {
      const title = normalize($("h2", topic).textContent).replace(/^[0-9.]+\s*/, "");
      searchIndex.push({
        chapterId,
        chapterTitle,
        topicId: topic.id,
        title,
        keywords: topic.dataset.keywords || "",
        text: normalize(topic.textContent)
      });
    });
  });

  function highlight(text, query) {
    const safe = escapeHtml(text);
    if (!query) return safe;
    return safe.replace(new RegExp(`(${escapeRegExp(query)})`, "gi"), "<mark>$1</mark>");
  }

  function buildSnippet(text, query) {
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const index = lowerText.indexOf(lowerQuery);
    let start = Math.max(0, index - 42);
    let end = Math.min(text.length, start + 118);
    if (index < 0) start = 0;
    let snippet = text.slice(start, end);
    if (start > 0) snippet = `…${snippet}`;
    if (end < text.length) snippet = `${snippet}…`;
    return highlight(snippet, query);
  }

  function runSearch(query) {
    const q = normalize(query);
    if (!searchResults) return;
    if (!q) {
      searchResults.innerHTML = '<p class="search-empty">输入关键词，搜索 33 个知识专题。</p>';
      return;
    }

    const lower = q.toLowerCase();
    const matches = [];
    searchIndex.forEach((item) => {
      const titleHit = item.title.toLowerCase().includes(lower) || item.chapterTitle.toLowerCase().includes(lower);
      const keywordHit = item.keywords.toLowerCase().includes(lower);
      const textHit = item.text.toLowerCase().includes(lower);
      if (!titleHit && !keywordHit && !textHit) return;
      matches.push({
        ...item,
        score: (titleHit ? 3 : 0) + (keywordHit ? 2 : 0) + (textHit ? 1 : 0)
      });
    });
    matches.sort((a, b) => b.score - a.score);

    if (!matches.length) {
      searchResults.innerHTML = `<p class="search-empty">没有找到“${escapeHtml(q)}”。试试“半剖”“Ra”“H7/g6”或“明细栏”。</p>`;
      return;
    }

    searchResults.innerHTML = matches.slice(0, 9).map((item) => `
      <button class="search-result" type="button" data-chapter="${item.chapterId}" data-topic="${item.topicId}">
        <span class="result-kicker">${escapeHtml(item.chapterTitle)} / ${escapeHtml(item.topicId)}</span>
        <span class="result-title">${highlight(item.title, q)}</span>
        <span class="result-snippet">${buildSnippet(item.text, q)}</span>
      </button>
    `).join("");

    $$(".search-result", searchResults).forEach((button) => {
      button.addEventListener("click", () => {
        const chapterId = button.dataset.chapter;
        const topicId = button.dataset.topic;
        if (searchDialog) searchDialog.close();
        go(`learn/${chapterId}/${topicId}`);
      });
    });
  }

  function openSearch() {
    if (!searchDialog) return;
    if (!searchDialog.open) searchDialog.showModal();
    window.setTimeout(() => {
      if (searchInput) {
        searchInput.focus();
        searchInput.select();
      }
    }, 30);
  }

  if (searchOpen) searchOpen.addEventListener("click", openSearch);
  if (searchClose) searchClose.addEventListener("click", () => searchDialog && searchDialog.close());
  if (searchDialog) {
    searchDialog.addEventListener("click", (event) => {
      if (event.target === searchDialog) searchDialog.close();
    });
    searchDialog.addEventListener("close", () => {
      if (searchOpen) searchOpen.focus({ preventScroll: true });
    });
  }
  if (searchInput) {
    searchInput.addEventListener("input", () => runSearch(searchInput.value));
    searchInput.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown") {
        const first = $(".search-result", searchResults);
        if (first) {
          event.preventDefault();
          first.focus();
        }
      }
      if (event.key === "ArrowUp") {
        const results = $$(".search-result", searchResults);
        if (results.length) {
          event.preventDefault();
          results[results.length - 1].focus();
        }
      }
      if (event.key === "Enter") {
        const first = $(".search-result", searchResults);
        if (first) {
          event.preventDefault();
          first.click();
        }
      }
    });
  }
  if (searchResults) {
    searchResults.addEventListener("keydown", (event) => {
      const results = $$(".search-result", searchResults);
      if (!results.length) return;
      const current = results.indexOf(document.activeElement);
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const step = event.key === "ArrowDown" ? 1 : -1;
        const next = current < 0 ? 0 : (current + step + results.length) % results.length;
        results[next].focus();
      }
      if (event.key === "Escape") {
        event.preventDefault();
        if (searchDialog) searchDialog.close();
      }
    });
  }
  $$(".search-hints button").forEach((button) => {
    button.addEventListener("click", () => {
      if (!searchInput) return;
      searchInput.value = button.dataset.query;
      runSearch(button.dataset.query);
      searchInput.focus();
    });
  });

  document.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    const isEditing = /^(input|textarea|select)$/i.test(document.activeElement.tagName) || document.activeElement.isContentEditable;
    if ((event.ctrlKey || event.metaKey) && key === "k") {
      event.preventDefault();
      openSearch();
    } else if (key === "/" && !isEditing) {
      event.preventDefault();
      openSearch();
    }
  });

  /* ---------------------------------------------------------
     Diagram interactions: three views + sections
     --------------------------------------------------------- */

  const threeViewButtons = $$("[data-three-view]");
  const threeViewCaption = $("#three-view-caption");
  const threeViewText = {
    front: "<strong>主视图：</strong>由前向后投射，反映“长”和“高”。它与俯视图长对正，与左视图高平齐。",
    top: "<strong>俯视图：</strong>由上向下投射，反映“长”和“宽”。它与主视图长对正，与左视图宽相等。",
    left: "<strong>左视图：</strong>由左向右投射，反映“高”和“宽”。它与主视图高平齐，与俯视图宽相等。",
    all: "<strong>显示全部：</strong>主视图与俯视图“长对正”，主视图与左视图“高平齐”，俯视图与左视图“宽相等”。"
  };
  threeViewButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const mode = button.dataset.threeView;
      threeViewButtons.forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
      $$("[data-view-part]").forEach((part) => {
        const active = mode === "all" || part.dataset.viewPart === mode;
        part.classList.toggle("is-muted", !active);
      });
      if (threeViewCaption) threeViewCaption.innerHTML = threeViewText[mode];
    });
  });

  const sectionButtons = $$("[data-section-mode]");
  const sectionCaption = $("#section-mode-caption");
  const sectionText = {
    full: "<strong>全剖：</strong>适用范围最广，尤其适合外形简单、内部结构复杂或不对称的零件。剖切后整个内部结构一次表达清楚。",
    half: "<strong>半剖：</strong>用于基本对称的零件。一半表达外形，一半表达内形；分界用细点画线，不能画成粗实线。",
    local: "<strong>局部剖：</strong>只剖开需要表达内部结构的一部分，用波浪线分界。波浪线应画在实体材料上，不能穿过孔槽或与轮廓线重合。"
  };
  sectionButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const mode = button.dataset.sectionMode;
      sectionButtons.forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
      $$("[data-section-panel]").forEach((panel) => {
        panel.hidden = panel.dataset.sectionPanel !== mode;
      });
      if (sectionCaption) sectionCaption.innerHTML = sectionText[mode];
    });
  });

  /* ---------------------------------------------------------
     Reference filters
     --------------------------------------------------------- */

  $$("[data-ref-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      const filter = button.dataset.refFilter;
      $$("[data-ref-filter]").forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
      $$(".ref-card").forEach((card) => {
        card.hidden = filter !== "all" && !card.dataset.category.split(" ").includes(filter);
      });
    });
  });

  /* ---------------------------------------------------------
     Lab 01: reading order
     --------------------------------------------------------- */

  const orderSteps = [
    { step: 1, text: "读标题栏：名称、材料、比例，先建立功能预期" },
    { step: 2, text: "找主视图与投射方向，用三等规律对齐各视图" },
    { step: 3, text: "用形体分析 / 线面分析想象空间形状" },
    { step: 4, text: "读尺寸基准与技术要求，核对定形、定位、总体" }
  ];
  let orderSelected = [];
  let orderPool = [];
  const orderSlots = $("#order-slots");
  const orderPoolNode = $("#order-pool");
  const orderFeedback = $("#order-feedback");

  function renderOrder() {
    if (!orderSlots || !orderPoolNode) return;
    orderSlots.innerHTML = Array.from({ length: 4 }).map((_, index) => {
      const item = orderSelected[index];
      if (item) {
        return `<button class="order-slot is-filled" type="button" data-slot="${index}">
          <span class="slot-num">0${index + 1}</span>
          <span class="slot-content">${escapeHtml(item.text)}</span>
        </button>`;
      }
      return `<div class="order-slot"><span class="slot-num">0${index + 1}</span><span class="slot-content">点击下方卡片依次放入</span></div>`;
    }).join("");

    orderPoolNode.innerHTML = orderPool.map((item) => `
      <button class="order-item" type="button" data-step="${item.step}">
        <span class="item-num">${item.step}</span>${escapeHtml(item.text)}
      </button>
    `).join("");

    $$(".order-item", orderPoolNode).forEach((button) => {
      button.addEventListener("click", () => {
        if (orderSelected.length >= 4) {
          if (orderFeedback) {
            orderFeedback.className = "lab-feedback is-bad";
            orderFeedback.textContent = "四个位置已经放满，先从上方取回一张卡片。";
          }
          return;
        }
        const step = Number(button.dataset.step);
        const item = orderPool.find((entry) => entry.step === step);
        if (!item) return;
        orderPool = orderPool.filter((entry) => entry.step !== step);
        orderSelected.push(item);
        renderOrder();
        if (orderFeedback) {
          orderFeedback.className = "lab-feedback";
          orderFeedback.textContent = "已放入，继续选择。";
        }
      });
    });

    $$("[data-slot]", orderSlots).forEach((button) => {
      button.addEventListener("click", () => {
        const index = Number(button.dataset.slot);
        const [removed] = orderSelected.splice(index, 1);
        if (removed) orderPool.push(removed);
        renderOrder();
      });
    });
  }

  function resetOrder() {
    orderSelected = [];
    orderPool = shuffle(orderSteps);
    renderOrder();
    if (orderFeedback) {
      orderFeedback.className = "lab-feedback";
      orderFeedback.textContent = "选择 4 个步骤后点击“检查顺序”。";
    }
  }

  if (orderSlots && orderPoolNode) {
    resetOrder();
    const check = $("#order-check");
    const reset = $("#order-reset");
    if (check) {
      check.addEventListener("click", () => {
        if (orderSelected.length !== 4) {
          orderFeedback.className = "lab-feedback is-bad";
          orderFeedback.textContent = "还需要放入全部 4 个步骤，才能检查顺序。";
          return;
        }
        const correct = orderSelected.every((item, index) => item.step === index + 1);
        if (correct) {
          orderFeedback.className = "lab-feedback is-good";
          orderFeedback.innerHTML = "<strong>顺序正确。</strong> 先读标题栏建立预期，再用投影对齐，随后分析形体，最后核对尺寸与技术要求。";
        } else {
          const positionCount = orderSelected.reduce((count, item, index) => count + (item.step === index + 1 ? 1 : 0), 0);
          orderFeedback.className = "lab-feedback is-bad";
          orderFeedback.textContent = `位置正确 ${positionCount} / 4。提示：尺寸和技术要求应该在形状判断之后读。`;
        }
      });
    }
    if (reset) reset.addEventListener("click", resetOrder);
  }

  /* ---------------------------------------------------------
     Lab 02: annotation inspection
     --------------------------------------------------------- */

  const inspections = {
    1: { ok: true, text: "① φ60 指向可见圆孔，尺寸线通过圆心，标注合理。" },
    2: { ok: true, text: "② R20 指向圆角，半径尺寸从圆心方向引出，标注合理。" },
    3: { ok: false, text: "③ 500、320、180 形成封闭尺寸链，尺寸互相制约。应去掉一个分段尺寸或调整总体尺寸。" },
    4: { ok: false, text: "④ 12 标注在被遮挡的虚线上。尺寸应尽量标注在可见轮廓或剖视图上。" }
  };
  let inspected = new Set();
  const inspectionFeedback = $("#inspection-feedback");
  const inspectionStatus = $("#inspection-status-text");

  function updateInspection() {
    const found = [...inspected].filter((id) => !inspections[id].ok).length;
    if (inspectionStatus) inspectionStatus.textContent = `已检查 ${inspected.size} / 4 · 已找到 ${found} / 2 处错误`;
    if (inspected.size === 4 && found === 2 && inspectionFeedback) {
      inspectionFeedback.className = "lab-feedback is-good";
      inspectionFeedback.innerHTML = "<strong>两处问题都找到了。</strong> 封闭尺寸链会过约束；虚线标注不利于读图和测量。";
    }
  }

  $$(".hotspot").forEach((button) => {
    button.addEventListener("click", () => {
      const id = Number(button.dataset.inspect);
      const data = inspections[id];
      if (!data) return;
      inspected.add(id);
      button.classList.add(data.ok ? "is-correct" : "is-wrong");
      button.classList.add("is-flagged");
      if (inspectionFeedback) {
        inspectionFeedback.className = `lab-feedback ${data.ok ? "is-good" : "is-bad"}`;
        inspectionFeedback.textContent = data.text;
      }
      updateInspection();
    });
  });

  const inspectionReset = $("#inspection-reset");
  if (inspectionReset) {
    inspectionReset.addEventListener("click", () => {
      inspected = new Set();
      $$(".hotspot").forEach((button) => {
        button.classList.remove("is-correct", "is-wrong", "is-flagged");
      });
      if (inspectionFeedback) {
        inspectionFeedback.className = "lab-feedback";
        inspectionFeedback.textContent = "点击图中编号，查看该处标注的判定与解释。";
      }
      updateInspection();
    });
  }

  /* ---------------------------------------------------------
     Lab 03: fit explorer
     --------------------------------------------------------- */

  const HOLE = { es: 21, ei: 0 };
  const SHAFTS = {
    g6: { es: -7, ei: -20, name: "g6", copy: "轴公差带完全位于零线下方，孔带在上、轴带在下，形成间隙。" },
    h6: { es: 0, ei: -13, name: "h6", copy: "基准轴 h6 的上偏差为 0，最小间隙为 0，仍属于间隙配合。" },
    k6: { es: 15, ei: 2, name: "k6", copy: "轴公差带跨过零线，与孔带部分重叠，可能出现间隙或过盈。" },
    p6: { es: 35, ei: 22, name: "p6", copy: "轴公差带完全位于孔带上方，装配后始终存在过盈。" }
  };

  function fitPercent(value) {
    return ((45 - value) / 75) * 100;
  }

  function renderFit() {
    const select = $("#fit-select");
    if (!select) return;
    const shaft = SHAFTS[select.value];
    if (!shaft) return;

    const holeBand = $("#hole-band");
    const shaftBand = $("#shaft-band");
    const holeLabel = $("#hole-label");
    const shaftLabel = $("#shaft-label");
    const typeText = $("#fit-type-text");
    const holeValues = $("#hole-values");
    const shaftValues = $("#shaft-values");
    const extremes = $("#fit-extremes");
    const explanation = $("#fit-explanation");
    const feedback = $("#fit-feedback");

    if (holeBand) {
      holeBand.style.top = `${fitPercent(HOLE.es)}%`;
      holeBand.style.height = `${((HOLE.es - HOLE.ei) / 75) * 100}%`;
    }
    if (shaftBand) {
      shaftBand.style.top = `${fitPercent(shaft.es)}%`;
      shaftBand.style.height = `${((shaft.es - shaft.ei) / 75) * 100}%`;
    }
    if (holeLabel) holeLabel.textContent = "H7";
    if (shaftLabel) shaftLabel.textContent = shaft.name;

    const minClearance = HOLE.ei - shaft.es;
    const maxClearance = HOLE.es - shaft.ei;
    let type = "过渡配合";
    let extremeText = "";
    let copy = "";

    if (minClearance >= 0) {
      type = "间隙配合";
      extremeText = `间隙 ${minClearance} ~ ${maxClearance} μm`;
      copy = `<strong>间隙配合：</strong>孔的公差带在轴的公差带之上。最小间隙 ${minClearance} μm，最大间隙 ${maxClearance} μm。`;
      if (feedback) feedback.textContent = "当前为基孔制间隙配合，适用于滑动或导向结构。";
    } else if (maxClearance <= 0) {
      type = "过盈配合";
      const minInterference = shaft.ei - HOLE.es;
      const maxInterference = shaft.es - HOLE.ei;
      extremeText = `过盈 ${minInterference} ~ ${maxInterference} μm`;
      copy = `<strong>过盈配合：</strong>孔的公差带在轴的公差带之下。最小过盈 ${minInterference} μm，最大过盈 ${maxInterference} μm。`;
      if (feedback) feedback.textContent = "当前为过盈配合，装配后始终存在过盈，适合传递扭矩。";
    } else {
      const maxInterference = shaft.es - HOLE.ei;
      extremeText = `间隙最大 ${maxClearance} · 过盈最大 ${maxInterference} μm`;
      copy = `<strong>过渡配合：</strong>两公差带部分重叠。可能出现 ${maxClearance} μm 的间隙，也可能出现 ${maxInterference} μm 的过盈。`;
      if (feedback) feedback.textContent = "当前为过渡配合，装配后可能略松也可能略紧，常用于精密定位。";
    }

    if (typeText) typeText.textContent = type;
    if (holeValues) holeValues.textContent = `${HOLE.ei} ~ +${HOLE.es} μm`;
    if (shaftValues) shaftValues.textContent = `${shaft.ei} ~ ${shaft.es} μm`;
    if (extremes) extremes.textContent = extremeText;
    if (explanation) explanation.innerHTML = copy;
  }

  const fitSelect = $("#fit-select");
  if (fitSelect) {
    fitSelect.addEventListener("change", renderFit);
    renderFit();
  }

  /* ---------------------------------------------------------
     Quiz data
     --------------------------------------------------------- */

  const TOPIC_LABELS = {
    projection: "投影与三视图",
    reading: "组合体读图",
    section: "剖视与断面",
    dimension: "尺寸标注",
    precision: "技术要求",
    standards: "标准件与常用件",
    assembly: "零件图与装配图"
  };

  const QUESTIONS = [
    {
      id: "q01", topic: "projection",
      question: "第一角画法中，俯视图应配置在主视图的（　）。",
      options: ["上方", "下方", "右方", "左方"], answer: 1,
      explain: "第一角画法把物体放在观察者与投影面之间，俯视图由上向下投射，配置在主视图下方；左视图配置在主视图右方。"
    },
    {
      id: "q02", topic: "projection",
      question: "三视图中，“宽相等”对应的是哪两个视图之间的关系？",
      options: ["主视图与俯视图", "主视图与左视图", "俯视图与左视图", "任意两个视图"], answer: 2,
      explain: "长对正是主视图与俯视图，高平齐是主视图与左视图，宽相等是俯视图与左视图。宽相等中的“宽”指前后深度。"
    },
    {
      id: "q03", topic: "projection",
      question: "不可见轮廓线应采用（　）。",
      options: ["粗实线", "细实线", "细虚线", "细点画线"], answer: 2,
      explain: "可见轮廓用粗实线，不可见轮廓用细虚线；细点画线用于轴线、对称中心线和分度圆。"
    },
    {
      id: "q04", topic: "reading",
      question: "两相邻表面的投影完全共面时，分界处应（　）。",
      options: ["画粗实线", "画细虚线", "不画线", "画波浪线"], answer: 2,
      explain: "共面表示两个表面平齐，没有真实棱线，因此分界处不画线。多画线是组合体读图的高频错误。"
    },
    {
      id: "q05", topic: "reading",
      question: "圆柱面与平面相切处，投影中通常（　）。",
      options: ["画一条粗实线", "不画线", "画一条细虚线", "画一条细点画线"], answer: 1,
      explain: "相切是平滑过渡，不应出现突变棱线，所以相切处通常不画线；但曲面的转向轮廓线仍需按投影规律画出。"
    },
    {
      id: "q06", topic: "reading",
      question: "两正交圆柱的相贯线通常向（　）弯曲。",
      options: ["小圆柱轴线", "大圆柱轴线", "投影中心", "远离两轴线的方向"], answer: 1,
      explain: "常见异径正交圆柱的相贯线总是向大圆柱的轴线方向弯曲。先找两圆柱轴线，再判断曲线弯向。"
    },
    {
      id: "q07", topic: "section",
      question: "半剖视图最适合用于（　）的零件。",
      options: ["内外结构都很复杂", "基本对称", "完全不对称", "只有外表面"], answer: 1,
      explain: "半剖用一半视图表达外形、一半剖视表达内形，前提是零件基本对称；不对称零件不能使用半剖。"
    },
    {
      id: "q08", topic: "section",
      question: "半剖视图中，视图与剖视图的分界线应画成（　）。",
      options: ["粗实线", "细虚线", "细点画线", "波浪线"], answer: 2,
      explain: "半剖的分界是对称中心线，用细点画线；不能画成粗实线，否则会被误读为实体棱边。局部剖才用波浪线。"
    },
    {
      id: "q09", topic: "section",
      question: "局部剖视图的分界通常使用（　）。",
      options: ["波浪线", "细点画线", "细双点画线", "粗实线"], answer: 0,
      explain: "局部剖用波浪线表示断裂边界。波浪线应画在实体材料上，不能穿过孔槽，也不能与轮廓线重合。"
    },
    {
      id: "q10", topic: "section",
      question: "移出断面图的轮廓线用（　）绘制。",
      options: ["细实线", "粗实线", "细虚线", "细点画线"], answer: 1,
      explain: "移出断面图画在原视图外侧，轮廓线用粗实线；重合断面图画在视图内部，轮廓线用细实线。"
    },
    {
      id: "q11", topic: "dimension",
      question: "尺寸线应使用（　）。",
      options: ["粗实线", "细实线", "细虚线", "波浪线"], answer: 1,
      explain: "尺寸线、尺寸界线、剖面线和引出线都用细实线。尺寸线必须与被注线段平行。"
    },
    {
      id: "q12", topic: "dimension",
      question: "下列尺寸标注做法中，正确的是（　）。",
      options: ["在虚线上标注定位尺寸", "同一尺寸在多个视图重复标注", "让尺寸线穿过尺寸数字", "标注在形状特征视图的可见轮廓上"], answer: 3,
      explain: "尺寸应尽量标注在可见轮廓和形状特征视图上，做到清晰、完整。虚线上标注、重复标注、数字被图线穿过都不符合要求。"
    },
    {
      id: "q13", topic: "precision",
      question: "φ30H7/g6 表示（　）。",
      options: ["基轴制间隙配合", "基孔制间隙配合", "基孔制过盈配合", "基轴制过渡配合"], answer: 1,
      explain: "H7 是基准孔，属于基孔制；g6 的公差带位于零线下方，孔带在上、轴带在下，所以是间隙配合。"
    },
    {
      id: "q14", topic: "precision",
      question: "表面粗糙度 Ra 值越小，通常表示（　）。",
      options: ["表面越粗糙", "表面越光滑，一般加工成本更高", "尺寸精度越低", "材料硬度越低"], answer: 1,
      explain: "Ra 越小，微观不平度越小，表面越光滑；但通常需要更精细的加工，成本也更高。粗糙度不等于尺寸精度。"
    },
    {
      id: "q15", topic: "precision",
      question: "形状公差（如直线度、圆度）的框格中通常（　）。",
      options: ["必须标注基准", "不标注基准", "只标注基准", "必须标注两个基准"], answer: 1,
      explain: "形状公差控制要素自身形状，通常不需要基准；方向、位置和跳动公差通常需要基准。"
    },
    {
      id: "q16", topic: "standards",
      question: "M20×2 LH 中，“LH”表示（　）。",
      options: ["左旋螺纹", "右旋螺纹", "细牙螺纹", "梯形螺纹"], answer: 0,
      explain: "LH 是 Left Hand 的缩写，表示左旋；右旋不标。细牙通过标注螺距 2 表示，M 表示普通螺纹。"
    },
    {
      id: "q17", topic: "standards",
      question: "滚动轴承 6208 的内径为（　）。",
      options: ["8 mm", "20 mm", "40 mm", "62 mm"], answer: 2,
      explain: "轴承内径代号 08 表示 8×5 = 40 mm。内径代号 00、01、02、03 分别对应 10、12、15、17 mm。"
    },
    {
      id: "q18", topic: "assembly",
      question: "装配图明细栏的填写顺序通常为（　）。",
      options: ["自上而下", "自下而上", "从左到右", "任意顺序"], answer: 1,
      explain: "明细栏位于标题栏上方，自下而上填写，最下面一行对应序号 1。视图中的序号与明细栏必须一一对应。"
    }
  ];

  /* ---------------------------------------------------------
     Quiz engine
     --------------------------------------------------------- */

  const quizStart = $("#quiz-start");
  const quizStage = $("#quiz-stage");
  const quizResult = $("#quiz-result");
  const wrongbookPanel = $("#wrongbook-panel");
  const quizQuestion = $("#quiz-question");
  const quizOptions = $("#quiz-options");
  const quizFeedback = $("#quiz-feedback");
  const quizCounter = $("#quiz-counter");
  const quizTopic = $("#quiz-topic");
  const quizId = $("#quiz-id");
  const quizProgressBar = $("#quiz-progress-bar");
  const quizNext = $("#quiz-next");

  let quizState = {
    active: false,
    mode: "10",
    questions: [],
    index: 0,
    correct: 0,
    answers: [],
    lastMode: "10"
  };

  function getQuizStats() {
    const saved = storage.get(STORAGE.quiz, { best: 0, attempts: 0 }) || {};
    return {
      best: Number(saved.best) || 0,
      attempts: Number(saved.attempts) || 0
    };
  }

  function getWrongIds() {
    const saved = storage.get(STORAGE.wrong, []);
    return Array.isArray(saved) ? saved.filter((id) => QUESTIONS.some((q) => q.id === id)) : [];
  }

  function setWrongIds(ids) {
    storage.set(STORAGE.wrong, [...new Set(ids)]);
  }

  function updateQuizStats() {
    const stats = getQuizStats();
    const wrongCount = getWrongIds().length;
    const bestNode = $("#stat-best");
    const bestMini = $("#best-score");
    const attemptNode = $("#attempt-count");
    const wrongNode = $("#stat-wrong");
    const wrongMini = $("#wrong-count");
    if (bestNode) bestNode.textContent = stats.best ? `${stats.best}%` : "—";
    if (bestMini) bestMini.textContent = stats.best ? `最佳成绩 ${stats.best}%` : "最佳成绩 —";
    if (attemptNode) attemptNode.textContent = `已完成 ${stats.attempts} 次`;
    if (wrongNode) wrongNode.textContent = String(wrongCount);
    if (wrongMini) wrongMini.textContent = `错题 ${wrongCount} 道`;
  }

  function prepareQuestion(question) {
    const options = question.options.map((text, index) => ({ text, correct: index === question.answer }));
    return { ...question, options: shuffle(options), answered: false, selected: -1 };
  }

  function beginQuiz(mode) {
    const wrongIds = getWrongIds();
    let source = QUESTIONS;

    if (mode === "wrong") {
      source = QUESTIONS.filter((q) => wrongIds.includes(q.id));
      if (!source.length) {
        toast("错题本是空的，先做一轮测验吧");
        return;
      }
    }

    const pool = shuffle(source).map(prepareQuestion);
    quizState = {
      active: true,
      mode,
      questions: mode === "10" ? pool.slice(0, 10) : pool,
      index: 0,
      correct: 0,
      answers: [],
      lastMode: mode
    };

    if (quizStart) quizStart.hidden = true;
    if (wrongbookPanel) wrongbookPanel.hidden = true;
    if (quizResult) quizResult.hidden = true;
    if (quizStage) {
      quizStage.hidden = false;
      quizStage.classList.add("is-active");
    }
    renderQuestion();
  }

  function renderQuestion() {
    if (!quizState.active) return;
    const question = quizState.questions[quizState.index];
    if (!question) return finishQuiz();

    if (quizCounter) quizCounter.textContent = `QUESTION ${String(quizState.index + 1).padStart(2, "0")} / ${String(quizState.questions.length).padStart(2, "0")}`;
    if (quizProgressBar) quizProgressBar.style.width = `${(quizState.index / quizState.questions.length) * 100}%`;
    if (quizTopic) quizTopic.textContent = TOPIC_LABELS[question.topic] || question.topic;
    if (quizId) quizId.textContent = question.id.toUpperCase();

    if (quizQuestion) quizQuestion.textContent = question.question;
    if (quizOptions) {
      const letters = ["A", "B", "C", "D"];
      quizOptions.innerHTML = question.options.map((option, index) => `
        <button class="option-btn" type="button" data-option="${index}">
          <span class="option-letter">${letters[index]}</span>
          <span>${escapeHtml(option.text)}</span>
          <span class="option-mark"></span>
        </button>
      `).join("");
      $$(".option-btn", quizOptions).forEach((button) => {
        button.addEventListener("click", () => answerQuestion(Number(button.dataset.option)));
      });
    }

    if (quizFeedback) {
      quizFeedback.className = "quiz-feedback";
      quizFeedback.innerHTML = "";
    }
    if (quizNext) {
      quizNext.hidden = true;
      quizNext.innerHTML = quizState.index === quizState.questions.length - 1
        ? '查看结果 <svg aria-hidden="true"><use href="#icon-arrow"></use></svg>'
        : '下一题 <svg aria-hidden="true"><use href="#icon-arrow"></use></svg>';
    }
    updateQuizStats();
  }

  function answerQuestion(optionIndex) {
    if (!quizState.active) return;
    const question = quizState.questions[quizState.index];
    if (!question || question.answered) return;

    const option = question.options[optionIndex];
    if (!option) return;

    question.answered = true;
    question.selected = optionIndex;
    const isCorrect = option.correct;

    $$(".option-btn", quizOptions).forEach((button, index) => {
      button.disabled = true;
      if (question.options[index].correct) button.classList.add("is-correct");
      else if (index === optionIndex) button.classList.add("is-wrong");
      else button.classList.add("is-faded");
    });

    if (quizFeedback) {
      quizFeedback.className = "quiz-feedback is-visible";
      quizFeedback.innerHTML = `<strong>${isCorrect ? "回答正确。" : "回答错误。"}</strong> ${escapeHtml(question.explain)}`;
    }

    const wrongIds = getWrongIds();
    if (isCorrect) {
      quizState.correct += 1;
      setWrongIds(wrongIds.filter((id) => id !== question.id));
    } else {
      setWrongIds([...wrongIds, question.id]);
    }

    quizState.answers.push({ ...question, isCorrect });
    if (quizNext) quizNext.hidden = false;
    updateQuizStats();
  }

  function finishQuiz() {
    quizState.active = false;
    if (quizStage) {
      quizStage.hidden = true;
      quizStage.classList.remove("is-active");
    }
    const total = quizState.questions.length;
    const percent = total ? Math.round((quizState.correct / total) * 100) : 0;
    const stats = getQuizStats();
    const nextStats = { best: Math.max(stats.best, percent), attempts: stats.attempts + 1 };
    storage.set(STORAGE.quiz, nextStats);
    updateQuizStats();

    if (quizResult) {
      quizResult.hidden = false;
      const scoreRing = $("#score-ring");
      const scoreValue = $("#score-value");
      const scoreUnit = $("#score-unit");
      const resultTitle = $("#result-title");
      const resultSummary = $("#result-summary");
      if (scoreRing) scoreRing.style.setProperty("--score-angle", `${percent * 3.6}deg`);
      if (scoreValue) scoreValue.textContent = String(percent);
      if (scoreUnit) scoreUnit.textContent = `% · ${quizState.correct}/${total}`;
      if (resultTitle) {
        resultTitle.textContent = percent >= 90 ? "稳了，可以上场" : percent >= 70 ? "基础扎实，补漏即可" : "需要回炉，先看错题";
      }
      if (resultSummary) resultSummary.textContent = `本轮答对 ${quizState.correct} / ${total} 题。${percent >= 70 ? "重点回看错题解析，再进行一次模拟。" : "建议回到讲义重读对应章节，并用训练器验证。"}`
      renderBreakdown();
      renderResultWrong();
    }
    updateWrongbookPanel();
  }

  function renderBreakdown() {
    const breakdown = $("#result-breakdown");
    if (!breakdown) return;
    const stats = {};
    quizState.answers.forEach((answer) => {
      if (!stats[answer.topic]) stats[answer.topic] = { total: 0, correct: 0 };
      stats[answer.topic].total += 1;
      if (answer.isCorrect) stats[answer.topic].correct += 1;
    });
    breakdown.innerHTML = Object.keys(stats).map((topic) => `
      <div class="result-topic">
        <small>${escapeHtml(TOPIC_LABELS[topic] || topic)}</small>
        <strong>${stats[topic].correct} / ${stats[topic].total}</strong>
      </div>
    `).join("");
  }

  function wrongItemHtml(question) {
    const correctOption = question.options.find((option) => option.correct);
    return `<div class="wrong-item">
      <div class="wrong-q">${escapeHtml(question.question)}</div>
      <div class="wrong-a">正确答案：<b>${escapeHtml(correctOption ? correctOption.text : "")}</b><br>${escapeHtml(question.explain)}</div>
    </div>`;
  }

  function renderResultWrong() {
    const node = $("#result-wrong-review");
    if (!node) return;
    const wrong = quizState.answers.filter((answer) => !answer.isCorrect);
    if (!wrong.length) {
      node.innerHTML = '<h3>错题回顾</h3><p class="search-empty">本轮全部答对，没有错题。</p>';
      return;
    }
    node.innerHTML = `<h3>错题回顾 · ${wrong.length} 道</h3>${wrong.map(wrongItemHtml).join("")}`;
  }

  function resetQuizHome() {
    quizState.active = false;
    if (quizStage) {
      quizStage.hidden = true;
      quizStage.classList.remove("is-active");
    }
    if (quizResult) quizResult.hidden = true;
    if (wrongbookPanel) wrongbookPanel.hidden = true;
    if (quizStart) quizStart.hidden = false;
    updateQuizStats();
    updateWrongbookPanel();
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function renderWrongbookList() {
    const list = $("#wrongbook-list");
    if (!list) return;
    const wrongIds = getWrongIds();
    const items = QUESTIONS.filter((question) => wrongIds.includes(question.id));
    if (!items.length) {
      list.innerHTML = '<p class="search-empty">错题本是空的。做一轮测验后，答错的题目会自动出现在这里。</p>';
      return;
    }
    list.innerHTML = `<h3>待回炉 · ${items.length} 道</h3>${items.map((question) => wrongItemHtml(prepareQuestion(question))).join("")}`;
  }

  function updateWrongbookPanel() {
    updateQuizStats();
    renderWrongbookList();
  }

  $$("#start-10").forEach((button) => button.addEventListener("click", () => beginQuiz("10")));
  $$("#start-all").forEach((button) => button.addEventListener("click", () => beginQuiz("all")));

  if (quizNext) {
    quizNext.addEventListener("click", () => {
      if (quizState.index >= quizState.questions.length - 1) {
        finishQuiz();
        return;
      }
      quizState.index += 1;
      renderQuestion();
      const card = $(".question-card");
      if (card) card.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  const quizQuit = $("#quiz-quit");
  if (quizQuit) {
    quizQuit.addEventListener("click", () => {
      if (quizState.active && quizState.index > 0) {
        const ok = window.confirm("退出本轮测验？答题进度不会保存。");
        if (!ok) return;
      }
      resetQuizHome();
    });
  }

  const resultRetry = $("#result-retry");
  if (resultRetry) {
    resultRetry.addEventListener("click", () => {
      if (quizState.lastMode === "wrong" && !getWrongIds().length) {
        toast("错题本已经清空，换一轮随机测验吧");
        beginQuiz("10");
        return;
      }
      beginQuiz(quizState.lastMode);
    });
  }
  const resultWrong = $("#result-wrong");
  if (resultWrong) resultWrong.addEventListener("click", () => beginQuiz("wrong"));
  const resultHome = $("#result-home");
  if (resultHome) resultHome.addEventListener("click", () => go("home"));

  const wrongOpen = $("#wrongbook-open");
  if (wrongOpen) {
    wrongOpen.addEventListener("click", () => {
      if (quizStart) quizStart.hidden = true;
      if (quizResult) quizResult.hidden = true;
      if (wrongbookPanel) wrongbookPanel.hidden = false;
      updateWrongbookPanel();
      if (wrongbookPanel) wrongbookPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }
  const wrongClose = $("#wrongbook-close");
  if (wrongClose) {
    wrongClose.addEventListener("click", () => {
      if (wrongbookPanel) wrongbookPanel.hidden = true;
      if (quizStart) quizStart.hidden = false;
    });
  }
  const wrongPractice = $("#wrongbook-practice");
  if (wrongPractice) wrongPractice.addEventListener("click", () => beginQuiz("wrong"));
  const wrongClear = $("#wrongbook-clear");
  if (wrongClear) {
    wrongClear.addEventListener("click", () => {
      setWrongIds([]);
      updateWrongbookPanel();
      toast("错题本已清空");
    });
  }

  document.addEventListener("keydown", (event) => {
    if (!quizState.active || quizStage.hidden) return;
    const question = quizState.questions[quizState.index];
    if (!question) return;
    if (!question.answered && /^[abcd]$/i.test(event.key)) {
      const buttons = $$(".option-btn", quizOptions);
      const index = ["a", "b", "c", "d"].indexOf(event.key.toLowerCase());
      if (buttons[index]) {
        event.preventDefault();
        buttons[index].click();
      }
    }
    if (question.answered && event.key === "Enter" && quizNext && !quizNext.hidden) {
      event.preventDefault();
      quizNext.click();
    }
  });

  updateQuizStats();
  updateWrongbookPanel();

  /* ---------------------------------------------------------
     Initial route / pending topic
     --------------------------------------------------------- */

  if (!location.hash) {
    try {
      history.replaceState(null, "", "#/home");
    } catch (error) {
      /* Ignore history exceptions. */
    }
  }
  route();
})();
