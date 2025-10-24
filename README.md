# Spotify Artists Dashboard

A modern, real-time dashboard displaying the top Spotify artists with detailed analytics, growth metrics, and interactive visualizations.

## Features

- 🎵 **Real-time Data**: Live Spotify artist rankings and metrics
- 📊 **Analytics**: Growth tracking, listener counts, and trend analysis
- 🔍 **Search & Filter**: Find artists by name with advanced filtering
- 📱 **Responsive Design**: Optimized for all devices
- ⚡ **Fast Performance**: Built with Next.js 15 and optimized for speed
- 🎨 **Modern UI**: Clean, minimalistic design with smooth animations

## Data Structure

The application reads from JSON files in the `public/data/` directory:

- `latest/top500.json` - Current top 500 artists
- `latest/former500.json` - Former top 500 artists
- `latest/meta.json` - Metadata about the dataset
- `artists/[id].json` - Individual artist details

## Development

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

### Build for Production

```bash
# Build the application
npm run build

# Export static files
npm run export
```

## Deployment

### GitHub Pages

The application is configured for automatic deployment to GitHub Pages:

1. Push changes to the `main` branch
2. GitHub Actions will automatically build and deploy
3. The site will be available at `https://[username].github.io/spotify-artists-scraping`

### Manual Deployment

```bash
# Build and export
npm run build

# Deploy to GitHub Pages
npm run deploy
```

## Data Updates

The application expects daily data updates from the Python scraping script. The data structure includes:

- Artist rankings and monthly listeners
- Growth metrics (1-day, 7-day, 30-day)
- Top tracks and cities
- Historical data and trends

## Technologies Used

- **Next.js 15** - React framework with App Router
- **TypeScript** - Type safety and better development experience
- **Tailwind CSS** - Utility-first CSS framework
- **Lucide React** - Beautiful icon library
- **GitHub Pages** - Static site hosting

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - see LICENSE file for details.
