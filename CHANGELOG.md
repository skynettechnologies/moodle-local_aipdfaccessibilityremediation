# Changelog

All notable changes to this plugin are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-09-08

### Added

- The plugin page is a full interface: three tabs for uploading documents,
  crawling the site for PDFs and reviewing remediated files, each with search,
  status and source filters, an items per page control, a paginated table and a
  selection summary. It is built from a Mustache template, an AMD module and
  styles scoped to one wrapper class, with no framework classes or external
  fonts, so it renders the same on every theme.
- Upload by drag and drop or file picker, restricted to PDFs of up to 50 MB.
- Website scan, which crawls the site for linked PDFs. It always scans the
  host this Moodle is served from, never a domain carried on the account by
  another installation. Large sites are swept across several runs, each
  picking up where the last left off.
- Bulk remediation with a live progress bar, driven by
  `POST /api/remediation/start` and polled through
  `GET /api/remediation/jobs/{id}` until the run completes.
- Authenticated downloads: the remediated file is fetched with the session
  token and handed to the browser, never exposed on a public link.
- The plan coverage dialog, shown whenever a selection cannot be processed in
  full. Where the plan covers part of the selection it offers to carry on with
  those pages; where the plan has no pages left it offers only the upgrade,
  and says so in the service's own words. In both cases it recommends the
  smallest plan that would cover the selection and links to the dashboard
  through an autologin address, so there is no second sign-in.
- An account bar naming the site and address the workspace is connected as.
  The domain comes from the site and the name and address from the
  administrator signed in. The service allows one account per domain, so on a
  site with several administrators the first to open the workspace claims it. A correction is stored for the
  whole site, not for one administrator's browser, and clearing a field
  restores what the site itself says.
- A plan bar showing the plan and the pages left on it, amber once four
  fifths of the allowance is gone and red at zero, beside the same upgrade
  link the coverage dialog offers.
- A remediation run that is still going is picked back up when the page is
  opened again, rather than appearing to have stopped.
- The workspace talks to Moodle through the External Services API
  (`local_freeaipdfaccessibilityremediation_get_session`, declared for AJAX in
  `db/services.php`) rather than through an endpoint of its own, so parameter
  validation, the capability check and the session key are all handled the way
  core handles them. The account argument is declared as accepting null, which
  is what an ordinary sign in sends: without it the site could never register
  itself, because validation refused the call before the function ran.
- Every table row and the pager are rendered from Mustache templates through
  `core/templates`, rather than being assembled as markup in JavaScript.
- A GitHub Actions workflow running moodle-plugin-ci against Moodle 4.1, 4.5
  and 5.0, so the checks the plugins database runs also run on every commit.
- Every control answers to the pointer and to the keyboard: buttons, the
  pager, a row's Remove link and the chip that starts a scan all light up on
  hover, and a visible outline follows focus for anyone not using a mouse.
- Capability `local/freeaipdfaccessibilityremediation:manage`, granted to managers
  by default and required both by the page and by the session endpoint.
- Privacy API declaration describing the site contact details sent during
  registration and the documents sent for remediation.

### Security

- Registration is made by the browser, so that the request and its answer can
  be read in the network panel beside every other call the workspace makes.
  The provisioning key is therefore delivered to the page, readable by anyone
  who can open the workspace. The page requires the plugin capability, so that
  is the site's administrators; the key should be treated as shared with them.
- The session token is held for the life of the page, and cached in the
  browser under a key that includes a fingerprint of the account, so a return
  visit reuses it rather than registering again. The page's own copy is the
  authority: a browser that will not store site data simply registers once per
  visit, where before it lost the token the moment it arrived and left every
  request after a successful registration unauthorised. A token the service
  refuses is dropped from both, and the next call registers afresh. A site that changes address finds no token and registers again,
  rather than silently reusing the previous account until the token expires.

### Notes

- The plugin has no configurable settings. The service address is fixed and the
  account details come from the site itself, so nothing is presented on the
  "New settings" page at upgrade time.
