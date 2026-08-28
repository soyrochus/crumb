# Crumbbrot — High-Level Application Specification

## Purpose

Create a small graphical desktop application called **Crumbbrot** using Crumb.

Crumbbrot is an interactive Mandelbrot and Julia-set explorer. Its purpose is primarily to demonstrate and validate the Crumb application-development workflow, including the use of an application-owned Rust native extension.

The finished application must be distributed as a normal Crumb standalone executable.

## User experience

When the application opens, most of the window shows a rendered Mandelbrot set.

The user can:

* zoom in and out using the mouse wheel or trackpad;
* pan by dragging the image;
* reset the view;
* change the maximum iteration count;
* switch between Mandelbrot and Julia modes;
* select or enter the Julia-set parameters when Julia mode is active.

Rendering should remain responsive enough that exploration feels interactive.

A render may initially use reduced resolution or reduced iteration depth while the user is moving the view. A higher-quality render may replace it when interaction stops.

The application should resize correctly with the native window.

## Visual design

The application should look like a small desktop visualization tool rather than a web page.

Use a simple layout:

* a compact toolbar or control area;
* a large central graphical canvas;
* minimal status information such as zoom level, coordinates, render time, or iteration count.

The fractal itself should dominate the interface.

Use a visually useful color mapping rather than simple black-and-white output. The coloring algorithm does not need to reproduce any particular existing fractal explorer.

Support Crumb's normal light/dark appearance where practical, but the fractal rendering does not need separate light and dark palettes.

## Application architecture

The application should follow the normal Crumb architecture:

```text
Native desktop window
        │
        ▼
WebView application
HTML / CSS / TypeScript
        │
        ▼
Declared Crumb operation
        │
        ▼
Bun host
        │
        ▼
Application-owned Rust native extension
        │
        ▼
Fractal computation
```

The WebView is responsible for:

* layout;
* controls;
* mouse and pointer interaction;
* canvas presentation;
* application UI state.

Rust is responsible for the computationally expensive fractal rendering.

The application must not implement a second native window, native widget toolkit, local HTTP server, or sidecar process.

## Native extension

Create an application-owned Rust extension dedicated to fractal calculation.

The Rust extension should accept enough information to render a rectangular fractal viewport, including conceptually:

* image width;
* image height;
* viewport center or bounds;
* scale/zoom;
* maximum iteration count;
* fractal type;
* Julia parameters when applicable.

It should return an RGBA pixel buffer suitable for displaying through the browser canvas APIs.

The precise Rust and TypeScript API should follow the conventions provided by the Crumb native-extension tooling rather than being prescribed by this specification.

The application should exercise the intended Crumb native-extension workflow:

* Rust source belongs to the application;
* the extension is declared through the Crumb application model;
* Crumb builds it automatically;
* application code uses the logical extension API rather than platform-specific `.node` paths;
* the extension becomes part of the normal standalone build;
* no separate native artifact is needed at runtime.

## Rendering

Implement at least the classic Mandelbrot escape-time algorithm.

For each pixel, map its location into the complex plane and calculate whether the point escapes within the configured maximum number of iterations.

Julia mode should use the same rendering pipeline with the appropriate Julia-set calculation.

The Rust implementation may use parallelism if appropriate.

The native operation must not make the Bun host or graphical interface unresponsive during a substantial render. Use the asynchronous/native-work mechanism supported by the Crumb extension model where required.

Do not optimize prematurely. Correctness, a clean native boundary, and demonstrable interaction are more important than extracting maximum rendering performance.

## Browser/native boundary

Fractal rendering should be a coarse native operation.

Do not call Rust once per pixel, row, or small graphical primitive.

The intended interaction is approximately:

```text
WebView requests viewport render
              │
              ▼
Rust renders complete pixel buffer
              │
              ▼
WebView receives buffer
              │
              ▼
Canvas displays ImageData
```

Binary image data should cross the native boundary using the appropriate buffer or typed-array mechanism rather than conversion into arrays of JavaScript numbers or JSON.

The browser must not gain a generic interface for invoking arbitrary native exports.

## Interaction behaviour

### Zoom

Zoom toward the cursor position rather than merely toward the center of the canvas where reasonably practical.

Repeated zoom operations should allow exploration significantly beyond the initial Mandelbrot view.

### Pan

Dragging the rendered area should translate the viewport.

### Reset

Provide a simple way to return to the default Mandelbrot view.

