<?php
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
 * Issues a remediation session for the workspace.
 *
 * The provisioning key must not reach the browser, so the page asks this
 * endpoint instead and receives only the short lived session token. Access is
 * restricted to signed in users holding the plugin capability, and the request
 * must carry a valid session key, because a token grants access to every
 * document on the account.
 *
 * A body may carry a corrected name, email or domain. It is stored first, so
 * the session that comes back belongs to the account the administrator asked
 * for rather than the one the site guessed.
 *
 * @package     local_aipdfaccessibilityremediation
 * @copyright   2026 Skynet Technologies USA LLC <hello@skynettechnologies.com>
 * @license     https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

define('AJAX_SCRIPT', true);

require(__DIR__ . '/../../config.php');

use local_aipdfaccessibilityremediation\api;
use local_aipdfaccessibilityremediation\config;

require_login();
require_sesskey();
require_capability('local/aipdfaccessibilityremediation:manage', context_system::instance());

$PAGE->set_context(context_system::instance());

header('Content-Type: application/json; charset=utf-8');

try {
    $body = json_decode(file_get_contents('php://input'), true);

    if (is_array($body) && array_key_exists('account', $body) && is_array($body['account'])) {
        config::save_account($body['account']);
    }

    $session = api::create_session();

    echo json_encode([
        'token' => $session['token'],
        'user' => $session['user'],
        'isNewToApp' => $session['isnewtoapp'],
        'account' => config::account(),
    ]);
} catch (\moodle_exception $e) {
    http_response_code(422);
    echo json_encode(['error' => $e->getMessage()]);
}
