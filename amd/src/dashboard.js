// This file is part of Moodle - https://moodle.org/
//
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// Moodle is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with Moodle.  If not, see <https://www.gnu.org/licenses/>.

/**
 * AI PDF Accessibility Remediation workspace.
 *
 * Drives the whole page: the three tabs, the document tables, the upload and
 * crawl actions, the remediation run and its progress, and the dialogs. Every
 * label comes from the language pack by way of the config handed in by
 * index.php, so nothing user facing is hard coded here.
 *
 * The provisioning key stays on the server. This module asks Moodle for a
 * session, receives only the short lived token, and uses that to talk to the
 * remediation service directly.
 *
 * @module     local_aipdfaccessibilityremediation/dashboard
 * @copyright  2026 Skynet Technologies USA LLC <hello@skynettechnologies.com>
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

/** @type {Object} Runtime configuration supplied by the page. */
var CFG = {
    apiBaseUrl: '',
    sessionUrl: '',
    sesskey: '',
    website: '',
    upgradeUrl: '',
    accountKey: '',
    account: null,
    accountDefaults: null,
    strings: {}
};

/** @type {Number} Percentage of a plan used before its chip turns amber. */
var PLAN_WARN_AT = 80;

/** @type {Object} Everything the interface currently shows. */
var state = {
    tab: 'upload',
    user: null,
    plans: [],
    documents: [],
    selected: [],
    job: null,
    jobTimer: null,
    loaders: 0,
    confirmAction: null,
    account: null,
    accountDraft: null,
    coverage: null,
    upload: {page: 1, perPage: 10, search: '', docs: [], total: 0},
    scan: {page: 1, perPage: 10, search: '', status: 'all', docs: [], total: 0},
    rem: {page: 1, perPage: 10, search: '', source: 'all', docs: [], total: 0}
};

/** @type {Element} The workspace root. */
var root = null;

/** @type {Object} Inline icons, kept here so the template stays free of markup noise. */
var ICONS = {
    doc: '<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5Z"/>' +
        '<path d="M14 2v6h6"/><path d="M9 13h6M9 17h6"/>',
    upload: '<path d="M12 16V4m0 0-4.5 4.5M12 4l4.5 4.5"/>' +
        '<path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/>' +
        '<path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.8-3.8"/>',
    trash: '<path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/>' +
        '<path d="M19 6l-1 15H6L5 6"/><path d="M10 11v6M14 11v6"/>',
    download: '<path d="M12 4v12m0 0 4.5-4.5M12 16l-4.5-4.5"/>' +
        '<path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
    warning: '<path d="M12 3 2.5 20h19Z"/><path d="M12 10v4m0 3v.01"/>',
    info: '<path d="M12 11v6m0-10v.01"/>',
    check: '<path d="m4 12.5 5 5L20 6.5"/>',
    crown: '<path d="M3 8l4.5 4L12 5l4.5 7L21 8l-1.5 10h-15Z"/><path d="M5 21h14"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    pencil: '<path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17Z"/><path d="m14.5 6.5 3 3"/>',
    spinner: '<path d="M12 2.5a9.5 9.5 0 1 0 9.5 9.5"/>'
};

/**
 * Builds an inline SVG icon.
 *
 * @param {String} name Icon identifier from ICONS.
 * @param {Number} size Width and height in pixels.
 * @returns {String} SVG markup, or an empty string when the name is unknown.
 */
var icon = function(name, size) {
    if (!ICONS[name]) {
        return '';
    }
    if (name === 'sparkles') {
        return '';
    }
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" ' +
        'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ' +
        'aria-hidden="true" focusable="false">' + ICONS[name] + '</svg>';
};

/**
 * Returns a translated string.
 *
 * @param {String} key Language string identifier.
 * @returns {String} The translated text, or the key when it is missing.
 */
var str = function(key) {
    return Object.prototype.hasOwnProperty.call(CFG.strings, key) ? CFG.strings[key] : key;
};

/**
 * Returns a translated string with its placeholders filled in.
 *
 * @param {String} key Language string identifier.
 * @param {Object|String|Number} values Replacements, keyed by placeholder name.
 * @returns {String} The completed text.
 */
var fmt = function(key, values) {
    var text = str(key);
    if (values === null || typeof values !== 'object') {
        return text.replace('{n}', String(values));
    }
    Object.keys(values).forEach(function(name) {
        text = text.split('{' + name + '}').join(String(values[name]));
    });
    return text;
};

/**
 * Escapes text for safe insertion into markup.
 *
 * @param {*} value Any value.
 * @returns {String} The escaped text.
 */
var esc = function(value) {
    return String(value === null || value === undefined ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
};

/**
 * Finds an element inside the workspace by id.
 *
 * @param {String} id Element identifier.
 * @returns {Element|null} The element, if present.
 */
var el = function(id) {
    return document.getElementById(id);
};

/**
 * Shows or hides an element.
 *
 * @param {Element} node Element to toggle.
 * @param {Boolean} visible Whether it should be shown.
 */
var show = function(node, visible) {
    if (node) {
        node.hidden = !visible;
    }
};

/**
 * Formats an ISO date for display.
 *
 * @param {String} iso Date in ISO 8601 format.
 * @returns {String} A short local date, or a dash.
 */
var formatDate = function(iso) {
    if (!iso) {
        return '—';
    }
    var date = new Date(iso);
    if (isNaN(date.getTime())) {
        return '—';
    }
    return date.toLocaleDateString(undefined, {month: 'short', day: '2-digit', year: 'numeric'});
};

/**
 * Delays a handler so that typing does not fire a request per keystroke.
 *
 * @param {Function} fn Handler to delay.
 * @param {Number} wait Milliseconds to wait.
 * @returns {Function} The delayed handler.
 */
var debounce = function(fn, wait) {
    var timer = null;
    return function() {
        var args = arguments;
        window.clearTimeout(timer);
        timer = window.setTimeout(function() {
            fn.apply(null, args);
        }, wait);
    };
};

var toastTimer = null;

/**
 * Shows a transient message.
 *
 * @param {String} message Text to show.
 * @param {String} kind Either "success", "error" or an empty string.
 */
var toast = function(message, kind) {
    var node = el('aipdf-toast');
    node.className = 'aipdf-toast' + (kind ? ' aipdf-toast-' + kind : '');
    node.textContent = message;
    show(node, true);
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function() {
        show(node, false);
    }, 4500);
};

/**
 * Shows or hides the busy overlay.
 *
 * Reference counted, so overlapping requests do not hide each other's overlay.
 *
 * @param {Boolean} on Whether another request has started.
 */
var loading = function(on) {
    state.loaders = Math.max(0, state.loaders + (on ? 1 : -1));
    show(el('aipdf-loader'), state.loaders > 0);
};

/* ------------------------------------------------------------------------ *
 * Session and requests
 * ------------------------------------------------------------------------ */

/**
 * Returns the storage key for the session token.
 *
 * The account is folded into the key, so a site that changes address finds no
 * token and signs in again rather than silently reusing the old account.
 *
 * @returns {String} localStorage key.
 */
var storageKey = function() {
    return CFG.accountKey ? 'aipdf_token_' + CFG.accountKey : 'aipdf_token';
};

/**
 * Reads the stored session token.
 *
 * @returns {String|null} The token, when one is held.
 */
var getToken = function() {
    try {
        return window.localStorage.getItem(storageKey());
    } catch (e) {
        return null;
    }
};

/**
 * Stores or clears the session token.
 *
 * @param {String|null} value The token, or null to forget it.
 */
var setToken = function(value) {
    try {
        if (value) {
            window.localStorage.setItem(storageKey(), value);
        } else {
            window.localStorage.removeItem(storageKey());
        }
    } catch (e) {
        // Storage unavailable: requests simply go unauthenticated and the
        // session is fetched again on the next action.
        return;
    }
};

/**
 * Asks Moodle for a remediation session.
 *
 * Corrected account details, when given, travel with the request: Moodle stores
 * them and provisions against them, so the session that comes back belongs to
 * the account the administrator asked for. The provisioning key stays on the
 * server either way.
 *
 * @param {Object|null} account Optional name, email and domain to save first.
 * @returns {Promise} Resolves an object with "ok", and the account in force.
 */
