// Select Dropdown Functionality
function initSelectDropdowns() {
    // Toggle dropdown
    document.addEventListener('click', function(e) {
        const toggle = e.target.closest('.agaf-select-toggle');
        const dropdown = e.target.closest('.agaf-select-dropdown');
        const checkbox = e.target.closest('.agaf-select-check');

        // თუ ჩეკბოქსზე დავაწკაპეთ, არ დავხუროთ dropdown
        if (checkbox) {
            return;
        }

        // თუ toggle-ზე დავაწკაპეთ
        if (toggle) {
            const dropdown = toggle.nextElementSibling;
            const isExpanded = toggle.getAttribute('aria-expanded') === 'true';

            // Close all other dropdowns
            document.querySelectorAll('.agaf-select-dropdown.show').forEach(dd => {
                if (dd !== dropdown) {
                    dd.classList.remove('show');
                    dd.previousElementSibling.setAttribute('aria-expanded', 'false');
                }
            });

            // Toggle current
            if (!isExpanded) {
                dropdown.classList.add('show');
                toggle.setAttribute('aria-expanded', 'true');
            } else {
                dropdown.classList.remove('show');
                toggle.setAttribute('aria-expanded', 'false');
            }
        }
        // თუ dropdown-ის გარეთ დავაწკაპეთ
        else if (!e.target.closest('.agaf-select-dropdown')) {
            document.querySelectorAll('.agaf-select-dropdown.show').forEach(dd => {
                dd.classList.remove('show');
                dd.previousElementSibling.setAttribute('aria-expanded', 'false');
            });
        }
    });

    // Search functionality
    document.addEventListener('input', function(e) {
        if (e.target.classList.contains('agaf-select-search-input')) {
            const searchTerm = e.target.value.toLowerCase();
            const dropdown = e.target.closest('.agaf-select-dropdown');
            const items = dropdown.querySelectorAll('.agaf-select-item:not(.agaf-select-item-all)');

            items.forEach(item => {
                const itemName = item.getAttribute('data-name') || '';
                item.style.display = itemName.includes(searchTerm) ? '' : 'none';
            });
        }
    });

    // Select All functionality
    document.addEventListener('change', function(e) {
        if (e.target.classList.contains('agaf-select-check-all')) {
            const dropdown = e.target.closest('.agaf-select-dropdown');
            const checks = dropdown.querySelectorAll('.agaf-select-check');
            const isChecked = e.target.checked;

            checks.forEach(check => {
                check.checked = isChecked;
            });

            updateSelectLabel(dropdown);
            triggerFilterChange(dropdown);
        }
    });

    // Individual checkbox changes
    document.addEventListener('change', function(e) {
        if (e.target.classList.contains('agaf-select-check')) {
            const dropdown = e.target.closest('.agaf-select-dropdown');
            updateSelectAllState(dropdown);
            updateSelectLabel(dropdown);
            triggerFilterChange(dropdown);
        }
    });
}

function updateSelectAllState(dropdown) {
    const checks = dropdown.querySelectorAll('.agaf-select-check');
    const selectAll = dropdown.querySelector('.agaf-select-check-all');
    const allChecked = Array.from(checks).every(check => check.checked);
    const noneChecked = Array.from(checks).every(check => !check.checked);

    selectAll.checked = allChecked;
    selectAll.indeterminate = !allChecked && !noneChecked;
}

function updateSelectLabel(dropdown) {
    const toggle = dropdown.previousElementSibling;
    const selectedText = toggle.querySelector('.agaf-selected-text');
    const checks = dropdown.querySelectorAll('.agaf-select-check');
    const selectedCount = Array.from(checks).filter(check => check.checked).length;
    const totalCount = checks.length;

    let labelText;
    if (selectedCount === 0) {
        labelText = AGAF_I18N.none_selected;
    } else if (selectedCount === totalCount) {
        labelText = AGAF_I18N.all_selected;
    } else {
        labelText = `${selectedCount} ${AGAF_I18N.selected}`;
    }

    selectedText.textContent = labelText;
}

