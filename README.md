# LeadSpark

LeadSpark is a comprehensive email finding and verification tool that helps you discover and validate email addresses for your outreach campaigns.

## Features

- **Email Finder:** Generate and verify email permutations based on names and domains
- **Email Verifier:** Check the validity of email addresses using API validation
- **Dashboard:** View stats and manage your validated emails
- **Validation Log:** Complete history of your email verification activities
- **Settings:** Configure API settings for email validation services

## Tech Stack

- Vanilla JavaScript
- HTML/CSS
- LocalStorage for data persistence
- Support for multiple email validation APIs

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
2. Open index.html in your browser
3. Make changes to files in the `/css` and `/js` directories

## API Integration

The application supports multiple email validation APIs:
- validate.email
- Bazzigate
- SuperSend

Configure your preferred API and API key in the Settings section of the application.

## License

MIT License 