var signIn = function(account) {
    var body = account ? JSON.stringify({account: account}) : null;

    return fetch(CFG.sessionUrl + '?sesskey=' + encodeURIComponent(CFG.sesskey), {
        method: 'POST',
        headers: {'Accept': 'application/json', 'Content-Type': 'application/json'},
        credentials: 'same-origin',
        body: body
    }).then(function(response) {
        return response.json().catch(function() {
            return {};
        }).then(function(data) {
            if (!response.ok || !data || !data.token) {
                // The endpoint explains itself; pass its wording on so a
                // rejected address says why rather than just failing.
                var error = new Error((data && data.error) || str('unauthenticated'));
                error.handled = Boolean(data && data.error);
                throw error;
            }
            setToken(data.token);
            return {ok: true, account: data.account || null};
        });
    });
};

/**
 * Ensures a session exists, reusing the stored token when there is one.
 *
 * @returns {Promise} Resolves true when the workspace can make requests.
 */
var ensureSession = function() {
    if (getToken()) {
        return Promise.resolve(true);
    }
    return signIn(null).then(function(result) {
        return result.ok;
    }).catch(function() {
        return false;
    });
};

/**
 * Returns the storage key for the job this site last left running.
 *
 * @returns {String} localStorage key.
 */
var jobKey = function() {
    return storageKey() + '_job';
};

/**
 * Remembers, or forgets, a remediation job that is still running.
 *
 * The service keeps working whether or not this page is open, so the id is
 * kept and the run is picked back up on the next visit instead of appearing
 * to have stopped.
 *
 * @param {String|null} id The job id, or null to forget it.
 */
var setActiveJob = function(id) {
    try {
        if (id) {
            window.localStorage.setItem(jobKey(), id);
        } else {
            window.localStorage.removeItem(jobKey());
        }
    } catch (e) {
        // Storage unavailable: the run still finishes, it just cannot be
        // picked up again after a reload.
        return;
    }
};

/**
 * Returns the job this site left running, if any.
 *
 * @returns {String|null} The job id.
 */
var activeJob = function() {
    try {
        return window.localStorage.getItem(jobKey());
    } catch (e) {
        return null;
    }
};

/**
 * Builds an absolute URL for a service endpoint.
 *
 * @param {String} path Endpoint path, starting with a slash.
 * @returns {String} The absolute URL.
 */
var apiUrl = function(path) {
    return CFG.apiBaseUrl + '/api' + path;
};

/**
 * Performs a request against the remediation service.
 *
 * The session token is short lived. A 401 triggers one silent re-issue and a
 * replay of the original call, so a page left open overnight recovers instead
 * of failing every later action.
 *
 * @param {String} path Endpoint path, starting with a slash.
 * @param {Object} options Fetch options: method and body.
 * @param {Boolean} isRetry Whether this is already the replay.
 * @returns {Promise} Resolves with the decoded response.
 */