function triggerFilterChange(dropdown) {
    const filter = dropdown.closest('.agaf-filter');
    const tax = filter.getAttribute('data-tax');

    // Collect selected values
    const selectedValues = Array.from(dropdown.querySelectorAll('.agaf-select-check:checked'))
        .map(check => check.value);

    // Update global filters
    if (!window.AGAF_FILTERS) window.AGAF_FILTERS = {};
    if (selectedValues.length > 0) {
        window.AGAF_FILTERS[tax] = selectedValues;
    } else {
        delete window.AGAF_FILTERS[tax];
    }

    collectAll();
    // Trigger counts update
    if (typeof fetchCounts === 'function') {
        fetchCounts();
    }

    // Trigger products update
    if (typeof window.agAuthorFetchProducts === 'function') {
        window.agAuthorFetchProducts({ resetPage: true, doScroll: false });
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    initSelectDropdowns();

    // Initialize labels for all select dropdowns
    document.querySelectorAll('.agaf-select-dropdown').forEach(dropdown => {
        updateSelectLabel(dropdown);
        updateSelectAllState(dropdown);
    });
});

// The rest of your existing JavaScript code remains the same...
// ================== STATE ==================
window.AGAF_FILTERS = window.AGAF_FILTERS || {};
let AG_CAT_BACK_LOCK = false;
window.AG_PRICE_CAT_OVERRIDE = null;

// ================== UTILS ==================
const debounce = (fn, ms) => {
    let t;
    return function () {
        clearTimeout(t);
        const a = arguments, c = this;
        t = setTimeout(() => { fn.apply(c, a); }, ms);
    };
};

const getAuthor = () =>
    (window.AG_AUTHOR && parseInt(window.AG_AUTHOR.author || "0", 10)) || 0;

const getAjax = () =>
    (window.AG_AUTHOR && window.AG_AUTHOR.ajax_url) ||
    (window.ajaxurl || "/wp-admin/admin-ajax.php");

const getCat = () => {
    // თუ back-ის დროს დროებითი კატეგორია გვაქვს, მას გამოვიყენებთ
    if (typeof window.AG_PRICE_CAT_OVERRIDE === 'number' && window.AG_PRICE_CAT_OVERRIDE >= 0) {
        return window.AG_PRICE_CAT_OVERRIDE;
    }
    try {
        const sp = new URLSearchParams(location.search);
        return Math.max(0, parseInt(sp.get("pcat") || "0", 10));
    } catch (e) {
        return 0;
    }
};

// ================== COLLECT ==================
const collectFromContainer = (container) => {
    const res = {};
    if (!container) return res;

    // selects (ახლა dropdown-ებიდან)
    container.querySelectorAll(".agaf-select-dropdown").forEach((dropdown) => {
        const tax = dropdown.closest('.agaf-filter').getAttribute('data-tax');
        if (!tax) return;
        const vals = Array.from(dropdown.querySelectorAll('.agaf-select-check:checked'))
            .map(ch => ch.value)
            .filter(Boolean);
        if (vals.length) res[tax] = vals;
    });

    // checkboxes (ძველი სტილით)
    const groups = {};
    container
        .querySelectorAll('.agaf-checks input.agaf-input[type="checkbox"]')
        .forEach((ch) => {
            const tax = ch.getAttribute("data-tax");
            if (!tax) return;
            if (!groups[tax]) groups[tax] = [];
            if (ch.checked && ch.value) groups[tax].push(ch.value);
        });

    //  ფასის ფილტრის მონაცემები - დაამატეთ ეს ნაწილი
    container.querySelectorAll('.agaf-price-filter').forEach((priceFilter) => {
        const minInput = priceFilter.querySelector('.agaf-price-min');
        const maxInput = priceFilter.querySelector('.agaf-price-max');

        const minPrice = parseInt(minInput.value) || 0;
        const maxPrice = parseInt(maxInput.value) || '';

        if (minPrice > 0 || maxPrice) {
            res.price_range = {
                min: minPrice,
                max: maxPrice
            };
        }
    });

    Object.keys(groups).forEach((t) => {
        if (groups[t].length) res[t] = groups[t];
    });

    return res;
};

