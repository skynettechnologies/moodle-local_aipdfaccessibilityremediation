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

namespace local_freeaipdfaccessibilityremediation;

/**
 * Where the remediation service lives.
 *
 * The workspace talks to the service from the browser, so this is only asked
 * for the address to talk to. The registration call itself, and the body it
 * sends, are described in config.
 *
 * @package     local_freeaipdfaccessibilityremediation
 * @copyright   2026 Skynet Technologies USA LLC <hello@skynettechnologies.com>
 * @license     https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class api {
    /**
     * Returns the base URL of the service, without a trailing slash.
     *
     * @return string
     */
    public static function get_base_url(): string {
        return rtrim(config::API_BASE_URL, '/');
    }
}
