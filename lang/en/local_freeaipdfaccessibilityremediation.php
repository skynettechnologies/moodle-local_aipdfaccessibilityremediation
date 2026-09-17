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
 * Strings for the AI PDF Accessibility Remediation plugin.
 *
 * @package     local_freeaipdfaccessibilityremediation
 * @copyright   2026 Skynet Technologies USA LLC <hello@skynettechnologies.com>
 * @license     https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();

$string['action'] = 'Action';
$string['addedfrom'] = 'Added from';
$string['addselected'] = 'Add selected for remediation';
$string['allsources'] = 'All sources';
$string['allstatus'] = 'All status';
$string['cancel'] = 'Cancel';
$string['close'] = 'Close';
$string['confirmremoveall'] = 'Are you sure you want to remove the selected documents?';
$string['confirmremoveone'] = 'Are you sure you want to remove {$a}?';
$string['connectionfailed'] = 'This site is not connected to the remediation service';
$string['connectionhelp'] = 'Until it connects, documents cannot be uploaded, scanned or remediated.';
$string['continuewithplan'] = 'Continue with my current plan ({$a} pages)';
$string['continuewithtrial'] = 'Continue with my free plan ({$a} pages)';
$string['coveragebody'] = 'Your PDFs contain {$a->total} pages. Upgrade to process all pages, or continue with the {$a->covered} pages included in your current plan.';
$string['coveragecurrent'] = 'Your current plan covers {$a->covered} of {$a->total} pages';
$string['coverageexhausted'] = 'You have used all the pages in your plan';
$string['coverageexhaustedpages'] = 'The documents you selected contain {$a} pages, and your current plan has no pages left. Upgrade to carry on remediating.';
$string['coverageexhaustedpagestrial'] = 'The documents you selected contain {$a} pages, and your free trial has no pages left. Upgrade to carry on remediating.';
$string['coverageexhaustedtrial'] = 'Your free trial has used all its pages';
$string['coveragetrial'] = 'Free trial covers the first {$a} pages';
$string['crawlerror'] = 'Could not crawl the website.';
$string['crawlfound'] = 'Found {$a->found} PDFs on {$a->domain} - added {$a->added} new. Scanning...';
$string['crawlfoundexisting'] = 'Found {$a->found} PDFs on {$a->domain} - all are already in your list.';
$string['crawling'] = 'Crawling {$a}...';
$string['crawlnone'] = 'No PDF links found on {$a}.';
$string['documents'] = 'Documents';
$string['download'] = 'Download';
$string['downloadfailed'] = 'Could not download this file.';
$string['draganddrop'] = 'Drag and drop file here';
$string['errorbadresponse'] = 'The remediation service returned an unexpected response (HTTP {$a}).';
$string['errorconnection'] = 'Could not reach the remediation service: {$a}';
$string['errornoemail'] = 'No contact address could be derived for this site. Set a support email under Site administration.';
$string['errorsession'] = 'Could not open a remediation session. {$a}';
$string['filename'] = 'File name';
$string['filenamesource'] = 'File name / source';
$string['filetoolarge'] = 'File is too large. Up to 50 MB is allowed.';
$string['findpdfs'] = 'Find PDFs on {$a}';
$string['freeaipdfaccessibilityremediation:manage'] = 'Manage AI PDF accessibility remediation';
$string['gotopage'] = 'Go to page {$a}';
$string['inprogress'] = 'AI remediation in progress...';
$string['itemsperpage'] = 'Items per page';
$string['loading'] = 'Loading...';
$string['nodocuments'] = 'No documents in the queue - add a PDF above to get started.';
$string['nodocumentsmatch'] = 'No documents match your search.';
$string['noremediated'] = 'No remediated PDFs yet - run AI remediation from the Upload or Website scan tab.';
$string['noremediatedmatch'] = 'No remediated PDFs match your search or filter.';
$string['noscanneddocuments'] = 'No scanned documents yet - use the button above to find PDFs on your site.';
$string['noscannedmatch'] = 'No documents match your search or filter.';
$string['nositedomain'] = 'This site has no domain to scan.';
$string['pages'] = 'Pages';
$string['pagesleft'] = '{$a} pages remaining';
$string['pdfformatonly'] = 'PDF format only';
$string['pdfonly'] = 'PDF format only - please choose a .pdf file.';
$string['pluginname'] = 'AI PDF Accessibility Remediation';
$string['privacy:metadata:freeaipdfaccessibilityremediation'] = 'Documents and site contact details are sent to the AI PDF Accessibility Remediation service so that they can be checked and repaired.';
$string['privacy:metadata:freeaipdfaccessibilityremediation:company_name'] = 'The full name of the site, recorded on the remediation account.';
$string['privacy:metadata:freeaipdfaccessibilityremediation:documents'] = 'The PDF documents an administrator uploads or selects for remediation.';
$string['privacy:metadata:freeaipdfaccessibilityremediation:email'] = 'The site support email address, used to identify the remediation account.';
$string['privacy:metadata:freeaipdfaccessibilityremediation:name'] = 'The site support contact name, recorded on the remediation account.';
$string['privacy:metadata:freeaipdfaccessibilityremediation:website'] = 'The address of this site, used to register it with the service.';
$string['processing'] = 'Processing';
$string['recommendedplan'] = 'Recommended plan';
$string['recommendedplanis'] = 'Recommended: {$a->name} - {$a->pages} pages, {$a->price}';
$string['remediatedon'] = 'Remediated on';
$string['remediatedpdfs'] = 'Remediated PDFs';
$string['remediationcomplete'] = 'Remediation complete. Your files are ready in the Remediated tab.';
$string['remove'] = 'Remove';
$string['removedocument'] = 'Remove document';
$string['removefailed'] = 'Could not remove the document.';
$string['removeselected'] = 'Remove selected';
$string['scanfailed'] = 'Scan failed.';
$string['scanning'] = 'Scanning...';
$string['searchdocuments'] = 'Search documents';
$string['searchremediated'] = 'Search remediated PDFs';
$string['selectall'] = 'Select all documents';
$string['selectatleastone'] = 'Select at least one scanned document that is ready to remediate.';
$string['selecteddocuments'] = 'Selected: {$a} documents';
$string['selectone'] = 'Select {$a}';
$string['showingrecords'] = 'Showing {$a->start} - {$a->end} of {$a->total} item(s)';
$string['source'] = 'Source';
$string['sourcefile'] = 'File';
$string['sourcelabel'] = 'Source:';
$string['sourceupload'] = 'Upload PDF';
$string['sourceurl'] = 'URL';
$string['sourceurlscan'] = 'Scan PDF URL';
$string['sourcewebsite'] = 'Website scan';
$string['startairemediation'] = 'Start AI remediation';
$string['startfailed'] = 'Could not start remediation.';
$string['status'] = 'Status';
$string['statuserror'] = 'Error';
$string['statuspending'] = 'Pending';
$string['statuspendingscan'] = 'Pending scan';
$string['statusremediated'] = 'Remediated';
$string['statusremediating'] = 'Remediating';
$string['statusscanning'] = 'Scanning';
$string['subtitleremediated'] = 'View, download and manage completed remediated PDFs.';
$string['subtitlescan'] = 'Scan this site for PDFs and check their accessibility issues.';
$string['subtitleupload'] = 'Add files for AI-powered accessibility remediation.';
$string['tabremediated'] = 'Remediated';
$string['tabscan'] = 'Website scan';
$string['tabupload'] = 'Upload';
$string['totalpages'] = 'Total: {$a} pages';
$string['unauthenticated'] = 'Could not authenticate with the remediation service.';
$string['unencryptedfiles'] = 'Unencrypted files';
$string['upgradeplan'] = 'Upgrade plan';
$string['uploadedfile'] = 'Uploaded file';
$string['uploadfailed'] = 'Upload failed.';
$string['uploading'] = 'Uploading...';
$string['uploadsuccess'] = '{$a} file(s) uploaded.';
$string['uptofiftymb'] = 'Up to 50 MB';
