'use strict';
(() => {
  const data = window.SITE_DATA;
  if (!data || !Array.isArray(data.films)) return;
  const $ = selector => document.querySelector(selector);
  const grid = $('#film-grid');
  const dialog = $('#film-dialog');
  const search = $('#film-search');
  const year = $('#film-year');
  const yearBasis = $('#year-basis');
  const editionSelect = $('#festival-edition');
  const festivalControls = $('#bitmuri-awards');
  const festivalCategory = '빛무리 영화제';
  const pageSize = 9;
  const awardRanks = { '대상': 0, '최우수상': 1, '우수상': 2 };
  let category = 'all';
  let edition = 'all';
  let awardsOnly = false;
  let limit = pageSize;
  let previousFocus = null;
  $('#total-count').textContent = String(data.films.length).padStart(2, '0');
  $('#copyright-year').textContent = String(new Date().getFullYear());
  function populateYears() {
    year.replaceChildren(new Option('모든 연도', 'all'));
    [...new Set(data.films.map(f => f[yearBasis.value]).filter(Boolean))].sort().reverse().forEach(value => {
      year.append(new Option(value, value));
    });
  }
  populateYears();
  (data.festivals || []).slice().sort((a, b) => b.edition - a.edition).forEach(festival => {
    const theme = festival.theme ? ` ‘${festival.theme}’` : '';
    editionSelect.append(new Option(`제${festival.edition}회${theme} · ${festival.period}`, String(festival.edition)));
  });
  const normalize = value => value.normalize('NFC').toLocaleLowerCase('ko').replace(/\s+/g, ' ').trim();
  function chronological(a, b) {
    return yearBasis.value === 'publishedYear' ? b.published.localeCompare(a.published)
      : Number(b.year) - Number(a.year)
        || (Number(b.semester) || 0) - (Number(a.semester) || 0)
        || b.published.localeCompare(a.published);
  }
  function getFiltered() {
    const query = normalize(search.value);
    return data.films.filter(f => (category === 'all' || f.category === category)
      && (year.value === 'all' || f[yearBasis.value] === year.value)
      && (category !== festivalCategory || ((edition === 'all' || String(f.festivalEdition) === edition) && (!awardsOnly || Boolean(f.awardName))))
      && (!query || normalize([f.title, f.originalTitle, f.summary, f.label, f.awardName || ''].join(' ')).includes(query)))
      .sort((a, b) => category === festivalCategory
        ? (Number(b.festivalEdition) || 0) - (Number(a.festivalEdition) || 0)
          || (awardRanks[a.awardName] ?? 99) - (awardRanks[b.awardName] ?? 99)
          || chronological(a, b)
        : chronological(a, b));
  }
  function makeElement(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
  }
  function syncControls() {
    document.querySelectorAll('[data-category]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.category === category)));
    festivalControls.hidden = category !== festivalCategory;
    editionSelect.value = edition;
    document.querySelectorAll('[data-award-filter]').forEach(b => b.setAttribute('aria-pressed', String((b.dataset.awardFilter === 'awards') === awardsOnly)));
  }
  function render() {
    syncControls();
    const filtered = getFiltered();
    const visible = filtered.slice(0, limit);
    const fragment = document.createDocumentFragment();
    visible.forEach(f => {
      const card = makeElement('article', 'film-card');
      const imageButton = makeElement('button', 'film-image-button');
      imageButton.type = 'button';
      imageButton.setAttribute('aria-label', `${f.title} 작품 정보 보기`);
      const img = makeElement('img');
      img.src = f.image; img.alt = `${f.title} 공식 썸네일`;
      img.width = 720; img.height = 404; img.loading = 'lazy'; img.decoding = 'async';
      const duration = makeElement('span', 'duration', f.duration);
      duration.setAttribute('aria-hidden', 'true');
      const icon = makeElement('span', 'card-open', '↗'); icon.setAttribute('aria-hidden', 'true');
      imageButton.append(img, duration, icon);
      imageButton.addEventListener('click', () => openFilm(f, imageButton));
      card.append(imageButton);
      if (f.category === festivalCategory && f.awardName) {
        const awards = makeElement('div', 'film-awards');
        const badge = makeElement('span', 'award-badge', f.awardName);
        badge.setAttribute('aria-label', `${f.label} ${f.awardName}`);
        awards.append(badge); card.append(awards);
      }
      const meta = makeElement('div', 'film-card-meta');
      meta.append(makeElement('span', '', f.label), makeElement('span', '', yearBasis.value === 'publishedYear' ? `${f.publishedYear} 공개` : (f.productionTerm || f.year)));
      const heading = makeElement('h3'); heading.style.margin = '0';
      const title = makeElement('button', 'film-title', f.title);
      title.type = 'button'; title.addEventListener('click', () => openFilm(f, title));
      heading.append(title);
      card.append(meta, heading, makeElement('p', 'film-summary', f.summary));
      fragment.append(card);
    });
    grid.replaceChildren(fragment);
    $('#empty-state').hidden = filtered.length !== 0;
    const noAwardResults = category === festivalCategory && awardsOnly;
    $('#empty-title').textContent = noAwardResults ? '확인된 수상작이 아직 없어요.' : '아직 만나지 못한 장면이네요.';
    $('#empty-description').textContent = noAwardResults ? '선택한 조건에 맞는 수상 기록을 공식 영상에서 확인하지 못했습니다. 전체 작품도 살펴보세요.' : '다른 제목이나 연도로 찾아보세요.';
    $('#reset-filters').textContent = noAwardResults ? '전체 작품으로 보기 ↗' : '전체 작품 보기 ↗';
    $('#load-more').hidden = limit >= filtered.length;
    $('#visible-count').textContent = filtered.length ? `${visible.length} / ${filtered.length} FILMS` : '';
    $('#results-status').textContent = `${filtered.length}개 작품 중 ${visible.length}개 표시`;
    $('#festival-result-count').textContent = `${awardsOnly ? '수상작' : '전체 작품'} ${filtered.length}편`;
  }
  function resetPage() { limit = pageSize; render(); }
  function clearAwardHash() {
    if (location.hash === '#bitmuri-awards') history.replaceState(null, '', '#films');
  }
  document.querySelectorAll('[data-category]').forEach(button => {
    button.addEventListener('click', () => {
      category = button.dataset.category; edition = 'all'; awardsOnly = false;
      clearAwardHash(); resetPage();
    });
  });
  editionSelect.addEventListener('change', () => { edition = editionSelect.value; resetPage(); });
  document.querySelectorAll('[data-award-filter]').forEach(button => {
    button.addEventListener('click', () => {
      awardsOnly = button.dataset.awardFilter === 'awards';
      if (!awardsOnly) clearAwardHash();
      resetPage();
    });
  });
  search.addEventListener('input', resetPage);
  year.addEventListener('change', resetPage);
  yearBasis.addEventListener('change', () => { populateYears(); resetPage(); });
  $('#reset-filters').addEventListener('click', () => {
    search.value = '';
    if (category === festivalCategory && awardsOnly) {
      awardsOnly = false; year.value = 'all'; clearAwardHash();
    } else {
      category = 'all'; edition = 'all'; awardsOnly = false;
      yearBasis.value = 'year'; populateYears(); clearAwardHash();
    }
    resetPage();
    if (category === festivalCategory) document.querySelector('[data-award-filter="all"]').focus();
    else search.focus();
  });
  $('#load-more').addEventListener('click', () => {
    const oldCount = grid.children.length;
    limit += pageSize; render();
    grid.children[oldCount]?.querySelector('button')?.focus({preventScroll: true});
  });
  function openFilm(film, trigger) {
    previousFocus = trigger;
    $('#dialog-image').src = film.image;
    $('#dialog-image').alt = `${film.title} 공식 썸네일`;
    $('#dialog-label').textContent = film.label;
    $('#dialog-title').textContent = film.title;
    const festivalAward = film.award ? `${film.award} · ${film.label}` : '';
    $('#dialog-meta').textContent = [`제작·활동 ${film.productionTerm || film.year}${film.semester ? '학기' : ''}`, `공개 ${film.published.replaceAll('-', '.')}`, film.duration, festivalAward].filter(Boolean).join(' / ');
    $('#dialog-summary').textContent = film.summary;
    $('#dialog-description').textContent = film.description || '영상의 자세한 정보는 공식 채널에서 확인해주세요.';
    $('#dialog-watch').href = film.url;
    dialog.querySelector('details').open = false;
    dialog.showModal(); dialog.scrollTop = 0;
    document.body.classList.add('body-locked');
    $('.dialog-close').focus({preventScroll: true});
  }
  $('.dialog-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) {
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  }});
  dialog.addEventListener('close', () => { document.body.classList.remove('body-locked'); previousFocus?.focus({preventScroll: true}); });
  document.querySelectorAll('button[data-view]').forEach(button => {
    button.addEventListener('click', () => {
      grid.dataset.view = button.dataset.view;
      document.querySelector('.archive-list-head').hidden = button.dataset.view !== 'list';
      document.querySelectorAll('button[data-view]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
    });
  });
  const menuToggle = $('.menu-toggle');
  const mobileNav = $('#mobile-nav');
  function closeMenu() { menuToggle.setAttribute('aria-expanded','false'); menuToggle.setAttribute('aria-label','메뉴 열기'); mobileNav.hidden = true; }
  menuToggle.addEventListener('click', () => {
    const open = menuToggle.getAttribute('aria-expanded') !== 'true';
    menuToggle.setAttribute('aria-expanded',String(open));
    menuToggle.setAttribute('aria-label',open ? '메뉴 닫기' : '메뉴 열기');
    mobileNav.hidden = !open;
  });
  mobileNav.querySelectorAll('a').forEach(a => a.addEventListener('click', closeMenu));
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !mobileNav.hidden) { closeMenu(); menuToggle.focus(); } });
  window.matchMedia('(min-width: 900px)').addEventListener('change', event => { if (event.matches) closeMenu(); });
  function showAwards(navigate) {
    category = festivalCategory; edition = 'all'; awardsOnly = true;
    search.value = ''; yearBasis.value = 'year'; populateYears(); resetPage(); closeMenu();
    if (navigate) {
      if (location.hash !== '#bitmuri-awards') location.hash = 'bitmuri-awards';
      else festivalControls.scrollIntoView({behavior:'smooth', block:'start'});
    }
  }
  document.querySelectorAll('[data-awards-shortcut]').forEach(link => link.addEventListener('click', event => { event.preventDefault(); showAwards(true); }));
  window.addEventListener('hashchange', () => {
    if (location.hash === '#bitmuri-awards' && (category !== festivalCategory || !awardsOnly)) showAwards(false);
  });
  if (location.hash === '#bitmuri-awards') {
    showAwards(false);
    requestAnimationFrame(() => festivalControls.scrollIntoView({behavior:'auto', block:'start'}));
  } else render();
})();