var request = function(path, options, isRetry) {
    options = options || {};
    var headers = {};
    var token = getToken();

    if (token) {
        headers.Authorization = 'Bearer ' + token;
    }
    if (options.body && !(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
    }

    return fetch(apiUrl(path), {
        method: options.method || 'GET',
        body: options.body,
        headers: headers
    }).then(function(response) {
        return response.json().catch(function() {
            return {};
        }).then(function(data) {
            if (response.ok) {
                return data;
            }
            if (response.status === 401 && !isRetry) {
                setToken(null);
                return signIn().then(function(ok) {
                    if (!ok) {
                        return Promise.reject(buildError(response.status, data));
                    }
                    return request(path, options, true);
                });
            }
            return Promise.reject(buildError(response.status, data));
        });
    });
};

/**
 * Wraps a failed response in an error carrying the service's own wording.
 *
 * @param {Number} status HTTP status code.
 * @param {Object} data Decoded response body.
 * @returns {Error} The error to reject with.
 */
var buildError = function(status, data) {
    var error = new Error(data && data.error ? data.error : str('startfailed'));
    error.status = status;
    error.code = data ? data.code : undefined;
    error.data = data || {};
    return error;
};

/**
 * Reports a failed request to the user.
 *
 * @param {Error} error The rejection reason.
 * @param {String} fallbackKey Language key used when the error carries no text.
 */
var reportError = function(error, fallbackKey) {
    if (error && error.status === 401) {
        toast(str('unauthenticated'), 'error');
        return;
    }
    toast((error && error.message) || str(fallbackKey), 'error');
};

/* ------------------------------------------------------------------------ *
 * Endpoints
 * ------------------------------------------------------------------------ */

/**
 * Fetches one page of documents for a tab.
 *
 * @param {Object} params Query parameters: type, page, perPage and filters.
 * @returns {Promise} Resolves with the page of documents.
 */
var fetchPage = function(params) {
    var query = new URLSearchParams();
    query.set('type', params.type);
    query.set('page', String(params.page));
    query.set('perPage', String(params.perPage));
    if (params.search) {
        query.set('search', params.search);
    }
    if (params.status && params.status !== 'all') {
        query.set('status', params.status);
    }
    if (params.domain) {
        query.set('domain', params.domain);
    }
    if (params.source && params.source !== 'all') {
        query.set('source', params.source);
    }
    return request('/documents?' + query.toString());
};

/**
 * Fetches the whole document list, which decides what may be remediated.
 *
 * @returns {Promise} Resolves with the documents, or an empty list.
 */
var reloadDocuments = function() {
    return request('/documents').then(function(data) {
        state.documents = data.documents || [];
        refreshBulk();
        return state.documents;
    }).catch(function() {
        return [];
    });
};

/* ------------------------------------------------------------------------ *
 * Selection
 * ------------------------------------------------------------------------ */

/**
 * Returns the domain the website scan tab works against.
 *
 * This site's own host wins. The account's domain list is the service's
 * record, not Moodle's: because an account is identified by its email
 * address, one account can carry domains belonging to other installations
 * that share that address, and the list's order is not ours to rely on.
 * Crawling any of those would scan somebody else's site from here.
 *
 * @returns {String} This site's host, or the account's first domain.
 */
var activeDomain = function() {
    if (CFG.website) {
        return CFG.website;
    }

    var domains = (state.user && state.user.domains) || [];
    return domains.length ? domains[0] : '';
};

/**
 * Returns the documents eligible for remediation on the current tab.
 *
 * Eligibility spans the whole queue, not just the visible page.
 *
 * @returns {Array} Documents whose status is "ready".
 */
var readyDocs = function() {
    var domain = activeDomain();
    return state.documents.filter(function(doc) {
        if (doc.status !== 'ready') {
            return false;
        }
        return state.tab === 'scan'
            ? doc.source === 'web' && doc.domain === domain
            : doc.source !== 'web';
    });
};

/**
 * Returns the eligible documents that are currently ticked.
 *
 * @returns {Array} Selected documents.
 */
var selectedReady = function() {
    return readyDocs().filter(function(doc) {
        return state.selected.indexOf(doc.id) !== -1;
    });
};

/**
 * Updates the selection summary and the bulk buttons.
 */
var refreshBulk = function() {
    var prefix = state.tab === 'scan' ? 'scan' : 'upload';
    var chosen = selectedReady();
    var pages = chosen.reduce(function(sum, doc) {
        return sum + (doc.pages || 0);
    }, 0);
    var busy = Boolean(state.job && state.job.status === 'processing');
    var view = state.tab === 'scan' ? state.scan : state.upload;

    if (el('aipdf-' + prefix + '-selcount')) {
        el('aipdf-' + prefix + '-selcount').textContent = fmt('selecteddocuments', chosen.length);
        el('aipdf-' + prefix + '-selpages').textContent = fmt('totalpages', pages);
        el('aipdf-' + prefix + '-start').disabled = chosen.length === 0 || busy;
    }
    if (el('aipdf-upload-removesel') && prefix === 'upload') {
        el('aipdf-upload-removesel').disabled = chosen.length === 0 || busy;
    }

    var eligible = view.docs.filter(function(doc) {
        return doc.status === 'ready';
    });
    var box = el('aipdf-' + prefix + '-selectall');
    if (box) {
        box.checked = eligible.length > 0 && eligible.every(function(doc) {
            return state.selected.indexOf(doc.id) !== -1;
        });
    }
};

/* ------------------------------------------------------------------------ *
 * Rendering
 * ------------------------------------------------------------------------ */

/**
 * Writes every static label and icon into the template.
 */
var renderStatic = function() {
    root.querySelectorAll('[data-aipdf-label]').forEach(function(node) {
        node.textContent = str(node.getAttribute('data-aipdf-label'));
    });
    root.querySelectorAll('[data-aipdf-icon]').forEach(function(node) {
        var size = Number(node.getAttribute('data-aipdf-size')) || 20;
        node.innerHTML = icon(node.getAttribute('data-aipdf-icon'), size);
    });
    el('aipdf-dropzone-label').textContent = str('draganddrop');
    el('aipdf-upload-search').placeholder = str('searchdocuments');
    el('aipdf-scan-search').placeholder = str('searchdocuments');
    el('aipdf-rem-search').placeholder = str('searchremediated');
};

/**
 * Renders the bar naming the account this workspace is connected as.
 */
var renderAccountBar = function() {
    var bar = el('aipdf-account-bar');

    if (!state.account || !state.account.domain) {
        show(bar, false);
        return;
    }

    bar.querySelector('[data-aipdf-role="domain"]').textContent = state.account.domain;
    bar.querySelector('[data-aipdf-role="email"]').textContent = state.account.email;
    show(bar, true);
};

/**
 * Renders the plan bar: which plan the account is on and what is left of it.
 */
var renderPlanBar = function() {
    var bar = el('aipdf-plan-bar');
    var user = state.user;

    if (!user || !user.planName) {
        show(bar, false);
        return;
    }

    var allowance = Number(user.planPages);
    var remaining = Math.max(0, Number(user.pagesRemaining) || 0);
    var metered = isFinite(allowance) && allowance > 0;
    var used = metered ? Math.min(allowance, Math.max(0, allowance - remaining)) : 0;
    var percent = metered ? Math.min(100, Math.round((used / allowance) * 100)) : 0;

    // Keyed off what is left rather than the percentage, so the last page of a
    // large plan still reads as "nearly out" and zero always reads as empty.
    var tone = remaining <= 0
        ? 'aipdf-chip-error'
        : percent >= PLAN_WARN_AT ? 'aipdf-chip-pending' : 'aipdf-chip-remediated';

    bar.querySelector('[data-aipdf-role="plan"]').textContent = user.planName;

    var pages = bar.querySelector('[data-aipdf-role="pages"]');
    pages.className = 'aipdf-chip ' + tone;
    pages.textContent = fmt('pagesleft', {
        remaining: remaining.toLocaleString(),
        total: allowance.toLocaleString()
    });
    show(pages, metered);

    // An anchor rather than a button: it goes somewhere, so middle-click and
    // "open in new tab" behave the way they do everywhere else.
    var upgrade = bar.querySelector('[data-aipdf-role="upgrade"]');
    if (CFG.upgradeUrl) {
        upgrade.href = CFG.upgradeUrl;
    } else {
        upgrade.removeAttribute('href');
    }
    show(upgrade, Boolean(CFG.upgradeUrl));

    show(bar, true);
};

/**
 * Renders the pager beneath a table.
 *
 * @param {Element} container Element to fill.
 * @param {Object} view The tab's paging state.
 * @param {Function} onChange Called with the requested page number.
 */
var renderPagination = function(container, view, onChange) {
    var totalPages = Math.ceil(view.total / view.perPage) || 0;
    var start = view.total === 0 ? 0 : ((view.page - 1) * view.perPage) + 1;
    var end = Math.min(view.page * view.perPage, view.total);
    var first = view.page === 1;
    var last = view.page === totalPages || totalPages === 0;
    var windowStart = Math.max(1, view.page - 1);
    var windowEnd = Math.min(totalPages, windowStart + 2);
    var pages = [];
    var i;

    for (i = windowStart; i <= windowEnd; i++) {
        pages.push(i);
    }

    var item = function(label, target, disabled, current) {
        return '<li class="' + (current ? 'aipdf-page-current' : '') + '">' +
            '<button type="button" class="aipdf-page-link" data-aipdf-page="' + target + '"' +
            (disabled ? ' disabled' : '') + '>' + label + '</button></li>';
    };

    container.innerHTML =
        '<span>' + esc(fmt('showingrecords', {start: start, end: end, total: view.total})) + '</span>' +
        '<ul class="aipdf-pagination-list">' +
        item('&laquo;', 1, first, false) +
        item('&lsaquo;', view.page - 1, first, false) +
        pages.map(function(page) {
            return item(String(page), page, false, page === view.page);
        }).join('') +
        item('&rsaquo;', view.page + 1, last, false) +
        item('&raquo;', totalPages || 1, last, false) +
        '</ul>';

    container.querySelectorAll('[data-aipdf-page]').forEach(function(button) {
        button.addEventListener('click', function() {
            var target = Number(button.getAttribute('data-aipdf-page'));
            if (!target || target < 1 || target > totalPages || target === view.page) {
                return;
            }
            onChange(target);
        });
    });
};

/**
 * Builds the status chip for a scanned document.
 *
 * @param {Object} doc The document.
 * @returns {String} Chip markup.
 */
var statusChip = function(doc) {
    switch (doc.status) {
        case 'scanning':
            return '<span class="aipdf-chip aipdf-chip-scanning">' + esc(str('statusscanning')) + '</span>';
        case 'pending_scan':
            return '<button type="button" class="aipdf-chip aipdf-chip-pending aipdf-chip-button" ' +
                'data-aipdf-scan="' + esc(doc.id) + '">' + esc(str('statuspendingscan')) + '</button>';
        case 'ready':
            return '<span class="aipdf-chip aipdf-chip-ready">' + esc(str('statuspending')) + '</span>';
        case 'processing':
            return '<span class="aipdf-chip aipdf-chip-processing">' + esc(str('statusremediating')) + '</span>';
        case 'remediated':
            return '<span class="aipdf-chip aipdf-chip-remediated">' + esc(str('statusremediated')) + '</span>';
        default:
            return '<span class="aipdf-chip aipdf-chip-error">' + esc(str('statuserror')) + '</span>';
    }
};

/**
 * Renders the Upload tab's table.
 */
var renderUpload = function() {
    var view = state.upload;
    var busy = Boolean(state.job && state.job.status === 'processing');
    var hasSelection = selectedReady().length > 0;

    if (!view.docs.length) {
        show(el('aipdf-upload-tablewrap'), false);
        el('aipdf-upload-empty').textContent = view.search ? str('nodocumentsmatch') : str('nodocuments');
        show(el('aipdf-upload-empty'), true);
        refreshBulk();
        return;
    }

    show(el('aipdf-upload-empty'), false);
    show(el('aipdf-upload-tablewrap'), true);

    el('aipdf-upload-tbody').innerHTML = view.docs.map(function(doc) {
        var scanning = doc.status === 'pending_scan' || doc.status === 'scanning';
        var pagesCell = scanning
            ? '<span class="aipdf-chip aipdf-chip-scanning">' + esc(str('scanning')) + '</span>'
            : (doc.status === 'processing'
                ? '<span class="aipdf-chip aipdf-chip-processing">' + esc(str('processing')) + '</span>'
                : esc(doc.pages === null || doc.pages === undefined ? '—' : doc.pages));

        return '<tr>' +
            '<td><input type="checkbox" class="aipdf-checkbox" data-aipdf-select="' + esc(doc.id) + '"' +
            (state.selected.indexOf(doc.id) !== -1 ? ' checked' : '') +
            (doc.status !== 'ready' ? ' disabled' : '') +
            ' aria-label="' + esc(fmt('selectone', doc.name)) + '"></td>' +
            '<td><span class="aipdf-doc-cell">' +
            '<span class="aipdf-file-icon' + (doc.source === 'url' ? ' aipdf-file-icon-link' : '') + '">PDF</span>' +
            '<span>' + esc(doc.name) +
            (doc.sourceUrl ? '<span class="aipdf-doc-sub">' + esc(doc.sourceUrl) + '</span>' : '') +
            '</span></span></td>' +
            '<td class="aipdf-center"><span class="aipdf-chip aipdf-chip-' + esc(doc.source) + '">' +
            esc(doc.source === 'url' ? str('sourceurl') : str('sourcefile')) + '</span></td>' +
            '<td class="aipdf-center">' + pagesCell + '</td>' +
            '<td class="aipdf-center"><span class="aipdf-row-actions">' +
            (doc.status === 'processing' ? '' :
                '<button type="button" class="aipdf-link-danger" data-aipdf-remove="' + esc(doc.id) + '"' +
                (hasSelection || busy ? ' disabled' : '') + '>' + icon('x', 14) +
                '<span>' + esc(str('remove')) + '</span></button>') +
            '</span></td></tr>';
    }).join('');

    renderPagination(el('aipdf-upload-pagination'), view, function(page) {
        view.page = page;
        loadUpload();
    });
    refreshBulk();
};

/**
 * Renders the Website scan tab's table.
 */
var renderScan = function() {
    var view = state.scan;
    var domain = activeDomain();
    var crawl = el('aipdf-crawl');

    show(crawl, Boolean(domain));
    if (domain && !crawl.dataset.busy) {
        crawl.textContent = fmt('findpdfs', domain);
    }

    if (!view.docs.length) {
        show(el('aipdf-scan-tablewrap'), false);
        el('aipdf-scan-empty').textContent = !domain
            ? str('nositedomain')
            : (view.search || view.status !== 'all' ? str('noscannedmatch') : str('noscanneddocuments'));
        show(el('aipdf-scan-empty'), true);
        refreshBulk();
        return;
    }

    show(el('aipdf-scan-empty'), false);
    show(el('aipdf-scan-tablewrap'), true);

    el('aipdf-scan-tbody').innerHTML = view.docs.map(function(doc) {
        return '<tr>' +
            '<td><input type="checkbox" class="aipdf-checkbox" data-aipdf-select="' + esc(doc.id) + '"' +
            (state.selected.indexOf(doc.id) !== -1 ? ' checked' : '') +
            (doc.status !== 'ready' ? ' disabled' : '') +
            ' aria-label="' + esc(fmt('selectone', doc.name)) + '"></td>' +
            '<td><span class="aipdf-doc-cell"><span class="aipdf-file-icon">PDF</span>' +
            '<span>' + esc(doc.name) + '<span class="aipdf-doc-sub">' + esc(str('sourcelabel')) + ' ' +
            (doc.sourceUrl
                ? '<a href="' + esc(doc.sourceUrl) + '" target="_blank" rel="noreferrer noopener">' +
                    esc(doc.sourceUrl) + '</a>'
                : esc(str('uploadedfile'))) +
            '</span></span></span></td>' +
            '<td class="aipdf-center">' + esc(doc.pages || '—') + '</td>' +
            '<td class="aipdf-center">' + statusChip(doc) + '</td></tr>';
    }).join('');

    renderPagination(el('aipdf-scan-pagination'), view, function(page) {
        view.page = page;
        loadScan();
    });
    refreshBulk();
};

/**
 * Renders the Remediated tab's table.
 */
var renderRemediated = function() {
    var view = state.rem;

    if (!view.docs.length) {
        show(el('aipdf-rem-tablewrap'), false);
        el('aipdf-rem-empty').textContent =
            (view.search || view.source !== 'all') ? str('noremediatedmatch') : str('noremediated');
        show(el('aipdf-rem-empty'), true);
        return;
    }

    show(el('aipdf-rem-empty'), false);
    show(el('aipdf-rem-tablewrap'), true);

    el('aipdf-rem-tbody').innerHTML = view.docs.map(function(doc) {
        var name = doc.remediatedName || doc.name;
        var label = doc.source === 'web' ? str('sourcewebsite')
            : (doc.source === 'url' ? str('sourceurlscan') : str('sourceupload'));

        return '<tr>' +
            '<td><span class="aipdf-doc-cell">' +
            '<span class="aipdf-file-icon aipdf-file-icon-purple">PDF</span>' + esc(name) + '</span></td>' +
            '<td class="aipdf-center"><span class="aipdf-chip aipdf-chip-' + esc(doc.source) + '">' +
            esc(label) + '</span></td>' +
            '<td class="aipdf-center">' + esc(formatDate(doc.remediatedAt)) + '</td>' +
            '<td class="aipdf-center">' +
            esc(doc.remediatedPages === null || doc.remediatedPages === undefined
                ? doc.pages : doc.remediatedPages) + '</td>' +
            '<td class="aipdf-right"><span class="aipdf-table-actions">' +
            '<button type="button" class="aipdf-btn aipdf-btn-soft aipdf-btn-sm" ' +
            'data-aipdf-suggest="' + esc(doc.id) + '">' + esc(str('aisuggestions')) + '</button>' +
            '<button type="button" class="aipdf-btn aipdf-btn-outline aipdf-btn-sm" ' +
            'data-aipdf-download="' + esc(doc.id) + '" data-aipdf-name="' + esc(name) + '">' +
            icon('download', 16) + '<span>' + esc(str('download')) + '</span></button>' +
            '</span></td></tr>';
    }).join('');

    renderPagination(el('aipdf-rem-pagination'), view, function(page) {
        view.page = page;
        loadRemediated();
    });
};

/* ------------------------------------------------------------------------ *
 * Loading
 * ------------------------------------------------------------------------ */

/**
 * Loads the Upload tab's page of documents.
 *
 * @returns {Promise} Resolves once the table has been rendered.
 */
var loadUpload = function() {
    var view = state.upload;
    loading(true);
    return fetchPage({type: 'upload', page: view.page, perPage: view.perPage, search: view.search})
        .then(function(result) {
            view.docs = result.documents || [];
            view.total = result.total || 0;
            renderUpload();
        }).catch(function(error) {
            view.docs = [];
            view.total = 0;
            renderUpload();
            reportError(error, 'startfailed');
        }).then(function() {
            loading(false);
        });
};

/**
 * Loads the Website scan tab's page of documents.
 *
 * @returns {Promise} Resolves once the table has been rendered.
 */
var loadScan = function() {
    var view = state.scan;
    var domain = activeDomain();

    if (!domain) {
        view.docs = [];
        view.total = 0;
        renderScan();
        return Promise.resolve();
    }

    loading(true);
    return fetchPage({
        type: 'scan',
        page: view.page,
        perPage: view.perPage,
        search: view.search,
        status: view.status,
        domain: domain
    }).then(function(result) {
        view.docs = result.documents || [];
        view.total = result.total || 0;
        renderScan();
    }).catch(function(error) {
        view.docs = [];
        view.total = 0;
        renderScan();
        reportError(error, 'startfailed');
    }).then(function() {
        loading(false);
    });
};

/**
 * Loads the Remediated tab's page of documents.
 *
 * @returns {Promise} Resolves once the table has been rendered.
 */
var loadRemediated = function() {
    var view = state.rem;
    loading(true);
    return fetchPage({
        type: 'remediated',
        page: view.page,
        perPage: view.perPage,
        search: view.search,
        source: view.source
    }).then(function(result) {
        view.docs = result.documents || [];
        view.total = result.total || 0;
        renderRemediated();
    }).catch(function(error) {
        view.docs = [];
        view.total = 0;
        renderRemediated();
        reportError(error, 'startfailed');
    }).then(function() {
        loading(false);
    });
};

/**
 * Reloads whichever table is on screen.
 *
 * @returns {Promise} Resolves once the table has been rendered.
 */
var refreshCurrent = function() {
    if (state.tab === 'upload') {
        return loadUpload();
    }
    if (state.tab === 'scan') {
        return loadScan();
    }
    return loadRemediated();
};

/**
 * Switches to a tab and loads it.
 *
 * @param {String} tab Either "upload", "scan" or "remediated".
 */
var switchTab = function(tab) {
    state.tab = tab;
    state.selected = [];

    ['upload', 'scan', 'remediated'].forEach(function(name) {
        var button = root.querySelector('[data-aipdf-tab="' + name + '"]');
        button.classList.toggle('aipdf-tab-active', name === tab);
        button.setAttribute('aria-selected', name === tab ? 'true' : 'false');
        show(el('aipdf-panel-' + name), name === tab);
    });

    el('aipdf-subtitle').textContent = str(
        tab === 'upload' ? 'subtitleupload' : (tab === 'scan' ? 'subtitlescan' : 'subtitleremediated')
    );

    reloadDocuments();
    refreshCurrent();
};

/* ------------------------------------------------------------------------ *
 * Actions
 * ------------------------------------------------------------------------ */

/**
 * Uploads the chosen PDF files.
 *
 * @param {FileList} files Files selected or dropped by the user.
 */
var handleFiles = function(files) {
    if (!files || !files.length) {
        return;
    }

    var accepted = [];
    Array.prototype.forEach.call(files, function(file) {
        if (!(/\.pdf$/i).test(file.name)) {
            toast(str('pdfonly'), 'error');
            return;
        }
        if (file.size > 50 * 1024 * 1024) {
            toast(str('filetoolarge'), 'error');
            return;
        }
        accepted.push(file);
    });

    if (!accepted.length) {
        return;
    }

    el('aipdf-dropzone-label').textContent = str('uploading');
    loading(true);

    Promise.all(accepted.map(function(file) {
        var form = new FormData();
        form.append('file', file);
        return request('/documents/upload', {method: 'POST', body: form}).catch(function(error) {
            reportError(error, 'uploadfailed');
            return null;
        });
    })).then(function(results) {
        var ok = results.filter(Boolean).length;
        if (ok) {
            toast(fmt('uploadsuccess', ok), 'success');
        }
    }).then(function() {
        el('aipdf-dropzone-label').textContent = str('draganddrop');
        loading(false);
        reloadDocuments();
        loadUpload();
    });
};

/**
 * Crawls this site for linked PDFs.
 */
var crawlSite = function() {
    var domain = activeDomain();
    var button = el('aipdf-crawl');

    if (!domain || button.dataset.busy) {
        return;
    }

    button.dataset.busy = '1';
    button.disabled = true;
    button.textContent = fmt('crawling', domain);

    request('/documents/crawl', {method: 'POST', body: JSON.stringify({domain: domain})})
        .then(function(result) {
            if (!result.found) {
                toast(fmt('crawlnone', domain));
                return null;
            }
            if (!result.added) {
                toast(fmt('crawlfoundexisting', {found: result.found, domain: domain}));
                return null;
            }
            toast(fmt('crawlfound', {found: result.found, added: result.added, domain: domain}), 'success');
            return Promise.all((result.documents || []).map(function(doc) {
                return request('/documents/' + doc.id + '/scan', {method: 'POST'}).catch(function() {
                    return null;
                });
            }));
        }).catch(function(error) {
            reportError(error, 'crawlerror');
        }).then(function() {
            delete button.dataset.busy;
            button.disabled = Boolean(state.job && state.job.status === 'processing');
            button.textContent = fmt('findpdfs', domain);
            reloadDocuments();
            loadScan();
        });
};

/**
 * Removes documents and refreshes the table.
 *
 * @param {Array} ids Identifiers of the documents to remove.
 */
var removeDocuments = function(ids) {
    loading(true);
    Promise.all(ids.map(function(id) {
        return request('/documents/' + id, {method: 'DELETE'}).catch(function(error) {
            reportError(error, 'removefailed');
            return null;
        });
    })).then(function() {
        state.selected = state.selected.filter(function(id) {
            return ids.indexOf(id) === -1;
        });
        loading(false);
        reloadDocuments();
        refreshCurrent();
    });
};

/**
 * Downloads a remediated file with the session token attached.
 *
 * @param {String} id Document identifier.
 * @param {String} name File name to save as.
 * @param {Element} button The button that was pressed.
 */
var downloadRemediated = function(id, name, button) {
    button.disabled = true;
    fetch(apiUrl('/documents/' + id + '/download'), {
        headers: getToken() ? {Authorization: 'Bearer ' + getToken()} : {}
    }).then(function(response) {
        if (!response.ok) {
            throw new Error(str('downloadfailed'));
        }
        return response.blob();
    }).then(function(blob) {
        var url = URL.createObjectURL(blob);
        var link = document.createElement('a');
        link.href = url;
        link.download = name;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    }).catch(function() {
        toast(str('downloadfailed'), 'error');
    }).then(function() {
        button.disabled = false;
    });
};

/* ------------------------------------------------------------------------ *
 * Remediation
 * ------------------------------------------------------------------------ */

/**
 * Paints the progress bars. Runs on every poll, so it touches nothing else.
 */
var renderProgress = function() {
    var active = Boolean(state.job && state.job.status === 'processing');
    var width = Math.max(state.job ? state.job.progress || 0 : 0, 4) + '%';

    ['aipdf-upload-progress', 'aipdf-scan-progress'].forEach(function(id) {
        var node = el(id);
        show(node, active);
        node.querySelector('[data-aipdf-role="fill"]').style.width = width;
    });
};

/**
 * Follows a running remediation job until it finishes.
 *
 * @param {Object} job The job as returned when it was started.
 */
var followJob = function(job) {
    state.job = job;
    setActiveJob(job && job.status === 'processing' ? job.id : null);
    renderProgress();
    refreshBulk();
    refreshCurrent();

    window.clearInterval(state.jobTimer);
    if (!job || job.status !== 'processing') {
        return;
    }

    state.jobTimer = window.setInterval(function() {
        request('/remediation/jobs/' + job.id).then(function(data) {
            state.job = data.job;
            state.user = data.user || state.user;
            renderProgress();

            renderPlanBar();

            if (data.job && data.job.status === 'completed') {
                window.clearInterval(state.jobTimer);
                setActiveJob(null);
                toast(str('remediationcomplete'), 'success');
                reloadDocuments();
                switchTab('remediated');
                window.setTimeout(function() {
                    state.job = null;
                    renderProgress();
                    refreshBulk();
                    refreshCurrent();
                }, 1200);
            }
        }).catch(function() {
            window.clearInterval(state.jobTimer);
            setActiveJob(null);
            state.job = null;
            renderProgress();
            refreshBulk();
            refreshCurrent();
        });
    }, 1000);
};

/**
 * Picks a run back up when one was left going, and forgets it when it is over.
 *
 * @returns {Promise} Resolves once the job has been checked.
 */
var resumeJob = function() {
    var id = activeJob();

    if (!id) {
        return Promise.resolve();
    }

    return request('/remediation/jobs/' + id).then(function(data) {
        if (data.job && data.job.status === 'processing') {
            state.user = data.user || state.user;
            followJob(data.job);
            return;
        }

        // Finished, or gone, while the page was closed.
        setActiveJob(null);
    }).catch(function() {
        setActiveJob(null);
    });
};

/**
 * Starts remediation on the current selection.
 *
 * @param {Boolean} allowPartial Whether to proceed with only the covered pages.
 */
var startRemediation = function(allowPartial) {
    var chosen = selectedReady();
    // Kept for the coverage dialog: the service usually reports the page count
    // back, but when it does not this is the number the footer already showed.
    var pageCount = chosen.reduce(function(sum, doc) {
        return sum + (doc.pages || 0);
    }, 0);

    if (!chosen.length) {
        toast(str('selectatleastone'), 'error');
        return;
    }

    loading(true);
    request('/remediation/start', {
        method: 'POST',
        body: JSON.stringify({
            documentIds: chosen.map(function(doc) {
                return doc.id;
            }),
            allowPartial: Boolean(allowPartial)
        })
    }).then(function(result) {
        state.selected = [];
        state.user = result.user || state.user;
        renderPlanBar();
        followJob(result.job);
    }).catch(function(error) {
        // The service reports both of these when a run cannot proceed as
        // asked. Each opens the coverage dialog, which carries the upgrade
        // link — a message alone would state the problem and offer no way out.
        if (error && (error.code === 'PAGE_LIMIT' || error.code === 'PARTIAL_REQUIRED')) {
            openCoverage(
                error.data.pagesRemaining || 0,
                error.data.totalPages || pageCount,
                error.message || ''
            );
        } else {
            reportError(error, 'startfailed');
        }
    }).then(function() {
        loading(false);
    });
};

/* ------------------------------------------------------------------------ *
 * Dialogs
 * ------------------------------------------------------------------------ */

/**
 * Opens the removal confirmation dialog.
 *
 * @param {String} message Question to show.
 * @param {Function} onConfirm Runs when the user confirms.
 */
var openConfirm = function(message, onConfirm) {
    var dialog = el('aipdf-confirm');
    dialog.querySelector('[data-aipdf-role="message"]').textContent = message;
    state.confirmAction = onConfirm;
    show(dialog, true);
};

/**
 * Closes the removal confirmation dialog.
 */
var closeConfirm = function() {
    state.confirmAction = null;
    show(el('aipdf-confirm'), false);
};

/**
 * Opens the AI suggestions dialog for a document.
 *
 * @param {String} id Document identifier.
 */
var openSuggestions = function(id) {
    var dialog = el('aipdf-suggestions');
    var subtitle = dialog.querySelector('[data-aipdf-role="subtitle"]');
    var body = dialog.querySelector('[data-aipdf-role="body"]');

    subtitle.textContent = '';
    body.innerHTML = '<p class="aipdf-empty">' + esc(str('analysing')) + '</p>';
    show(dialog, true);

    request('/documents/' + id + '/suggestions').then(function(data) {
        var items = (data.items || []).slice().sort(function(a, b) {
            if (a.status === b.status) {
                return 0;
            }
            return a.status === 'failed' ? -1 : 1;
        });

        subtitle.textContent = data.documentName + ' · ' + data.pages + ' ' + str('pages').toLowerCase();

        body.innerHTML =
            '<div class="aipdf-sug-summary">' +
            '<span class="aipdf-chip aipdf-chip-passed">' + esc(fmt('checkspassed', data.passed)) + '</span>' +
            (data.failed > 0
                ? '<span class="aipdf-chip aipdf-chip-pending">' + esc(fmt('checkstofix', data.failed)) + '</span>'
                : '<span class="aipdf-chip aipdf-chip-passed">' + esc(str('allcheckspassed')) + '</span>') +
            '</div><div class="aipdf-sug-list">' +
            items.map(function(item, index) {
                return '<div class="aipdf-sug-item' +
                    (item.status === 'failed' ? ' aipdf-sug-item-failed' : '') + '">' +
                    '<button type="button" class="aipdf-sug-row" data-aipdf-toggle="' + index + '" ' +
                    'aria-expanded="false">' +
                    '<span class="aipdf-sug-dot aipdf-sug-dot-' + esc(item.status) + '">' +
                    (item.status === 'passed' ? icon('check', 12) : icon('warning', 13)) + '</span>' +
                    '<span class="aipdf-sug-title">' + esc(item.title) + '</span>' +
                    '<span class="aipdf-sug-detail">' + esc(item.detail) + '</span>' +
                    (item.willAutoFix
                        ? '<span class="aipdf-chip aipdf-chip-file">' + esc(str('fixedbyai')) + '</span>'
                        : '') +
                    '<span class="aipdf-sug-caret">&#9656;</span></button>' +
                    '<div class="aipdf-sug-body" hidden>' +
                    '<p><strong>' + esc(str('whatthismeans')) + '</strong><br>' + esc(item.plain) + '</p>' +
                    '<p><strong>' + esc(str('whyitmatters')) + '</strong><br>' + esc(item.why) + '</p>' +
                    '<p><strong>' +
                    esc(item.status === 'passed' ? str('howitwasfixed') : str('howitgetsfixed')) +
                    '</strong><br>' + esc(item.fix) + '</p>' +
                    '<div class="aipdf-sug-example">' +
                    '<div class="aipdf-sug-example-col aipdf-sug-example-before">' +
                    '<div class="aipdf-sug-example-label">' + esc(str('before')) + '</div>' +
                    '<pre>' + esc(item.example && item.example.before) + '</pre></div>' +
                    '<div class="aipdf-sug-example-col aipdf-sug-example-after">' +
                    '<div class="aipdf-sug-example-label">' + esc(str('after')) + '</div>' +
                    '<pre>' + esc(item.example && item.example.after) + '</pre></div>' +
                    '</div></div></div>';
            }).join('') + '</div>';

        body.querySelectorAll('[data-aipdf-toggle]').forEach(function(button) {
            button.addEventListener('click', function() {
                var panel = button.nextElementSibling;
                var opening = panel.hidden;
                panel.hidden = !opening;
                button.setAttribute('aria-expanded', opening ? 'true' : 'false');
                button.querySelector('.aipdf-sug-caret').innerHTML = opening ? '&#9662;' : '&#9656;';
            });
        });
    }).catch(function(error) {
        body.innerHTML = '<p class="aipdf-empty">' +
            esc((error && error.message) || str('startfailed')) + '</p>';
    });
};

/* ------------------------------------------------------------------------ *
 * The account
 * ------------------------------------------------------------------------ */

/**
 * Reduces a domain or URL to the bare host the service expects.
 *
 * Mirrors config::normalise_domain() on the server, so what the field shows
 * after a correction is what was actually stored.
 *
 * @param {String} value Domain or URL.
 * @returns {String} Bare hostname, lowercased.
 */
var normaliseDomain = function(value) {
    var domain = (typeof value === 'string' ? value : '').trim();

    if (!domain) {
        return '';
    }

    if (domain.indexOf('//') !== -1) {
        domain = domain.split('//').pop();
    }

    return domain
        .split('/')[0]
        .split('?')[0]
        .replace(/:\d+$/, '')
        .replace(/^\.+|\.+$/g, '')
        .toLowerCase();
};

/**
 * Returns what the account fields currently hold.
 *
 * @returns {Object} Keys "name", "email" and "domain".
 */
var readAccountForm = function() {
    return {
        name: el('aipdf-account-name').value,
        email: el('aipdf-account-email').value,
        domain: el('aipdf-account-domain').value
    };
};

/**
 * Checks the account fields, so an obvious typo is caught before the round trip.
 *
 * An empty field is not an error: it means "use what the site says", and the
 * placeholder shows what that is. Only a value that could not work is refused.
 *
 * @param {Object} values Keys "name", "email" and "domain".
 * @returns {Object} Message keyed by field, for each field that is wrong.
 */
var validateAccount = function(values) {
    var errors = {};
    var email = (values.email || '').trim();
    var domain = normaliseDomain(values.domain);

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.email = str('erroraccountemail');
    }

    if (domain && domain.indexOf('.') === -1) {
        errors.domain = str('erroraccountdomain');
    }

    return errors;
};

