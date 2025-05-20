# LeadSpark

LeadSpark is a comprehensive email finding and verification tool that helps you discover and validate email addresses for your outreach campaigns.

## Features

- **Email Finder:** Generate and verify email permutations based on names and domains
  - **Smart Domain Extraction:** Automatically extracts domains from URLs, emails, or text (e.g., `@http://example.com/` → `example.com`)
  - **Instant Formatting:** Clean domain display as you type or paste
- **Email Verifier:** Check the validity of email addresses using API validation
  - **Bulk Email Extraction:** Intelligently extracts emails from any text, even with mixed formats
  - **Auto-Formatting:** Automatically formats pasted emails one per line
- **Dashboard:** View stats and manage your validated emails
- **Validation Log:** Complete history of your email verification activities
- **Settings:** Configure API settings for email validation services

## Tech Stack

- Vanilla JavaScript
- HTML/CSS
- LocalStorage for data persistence
- Support for multiple email validation APIs

## Key Features in Detail

### Smart Domain Handling
- Paste any URL format (http://example.com, www.example.com) and get just the domain
- Extract domains from email addresses (user@example.com → example.com)
- Remove common prefixes and suffixes automatically

### Intelligent Email Extraction
- Paste emails in any format: comma-separated, line breaks, or mixed with text
- Extract email addresses from messy text or HTML
- Automatically formats extracted emails one per line
- Removes duplicates and validates format

## Deployment

This project is set up for easy deployment to Netlify:

1. Fork or clone this repository to your GitHub account
2. Login to [Netlify](https://netlify.com)
3. Click "New site from Git"
4. Select your repository
5. Keep the default settings (no build command needed)
6. Click "Deploy site"

The application will be live at a URL like `https://your-site-name.netlify.app`

## Local Development

1. Clone this repository
2. Install dependencies: `npm install`
3. Run local server: `npx serve -l 5000 .`
4. Or simply open index.html in your browser

## API Integration

The application supports multiple email validation APIs:
- validate.email
- Bazzigate
- SuperSend

Configure your preferred API and API key in the Settings section of the application.

## License

MIT License 