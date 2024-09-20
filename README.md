# Spotify Artist Data Fetcher

## Overview

The **Spotify Artist Data Fetcher** is a GitHub Actions workflow that retrieves and stores statistics about specified artists from Spotify. This tool automatically fetches artist data at scheduled intervals and on certain events, making it easy to track changes over time.

## Features

- **Automated Data Fetching**: Runs daily at 10 PM UTC or when changes are pushed to the `main` branch.
- **Data Storage**: Saves artist statistics in JSON format, organized by artist name.
- **Manual Triggering**: Supports manual execution via the GitHub Actions interface.

## Getting Started

### Prerequisites

1. A GitHub repository.
2. A text file named `artist_ids.txt` containing the Spotify artist IDs you wish to fetch data for, one ID per line.
3. GitHub Actions enabled for your repository.

### Setup Instructions

1. **Create a new file** in your repository under `.github/workflows/get_spotify_artists_data.yml` and copy the workflow code into it.

2. **Add your artist IDs**:
    - Create a file named `artist_ids.txt` in the root of your repository.
    - Add the Spotify artist IDs you want to track, one per line.

3. **Configure Secrets**:
    - Ensure you have a GitHub secret named `GITHUB_TOKEN` available in your repository settings to allow the workflow to push changes back to the repository.

### Workflow Details

The workflow consists of the following steps:

1. **Checkout Repository**: Fetches the repository content to the runner.
2. **Install Dependencies**: Installs `jq` for JSON processing.
3. **Fetch Access Token**: Retrieves a anonymous Spotify access token for API requests.
4. **Fetch Artist Data**: For each artist ID in `artist_ids.txt`, it retrieves statistics and saves them as a JSON file.
5. **Commit and Push Changes**: Commits the new data to the repository with a timestamp.

## Example Output

The artist data is saved in a directory named `artist`, with each file named in the format:
- Followers
- Monthly listeners
- Top cities
- World rank

## Contributions

Feel free to contribute by forking the repository, making changes, and submitting a pull request. Suggestions for improvements and feature requests are always welcome!

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Acknowledgements

Inspired by [Simon Willison](https://simonwillison.net/2020/Oct/9/git-scraping/).