/**
 * Shows or clears the message beneath each account field.
 *
 * The hint and the error occupy the same place, so the dialog does not jump
 * as messages come and go.
 *
 * @param {Object} errors Message keyed by field, as validateAccount returns.
 */
var setAccountErrors = function(errors) {
    ['name', 'email', 'domain'].forEach(function(field) {
        var id = 'aipdf-account-' + field;
        var error = el(id + '-error');
        var hint = el(id + '-hint');
        var input = el(id);

        if (errors[field]) {
            error.textContent = errors[field];
            input.setAttribute('aria-invalid', 'true');
            input.setAttribute('aria-describedby', id + '-error');
        } else {
            input.removeAttribute('aria-invalid');
            input.setAttribute('aria-describedby', id + '-hint');
        }

        show(error, Boolean(errors[field]));
        show(hint, !errors[field]);
    });
};

/**
 * Shows, or hides, the reason a submission was refused.
 *
 * @param {String|null} message The service's own wording, or null to clear it.
 */
var showAccountFailure = function(message) {
    var dialog = el('aipdf-account');
    var callout = dialog.querySelector('[data-aipdf-role="failure"]');

    if (message) {
        callout.querySelector('[data-aipdf-role="failure-text"]').textContent = message;
    }

    show(callout, Boolean(message));
};

