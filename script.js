/* ============================================================
   Azure Haven — Hotel Booking Logic
============================================================ */
(function () {
  "use strict";

  /* ---------- Data ---------- */
  const ROOMS = [
    {
      id: "standard",
      name: "Garden Standard",
      type: "standard",
      tag: "Best value",
      price: 180,
      rating: 4.6,
      size: "28 m²",
      beds: "1 Queen",
      guests: 2,
      img: "room-standard.png",
      desc: "A cozy, light-filled retreat with a plush queen bed and garden views — perfect for solo travelers or couples.",
    },
    {
      id: "deluxe",
      name: "Deluxe King",
      type: "deluxe",
      tag: "Popular",
      price: 290,
      rating: 4.8,
      size: "40 m²",
      beds: "1 King",
      guests: 3,
      img: "room-deluxe.png",
      desc: "Spacious elegance with a king bed, lounge nook, and floor-to-ceiling city views. Refined comfort throughout.",
    },
    {
      id: "suite",
      name: "Ocean Suite",
      type: "suite",
      tag: "Ocean view",
      price: 480,
      rating: 4.9,
      size: "65 m²",
      beds: "1 King + Sofa",
      guests: 4,
      img: "room-suite.png",
      desc: "A separate living area, marble bath, and breathtaking ocean panorama define this signature suite.",
    },
    {
      id: "executive",
      name: "Executive Penthouse",
      type: "executive",
      tag: "Premium",
      price: 720,
      rating: 5.0,
      size: "90 m²",
      beds: "1 King + Study",
      guests: 4,
      img: "room-executive.png",
      desc: "The pinnacle of luxury — private terrace, panoramic skyline, dedicated butler, and bespoke furnishings.",
    },
  ];

  const REVIEWS = [
    { stars: 5, text: "The most serene stay we've ever had. The staff anticipated our every need before we even asked.", author: "Elena Marsh", role: "Ocean Suite guest" },
    { stars: 5, text: "From the infinity pool to the fine dining, every detail was flawless. We're already planning our return.", author: "Daniel Cho", role: "Executive Penthouse guest" },
    { stars: 5, text: "Booking was effortless and the room exceeded every expectation. Truly a five-star experience.", author: "Priya Nair", role: "Deluxe King guest" },
  ];

  /* ---------- Helpers ---------- */
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const money = (n) => "$" + n.toLocaleString();
  const pad = (n) => String(n).padStart(2, "0");
  const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseYMD = (s) => { const [y, m, dd] = s.split("-").map(Number); return new Date(y, m - 1, dd); };
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const fmtNice = (d) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const nightsBetween = (a, b) => Math.round((parseYMD(b) - parseYMD(a)) / 86400000);

  const store = {
    get: (k, f) => { try { return JSON.parse(localStorage.getItem(k)) ?? f; } catch { return f; } },
    set: (k, v) => localStorage.setItem(k, JSON.stringify(v)),
  };

  /* Pre-seed some "unavailable" dates for realism (deterministic) */
  const BOOKED = new Set();
  (function seedBooked() {
    const base = new Date(today);
    [3, 4, 5, 12, 18, 19, 27].forEach((offset) => {
      const d = new Date(base); d.setDate(base.getDate() + offset); BOOKED.add(ymd(d));
    });
  })();

  /* ---------- Toast ---------- */
  const toastEl = $("#toast");
  let toastTimer;
  function toast(msg) {
    toastEl.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#c9a24b" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg>${msg}`;
    toastEl.classList.add("is-show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("is-show"), 3200);
  }

  /* ---------- Preloader ---------- */
  window.addEventListener("load", () => {
    setTimeout(() => $("#preloader").classList.add("is-hidden"), 400);
  });

  /* ---------- Navbar ---------- */
  const nav = $("#nav");
  const navLinks = $("#navLinks");
  const navToggle = $("#navToggle");
  window.addEventListener("scroll", () => {
    nav.classList.toggle("is-scrolled", window.scrollY > 40);
    $("#toTop").classList.toggle("is-show", window.scrollY > 600);
  });
  navToggle.addEventListener("click", () => {
    const open = navLinks.classList.toggle("is-open");
    navToggle.classList.toggle("is-open", open);
    navToggle.setAttribute("aria-expanded", open);
  });
  $$(".nav__link").forEach((a) => a.addEventListener("click", () => {
    navLinks.classList.remove("is-open");
    navToggle.classList.remove("is-open");
  }));
  $("#toTop").addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));

  /* ---------- Scroll reveal ---------- */
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add("is-visible"); io.unobserve(e.target); }
    });
  }, { threshold: 0.12 });
  const observeReveals = () => $$(".reveal:not(.is-visible)").forEach((el) => io.observe(el));

  /* ---------- Animated stats counters ---------- */
  const statObserver = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const el = e.target, target = +el.dataset.count; let cur = 0;
      const step = Math.max(1, Math.ceil(target / 60));
      const tick = () => { cur += step; if (cur >= target) cur = target; el.textContent = cur; if (cur < target) requestAnimationFrame(tick); };
      tick(); statObserver.unobserve(el);
    });
  }, { threshold: 0.5 });
  $$(".stat__num").forEach((el) => statObserver.observe(el));

  /* ---------- Render Rooms ---------- */
  const roomsGrid = $("#roomsGrid");
  const roomsEmpty = $("#roomsEmpty");
  let activeType = "all";
  let maxPrice = 800;
  const favs = new Set(store.get("azure_favs", []));

  function roomCard(r) {
    const isFav = favs.has(r.id);
    return `
      <article class="room reveal" data-type="${r.type}" data-price="${r.price}">
        <div class="room__media">
          <img src="${r.img}" alt="${r.name}" loading="lazy" />
          <span class="room__tag">${r.tag}</span>
          <button class="room__fav ${isFav ? "is-fav" : ""}" data-fav="${r.id}" aria-label="Save ${r.name}">
            <svg viewBox="0 0 24 24"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z"/></svg>
          </button>
        </div>
        <div class="room__body">
          <h3 class="room__title">${r.name}</h3>
          <div class="room__meta">
            <span>◈ ${r.size}</span><span>🛏 ${r.beds}</span><span>♟ ${r.guests} guests</span>
          </div>
          <p class="room__desc">${r.desc}</p>
          <div class="room__foot">
            <div class="room__price"><b>${money(r.price)}</b><span> / night</span></div>
            <span class="room__rating">★ ${r.rating.toFixed(1)}</span>
          </div>
          <button class="btn btn--gold btn--full" data-book="${r.id}" style="margin-top:1rem">Book now</button>
        </div>
      </article>`;
  }

  function renderRooms() {
    const list = ROOMS.filter((r) => (activeType === "all" || r.type === activeType) && r.price <= maxPrice);
    roomsGrid.innerHTML = list.map(roomCard).join("");
    roomsEmpty.hidden = list.length > 0;
    observeReveals();
  }

  /* Filters */
  $("#filterChips").addEventListener("click", (e) => {
    const btn = e.target.closest(".chip"); if (!btn) return;
    $$(".chip").forEach((c) => c.classList.remove("is-active"));
    btn.classList.add("is-active");
    activeType = btn.dataset.filter;
    renderRooms();
  });
  const priceRange = $("#priceRange");
  priceRange.addEventListener("input", () => {
    maxPrice = +priceRange.value;
    $("#priceLabel").textContent = money(maxPrice);
    renderRooms();
  });

  /* Room grid click delegation (book + fav) */
  roomsGrid.addEventListener("click", (e) => {
    const bookBtn = e.target.closest("[data-book]");
    const favBtn = e.target.closest("[data-fav]");
    if (bookBtn) openBooking(bookBtn.dataset.book);
    if (favBtn) {
      const id = favBtn.dataset.fav;
      if (favs.has(id)) { favs.delete(id); toast("Removed from saved"); }
      else { favs.add(id); toast("Saved to favorites ♥"); }
      favBtn.classList.toggle("is-fav");
      store.set("azure_favs", [...favs]);
    }
  });

  /* ---------- Availability Calendar ---------- */
  const calGrid = $("#calGrid");
  const calMonthEl = $("#calMonth");
  let viewDate = new Date(today.getFullYear(), today.getMonth(), 1);
  let selStart = null, selEnd = null;

  function renderCalendar() {
    const year = viewDate.getFullYear(), month = viewDate.getMonth();
    calMonthEl.textContent = viewDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    let html = "";
    for (let i = 0; i < firstDay; i++) html += `<div class="day day--empty"></div>`;
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      const key = ymd(date);
      let cls = "day", disabled = false;
      if (date < today) { cls += " day--past"; disabled = true; }
      else if (BOOKED.has(key)) { cls += " day--booked"; disabled = true; }
      else cls += " day--free";

      if (!disabled && selStart && key === selStart) cls += " day--selected";
      if (!disabled && selEnd && key === selEnd) cls += " day--selected";
      if (!disabled && selStart && selEnd && key > selStart && key < selEnd) cls += " day--range";

      html += `<div class="${cls}" ${disabled ? "" : `data-date="${key}" role="button" tabindex="0"`}>${d}</div>`;
    }
    calGrid.innerHTML = html;
  }

  function rangeHasBooked(a, b) {
    const start = parseYMD(a), end = parseYMD(b);
    for (let dt = new Date(start); dt <= end; dt.setDate(dt.getDate() + 1)) {
      if (BOOKED.has(ymd(dt))) return true;
    }
    return false;
  }

  function selectDate(key) {
    if (!selStart || (selStart && selEnd)) {
      selStart = key; selEnd = null;
    } else {
      if (key < selStart) { selEnd = selStart; selStart = key; }
      else if (key === selStart) { return; }
      else selEnd = key;
      if (rangeHasBooked(selStart, selEnd)) {
        toast("Your range includes unavailable dates");
        selStart = key; selEnd = null;
      }
    }
    renderCalendar();
    updateCalSummary();
  }

  function updateCalSummary() {
    const box = $("#calSummary"), btn = $("#calBookBtn");
    if (selStart && selEnd) {
      const n = nightsBetween(selStart, selEnd);
      box.innerHTML = `<p><strong>${fmtNice(parseYMD(selStart))}</strong> → <strong>${fmtNice(parseYMD(selEnd))}</strong><br />${n} night${n > 1 ? "s" : ""} selected</p>`;
      btn.disabled = false;
    } else if (selStart) {
      box.innerHTML = `<p>Check-in: <strong>${fmtNice(parseYMD(selStart))}</strong><br />Now pick a check-out date.</p>`;
      btn.disabled = true;
    } else {
      box.innerHTML = `<p>No dates selected yet.</p>`;
      btn.disabled = true;
    }
  }

  calGrid.addEventListener("click", (e) => {
    const cell = e.target.closest("[data-date]"); if (cell) selectDate(cell.dataset.date);
  });
  calGrid.addEventListener("keydown", (e) => {
    if ((e.key === "Enter" || e.key === " ") && e.target.dataset.date) { e.preventDefault(); selectDate(e.target.dataset.date); }
  });
  $("#calPrev").addEventListener("click", () => {
    const min = new Date(today.getFullYear(), today.getMonth(), 1);
    const prev = new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1);
    if (prev >= min) { viewDate = prev; renderCalendar(); }
  });
  $("#calNext").addEventListener("click", () => {
    viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1);
    renderCalendar();
  });
  $("#calBookBtn").addEventListener("click", () => {
    openBooking("deluxe", selStart, selEnd);
  });

  /* ---------- Booking Modal ---------- */
  const modal = $("#bookingModal");
  const bIn = $("#bIn"), bOut = $("#bOut");
  let currentRoom = ROOMS[1];

  function setMinDates() {
    const t = ymd(today);
    [bIn, bOut, $("#searchIn"), $("#searchOut")].forEach((el) => { if (el) el.min = t; });
  }

  function openBooking(roomId, startKey, endKey) {
    currentRoom = ROOMS.find((r) => r.id === roomId) || ROOMS[1];
    $("#modalImg").src = currentRoom.img;
    $("#modalImg").alt = currentRoom.name;
    $("#modalRoomName").textContent = `${currentRoom.name} · ${money(currentRoom.price)}/night`;
    $("#modalTitle").textContent = "Book Your Room";
    bIn.value = startKey || $("#searchIn").value || "";
    bOut.value = endKey || $("#searchOut").value || "";
    updateBookingSummary();
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }
  function closeModal() {
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }
  $$("[data-close]").forEach((el) => el.addEventListener("click", closeModal));

  function updateBookingSummary() {
    const inV = bIn.value, outV = bOut.value;
    let nights = 0;
    if (inV && outV && nightsBetween(inV, outV) > 0) nights = nightsBetween(inV, outV);
    const total = nights * currentRoom.price;
    $("#bNights").textContent = `${nights} night${nights !== 1 ? "s" : ""}`;
    $("#bRate").textContent = `${money(currentRoom.price)} / night`;
    $("#bTotal").textContent = money(total);
  }
  [bIn, bOut].forEach((el) => el.addEventListener("change", () => {
    if (bIn.value) bOut.min = bIn.value;
    updateBookingSummary();
  }));

  /* Booking submit */
  $("#bookingForm").addEventListener("submit", (e) => {
    e.preventDefault();
    if (!bIn.value || !bOut.value || nightsBetween(bIn.value, bOut.value) <= 0) {
      toast("Please choose valid check-in / check-out dates");
      return;
    }
    if (rangeHasBooked(bIn.value, bOut.value)) {
      toast("Selected dates include unavailable days");
      return;
    }
    const nights = nightsBetween(bIn.value, bOut.value);
    const booking = {
      id: Date.now(),
      roomId: currentRoom.id,
      room: currentRoom.name,
      img: currentRoom.img,
      name: $("#bName").value,
      email: $("#bEmail").value,
      guests: $("#bGuests").value,
      checkIn: bIn.value,
      checkOut: bOut.value,
      nights,
      total: nights * currentRoom.price,
    };
    const bookings = store.get("azure_bookings", []);
    bookings.push(booking);
    store.set("azure_bookings", bookings);
    // mark those nights as booked in the calendar
    for (let dt = parseYMD(bIn.value); dt < parseYMD(bOut.value); dt.setDate(dt.getDate() + 1)) BOOKED.add(ymd(dt));
    renderCalendar();
    closeModal();
    e.target.reset();
    updateBadge();
    toast(`Reservation confirmed for ${currentRoom.name}!`);
    setTimeout(openDrawer, 500);
  });

  /* ---------- My Bookings Drawer ---------- */
  const drawer = $("#bookingsDrawer");
  function renderDrawer() {
    const bookings = store.get("azure_bookings", []);
    const list = $("#drawerList");
    if (!bookings.length) {
      list.innerHTML = `<p class="drawer__empty">No trips yet.<br />Book a room to see it here.</p>`;
      return;
    }
    list.innerHTML = bookings.map((b) => `
      <div class="tripcard">
        <img src="${b.img}" alt="${b.room}" />
        <div>
          <div class="tripcard__name">${b.room}</div>
          <div class="tripcard__dates">${fmtNice(parseYMD(b.checkIn))} → ${fmtNice(parseYMD(b.checkOut))}</div>
          <div class="tripcard__dates">${b.nights} nights · ${b.guests} guests</div>
          <div class="tripcard__price">${money(b.total)}</div>
        </div>
        <button class="tripcard__del" data-del="${b.id}" aria-label="Cancel booking">✕</button>
      </div>`).join("");
  }
  function updateBadge() {
    const n = store.get("azure_bookings", []).length;
    $("#bookingsBadge").textContent = n;
  }
  function openDrawer() {
    renderDrawer();
    drawer.classList.add("is-open");
    drawer.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }
  function closeDrawer() {
    drawer.classList.remove("is-open");
    drawer.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }
  $("#openBookingsBtn").addEventListener("click", openDrawer);
  $$("[data-close-drawer]").forEach((el) => el.addEventListener("click", closeDrawer));
  $("#drawerList").addEventListener("click", (e) => {
    const del = e.target.closest("[data-del]"); if (!del) return;
    const id = +del.dataset.del;
    const bookings = store.get("azure_bookings", []).filter((b) => b.id !== id);
    store.set("azure_bookings", bookings);
    renderDrawer(); updateBadge();
    toast("Booking cancelled");
  });

  /* ---------- Hero search ---------- */
  $("#searchForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const inV = $("#searchIn").value, outV = $("#searchOut").value, type = $("#searchType").value;
    if (inV && outV && nightsBetween(inV, outV) <= 0) { toast("Check-out must be after check-in"); return; }
    // apply type filter
    activeType = type;
    $$(".chip").forEach((c) => c.classList.toggle("is-active", c.dataset.filter === type));
    renderRooms();
    document.getElementById("rooms").scrollIntoView({ behavior: "smooth" });
    toast("Showing available rooms for your dates");
  });

  /* ---------- Reviews carousel ---------- */
  const track = $("#reviewsTrack"), dots = $("#reviewsDots");
  let reviewIdx = 0;
  track.innerHTML = REVIEWS.map((r) => `
    <div class="review">
      <div class="review__stars">${"★".repeat(r.stars)}</div>
      <p class="review__text">“${r.text}”</p>
      <p class="review__author">${r.author}</p>
      <p class="review__role">${r.role}</p>
    </div>`).join("");
  dots.innerHTML = REVIEWS.map((_, i) => `<button data-idx="${i}" class="${i === 0 ? "is-active" : ""}" aria-label="Review ${i + 1}"></button>`).join("");
  function goReview(i) {
    reviewIdx = (i + REVIEWS.length) % REVIEWS.length;
    track.style.transform = `translateX(-${reviewIdx * 100}%)`;
    $$("#reviewsDots button").forEach((d, di) => d.classList.toggle("is-active", di === reviewIdx));
  }
  dots.addEventListener("click", (e) => { const b = e.target.closest("[data-idx]"); if (b) goReview(+b.dataset.idx); });
  let reviewTimer = setInterval(() => goReview(reviewIdx + 1), 5000);
  $("#reviews").addEventListener("mouseenter", () => clearInterval(reviewTimer));
  $("#reviews").addEventListener("mouseleave", () => { reviewTimer = setInterval(() => goReview(reviewIdx + 1), 5000); });

  /* ---------- Gallery lightbox ---------- */
  const lightbox = $("#lightbox"), lbImg = $("#lbImg");
  $$(".gallery__item").forEach((item) => item.addEventListener("click", () => {
    lbImg.src = item.dataset.src;
    lightbox.classList.add("is-open");
    lightbox.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }));
  function closeLightbox() {
    lightbox.classList.remove("is-open");
    lightbox.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }
  $("#lbClose").addEventListener("click", closeLightbox);
  lightbox.addEventListener("click", (e) => { if (e.target === lightbox) closeLightbox(); });

  /* ---------- Newsletter ---------- */
  $("#newsletterForm").addEventListener("submit", (e) => {
    e.preventDefault(); e.target.reset(); toast("Subscribed! Watch your inbox for offers.");
  });

  /* ---------- Global Escape ---------- */
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (modal.classList.contains("is-open")) closeModal();
    if (drawer.classList.contains("is-open")) closeDrawer();
    if (lightbox.classList.contains("is-open")) closeLightbox();
  });

  /* ---------- Init ---------- */
  $("#year").textContent = new Date().getFullYear();
  setMinDates();
  renderRooms();
  renderCalendar();
  updateCalSummary();
  updateBadge();
  observeReveals();
})();