### Iterations

Allow the maximum iteration count to be changed through a simple control.

Reasonable limits should prevent accidental values that make the application effectively unusable.

### Mandelbrot / Julia

The user can switch between Mandelbrot and Julia rendering.

Julia mode should expose the real and imaginary components of its complex parameter using simple controls.

An optional enhancement is allowing the user to choose a point from the Mandelbrot view and use it as the Julia parameter.

## Render scheduling

User interaction can produce render requests faster than native computation can complete them.

The application should avoid displaying obsolete renders.

At minimum, it must distinguish newer render requests from older ones and ignore results that no longer correspond to the current viewport.

If the Crumb native-extension mechanism provides or is intended to support cancellation, Crumbbrot is a suitable example for exercising it. Cancellation is desirable but not required for the first version if stale results are handled correctly.

## Platform support

Support the same initial platforms as Crumb:

* macOS arm64;
* Linux x64 GNU on the supported Wayland environment.

The Rust extension should expose the same logical API on both platforms.

The fractal implementation should preferably use pure Rust and introduce no additional operating-system runtime dependency.

## Standalone distribution

The normal Crumb build must produce one standalone executable per supported target.

After building, the executable must run from an otherwise empty directory without requiring:

* Bun;
* Node.js;
* Cargo;
* Rust;
* `node_modules`;
* the Rust source tree;
* an adjacent `.node`, `.dylib`, or `.so` belonging to Crumbbrot.

The acceptance test must exercise an actual Rust-rendered fractal after relocation. Opening the window alone is insufficient.

## Testing

Provide proportionate automated tests.

At minimum test:

* application configuration and native-extension declaration;
* mapping from viewport coordinates to fractal coordinates;
* known Mandelbrot points that should remain bounded;
* known points that should escape;
* Julia rendering for at least one known parameter;
* output buffer dimensions;
* invalid render dimensions or iteration limits;
* TypeScript/native integration;
* successful standalone native-extension loading.

Tests should not try to establish the exact color of every pixel unless needed for a small deterministic test case.

## Performance expectations

No formal benchmark target is required.

A normal desktop-sized render should complete quickly enough to make zooming and panning useful on contemporary supported hardware.

The application should not freeze its UI while a render is running.

Render duration may be displayed in the interface because it provides useful feedback and makes the native computation visible.

## Security and robustness

All input originating in the WebView must continue through the normal Crumb validation boundary before reaching native code.

Reject unreasonable dimensions, malformed numeric values, unsupported fractal modes, and iteration counts outside the application's accepted range.

The Rust extension must handle expected errors without panicking.

The application must remain stable when:

* its window is resized rapidly;
* several renders are requested in quick succession;
* an older render finishes after a newer request;
* the window closes while rendering is in progress.

## Non-goals

The first version does not need:

* arbitrary fractal formulas;
* GPU acceleration;
* OpenGL, Metal, Vulkan, or WebGPU;
* image export;
* saved bookmarks;
* persistent settings;
* multiple windows;
* animations;
* networking;
* plugins;
* arbitrary-precision mathematics;
* extreme deep-zoom capability.

Do not add these unless required to solve a concrete problem in the basic implementation.

## Acceptance criteria

Crumbbrot is complete when:

1. It runs as a normal Crumb application.
2. The main UI is an interactive graphical fractal explorer.
3. Mandelbrot rendering is implemented by an application-owned Rust native extension.
4. The Rust extension is incorporated using the standard Crumb native-extension workflow without manually managed intermediate native artifacts.
5. TypeScript application code does not reference platform-specific `.node` paths.
6. Rust returns rendered pixel data efficiently as binary data.
7. Zooming and panning request new native renders.
8. Obsolete render results do not overwrite a newer view.
9. Julia mode works with configurable parameters.
10. Rendering does not block normal UI interaction.
11. The application works on the supported macOS and Linux targets.
12. The normal Crumb build produces a single standalone executable.
13. The relocated executable successfully performs a real Rust-backed render without Bun, Node.js, Rust, Cargo, or adjacent application files.
14. Automated tests cover the important calculation, validation, integration, and packaging behaviour.

## What this example is intended to prove

Crumbbrot should demonstrate a specific development model rather than merely demonstrate fractals:

**Use ordinary web technologies for the desktop application, Bun and Crumb for the application/toolchain, and add a small Rust module where native computation is useful — while preserving a single, self-contained executable as the resulting application.**
