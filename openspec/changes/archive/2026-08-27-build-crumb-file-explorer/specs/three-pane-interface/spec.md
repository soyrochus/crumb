## ADDED Requirements

### Requirement: Three-pane responsive layout
The main window SHALL contain a toolbar, navigation pane, directory pane, preview pane, and informational status area. At 1200 pixels wide the navigation and directory panes SHALL default to 220 and 380 pixels, and all panes SHALL remain usable down to the 800-by-500 minimum window size.

#### Scenario: Resize the window
- **WHEN** the user resizes the window between its initial and minimum dimensions
- **THEN** the three panes remain visible, content is clipped or scrollable within its pane, and preview content does not expand the application layout

### Requirement: Adjustable pane separators
The navigation/directory and directory/preview separators SHALL be keyboard-focusable or otherwise accessibly operable draggable controls with minimum widths of 150, 260, and 280 pixels for the three panes. Width changes SHALL remain in memory only.

#### Scenario: Drag a separator beyond its bound
- **WHEN** a separator is dragged far enough to violate a pane minimum
- **THEN** resizing stops at the applicable minimum and no pane overlaps another

### Requirement: Navigation toolbar
The toolbar SHALL provide semantic Back and Forward buttons plus a display-only current path. Each button SHALL be disabled when its corresponding successful history destination is absent.

#### Scenario: Display initial toolbar state
- **WHEN** the initial Home or root listing succeeds
- **THEN** the current path is displayed as non-editable text and Back and Forward reflect the empty history state

### Requirement: Sidebar and directory interaction
Selecting a sidebar location SHALL navigate to it. A directory row SHALL be selectable with a single activation and enterable with double-click or Enter. Only one directory entry may be selected at a time.

#### Scenario: Select and enter a folder
- **WHEN** the user selects a folder row and then activates Enter
- **THEN** the preview first shows the folder and the subsequent successful navigation makes it current and clears selection

#### Scenario: Clear selection
- **WHEN** an entry is selected and the user presses Escape
- **THEN** entry selection is cleared and the preview shows the current directory summary

### Requirement: Platform-appropriate keyboard behavior
The directory pane SHALL support Up, Down, Home, End, Enter, Escape, primary-modifier-plus-Up for parent, primary-modifier-plus-left-bracket for Back, primary-modifier-plus-right-bracket for Forward, and primary-modifier-plus-Shift-plus-period for hidden files. The primary modifier SHALL be Command on macOS and Control on Linux.

#### Scenario: Navigate rows with keyboard
- **WHEN** the focused directory pane contains entries and the user presses Down, End, Home, or Up
- **THEN** the single selection moves to the corresponding valid row and remains visibly focused

#### Scenario: Use a platform shortcut
- **WHEN** the user invokes Back with Command on macOS or Control on Linux
- **THEN** the same transactional Back operation as the toolbar button is requested

### Requirement: Loading, empty, truncation, and error states
Directory and preview panes SHALL show prompt loading feedback for outstanding current requests and distinct accessible states for empty results, truncated listings, permission errors, missing items, and unavailable locations.

#### Scenario: Load a slow directory
- **WHEN** a current directory request does not complete immediately
- **THEN** the directory pane displays a loading state while the rest of the window remains responsive

#### Scenario: Show a truncated listing
- **WHEN** the current listing has `truncated` true
- **THEN** the directory pane clearly states that not all entries are shown

### Requirement: Symbolic local icons
The interface SHALL use small application-owned or CSS/SVG symbolic icons for folder, text, image, archive, audio, video, PDF, generic, symlink, and unknown categories and SHALL NOT require native icon extraction or a remote/large icon package.

#### Scenario: Display an unsupported file row
- **WHEN** a file has no more specific supported icon class
- **THEN** the generic or unknown local icon is shown without a network or native-icon lookup

### Requirement: Adaptive appearance
The interface SHALL provide coherent light and dark themes, respond to `prefers-color-scheme` changes while running, use compact system-oriented typography, and remain legible when the Linux WebView cannot expose the desktop theme.

#### Scenario: System appearance changes
- **WHEN** the WebView reports a change from light to dark appearance
- **THEN** backgrounds, separators, selection, primary text, and secondary text update without restarting the application

### Requirement: Accessible semantics and focus
Interactive controls SHALL use native semantic elements where possible, directory items SHALL expose their names, decorative icons SHALL be hidden from assistive technology, focus SHALL be visible, and information SHALL not rely on color alone.

#### Scenario: Operate without a pointer
- **WHEN** a keyboard user moves through toolbar, sidebar, splitters, directory rows, and preview content
- **THEN** focus order is usable, the focused control is visible, and each control has an accessible name and state

### Requirement: Restrictive document policy
The production UI SHALL apply a Content Security Policy that blocks remote connections, frames, object embedding, forms, unintended navigation, and non-application scripts while permitting only resources required by the embedded UI and bounded image previews.

#### Scenario: Local content attempts network access
- **WHEN** malicious displayed content contains or resembles a remote resource URL
- **THEN** it remains inert text and the document policy prevents a connection from being established

