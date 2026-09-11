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
- AI Suggestions, listing every accessibility check on a remediated file. Each
  entry expands to a plain-language explanation, why it matters and a
  before/after example of the fix.
- Authenticated downloads: the remediated file is fetched with the session
  token and handed to the browser, never exposed on a public link.
- The plan coverage dialog, shown whenever a selection cannot be processed in
  full. Where the plan covers part of the selection it offers to carry on with
  those pages; where the plan has no pages left it offers only the upgrade,
  and says so in the service's own words. In both cases it recommends the
  smallest plan that would cover the selection and links to the dashboard
  through an autologin address, so there is no second sign-in.
- An account bar naming the site and address the workspace is connected as,
  with a Change button. The three values are suggested by the site — its
  address, its support contact and its full name — and any of them can be
  corrected when the suggestion is wrong, which it is whenever a support
  address is shared with another property. A correction is stored for the
  whole site, not for one administrator's browser, and clearing a field
  restores what the site itself says.
- A plan bar showing the plan and the pages left on it, amber once four
  fifths of the allowance is gone and red at zero, beside the same upgrade
  link the coverage dialog offers.
- A remediation run that is still going is picked back up when the page is
  opened again, rather than appearing to have stopped.
- Capability `local/aipdfaccessibilityremediation:manage`, granted to managers
  by default and required both by the page and by the session endpoint.
- Privacy API declaration describing the site contact details sent during
  registration and the documents sent for remediation.

### Security

- The provisioning key stays on the server. The browser asks
  `session.php` for a session and receives only the short lived token; that
  endpoint requires a signed-in user, the plugin capability and a valid session
  key, because a token grants access to every document on the account.
- The session token is cached under a key that includes a fingerprint of the
  account. A site that changes address finds no token and registers again,
  rather than silently reusing the previous account until the token expires.

### Notes

- The plugin has no configurable settings. The service address is fixed and the
  account details come from the site itself, so nothing is presented on the
  "New settings" page at upgrade time.
