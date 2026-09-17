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
 * Fixed connection settings and the values sent when provisioning an account.
 *
 * The service address and the provisioning key are pinned here. The account is
 * derived: the administrator using the workspace supplies the name and address,
 * and the site supplies the domain, so an installation is ready to use
 * immediately and nobody is asked to fill anything in before they can start.
 *
 * Nothing here is configurable. The values follow the site and the person
 * using it, which is what keeps the plugin drop-in; where they are wrong, they
 * are wrong in Moodle's own settings and are corrected there.
 *
 * @package     local_freeaipdfaccessibilityremediation
 * @copyright   2026 Skynet Technologies USA LLC <hello@skynettechnologies.com>
 * @license     https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class config {
    /** @var string Origin of the AI PDF Remediation backend, without a trailing slash. */
    public const API_BASE_URL = 'https://livepdfapi.skynettechnologies.us';

    /** @var string Accessibility dashboard the upgrade link points at. */
    public const DASHBOARD_URL = 'https://ada.skynettechnologies.us';

    /** @var string Key for the provisioning endpoint, sent as X-Api-Key. */
    public const PROVISION_API_KEY = 'PDF-REMEDATION-PLAN-CHECK';

    /** @var string Plan the account is provisioned on. */
    public const PLAN_ID = 'free';

    /** @var string Country recorded on the account. Moodle stores none. */
    public const COUNTRY = 'US';

    /** @var int Seconds to wait for the complete response. */
    public const TIMEOUT = 30;

    /** @var int Seconds to wait while establishing the connection. */
    public const CONNECT_TIMEOUT = 10;

    /**
     * Returns the host this site is served from.
     *
     * Derived from $CFG->wwwroot rather than the incoming request, so a site
     * reached through several hostnames still reports one identity.
     *
     * @return string Bare hostname, lowercased, or an empty string.
     */
    public static function website(): string {
        global $CFG;

        $host = parse_url($CFG->wwwroot, PHP_URL_HOST);

        return is_string($host) ? strtolower($host) : '';
    }

    /**
     * Returns the signed-in administrator, when there is a real one.
     *
     * Not during an upgrade, a scheduled task or a CLI run, where there is no
     * person behind the request and $USER is a placeholder.
     *
     * @return \stdClass|null The user record, or null.
     */
    protected static function current_admin(): ?\stdClass {
        global $USER;

        if (!isloggedin() || isguestuser()) {
            return null;
        }

        return empty($USER->id) ? null : $USER;
    }

    /**
     * Returns the address the account is provisioned under.
     *
     * The administrator using the workspace comes first: it is their address
     * the remediation account belongs to, and the one they expect to see. The
     * site support contact stands behind it for the times there is nobody
     * signed in, and a noreply address on this host behind that.
     *
     * Hosts that are not valid email domains — "localhost", an intranet name,
     * a bare IP — would be rejected by the service, so the fallback address
     * gains a ".local" suffix. Only the address changes; the website reported
     * to the service is always the real host.
     *
     * NOTE: this makes the account personal rather than site wide. Two
     * administrators are two accounts, and the service allows one account per
     * domain, so the second is refused with "this domain is already
     * associated with a different account".
     *
     * @return string Email address, or an empty string when none can be built.
     */
    public static function account_email(): string {
        global $CFG;

        $admin = self::current_admin();
        if ($admin !== null && !empty($admin->email) && validate_email($admin->email)) {
            return strtolower($admin->email);
        }

        if (!empty($CFG->supportemail) && validate_email($CFG->supportemail)) {
            return $CFG->supportemail;
        }

        $host = self::website();
        if ($host === '') {
            return '';
        }

        if (strpos($host, '.') === false || filter_var($host, FILTER_VALIDATE_IP)) {
            $host .= '.local';
        }

        return 'noreply@' . $host;
    }

    /**
     * Returns the contact name recorded on the account.
     *
     * @return string Site support name, its full name, or the host.
     */
    /**
     * Returns the contact name recorded on the account.
     *
     * Follows the address: where the account belongs to the administrator
     * using it, the name on it should be theirs too.
     *
     * @return string The administrator's name, the support name, the site's
     *                full name, or the host.
     */
    public static function account_name(): string {
        global $CFG, $SITE;

        $admin = self::current_admin();
        if ($admin !== null) {
            $name = fullname($admin);
            if (trim($name) !== '') {
                return $name;
            }
        }

        if (!empty($CFG->supportname)) {
            return $CFG->supportname;
        }

        if (!empty($SITE->fullname)) {
            return format_string($SITE->fullname);
        }

        return self::website();
    }

    /**
     * Returns the organisation name recorded on the account.
     *
     * @return string Site full name, or the host.
     */
    public static function company_name(): string {
        global $SITE;

        if (!empty($SITE->fullname)) {
            return format_string($SITE->fullname);
        }

        return self::website();
    }

    /**
     * Returns the autologin link behind the coverage dialog's upgrade button.
     *
     * It signs the administrator into the accessibility dashboard for this
     * site and lands them on its plans page, so there is no second login.
     *
     * The payload is base64 of "<host>|pf". The "pf" marker tells the dashboard
     * the visitor arrived from PDF remediation, so it opens the PDF plans
     * rather than the general ones.
     *
     * @return string Absolute URL, or an empty string when the host is unknown.
     */
    public static function upgrade_url(): string {
        $host = self::website();

        return $host === '' ? '' : self::DASHBOARD_URL . '/front/autologin/' . base64_encode($host . '|pf');
    }

    /**
     * Returns a fingerprint of the account this site signs in as.
     *
     * The browser caches its session token. Folding the account into the
     * storage key means a site that is moved to a new address simply finds no
     * token and signs in again, instead of quietly reusing the old account's
     * session until it expires.
     *
     * @return string Twelve hexadecimal characters. Identifies nobody on its own.
     */
    public static function account_key(): string {
        return substr(sha1(self::website() . '|' . self::account_email()), 0, 12);
    }

    /**
     * Returns the body the provisioning call sends.
     *
     * Shared so that the browser diagnostic sends exactly what the server
     * would, rather than an approximation of it.
     *
     * @return array
     */
    public static function provision_payload(): array {
        return [
            'name' => self::account_name(),
            'email' => self::account_email(),
            'company_name' => self::company_name(),
            'website' => self::website(),
            'plan_id' => self::PLAN_ID,
            'country' => self::COUNTRY,
        ];
    }

    /**
     * Returns the account the workspace is connected as.
     *
     * @return array Keys "name", "email" and "domain".
     */
    public static function account(): array {
        return [
            'name' => self::account_name(),
            'email' => self::account_email(),
            'domain' => self::website(),
        ];
    }
}
