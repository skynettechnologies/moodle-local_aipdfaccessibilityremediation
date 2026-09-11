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
 * Server side half of the remediation service handshake.
 *
 * One call does both jobs: it registers the site on first use and returns a
 * session on every use thereafter.
 *
 *     POST {API_BASE_URL}/api/billing/provision-account
 *          X-Api-Key: <PROVISION_API_KEY>
 *          {name, email, company_name, website, plan_id, country}
 *       -> {token, user, isNewToApp, orderId}
 *
 * It is idempotent: the same address comes back as the same account with
 * "isNewToApp" false, so there is no separate registration step to guard and
 * repeat calls cannot create duplicate accounts.
 *
 * The key never reaches the browser. The page asks Moodle for a session and
 * receives only the short lived token, which it then uses to talk to the
 * document endpoints directly.
 *
 * @package     local_aipdfaccessibilityremediation
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

    /**
     * Registers the site if needed and opens a session on the account.
     *
     * @return array Decoded response with at least a "token" and a "user".
     * @throws \moodle_exception When no address can be derived, the request
     *                           fails, or the service declines to issue a token.
     */
    public static function create_session(): array {
        $email = config::account_email();
        if (!validate_email($email)) {
            throw new \moodle_exception('errornoemail', 'local_aipdfaccessibilityremediation');
        }

        $payload = [
            'name' => config::account_name(),
            'email' => $email,
            'company_name' => config::company_name(),
            'website' => config::website(),
            'plan_id' => config::PLAN_ID,
            'country' => config::COUNTRY,
        ];

        $response = self::post('/api/billing/provision-account', $payload);

        if (empty($response['token'])) {
            // The service explains itself well, so pass its own wording
            // through rather than replacing it with something vaguer.
            $detail = isset($response['error']) ? (string) $response['error'] : '';
            throw new \moodle_exception('errorsession', 'local_aipdfaccessibilityremediation', '', $detail);
        }

        return [
            'token' => (string) $response['token'],
            'user' => isset($response['user']) ? $response['user'] : [],
            'isnewtoapp' => !empty($response['isNewToApp']),
        ];
    }

    /**
     * Performs a JSON POST against the service and decodes the response.
     *
     * @param string $endpoint Path of the endpoint, starting with a slash.
     * @param array $payload Body fields, encoded as JSON.
     * @return array Decoded JSON response.
     * @throws \moodle_exception When the request fails or the answer is not JSON.
     */
    protected static function post(string $endpoint, array $payload): array {
        global $CFG;

        require_once($CFG->libdir . '/filelib.php');

        $curl = new \curl();
        $curl->setHeader([
            'Content-Type: application/json',
            'X-Api-Key: ' . config::PROVISION_API_KEY,
        ]);
        $curl->setopt([
            'CURLOPT_TIMEOUT' => config::TIMEOUT,
            'CURLOPT_CONNECTTIMEOUT' => config::CONNECT_TIMEOUT,
            'CURLOPT_FOLLOWLOCATION' => 0,
            'CURLOPT_USERAGENT' => 'Moodle/' . $CFG->release . ' local_aipdfaccessibilityremediation',
        ]);

        $response = $curl->post(
            self::get_base_url() . $endpoint,
            json_encode($payload)
        );

        if ($curl->get_errno()) {
            throw new \moodle_exception(
                'errorconnection',
                'local_aipdfaccessibilityremediation',
                '',
                $curl->error
            );
        }

        $decoded = json_decode($response, true);
        if (!is_array($decoded)) {
            $info = $curl->get_info();
            $httpcode = isset($info['http_code']) ? (int) $info['http_code'] : 0;
            throw new \moodle_exception(
                'errorbadresponse',
                'local_aipdfaccessibilityremediation',
                '',
                $httpcode
            );
        }

        return $decoded;
    }
}