/**
 * Locks or unlocks the account dialog while it is being submitted.
 *
 * @param {Boolean} busy Whether a submission is in flight.
 */
var setAccountBusy = function(busy) {
    var dialog = el('aipdf-account');
    var label = dialog.querySelector('[data-aipdf-role="account-save-label"]');

    label.textContent = str(busy ? 'accountsaving' : 'accountsave');
    dialog.querySelector('[data-aipdf-action="account-save"]').disabled = busy;
    dialog.querySelector('[data-aipdf-action="account-cancel"]').disabled = busy;
    dialog.querySelector('[data-aipdf-action="close"]').disabled = busy;

    ['name', 'email', 'domain'].forEach(function(field) {
        el('aipdf-account-' + field).disabled = busy;
    });
};

/**
 * Opens the account dialog, filled in with what is in force.
 */
var openAccountDialog = function() {
    var values = state.accountDraft || state.account || {};
    var defaults = CFG.accountDefaults || {};

    ['name', 'email', 'domain'].forEach(function(field) {
        var input = el('aipdf-account-' + field);
        input.value = values[field] || '';
        // What the site itself suggests, so a correction can be undone by
        // emptying the field rather than by remembering what was there.
        input.placeholder = defaults[field] || '';
    });

    setAccountErrors({});
    showAccountFailure(null);
    setAccountBusy(false);
    show(el('aipdf-account'), true);
    el('aipdf-account-name').focus();
};