const collectAll = () => {
    const merged = {};
    document.querySelectorAll(".agaf-filters").forEach((box) => {
        const local = collectFromContainer(box);
        Object.keys(local).forEach((t) => {
            if (t === 'price_range' && local[t] && typeof local[t] === 'object') {
                //  ყოველთვის ერთი ობიექტი უნდა გვქონდეს, არა მასივი
                merged[t] = local[t];
            } else {
                if (!merged[t]) merged[t] = [];
                merged[t] = merged[t].concat(local[t]);
            }
        });
    });

    Object.keys(merged).forEach((t) => {
        if (t === 'price_range') return; // არ ვეხებით ობიექტს
        merged[t] = Array.from(new Set(merged[t]));
    });

    window.AGAF_FILTERS = merged;

    try {
        window.dispatchEvent(
            new CustomEvent("agaf:filters:changed", { detail: merged })
        );
    } catch (e) {}

    return merged;
};

// ================== COUNTS ==================
const pageTaxes = () => {
    const s = new Set();
    document.querySelectorAll(".agaf-filters [data-tax]").forEach((el) => {
        const t = el.getAttribute("data-tax");
        if (t) s.add(t);
    });
    return Array.from(s);
};

const applyCounts = (map) => {
    // CHECKBOX labels (ძველი სტილით)
    document
        .querySelectorAll(".agaf-check[data-tax][data-term-id]")
        .forEach((box) => {
            const container = box.closest(".agaf-filters");
            const show = !(container && container.getAttribute("data-show-count") === "no");

            const tx = box.getAttribute("data-tax");
            const tid = parseInt(box.getAttribute("data-term-id") || "0", 10);
            const cnt =
                map && map[tx] && typeof map[tx][tid] !== "undefined"
                    ? map[tx][tid]
                    : 0;

            let span = box.querySelector(".agaf-count");

            if (!show) {
                if (span) span.remove();
                return;
            }

            if (!span) {
                span = document.createElement("span");
                span.className = "agaf-count";
                box.appendChild(span);
            }
            span.textContent = `(${cnt | 0})`;
        });

    // SELECT dropdown options (ახალი სტილით)
    document
        .querySelectorAll(".agaf-select-check[data-tax][data-term-id]")
        .forEach((checkbox) => {
            const container = checkbox.closest(".agaf-filters");
            const show = !(container && container.getAttribute("data-show-count") === "no");

            const tx = checkbox.getAttribute("data-tax");
            const tid = parseInt(checkbox.getAttribute("data-term-id") || "0", 10);
            const cnt =
                map && map[tx] && typeof map[tx][tid] !== "undefined"
                    ? map[tx][tid]
                    : 0;

            const countSpan = checkbox.parentNode.querySelector('.agaf-count');

            if (!show) {
                if (countSpan) countSpan.remove();
                return;
            }

            if (!countSpan) {
                const newSpan = document.createElement("small");
                newSpan.className = "agaf-count";
                checkbox.parentNode.appendChild(newSpan);
                newSpan.textContent = `(${cnt | 0})`;
            } else {
                countSpan.textContent = `(${cnt | 0})`;
            }
        });
};

const _doFetchCounts = () => {
    const author = getAuthor();
    if (!author) return;

    const fd = new FormData();
    fd.append("action", "agaf_author_counts");
    fd.append("author_id", String(author));

    const cat = getCat();
    if (cat > 0) fd.append("cat_id", String(cat));

    try {
        const all = (window.AGAF_FILTERS && typeof window.AGAF_FILTERS === 'object') ? { ...window.AGAF_FILTERS } : {};
        if (!AGAF_PRICE_ACTIVE && all.price_range) {
            delete all.price_range;
        }
        fd.append("filters", JSON.stringify(all));
    } catch (e) {
        fd.append("filters", "{}");
    }

    const t = pageTaxes();
    t.forEach((tx) => fd.append("targets[]", tx));

    fetch(getAjax(), { method: "POST", credentials: "same-origin", body: fd })
        .then((r) => r.json())
        .then((data) => {
            if (data && data.success && data.data && data.data.counts) {
                applyCounts(data.data.counts);
            }
        })
        .catch((err) => {
            console.warn("AGAF counts error:", err);
        });
};

