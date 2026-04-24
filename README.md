# Emby Browser — IINA Plugin

A plugin for [IINA](https://iina.io) that lets you browse and play content from your [Emby](https://emby.media) media server directly from IINA, without opening the Emby web interface.

## Features

- Browse your Emby libraries (Movies, TV Shows, Episodes)
- Play any item directly in IINA with a single click
- Supports HTTP and HTTPS servers
- Progress reporting back to Emby (resume playback, "Continue Watching")
- Standalone window accessible from the Plugin menu (no video needs to be open first)

## Requirements

- IINA 1.3.0 or later
- macOS 12 or later
- An Emby server (tested on Emby 4.x)

## Installation

1. Download `emby-browser.iinaplgz` from the [Releases](../../releases) page
2. Double-click the file — IINA will prompt you to install it
3. Restart IINA

## Configuration

1. Open **IINA → Preferences → Plugins → Emby Browser → Preferences**
2. Fill in:
   - **Server URL**: e.g. `http://192.168.1.10:8096` or `https://emby.yourdomain.com`
   - **API Key**: found in Emby Dashboard → Advanced → API Keys → New Key
   - **User ID**: found in Emby Dashboard → Users → click your username → the ID is in the page URL
3. Click outside each field to save (auto-saved)

## Usage

- Open the browser from **Plugin → Apri Emby Browser** in the IINA menu bar
- Navigate your libraries and click any item to start playback
- The sidebar tab "Emby" is also available while a video is playing

## Known Limitations

- Requires `curl` and `osascript` (both included in macOS)
- HTTP servers require macOS to allow non-HTTPS connections (works via curl internally)
- Subtitles are not yet selectable from the browser (use IINA's built-in subtitle menu)

## Technical Notes

This plugin works around several IINA 1.4.x limitations on macOS 26:
- Uses `curl` via `utils.exec` for API calls to bypass App Transport Security (ATS)
- Uses `osascript` to open URLs in IINA to avoid crashes in `createPlayerInstance`
- Fetches `/Items/{id}/PlaybackInfo` before playback to get the correct `MediaSourceId`

## Contributing

Pull requests welcome! Areas for improvement:
- Subtitle track selection
- Audio track selection  
- Search functionality
- "Continue Watching" / "Next Episode" shortcuts
- Thumbnail images in the browser

## License

MIT
