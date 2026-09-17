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

namespace local_freeaipdfaccessibilityremediation\privacy;

use core_privacy\local\metadata\collection;

/**
 * Privacy provider for the AI PDF Accessibility Remediation plugin.
 *
 * The plugin stores no personal data in Moodle. It does send the site contact
 * details to the remediation service when the site is registered, and the
 * documents an administrator uploads are processed by that service, so both
 * transfers are declared as an external location.
 *
 * @package     local_freeaipdfaccessibilityremediation
 * @copyright   2026 Skynet Technologies USA LLC <hello@skynettechnologies.com>
 * @license     https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class provider implements \core_privacy\local\metadata\provider {
    /**
     * Describes the data this plugin sends to the remediation service.
     *
     * @param collection $collection The initialised collection to add items to.
     * @return collection The updated collection of metadata items.
     */
    public static function get_metadata(collection $collection): collection {
        $collection->add_external_location_link(
            'freeaipdfaccessibilityremediation',
            [
                'website' => 'privacy:metadata:freeaipdfaccessibilityremediation:website',
                'name' => 'privacy:metadata:freeaipdfaccessibilityremediation:name',
                'email' => 'privacy:metadata:freeaipdfaccessibilityremediation:email',
                'company_name' => 'privacy:metadata:freeaipdfaccessibilityremediation:company_name',
                'documents' => 'privacy:metadata:freeaipdfaccessibilityremediation:documents',
            ],
            'privacy:metadata:freeaipdfaccessibilityremediation'
        );

        return $collection;
    }
}
