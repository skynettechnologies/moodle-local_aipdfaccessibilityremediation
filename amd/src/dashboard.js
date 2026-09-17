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

import Log from 'core/log';
import Templates from 'core/templates';

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
 * @module     local_freeaipdfaccessibilityremediation/dashboard
 * @copyright  2026 Skynet Technologies USA LLC <hello@skynettechnologies.com>
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

/** @type {Object} Runtime configuration supplied by the page. */
var CFG = {
    apiBaseUrl: '',
    website: '',
    upgradeUrl: '',
    accountKey: '',
    account: null,
    accountDefaults: null,
    debug: false,
    provision: null,
    strings: {}
};

/** @type {Number} Percentage of a plan used before its chip turns amber. */
var PLAN_WARN_AT = 80;

/** @type {Object} Language string naming what each tab is for. */
var SUBTITLES = {
    upload: 'subtitleupload',
    scan: 'subtitlescan',
    remediated: 'subtitleremediated'
};

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
    signinfailure: null,
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
 * Writes a diagnostic line to the browser console.
 *
 * Silent unless the plugin's log is on, which is also what puts the matching
 * entries in the server side log, so the two can be read side by side.
 *
 * Warn rather than debug: this is asked for, and debug is filtered out unless
 * Moodle is running at developer level, which is a second thing to switch on.
 *
 * @param {String} label What the line is about.
 * @param {Object} detail Values worth seeing.
 */