/**
 * Closes the account dialog, keeping whatever was typed for the next opening.
 */
var closeAccountDialog = function() {
    state.accountDraft = readAccountForm();
    show(el('aipdf-account'), false);
};

/**
 * Saves the account, signs in again as it, and reloads what the page shows.
 *
 * The cached token belongs to the previous account, so it is dropped first:
 * keeping it would leave the workspace showing the old account's documents
 * under the new account's name.
 *
 * @returns {Promise} Resolves once the workspace has been reloaded.
 */
var saveAccount = function() {
    var values = readAccountForm();
    var errors = validateAccount(values);

    setAccountErrors(errors);
    showAccountFailure(null);

    if (Object.keys(errors).length) {
        return Promise.resolve();
    }

    setAccountBusy(true);
    setToken(null);
    setActiveJob(null);

    return signIn(values).then(function(result) {
        state.account = result.account || state.account;
        state.accountDraft = null;
        CFG.website = state.account ? state.account.domain : CFG.website;
        show(el('aipdf-account'), false);
        renderAccountBar();

        return request('/auth/me').catch(function() {
            return {};
        });
    }).then(function(data) {
        state.user = data.user || null;
        renderPlanBar();
        state.selected = [];
        return reloadDocuments();
    }).then(function() {
        refreshCurrent();
        refreshBulk();
    }).catch(function(error) {
        showAccountFailure(error && error.message ? error.message : str('startfailed'));
    }).then(function() {
        setAccountBusy(false);
    });
};

