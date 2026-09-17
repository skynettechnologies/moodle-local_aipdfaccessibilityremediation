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
 * AI PDF Accessibility Remediation workspace.
 *
 * @package     local_freeaipdfaccessibilityremediation
 * @copyright   2026 Skynet Technologies USA LLC <hello@skynettechnologies.com>
 * @license     https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

require(__DIR__ . '/../../config.php');
require_once($CFG->libdir . '/adminlib.php');

use local_freeaipdfaccessibilityremediation\api;
use local_freeaipdfaccessibilityremediation\config;

require_login();

admin_externalpage_setup('local_freeaipdfaccessibilityremediation');

require_capability('local/freeaipdfaccessibilityremediation:manage', context_system::instance());

$PAGE->set_url(new moodle_url('/local/freeaipdfaccessibilityremediation/index.php'));
$PAGE->set_pagelayout('admin');
$PAGE->set_title(get_string('pluginname', 'local_freeaipdfaccessibilityremediation'));
$PAGE->set_heading(get_string('pluginname', 'local_freeaipdfaccessibilityremediation'));

// Every label the interface needs, handed to the module so that nothing is
// hard coded in JavaScript and the page stays translatable. Strings that take
// a placeholder are sent with their {$a} intact and filled in by the module.
$simplekeys = [
    'action', 'addedfrom', 'addselected', 'allsources', 'allstatus', 'cancel', 'close',
    'confirmremoveall', 'connectionfailed', 'connectionhelp', 'coverageexhausted',
    'coverageexhaustedtrial', 'crawlerror', 'documents', 'download', 'downloadfailed',
    'draganddrop', 'filename', 'filenamesource', 'filetoolarge', 'inprogress', 'itemsperpage',
    'loading', 'nodocuments', 'nodocumentsmatch', 'noremediated', 'noremediatedmatch',
    'noscanneddocuments', 'noscannedmatch', 'nositedomain', 'pages', 'pdfformatonly', 'pdfonly',
    'processing', 'recommendedplan', 'remediatedon', 'remediatedpdfs', 'remediationcomplete',
    'remove', 'removedocument', 'removefailed', 'removeselected', 'scanfailed', 'scanning',
    'searchdocuments', 'searchremediated', 'selectall', 'selectatleastone', 'source', 'sourcefile',
    'sourcelabel', 'sourceupload', 'sourceurl', 'sourceurlscan', 'sourcewebsite',
    'startairemediation', 'startfailed', 'status', 'statuserror', 'statuspending',
    'statuspendingscan', 'statusremediated', 'statusremediating', 'statusscanning',
    'subtitleremediated', 'subtitlescan', 'subtitleupload', 'tabremediated', 'tabscan', 'tabupload',
    'unauthenticated', 'unencryptedfiles', 'upgradeplan', 'uploadedfile', 'uploadfailed',
    'uploading', 'uptofiftymb',
];

// These carry a placeholder the module substitutes at render time. Fetching
// them with a literal marker keeps the wording, and the position of the value
// inside it, under the translator's control.
$placeholderkeys = [
    'confirmremoveone' => '{n}',
    'continuewithplan' => '{n}',
    'continuewithtrial' => '{n}',
    'coverageexhaustedpages' => '{n}',
    'coverageexhaustedpagestrial' => '{n}',
    'coveragetrial' => '{n}',
    'crawling' => '{n}',
    'crawlnone' => '{n}',
    'errorbadresponse' => '{n}',
    'findpdfs' => '{n}',
    'gotopage' => '{n}',
    'pagesleft' => '{n}',
    'selecteddocuments' => '{n}',
    'selectone' => '{n}',
    'totalpages' => '{n}',
    'uploadsuccess' => '{n}',
];

$strings = [];
foreach ($simplekeys as $key) {
    $strings[$key] = get_string($key, 'local_freeaipdfaccessibilityremediation');
}
foreach ($placeholderkeys as $key => $marker) {
    $strings[$key] = get_string($key, 'local_freeaipdfaccessibilityremediation', $marker);
}

// Multi placeholder strings, each built from an object of markers.
$strings['coveragecurrent'] = get_string(
    'coveragecurrent',
    'local_freeaipdfaccessibilityremediation',
    (object) ['covered' => '{covered}', 'total' => '{total}']
);
$strings['coveragebody'] = get_string(
    'coveragebody',
    'local_freeaipdfaccessibilityremediation',
    (object) ['covered' => '{covered}', 'total' => '{total}']
);
$strings['showingrecords'] = get_string(
    'showingrecords',
    'local_freeaipdfaccessibilityremediation',
    (object) ['start' => '{start}', 'end' => '{end}', 'total' => '{total}']
);
$strings['recommendedplanis'] = get_string(
    'recommendedplanis',
    'local_freeaipdfaccessibilityremediation',
    (object) ['name' => '{name}', 'pages' => '{pages}', 'price' => '{price}']
);
$strings['crawlfound'] = get_string(
    'crawlfound',
    'local_freeaipdfaccessibilityremediation',
    (object) ['found' => '{found}', 'added' => '{added}', 'domain' => '{domain}']
);
$strings['crawlfoundexisting'] = get_string(
    'crawlfoundexisting',
    'local_freeaipdfaccessibilityremediation',
    (object) ['found' => '{found}', 'domain' => '{domain}']
);


$PAGE->requires->js_call_amd(
    'local_freeaipdfaccessibilityremediation/dashboard',
    'init',
    [
        [
            'apiBaseUrl' => api::get_base_url(),
            'website' => config::website(),
            'upgradeUrl' => config::upgrade_url(),
            'accountKey' => config::account_key(),
            'account' => config::account(),
            // At developer debugging, the workspace says in the browser console
            // what it is registering with and what came back.
            'debug' => !empty($CFG->debugdeveloper),
            // The workspace registers the site itself, as the first thing it
            // does, so that the call and its answer can be read in the browser
            // alongside every other request the page makes.
            //
            // NOTE: this puts the provisioning key in the page, where anyone
            // who can open the workspace can read it. It is here because the
            // call has to be visible; treat the key accordingly.
            'provision' => [
                'url' => api::get_base_url() . '/api/billing/provision-account',
                'apiKey' => config::PROVISION_API_KEY,
                'payload' => config::provision_payload(),
            ],
            'strings' => $strings,
        ],
    ]
);

echo $OUTPUT->header();
echo $OUTPUT->render_from_template('local_freeaipdfaccessibilityremediation/dashboard', []);
echo $OUTPUT->footer();