const fetchCounts = debounce(() => {
    if (AG_CAT_BACK_LOCK) return;
    _doFetchCounts();
}, 120);

// ================== EVENTS ==================
// Checkbox changes (ძველი სტილით)
document.addEventListener("change", (e) => {
    const el = e.target;
    if (!el || !el.matches) return;

    const isCheck  = el.matches('.agaf-filters .agaf-checks input.agaf-input[type="checkbox"]');
    if (!isCheck) return;

    collectAll();
    fetchCounts();

    if (typeof window.agAuthorFetchProducts === "function") {
        window.agAuthorFetchProducts({ resetPage: true, doScroll: false });
    }
});

// კატეგორიის შეცვლისას (?pcat=...) ან custom ჰუკით
window.addEventListener("ag:author:catChanged", () => {
    fetchCounts();
});

window.addEventListener("popstate", () => {
    fetchCounts();
});

// ================== BACK (ag-cat-back) ინტეგრაცია ==================
window.addEventListener('ag:cat:back:step1', function (e) {
    AG_CAT_BACK_LOCK = true;
    const cid = e && e.detail && typeof e.detail.catId === 'number' ? e.detail.catId : null;
    if (cid !== null) {
        window.AG_PRICE_CAT_OVERRIDE = cid;
    }
});

window.addEventListener('ag:cat:back:step2', function () {
    AG_CAT_BACK_LOCK = false;
    window.AG_PRICE_CAT_OVERRIDE = null;
    if (typeof fetchCounts === 'function') fetchCounts();
});

// ================== INIT ==================
const init = () => {
    collectAll();
    fetchCounts();
    // Initialize dropdown labels
    document.querySelectorAll('.agaf-select-dropdown').forEach(dropdown => {
        updateSelectLabel(dropdown);
        updateSelectAllState(dropdown);
    });

    // Initialize price filters
    document.querySelectorAll('.agaf-price-filter').forEach(initPriceSlider);
};

// DOM Ready
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function() {
        init();
        initPriceFilter();
    });
} else {
    init();
    initPriceFilter();
}

// ================== DEBUG HOOKS ==================
window.AGAF_UI = {
    collectAll,
    fetchCounts,
    clearAll: function(){
        // Clear dropdowns
        document.querySelectorAll('.agaf-select-dropdown').forEach(dropdown => {
            const checks = dropdown.querySelectorAll('.agaf-select-check');
            checks.forEach(check => check.checked = true);
            updateSelectLabel(dropdown);
            updateSelectAllState(dropdown);
        });

        // Clear old checkboxes
        document.querySelectorAll('.agaf-checks input.agaf-input[type="checkbox"]').forEach(ch => {
            ch.checked = false;
        });

        // 🔥 Clear price filters - დაამატეთ ეს ნაწილი
        document.querySelectorAll('.agaf-price-filter').forEach(priceFilter => {
            const minInput = priceFilter.querySelector('.agaf-price-min');
            const maxInput = priceFilter.querySelector('.agaf-price-max');
            const minSlider = priceFilter.querySelector('.agaf-slider-min');
            const maxSlider = priceFilter.querySelector('.agaf-slider-max');

            if (minInput) minInput.value = '';
            if (maxInput) maxInput.value = '';
            if (minSlider) minSlider.value = 0;
            if (maxSlider) maxSlider.value = 10000;

            updateSliderTrack(minSlider, maxSlider, priceFilter.querySelector('.agaf-slider-track'));
        });

        collectAll();
        if (typeof fetchCounts === 'function') {
            fetchCounts();
        }

        AGAF_PRICE_ACTIVE = false; // price აღარ ითვლება ქაუნთებში

    },
    _lockBack:   () => { AG_CAT_BACK_LOCK = true;  },
    _unlockBack: () => { AG_CAT_BACK_LOCK = false; }
};


// ფასის ფილტრის ფუნქციონალი

// === PRICE helpers ===
function readPriceValues(priceFilter){
    const min = parseInt(priceFilter.querySelector('.agaf-price-min')?.value || '', 10);
    const max = parseInt(priceFilter.querySelector('.agaf-price-max')?.value || '', 10);
    return {
        min: Number.isFinite(min) ? min : null,
        max: Number.isFinite(max) ? max : null
    };
}

