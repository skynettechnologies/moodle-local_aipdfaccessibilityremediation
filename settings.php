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
 * Administration pages for the AI PDF Accessibility Remediation plugin.
 *
 * The plugin has no configurable settings. The service address is fixed and
 * the account is derived from the site itself, so an administrator is never
 * asked to supply anything and no new settings appear at upgrade time. Only
 * the workspace page is registered.
 *
 * @package     local_aipdfaccessibilityremediation
 * @copyright   2026 Skynet Technologies USA LLC <hello@skynettechnologies.com>
 * @license     https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();

if ($hassiteconfig) {
    $ADMIN->add('localplugins', new admin_externalpage(
        'local_aipdfaccessibilityremediation',
        get_string('pluginname', 'local_aipdfaccessibilityremediation'),
        new moodle_url('/local/aipdfaccessibilityremediation/index.php'),
        'local/aipdfaccessibilityremediation:manage'
    ));
}
