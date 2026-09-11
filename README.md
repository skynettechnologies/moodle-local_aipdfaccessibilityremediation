[AI PDF Accessibility Remediation](https://www.skynettechnologies.com/pdf-accessibility-remediation) is an AI-powered document accessibility plugin for Moodle that repairs the barriers which make PDFs unusable with assistive technology.

Course handouts, policies, forms and reports are where accessibility quietly fails: a site can pass every page-level audit and still publish hundreds of untagged documents that a screen reader cannot navigate at all. This plugin makes remediation part of publishing. Upload documents or crawl your site for them, let AI repair them, review every check that was applied, and download conformant files without leaving Moodle. Supports accessibility initiatives aligned with WCAG 2.0, 2.1, 2.2, PDF/UA, ADA, Section 508, AODA and EAA EN 301 549, where applicable.

### Features

- Automated repair of tags, reading order, alternate text, headings, tables and metadata
- Every accessibility check reported individually, with a plain-language explanation and a before/after example
- Upload by drag and drop, or crawl your site for every linked PDF
- Bulk remediation with live progress
- Deep tag scan that verifies the remediated file against its tag tree, not just its declared metadata
- Authenticated downloads: remediated files are never exposed on a public link
- No configuration: the site registers itself on first use, and the name, address and domain it registers under can be corrected from the workspace
- The plan and the pages left on it shown beside the tabs, with an upgrade link
- Every label passes through `get_string()`, so the interface is translatable

### Ideal For

Course handouts, lecture notes, syllabi, assignment briefs, policies, forms, prospectuses, research papers, accessibility statements and any other PDF published to learners.

### Pricing and Plans

| **Pages Included** | **Price**  |
|--------------------|------------|
| 5 (free trial)     | Free       |
| 50                 | $175.00    |
| 100                | $300.00    |
| 1,000              | $2,500.00  |
| 10,000             | $20,000.00 |

**Note:** The free plan covers your first 5 pages, so you can try the plugin before choosing a paid plan.

### Requirements

- Moodle 4.1 (LTS) or later
- PHP with the `curl` extension
- An administrator account on the Moodle site
- Outbound HTTPS access to the remediation service

### Installation Steps

#### Option 1: Install from the ZIP file

1. Sign in to your Moodle site as an administrator.
2. Go to **Site administration → Plugins → Install plugins**.
3. Drag the plugin ZIP file into the **ZIP package** box, or select **Choose a file** and upload it.
4. Select **Install plugin from the ZIP file**.
5. Check the validation report, then select **Continue**.
6. Select **Upgrade Moodle database now** to finish.

#### Option 2: Install manually

1. Unzip the plugin and copy the `aipdfaccessibilityremediation` folder into the `local` directory of your Moodle root:

   ```
   {moodleroot}/local/aipdfaccessibilityremediation
   ```

2. Sign in as an administrator and go to **Site administration → Notifications** to complete the installation, or run:

   ```bash
   php admin/cli/upgrade.php
   ```

Your site registers itself with the remediation service the first time the page is opened, so there is nothing to configure.

To open the plugin, go to **Site administration → Plugins → Local plugins → AI PDF Accessibility Remediation**. From there you can upload documents, crawl your site for PDFs, run remediation, review the accessibility checks and download the repaired files.

### How It Works

1. **Add your PDFs.** Upload files, or crawl your site for every PDF it links to.
2. **Run AI remediation.** Select documents and process them in bulk; progress is reported live.
3. **Review and download.** Inspect each accessibility check with its explanation and before/after example, then download the conformant file.

### How the Site Is Identified

The plugin registers the site and opens a session in one call, made from the server so that no provisioning key is exposed to the browser. The call is idempotent, so repeat visits reuse the same account rather than creating duplicates.

Three values identify the account, and all three are taken from the site: the domain from `$CFG->wwwroot`, the address from the site support contact (falling back to `noreply@<host>`), and the name from the site's full name. One Moodle site therefore keeps one document library, whichever administrator is signed in.

Those are suggestions rather than facts. The service identifies an account by its email address, so a support address shared with another property would put both on the same account and the wrong domain would be offered for scanning. The account bar above the tabs names the domain and address in force, and its **Change** button opens all three for editing. A correction is stored with `set_config`, so it belongs to the site rather than to one administrator's browser, and clearing a field restores what the site itself reports.

### CORS Policy Configuration

To avoid CORS policy issues, ensure the following URLs are allowed in your website. These URLs should be added to your CORS configuration or trusted domains list.

| **Domain**                                   | **Description**                     | **Usage**                              |
|----------------------------------------------|-------------------------------------|----------------------------------------|
| `https://livepdfapi.skynettechnologies.us`  | AI PDF Remediation API              | Documents, remediation jobs, downloads |
| `https://ada.skynettechnologies.us` | All in One Accessibility® Dashboard | Plan upgrades via autologin            |

#### Instructions

1. Update your server's CORS configuration to include these URLs.
2. Ensure wildcard subdomains (*) are supported where necessary.
3. Verify the application functionality by testing requests to these domains.
4. If issues persist, consult the documentation for CORS configuration guidance.

### Privacy

The plugin stores no personal data in Moodle. It declares, through the Privacy API, the site contact details sent during registration and the documents sent to the service for remediation.

### Screenshots

![AI_PDF_Accessibility_Remediation_Image_1](https://www.skynettechnologies.com/sites/default/files/AiPdfAccessibilityRemediation/AI_PDF_Accessibility_Remediation_Image_1.jpg)
![AI_PDF_Accessibility_Remediation_Image_2](https://www.skynettechnologies.com/sites/default/files/AiPdfAccessibilityRemediation/AI_PDF_Accessibility_Remediation_Image_2.jpg)
![AI_PDF_Accessibility_Remediation_Image_3](https://www.skynettechnologies.com/sites/default/files/AiPdfAccessibilityRemediation/AI_PDF_Accessibility_Remediation_Image_3.jpg)

### Support Options

**Submit a Support Request**
Please visit our [support page](https://www.skynettechnologies.com/report-accessibility-problem) and fill out the form. Our team will get back to you as soon as possible.

**Send Us an Email**
Alternatively, you can send an email to our support team: [hello@skynettechnologies.com](mailto:hello@skynettechnologies.com)

### Accessibility Partnership Opportunities

#### **[Accessibility Agency Partnership](https://www.skynettechnologies.com/agency-partners)**

Partner with us as an agency to provide comprehensive MOODLE ADA, EAA, WCAG accessibility solutions to clients. Get access to exclusive resources, training, and support to implement and manage accessibility features effectively.

#### **[Accessibility Affiliate Partnership](https://www.skynettechnologies.com/affiliate-partner)**

Join our affiliate program and earn commissions by promoting AI PDF Accessibility Remediation. Share our accessibility solution within your network and help organisations improve their document accessibility while generating additional revenue.

For more details, please visit our [Accessibility Partnership Opportunities Page](https://www.skynettechnologies.com/partner-program).

### Licence

GNU GPL v3 or later. See [LICENSE.md](LICENSE.md).

### Credits

Developed and maintained by [Skynet Technologies USA LLC](https://www.skynettechnologies.com).