function setGlobalPriceFilter(priceFilter){
    if (!window.AGAF_FILTERS) window.AGAF_FILTERS = {};
    const { min, max } = readPriceValues(priceFilter);

    // სლაიდერი/ინპუტები საერთოდ ცარიელია → მოვხსნათ price_range
    if ((min === null || min === 0) && (max === null || max === 0)) {
        delete window.AGAF_FILTERS.price_range;
        return false;
    }

    const minCap = parseInt(priceFilter.querySelector('.agaf-slider-min')?.min || '0',10) || 0;
    const maxCap = parseInt(priceFilter.querySelector('.agaf-slider-max')?.max || '0',10) || 0;

    const vmin = (min !== null) ? Math.max(minCap, Math.min(min, maxCap)) : minCap;
    const vmax = (max !== null) ? Math.max(minCap, Math.min(max, maxCap)) : maxCap;

    // თუ დეფოლტურ საზღვრებშია → საერთოდ წავშალოთ price_range
    if (vmin <= minCap && vmax >= maxCap) {
        delete window.AGAF_FILTERS.price_range;
        return false;
    }
    window.AGAF_FILTERS.price_range = { min: vmin, max: vmax };
    return true;
}

function initPriceFilter() {
    // Debounce ფუნქცია სწრაფი განახლებისთვის
    const debounce = (fn, delay) => {
        let timeoutId;
        return function(...args) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => fn.apply(this, args), delay);
        };
    };

    const debouncedSliderUpdate = debounce((priceFilter) => {
        updatePriceInputsFromSlider(priceFilter);
    }, 1);

    document.addEventListener('input', function(e) {
        if (e.target.classList.contains('agaf-price-min') ||
            e.target.classList.contains('agaf-price-max')) {
            updatePriceSliderFromInputs(e.target.closest('.agaf-price-filter'));
        }

        // 🔥 სლაიდერების real-time update
        if (e.target.classList.contains('agaf-slider-min') ||
            e.target.classList.contains('agaf-slider-max')) {
            debouncedSliderUpdate(e.target.closest('.agaf-price-filter'));
        }
    });

    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('agaf-price-apply')) {
            applyPriceFilter(e.target.closest('.agaf-price-filter'));
        }
    });

    document.querySelectorAll('.agaf-price-filter').forEach(initPriceSlider);
}

function initPriceSlider(priceFilter) {
    if (!priceFilter) return;

    const minInput  = priceFilter.querySelector('.agaf-price-min');
    const maxInput  = priceFilter.querySelector('.agaf-price-max');
    const minSlider = priceFilter.querySelector('.agaf-slider-min');
    const maxSlider = priceFilter.querySelector('.agaf-slider-max');
    const track     = priceFilter.querySelector('.agaf-slider-track');

    // პრიორიტეტი: data-max-price → slider.max → input.placeholder → 10000
    const dataMax   = parseInt(priceFilter.dataset.maxPrice || '', 10);
    const maxCap    = Number.isFinite(dataMax) && dataMax > 0 ? dataMax
        : (parseInt(maxSlider && maxSlider.max, 10) || parseInt(maxInput && maxInput.placeholder, 10) || 10000);

    // მინიმუმი: slider.min → input.placeholder → 0
    const minCap    = parseInt(minSlider && minSlider.min, 10) || parseInt(minInput && minInput.placeholder, 10) || 0;

    // სლაიდერების საზღვრები
    ['minSlider','maxSlider'].forEach(k => {
        const el = (k === 'minSlider') ? minSlider : maxSlider;
        if (!el) return;
        el.min = String(minCap);
        el.max = String(maxCap);
    });

    // საწყისი მნიშვნელობები (თუ ინპუტები ცარიელია)
    const startMin = Number.isFinite(parseInt(minInput?.value,10)) ? parseInt(minInput.value,10) : minCap;
    const startMax = Number.isFinite(parseInt(maxInput?.value,10)) ? parseInt(maxInput.value,10) : maxCap;

    minSlider.value = String(Math.max(minCap, Math.min(startMin, startMax)));
    maxSlider.value = String(Math.max(parseInt(minSlider.value,10), Math.min(startMax, maxCap)));

    if (minInput) minInput.value = minSlider.value;
    if (maxInput) maxInput.value = maxSlider.value;

    updateSliderTrack(minSlider, maxSlider, track);
}

