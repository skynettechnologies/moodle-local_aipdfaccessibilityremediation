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
 * @package     local_aipdfaccessibilityremediation
 * @copyright   2026 Skynet Technologies USA LLC <hello@skynettechnologies.com>
 * @license     https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

require(__DIR__ . '/../../config.php');
require_once($CFG->libdir . '/adminlib.php');

use local_aipdfaccessibilityremediation\api;
use local_aipdfaccessibilityremediation\config;

require_login();

admin_externalpage_setup('local_aipdfaccessibilityremediation');

require_capability('local/aipdfaccessibilityremediation:manage', context_system::instance());

$PAGE->set_url(new moodle_url('/local/aipdfaccessibilityremediation/index.php'));
$PAGE->set_pagelayout('admin');
$PAGE->set_title(get_string('pluginname', 'local_aipdfaccessibilityremediation'));
$PAGE->set_heading(get_string('pluginname', 'local_aipdfaccessibilityremediation'));

// Every label the interface needs, handed to the module so that nothing is
// hard coded in JavaScript and the page stays translatable. Strings that take
// a placeholder are sent with their {$a} intact and filled in by the module.
$simplekeys = [
    'accountchange', 'accountdomain', 'accountdomainhint', 'accountemail', 'accountemailhint',
    'accountfailed', 'accountintro', 'accountname', 'accountnamehint', 'accountsave',
    'accountsaving', 'accounttitle', 'action', 'addedfrom', 'addselected', 'after', 'aisuggestions',
    'allcheckspassed', 'allsources', 'allstatus', 'analysing', 'before', 'cancel', 'close',
    'confirmremoveall', 'coverageexhausted', 'coverageexhaustedtrial', 'crawlerror', 'documents',
    'download', 'downloadfailed', 'draganddrop', 'erroraccountdomain', 'erroraccountemail',
    'filename', 'filenamesource', 'filetoolarge', 'fixedbyai', 'howitgetsfixed', 'howitwasfixed',
    'inprogress', 'itemsperpage', 'loading', 'nodocuments', 'nodocumentsmatch', 'noremediated',
    'noremediatedmatch', 'noscanneddocuments', 'noscannedmatch', 'nositedomain', 'pages',
    'pdfformatonly', 'pdfonly', 'pluginname', 'processing', 'recommendedplan', 'remediatedon',
    'remediatedpdfs', 'remediationcomplete', 'remove', 'removedocument', 'removefailed',
    'removeselected', 'scanfailed', 'scanning', 'searchdocuments', 'searchremediated', 'selectall',
    'selectatleastone', 'source', 'sourcefile', 'sourcelabel', 'sourceupload', 'sourceurl',
    'sourceurlscan', 'sourcewebsite', 'startairemediation', 'startfailed', 'status', 'statuserror',
    'statuspending', 'statuspendingscan', 'statusremediated', 'statusremediating', 'statusscanning',
    'subtitleremediated', 'subtitlescan', 'subtitleupload', 'tabremediated', 'tabscan', 'tabupload',
    'unauthenticated', 'unencryptedfiles', 'upgradeplan', 'uploadedfile', 'uploadfailed',
    'uploading', 'uptofiftymb', 'whatthismeans', 'whyitmatters',
];

// These carry a placeholder the module substitutes at render time. Fetching
// them with a literal marker keeps the wording, and the position of the value
// inside it, under the translator's control.
$placeholderkeys = [
    'checkspassed' => '{n}',
    'checkstofix' => '{n}',
    'confirmremoveone' => '{n}',
    'continuewithplan' => '{n}',
    'continuewithtrial' => '{n}',
    'coverageexhaustedpages' => '{n}',
    'coverageexhaustedpagestrial' => '{n}',
    'coveragetrial' => '{n}',
    'crawling' => '{n}',
    'crawlnone' => '{n}',
    'findpdfs' => '{n}',
    'selecteddocuments' => '{n}',
    'selectone' => '{n}',
    'totalpages' => '{n}',
    'uploadsuccess' => '{n}',
];

$strings = [];
foreach ($simplekeys as $key) {
    $strings[$key] = get_string($key, 'local_aipdfaccessibilityremediation');
}
foreach ($placeholderkeys as $key => $marker) {
    $strings[$key] = get_string($key, 'local_aipdfaccessibilityremediation', $marker);
}

// Multi placeholder strings, each built from an object of markers.
$strings['coveragecurrent'] = get_string(
    'coveragecurrent',
    'local_aipdfaccessibilityremediation',
    (object) ['covered' => '{covered}', 'total' => '{total}']
);
$strings['coveragebody'] = get_string(
    'coveragebody',
    'local_aipdfaccessibilityremediation',
    (object) ['covered' => '{covered}', 'total' => '{total}']
);
$strings['showingrecords'] = get_string(
    'showingrecords',
    'local_aipdfaccessibilityremediation',
    (object) ['start' => '{start}', 'end' => '{end}', 'total' => '{total}']
);
$strings['recommendedplanis'] = get_string(
    'recommendedplanis',
    'local_aipdfaccessibilityremediation',
    (object) ['name' => '{name}', 'pages' => '{pages}', 'price' => '{price}']
);
$strings['crawlfound'] = get_string(
    'crawlfound',
    'local_aipdfaccessibilityremediation',
    (object) ['found' => '{found}', 'added' => '{added}', 'domain' => '{domain}']
);
$strings['crawlfoundexisting'] = get_string(
    'crawlfoundexisting',
    'local_aipdfaccessibilityremediation',
    (object) ['found' => '{found}', 'domain' => '{domain}']
);

$strings['pagesleft'] = get_string(
    'pagesleft',
    'local_aipdfaccessibilityremediation',
    (object) ['remaining' => '{remaining}', 'total' => '{total}']
);

$PAGE->requires->js_call_amd(
    'local_aipdfaccessibilityremediation/dashboard',
    'init',
    [
        [
            'apiBaseUrl' => api::get_base_url(),
            'sessionUrl' => (new moodle_url('/local/aipdfaccessibilityremediation/session.php'))->out(false),
            'sesskey' => sesskey(),
            'website' => config::website(),
            'upgradeUrl' => config::upgrade_url(),
            'accountKey' => config::account_key(),
            'account' => config::account(),
            'accountDefaults' => config::account_defaults(),
            'strings' => $strings,
        ],
    ]
);

echo $OUTPUT->header();
echo $OUTPUT->render_from_template('local_aipdfaccessibilityremediation/dashboard', []);
echo $OUTPUT->footer();
