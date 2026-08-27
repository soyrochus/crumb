# Release verification record

Verified on 27 August 2026.

## Support matrix

| Target | Verified environment | Native WebView | Result |
| --- | --- | --- | --- |
| macOS arm64 | macOS 26.5.2, Apple Silicon, Bun 1.4.0 for build | System WKWebView | Pass |
| Linux x64 | Ubuntu 26.04, native Wayland, Bun 1.4.0 for build | GTK 3 and WebKitGTK 4.1 | Pass |

The macOS executable declares macOS 13.0 as its minimum deployment version. Ubuntu 26.04 x64 is the initial supported Linux distribution; other distributions are not yet in the verified matrix.

## Manual acceptance

The following journey passed on both targets:

- launch one 1200-by-760 native window and resize it down to the 800-by-500 minimum;
- navigate from the sidebar and with Back, Forward, parent, row activation, and platform keyboard shortcuts;
- toggle hidden entries and operate the pane separators with pointer and keyboard;
- preview a directory, bounded text, a supported image, and an unsupported file;
- follow live light/dark system appearance;
- recover from removed items or locations and permission-denied paths without exiting or escalating privileges;
- close during normal use without writing application state.

## Artifact and isolated-runtime acceptance

### Linux x64

The prior Ubuntu verification identified `dist/crumb-linux-x64` as an x86-64 ELF executable. `ldd` reported no missing dependency for the packaged native addon; its direct supported runtime packages are `libgtk-3-0t64`, `libwebkit2gtk-4.1-0`, and `libjavascriptcoregtk-4.1-0`, with their normal Ubuntu dependencies. The executable was copied alone to an empty `/tmp` directory and launched with its embedded UI and native addon. It did not resolve Bun, Node.js, npm, source, or adjacent application assets and it remained on the native Wayland backend.

### macOS arm64

`file dist/crumb-macos-arm64` reported `Mach-O 64-bit executable arm64`. `otool -L` reported only Apple `/usr/lib` dependencies for the outer executable; the embedded native addon links only Apple system frameworks and libraries, including WebKit and AppKit. The approximately 62-MiB executable was copied alone to `/tmp/crumb-macos-readme-check`, launched from there, exercised, and closed. It did not resolve Bun, Node.js, npm, source, or adjacent application assets. Runtime application code performs no network operation and the WebView CSP blocks connections.

## Automated verification

`bun test`, `bun run typecheck`, and `bun run verify:readonly` passed on macOS arm64 and Ubuntu Linux x64. The suite has 36 tests and 87 expectations. Filesystem fixtures are created below the operating-system temporary directory and removed after every test; production and user-owned paths are not modified.

`bun run verify:performance` passed on the verified macOS host with these measurements:

| Check | Result | Limit |
| --- | ---: | ---: |
| Production UI startup | 138 ms | 5,000 ms |
| Production-styled 5,000-row DOM commit | 5 ms | 2,000 ms |
| 250-entry host listing | 24.5 ms | 5,000 ms |
| Bounded 1-MiB text preview | 1.6 ms | 3,000 ms |
| Bounded 8-MiB image preview | 2.4 ms | 3,000 ms |
| RSS retained after superseded payload release | 0.2 MiB | 256 MiB |

The performance command creates all data below the operating-system temporary directory, briefly opens a native verification window, closes it automatically, and removes its fixture directory.
