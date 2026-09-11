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

namespace local_aipdfaccessibilityremediation;

/**
 * Fixed connection settings and the values sent when provisioning an account.
 *
 * The service address and the provisioning key are pinned here. The account the
 * site registers under is derived from the site itself, so an installation is
 * ready to use immediately and an administrator is never asked to supply
 * anything before they can start.
 *
 * Those derived values are defaults, not facts. A site's support address can
 * belong to several properties, and the host Moodle is served from is not
 * always the site whose PDFs are being remediated, so each of the three can be
 * corrected from the workspace. A correction is stored with set_config, which
 * makes it the whole site's, not one administrator's browser's.
 *
 * @package     local_aipdfaccessibilityremediation
 * @copyright   2026 Skynet Technologies USA LLC <hello@skynettechnologies.com>
 * @license     https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class config {
    /** @var string Origin of the AI PDF Remediation backend, without a trailing slash. */
    const API_BASE_URL = 'https://livepdfapi.skynettechnologies.us';

    /** @var string Accessibility dashboard the upgrade link points at. */
    const DASHBOARD_URL = 'https://ada.skynettechnologies.us';

    /** @var string Key for the provisioning endpoint, sent as X-Api-Key. */
    const PROVISION_API_KEY = 'PDF-REMEDATION-PLAN-CHECK';

    /** @var string Plan the account is provisioned on. */
    const PLAN_ID = 'free';

    /** @var string Country recorded on the account. Moodle stores none. */
    const COUNTRY = 'US';

    /** @var int Seconds to wait for the complete response. */
    const TIMEOUT = 30;

    /** @var int Seconds to wait while establishing the connection. */
    const CONNECT_TIMEOUT = 10;

    /** @var string Plugin name the account override is stored under. */
    const COMPONENT = 'local_aipdfaccessibilityremediation';

    /**
     * Returns an account field an administrator has corrected, if any.
     *
     * @param string $field One of "name", "email" or "domain".
     * @return string The stored value, or an empty string.
     */
    protected static function override(string $field): string {
        $value = get_config(self::COMPONENT, 'account' . $field);

        return is_string($value) ? trim($value) : '';
    }

    /**
     * Reduces a URL or host to the bare hostname the service expects.
     *
     * Accepts whatever an administrator types: "example.com",
     * "https://example.com/docs", or a host with a port.
     *
     * @param string $value Domain or URL.
     * @return string Bare hostname, lowercased, or an empty string.
     */
    public static function normalise_domain(string $value): string {
        $value = trim($value);
        if ($value === '') {
            return '';
        }

        if (strpos($value, '//') !== false) {
            $value = (string) parse_url($value, PHP_URL_HOST);
        } else {
            $value = explode('/', $value)[0];
            $value = explode('?', $value)[0];
            $value = preg_replace('/:\d+$/', '', $value);
        }

        return strtolower(trim($value, ". \t\n\r\0\x0B"));
    }

    /**
     * Returns the host this site is served from, for example "example.com".
     *
     * Derived from $CFG->wwwroot rather than the incoming request, so a site
     * reached through several hostnames still reports one identity.
     *
     * @return string Bare hostname, lowercased, or an empty string.
     */
    public static function website(): string {
        $stored = self::override('domain');

        return $stored !== '' ? self::normalise_domain($stored) : self::derived_website();
    }

    /**
     * Returns the host this site is served from, ignoring any correction.
     *
     * Derived from $CFG->wwwroot rather than the incoming request, so a site
     * reached through several hostnames still reports one identity.
     *
     * @return string Bare hostname, lowercased, or an empty string.
     */
    public static function derived_website(): string {
        global $CFG;

        $host = parse_url($CFG->wwwroot, PHP_URL_HOST);

        return is_string($host) ? strtolower($host) : '';
    }

    /**
     * Returns the address the account is provisioned under.
     *
     * The site support contact is preferred, because it identifies the site
     * rather than whoever happens to be signed in, which keeps one document
     * library per Moodle site instead of one per administrator.
     *
     * Hosts that are not valid email domains, such as "localhost", an intranet
     * name or a bare IP address, would be rejected by the service, so the
     * fallback address gains a ".local" suffix. Only the address changes; the
     * website reported to the service is always the real host.
     *
     * @return string Email address, or an empty string when none can be built.
     */
    public static function account_email(): string {
        $stored = self::override('email');

        return $stored !== '' ? strtolower($stored) : self::derived_email();
    }

    /**
     * Returns the address the site suggests, ignoring any correction.
     *
     * @return string Email address, or an empty string when none can be built.
     */
    public static function derived_email(): string {
        global $CFG;

        if (!empty($CFG->supportemail) && validate_email($CFG->supportemail)) {
            return $CFG->supportemail;
        }

        $host = self::derived_website();
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
    public static function account_name(): string {
        $stored = self::override('name');

        return $stored !== '' ? $stored : self::derived_name();
    }

    /**
     * Returns the contact name the site suggests, ignoring any correction.
     *
     * @return string Site support name, its full name, or the host.
     */
    public static function derived_name(): string {
        global $CFG, $SITE;

        if (!empty($CFG->supportname)) {
            return $CFG->supportname;
        }

        if (!empty($SITE->fullname)) {
            return format_string($SITE->fullname);
        }

        return self::derived_website();
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

    /**
     * Returns what the site suggests, for the fields an administrator edits.
     *
     * Shown as the placeholder beside each field, so a correction can always be
     * undone by clearing the field rather than having to remember what was
     * there before.
     *
     * @return array Keys "name", "email" and "domain".
     */
    public static function account_defaults(): array {
        return [
            'name' => self::derived_name(),
            'email' => self::derived_email(),
            'domain' => self::derived_website(),
        ];
    }

    /**
     * Stores a corrected account, or clears a field back to the site's own value.
     *
     * An empty field is stored as empty, which means "use what the site says"
     * rather than "no account" — so clearing the dialog restores the defaults.
     *
     * @param array $values Keys "name", "email" and "domain".
     * @return array The account in force afterwards.
     * @throws \moodle_exception When a supplied value cannot be used.
     */
    public static function save_account(array $values): array {
        $name = trim((string) ($values['name'] ?? ''));
        $email = strtolower(trim((string) ($values['email'] ?? '')));
        $domain = self::normalise_domain((string) ($values['domain'] ?? ''));

        if ($email !== '' && !validate_email($email)) {
            throw new \moodle_exception('erroraccountemail', self::COMPONENT);
        }

        if ($domain !== '' && strpos($domain, '.') === false) {
            throw new \moodle_exception('erroraccountdomain', self::COMPONENT);
        }

        set_config('accountname', $name, self::COMPONENT);
        set_config('accountemail', $email, self::COMPONENT);
        set_config('accountdomain', $domain, self::COMPONENT);

        return self::account();
    }
}