function updateSliderTrack(minSlider, maxSlider, track) {
    if (!minSlider || !maxSlider || !track) return;

    const minVal  = parseInt(minSlider.value, 10) || 0;
    const maxVal  = parseInt(maxSlider.value, 10) || 0;
    const maxCap  = parseInt(maxSlider.max, 10) || 1;

    const leftPct  = Math.max(0, Math.min(100, (minVal / maxCap) * 100));
    const rightPct = Math.max(0, Math.min(100, 100 - (maxVal / maxCap) * 100));

    track.style.left  = leftPct + '%';
    track.style.right = rightPct + '%';
}

function updatePriceInputsFromSlider(priceFilter) {
    if (!priceFilter) return;

    const minSlider = priceFilter.querySelector('.agaf-slider-min');
    const maxSlider = priceFilter.querySelector('.agaf-slider-max');
    const minInput = priceFilter.querySelector('.agaf-price-min');
    const maxInput = priceFilter.querySelector('.agaf-price-max');
    const track = priceFilter.querySelector('.agaf-slider-track');

    let minVal = parseInt(minSlider.value, 10);
    let maxVal = parseInt(maxSlider.value, 10);
    const minCap = parseInt(minSlider.min, 10) || 0;
    const maxCap = parseInt(maxSlider.max, 10) || 0;

    // ურთიერთდაცვა
    if (minVal > maxVal) {
        minVal = maxVal;
        minSlider.value = String(minVal);
    }

    // საზღვრებში მოქცევა
    minVal = Math.max(minCap, Math.min(minVal, maxCap));
    maxVal = Math.max(minCap, Math.min(maxVal, maxCap));

    // პირდაპირი განახლება (არა debounce)
    if (minInput) minInput.value = String(minVal);
    if (maxInput) maxInput.value = String(maxVal);

    updateSliderTrack(minSlider, maxSlider, track);
}

function updatePriceSliderFromInputs(priceFilter) {
    if (!priceFilter) return;

    const minSlider = priceFilter.querySelector('.agaf-slider-min');
    const maxSlider = priceFilter.querySelector('.agaf-slider-max');
    const minInput  = priceFilter.querySelector('.agaf-price-min');
    const maxInput  = priceFilter.querySelector('.agaf-price-max');
    const track     = priceFilter.querySelector('.agaf-slider-track');

    const minCap = parseInt(minSlider.min, 10) || 0;
    const maxCap = parseInt(maxSlider.max, 10) || 0;

    let minVal = parseInt(minInput.value, 10);
    let maxVal = parseInt(maxInput.value, 10);

    if (!Number.isFinite(minVal)) minVal = minCap;
    if (!Number.isFinite(maxVal)) maxVal = maxCap;

    // საზღვრებში მოქცევა და ურთიერთდაცვა
    minVal = Math.max(minCap, Math.min(minVal, maxCap));
    maxVal = Math.max(minCap, Math.min(maxVal, maxCap));
    if (minVal > maxVal) minVal = maxVal;

    minSlider.value = String(minVal);
    maxSlider.value = String(maxVal);

    updateSliderTrack(minSlider, maxSlider, track);
}