var trace = function(label, detail) {
    if (!CFG.debug) {
        return;
    }

    try {
        Log.warn(JSON.stringify(detail), 'AI PDF Remediation ' + label);
    } catch (e) {
        Log.warn(String(detail), 'AI PDF Remediation ' + label);
    }
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
 * Reveals the workspace, once there is something in it worth looking at.
 */
var ready = function() {
    if (root) {
        root.classList.remove('aipdf-booting');
    }
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
 * @type {String|null} The session token, for as long as this page is open.
 *
 * This is the authority, and storage below is only a cache of it. The two are
 * not interchangeable: a browser can refuse to store site data — a private
 * window, blocked cookies, an enterprise policy — and when that happened to be
 * the only copy, the token vanished the moment it arrived and every request
 * after a successful registration went out unauthorised.
 */
var sessionToken = null;

/**
 * Returns the key the token is cached under.
 *
 * The fingerprint comes from the server, which derives it from the address and
 * the domain the account is registered against. Folding it in means a site
 * that changes either finds no token and registers again, rather than
 * presenting one belonging to an account it no longer uses.
 *
 * @returns {String} A storage key.
 */
var tokenKey = function() {
    return CFG.accountKey ? 'aipdf_token_' + CFG.accountKey : 'aipdf_token';
};

/**
 * Returns the session token, from this page or from the last visit.
 *
 * @returns {String|null} The token.
 */
var getToken = function() {
    if (sessionToken) {
        return sessionToken;
    }

    try {
        sessionToken = window.localStorage.getItem(tokenKey());
    } catch (e) {
        // Storage unreadable. Registration happens again instead, which costs
        // one call and is not a failure.
        sessionToken = null;
    }

    return sessionToken;
};

/**
 * Holds the session token, and keeps a copy for the next visit.
 *
 * @param {String|null} value The token, or null to forget it.
 */
var setToken = function(value) {
    sessionToken = value || null;

    try {
        if (value) {
            window.localStorage.setItem(tokenKey(), value);
        } else {
            window.localStorage.removeItem(tokenKey());
        }
    } catch (e) {
        // The token is already held above, so this page is unaffected; only
        // the saved copy for the next visit is lost.
        trace('token kept for this page only', {reason: String(e)});
    }
};

/**
 * Makes sure there is a token, registering the site only if there is not.
 *
 * @returns {Promise} Resolves once the workspace can make requests.
 */
var ensureSession = function() {
    var token = getToken();

    if (token) {
        trace('reusing the stored token', {tokenlength: token.length, key: tokenKey()});
        return Promise.resolve({ok: true, account: CFG.account || null});
    }

    return signIn(null);
};

/**
 * Shows, or clears, the standing notice that the site is not connected.
 *
 * @param {String|null} reason The service's own wording, or null to clear it.
 */
var showConnectionError = function(reason) {
    var notice = el('aipdf-connection-error');

    if (!notice) {
        return;
    }

    if (reason) {
        notice.querySelector('[data-aipdf-role="connection-detail"]').textContent = reason;
    }

    show(notice, Boolean(reason));
};

/**
 * Registers the site and opens a session on it.
 *
 * The call is made from the page rather than from the server, so that the
 * request, the response and any CORS preflight appear in the network panel
 * beside every other request the workspace makes.
 *
 * @param {Object|null} account Name, email and domain to send instead of the
 *                              ones the page was given.
 * @returns {Promise} Resolves an object with "ok" and the account used.
 */
var signIn = function(account) {
    var payload = {};
    var answer = null;

    Object.keys(CFG.provision.payload).forEach(function(key) {
        payload[key] = CFG.provision.payload[key];
    });

    if (account) {
        // The service's own field names, which are not this project's style;
        // held as strings so that neither the naming rule nor the dot notation
        // rule has an opinion about them.
        var company = 'company_name';

        payload.name = account.name || payload.name;
        payload.email = account.email || payload.email;
        payload[company] = account.name || payload[company];
        payload.website = account.domain || payload.website;
    }

    trace('provision-account, from the browser', {url: CFG.provision.url, request: payload});

    return fetch(CFG.provision.url, {
        method: 'POST',
        headers: {'Content-Type': 'application/json', 'X-Api-Key': CFG.provision.apiKey},
        body: JSON.stringify(payload)
    }).then(function(response) {
        answer = response;
        return response.json();
    }).catch(function(error) {
        if (answer) {
            return {};
        }
        // The request never reached the service. A preflight the service does
        // not answer looks exactly like this, and says only "failed to fetch".
        trace('provision-account never completed', {error: String(error)});
        throw new Error(String(error && error.message ? error.message : error));
    }).then(function(data) {
        trace('provision-account answered', {
            status: answer.status,
            ok: answer.ok,
            isNewToApp: data.isNewToApp,
            error: data.error,
            code: data.code,
            tokenlength: data.token ? data.token.length : 0
        });

        return data;
    }).then(function(data) {
        if (answer.ok && data.token) {
            setToken(data.token);
            state.signinfailure = null;
            showConnectionError(null);

            return {
                ok: true,
                account: {name: payload.name, email: payload.email, domain: payload.website}
            };
        }

        var reason = data.error || fmt('errorbadresponse', String(answer.status));

        throw new Error(reason);
    });
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
 * Signs in again and replays a request the service turned away.
 *
 * @param {String} path Endpoint path, as originally requested.
 * @param {Object} options Fetch options, as originally requested.
 * @param {Number} status Status of the response that prompted the retry.
 * @param {Object} data Body of that response.
 * @returns {Promise} Resolves with the replayed response.
 */
var replay = function(path, options, status, data) {
    if (state.signinfailure) {
        throw buildError(status, data);
    }

    return signIn(null).catch(function(error) {
        // Report what the service said the first time. That a fresh sign in
        // also failed is a symptom, not the thing worth showing.
        state.signinfailure = (error && error.message) || str('unauthenticated');
        throw buildError(status, data);
    }).then(function() {
        return request(path, options, true);
    });
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
    var answer = null;

    if (token) {
        headers.Authorization = 'Bearer ' + token;
    } else if (state.signinfailure) {
        // Nothing was ever issued, so this request would go out unauthorised
        // and come back 401. Answering here keeps the reason the service gave
        // in front of the caller, instead of burying it under a row of 401s
        // that say only that a token was missing.
        trace('request not sent, no session', {path: path, reason: state.signinfailure});
        return Promise.reject(buildError(0, {error: state.signinfailure}));
    } else {
        trace('request with no token', {path: path});
    }
    if (options.body && !(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
    }

    return fetch(apiUrl(path), {
        method: options.method || 'GET',
        body: options.body,
        headers: headers
    }).then(function(response) {
        // Held aside so that the step below can see the status as well as the
        // body: the two arrive from different promises.
        answer = response;
        return response.json();
    }).catch(function(error) {
        // A body that will not parse is not itself the failure. The service
        // answers some errors with nothing at all, and the status says what
        // happened; only a request that never arrived is rethrown here.
        if (answer) {
            return {};
        }
        throw error;
    }).then(function(data) {
        if (answer.ok) {
            return data;
        }
        if (answer.status === 401 && !isRetry) {
            setToken(null);
            return replay(path, options, answer.status, data);
        }
        throw buildError(answer.status, data);
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
    trace('service refused a request', {status: status, data: data});

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
        toast(state.signinfailure || str('unauthenticated'), 'error');
        return;
    }
    toast((error && error.message) || str(fallbackKey), 'error');
};

/* ------------------------------------------------------------------------ *
 * Endpoints
 * ------------------------------------------------------------------------ */

/**
 * Asks the service to scan one document for its page count.
 *
 * @param {String} id Document identifier.
 * @returns {Promise} Resolves when the scan has been requested.
 */
var scanDocument = function(id) {
    return request('/documents/' + id + '/scan', {method: 'POST'}).catch(function() {
        // One document that will not scan should not stop the rest.
        return null;
    });
};

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
 * Draws every icon a piece of markup asks for.
 *
 * Templates name an icon rather than carrying its path data, so this runs over
 * the static page once at startup and over each batch of rows as it arrives.
 *
 * @param {Element} scope Element whose descendants should be painted.
 */
var paintIcons = function(scope) {
    scope.querySelectorAll('[data-aipdf-icon]').forEach(function(node) {
        var size = Number(node.getAttribute('data-aipdf-size')) || 20;
        node.innerHTML = icon(node.getAttribute('data-aipdf-icon'), size);
    });
};

/**
 * Renders a table's rows from a template and puts them in place.
 *
 * The row handlers are bound to the table body rather than to the rows, so
 * replacing the contents leaves them working.
 *
 * @param {String} name Template name within this plugin.
 * @param {Array} rows Context rows, already translated and formatted.
 * @param {Element} tbody Table body to fill.
 * @returns {Promise} Resolves once the rows are on the page.
 */
var renderRows = function(name, rows, tbody) {
    return Templates.render('local_freeaipdfaccessibilityremediation/' + name, {rows: rows})
        .then(function(html) {
            Templates.replaceNodeContents(tbody, html, '');
            paintIcons(tbody);
            return null;
        }).catch(function() {
            // A template that will not render is not worth a message of its
            // own: the table simply stays as it was.
            return null;
        });
};

/**
 * Writes every static label and icon into the template.
 */
var renderStatic = function() {
    root.querySelectorAll('[data-aipdf-label]').forEach(function(node) {
        node.textContent = str(node.getAttribute('data-aipdf-label'));
    });
    paintIcons(root);
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
    var tone = 'aipdf-chip-remediated';

    if (remaining <= 0) {
        tone = 'aipdf-chip-error';
    } else if (percent >= PLAN_WARN_AT) {
        tone = 'aipdf-chip-pending';
    }

    bar.querySelector('[data-aipdf-role="plan"]').textContent = user.planName;

    var pages = bar.querySelector('[data-aipdf-role="pages"]');
    pages.className = 'aipdf-chip ' + tone;
    pages.textContent = fmt('pagesleft', remaining.toLocaleString());
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
    var items = [
        {symbol: '\u00AB', target: 1, disabled: first, current: false},
        {symbol: '\u2039', target: view.page - 1, disabled: first, current: false}
    ];
    var page;

    for (page = windowStart; page <= windowEnd; page++) {
        items.push({symbol: String(page), target: page, disabled: false, current: page === view.page});
    }

    items.push({symbol: '\u203A', target: view.page + 1, disabled: last, current: false});
    items.push({symbol: '\u00BB', target: totalPages || 1, disabled: last, current: false});

    items.forEach(function(item) {
        item.label = fmt('gotopage', item.target);
    });

    // The pager is redrawn on every page change, so the handler belongs to the
    // container rather than to the buttons inside it.
    if (!container.dataset.aipdfBound) {
        container.dataset.aipdfBound = '1';
        container.addEventListener('click', function(event) {
            var button = event.target.closest('[data-aipdf-page]');
            if (!button) {
                return;
            }

            var target = Number(button.getAttribute('data-aipdf-page'));
            if (!target || target < 1 || target > Number(container.dataset.aipdfPages) || target === view.page) {
                return;
            }
            onChange(target);
        });
    }
    container.dataset.aipdfPages = totalPages;

    return Templates.render('local_freeaipdfaccessibilityremediation/pagination', {
        showing: fmt('showingrecords', {start: start, end: end, total: view.total}),
        items: items
    }).then(function(html) {
        Templates.replaceNodeContents(container, html, '');
        return null;
    }).catch(function() {
        return null;
    });
};

/**
 * Describes a scanned document's status for the row template.
 *
 * @param {Object} doc The document.
 * @returns {String} Chip markup.
 */
var statusOf = function(doc) {
    switch (doc.status) {
        case 'scanning':
            return {tone: 'scanning', label: str('statusscanning'), action: false};
        case 'pending_scan':
            // The one status an administrator can act on from the table, so it
            // is the one rendered as a button.
            return {tone: 'pending', label: str('statuspendingscan'), action: true};
        case 'ready':
            return {tone: 'ready', label: str('statuspending'), action: false};
        case 'processing':
            return {tone: 'processing', label: str('statusremediating'), action: false};
        case 'remediated':
            return {tone: 'remediated', label: str('statusremediated'), action: false};
        default:
            return {tone: 'error', label: str('statuserror'), action: false};
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

    renderRows('upload_rows', view.docs.map(function(doc) {
        var scanning = doc.status === 'pending_scan' || doc.status === 'scanning';
        var statuschip = '';

        if (scanning) {
            statuschip = str('scanning');
        } else if (doc.status === 'processing') {
            statuschip = str('processing');
        }

        return {
            id: doc.id,
            name: doc.name,
            selectlabel: fmt('selectone', doc.name),
            checked: state.selected.indexOf(doc.id) !== -1,
            disabled: doc.status !== 'ready',
            islink: doc.source === 'url',
            source: doc.source,
            sourcelabel: doc.source === 'url' ? str('sourceurl') : str('sourcefile'),
            sourceurl: doc.sourceUrl || '',
            pages: doc.pages === null || doc.pages === undefined ? '—' : doc.pages,
            // While a document is being scanned or remediated its page count is
            // not yet known, so the cell says what is happening instead.
            statuschip: statuschip,
            statustone: scanning ? 'scanning' : 'processing',
            canremove: doc.status !== 'processing',
            removedisabled: hasSelection || busy,
            removelabel: str('remove')
        };
    }), el('aipdf-upload-tbody'));

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
        var emptykey = 'nositedomain';

        if (domain) {
            emptykey = view.search || view.status !== 'all' ? 'noscannedmatch' : 'noscanneddocuments';
        }

        el('aipdf-scan-empty').textContent = str(emptykey);
        show(el('aipdf-scan-empty'), true);
        refreshBulk();
        return;
    }

    show(el('aipdf-scan-empty'), false);
    show(el('aipdf-scan-tablewrap'), true);

    renderRows('scan_rows', view.docs.map(function(doc) {
        var status = statusOf(doc);

        return {
            id: doc.id,
            name: doc.name,
            selectlabel: fmt('selectone', doc.name),
            checked: state.selected.indexOf(doc.id) !== -1,
            disabled: doc.status !== 'ready',
            sourcelabel: str('sourcelabel'),
            sourceurl: doc.sourceUrl || '',
            uploadedlabel: str('uploadedfile'),
            pages: doc.pages || '—',
            statuslabel: status.label,
            statustone: status.tone,
            statusaction: status.action
        };
    }), el('aipdf-scan-tbody'));

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

    renderRows('remediated_rows', view.docs.map(function(doc) {
        var name = doc.remediatedName || doc.name;
        var sourcekey = 'sourceupload';

        if (doc.source === 'web') {
            sourcekey = 'sourcewebsite';
        } else if (doc.source === 'url') {
            sourcekey = 'sourceurlscan';
        }

        return {
            id: doc.id,
            name: name,
            source: doc.source,
            sourcelabel: str(sourcekey),
            date: formatDate(doc.remediatedAt),
            pages: doc.remediatedPages === null || doc.remediatedPages === undefined
                ? doc.pages : doc.remediatedPages,
            suggestionslabel: str('aisuggestions'),
            downloadlabel: str('download')
        };
    }), el('aipdf-rem-tbody'));

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
            return null;
        }).catch(function(error) {
            view.docs = [];
            view.total = 0;
            renderUpload();
            reportError(error, 'startfailed');
        }).then(function() {
            loading(false);
            return null;
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
        return null;
    }).catch(function(error) {
        view.docs = [];
        view.total = 0;
        renderScan();
        reportError(error, 'startfailed');
    }).then(function() {
        loading(false);
        return null;
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
        return null;
    }).catch(function(error) {
        view.docs = [];
        view.total = 0;
        renderRemediated();
        reportError(error, 'startfailed');
    }).then(function() {
        loading(false);
        return null;
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

    el('aipdf-subtitle').textContent = str(SUBTITLES[tab] || SUBTITLES.upload);

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
        return null;
    }).then(function() {
        el('aipdf-dropzone-label').textContent = str('draganddrop');
        loading(false);
        reloadDocuments();
        loadUpload();
        return null;
    }).catch(function() {
        return null;
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
                return scanDocument(doc.id);
            }));
        }).catch(function(error) {
            reportError(error, 'crawlerror');
        }).then(function() {
            delete button.dataset.busy;
            button.disabled = Boolean(state.job && state.job.status === 'processing');
            button.textContent = fmt('findpdfs', domain);
            reloadDocuments();
            loadScan();
            return null;
        }).catch(function() {
            return null;
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
        return null;
    }).catch(function() {
        return null;
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
        return null;
    }).catch(function() {
        toast(str('downloadfailed'), 'error');
    }).then(function() {
        button.disabled = false;
        return null;
    }).catch(function() {
        return null;
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
            return null;
        }).catch(function() {
            window.clearInterval(state.jobTimer);
            state.job = null;
            renderProgress();
            refreshBulk();
            refreshCurrent();
        });
    }, 1000);
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
        return null;
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
        return null;
    }).catch(function() {
        return null;
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
                return null;
            }).catch(function() {
                return null;
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
        closeCoverage();

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

    trace('page opened', {
        account: CFG.account,
        website: CFG.website,
        apiBaseUrl: CFG.apiBaseUrl
    });
    renderStatic();
    renderAccountBar();
    bind();

    loading(true);

    // Registration first, on its own. Nothing that needs the token is asked
    // for until one is in hand, so a site that cannot register says so once,
    // rather than producing a row of unauthorised requests that report only
    // that a token was missing.
    ensureSession().then(function() {
        return request('/auth/me');
    }).then(function(data) {
        state.user = data.user || null;
        renderPlanBar();
        return request('/billing/plans');
    }).then(function(data) {
        state.plans = data.plans || [];
        loading(false);
        switchTab('upload');
        ready();
        return null;
    }).catch(function(error) {
        var reason = (error && error.message) || str('unauthenticated');

        state.signinfailure = reason;
        showConnectionError(reason);
        toast(reason, 'error');
        loading(false);

        // Revealed even though nothing loaded: the notice explaining why is
        // inside the workspace, and a page that sits on a spinner for ever
        // says less than one that says what went wrong.
        ready();
        trace('workspace could not start', {reason: reason});

        return null;
    });
};