/**
 * Opens the plan coverage dialog.
 *
 * Opens for whichever way the service refused a run:
 *
 *   partial    the plan covers some of the selection, so the dialog offers
 *              both upgrading and continuing with the covered pages;
 *   exhausted  the plan has nothing left, so there is nothing to continue
 *              with and only the upgrade path is offered.
 *
 * Which one it is comes from the number of pages left rather than the error
 * code, so a PAGE_LIMIT that ever arrives with pages remaining still offers
 * the choice.
 *
 * @param {Number} covered Pages the plan can still process.
 * @param {Number} total Pages the selection contains.
 * @param {String} message The service's own wording, used when it fits.
 */
var openCoverage = function(covered, total, message) {
    var dialog = el('aipdf-coverage');
    var isFree = state.user && state.user.planId === 'free';
    var accept = el('aipdf-coverage-accept');
    var canContinue = covered > 0;

    state.coverage = {covered: covered, total: total, canContinue: canContinue};

    dialog.querySelector('[data-aipdf-role="icon"]').innerHTML =
        icon(canContinue ? 'info' : 'warning', 24);

    if (canContinue) {
        dialog.querySelector('[data-aipdf-role="title"]').textContent = isFree
            ? fmt('coveragetrial', covered)
            : fmt('coveragecurrent', {covered: covered, total: total});
        dialog.querySelector('[data-aipdf-role="body"]').textContent =
            fmt('coveragebody', {covered: covered, total: total});
        dialog.querySelector('[data-aipdf-role="accept-label"]').textContent = isFree
            ? fmt('continuewithtrial', covered)
            : fmt('continuewithplan', covered);
    } else {
        // The service says why in a sentence of its own; it is more specific
        // than anything written here, so it is preferred when it is there.
        dialog.querySelector('[data-aipdf-role="title"]').textContent =
            message || str(isFree ? 'coverageexhaustedtrial' : 'coverageexhausted');
        dialog.querySelector('[data-aipdf-role="body"]').textContent = fmt(
            isFree ? 'coverageexhaustedpagestrial' : 'coverageexhaustedpages',
            total.toLocaleString()
        );
    }

    // Two buttons either way: Cancel takes the place of Continue when there is
    // nothing to continue with, so the row stays balanced and the dialog can
    // still be dismissed from a button rather than only with Escape.
    accept.checked = false;
    dialog.querySelector('[data-aipdf-action="continue"]').disabled = true;
    dialog.querySelector('[data-aipdf-role="upgrade-label"]').textContent =
        str(canContinue ? 'recommendedplan' : 'upgradeplan');

    show(dialog.querySelector('[data-aipdf-role="accept-row"]'), canContinue);
    show(dialog.querySelector('[data-aipdf-action="continue"]'), canContinue);
    show(dialog.querySelector('[data-aipdf-action="coverage-cancel"]'), !canContinue);

    var pill = dialog.querySelector('[data-aipdf-role="recommended"]');
    var plan = recommendPlan(total);
    if (plan) {
        pill.querySelector('[data-aipdf-role="recommended-text"]').textContent = fmt('recommendedplanis', {
            name: plan.name,
            pages: plan.pages.toLocaleString(),
            price: plan.price.toLocaleString()
        });
    }
    show(pill, Boolean(plan));
    show(dialog, true);
};

/**
 * Closes the plan coverage dialog.
 */
var closeCoverage = function() {
    state.coverage = null;
    show(el('aipdf-coverage'), false);
};

/**
 * Returns the smallest paid plan that covers a page count.
 *
 * @param {Number} pages Pages the selection contains.
 * @returns {Object|null} The recommended plan, when one is known.
 */
var recommendPlan = function(pages) {
    var paid = state.plans.filter(function(plan) {
        return plan.price > 0;
    }).sort(function(a, b) {
        return a.pages - b.pages;
    });

    if (!paid.length) {
        return null;
    }

    var covering = paid.filter(function(plan) {
        return plan.pages >= pages;
    });

    return covering.length ? covering[0] : paid[paid.length - 1];
};

/* ------------------------------------------------------------------------ *
 * Wiring
 * ------------------------------------------------------------------------ */

/**
 * Attaches every event handler the page needs.
 */