function applyPriceFilter(priceFilter) {
    if (!priceFilter) return;

    const minInput  = priceFilter.querySelector('.agaf-price-min');
    const maxInput  = priceFilter.querySelector('.agaf-price-max');
    const minSlider = priceFilter.querySelector('.agaf-slider-min');
    const maxSlider = priceFilter.querySelector('.agaf-slider-max');

    const minCap = parseInt(minSlider.min, 10) || 0;
    const maxCap = parseInt(maxSlider.max, 10) || 0;

    const minPrice = Number.isFinite(parseInt(minInput.value,10)) ? parseInt(minInput.value,10) : minCap;
    const maxPrice = Number.isFinite(parseInt(maxInput.value,10)) ? parseInt(maxInput.value,10) : maxCap;

    if (!window.AGAF_FILTERS) window.AGAF_FILTERS = {};

    if (minPrice <= minCap && maxPrice >= maxCap) {
        delete window.AGAF_FILTERS.price_range;
    } else {
        // ყოველთვის ობიექტად ვინახავთ
        window.AGAF_FILTERS.price_range = { min: minPrice, max: maxPrice };
    }
    AGAF_PRICE_ACTIVE = !(minPrice <= minCap && maxPrice >= maxCap);
    // დაიჭირე გლობალური სთეითი (არ გადააქციოს concat-მა მასივად)
    collectAll();
    if (typeof fetchCounts === 'function') {
        fetchCounts();
    }

// პროდუქტის refresh
    if (typeof window.agAuthorFetchProducts === "function") {
        window.agAuthorFetchProducts({ resetPage: true, doScroll: false });
    }
}

function refreshPriceBounds() {
    const author = getAuthor();
    if (!author) {
        console.log('No author found');
        return Promise.resolve();
    }

    const fd = new FormData();
    fd.append('action', 'ag_author_price_bounds');
    fd.append('author_id', String(author));
    if (window.AG_AUTHOR && AG_AUTHOR.nonce) {
        fd.append('security', AG_AUTHOR.nonce);
    }

    const cat = getCat();
    console.log('Refreshing price bounds for category:', cat);
    if (cat > 0) fd.append('cat_id', String(cat));

    return fetch(getAjax(), { method:'POST', credentials:'same-origin', body: fd })
        .then(r => r.json())
        .then(data => {
            if (!data || !data.success) {
                console.log('Price bounds API error:', data);
                return;
            }

            const min = parseInt((data.data && data.data.min) || '0', 10) || 0;
            const max = parseInt((data.data && data.data.max) || '0', 10) || 0;

            console.log('New price bounds:', min, max);

            document.querySelectorAll('.agaf-price-filter').forEach(priceFilter => {
                const minInput  = priceFilter.querySelector('.agaf-price-min');
                const maxInput  = priceFilter.querySelector('.agaf-price-max');
                const minSlider = priceFilter.querySelector('.agaf-slider-min');
                const maxSlider = priceFilter.querySelector('.agaf-slider-max');
                const track     = priceFilter.querySelector('.agaf-slider-track');

                // განაახლე data-max-price და სლაიდერის საზღვრები
                priceFilter.dataset.maxPrice = String(max);

                if (minSlider) {
                    minSlider.min = String(min);
                    minSlider.max = String(max);
                }
                if (maxSlider) {
                    maxSlider.min = String(min);
                    maxSlider.max = String(max);
                }

                // არსებულად არჩეული დიაპაზონის კლამპი
                let curMin = minInput && minInput.value ? parseInt(minInput.value,10) : min;
                let curMax = maxInput && maxInput.value ? parseInt(maxInput.value,10) : max;
                if (!Number.isFinite(curMin)) curMin = min;
                if (!Number.isFinite(curMax)) curMax = max;
                curMin = Math.max(min, Math.min(curMin, max));
                curMax = Math.max(curMin, Math.min(curMax, max));

                if (minInput)  minInput.value  = String(curMin);
                if (maxInput)  maxInput.value  = String(curMax);
                if (minSlider) minSlider.value = String(curMin);
                if (maxSlider) maxSlider.value = String(curMax);

                updateSliderTrack(minSlider, maxSlider, track);

                // AGAF_FILTERS.price_range-იც დააბალანსე
                if (!window.AGAF_FILTERS) window.AGAF_FILTERS = {};
                if (window.AGAF_FILTERS.price_range) {
                    const pr = window.AGAF_FILTERS.price_range;
                    if ((pr.min|0) === (curMin|0) && (pr.max|0) === (curMax|0)) {
                        delete window.AGAF_FILTERS.price_range;
                    } else {
                        window.AGAF_FILTERS.price_range.min = curMin;
                        window.AGAF_FILTERS.price_range.max = curMax;
                    }
                }
            });
        })
        .catch((error) => {
            console.error('Price bounds fetch error:', error);
        });
}