var bind = function() {
    root.querySelectorAll('[data-aipdf-tab]').forEach(function(button) {
        button.addEventListener('click', function() {
            switchTab(button.getAttribute('data-aipdf-tab'));
        });
    });

    var dropzone = el('aipdf-dropzone');
    var fileinput = el('aipdf-fileinput');

    dropzone.addEventListener('click', function() {
        fileinput.click();
    });
    dropzone.addEventListener('keydown', function(event) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            fileinput.click();
        }
    });
    dropzone.addEventListener('dragover', function(event) {
        event.preventDefault();
        dropzone.classList.add('aipdf-dragging');
    });
    dropzone.addEventListener('dragleave', function() {
        dropzone.classList.remove('aipdf-dragging');
    });
    dropzone.addEventListener('drop', function(event) {
        event.preventDefault();
        dropzone.classList.remove('aipdf-dragging');
        handleFiles(event.dataTransfer.files);
    });
    fileinput.addEventListener('change', function() {
        handleFiles(fileinput.files);
        fileinput.value = '';
    });

    // Upload tab.
    el('aipdf-upload-search').addEventListener('input', debounce(function(event) {
        state.upload.search = event.target.value.trim();
        state.upload.page = 1;
        loadUpload();
    }, 350));
    el('aipdf-upload-perpage').addEventListener('change', function(event) {
        state.upload.perPage = Number(event.target.value);
        state.upload.page = 1;
        loadUpload();
    });
    el('aipdf-upload-selectall').addEventListener('change', function(event) {
        toggleAll(state.upload, event.target.checked);
        renderUpload();
    });
    el('aipdf-upload-tbody').addEventListener('change', function(event) {
        if (handleSelect(event)) {
            renderUpload();
        }
    });
    el('aipdf-upload-tbody').addEventListener('click', function(event) {
        var button = event.target.closest('[data-aipdf-remove]');
        if (!button || button.disabled) {
            return;
        }
        var id = button.getAttribute('data-aipdf-remove');
        var doc = state.upload.docs.filter(function(item) {
            return item.id === id;
        })[0];
        openConfirm(fmt('confirmremoveone', doc ? doc.name : ''), function() {
            removeDocuments([id]);
        });
    });
    el('aipdf-upload-removesel').addEventListener('click', function() {
        var ids = selectedReady().map(function(doc) {
            return doc.id;
        });
        if (ids.length) {
            openConfirm(str('confirmremoveall'), function() {
                removeDocuments(ids);
            });
        }
    });
    el('aipdf-upload-start').addEventListener('click', function() {
        startRemediation(false);
    });

    // Website scan tab.
    el('aipdf-crawl').addEventListener('click', crawlSite);

    el('aipdf-scan-search').addEventListener('input', debounce(function(event) {
        state.scan.search = event.target.value.trim();
        state.scan.page = 1;
        loadScan();
    }, 350));
    el('aipdf-scan-status').addEventListener('change', function(event) {
        state.scan.status = event.target.value;
        state.scan.page = 1;
        loadScan();
    });
    el('aipdf-scan-perpage').addEventListener('change', function(event) {
        state.scan.perPage = Number(event.target.value);
        state.scan.page = 1;
        loadScan();
    });
    el('aipdf-scan-selectall').addEventListener('change', function(event) {
        toggleAll(state.scan, event.target.checked);
        renderScan();
    });
    el('aipdf-scan-tbody').addEventListener('change', function(event) {
        if (handleSelect(event)) {
            renderScan();
        }
    });
    el('aipdf-scan-tbody').addEventListener('click', function(event) {
        var button = event.target.closest('[data-aipdf-scan]');
        if (!button) {
            return;
        }
        loading(true);
        request('/documents/' + button.getAttribute('data-aipdf-scan') + '/scan', {method: 'POST'})
            .catch(function(error) {
                reportError(error, 'scanfailed');
            }).then(function() {
                loading(false);
                reloadDocuments();
                loadScan();
            });
    });
    el('aipdf-scan-start').addEventListener('click', function() {
        startRemediation(false);
    });

    // Remediated tab.
    el('aipdf-rem-search').addEventListener('input', debounce(function(event) {
        state.rem.search = event.target.value.trim();
        state.rem.page = 1;
        loadRemediated();
    }, 350));
    el('aipdf-rem-source').addEventListener('change', function(event) {
        state.rem.source = event.target.value;
        state.rem.page = 1;
        loadRemediated();
    });
    el('aipdf-rem-perpage').addEventListener('change', function(event) {
        state.rem.perPage = Number(event.target.value);
        state.rem.page = 1;
        loadRemediated();
    });
    el('aipdf-rem-tbody').addEventListener('click', function(event) {
        var suggest = event.target.closest('[data-aipdf-suggest]');
        if (suggest) {
            openSuggestions(suggest.getAttribute('data-aipdf-suggest'));
            return;
        }
        var download = event.target.closest('[data-aipdf-download]');
        if (download) {
            downloadRemediated(
                download.getAttribute('data-aipdf-download'),
                download.getAttribute('data-aipdf-name'),
                download
            );
        }
    });

    // Dialogs.
    el('aipdf-confirm').addEventListener('click', function(event) {
        if (event.target.closest('[data-aipdf-action="confirm"]')) {
            var action = state.confirmAction;
            closeConfirm();
            if (action) {
                action();
            }
        } else if (event.target.closest('[data-aipdf-action="cancel"]') || event.target === el('aipdf-confirm')) {
            closeConfirm();
        }
    });

    el('aipdf-suggestions').addEventListener('click', function(event) {
        if (event.target === el('aipdf-suggestions') || event.target.closest('[data-aipdf-action="close"]')) {
            show(el('aipdf-suggestions'), false);
        }
    });

    var account = el('aipdf-account');
    el('aipdf-account-bar').addEventListener('click', function(event) {
        if (event.target.closest('[data-aipdf-action="account-change"]')) {
            state.accountDraft = null;
            openAccountDialog();
        }
    });
    account.addEventListener('click', function(event) {
        if (el('aipdf-account-name').disabled) {
            return;
        }
        if (event.target === account ||
                event.target.closest('[data-aipdf-action="close"]') ||
                event.target.closest('[data-aipdf-action="account-cancel"]')) {
            closeAccountDialog();
        }
    });
    ['name', 'email', 'domain'].forEach(function(field) {
        el('aipdf-account-' + field).addEventListener('input', function() {
            showAccountFailure(null);
        });
    });
    el('aipdf-account-form').addEventListener('submit', function(event) {
        event.preventDefault();
        saveAccount();
    });

    var coverage = el('aipdf-coverage');
    coverage.addEventListener('click', function(event) {
        if (event.target === coverage ||
                event.target.closest('[data-aipdf-action="coverage-cancel"]')) {
            closeCoverage();
            return;
        }
        if (event.target.closest('[data-aipdf-action="upgrade"]')) {
            // Opened in a new tab so the workspace, and any selection in it, is
            // left untouched. "noopener" keeps the dashboard from reaching back
            // into this page through window.opener.
            if (CFG.upgradeUrl) {
                window.open(CFG.upgradeUrl, '_blank', 'noopener');
            }
            return;
        }
        if (event.target.closest('[data-aipdf-action="continue"]')) {
            closeCoverage();
            startRemediation(true);
        }
    });
    el('aipdf-coverage-accept').addEventListener('change', function(event) {
        coverage.querySelector('[data-aipdf-action="continue"]').disabled = !event.target.checked;
    });

    document.addEventListener('keydown', function(event) {
        if (event.key !== 'Escape') {
            return;
        }
        closeConfirm();
        show(el('aipdf-suggestions'), false);
        closeCoverage();

        if (!el('aipdf-account-name').disabled) {
            closeAccountDialog();
        }
    });
};

/**
 * Ticks or unticks every eligible document on the visible page.
 *
 * @param {Object} view The tab's state.
 * @param {Boolean} checked Whether the documents should be selected.
 */
var toggleAll = function(view, checked) {
    view.docs.filter(function(doc) {
        return doc.status === 'ready';
    }).forEach(function(doc) {
        var index = state.selected.indexOf(doc.id);
        if (checked && index === -1) {
            state.selected.push(doc.id);
        } else if (!checked && index !== -1) {
            state.selected.splice(index, 1);
        }
    });
};

/**
 * Records a change to a single row's checkbox.
 *
 * @param {Event} event The change event.
 * @returns {Boolean} Whether the selection changed.
 */
var handleSelect = function(event) {
    var id = event.target.getAttribute && event.target.getAttribute('data-aipdf-select');
    if (!id) {
        return false;
    }
    var index = state.selected.indexOf(id);
    if (event.target.checked && index === -1) {
        state.selected.push(id);
    } else if (!event.target.checked && index !== -1) {
        state.selected.splice(index, 1);
    }
    return true;
};

/**
 * Starts the interface.
 *
 * @param {Object} config Runtime configuration supplied by the page.
 */
export const init = (config) => {
    root = document.getElementById('aipdf-app');
    if (!root) {
        return;
    }

    CFG = config;
    state.account = CFG.account || null;
    renderStatic();
    renderAccountBar();
    bind();

    loading(true);
    ensureSession().then(function(ok) {
        if (!ok) {
            toast(str('unauthenticated'), 'error');
        }
        return request('/auth/me').catch(function() {
            return {};
        });
    }).then(function(data) {
        state.user = data.user || null;
        renderPlanBar();
        return request('/billing/plans').catch(function() {
            return {};
        });
    }).then(function(data) {
        state.plans = data.plans || [];
        return resumeJob();
    }).then(function() {
        loading(false);
        switchTab('upload');
    });
};
